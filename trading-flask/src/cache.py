"""Thread-safe in-memory TTL cache for accounts and assets lookups."""

import threading
import time
from typing import Any, Callable, Optional


class TTLCache:
    def __init__(self, ttl_seconds: int):
        self._ttl = max(0, int(ttl_seconds))
        self._value: Any = None
        self._expires_at: float = 0.0
        self._fetched_at: float = 0.0
        self._lock = threading.Lock()

    def get(self, loader: Callable[[], Any]) -> Any:
        now = time.monotonic()
        with self._lock:
            if self._value is not None and now < self._expires_at:
                return self._value
        # Load outside the lock to avoid blocking concurrent readers
        value = loader()
        if value is None:
            # Loader failed — keep previous value if any, but don't extend expiry
            with self._lock:
                return self._value
        with self._lock:
            self._value = value
            self._fetched_at = time.monotonic()
            self._expires_at = self._fetched_at + self._ttl
            return self._value

    def invalidate(self) -> None:
        with self._lock:
            self._value = None
            self._expires_at = 0.0
            self._fetched_at = 0.0

    def age_seconds(self) -> Optional[float]:
        with self._lock:
            if self._value is None or self._fetched_at == 0.0:
                return None
            return time.monotonic() - self._fetched_at

    def ttl(self) -> int:
        return self._ttl

    def set_ttl(self, ttl_seconds: int) -> None:
        with self._lock:
            self._ttl = max(0, int(ttl_seconds))
