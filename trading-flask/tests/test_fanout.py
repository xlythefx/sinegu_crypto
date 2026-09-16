"""_process_trade_job — the fan-out core, with every collaborator mocked."""

from __future__ import annotations

import threading
from unittest.mock import MagicMock, patch

import pytest

import binance_abcd.routes.webhook as webhook
import binance_abcd.exchanges as exchanges


def _entry_ok(api, symbol, side, quantity, price):
    return {"result": {"orderId": 1}, "symbol": symbol, "quantity": quantity, "price": price}


def _run_job(fake_accounts, fake_assets, action="BUY", ticker="BTCUSDT", entry=None, exit_=None,
             price=100.0, **kwargs):
    """Run a job with accounts/assets/engine/Binance all patched; returns
    (summary, handle_entry mock, handle_exit mock, api_instances)."""
    api_instances = []

    def _fake_api(api_key, secret_key, base_url=None):
        instance = MagicMock(name=f"BinanceAPI({api_key})")
        instance.api_key = api_key
        instance.base_url = base_url
        api_instances.append(instance)
        return instance

    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", side_effect=_fake_api),
        patch.object(webhook, "handle_entry", side_effect=entry or _entry_ok) as entry_mock,
        patch.object(
            webhook, "handle_exit",
            side_effect=exit_ or (lambda api, t, ps, p: {"result": {"orderId": 2}, "closed_quantity": 0.5, "entry_price": 100.0}),
        ) as exit_mock,
        patch.object(webhook.engine_client, "get_json", return_value={"success": True, "positions": []}),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
        patch.object(webhook.engine_client, "delete_json", return_value={"success": True}),
    ):
        summary = webhook._process_trade_job(action, ticker, price, None, "strat", **kwargs)
    return summary, entry_mock, exit_mock, api_instances


def test_all_accounts_are_attempted(fake_accounts, fake_assets):
    summary, entry_mock, _, _ = _run_job(fake_accounts, fake_assets)
    assert summary["target_count"] == 3
    assert summary["filled"] == 3
    assert entry_mock.call_count == 3
    assert summary["success"] is True


def test_one_account_failure_does_not_stop_others(fake_accounts, fake_assets):
    calls = []

    def entry(api, symbol, side, quantity, price):
        calls.append(api.api_key)
        if api.api_key == "demo-key-2":
            raise RuntimeError("boom")
        return _entry_ok(api, symbol, side, quantity, price)

    summary, _, _, _ = _run_job(fake_accounts, fake_assets, entry=entry)
    assert summary["filled"] == 2
    assert summary["failed"] == 1
    assert len(calls) == 3
    assert summary["success"] is False


def test_demo_account_routes_to_testnet(fake_accounts, fake_assets):
    _, _, _, api_instances = _run_job(fake_accounts, fake_assets)
    by_key = {api.api_key: api.base_url for api in api_instances}
    assert "demo-fapi" in by_key["demo-key-2"]
    assert "demo-fapi" not in by_key["live-key-1"]


def test_entry_fails_closed_without_asset(fake_accounts, fake_assets):
    summary, entry_mock, _, _ = _run_job(fake_accounts, fake_assets, ticker="XRPUSDT")
    assert summary["category"] == "rejected"
    assert summary["target_count"] == 0
    entry_mock.assert_not_called()
    assert summary["details"][0]["reason"] == "asset_not_configured"


def test_exit_runs_even_without_asset(fake_accounts, fake_assets):
    summary, _, exit_mock, _ = _run_job(fake_accounts, fake_assets, action="EXIT_LONG", ticker="XRPUSDT")
    assert summary["category"] == "signal"
    assert exit_mock.call_count == 3


def test_asset_side_gates_entry_direction(fake_accounts, fake_assets):
    # DOGEUSDT side=LONG: BUY allowed, SELL rejected.
    summary, _, _, _ = _run_job(fake_accounts, fake_assets, action="SELL", ticker="DOGEUSDT")
    assert summary["category"] == "rejected"
    assert "side_LONG_blocks_SELL" in summary["details"][0]["reason"]

    summary, _, _, _ = _run_job(fake_accounts, fake_assets, action="BUY", ticker="DOGEUSDT")
    assert summary["filled"] == 3


def test_target_uni_ids_filters_accounts(fake_accounts, fake_assets):
    summary, entry_mock, _, _ = _run_job(
        fake_accounts, fake_assets, target_uni_ids={"uni-live-1"},
    )
    assert summary["target_count"] == 1
    assert entry_mock.call_count == 1


