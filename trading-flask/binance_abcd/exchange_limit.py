"""Shrink an entry so the position stays under the exchange's limit (2026-11-12).

Binance accepts only so big a position per leverage (SANTOSUSDT at 10x:
$10,000) and refuses any order that would pass it (-2027 "Exceeded the
maximum allowable position at current leverage"). Sizes scale with each
account's balance, so a customer who deposits enough would have their later
entries refused with nobody watching. Instead, an entry that would pass the
limit is SHRUNK to what fits; one with no room left is skipped
("exchange limit reached"). Both are recorded on the trade_logs row and in the
hourly failed-trade email, so the size can be lowered on purpose.

Rules:
- Entries only. Exits never come here: an open position is always closable.
- Unknown is never a block. No brackets (MEXC/Bybit, or Binance did not
  answer), no price, or no leverage = the entry goes out as sized, exactly as
  before; the exchange's own answer then speaks.
- A SAFETY margin (default 3%) stays free, because the price moves between this
  check and the fill, and the limit counts the position at the mark price.
- Brackets are cached per host + symbol for 10 minutes and a failed read for
  1 minute, so a signal fanning out to every account costs one read, not one
  per account. They change only when Binance edits a coin's limits.
"""

from __future__ import annotations

import math
import threading
import time
from typing import Any, Optional

from binance_abcd import hooks
from binance_abcd.size_check import cap_at

SAFETY = max(0.0, min(0.5, hooks._env_float("LIMIT_SAFETY", 0.03)))
# Below this a shrunk entry is not worth an order (Binance's usual minimum is $5).
MIN_ENTRY_USD = 6.0
BRACKETS_TTL = 600.0
FAILED_TTL = 60.0
PRICE_TTL = 30.0

# Skip reason when the position is already at the limit (SignalHealth: limit_reached).
LIMIT_REACHED = "exchange limit reached"

_lock = threading.Lock()
_brackets: dict[tuple[str, str], tuple[float, Optional[list]]] = {}
_prices: dict[tuple[str, str], tuple[float, Optional[float]]] = {}


def _cached(store: dict, key: tuple[str, str], ttl_ok: float, read) -> Any:
    now = time.time()
    with _lock:
        hit = store.get(key)
        if hit is not None and hit[0] > now:
            return hit[1]
    value = read()
    with _lock:
        store[key] = (now + (ttl_ok if value is not None else FAILED_TTL), value)
    return value


def reset_cache() -> None:
    """Tests only."""
    with _lock:
        _brackets.clear()
        _prices.clear()


def cap_usd(api, symbol: str, leverage: Optional[int]) -> Optional[float]:
    """The largest position the exchange accepts at `leverage`, or None when
    it cannot be known (no bracket read for this venue, unreadable, no
    leverage, or a leverage the coin does not allow — that order fails on its
    own and names why)."""
    if leverage is None or not hasattr(api, "leverage_brackets"):
        return None
    key = (str(getattr(api, "base_url", "")), symbol.upper())
    brackets = _cached(_brackets, key, BRACKETS_TTL, lambda: api.leverage_brackets(symbol))
    if not brackets:
        return None
    return cap_at(brackets, leverage)["cap_usd"]


def _price(api, symbol: str, signal_price: Optional[float]) -> Optional[float]:
    mark = None
    if hasattr(api, "mark_price"):
        key = (str(getattr(api, "base_url", "")), symbol.upper())
        mark = _cached(_prices, key, PRICE_TTL, lambda: api.mark_price(symbol))
    if mark:
        return float(mark)
    try:
        p = float(signal_price) if signal_price is not None else None
    except (TypeError, ValueError):
        p = None
    return p if p and p > 0 and math.isfinite(p) else None


def fit(api, symbol: str, position_side: str, leverage: Optional[int], current_qty: Optional[float],
        quantity: float, signal_price: Optional[float]) -> dict:
    """{"action": "ok" | "shrink" | "skip", "quantity": coins to send, ...}.

    `current_qty` is the coins already open on `position_side` (None =
    unknown: read from the exchange only when the limit could bite, and an
    unreadable size lets the entry through as sized — unknown never blocks)."""
    out: dict[str, Any] = {"action": "ok", "quantity": quantity}
    cap = cap_usd(api, symbol, leverage)
    if cap is None or quantity <= 0:
        return out
    price = _price(api, symbol, signal_price)
    if price is None:
        return out
    usable = cap * (1.0 - SAFETY)
    if current_qty is None:
        if quantity * price <= usable * 0.5:
            return out  # far from the limit whatever is open: not worth a read
        current_qty = api.open_amount(symbol, position_side)
        if current_qty is None:
            return out
    open_usd = abs(current_qty or 0.0) * price
    room_usd = usable - open_usd
    want_usd = quantity * price
    info = {
        "cap_usd": round(cap, 2), "leverage": leverage, "price": price,
        "open_usd": round(open_usd, 2), "requested_qty": quantity,
        "requested_usd": round(want_usd, 2), "safety": SAFETY,
    }
    if want_usd <= room_usd:
        return out
    if room_usd < MIN_ENTRY_USD:
        return {"action": "skip", "quantity": 0.0, **info}
    shrunk = room_usd / price
    if hasattr(api, "floor_qty"):
        floored = api.floor_qty(symbol, shrunk)
        if floored is not None:
            shrunk = floored
    if shrunk <= 0 or shrunk * price < MIN_ENTRY_USD:
        return {"action": "skip", "quantity": 0.0, **info}
    return {"action": "shrink", "quantity": shrunk, "shrunk_usd": round(shrunk * price, 2), **info}
