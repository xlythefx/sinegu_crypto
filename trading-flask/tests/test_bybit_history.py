"""fetch_bybit_history — closed-pnl rows into past positions, executions into
fee receipts, and the watermark discipline that keeps a failed read from
looking like an empty one."""

from __future__ import annotations

import json
import time
from unittest.mock import patch

import pytest

import binance_abcd.fetch_bybit_history as fbh
from binance_abcd.fee_receipts import FEE_OVERLAP_MS
from binance_abcd.hooks import PAST_POSITIONS_INDEXING_LAG_SECONDS

NOW_MS = 1_700_000_000_000
LAG_MS = int(PAST_POSITIONS_INDEXING_LAG_SECONDS * 1000)
T_OLD = NOW_MS - 10 * 3_600_000      # comfortably inside the lookback
T_CLOSE = NOW_MS - 3_600_000         # past the indexing lag
T_FRESH = NOW_MS - LAG_MS // 2       # INSIDE the lag: deferred, not lost

ACCOUNT = {"api_key": "bybitkey", "uni_id": "uni-1", "name": "Bybit One", "exchange": "bybit"}

# A long closed by a Sell, and a short closed by a Buy.
CLOSE_LONG = {
    "symbol": "BTCUSDT", "orderId": "9001", "side": "Sell", "updatedTime": str(T_CLOSE),
    "closedSize": "0.003", "cumEntryValue": "180", "cumExitValue": "190",
    "closedPnl": "9.0", "openFee": "0.55", "closeFee": "0.45",
    "avgEntryPrice": "60000", "avgExitPrice": "63333.33",
}
CLOSE_SHORT = {
    "symbol": "ETHUSDT", "orderId": "9002", "side": "Buy", "updatedTime": str(T_CLOSE),
    "closedSize": "0.5", "cumEntryValue": "1500", "cumExitValue": "1450",
    "closedPnl": "49.0", "openFee": "0.5", "closeFee": "0.5",
}
CLOSE_FRESH = dict(CLOSE_LONG, orderId="9003", updatedTime=str(T_FRESH))

FILL_ENTRY = {
    "execId": "8c48b6ba-a6a5-5ba9-a3f3-0f9e4f0e8f1a", "symbol": "BTCUSDT",
    "orderId": "8001", "side": "Buy", "execType": "Trade", "execTime": str(T_OLD),
    "execQty": "0.003", "execPrice": "60000", "execFee": "0.099",
    "feeCurrency": "USDT", "closedSize": "0",
}
FILL_EXIT = {
    "execId": "1d2e3f4a-5b6c-7d8e-9f0a-1b2c3d4e5f6a", "symbol": "BTCUSDT",
    "orderId": "9001", "side": "Sell", "execType": "Trade", "execTime": str(T_CLOSE),
    "execQty": "0.003", "execPrice": "63333.33", "execFee": "0.104",
    "feeCurrency": "USDT", "closedSize": "0.003", "closedPnl": "9.0",
}
FUNDING_PAID = {
    "execId": "f0000000-0000-0000-0000-000000000001", "symbol": "BTCUSDT",
    "execType": "Funding", "execTime": str(T_OLD + 60_000),
    "execFee": "0.15", "feeCurrency": "USDT",
}
FUNDING_CREDIT = dict(FUNDING_PAID, execId="f0000000-0000-0000-0000-000000000002", execFee="-0.05")
FILL_FRESH = dict(FILL_EXIT, execId="fresh-0000-0000-0000-000000000003", execTime=str(T_FRESH))


