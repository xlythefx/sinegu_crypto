"""fee_receipts — the pure builders that turn Binance income rows and userTrades
fills into receipt rows for /engine/binance/fees.

Every key the Laravel whitelist accepts must be present on every row (the API
strips unlisted keys, and a missing one would fail validation), the sign
convention must be "positive = cost", and the asset must pass through as
reported so a BNB-paid fee is visible rather than silently summed.
"""

from __future__ import annotations

from binance_abcd import fee_receipts as fr

ACCOUNT = {"api_key": "live-key-1", "uni_id": "uni-live-1", "secret_key": "s"}
RECEIPT_KEYS = {
    "api_key", "uni_id", "symbol", "kind", "ref", "order_id", "side", "position_side",
    "qty", "price", "realized_pnl", "amount", "asset", "charged_at",
}

NOW = 1_800_000_000_000
CUTOFF = NOW - 120_000


def _fill(**over) -> dict:
    base = {
        "id": 555, "orderId": 100, "symbol": "LTCUSDT", "side": "BUY", "positionSide": "LONG",
        "price": "52.10", "qty": "14", "realizedPnl": "0", "commission": "0.36470000",
        "commissionAsset": "USDT", "time": NOW - 600_000, "buyer": True, "maker": False,
    }
    base.update(over)
    return base


def _income(income_type: str, **over) -> dict:
    base = {
        "symbol": "LTCUSDT", "incomeType": income_type, "income": "-0.12345678", "asset": "USDT",
        "info": "", "time": NOW - 600_000, "tranId": 9_001, "tradeId": "",
    }
    base.update(over)
    return base


# --- fills -----------------------------------------------------------------------

def test_fill_receipt_carries_every_key_and_the_asset_as_reported():
    rows = fr.fill_receipts([_fill(commissionAsset="bnb", commission="0.00041")], "ltcusdt", ACCOUNT, NOW - 3_600_000, CUTOFF)

    assert len(rows) == 1
    row = rows[0]
    assert set(row) == RECEIPT_KEYS
    assert row["api_key"] == "live-key-1"
    assert row["uni_id"] == "uni-live-1"
    assert row["symbol"] == "LTCUSDT"
    assert row["kind"] == "fill"
    assert row["ref"] == 555
    assert row["order_id"] == 100
    assert row["side"] == "BUY"
    assert row["position_side"] == "LONG"
    assert row["qty"] == 14.0
    assert row["price"] == 52.10
    assert row["realized_pnl"] == 0.0
    assert row["amount"] == 0.00041
    assert row["asset"] == "BNB"  # never assumed to be USDT
    assert row["charged_at"] == NOW - 600_000


def test_a_zero_commission_fill_is_still_a_receipt():
    """Its quantity is what the API's replay needs, fee or no fee."""
    rows = fr.fill_receipts([_fill(commission="0")], "LTCUSDT", ACCOUNT, NOW - 3_600_000, CUTOFF)
    assert len(rows) == 1
    assert rows[0]["amount"] == 0.0


def test_fills_younger_than_the_indexing_lag_are_deferred():
    fresh = _fill(id=556, time=CUTOFF + 1)
    old = _fill(id=555, time=CUTOFF)
    rows = fr.fill_receipts([fresh, old], "LTCUSDT", ACCOUNT, NOW - 3_600_000, CUTOFF)
    assert [r["ref"] for r in rows] == [555]


def test_fills_before_the_watermark_minus_overlap_are_not_resent():
    since = NOW - 1_800_000
    at_floor = _fill(id=1, time=since - fr.FEE_OVERLAP_MS)          # exactly the floor: excluded
    inside_overlap = _fill(id=2, time=since - fr.FEE_OVERLAP_MS + 1)  # re-sent, backend ignores dupes
    after_mark = _fill(id=3, time=since + 1)
    rows = fr.fill_receipts([at_floor, inside_overlap, after_mark], "LTCUSDT", ACCOUNT, since, CUTOFF)
    assert [r["ref"] for r in rows] == [2, 3]


