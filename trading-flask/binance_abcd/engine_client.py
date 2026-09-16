"""Thin HTTP client for the sinegutrade-api engine endpoints.

Every call attaches the X-Engine-Secret header and returns the parsed JSON
dict on success or ``None`` on any failure (network error, non-2xx, bad JSON).
Callers treat ``None`` as "backend unavailable" — they log, fall back, or skip;
nothing in the trade path ever raises because Laravel hiccuped.

Every endpoint lives under /engine/{exchange}/, and the exchange decides which
tables the API reads and writes. ``exchange`` defaults to Binance so callers
that predate MEXC are unchanged; anything acting for a specific account must
pass that account's exchange, or a MEXC position lands in the Binance table.
"""

from __future__ import annotations

import logging
from typing import Any

from binance_abcd.hooks import ENGINE_API_TIMEOUT, engine_headers, engine_url
from binance_abcd.http_client import get_session

log = logging.getLogger(__name__)


def _request(
    method: str,
    path: str,
    *,
    params: dict | None = None,
    payload: dict | None = None,
    exchange: str | None = None,
) -> dict[str, Any] | None:
    url = engine_url(path, exchange)
    label = f"{exchange or 'binance'}/{path}"
    try:
        response = get_session().request(
            method,
            url,
            params=params,
            json=payload,
            headers=engine_headers(),
            timeout=ENGINE_API_TIMEOUT,
        )
    except Exception as exc:  # noqa: BLE001 - network failures must not propagate
        log.warning("engine API %s %s failed: %s", method, label, exc)
        return None

    if not response.ok:
        log.warning("engine API %s %s -> HTTP %s: %.300s", method, label, response.status_code, response.text)
        return None

    try:
        data = response.json()
    except ValueError:
        log.warning("engine API %s %s returned non-JSON", method, label)
        return None

    if not isinstance(data, dict) or not data.get("success"):
        log.warning("engine API %s %s unsuccessful payload: %.300s", method, label, data)
        return None

    return data


def get_json(path: str, params: dict | None = None, *, exchange: str | None = None) -> dict[str, Any] | None:
    return _request("GET", path, params=params, exchange=exchange)


def post_json(path: str, payload: dict, *, exchange: str | None = None) -> dict[str, Any] | None:
    return _request("POST", path, payload=payload, exchange=exchange)


def delete_json(path: str, payload: dict, *, exchange: str | None = None) -> dict[str, Any] | None:
    return _request("DELETE", path, payload=payload, exchange=exchange)