class FakeBybit:
    def __init__(self, *, closes=(CLOSE_LONG, CLOSE_SHORT, CLOSE_FRESH),
                 executions=(FILL_ENTRY, FILL_EXIT, FUNDING_PAID, FILL_FRESH),
                 closes_complete=True, execs_complete=True):
        self._closes = None if closes is None else list(closes)
        self._executions = None if executions is None else list(executions)
        self._closes_complete = closes_complete
        self._execs_complete = execs_complete
        self.closed_pnl_calls = []
        self.execution_calls = []

    def closed_pnl(self, *, symbol=None, start_ms=None, end_ms=None, max_pages=5):
        self.closed_pnl_calls.append({"start": start_ms, "end": end_ms})
        if self._closes is None:
            return None, False
        return list(self._closes), self._closes_complete

    def executions(self, *, symbol=None, order_id=None, start_ms=None, end_ms=None, max_pages=10):
        self.execution_calls.append({"start": start_ms, "end": end_ms})
        if self._executions is None:
            return None, False
        return list(self._executions), self._execs_complete


def _run(api, *, close_marks=None, fee_marks=None):
    posts = []

    def post_json(path, payload, *, exchange=None):
        posts.append((path, exchange, payload))
        return {"success": True, "inserted": len(payload["rows"])}

    if close_marks is not None:
        fbh.WATERMARK_FILE.write_text(json.dumps(close_marks))
    if fee_marks is not None:
        fbh.FEES_WATERMARK_FILE.write_text(json.dumps(fee_marks))

    class _Client:
        def __init__(self, a):
            self.api = api

    with (
        patch.object(fbh, "fetch_accounts", return_value=[ACCOUNT]),
        patch.object(fbh, "client_for", _Client),
        patch.object(fbh.time, "time", return_value=NOW_MS / 1000),
        patch.object(fbh.engine_client, "post_json", side_effect=post_json),
    ):
        fbh.fetch_and_save()
    return posts


def _rows(posts, path):
    return [p["rows"] for name, _ex, p in posts if name == path]


def _marks(path):
    return json.loads(path.read_text()) if path.exists() else {}


# --- Closes -------------------------------------------------------------------

def test_closed_pnl_rows_become_past_position_rows():
    posts = _run(FakeBybit())
    closes = _rows(posts, "past-positions/sync")
    assert len(closes) == 1
    assert [ex for name, ex, _ in posts if name == "past-positions/sync"] == ["bybit"]
    rows = {r["order_id"]: r for r in closes[0]}
    # 9003 is inside the indexing lag and is deferred, not dropped.
    assert set(rows) == {9001, 9002}

    long_close = rows[9001]
    assert long_close["symbol"] == "BTCUSDT"
    assert long_close["position_side"] == "LONG" and long_close["side"] == "SELL"
    assert long_close["position_amt"] == pytest.approx(0.003)
    # Gross by definition: cumExitValue - cumEntryValue, no switch involved.
    assert long_close["realized_pnl"] == pytest.approx(10.0)
    # Bybit carries the entry price on the closed row; Binance and MEXC do not.
    assert long_close["entry_price"] == pytest.approx(60000.0)
    assert long_close["exit_price"] == pytest.approx(190 / 0.003)
    assert long_close["closed_at"] == time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(T_CLOSE / 1000))
    assert "closed_ms" not in long_close


def test_a_short_close_maps_to_side_buy_and_position_short():
    posts = _run(FakeBybit())
    rows = {r["order_id"]: r for r in _rows(posts, "past-positions/sync")[0]}
    short_close = rows[9002]
    assert short_close["position_side"] == "SHORT" and short_close["side"] == "BUY"
    # A short profits when the exit value is LOWER than the entry value.
    assert short_close["realized_pnl"] == pytest.approx(50.0)


def test_two_closed_pnl_rows_for_one_order_are_summed_into_one_row():
    """past-positions/sync is idempotent on (api_key, symbol, order_id), so two
    rows sharing an orderId would collapse onto each other in the DB and
    silently lose half the trade."""
    half_a = dict(CLOSE_LONG, closedSize="0.001", cumEntryValue="60",
                  cumExitValue="63", closedPnl="3.0")
    half_b = dict(CLOSE_LONG, closedSize="0.002", cumEntryValue="120",
                  cumExitValue="127", closedPnl="7.0")
    posts = _run(FakeBybit(closes=(half_a, half_b)))
    rows = _rows(posts, "past-positions/sync")[0]
    assert len(rows) == 1
    assert rows[0]["position_amt"] == pytest.approx(0.003)
    assert rows[0]["realized_pnl"] == pytest.approx((63 + 127) - (60 + 120))


