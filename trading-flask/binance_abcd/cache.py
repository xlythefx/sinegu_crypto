"""TTL cache with single-flight refresh and stale-on-failure fallback.

Improvements over the reference implementation:
- single-flight: when the value expires, exactly one thread runs the loader;
  concurrent callers wait for it instead of stampeding the backend.
- stale-on-failure: a loader failure (exception or ``None``) serves the last
  good value instead of nothing, so a Laravel blip never blanks the account
  list mid-signal.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Callable


class TTLCache:
    def __init__(self, ttl_seconds: float, loader: Callable[[], Any]):
        self._ttl = ttl_seconds
        self._loader = loader
        self._lock = threading.Lock()
        self._value: Any = None
        self._loaded_at: float | None = None

    def get(self, force: bool = False) -> Any:
        with self._lock:
            if not force and self._fresh():
                return self._value

            # This thread holds the lock while refreshing: concurrent callers
            # block briefly and then read the value it produced (single-flight).
            try:
                fresh = self._loader()
            except Exception:  # noqa: BLE001 - loader failures serve stale
                fresh = None

            if fresh is not None:
                self._value = fresh
                self._loaded_at = time.monotonic()
            return self._value

    def _fresh(self) -> bool:
        return self._loaded_at is not None and (time.monotonic() - self._loaded_at) < self._ttl

    def age(self) -> float | None:
        """Seconds since the last successful load, or None if never loaded."""
        with self._lock:
            return None if self._loaded_at is None else time.monotonic() - self._loaded_at

    def invalidate(self) -> None:
        with self._lock:
            self._loaded_at = None
