"""_scale_qty — the balance-proportional sizing math (reference balance 1000)."""

from __future__ import annotations

import pytest

from binance_abcd.hooks import REFERENCE_BALANCE
from binance_abcd.routes.webhook import _scale_qty


def test_the_reference_balance_is_one_thousand():
    """Sizing is quoted per 1000 of balance; the tables below assume it."""
    assert REFERENCE_BALANCE == 1000.0


def test_below_reference_returns_base_size():
    assert _scale_qty("ETHUSDT", 0.1, 100) == 0.1
    assert _scale_qty("ETHUSDT", 0.1, 999.99) == 0.1
    assert _scale_qty("BTCUSDT", 0.005, 300) == 0.005
    # A drawn-down account still gets a full base size, never a fraction.
    assert _scale_qty("BTCUSDT", 0.01, 800) == 0.01


def test_btc_scales_in_whole_coarse_steps():
    assert _scale_qty("BTCUSDT", 0.01, 1000) == 0.01
    assert _scale_qty("BTCUSDT", 0.01, 1999) == 0.01
    assert _scale_qty("BTCUSDT", 0.01, 2000) == 0.02
    assert _scale_qty("BTCUSDT", 0.01, 5000) == pytest.approx(0.05)
    assert _scale_qty("BTCUSDT", 0.01, 10000) == pytest.approx(0.10)


def test_alt_scales_in_tenth_steps():
    # step = 0.01; 0.1 * (1500/1000) = 0.15 -> exactly 15 steps
    assert _scale_qty("ETHUSDT", 0.1, 1500) == pytest.approx(0.15)
    # 0.1 * (1554/1000) = 0.1554 -> floored to 0.15
    assert _scale_qty("ETHUSDT", 0.1, 1554) == pytest.approx(0.15)
    assert _scale_qty("ETHUSDT", 0.1, 2000) == pytest.approx(0.2)
    assert _scale_qty("ETHUSDT", 0.1, 5000) == pytest.approx(0.5)


def test_bad_inputs_return_zero():
    assert _scale_qty("ETHUSDT", 0, 1000) == 0.0
    assert _scale_qty("ETHUSDT", None, 1000) == 0.0
    assert _scale_qty("ETHUSDT", "junk", 1000) == 0.0
    assert _scale_qty("ETHUSDT", 0.1, "junk") == 0.0
