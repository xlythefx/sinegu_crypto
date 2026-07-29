"""
Fetch assets (tickers, position sizing) from trading-api.
API: GET {API_BASE_URL}{ASSETS_ENDPOINT} -> { success, assets: [ { ticker, base_size, enabled } ] }
Maps DB tickers to Binance Futures symbols (e.g. BTCUSD -> BTCUSDT, GOLD -> XAUUSDT).
"""

import logging
from typing import Any, Dict, List, Optional

import requests

from src.cache import TTLCache
from src.hooks import API_BASE_URL, ASSETS_ENDPOINT, ASSETS_BROKER, ASSETS_CACHE_TTL, trading_api_headers

logger = logging.getLogger(__name__)

_assets_cache = TTLCache(ASSETS_CACHE_TTL)


def invalidate_assets_cache() -> None:
    _assets_cache.invalidate()


def assets_cache_age() -> Optional[float]:
    return _assets_cache.age_seconds()

# Map DB/display ticker to Binance Futures symbol (USDT-margined)
TICKER_TO_BINANCE: Dict[str, str] = {
    "BTCUSD": "BTCUSDT",
    "ETHUSD": "ETHUSDT",
    "GOLD": "XAUUSDT",
    "TAOUSD": "TAOUSDT",
    "AAPL": "AAPLUSDT",  # if Binance has it; else may need to skip
}
# Normalize: if ticker already ends with USDT, use as-is; else append USDT or use map
DEFAULT_SUFFIX = "USDT"


def _to_binance_symbol(ticker: str) -> str:
    t = (ticker or "").strip().upper()
    if not t:
        return t
    if t in TICKER_TO_BINANCE:
        return TICKER_TO_BINANCE[t]
    if t.endswith("USDT"):
        return t
    if t.endswith("USD"):
        return t[:-3] + "USDT"
    return t + DEFAULT_SUFFIX


def _fetch_assets_uncached(timeout: int = 10) -> Optional[List[Dict[str, Any]]]:
    """
    Load assets from trading-api (fetch_assets.php).
    Returns list of { ticker, binance_symbol, base_size, max_sizing, enabled }
    or None on failure.
    """
    if not API_BASE_URL:
        logger.warning("API_BASE_URL not set - cannot fetch assets")
        return None
    base = API_BASE_URL.rstrip("/")
    path = ASSETS_ENDPOINT if ASSETS_ENDPOINT.startswith("/") else "/" + ASSETS_ENDPOINT
    url = base + path
    params = {"broker": ASSETS_BROKER} if ASSETS_BROKER else None
    try:
        resp = requests.get(url, headers=trading_api_headers(), params=params, timeout=timeout)
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
        # Absolute max position size per side (DECIMAL). Falsy/missing -> None -> no cap.
        try:
            max_sizing = float(a.get("max_sizing") or 0) or None
        except (TypeError, ValueError):
            max_sizing = None
        enabled = bool(a.get("enabled", True))
        binance_symbol = _to_binance_symbol(ticker)
        row = {
            "ticker": ticker,
            "binance_symbol": binance_symbol,
            "base_size": base_size,
            "max_sizing": max_sizing,
            "enabled": enabled,
        }
        for k, v in a.items():
            if k not in row:
                row[k] = v
        out.append(row)
    return out


def fetch_assets(timeout: int = 10) -> Optional[List[Dict[str, Any]]]:
    """Cached wrapper around the assets endpoint."""
    return _assets_cache.get(lambda: _fetch_assets_uncached(timeout=timeout))


def get_enabled_assets(timeout: int = 10) -> Optional[List[Dict[str, Any]]]:
    """Fetch assets and return only enabled ones."""
    assets = fetch_assets(timeout=timeout)
    if assets is None:
        return None
    return [a for a in assets if a.get("enabled")]


def get_asset_by_ticker(ticker: str, timeout: int = 10) -> Optional[Dict[str, Any]]:
    """Fetch assets and return the one matching ticker (or binance_symbol)."""
    assets = fetch_assets(timeout=timeout)
    if not assets:
        return None
    t = (ticker or "").strip().upper()
    binance = _to_binance_symbol(t)
    for a in assets:
        if a.get("ticker", "").upper() == t or a.get("binance_symbol") == binance:
            return a
    return None
