"""One pooled requests.Session for the whole process.

All engine-API and Binance traffic shares this session so connections are
reused across the fan-out workers and pollers instead of a TCP+TLS handshake
per call. Pool size follows BINANCE_ABCD_HTTP_POOL_MAXSIZE (>= fan-out workers).
"""

from __future__ import annotations

import certifi
import requests
from requests.adapters import HTTPAdapter

from binance_abcd.hooks import HTTP_POOL_MAXSIZE

_session: requests.Session | None = None


def get_session() -> requests.Session:
    global _session
    if _session is None:
        session = requests.Session()
        adapter = HTTPAdapter(
            pool_connections=HTTP_POOL_MAXSIZE,
            pool_maxsize=HTTP_POOL_MAXSIZE,
            max_retries=0,
        )
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        session.verify = certifi.where()
        _session = session
    return _session
