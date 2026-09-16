"""Tradeable accounts from sinegutrade-api, TTL-cached per exchange.

The backend does all the gating (enabled, not deleted, not sandbox, owner not
suspended) — whatever this returns is safe to trade. Each enabled exchange is
loaded from its own route (/engine/{exchange}/accounts) and every row is
stamped with ``exchange`` so the rest of the engine can route reads and writes
back to the same segment. A Binance account with demo=1 signs against the
Binance futures testnet instead of mainnet; see exchanges.tradeable for what
demo means elsewhere.
"""

from __future__ import annotations

import logging
import threading

from binance_abcd import engine_client, exchanges
from binance_abcd.cache import TTLCache
from binance_abcd.hooks import ACCOUNTS_CACHE_TTL, ENGINE_EXCHANGE

log = logging.getLogger(__name__)

_caches: dict[str, TTLCache] = {}
_caches_lock = threading.Lock()


def _loader(exchange: str):
    def _load_accounts() -> list[dict] | None:
        data = engine_client.get_json("accounts", exchange=exchange)
        if data is None:
            return None
        accounts = data.get("accounts")
        if not isinstance(accounts, list):
            log.warning("[%s] accounts payload malformed: %.200s", exchange, data)
            return None
        return [
            dict(a, exchange=exchange)
            for a in accounts
            if a.get("api_key") and a.get("secret_key")
        ]

    return _load_accounts


def _cache_for(exchange: str) -> TTLCache:
    cache = _caches.get(exchange)
    if cache is None:
        with _caches_lock:
            cache = _caches.get(exchange)
            if cache is None:
                cache = TTLCache(ACCOUNTS_CACHE_TTL, _loader(exchange))
                _caches[exchange] = cache
    return cache


def fetch_accounts(force: bool = False, exchange: str | None = None) -> list[dict]:
    """Every account the engine may trade, across every enabled exchange (or
    one exchange when named). Empty list if never fetched."""
    names = (exchange,) if exchange else exchanges.enabled()
    accounts: list[dict] = []
    for name in names:
        accounts.extend(_cache_for(name).get(force=force) or [])
    return accounts


def account_futures_base_url(account: dict) -> str:
    """Mainnet, or the testnet base for demo accounts (Binance); MEXC has one host."""
    return exchanges.base_url_for(account)


def accounts_cache_age(exchange: str = ENGINE_EXCHANGE) -> float | None:
    return _cache_for(exchange).age()


def invalidate_accounts_cache() -> None:
    """Drop every exchange's list — the backend pings this on any account change
    and does not say which exchange moved."""
    for cache in list(_caches.values()):
        cache.invalidate()
