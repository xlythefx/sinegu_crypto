"""Loss-streak sizing — a ladder of manual entry sizes per losing streak.

The rules are the owner's (2026-10-09): after N losses in a row on a coin an
account's next ENTRY uses the size typed for step N, a blank step carries the
previous one, one win resets to base, the step still scales with the balance,
and an unreadable streak trades base size. Exits never change.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import binance_abcd.assets_api as assets_api
import binance_abcd.exchanges as exchanges
import binance_abcd.routes.webhook as webhook


@pytest.fixture()
def ltc():
    """LTC as the loader hands it down: base 50, max position 150 (= 3 entries),
    ladder 1 loss → 40, 3+ losses → 25 (2 left blank on purpose)."""
    return {"ticker": "LTCUSDT", "base_size": 50.0, "max_size": 150.0, "max_increments": 3.0,
            "side": "ALL", "loss_sizes": {1: 40.0, 3: 25.0}}


def _entry_ok(api, symbol, side, quantity, price):
    return {"result": {"orderId": 1}, "symbol": symbol, "quantity": quantity, "price": price}


def _run(accounts, asset, *, streaks=None, positions=(), action="BUY", exit_=None):
    """Run one LTC job. `streaks` is the loss-streaks payload's map, or None for
    a failed read. Returns (summary, entry mock, exit mock, paths GET'd)."""
    asked: list[str] = []

    def fake_get(path, *args, **kwargs):
        asked.append(path)
        if path == "loss-streaks":
            return None if streaks is None else {"success": True, "streaks": streaks}
        return {"success": True, "positions": list(positions)}

    with (
        patch.object(webhook, "fetch_accounts", return_value=accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: asset if t.upper() == "LTCUSDT" else None),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok) as entry_mock,
        patch.object(
            webhook, "handle_exit",
            side_effect=exit_ or (lambda api, t, ps, p: {"result": {"orderId": 2}, "closed_quantity": 75.0, "entry_price": 60.0}),
        ) as exit_mock,
        patch.object(webhook.engine_client, "get_json", side_effect=fake_get),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
        patch.object(webhook.engine_client, "delete_json", return_value={"success": True}),
        patch.object(webhook, "_BOOKKEEPING_EXECUTOR", MagicMock()),
    ):
        summary = webhook._process_trade_job(action, "LTCUSDT", 60.0, None, None)
    return summary, entry_mock, exit_mock, asked


def _by_account(summary):
    return {d["account"]: d for d in summary["details"]}


# --- which step applies ----------------------------------------------------------

@pytest.mark.parametrize("streak, expected", [
    (0, (50.0, 0)),   # no losses → base
    (1, (40.0, 1)),
    (2, (40.0, 1)),   # step 2 left blank → keeps step 1
    (3, (25.0, 3)),
    (7, (25.0, 3)),   # past the deepest step → the deepest keeps applying
])
def test_the_deepest_step_at_or_below_the_streak_applies(ltc, streak, expected):
    assert webhook._loss_size(ltc, streak) == expected


def test_a_streak_shallower_than_the_first_step_is_base(ltc):
    ltc["loss_sizes"] = {3: 25.0}
    assert webhook._loss_size(ltc, 1) == (50.0, 0)


# --- entries ------------------------------------------------------------------------

def test_each_account_trades_its_own_step_scaled_by_its_balance(fake_accounts, ltc):
    """Live One (1,000 USDT) is on 3 losses → 25; Live Three (2,500) on 1 loss →
    40 × 2.5 = 100; Demo Two has no history → base 50 (300 USDT is under the
    reference balance, so unscaled)."""
    summary, entry_mock, _, _ = _run(fake_accounts, ltc, streaks={"live-key-1": 3, "live-key-3": 1})

    details = _by_account(summary)
    assert details["Live One"]["quantity"] == 25.0
    assert details["Live Three"]["quantity"] == 100.0
    assert details["Demo Two"]["quantity"] == 50.0
    assert entry_mock.call_count == 3


def test_a_win_means_base_size(fake_accounts, ltc):
    summary, _, _, _ = _run(fake_accounts[:1], ltc, streaks={"live-key-1": 0})
    assert summary["details"][0]["quantity"] == 50.0


def test_the_sizing_row_explains_the_step(fake_accounts, ltc):
    summary, _, _, _ = _run(fake_accounts[2:], ltc, streaks={"live-key-3": 2})

    sizing = summary["details"][0]["sizing"]
    assert sizing["base_size"] == 50.0           # the asset's own figure
    assert sizing["loss_streak"] == 2
    assert sizing["streak_known"] is True
    assert sizing["streak_step"] == 1
    assert sizing["streak_size"] == 40.0
    assert sizing["quantity"] == 100.0           # 40 × 2.5
    assert sizing["normal_quantity"] == 125.0    # what base would have been
    assert sizing["size_multiple"] == 2.5


def test_an_unreadable_streak_trades_base_size(fake_accounts, ltc):
    summary, _, _, _ = _run(fake_accounts[:1], ltc, streaks=None)

    detail = summary["details"][0]
    assert detail["status"] == "filled"
    assert detail["quantity"] == 50.0
    assert detail["sizing"]["streak_known"] is False


