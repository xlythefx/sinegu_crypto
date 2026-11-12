"""Entries shrink to fit the exchange's position limit (exchange_limit.py).

SANTOSUSDT at 10x caps at $10,000 on Binance. A customer whose balance grows
past what a size allows would otherwise get every later entry refused -2027
with nobody watching. Rules pinned here:
- an entry that would pass the limit (minus a 3% margin) is shrunk to fit;
- one with no room left is skipped "exchange limit reached";
- unknown never blocks: no brackets, no price, no leverage or a refused
  leverage = sent as sized;
- the brackets are read once per coin, not once per account.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

import binance_abcd.exchange_limit as el
import binance_abcd.routes.webhook as webhook

BRACKETS = [
    {"bracket": 1, "initialLeverage": 10, "notionalFloor": 0, "notionalCap": 10000},
    {"bracket": 2, "initialLeverage": 5, "notionalFloor": 10000, "notionalCap": 60000},
]
ASSET = {"ticker": "SANTOSUSDT", "base_size": 400.0, "max_size": 1200.0, "max_increments": 3.0,
         "side": "ALL", "streak_sizes": {}, "leverage": 10}


@pytest.fixture(autouse=True)
def _fresh():
    el.reset_cache()
    webhook._LEVERAGE_APPLIED.clear()
    yield
    el.reset_cache()
    webhook._LEVERAGE_APPLIED.clear()


class _Api:
    LEVERAGE_PER_ORDER = False
    exchange = "binance"
    api_key = "bk1"
    base_url = "https://fapi.binance.com"

    def __init__(self, brackets=BRACKETS, mark=0.40, open_qty=0.0, step=1.0):
        self._brackets, self._mark, self._open, self._step = brackets, mark, open_qty, step
        self.bracket_reads = 0

    def leverage_brackets(self, symbol):
        self.bracket_reads += 1
        return self._brackets

    def mark_price(self, symbol):
        return self._mark

    def floor_qty(self, symbol, coins):
        return float(int(coins / self._step) * self._step)

    def open_amount(self, symbol, side):
        return self._open

    def set_leverage(self, symbol, leverage):
        return {"leverage": leverage}


# --- fit() ---------------------------------------------------------------------

def test_an_entry_well_under_the_limit_is_untouched():
    out = el.fit(_Api(), "SANTOSUSDT", "SHORT", 10, 0.0, 6800, 0.40)  # $2,720
    assert out == {"action": "ok", "quantity": 6800}


def test_an_entry_that_would_pass_the_limit_is_shrunk_to_fit():
    # Open 20,000 coins = $8,000; usable = $9,700 -> room $1,700 = 4,250 coins.
    out = el.fit(_Api(), "SANTOSUSDT", "SHORT", 10, 20000.0, 6800, 0.40)
    assert out["action"] == "shrink"
    assert out["quantity"] == 4250.0
    assert out["cap_usd"] == 10000.0 and out["requested_qty"] == 6800 and out["open_usd"] == 8000.0


def test_no_room_left_is_a_skip():
    out = el.fit(_Api(), "SANTOSUSDT", "SHORT", 10, 24240.0, 6800, 0.40)  # $9,696 open
    assert out["action"] == "skip" and out["quantity"] == 0.0


@pytest.mark.parametrize("api, leverage", [
    (_Api(brackets=None), 10),          # Binance did not answer
    (_Api(mark=None), 10),              # no price at all (and no signal price below)
    (_Api(), None),                     # leverage unknown
    (_Api(), 25),                       # leverage above the coin's maximum: the order fails on its own
])
def test_unknown_never_blocks(api, leverage):
    out = el.fit(api, "SANTOSUSDT", "SHORT", leverage, 24240.0, 6800, None)
    assert out == {"action": "ok", "quantity": 6800}


def test_a_venue_without_brackets_is_never_limited():
    class _Mexc:
        base_url = "https://contract.mexc.com"
    assert el.fit(_Mexc(), "SANTOS_USDT", "SHORT", 10, 1e9, 1e6, 0.40)["action"] == "ok"


def test_the_signal_price_stands_in_when_the_mark_is_unreadable():
    out = el.fit(_Api(mark=None), "SANTOSUSDT", "SHORT", 10, 20000.0, 6800, 0.40)
    assert out["action"] == "shrink"


def test_an_unknown_open_size_is_read_only_when_the_limit_could_bite():
    api = _Api(open_qty=20000.0)
    assert el.fit(api, "SANTOSUSDT", "SHORT", 10, None, 1000, 0.40)["action"] == "ok"  # $400: no read needed
    assert el.fit(api, "SANTOSUSDT", "SHORT", 10, None, 15000, 0.40)["action"] == "shrink"  # $6,000 + $8,000 open


def test_brackets_are_read_once_per_coin_not_per_account():
    api = _Api()
    for _ in range(5):
        el.fit(api, "SANTOSUSDT", "SHORT", 10, 0.0, 6800, 0.40)
    assert api.bracket_reads == 1


# --- the entry path --------------------------------------------------------------

def _account(balance: float) -> dict:
    return {"api_key": "bk1", "secret_key": "s", "name": "Big customer", "uni_id": "u1",
            "exchange": "binance", "demo": False, "enabled": True,
            "balance": balance, "total_deposit": balance}


def _run(api, balance: float, open_qty: float):
    sent = {}

    def _entry(_api, symbol, side, qty, price):
        sent["qty"] = qty
        return {"result": {"avgPrice": "0.40"}}

    with (
        patch.object(webhook, "client_for", return_value=api),
        patch.object(webhook, "handle_entry", side_effect=_entry),
        patch.object(webhook, "_upsert_position_api"),
        patch.object(webhook, "_store_open_strategy"),
    ):
        result = webhook._run_account(_account(balance), "SELL", "SANTOSUSDT", 0.40, 10, None, ASSET, {"bk1": open_qty})
    return result, sent.get("qty")


def test_a_big_account_third_entry_is_shrunk_and_recorded():
    # 25,000 USDT: one entry = 10,000 coins ($4,000). Two open = $8,000; the third
    # would make $12,000 > $10,000, so it is cut to the $1,700 that fits.
    result, sent = _run(_Api(), 25000.0, 20000.0)
    assert result["status"] == "filled"
    assert sent == 4250.0 and result["quantity"] == 4250.0
    assert result["shrunk_by_limit"] is True
    assert result["sizing"]["limit"]["requested_qty"] == 10000.0


def test_a_full_position_at_the_limit_is_skipped_not_refused():
    result, sent = _run(_Api(), 30000.0, 24240.0)
    assert sent is None
    assert result["status"] == "skipped" and result["reason"] == el.LIMIT_REACHED


def test_an_account_far_from_the_limit_trades_exactly_as_before():
    result, sent = _run(_Api(), 17028.0, 6800.0)
    assert sent == 6800.0 and "shrunk_by_limit" not in result and "limit" not in result["sizing"]
