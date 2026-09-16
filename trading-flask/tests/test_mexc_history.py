"""fetch_mexc_history — closes from filled closing orders, receipts from every
deal and funding record, and the same empty-vs-unavailable watermark rules the
Binance poller follows."""

from __future__ import annotations

import json
import time
from unittest.mock import patch

import pytest

import binance_abcd.fetch_mexc_history as fmh
import binance_abcd.hooks as hooks
from binance_abcd.fee_receipts import FEE_OVERLAP_MS

NOW_MS = 1_800_000_000_000
LAG_MS = int(hooks.PAST_POSITIONS_INDEXING_LAG_SECONDS * 1000)
CONTRACTS = {"BTC_USDT": {"contractSize": 0.0001}, "LTC_USDT": {"contractSize": 0.1}}

ACCOUNT = {"api_key": "mx0k", "secret_key": "s", "name": "MEXC One", "uni_id": "u1", "exchange": "mexc", "demo": False}

T_ENTRY = NOW_MS - 3_600_000       # an hour ago
T_CLOSE = NOW_MS - 1_800_000       # 30 min ago
T_FRESH = NOW_MS - 30_000          # 30 s ago — inside the indexing lag

ORDERS = [
    {"orderId": "100", "symbol": "LTC_USDT", "side": 1, "state": 3, "vol": 140, "dealVol": 140, "dealAvgPrice": 100.0, "updateTime": T_ENTRY},
    {"orderId": "101", "symbol": "LTC_USDT", "side": 4, "state": 3, "vol": 140, "dealVol": 140, "dealAvgPrice": 105.0, "profit": 70.0, "updateTime": T_CLOSE},
    {"orderId": "102", "symbol": "BTC_USDT", "side": 3, "state": 3, "vol": 2, "dealVol": 2, "dealAvgPrice": 60000, "updateTime": T_ENTRY},
    {"orderId": "103", "symbol": "BTC_USDT", "side": 2, "state": 3, "vol": 2, "dealVol": 2, "dealAvgPrice": 59000, "profit": 0.2, "updateTime": T_FRESH},
]
LTC_DEALS = [
    {"id": 1, "orderId": "100", "side": 1, "vol": 140, "price": 100.0, "fee": 0.28, "feeCurrency": "USDT", "profit": 0, "timestamp": T_ENTRY},
    {"id": 2, "orderId": "101", "side": 4, "vol": 100, "price": 104.0, "fee": 0.208, "feeCurrency": "USDT", "profit": 40.0, "timestamp": T_CLOSE - 1000},
    {"id": 3, "orderId": "101", "side": 4, "vol": 40, "price": 107.5, "fee": 0.086, "feeCurrency": "USDT", "profit": 30.0, "timestamp": T_CLOSE},
]
BTC_DEALS = [
    {"id": 7, "orderId": "102", "side": 3, "vol": 2, "price": 60000, "fee": 0.0024, "feeCurrency": "USDT", "profit": 0, "timestamp": T_ENTRY},
    {"id": 8, "orderId": "103", "side": 2, "vol": 2, "price": 59000, "fee": 0.00236, "feeCurrency": "USDT", "profit": 0.2, "timestamp": T_FRESH},
]
FUNDING = {
    1: [{"id": 900, "symbol": "LTC_USDT", "positionType": 1, "funding": -0.15, "settleTime": T_CLOSE - 60_000}],
    2: [{"id": 901, "symbol": "BTC_USDT", "positionType": 2, "funding": 0.05, "settleTime": T_CLOSE - 60_000}],
}


class FakeMexc:
    api_key = "mx0k"
    base_url = "https://mexc.test"

    def __init__(self, *, orders=ORDERS, deals=None, funding=FUNDING, contracts=CONTRACTS, fail_deals_for=()):
        self._orders = orders
        self._deals = deals if deals is not None else {"LTC_USDT": LTC_DEALS, "BTC_USDT": BTC_DEALS}
        self._funding = funding
        self._contracts = contracts
        self._fail_deals_for = set(fail_deals_for)
        self.calls = []

    def contracts(self):
        return self._contracts

    def history_orders(self, *, states="3", start_ms, end_ms, page_num=1, page_size=100):
        self.calls.append(("history_orders", start_ms, end_ms, page_num))
        if self._orders is None:
            return None
        return list(self._orders) if page_num == 1 else []

    def order_deals(self, symbol, *, start_ms, end_ms, page_num=1, page_size=1000):
        self.calls.append(("order_deals", symbol, page_num))
        if symbol in self._fail_deals_for:
            return None
        return list(self._deals.get(symbol, [])) if page_num == 1 else []

    def funding_records(self, position_type, *, start_ms, end_ms, page_num=1, page_size=100):
        self.calls.append(("funding_records", position_type, page_num))
        if self._funding is None:
            return None
        return list(self._funding.get(position_type, [])) if page_num == 1 else []