def test_stack_cap_skips_maxed_account(fake_accounts, fake_assets):
    # live-key-1 already holds 10 increments of BTCUSDT (0.005 * 10 = 0.05).
    open_positions = {"success": True, "positions": [
        {"api_key": "live-key-1", "position_side": "LONG", "position_amt": 0.05, "entry_price": 60000},
    ]}
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok) as entry_mock,
        patch.object(webhook.engine_client, "get_json", return_value=open_positions),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
    ):
        summary = webhook._process_trade_job("BUY", "BTCUSDT", 100.0, None, None)

    assert summary["skipped"] == 1
    assert summary["filled"] == 2
    skipped = [r for r in summary["details"] if r["status"] == "skipped"]
    assert skipped[0]["reason"] == "maxed sizing"


def test_filled_entry_records_the_sizing_inputs(fake_accounts, fake_assets):
    """Every entry detail carries the inputs the size was derived from, so a
    trade_logs row explains itself without replaying balances."""
    summary, _, _, _ = _run_job(fake_accounts, fake_assets, action="BUY", ticker="BTCUSDT")

    by_account = {r["account"]: r for r in summary["details"]}

    # BTCUSDT is a coarse-step ticker: whole base_size steps per 1000 of balance.
    live_one = by_account["Live One"]["sizing"]          # balance 1000 -> 1 step
    assert live_one["balance"] == 1000.0
    assert live_one["base_size"] == 0.005
    assert live_one["reference_balance"] == 1000.0
    assert live_one["coarse_step"] is True
    assert live_one["quantity"] == by_account["Live One"]["quantity"] == 0.005
    assert live_one["size_multiple"] == 1.0
    assert live_one["max_increments"] == 10.0
    assert live_one["min_deposit"] == 1000.0
    assert live_one["total_deposit"] == 1000.0

    # Funded above the minimum but drawn down to 300 -> still trades, at one
    # base_size. This is the drawdown case the deposit gate exists to allow.
    demo_two = by_account["Demo Two"]["sizing"]
    assert demo_two["balance"] == 300.0
    assert demo_two["total_deposit"] == 1500.0
    assert demo_two["size_multiple"] == 1.0

    # 2500 / 1000 -> 2 whole steps.
    assert by_account["Live Three"]["sizing"]["size_multiple"] == 2.0


def test_entries_are_refused_below_the_minimum_deposit(fake_accounts, fake_assets):
    """Under-funded accounts are skipped, not sized down."""
    fake_accounts[1]["total_deposit"] = 400.0

    summary, entry_mock, _, _ = _run_job(fake_accounts, fake_assets, action="BUY")

    assert summary["filled"] == 2
    assert summary["skipped"] == 1
    assert entry_mock.call_count == 2  # the blocked account never reaches Binance
    skipped = [r for r in summary["details"] if r["status"] == "skipped"][0]
    assert skipped["account"] == "Demo Two"
    assert skipped["reason"] == "deposit below minimum"
    assert skipped["sizing"]["total_deposit"] == 400.0
    assert skipped["sizing"]["min_deposit"] == 1000.0


def test_an_unknown_deposit_fails_closed(fake_accounts, fake_assets):
    """No deposit figure = no entry. A never-polled account must not trade."""
    fake_accounts[1].pop("total_deposit")
    fake_accounts[1].pop("initial_deposit")

    summary, _, _, _ = _run_job(fake_accounts, fake_assets, action="BUY")

    skipped = [r for r in summary["details"] if r["status"] == "skipped"][0]
    assert skipped["reason"] == "deposit unknown"
    assert summary["filled"] == 2


def test_deposit_gate_reads_deposit_not_balance(fake_accounts, fake_assets):
    """Deposited over the minimum but drawn down under it -> still trades."""
    fake_accounts[1]["total_deposit"] = 1200.0
    fake_accounts[1]["balance"] = 50.0

    summary, _, _, _ = _run_job(fake_accounts, fake_assets, action="BUY")

    assert summary["filled"] == 3
    assert summary["skipped"] == 0


def test_exits_are_never_deposit_gated(fake_accounts, fake_assets):
    """An open position must be closable even once the account is ineligible."""
    fake_accounts[1]["total_deposit"] = 10.0

    summary, _, exit_mock, _ = _run_job(fake_accounts, fake_assets, action="EXIT_LONG")

    assert summary["filled"] == 3
    assert exit_mock.call_count == 3


