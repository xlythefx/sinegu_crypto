"""
Fetch assets from trading-api and map to Bybit linear futures symbols.
"""

import logging
from typing import Any, Dict, List, Optional

import requests

from src.cache import TTLCache
from bybit_src.hooks import API_BASE_URL, ASSETS_ENDPOINT, ASSETS_CACHE_TTL, trading_api_headers

logger = logging.getLogger(__name__)

_assets_cache = TTLCache(ASSETS_CACHE_TTL)


def invalidate_assets_cache() -> None:
    _assets_cache.invalidate()


def assets_cache_age() -> Optional[float]:
    return _assets_cache.age_seconds()

TICKER_TO_BYBIT: Dict[str, str] = {
    "BTCUSD": "BTCUSDT",
    "ETHUSD": "ETHUSDT",
    "GOLD": "XAUUSDT",
    "TAOUSD": "TAOUSDT",
}
DEFAULT_SUFFIX = "USDT"


def _to_bybit_symbol(ticker: str) -> str:
    t = (ticker or "").strip().upper()
    if not t:
        return t
    if t in TICKER_TO_BYBIT:
        return TICKER_TO_BYBIT[t]
    if t.endswith("USDT"):
        return t
    if t.endswith("USD"):
        return t[:-3] + "USDT"
    return t + DEFAULT_SUFFIX


def _fetch_assets_uncached(timeout: int = 10) -> Optional[List[Dict[str, Any]]]:
    if not API_BASE_URL:
        logger.warning("API_BASE_URL not set - cannot fetch assets")
        return None
    base = API_BASE_URL.rstrip("/")
    path = ASSETS_ENDPOINT if ASSETS_ENDPOINT.startswith("/") else "/" + ASSETS_ENDPOINT
    url = base + path
    try:
        resp = requests.get(url, headers=trading_api_headers(), timeout=timeout)
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException as e:
        logger.warning("[Assets] Request failed %s: %s", url, e)
        return None
    except ValueError as e:
        logger.warning("[Assets] Invalid JSON from %s: %s", url, e)
        return None

    if not payload.get("success"):
        logger.warning("[Assets] API error: %s", payload.get("error", "Unknown"))
        return None

    assets = payload.get("assets", [])
    if not assets:
        logger.warning("[Assets] No assets returned")
        return None

    out: List[Dict[str, Any]] = []
    for a in assets:
        ticker = (a.get("ticker") or "").strip()
        if not ticker:
            continue
        base_size = float(a.get("base_size", 0) or 0)
        enabled = bool(a.get("enabled", True))
        bybit_symbol = (a.get("bybit_symbol") or _to_bybit_symbol(ticker)).upper()
        row = {
            "ticker": ticker,
            "bybit_symbol": bybit_symbol,
            "base_size": base_size,
            "enabled": enabled,
        }
        for k, v in a.items():
            if k not in row:
                row[k] = v
        out.append(row)
    return out


def fetch_assets(timeout: int = 10) -> Optional[List[Dict[str, Any]]]:
    """Cached wrapper."""
    return _assets_cache.get(lambda: _fetch_assets_uncached(timeout=timeout))


def get_enabled_assets(timeout: int = 10) -> Optional[List[Dict[str, Any]]]:
    assets = fetch_assets(timeout=timeout)
    if assets is None:
        return None
    return [a for a in assets if a.get("enabled")]
