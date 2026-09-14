"""The past-positions poller, now feeding two flows off one income call:
closed trades (unchanged) and fee receipts.

The properties that matter: an ENTRY fill reaches the backend at entry time,
before its close exists; the closes payload is byte-for-byte what it was; a
failed read holds the watermark that would otherwise skip data forever; and
the backend refusing a batch holds it too.
"""

from __future__ import annotations

import json
import time
from unittest.mock import MagicMock, patch

import binance_abcd.fetch_past_positions as fpp
from binance_abcd import fee_receipts as fr

NOW_MS = 1_800_000_000_000
CUTOFF_MS = NOW_MS - 120_000
ACCOUNT = {"api_key": "live-key-1", "secret_key": "s", "name": "One", "uni_id": "uni-live-1", "demo": False}


def _income(income_type, symbol="LTCUSDT", time=NOW_MS - 600_000, income="-0.1", tran_id=1):
    return {"symbol": symbol, "incomeType": income_type, "income": income, "asset": "USDT",
            "info": "", "time": time, "tranId": tran_id, "tradeId": ""}


def _fill(fill_id, order_id, side, qty="14", pnl="0", commission="0.36", time=NOW_MS - 600_000, position_side="LONG"):
    return {"id": fill_id, "orderId": order_id, "symbol": "LTCUSDT", "side": side, "positionSide": position_side,
            "price": "52", "qty": qty, "realizedPnl": pnl, "commission": commission,
            "commissionAsset": "USDT", "time": time}


class FakeApi:
    """`_request_get` keyed by path (+ symbol for userTrades). A value of
    `None` is a failed read; a list is the page. Records every call."""

    def __init__(self, income, trades_by_symbol):
        self.income = income
        self.trades = trades_by_symbol
        self.calls: list[tuple[str, dict]] = []

    def _request_get(self, path, params=None, account_scoped=True):
        self.calls.append((path, dict(params or {})))
        if path == "/fapi/v1/income":
            if callable(self.income):
                return self.income(params)
            return self.income
        if path == "/fapi/v1/userTrades":
            return self.trades.get(params["symbol"])
        raise AssertionError(f"unexpected path {path}")

    def user_trades_calls(self):
        return [p for path, p in self.calls if path == "/fapi/v1/userTrades"]


def _run(income, trades_by_symbol, post=None, accounts=None):
    api = FakeApi(income, trades_by_symbol)
    post = post or MagicMock(return_value={"success": True, "inserted": 1})
    with (
        patch.object(fpp, "fetch_accounts", return_value=accounts or [ACCOUNT]),
        patch.object(fpp, "BinanceAPI", return_value=api),
        patch.object(fpp.engine_client, "post_json", post),
        patch.object(fpp.time, "time", return_value=NOW_MS / 1000),
    ):
        fpp.fetch_and_save()
    return api, post


def _posted(post, path):
    return [c.args[1] for c in post.call_args_list if c.args[0] == path]


def _marks(path):
    return json.loads(path.read_text()) if path.exists() else None


# --- entry fills reach the ledger at entry time ------------------------------------

def test_entry_fill_is_posted_at_entry_time_before_any_close():
    income = [_income("COMMISSION")]                       # an entry happened, nothing closed
    trades = {"LTCUSDT": [_fill(1, 100, "BUY")]}

    api, post = _run(income, trades)

    assert _posted(post, "past-positions/sync") == []      # nothing closed
    fees = _posted(post, "fees")
    assert len(fees) == 1
    rows = fees[0]["rows"]
    assert len(rows) == 1
    assert rows[0]["kind"] == "fill"
    assert rows[0]["order_id"] == 100
    assert rows[0]["realized_pnl"] == 0.0
    assert rows[0]["amount"] == 0.36
    # ...and the fee mark moved to it, while the closes mark stayed at its default.
    assert _marks(fpp.FEES_WATERMARK_FILE) == {"live-key-1": NOW_MS - 600_000}
    assert _marks(fpp.WATERMARK_FILE)["live-key-1"] == NOW_MS - fpp.INCOME_LOOKBACK_HOURS * 3_600_000


