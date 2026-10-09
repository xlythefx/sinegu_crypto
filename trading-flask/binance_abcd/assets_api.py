"""Enabled tradeable assets from sinegutrade-api, TTL-cached per exchange.

Asset rows carry the sizing config: base_size (one increment), the stack cap,
and side (ALL | LONG | SHORT — which entry directions are allowed). Entries
FAIL CLOSED: no asset row, or a disabled one, means the entry is rejected.
Exits never consult assets.

Assets are PER EXCHANGE: each venue's rows carry its own ``assets.broker``
label (Binance / MEXC — see exchanges.SPECS) and are fetched from its own
route, so a ticker enabled on Binance says nothing about MEXC. ``base_size`` is
in COINS on every exchange; the MEXC adapter converts to contracts at the edge.

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
import threading

from binance_abcd import engine_client, exchanges
from binance_abcd.cache import TTLCache
from binance_abcd.hooks import ASSETS_CACHE_TTL, ENGINE_EXCHANGE

log = logging.getLogger(__name__)

ASSETS_BROKER = exchanges.spec(ENGINE_EXCHANGE).assets_broker

_caches: dict[str, TTLCache] = {}
_caches_lock = threading.Lock()


def _loader(exchange: str):
    broker = exchanges.spec(exchange).assets_broker

    def _load_assets() -> dict[str, dict] | None:
        data = engine_client.get_json("assets", params={"broker": broker}, exchange=exchange)
        if data is None:
            return None
        assets = data.get("assets")
        if not isinstance(assets, list):
            log.warning("[%s] assets payload malformed: %.200s", exchange, data)
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
                "loss_sizes": _loss_ladder(asset),
            }
        return by_ticker

    return _load_assets


def _loss_ladder(asset: dict) -> dict[int, float]:
    """The asset's loss-streak ladder as ``{losses: size}`` — empty = feature off.

    Empty when the switch is off, when an older API sends no ladder at all, or
    when every step is unusable; the entry path then sizes exactly as before
    and makes no streak read. A malformed step is dropped rather than failing
    the whole asset list: one bad row must not stop every ticker trading.
    """
    if not asset.get("loss_sizing_enabled"):
        return {}
    ladder: dict[int, float] = {}
    for step in asset.get("loss_sizes") or []:
        try:
            losses = int(step.get("losses"))
            size = float(step.get("size"))
        except (AttributeError, TypeError, ValueError):
            continue
        if 1 <= losses <= 10 and size > 0:
            ladder[losses] = size
    return dict(sorted(ladder.items()))


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


def _cache_for(exchange: str) -> TTLCache:
    cache = _caches.get(exchange)
    if cache is None:
        with _caches_lock:
            cache = _caches.get(exchange)
            if cache is None:
                cache = TTLCache(ASSETS_CACHE_TTL, _loader(exchange))
                _caches[exchange] = cache
    return cache


def fetch_assets(force: bool = False, exchange: str = ENGINE_EXCHANGE) -> dict[str, dict]:
    """Enabled assets keyed by upper-case ticker, for one exchange. Empty dict if never fetched."""
    return _cache_for(exchange).get(force=force) or {}


def get_asset(ticker: str, exchange: str = ENGINE_EXCHANGE) -> dict | None:
    return fetch_assets(exchange=exchange).get(ticker.upper())


def assets_cache_age(exchange: str = ENGINE_EXCHANGE) -> float | None:
    return _cache_for(exchange).age()


def invalidate_assets_cache() -> None:
    """Drop every exchange's list — an asset write pings this without saying
    which broker's row changed."""
    for cache in list(_caches.values()):
        cache.invalidate()