def _run(api, *, close_marks=None, fee_marks=None):
    posts = []

    def post_json(path, payload, *, exchange=None):
        posts.append((path, exchange, payload))
        return {"success": True, "inserted": len(payload["rows"])}

    if close_marks is not None:
        fmh.WATERMARK_FILE.write_text(json.dumps(close_marks))
    if fee_marks is not None:
        fmh.FEES_WATERMARK_FILE.write_text(json.dumps(fee_marks))

    class _Client:
        def __init__(self, a):
            self.api = api

    with (
        patch.object(fmh, "fetch_accounts", return_value=[ACCOUNT]),
        patch.object(fmh, "client_for", _Client),
        patch.object(fmh.time, "time", return_value=NOW_MS / 1000),
        patch.object(fmh.engine_client, "post_json", side_effect=post_json),
    ):
        fmh.fetch_and_save()
    return posts


def _marks(path):
    return json.loads(path.read_text()) if path.exists() else {}


# --- Closes ----------------------------------------------------------------------

def test_filled_closing_orders_become_past_position_rows_in_coins():
    posts = _run(FakeMexc())
    closes = [p for path, ex, p in posts if path == "past-positions/sync"]
    assert len(closes) == 1 and [ex for path, ex, _ in posts if path == "past-positions/sync"] == ["mexc"]
    rows = closes[0]["rows"]
    assert len(rows) == 1  # order 101; 103 is inside the indexing lag, 100/102 are entries
    row = rows[0]
    assert row["symbol"] == "LTCUSDT" and row["order_id"] == 101
    assert row["position_side"] == "LONG" and row["side"] == "SELL"
    assert row["position_amt"] == pytest.approx(14.0)            # 140 contracts × 0.1
    assert row["exit_price"] == pytest.approx(105.0)             # (100×104 + 40×107.5) / 140
    assert row["realized_pnl"] == pytest.approx(70.0)            # Σ profit over the deals
    assert row["entry_price"] is None and row["strategy"] is None
    assert row["api_key"] == "mx0k" and row["uni_id"] == "u1"
    assert row["closed_at"] == time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(T_CLOSE / 1000))  # UTC, from updateTime
    assert "closed_ms" not in row


def test_close_without_indexed_deals_falls_back_to_the_orders_own_figures():
    api = FakeMexc(deals={"LTC_USDT": [], "BTC_USDT": []})
    rows = [p for path, _, p in _run(api) if path == "past-positions/sync"][0]["rows"]
    assert rows[0]["exit_price"] == 105.0 and rows[0]["realized_pnl"] == 70.0


def test_close_watermark_advances_only_over_closes_seen_and_holds_the_fresh_one():
    _run(FakeMexc())
    marks = _marks(fmh.WATERMARK_FILE)
    assert marks["mx0k"] == T_CLOSE           # not T_FRESH: order 103 is deferred to a later tick


def test_a_close_already_synced_is_not_sent_again():
    posts = _run(FakeMexc(), close_marks={"mx0k": T_CLOSE})
    assert not [p for path, _, p in posts if path == "past-positions/sync"]


def test_side_mapping_table():
    assert fmh.side_of(1) == ("BUY", "LONG")
    assert fmh.side_of(2) == ("BUY", "SHORT")
    assert fmh.side_of(3) == ("SELL", "SHORT")
    assert fmh.side_of("4") == ("SELL", "LONG")
    assert fmh.side_of(9) == (None, None)


def test_short_close_maps_to_side_buy_and_position_short():
    orders = [{"orderId": "103", "symbol": "BTC_USDT", "side": 2, "state": 3, "dealVol": 2, "dealAvgPrice": 59000, "profit": 0.2, "updateTime": T_CLOSE}]
    rows = fmh.history_closes(orders, {}, CONTRACTS, T_CLOSE - 1, NOW_MS)
    assert rows[0]["position_side"] == "SHORT" and rows[0]["side"] == "BUY"
    assert rows[0]["position_amt"] == pytest.approx(0.0002)


# --- Receipts --------------------------------------------------------------------------

