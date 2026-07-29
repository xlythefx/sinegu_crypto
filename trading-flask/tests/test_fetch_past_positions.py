"""Unit tests for the userTrades-driven past-position syncer."""

from src.fetch_past_positions import (
    _build_row,
    _income_symbols,
    _fetch_symbol_trades,
    _reconstruct_close,
    _reconstruct_closes,
)


def test_income_symbols_distinct_upper():
    events = [
        {"symbol": "btcusdt", "income": "1", "time": 1},
        {"symbol": "BTCUSDT", "income": "1", "time": 2},
        {"symbol": "ethusdt", "income": "-1", "time": 3},
        {"symbol": "", "income": "1", "time": 4},
    ]
    assert _income_symbols(events) == ["BTCUSDT", "ETHUSDT"]


def test_reconstruct_close_sums_pnl_and_weighted_exit():
    fills = [
        {"orderId": 111, "side": "SELL", "positionSide": "LONG", "price": "100", "qty": "1", "realizedPnl": "1.5", "time": 1700000000000},
        {"orderId": 111, "side": "SELL", "positionSide": "LONG", "price": "110", "qty": "3", "realizedPnl": "0.5", "time": 1700000001000},
    ]
    c = _reconstruct_close("111", fills)
    assert c is not None
    assert c["order_id"] == "111"
    assert round(c["realized_pnl"], 4) == 2.0
    # weighted = (100*1 + 110*3)/4 = 107.5
    assert c["exit_price"] == 107.5
    assert c["position_amt"] == 4.0
    assert c["side"] == "SELL"
    assert c["position_side"] == "LONG"
    assert c["closed_at_ms"] == 1700000001000


def test_reconstruct_close_skips_opening_only_order():
    # Opening fills carry realizedPnl == 0 → not a close.
    fills = [
        {"orderId": 222, "side": "BUY", "positionSide": "LONG", "price": "50", "qty": "2", "realizedPnl": "0", "time": 1700000000000},
    ]
    assert _reconstruct_close("222", fills) is None


def test_reconstruct_close_infers_one_way_side():
    # one-way mode: positionSide BOTH, BUY closes a SHORT.
    fills = [
        {"orderId": 333, "side": "BUY", "positionSide": "BOTH", "price": "50", "qty": "2", "realizedPnl": "-1.0", "time": 1700000000000},
    ]
    c = _reconstruct_close("333", fills)
    assert c is not None
    assert c["position_side"] == "SHORT"
    assert c["side"] == "BUY"


def test_reconstruct_closes_groups_by_order_and_defers_recent():
    cutoff = 1700000005000
    fills = [
        # order 111 closed before cutoff → emitted
        {"orderId": 111, "side": "SELL", "positionSide": "LONG", "price": "100", "qty": "1", "realizedPnl": "1.0", "time": 1700000000000},
        # order 999 closed after cutoff → deferred
        {"orderId": 999, "side": "SELL", "positionSide": "LONG", "price": "100", "qty": "1", "realizedPnl": "2.0", "time": 1700000009000},
        # order 555 opening-only → skipped
        {"orderId": 555, "side": "BUY", "positionSide": "LONG", "price": "100", "qty": "1", "realizedPnl": "0", "time": 1700000000000},
    ]
    rows = _reconstruct_closes("BTCUSDT", fills, cutoff)
    assert [r["order_id"] for r in rows] == ["111"]
    assert rows[0]["symbol"] == "BTCUSDT"
    assert rows[0]["entry_price"] == 0


def test_build_row_shape_and_timestamp():
    close = {
        "symbol": "BTCUSDT",
        "order_id": "111",
        "realized_pnl": 2.0,
        "exit_price": 107.5,
        "position_amt": 4.0,
        "side": "SELL",
        "position_side": "LONG",
        "closed_at_ms": 1700000001000,
    }
    row = _build_row(close)
    assert row["symbol"] == "BTCUSDT"
    assert row["order_id"] == "111"
    assert row["realized_pnl"] == 2.0
    assert row["exit_price"] == 107.5
    assert row["position_amt"] == 4.0
    assert row["side"] == "SELL"
    assert row["position_side"] == "LONG"
    assert row["entry_price"] == 0
    assert row["closed_at"].startswith("2023-11-")


class _PagingStubAPI:
    """Returns fills in pages of up to 1000, paginated by fromId."""

    def __init__(self, fills):
        self._fills = sorted(fills, key=lambda f: f["id"])

    def get_user_trades(self, symbol, order_id=None, limit=10, start_time=None, from_id=None):
        pool = [f for f in self._fills if f["symbol"] == symbol]
        if from_id is not None:
            pool = [f for f in pool if f["id"] >= from_id]
        elif start_time is not None:
            pool = [f for f in pool if f["time"] >= start_time]
        return pool[:limit]


def test_fetch_symbol_trades_paginates():
    fills = [{"id": i, "symbol": "BTCUSDT", "time": 1700000000000 + i} for i in range(1, 2501)]
    api = _PagingStubAPI(fills)
    out = _fetch_symbol_trades(api, "BTCUSDT", start_ms=0)
    assert len(out) == 2500
    assert {f["id"] for f in out} == {f["id"] for f in fills}