def test_a_close_tick_posts_closes_then_fees_with_one_user_trades_call_per_symbol():
    income = [
        _income("COMMISSION", time=NOW_MS - 900_000, tran_id=1),
        _income("FUNDING_FEE", time=NOW_MS - 700_000, income="-0.05", tran_id=2),
        _income("COMMISSION", time=NOW_MS - 500_000, tran_id=3),
        _income("REALIZED_PNL", time=NOW_MS - 500_000, income="25", tran_id=4),
    ]
    trades = {"LTCUSDT": [
        _fill(1, 100, "BUY", time=NOW_MS - 900_000),
        _fill(2, 200, "SELL", pnl="25", commission="0.37", time=NOW_MS - 500_000),
    ]}

    api, post = _run(income, trades)

    assert [c.args[0] for c in post.call_args_list] == ["past-positions/sync", "fees"]
    assert len(api.user_trades_calls()) == 1

    closes = _posted(post, "past-positions/sync")[0]["rows"]
    assert [c["order_id"] for c in closes] == [200]

    receipts = _posted(post, "fees")[0]["rows"]
    assert [(r["kind"], r["ref"]) for r in receipts] == [("funding", 2), ("fill", 1), ("fill", 2)]
    assert receipts[0]["amount"] == 0.05                    # paid → positive cost
    assert receipts[2]["realized_pnl"] == 25.0


def test_past_positions_payload_is_unchanged_for_a_close():
    """The closes row is what the API's ingest validates; a new key would be
    stripped, a missing one would 422 — so the shape is pinned here."""
    income = [_income("REALIZED_PNL", time=NOW_MS - 500_000, income="25")]
    trades = {"LTCUSDT": [
        _fill(2, 200, "SELL", qty="6", pnl="10", time=NOW_MS - 500_500),
        _fill(3, 200, "SELL", qty="8", pnl="15", time=NOW_MS - 500_000),
    ]}

    _, post = _run(income, trades)

    row = _posted(post, "past-positions/sync")[0]["rows"][0]
    assert row == {
        "api_key": "live-key-1",
        "uni_id": "uni-live-1",
        "symbol": "LTCUSDT",
        "position_side": "LONG",
        "position_amt": 14.0,
        "entry_price": None,
        "exit_price": 52.0,
        "realized_pnl": 25.0,
        "side": "SELL",
        "order_id": 200,
        "closed_at": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime((NOW_MS - 500_000) / 1000)),
        "strategy": None,
    }


# --- failures hold the right watermark ----------------------------------------------

def test_income_read_failure_skips_the_account_and_holds_both_marks():
    api, post = _run(None, {"LTCUSDT": [_fill(1, 100, "BUY")]})

    post.assert_not_called()
    assert api.user_trades_calls() == []
    assert _marks(fpp.WATERMARK_FILE) == {}
    assert _marks(fpp.FEES_WATERMARK_FILE) == {}


def test_user_trades_failure_holds_the_fee_mark_but_leaves_closes_as_before():
    income = [_income("COMMISSION"), _income("REALIZED_PNL", tran_id=2)]

    api, post = _run(income, {"LTCUSDT": None})

    post.assert_not_called()                                 # nothing to send either way
    # Closes mark is saved as it always was (nothing seen → stays at the default);
    # the fee mark is NOT written for this account, so next tick re-reads.
    assert "live-key-1" in _marks(fpp.WATERMARK_FILE)
    assert _marks(fpp.FEES_WATERMARK_FILE) == {}


