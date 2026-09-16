"""Per-(exchange, api_key, symbol) locks for the trade path.

Held across stack-check -> order -> position write-through so two overlapping
signals for the same account+symbol serialize instead of both reading the
pre-trade position and jointly blowing past the max_increments cap (the
reference engine's known race).
"""

from __future__ import annotations

import threading

_REGISTRY_LOCK = threading.Lock()
_LOCKS: dict[tuple[str, str, str], threading.Lock] = {}


def lock_for(api_key: str, symbol: str, exchange: str = "binance") -> threading.Lock:
    key = (exchange, api_key, symbol.upper())
    with _REGISTRY_LOCK:
        lock = _LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            _LOCKS[key] = lock
        return lock