def test_an_asset_without_a_ladder_makes_no_streak_read(fake_accounts, ltc):
    ltc["loss_sizes"] = {}
    summary, _, _, asked = _run(fake_accounts, ltc, streaks={"live-key-1": 3})

    assert "loss-streaks" not in asked
    assert _by_account(summary)["Live One"]["quantity"] == 50.0
    assert "loss_streak" not in summary["details"][0]["sizing"]


def test_the_streak_read_is_one_call_for_every_account(fake_accounts, ltc):
    _, _, _, asked = _run(fake_accounts, ltc, streaks={})
    assert asked.count("loss-streaks") == 1


# --- the stack cap ------------------------------------------------------------------

def test_the_cap_counts_entries_of_the_streak_size(fake_accounts, ltc):
    """Two 25-unit entries open on a 3-loss streak = 2 of 3 — the third is allowed."""
    positions = [{"api_key": "live-key-1", "position_side": "LONG", "position_amt": 50.0, "entry_price": 60}]
    summary, _, _, _ = _run(fake_accounts[:1], ltc, streaks={"live-key-1": 3}, positions=positions)

    detail = summary["details"][0]
    assert detail["status"] == "filled"
    assert detail["sizing"]["stacks_now"] == 2.0
    assert detail["increment"] == 3


def test_a_full_streak_stack_is_still_maxed(fake_accounts, ltc):
    positions = [{"api_key": "live-key-1", "position_side": "LONG", "position_amt": 75.0, "entry_price": 60}]
    summary, entry_mock, _, _ = _run(fake_accounts[:1], ltc, streaks={"live-key-1": 3}, positions=positions)

    assert summary["details"][0]["reason"] == "maxed sizing"
    entry_mock.assert_not_called()


def test_a_step_bigger_than_base_can_never_pass_the_max_position_size(fake_accounts, ltc):
    """A 60-unit step against a 50 base: two entries (120) are 2 of 3 by count,
    but a third would make 180 against a 150 max position — refused."""
    ltc["loss_sizes"] = {1: 60.0}
    positions = [{"api_key": "live-key-1", "position_side": "LONG", "position_amt": 120.0, "entry_price": 60}]
    summary, entry_mock, _, _ = _run(fake_accounts[:1], ltc, streaks={"live-key-1": 1}, positions=positions)

    assert summary["details"][0]["reason"] == "maxed sizing"
    entry_mock.assert_not_called()


# --- exits ---------------------------------------------------------------------------

def test_exits_are_never_resized(fake_accounts, ltc):
    summary, entry_mock, exit_mock, _ = _run(fake_accounts, ltc, streaks={"live-key-1": 3}, action="EXIT_LONG")

    assert summary["filled"] == 3
    assert exit_mock.call_count == 3
    entry_mock.assert_not_called()


def test_increments_closed_divides_by_the_streak_size(fake_accounts, ltc):
    """Three 25-unit entries close as 75: that is 3 increments, not the 2 you get
    dividing by the 50 base — the figure the channel and the trade count read."""
    summary, _, _, _ = _run(fake_accounts[:1], ltc, streaks={"live-key-1": 3}, action="EXIT_LONG")
    assert summary["details"][0]["increment"] == 3


def test_increments_closed_falls_back_to_base_without_streaks(ltc):
    account = {"api_key": "k", "balance": 1000.0}
    assert webhook._closed_increments(account, ltc, "LTCUSDT", 75.0, None) == (2, 3)
    assert webhook._closed_increments(account, ltc, "LTCUSDT", 75.0, {"k": 3}) == (3, 3)


# --- the read and the loader ------------------------------------------------------

def test_the_streak_read_tells_empty_from_unavailable():
    with patch.object(webhook.engine_client, "get_json", return_value=None):
        assert webhook._fetch_loss_streaks("LTCUSDT", "binance", 3) is None
    with patch.object(webhook.engine_client, "get_json", return_value={"success": True, "streaks": []}):
        assert webhook._fetch_loss_streaks("LTCUSDT", "binance", 3) == {}
    with patch.object(webhook.engine_client, "get_json", return_value={"success": True, "streaks": "x"}):
        assert webhook._fetch_loss_streaks("LTCUSDT", "binance", 3) is None
    with patch.object(webhook.engine_client, "get_json",
                      return_value={"success": True, "streaks": {"a": 2, "b": "bad"}}) as get:
        assert webhook._fetch_loss_streaks("ltcusdt", "binance", 3) == {"a": 2}
    assert get.call_args.kwargs["params"] == {"symbol": "LTCUSDT", "depth": 3}


def test_the_loader_reads_the_ladder_only_when_switched_on():
    on = {"loss_sizing_enabled": True,
          "loss_sizes": [{"losses": 3, "size": 25}, {"losses": 1, "size": "40"}, {"losses": 0, "size": 9},
                         {"losses": 2, "size": 0}, {"bad": True}]}
    assert assets_api._loss_ladder(on) == {1: 40.0, 3: 25.0}
    assert list(assets_api._loss_ladder(on)) == [1, 3]
    assert assets_api._loss_ladder({**on, "loss_sizing_enabled": False}) == {}
    assert assets_api._loss_ladder({}) == {}   # an API older than the feature