def test_backend_rejecting_the_fees_post_holds_the_fee_mark():
    income = [_income("COMMISSION")]
    trades = {"LTCUSDT": [_fill(1, 100, "BUY")]}
    post = MagicMock(side_effect=lambda path, payload: None if path == "fees" else {"success": True})

    _run(income, trades, post=post)

    assert _posted(post, "fees")                             # it was attempted
    assert _marks(fpp.FEES_WATERMARK_FILE) is None           # and not stamped


def test_receipts_younger_than_the_indexing_lag_are_deferred_and_the_mark_stays_below_them():
    income = [_income("COMMISSION", time=CUTOFF_MS + 1)]
    trades = {"LTCUSDT": [_fill(1, 100, "BUY", time=CUTOFF_MS + 1)]}

    _, post = _run(income, trades)

    assert _posted(post, "fees") == []
    # No receipts accepted → the mark holds at the seed, not "now".
    assert _marks(fpp.FEES_WATERMARK_FILE)["live-key-1"] == NOW_MS - fpp.FEES_LOOKBACK_HOURS * 3_600_000


# --- first run and paging -----------------------------------------------------------

def test_first_run_seeds_from_fees_lookback_and_clamps_user_trades_to_seven_days():
    income = [_income("COMMISSION")]
    trades = {"LTCUSDT": [_fill(1, 100, "BUY")]}

    api, _ = _run(income, trades)

    income_calls = [p for path, p in api.calls if path == "/fapi/v1/income"]
    assert income_calls[0]["startTime"] == NOW_MS - fpp.FEES_LOOKBACK_HOURS * 3_600_000
    assert "incomeType" not in income_calls[0]              # unfiltered: one call serves both flows
    assert api.user_trades_calls()[0]["startTime"] == NOW_MS - fr.USER_TRADES_MAX_AGE_MS


def test_income_paging_follows_the_newest_time_when_a_page_is_full():
    first_page = [_income("COMMISSION", time=NOW_MS - 5_000_000 + i, tran_id=i) for i in range(1000)]
    second_page = [_income("COMMISSION", time=NOW_MS - 600_000, tran_id=5000)]
    pages = iter([first_page, second_page])

    api, _ = _run(lambda params: next(pages), {"LTCUSDT": [_fill(1, 100, "BUY")]})

    income_calls = [p for path, p in api.calls if path == "/fapi/v1/income"]
    assert len(income_calls) == 2
    assert income_calls[1]["startTime"] == (NOW_MS - 5_000_000 + 999) + 1


def test_a_failed_later_income_page_still_uses_what_arrived_but_holds_the_fee_mark():
    first_page = [_income("COMMISSION", time=NOW_MS - 5_000_000 + i, tran_id=i) for i in range(1000)]
    pages = iter([first_page, None])

    api, post = _run(lambda params: next(pages), {"LTCUSDT": [_fill(1, 100, "BUY", time=NOW_MS - 4_000_000)]})

    assert _posted(post, "fees")                             # receipts from page one were shipped
    assert _marks(fpp.FEES_WATERMARK_FILE) == {}             # but the mark did not move


def test_one_account_failing_does_not_block_the_others():
    good = ACCOUNT
    bad = dict(ACCOUNT, api_key="live-key-3", uni_id="uni-live-3")
    apis = {
        "live-key-1": FakeApi([_income("COMMISSION")], {"LTCUSDT": [_fill(1, 100, "BUY")]}),
        "live-key-3": FakeApi(None, {}),
    }
    post = MagicMock(return_value={"success": True})
    with (
        patch.object(fpp, "fetch_accounts", return_value=[bad, good]),
        patch.object(fpp, "BinanceAPI", side_effect=lambda key, *a, **kw: apis[key]),
        patch.object(fpp.engine_client, "post_json", post),
        patch.object(fpp.time, "time", return_value=NOW_MS / 1000),
    ):
        fpp.fetch_and_save()

    rows = _posted(post, "fees")[0]["rows"]
    assert {r["api_key"] for r in rows} == {"live-key-1"}
    assert set(_marks(fpp.FEES_WATERMARK_FILE)) == {"live-key-1"}
