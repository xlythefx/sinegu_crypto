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

# The only parts of a failed answer that may reach the log. An engine-API body
# can echo what was posted, and the /accounts one carries every api_key and
# secret_key in clear — a raw slice of it in the journal is a key leak.
_LOGGABLE_KEYS = ("error", "error_code", "message")


def error_fields(body: Any) -> str:
    """``error`` / ``error_code`` / ``message`` off a JSON body as ``k=v``
    pairs, or an empty string. Nothing else of the body is ever rendered."""
    if not isinstance(body, dict):
        return ""
    return " ".join(
        f"{key}={str(body[key])[:200]}"
        for key in _LOGGABLE_KEYS
        if isinstance(body.get(key), (str, int, float)) and not isinstance(body.get(key), bool)
    )


def _describe(response: Any, body: Any) -> str:
    """Status, size and the loggable fields — never the body itself."""
    try:
        size = len(response.content)
    except Exception:  # noqa: BLE001 - a log line must never be the failure
        size = "?"
    fields = error_fields(body)
    return f"HTTP {response.status_code}, {size} bytes" + (f", {fields}" if fields else "")


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
        try:
            body = response.json()
        except ValueError:
            body = None
        log.warning("engine API %s %s failed: %s", method, label, _describe(response, body))
        return None

    try:
        data = response.json()
    except ValueError:
        log.warning("engine API %s %s returned non-JSON", method, label)
        return None

    if not isinstance(data, dict) or not data.get("success"):
        log.warning("engine API %s %s unsuccessful payload: %s", method, label, _describe(response, data))
        return None

    return data


def get_json(path: str, params: dict | None = None, *, exchange: str | None = None) -> dict[str, Any] | None:
    return _request("GET", path, params=params, exchange=exchange)


def post_json(path: str, payload: dict, *, exchange: str | None = None) -> dict[str, Any] | None:
    return _request("POST", path, payload=payload, exchange=exchange)


def delete_json(path: str, payload: dict, *, exchange: str | None = None) -> dict[str, Any] | None:
    return _request("DELETE", path, payload=payload, exchange=exchange)
