"""Enabled tradeable assets from sinegutrade-api, TTL-cached.

Asset rows carry the sizing config: base_size (one increment), the stack cap,
and side (ALL | LONG | SHORT — which entry directions are allowed). Entries
FAIL CLOSED: no asset row, or a disabled one, means the entry is rejected.
Exits never consult assets.

**The `max_increments` COLUMN is a max position SIZE, not a count.** The name is
inherited from the mother schema, whose own migration comments it as "Max
position size (Binance: decimals allowed)", and `binance-flask` reads it the
same way (`assets_api.py`: "Binance assets repurpose the max_increments column
as a max position size"). The count of entries that may stack is DERIVED:

    max_increments (count) = round(max_size / base_size)

Reading the column as a count directly is what let LTCUSDT stack to 4 entries
against an intended cap of 3 (42 / 14): the webhook compares a count against
the cap, so a cap of `42` meant "42 entries", and the limit never fired. This
module is the ONE place the column is interpreted — everything downstream sees
`max_size` (units) and `max_increments` (entries) as two clearly separate
numbers, so the two can never be confused again.
"""

from __future__ import annotations

import logging

from binance_abcd import engine_client
from binance_abcd.cache import TTLCache
from binance_abcd.hooks import ASSETS_CACHE_TTL

log = logging.getLogger(__name__)

ASSETS_BROKER = "Binance"


def _load_assets() -> dict[str, dict] | None:
    data = engine_client.get_json("assets", params={"broker": ASSETS_BROKER})
    if data is None:
        return None
    assets = data.get("assets")
    if not isinstance(assets, list):
        log.warning("assets payload malformed: %.200s", data)
        return None

    by_ticker: dict[str, dict] = {}
    for asset in assets:
        ticker = str(asset.get("ticker", "")).upper()
        if not ticker or not asset.get("enabled"):
            continue
        try:
            base_size = float(asset.get("base_size") or 0)
        except (TypeError, ValueError):
            base_size = 0.0
        # The column is a max position SIZE in contract units (see module docs).
        try:
            max_size = float(asset.get("max_increments") or 0)
        except (TypeError, ValueError):
            max_size = 0.0
        by_ticker[ticker] = {
            "ticker": ticker,
            "base_size": base_size,
            "max_size": max_size,
            "max_increments": _increment_cap(max_size, base_size),
            "side": str(asset.get("side") or "ALL").upper(),
        }
    return by_ticker


def _increment_cap(max_size: float, base_size: float) -> float:
    """How many base-sized entries fit in the max position size — 0 = no cap.

    Balance-independent on purpose: the count is a property of the ASSET (this
    ticker allows a 3-deep stack), while the size each account actually trades
    scales with its balance. That split is what makes one cap correct for a 500
    USDT account and a 50,000 USDT one alike.

    Floors at 1 rather than 0 when a max size is set but is smaller than one
    base size: that configuration means "one entry", and returning 0 would read
    as "no cap" and allow unlimited stacking — the exact inversion of intent.
    """
    if max_size <= 0 or base_size <= 0:
        return 0.0
    return float(max(1, round(max_size / base_size)))


_cache = TTLCache(ASSETS_CACHE_TTL, _load_assets)


def fetch_assets(force: bool = False) -> dict[str, dict]:
    """Enabled assets keyed by upper-case ticker. Empty dict if never fetched."""
    return _cache.get(force=force) or {}


def get_asset(ticker: str) -> dict | None:
    return fetch_assets().get(ticker.upper())


def assets_cache_age() -> float | None:
    return _cache.age()


def invalidate_assets_cache() -> None:
    _cache.invalidate()
