"""Tests for the max_sizing position cap.

Covers the two pieces the BUY/SELL gate composes:
  1. current_side_size() — side-aware open size (DB-first, Binance fallback, fail-open).
  2. the cap decision — scaled_cap = _scale_qty(...); block when
     round(current + quantity, 8) > scaled_cap.
The decision is replicated here against the REAL _scale_qty so the "0.02 out of
0.06 -> block at 0.06" behavior and the constant-stack-count scaling are pinned.
"""
from unittest.mock import MagicMock, patch

import src.trading_handler as th
from src.routes.webhook import _scale_qty


# ---------------------------------------------------------------------------
# current_side_size / _sum_side
# ---------------------------------------------------------------------------

def _db_resp(positions):
    resp = MagicMock()
    resp.ok = True
    resp.json.return_value = {
        "success": True,
        "has_position": bool(positions),
        "positions": positions,
    }
    return resp


def test_current_side_size_db_is_side_aware():
    positions = [
        {"position_side": "LONG", "position_amt": 0.04},
        {"position_side": "SHORT", "position_amt": -0.10},
    ]
    with patch("src.trading_handler.requests.get") as g:
        g.return_value = _db_resp(positions)
        long_size = th.current_side_size("k", "s", "BTCUSDT", "LONG")
        short_size = th.current_side_size("k", "s", "BTCUSDT", "SHORT")

    assert long_size == 0.04   # SHORT leg must not count toward a LONG entry
    assert short_size == 0.10


def test_sum_side_both_uses_sign():
    pos_long = [{"position_side": "BOTH", "position_amt": 0.05}]
    assert th._sum_side(pos_long, "LONG", "position_side", "position_amt") == 0.05
    assert th._sum_side(pos_long, "SHORT", "position_side", "position_amt") == 0.0

    pos_short = [{"position_side": "BOTH", "position_amt": -0.05}]
    assert th._sum_side(pos_short, "SHORT", "position_side", "position_amt") == 0.05
    assert th._sum_side(pos_short, "LONG", "position_side", "position_amt") == 0.0


def test_current_side_size_falls_back_to_binance_when_db_down():
    with patch("src.trading_handler.requests.get") as g, \
         patch("src.trading_handler.BinanceAPI") as B:
        g.side_effect = Exception("db down")          # _db_side_size -> None
        B.return_value.get_positions_v3.return_value = [
            {"positionSide": "LONG", "positionAmt": "0.06"},
        ]
        size = th.current_side_size("k", "s", "BTCUSDT", "LONG")

    assert size == 0.06


def test_current_side_size_fails_open_to_zero():
    with patch("src.trading_handler.requests.get") as g, \
         patch("src.trading_handler.BinanceAPI") as B:
        g.side_effect = Exception("db down")
        B.side_effect = Exception("binance down")     # fallback also unreadable
        size = th.current_side_size("k", "s", "BTCUSDT", "LONG")

    assert size == 0.0   # never blocks a trade on a transient read failure


# ---------------------------------------------------------------------------
# cap decision (mirrors the gate in webhook._process_account)
# ---------------------------------------------------------------------------

def _would_block(symbol, base_size, max_sizing, balance, current):
    """Replicates the production gate decision exactly."""
    quantity = _scale_qty(symbol, base_size, balance)
    scaled_cap = _scale_qty(symbol, max_sizing, balance)
    return bool(scaled_cap > 0 and round(current + quantity, 8) > scaled_cap)


def test_cap_allows_landing_exactly_on_cap_then_blocks():
    # BTC base 0.02, cap 0.06 @ balance 500 -> qty 0.02, scaled_cap 0.06.
    assert _would_block("BTCUSDT", 0.02, 0.06, 500, 0.04) is False  # 0.04+0.02 == 0.06 OK
    assert _would_block("BTCUSDT", 0.02, 0.06, 500, 0.06) is True   # 0.06+0.02 > 0.06 block


def test_falsy_cap_never_blocks():
    # max_sizing 0 -> scaled_cap 0 -> scaled_cap > 0 is False -> never blocks.
    assert _would_block("BTCUSDT", 0.02, 0.0, 500, 999.0) is False


def test_stack_count_constant_across_balances():
    # The number of additive entries before "maxed sizing" is balance-independent.
    for symbol, base, cap in (("BTCUSDT", 0.02, 0.06), ("ETHUSDT", 0.1, 0.3)):
        for balance in (500, 1000, 2000):
            qty = _scale_qty(symbol, base, balance)
            scaled_cap = _scale_qty(symbol, cap, balance)
            current, fills = 0.0, 0
            while not (round(current + qty, 8) > scaled_cap):
                current = round(current + qty, 8)
                fills += 1
                if fills > 20:
                    break
            assert fills == 3, f"{symbol} @ {balance}: expected 3 stacks, got {fills}"