def test_malformed_fill_is_skipped_not_fatal():
    rows = fr.fill_receipts([{"id": "x"}, "junk", _fill()], "LTCUSDT", ACCOUNT, NOW - 3_600_000, CUTOFF)
    assert len(rows) == 1


# --- funding ---------------------------------------------------------------------

def test_funding_receipt_negates_binance_sign():
    paid = _income("FUNDING_FEE", income="-0.5", tranId=1)
    received = _income("FUNDING_FEE", income="0.2", tranId=2)
    rows = fr.funding_receipts([paid, received], ACCOUNT, NOW - 3_600_000, CUTOFF)

    assert [r["amount"] for r in rows] == [0.5, -0.2]
    for row in rows:
        assert set(row) == RECEIPT_KEYS
        assert row["kind"] == "funding"
        assert row["order_id"] is None
        assert row["qty"] is None
        assert row["symbol"] == "LTCUSDT"
    assert [r["ref"] for r in rows] == [1, 2]


def test_funding_without_a_symbol_or_too_fresh_is_dropped():
    rows = fr.funding_receipts(
        [_income("FUNDING_FEE", symbol=""), _income("FUNDING_FEE", time=CUTOFF + 5)],
        ACCOUNT, NOW - 3_600_000, CUTOFF,
    )
    assert rows == []


# --- income partition --------------------------------------------------------------

def test_partition_income_splits_by_type_against_each_flows_watermark():
    close_since = NOW - 1_000_000
    fee_since = NOW - 3_000_000
    rows = [
        _income("REALIZED_PNL", symbol="LTCUSDT", time=close_since + 1),    # new close
        _income("REALIZED_PNL", symbol="ETHUSDT", time=close_since),        # already synced
        _income("COMMISSION", symbol="ETHUSDT", time=fee_since + 1),        # an entry: fee flow only
        _income("COMMISSION", symbol="BTCUSDT", time=fee_since),            # already on the ledger
        _income("FUNDING_FEE", symbol="LTCUSDT", time=fee_since + 1),
        _income("FUNDING_FEE", symbol="LTCUSDT", time=fee_since - 1),
        _income("TRANSFER", symbol="", time=NOW),                           # somebody else's poller
        "junk",
    ]

    parts = fr.partition_income(rows, close_since, fee_since)

    assert parts.close_symbols == {"LTCUSDT"}
    assert parts.fee_symbols == {"ETHUSDT"}
    assert [f["time"] for f in parts.funding] == [fee_since + 1]


def test_newest_charge_is_the_watermark_a_batch_earns():
    assert fr.newest_charge([], 10) == 10
    assert fr.newest_charge([{"charged_at": 5}, {"charged_at": 30}, {"charged_at": "x"}], 10) == 30


def test_user_trades_start_serves_both_flows_and_clamps_to_seven_days():
    now = NOW
    # Fee flow reaches back an overlap past its mark; closes start at their own.
    assert fr.user_trades_start(now - 1_000_000, now - 50, now) == now - 1_000_000
    assert fr.user_trades_start(now - 10, now - 50, now) == now - 50 - fr.FEE_OVERLAP_MS
    # A first-run seed older than Binance answers is clamped.
    week = 7 * 86400 * 1000
    assert fr.user_trades_start(now - 30 * 86400 * 1000, now - week, now) == now - fr.USER_TRADES_MAX_AGE_MS


def test_watermark_files_round_trip_and_tolerate_garbage(tmp_path):
    path = tmp_path / "marks.json"
    assert fr.load_marks(path) == {}
    fr.save_marks(path, {"k": 123})
    assert fr.load_marks(path) == {"k": 123}
    path.write_text("not json", encoding="utf-8")
    assert fr.load_marks(path) == {}
