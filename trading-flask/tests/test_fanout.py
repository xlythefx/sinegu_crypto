"""_process_trade_job — the fan-out core, with every collaborator mocked."""

from __future__ import annotations

import threading
from unittest.mock import MagicMock, patch

import binance_abcd.routes.webhook as webhook


def _entry_ok(api, symbol, side, quantity, price):
    return {"result": {"orderId": 1}, "symbol": symbol, "quantity": quantity, "price": price}


def _run_job(fake_accounts, fake_assets, action="BUY", ticker="BTCUSDT", entry=None, exit_=None, **kwargs):
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
        patch.object(webhook, "get_asset", side_effect=lambda t: fake_assets.get(t.upper())),
        patch.object(webhook, "BinanceAPI", side_effect=_fake_api),
        patch.object(webhook, "handle_entry", side_effect=entry or _entry_ok) as entry_mock,
        patch.object(
            webhook, "handle_exit",
            side_effect=exit_ or (lambda api, t, ps, p: {"result": {"orderId": 2}, "closed_quantity": 0.5, "entry_price": 100.0}),
        ) as exit_mock,
        patch.object(webhook.engine_client, "get_json", return_value={"success": True, "positions": []}),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
        patch.object(webhook.engine_client, "delete_json", return_value={"success": True}),
    ):
        summary = webhook._process_trade_job(action, ticker, 100.0, None, "strat", **kwargs)
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
        patch.object(webhook, "get_asset", side_effect=lambda t: fake_assets.get(t.upper())),
        patch.object(webhook, "BinanceAPI", MagicMock()),
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
        patch.object(webhook, "get_asset", side_effect=lambda t: fake_assets.get(t.upper())),
        patch.object(webhook, "BinanceAPI", MagicMock()),
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
