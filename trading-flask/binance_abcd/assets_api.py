"""Enabled tradeable assets from sinegutrade-api, TTL-cached.

Asset rows carry the sizing config: base_size (one increment), max_increments
(stack cap), and side (ALL | LONG | SHORT — which entry directions are allowed).
Entries FAIL CLOSED: no asset row, or a disabled one, means the entry is
rejected. Exits never consult assets.
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
        try:
            max_increments = float(asset.get("max_increments") or 0)
        except (TypeError, ValueError):
            max_increments = 0.0
        by_ticker[ticker] = {
            "ticker": ticker,
            "base_size": base_size,
            "max_increments": max_increments,
            "side": str(asset.get("side") or "ALL").upper(),
        }
    return by_ticker


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
