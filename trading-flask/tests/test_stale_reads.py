"""A failed Binance read must never be stored, or acted on, as "nothing there".

All three regressions here share one root cause and were seen together on prod
on 2026-08-18: `get_positions_v3` and `get_user_trades` answered `[]` on a
failed request, so a four-hour run of -1007 timeouts looked to the engine like
flat accounts and fill-less orders.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import binance_abcd.fetch_positions as fetch_positions
import binance_abcd.routes.webhook as webhook
import binance_abcd.trading_handler as trading_handler
from binance_abcd.binance_api import BinanceAPI


# --- The read layer: None (failed) vs [] (empty) -------------------------------

def _api() -> BinanceAPI:
    return BinanceAPI("k", "s", base_url="https://fapi.test")


def test_position_read_failure_is_none_not_empty():
    api = _api()
    with patch.object(BinanceAPI, "_request_get", return_value=None):
        assert api.get_positions_v3() is None


def test_flat_account_is_empty_list_not_none():
    api = _api()
    with patch.object(BinanceAPI, "_request_get", return_value=[]):
        assert api.get_positions_v3() == []


def test_zero_amount_positions_are_filtered_but_still_a_successful_read():
    api = _api()
    payload = [{"symbol": "BTCUSDT", "positionAmt": "0.000", "positionSide": "LONG"}]
    with patch.object(BinanceAPI, "_request_get", return_value=payload):
        assert api.get_positions_v3() == []


def test_user_trades_failure_is_none_not_empty():
    api = _api()
    with patch.object(BinanceAPI, "_request_get", return_value=None):
        assert api.get_user_trades("BTCUSDT", order_id=1) is None


# --- The poller: a failed read must not wipe the account's rows ---------------

def _account(name: str = "One", key: str = "k1") -> dict:
    return {"api_key": key, "secret_key": "s", "name": name, "uni_id": "u1", "demo": False}


def test_failed_position_read_is_skipped_never_synced_as_empty():
    """The sync is a full replace per api_key: syncing [] on a failed read
    deletes live positions, and the stack cap then reads 0 open."""
    api = MagicMock()
    api.get_positions_v3.return_value = None

    with (
        patch.object(fetch_positions, "fetch_accounts", return_value=[_account()]),
        patch.object(fetch_positions, "BinanceAPI", return_value=api),
        patch.object(fetch_positions.engine_client, "post_json") as post,
    ):
        assert fetch_positions.fetch_and_save() is None

    post.assert_not_called()


def test_one_failed_read_does_not_block_the_accounts_that_answered():
    ok, bad = MagicMock(), MagicMock()
    ok.get_positions_v3.return_value = [
        {"symbol": "BTCUSDT", "positionAmt": "0.5", "positionSide": "LONG", "entryPrice": "100"}
    ]
    bad.get_positions_v3.return_value = None
    apis = iter([ok, bad])

    with (
        patch.object(fetch_positions, "fetch_accounts",
                     return_value=[_account("Good", "k-good"), _account("Bad", "k-bad")]),
        patch.object(fetch_positions, "BinanceAPI", side_effect=lambda *a, **kw: next(apis)),
        patch.object(fetch_positions.engine_client, "post_json", return_value={"success": True}) as post,
    ):
        fetch_positions.fetch_and_save()

    synced = post.call_args[0][1]["accounts"]
    assert [a["api_key"] for a in synced] == ["k-good"]


def test_a_genuinely_flat_account_still_syncs_empty():
    """The wipe is only wrong when the read FAILED — a real close must still
    clear the rows, or the cap would count a position that no longer exists."""
    api = MagicMock()
    api.get_positions_v3.return_value = []

    with (
        patch.object(fetch_positions, "fetch_accounts", return_value=[_account()]),
        patch.object(fetch_positions, "BinanceAPI", return_value=api),
        patch.object(fetch_positions.engine_client, "post_json", return_value={"success": True}) as post,
    ):
        fetch_positions.fetch_and_save()

    assert post.call_args[0][1]["accounts"][0]["positions"] == []


# --- The stack cap: unknown depth fails closed --------------------------------

def test_open_amount_read_failure_is_none_not_zero():
    api = MagicMock()
    api.get_positions_v3.return_value = None
    assert webhook._binance_open_amount(api, "BTCUSDT", "LONG") is None


def test_open_amount_is_zero_when_the_side_is_genuinely_flat():
    api = MagicMock()
    api.get_positions_v3.return_value = [
        {"symbol": "BTCUSDT", "positionAmt": "0.5", "positionSide": "SHORT"}
    ]
    assert webhook._binance_open_amount(api, "BTCUSDT", "LONG") == 0.0


def test_entry_skips_when_a_cap_is_set_but_the_depth_cannot_be_read(fake_assets):
    """Entering blind is how a stack walks past its cap. Fails closed, like the
    asset and deposit gates."""
    account = {
        "api_key": "k1", "secret_key": "s", "name": "One", "uni_id": "u1",
        "balance": 1000.0, "total_deposit": 5000.0, "demo": False, "enabled": True,
    }
    api = MagicMock()
    api.get_positions_v3.return_value = None  # both sources unavailable

    with (
        patch.object(webhook, "BinanceAPI", return_value=api),
        patch.object(webhook, "handle_entry") as entry,
    ):
        result = webhook._run_account(
            account, "BUY", "BTCUSDT", 100.0, None, None,
            fake_assets["BTCUSDT"], None,  # open_amounts None -> Binance fallback
        )

    assert result["status"] == "skipped"
    assert result["reason"] == "stack depth unknown"
    entry.assert_not_called()


# --- The fill summary: retry through Binance's indexing lag -------------------

def test_fill_summary_retries_until_binance_indexes_the_fill(monkeypatch):
    monkeypatch.setattr(trading_handler, "FILL_SUMMARY_RETRY_SECONDS", 0.0)
    monkeypatch.setattr(trading_handler, "FILL_SUMMARY_ATTEMPTS", 3)

    api = MagicMock()
    api.get_user_trades.side_effect = [
        [],    # index has not caught up
        None,  # read failed outright
        [{"price": "100", "qty": "2", "realizedPnl": "5"}],
    ]

    pnl, exit_price = trading_handler.get_order_fill_summary(api, "BTCUSDT", 7)

    assert api.get_user_trades.call_count == 3
    assert pnl == pytest.approx(5.0)
    assert exit_price == pytest.approx(100.0)


def test_fill_summary_gives_up_quietly_after_the_last_attempt(monkeypatch):
    monkeypatch.setattr(trading_handler, "FILL_SUMMARY_RETRY_SECONDS", 0.0)
    monkeypatch.setattr(trading_handler, "FILL_SUMMARY_ATTEMPTS", 2)

    api = MagicMock()
    api.get_user_trades.return_value = []

    assert trading_handler.get_order_fill_summary(api, "BTCUSDT", 7) == (None, None)
    assert api.get_user_trades.call_count == 2


def test_fill_summary_does_not_retry_when_it_succeeds_first_time(monkeypatch):
    monkeypatch.setattr(trading_handler, "FILL_SUMMARY_RETRY_SECONDS", 0.0)
    api = MagicMock()
    api.get_user_trades.return_value = [{"price": "10", "qty": "1", "realizedPnl": "-1"}]

    trading_handler.get_order_fill_summary(api, "BTCUSDT", 7)
    assert api.get_user_trades.call_count == 1


def test_fill_summary_retry_budget_fits_inside_the_telegram_watchdog():
    """The exit message is released by TELEGRAM_PNL_WAIT_SECONDS. If the retries
    can outlast it the message ships without the PnL anyway, and the retry buys
    nothing but latency."""
    from binance_abcd import hooks

    worst_case = sum(
        hooks.FILL_SUMMARY_RETRY_SECONDS * attempt
        for attempt in range(1, hooks.FILL_SUMMARY_ATTEMPTS)
    )
    assert worst_case < hooks.TELEGRAM_PNL_WAIT_SECONDS