def test_total_deposit_falls_back_to_initial_deposit(fake_accounts, fake_assets):
    """Backends predating total_deposit still gate correctly."""
    fake_accounts[1].pop("total_deposit")
    fake_accounts[1]["initial_deposit"] = 2000.0

    summary, _, _, _ = _run_job(fake_accounts, fake_assets, action="BUY")

    assert summary["filled"] == 3
    by_account = {r["account"]: r for r in summary["details"]}
    assert by_account["Demo Two"]["sizing"]["total_deposit"] == 2000.0


def test_maxed_sizing_skip_records_the_stack_state(fake_accounts, fake_assets):
    """A 'maxed sizing' skip says how full the stack was when it was refused."""
    open_positions = {"success": True, "positions": [
        {"api_key": "live-key-1", "position_side": "LONG", "position_amt": 0.05, "entry_price": 60000},
    ]}
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok),
        patch.object(webhook.engine_client, "get_json", return_value=open_positions),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
    ):
        summary = webhook._process_trade_job("BUY", "BTCUSDT", 100.0, None, None)

    skipped = [r for r in summary["details"] if r["status"] == "skipped"][0]
    assert skipped["reason"] == "maxed sizing"
    assert skipped["sizing"]["stacks_now"] == 10.0
    assert skipped["sizing"]["max_increments"] == 10.0


def test_symbol_lock_serializes_same_account(fake_accounts, fake_assets):
    """Two concurrent jobs for the same account+symbol must not overlap."""
    active = threading.Semaphore(1)
    overlaps = []

    def entry(api, symbol, side, quantity, price):
        if not active.acquire(blocking=False):
            overlaps.append(api.api_key)
        else:
            threading.Event().wait(0.05)
            active.release()
        return _entry_ok(api, symbol, side, quantity, price)

    one_account = fake_accounts[:1]
    threads = [
        threading.Thread(target=_run_job, args=(one_account, fake_assets), kwargs={"entry": entry})
        for _ in range(2)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)
    assert overlaps == []


def test_a_blocked_key_is_skipped_on_entry(fake_accounts, fake_assets):
    """The exchange refuses this key from our server, so opening would burn an
    API call to be told no."""
    fake_accounts[1]["key_blocked"] = True

    summary, entry_mock, _, _ = _run_job(fake_accounts, fake_assets, action="BUY")

    assert summary["filled"] == 2
    assert summary["skipped"] == 1
    assert entry_mock.call_count == 2
    by_account = {r["account"]: r for r in summary["details"]}
    blocked = by_account[fake_accounts[1]["name"]]
    assert blocked["status"] == "skipped"
    assert blocked["reason"] == "api key blocked"


def test_a_blocked_key_still_attempts_exits(fake_accounts, fake_assets):
    """If the user has since fixed their whitelist the exit goes through — and
    refusing to try would strand an open position on a written-off account."""
    fake_accounts[1]["key_blocked"] = True

    summary, _, exit_mock, _ = _run_job(fake_accounts, fake_assets, action="EXIT_LONG")

    assert summary["filled"] == 3
    assert exit_mock.call_count == 3


def test_the_stack_cap_scales_with_the_account(fake_accounts, fake_assets):
    """The cap counts THIS account's entries, not raw base sizes.

    live-key-1 on 5,000 USDT gets 5x base (0.025 BTC) per entry, so 0.05 open
    is TWO of its entries — well inside the cap of 10. Counting raw base sizes
    instead made that 10 stacks and refused the trade, which is how a larger
    account ended up with a single entry it could never add to.
    """
    fake_accounts[0]["balance"] = 5000.0
    open_positions = {"success": True, "positions": [
        {"api_key": "live-key-1", "position_side": "LONG", "position_amt": 0.05, "entry_price": 60000},
    ]}
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts[:1]),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok) as entry_mock,
        patch.object(webhook.engine_client, "get_json", return_value=open_positions),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
    ):
        summary = webhook._process_trade_job("BUY", "BTCUSDT", 100.0, None, None)

    assert summary["filled"] == 1
    detail = summary["details"][0]
    assert detail["quantity"] == 0.025
    assert detail["sizing"]["stacks_now"] == 2.0


def test_a_scaled_account_still_hits_its_own_cap(fake_accounts, fake_assets):
    """Scaling the cap must not remove it: 10 of its own entries is still full."""
    fake_accounts[0]["balance"] = 5000.0          # entry = 0.025 BTC
    open_positions = {"success": True, "positions": [
        {"api_key": "live-key-1", "position_side": "LONG", "position_amt": 0.25, "entry_price": 60000},
    ]}
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts[:1]),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok),
        patch.object(webhook.engine_client, "get_json", return_value=open_positions),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
    ):
        summary = webhook._process_trade_job("BUY", "BTCUSDT", 100.0, None, None)

    assert summary["skipped"] == 1
    skipped = summary["details"][0]
    assert skipped["reason"] == "maxed sizing"
    assert skipped["sizing"]["stacks_now"] == 10.0
    # The depth the account is stuck at, for the admin "max increments" note.
    assert (skipped["increment"], skipped["max_increments"]) == (10, 10)