def test_every_deal_becomes_a_fill_receipt_entries_included_plus_funding():
    posts = _run(FakeMexc())
    fees = [p for path, ex, p in posts if path == "fees"]
    assert len(fees) == 1 and [ex for path, ex, _ in posts if path == "fees"] == ["mexc"]
    rows = {(r["kind"], r["ref"]): r for r in fees[0]["rows"]}
    # Deals 1,2,3 (LTC) and 7 (BTC entry); deal 8 is inside the indexing lag.
    assert {k for k in rows if k[0] == "fill"} == {("fill", 1), ("fill", 2), ("fill", 3), ("fill", 7)}
    entry = rows[("fill", 1)]
    assert entry["symbol"] == "LTCUSDT" and entry["order_id"] == 100
    assert (entry["side"], entry["position_side"]) == ("BUY", "LONG")
    assert entry["qty"] == pytest.approx(14.0) and entry["price"] == 100.0
    assert entry["amount"] == 0.28 and entry["asset"] == "USDT" and entry["charged_at"] == T_ENTRY
    assert rows[("fill", 7)]["position_side"] == "SHORT" and rows[("fill", 7)]["side"] == "SELL"
    # Funding: sign flipped, both position types read.
    assert rows[("funding", 900)]["amount"] == pytest.approx(0.15) and rows[("funding", 900)]["symbol"] == "LTCUSDT"
    assert rows[("funding", 901)]["amount"] == pytest.approx(-0.05)
    assert rows[("funding", 901)]["order_id"] is None and rows[("funding", 901)]["asset"] == "USDT"
    assert all(r["api_key"] == "mx0k" and r["uni_id"] == "u1" for r in fees[0]["rows"])


def test_fee_watermark_is_the_newest_accepted_charge_and_the_window_overlaps_it():
    api = FakeMexc()
    _run(api, fee_marks={"mx0k": T_ENTRY - 1})
    assert _marks(fmh.FEES_WATERMARK_FILE)["mx0k"] == T_CLOSE   # deal 3; deal 8 deferred
    starts = [c[1] for c in api.calls if c[0] == "history_orders"]
    assert starts[0] <= T_ENTRY - 1 - FEE_OVERLAP_MS


# --- Empty vs unavailable -----------------------------------------------------------------

def test_a_failed_order_history_read_skips_the_account_and_holds_both_marks():
    posts = _run(FakeMexc(orders=None), close_marks={"mx0k": 5}, fee_marks={"mx0k": 6})
    assert posts == []
    assert _marks(fmh.WATERMARK_FILE) == {"mx0k": 5}
    assert _marks(fmh.FEES_WATERMARK_FILE) == {"mx0k": 6}


def test_a_failed_deals_page_holds_the_fee_mark_but_closes_still_post():
    posts = _run(FakeMexc(fail_deals_for={"BTC_USDT"}), fee_marks={"mx0k": 6})
    assert [path for path, _, _ in posts] == ["past-positions/sync", "fees"]   # LTC receipts still ship
    assert _marks(fmh.FEES_WATERMARK_FILE) == {"mx0k": 6}
    assert _marks(fmh.WATERMARK_FILE)["mx0k"] == T_CLOSE


def test_a_failed_funding_read_holds_the_fee_mark():
    _run(FakeMexc(funding=None), fee_marks={"mx0k": 6})
    assert _marks(fmh.FEES_WATERMARK_FILE) == {"mx0k": 6}


def test_a_rejected_fees_post_holds_the_fee_mark():
    def post_json(path, payload, *, exchange=None):
        return None if path == "fees" else {"success": True}

    class _Client:
        def __init__(self, a):
            self.api = FakeMexc()

    fmh.FEES_WATERMARK_FILE.write_text(json.dumps({"mx0k": 6}))
    with (
        patch.object(fmh, "fetch_accounts", return_value=[ACCOUNT]),
        patch.object(fmh, "client_for", _Client),
        patch.object(fmh.time, "time", return_value=NOW_MS / 1000),
        patch.object(fmh.engine_client, "post_json", side_effect=post_json),
    ):
        fmh.fetch_and_save()
    assert _marks(fmh.FEES_WATERMARK_FILE) == {"mx0k": 6}
    assert _marks(fmh.WATERMARK_FILE)["mx0k"] == T_CLOSE


def test_unknown_contract_sizes_skip_the_account_this_tick():
    class _NoContracts(FakeMexc):
        def contracts(self):
            return None

    posts = _run(_NoContracts(), close_marks={"mx0k": 5})
    assert posts == [] and _marks(fmh.WATERMARK_FILE) == {"mx0k": 5}


def test_demo_mexc_accounts_are_not_polled():
    with (
        patch.object(fmh, "fetch_accounts", return_value=[ACCOUNT | {"demo": True}]),
        patch.object(fmh, "client_for") as client_for,
        patch.object(fmh.engine_client, "post_json") as post,
    ):
        fmh.fetch_and_save()
    client_for.assert_not_called()
    post.assert_not_called()


def test_the_mexc_poller_uses_its_own_watermark_files():
    assert fmh.WATERMARK_FILE.name == "last_mexc_closes_sync.json"
    assert fmh.FEES_WATERMARK_FILE.name == "last_mexc_fees_sync.json"
    import binance_abcd.fetch_past_positions as fpp
    assert fpp.WATERMARK_FILE != fmh.WATERMARK_FILE and fpp.FEES_WATERMARK_FILE != fmh.FEES_WATERMARK_FILE