def test_the_close_watermark_advances_only_over_closes_seen():
    _run(FakeBybit())
    assert _marks(fbh.WATERMARK_FILE) == {"bybitkey": T_CLOSE}


def test_a_close_already_synced_is_not_sent_again():
    posts = _run(FakeBybit(), close_marks={"bybitkey": T_CLOSE})
    assert _rows(posts, "past-positions/sync") == []


# --- Receipts -----------------------------------------------------------------

def test_every_execution_becomes_a_fill_receipt_entries_included_plus_funding():
    posts = _run(FakeBybit())
    receipts = _rows(posts, "fees")[0]
    by_ref = {(r["kind"], r["ref"]): r for r in receipts}
    assert (("fill", FILL_ENTRY["execId"])) in by_ref     # the ENTRY fill ships too
    assert (("fill", FILL_EXIT["execId"])) in by_ref
    assert (("funding", FUNDING_PAID["execId"])) in by_ref
    assert ("fill", FILL_FRESH["execId"]) not in by_ref   # inside the lag

    entry = by_ref[("fill", FILL_ENTRY["execId"])]
    assert entry["side"] == "BUY" and entry["position_side"] == "LONG"
    assert entry["amount"] == pytest.approx(0.099)
    assert entry["asset"] == "USDT"
    assert entry["order_id"] == 8001


def test_the_ref_is_bybits_uuid_exec_id_verbatim():
    """A ref nobody can paste back into Bybit's UI defeats the one question the
    receipts table exists to answer."""
    posts = _run(FakeBybit())
    refs = {r["ref"] for r in _rows(posts, "fees")[0]}
    assert FILL_ENTRY["execId"] in refs
    assert all(isinstance(r, str) for r in refs)


def test_position_side_comes_from_closed_size():
    """Exact in BOTH position modes, and it replaces MEXC's four-code side map."""
    posts = _run(FakeBybit())
    by_ref = {r["ref"]: r for r in _rows(posts, "fees")[0]}
    # closedSize 0 + Buy -> opened a LONG
    assert by_ref[FILL_ENTRY["execId"]]["position_side"] == "LONG"
    # closedSize > 0 + Sell -> closed a LONG
    assert by_ref[FILL_EXIT["execId"]]["position_side"] == "LONG"

    short_close = dict(FILL_EXIT, execId="short-close", side="Buy", closedSize="0.5")
    short_open = dict(FILL_ENTRY, execId="short-open", side="Sell", closedSize="0")
    # Clear the fee mark the first run left, or its floor filters the older
    # entry fill out — which is the watermark working, not a bug.
    posts = _run(FakeBybit(executions=(short_open, short_close)), fee_marks={})
    by_ref = {r["ref"]: r for r in _rows(posts, "fees")[0]}
    assert by_ref["short-close"]["position_side"] == "SHORT"
    assert by_ref["short-open"]["position_side"] == "SHORT"


def test_funding_receipts_are_not_sign_flipped():
    """THE Bybit divergence, and it must not be 'tidied' to match the others.

    Binance income and MEXC funding_records report what the account RECEIVED
    (negative = paid), so both are negated to make a cost positive. Bybit
    reports funding as an execution FEE — already what the account paid, the
    ledger's own basis. Flipping it would invert every funding charge on the
    venue, and abs() is not an option either: a funding CREDIT must stay
    negative.
    """
    posts = _run(FakeBybit(executions=(FUNDING_PAID, FUNDING_CREDIT)))
    by_ref = {r["ref"]: r for r in _rows(posts, "fees")[0]}
    assert by_ref[FUNDING_PAID["execId"]]["amount"] == pytest.approx(0.15)   # money out
    assert by_ref[FUNDING_CREDIT["execId"]]["amount"] == pytest.approx(-0.05)  # a credit
    funding = by_ref[FUNDING_PAID["execId"]]
    assert funding["order_id"] is None and funding["qty"] is None


