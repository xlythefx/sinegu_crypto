"""
Fetch MEXC accounts (enabled=1) from trading-api.
GET {API_BASE_URL}{MEXC_ACCOUNTS_ENDPOINT}
Returns: { success, accounts: [{ api_key, secret_key, name, ... }] }
"""

import logging
from typing import Any, Dict, List, Optional

import requests

from src.cache import TTLCache
from mexc_src.hooks import ACCOUNTS_CACHE_TTL, API_BASE_URL, MEXC_ACCOUNTS_ENDPOINT, trading_api_headers

logger = logging.getLogger(__name__)

_accounts_cache = TTLCache(ACCOUNTS_CACHE_TTL)


def invalidate_accounts_cache() -> None:
    _accounts_cache.invalidate()


def accounts_cache_age() -> Optional[float]:
    return _accounts_cache.age_seconds()


def _fetch_mexc_accounts_uncached(timeout: int = 10) -> Optional[List[Dict[str, Any]]]:
    """
    Fetch all MEXC accounts where enabled=1 from trading-api.
    Returns list of { api_key, secret_key, name, ... } or None on failure.
    """
    if not API_BASE_URL:
        logger.warning("API_BASE_URL not set - cannot fetch mexc accounts")
        return None
    base = API_BASE_URL.rstrip("/")
    path = MEXC_ACCOUNTS_ENDPOINT if MEXC_ACCOUNTS_ENDPOINT.startswith("/") else "/" + MEXC_ACCOUNTS_ENDPOINT
    url = base + path
    try:
        resp = requests.get(url, headers=trading_api_headers(), timeout=timeout)
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException as e:
        logger.warning("[MexcAccounts] Request failed %s: %s", url, e)
        return None
    except ValueError as e:
        logger.warning("[MexcAccounts] Invalid JSON from %s: %s", url, e)
        return None

    if not payload.get("success"):
        logger.warning("[MexcAccounts] API error: %s", payload.get("message", "Unknown"))
        return None

    accounts = payload.get("accounts", [])
    return accounts if isinstance(accounts, list) else []


def fetch_mexc_accounts(timeout: int = 10) -> Optional[List[Dict[str, Any]]]:
    """Cached wrapper."""
    return _accounts_cache.get(lambda: _fetch_mexc_accounts_uncached(timeout=timeout))