# --- Increment published to Telegram -------------------------------------------

def test_a_fill_carries_the_stack_depth_it_reached(fake_accounts, fake_assets):
    """Depth is pre-entry count + 1, derived from the batched read rather than
    re-asking Binance for the new position size (an API call per account)."""
    fake_accounts[0]["balance"] = 5000.0          # entry = 0.025 BTC
    open_positions = {"success": True, "positions": [
        {"api_key": "live-key-1", "position_side": "LONG", "position_amt": 0.05, "entry_price": 60000},
    ]}
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts[:1]),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok),
        patch.object(webhook.engine_client, "get_json", return_value=open_positions),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
    ):
        summary = webhook._process_trade_job("BUY", "BTCUSDT", 100.0, None, None)

    detail = summary["details"][0]
    assert detail["sizing"]["stacks_now"] == 2.0
    assert (detail["increment"], detail["max_increments"]) == (3, 10)


def test_depth_is_recorded_even_when_the_asset_has_no_cap(fake_accounts, fake_assets):
    """max_increments = 0 disables the cap, not the audit trail: the batched read
    is already paid for, so the entry's place in the stack is still recorded."""
    fake_assets["BTCUSDT"]["max_increments"] = 0.0
    open_positions = {"success": True, "positions": [
        {"api_key": "live-key-1", "position_side": "LONG", "position_amt": 0.005, "entry_price": 60000},
    ]}
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts[:1]),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok),
        patch.object(webhook.engine_client, "get_json", return_value=open_positions),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
    ):
        summary = webhook._process_trade_job("BUY", "BTCUSDT", 100.0, None, None)

    detail = summary["details"][0]
    assert summary["filled"] == 1                  # no cap => never refused
    assert detail["sizing"]["stacks_now"] == 1.0
    assert detail["increment"] == 2
    assert detail["max_increments"] is None        # renders as "Increment (#2)"


def test_published_increment_takes_the_most_common_depth():
    """One account that connected late must not decide what the channel says."""
    results = [
        {"status": "filled", "increment": 3, "max_increments": 10},
        {"status": "filled", "increment": 3, "max_increments": 10},
        {"status": "filled", "increment": 1, "max_increments": 10},
        {"status": "skipped", "increment": 9, "max_increments": 10},
    ]
    assert webhook._published_increment(results) == (3, 10)


def test_published_increment_is_none_when_no_depth_was_derived():
    results = [{"status": "filled", "increment": None, "max_increments": None}]
    assert webhook._published_increment(results) == (None, None)


@pytest.mark.parametrize(
    "balance, quantity, ceiling",
    [
        (500, 14.0, 42.0),      # below the reference balance: one base size
        (1000, 14.0, 42.0),     # at the reference balance
        (2000, 28.0, 84.0),     # double the balance -> double entry AND ceiling
        (5000, 70.0, 210.0),
    ],
)
def test_the_cap_scales_with_the_balance_but_the_entry_COUNT_does_not(
    fake_accounts, fake_assets, balance, quantity, ceiling
):
    """The invariant the whole sizing design rests on.

    `max_increments` is a fixed count (3 for LTCUSDT: 42 / 14), so the absolute
    exposure it allows scales with the account exactly as the entry size does.
    A 2,000 USDT account trades 28 per entry and may reach 84; a 1,000 USDT one
    trades 14 and may reach 42 — both are "3 entries deep", i.e. the same risk.

    Asserted at the boundary: one increment below the ceiling still fills, and
    the entry that would cross it is refused.
    """
    fake_assets["LTCUSDT"] = {
        "ticker": "LTCUSDT", "base_size": 14.0, "max_size": 42.0,
        "max_increments": 3.0, "side": "ALL",
    }
    fake_accounts[0]["balance"] = float(balance)
    assert webhook._scale_qty("LTCUSDT", 14.0, balance) == quantity

    def run(open_amount):
        positions = {"success": True, "positions": [{
            "api_key": "live-key-1", "position_side": "LONG",
            "position_amt": open_amount, "entry_price": 100,
        }]}
        with (
            patch.object(webhook, "fetch_accounts", return_value=fake_accounts[:1]),
            patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
            patch.object(exchanges, "BinanceAPI", MagicMock()),
            patch.object(webhook, "handle_entry", side_effect=_entry_ok),
            patch.object(webhook.engine_client, "get_json", return_value=positions),
            patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
        ):
            return webhook._process_trade_job("BUY", "LTCUSDT", 100.0, None, None)

    # Two increments open -> the third still fits.
    below = run(ceiling - quantity)
    assert below["filled"] == 1
    assert below["details"][0]["increment"] == 3

    # Ceiling reached -> the fourth is refused, not silently placed.
    at_cap = run(ceiling)
    assert at_cap["skipped"] == 1
    assert at_cap["details"][0]["reason"] == "maxed sizing"