# --- Empty vs unavailable ------------------------------------------------------

def test_a_failed_closed_pnl_read_skips_the_account_and_holds_both_marks():
    posts = _run(FakeBybit(closes=None), close_marks={"bybitkey": T_OLD}, fee_marks={"bybitkey": T_OLD})
    assert _rows(posts, "past-positions/sync") == []
    assert _rows(posts, "fees") == []
    assert _marks(fbh.WATERMARK_FILE) == {"bybitkey": T_OLD}
    assert _marks(fbh.FEES_WATERMARK_FILE) == {"bybitkey": T_OLD}


def test_a_failed_execution_read_holds_the_fee_mark_but_closes_still_post():
    posts = _run(FakeBybit(executions=None), fee_marks={"bybitkey": T_OLD})
    assert len(_rows(posts, "past-positions/sync")) == 1
    assert _rows(posts, "fees") == []
    assert _marks(fbh.FEES_WATERMARK_FILE) == {"bybitkey": T_OLD}


def test_an_incomplete_execution_page_holds_the_fee_mark():
    """A receipt skipped once is skipped forever, so the mark only advances when
    the whole window was read."""
    posts = _run(FakeBybit(execs_complete=False), fee_marks={"bybitkey": T_OLD})
    assert len(_rows(posts, "fees")) == 1          # what we have is still sent
    assert _marks(fbh.FEES_WATERMARK_FILE) == {"bybitkey": T_OLD}


def test_a_rejected_fees_post_holds_the_fee_mark():
    api = FakeBybit()
    calls = []

    def post_json(path, payload, *, exchange=None):
        calls.append(path)
        return None if path == "fees" else {"success": True}

    fbh.FEES_WATERMARK_FILE.write_text(json.dumps({"bybitkey": T_OLD}))

    class _Client:
        def __init__(self, a):
            self.api = api

    with (
        patch.object(fbh, "fetch_accounts", return_value=[ACCOUNT]),
        patch.object(fbh, "client_for", _Client),
        patch.object(fbh.time, "time", return_value=NOW_MS / 1000),
        patch.object(fbh.engine_client, "post_json", side_effect=post_json),
    ):
        fbh.fetch_and_save()

    assert "fees" in calls
    assert _marks(fbh.FEES_WATERMARK_FILE) == {"bybitkey": T_OLD}


def test_the_window_is_clamped_to_bybits_seven_day_ceiling():
    """Both endpoints cap a query at 7 days. A stale mark asking for 30 would be
    REFUSED, which looks like 'no history' and advances nothing forever."""
    api = FakeBybit()
    stale = NOW_MS - 30 * 86_400_000
    _run(api, close_marks={"bybitkey": stale}, fee_marks={"bybitkey": stale})
    assert api.closed_pnl_calls[0]["start"] >= NOW_MS - 7 * 86_400_000
    assert api.execution_calls[0]["start"] >= NOW_MS - 7 * 86_400_000


def test_the_fee_window_overlaps_the_mark():
    api = FakeBybit()
    _run(api, fee_marks={"bybitkey": T_CLOSE})
    assert api.execution_calls[0]["start"] == T_CLOSE - FEE_OVERLAP_MS


def test_the_bybit_poller_uses_its_own_watermark_files():
    assert fbh.WATERMARK_FILE.name == "last_bybit_closes_sync.json"
    assert fbh.FEES_WATERMARK_FILE.name == "last_bybit_fees_sync.json"


def test_no_accounts_is_not_an_error():
    with patch.object(fbh, "fetch_accounts", return_value=[]):
        assert fbh.fetch_and_save() is None
