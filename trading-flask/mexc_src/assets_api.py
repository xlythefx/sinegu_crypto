"""
Fetch assets from trading-api and map tickers to MEXC futures (contract) symbols.
Futures symbols use underscores (e.g. BTC_USDT).
"""

import logging
from typing import Any, Dict, List, Optional

import requests

from src.cache import TTLCache
from mexc_src.hooks import API_BASE_URL, ASSETS_ENDPOINT, ASSETS_CACHE_TTL, trading_api_headers

logger = logging.getLogger(__name__)

_assets_cache = TTLCache(ASSETS_CACHE_TTL)


def invalidate_assets_cache() -> None:
    _assets_cache.invalidate()


def assets_cache_age() -> Optional[float]:
    return _assets_cache.age_seconds()

# Override map for non-obvious ticker → futures contract symbol.
TICKER_TO_MEXC: Dict[str, str] = {
    "BTCUSD": "BTC_USDT",
    "ETHUSD": "ETH_USDT",
    "TAOUSD": "TAO_USDT",
}
DEFAULT_QUOTE = "USDT"


def _to_mexc_symbol(ticker: str) -> str:
    """Return MEXC futures contract symbol (BASE_QUOTE)."""
    t = (ticker or "").strip().upper()
    if not t:
        return t
    if t in TICKER_TO_MEXC:
        return TICKER_TO_MEXC[t]
    if "_" in t:
        return t
    if t.endswith("USDT"):
        return t[:-4] + "_USDT"
    if t.endswith("USD"):
        return t[:-3] + "_USDT"
    return t + "_" + DEFAULT_QUOTE


def contract_symbol_to_tv_ticker(contract: str) -> str:
    """MEXC contract (BASE_QUOTE) -> TradingView-style ticker (BASEQUOTE), e.g. BTC_USDT -> BTCUSDT."""
    c = (contract or "").strip().upper()
    if not c:
        return c
    if "_" in c:
        base, quote = c.rsplit("_", 1)
        return f"{base}{quote}"
    return c


def _fetch_assets_uncached(timeout: int = 10) -> Optional[List[Dict[str, Any]]]:
    """Load assets from trading-api; enrich with mexc_symbol."""
    if not API_BASE_URL:
        logger.warning("API_BASE_URL not set - cannot fetch assets")
        return None
    base = API_BASE_URL.rstrip("/")
    path = ASSETS_ENDPOINT if ASSETS_ENDPOINT.startswith("/") else "/" + ASSETS_ENDPOINT
    url = base + path
    try:
        resp = requests.get(url, params={"broker": "MEXC"}, headers=trading_api_headers(), timeout=timeout)
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
        mexc_symbol = (a.get("mexc_symbol") or _to_mexc_symbol(ticker)).upper()
        row = {
            "ticker": ticker,
            "mexc_symbol": mexc_symbol,
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