# --- Increments closed (exit side) ---------------------------------------------

def test_closed_increments_divides_by_the_scaled_entry_size(fake_assets):
    """A 5,000 USDT account's entry is 0.025 BTC, so a 0.075 close is 3 — not
    the 15 you get by dividing the raw 0.005 base size."""
    account = {"balance": 5000.0}
    assert webhook._closed_increments(
        account, fake_assets["BTCUSDT"], "BTCUSDT", 0.075) == (3, 10)


def test_closed_increments_scales_down_for_a_small_account(fake_assets):
    """Below the reference balance every account still trades one base size."""
    account = {"balance": 500.0}
    assert webhook._closed_increments(
        account, fake_assets["BTCUSDT"], "BTCUSDT", 0.015) == (3, 10)


def test_closed_increments_reports_none_without_an_asset_row():
    """Exits skip every asset gate, so a close must survive a deleted asset."""
    assert webhook._closed_increments({"balance": 1000.0}, None, "BTCUSDT", 0.01) == (None, None)


def test_closed_increments_never_reports_zero(fake_assets):
    """A partial close smaller than one entry is still a real close."""
    account = {"balance": 1000.0}
    assert webhook._closed_increments(
        account, fake_assets["BTCUSDT"], "BTCUSDT", 0.0001)[0] == 1


def test_closed_increments_has_no_cap_when_the_asset_has_none(fake_assets):
    fake_assets["BTCUSDT"]["max_increments"] = 0.0
    account = {"balance": 1000.0}
    assert webhook._closed_increments(
        account, fake_assets["BTCUSDT"], "BTCUSDT", 0.01) == (2, None)


# --- The price published beside an entry ---------------------------------------

def _entry_with(avg_price):
    def entry(api, symbol, side, quantity, price):
        return {"result": {"orderId": 1, "avgPrice": avg_price}, "symbol": symbol,
                "quantity": quantity, "price": price}
    return entry


def _entry_notification(fake_accounts, fake_assets, *, entry, risk, price=100.0):
    """Run an entry fan-out and hand back (notify_entry kwargs, position_risk_map mock)."""
    with (
        patch.object(webhook.notify, "notify_entry") as notify_mock,
        patch.object(webhook, "position_risk_map", return_value=risk) as risk_mock,
    ):
        _run_job(fake_accounts, fake_assets, entry=entry, price=price)
    return notify_mock.call_args.kwargs, risk_mock


def test_entry_publishes_the_real_executed_price(fake_accounts, fake_assets):
    """avgPrice is the executed price — and it costs nothing extra to read."""
    kwargs, risk_mock = _entry_notification(
        fake_accounts, fake_assets, entry=_entry_with("109250.5"), risk={"LONG": (0.01, 999.0)})
    assert kwargs["fill_price"] == 109250.5
    risk_mock.assert_not_called()  # never spend a weight-5 call we don't need


def test_entry_falls_back_to_the_position_entry_price(fake_accounts, fake_assets):
    """Binance answers avgPrice '0.00' on filled market orders, and a manual
    trade carries no signal price — without the positionRisk fallback the
    channel publishes an entry with no price line at all."""
    kwargs, risk_mock = _entry_notification(
        fake_accounts, fake_assets, entry=_entry_with("0.00"),
        risk={"LONG": (0.03, 48.86)}, price=None)
    assert kwargs["fill_price"] == 48.86
    assert risk_mock.call_count == 1  # once per SIGNAL, not once per account


def test_entry_keeps_the_signal_price_when_positions_are_unreadable(fake_accounts, fake_assets):
    """Fail-soft: an unreadable position must not blank the price line."""
    kwargs, _ = _entry_notification(
        fake_accounts, fake_assets, entry=_entry_with("0.00"), risk=None)
    assert kwargs["fill_price"] is None
    assert kwargs["price"] == 100.0
