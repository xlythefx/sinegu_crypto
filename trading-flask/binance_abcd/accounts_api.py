"""Tradeable accounts from sinegutrade-api, TTL-cached.

The backend does all the gating (enabled, not deleted, not sandbox, owner not
suspended) — whatever this returns is safe to trade. An account with demo=1
signs against the Binance futures testnet instead of mainnet.
"""

from __future__ import annotations

import logging

from binance_abcd import engine_client
from binance_abcd.cache import TTLCache
from binance_abcd.hooks import ACCOUNTS_CACHE_TTL, BINANCE_API_BASE, BINANCE_TESTNET_API_BASE

log = logging.getLogger(__name__)


def _load_accounts() -> list[dict] | None:
    data = engine_client.get_json("accounts")
    if data is None:
        return None
    accounts = data.get("accounts")
    if not isinstance(accounts, list):
        log.warning("accounts payload malformed: %.200s", data)
        return None
    return [a for a in accounts if a.get("api_key") and a.get("secret_key")]


_cache = TTLCache(ACCOUNTS_CACHE_TTL, _load_accounts)


def fetch_accounts(force: bool = False) -> list[dict]:
    """Every account the engine may trade. Empty list if never fetched."""
    return _cache.get(force=force) or []


def account_futures_base_url(account: dict) -> str:
    """Mainnet, or the testnet base for demo accounts."""
    return BINANCE_TESTNET_API_BASE if account.get("demo") else BINANCE_API_BASE


def accounts_cache_age() -> float | None:
    return _cache.age()


def invalidate_accounts_cache() -> None:
    _cache.invalidate()
