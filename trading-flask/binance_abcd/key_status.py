"""Detect and report API keys the exchange refuses for THIS server.

The failure this exists for is Binance error -2015 — "Invalid API-key, IP, or
permissions for action" — which is what a key restricted to someone's home IP
says when our server uses it. It is invisible from the user's side: the account
looks connected, the dashboard shows a balance that never updates, and the
account silently receives no trades.

Two rules make the report trustworthy:

- **Only the exchange decides.** A credential verdict comes from an error code
  Binance returned, never from a timeout, a 5xx, or a rate limit — those say
  nothing about the key and must never disconnect anyone.
- **Any successful signed call clears it.** That is how a user who whitelists
  our IP gets un-flagged without asking anyone: the next poller tick succeeds
  and the flag is gone. Which is also why the backend keeps handing blocked
  accounts to the pollers — an account we stop probing can never recover.

Reports are deduplicated per key, so a poller finding the same broken key every
five minutes costs one POST, not one per tick.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional, Tuple

from binance_abcd import engine_client

log = logging.getLogger(__name__)

# Binance error codes that mean "these credentials cannot be used from here".
# Everything else (rate limits, -1021 timestamp drift, order rejections) is a
# transient or unrelated fault and must NOT flag the account.
CREDENTIAL_CODES = {
    -2015: "IP_OR_PERMISSION",   # invalid key, IP not allow-listed, or missing permission
    -2014: "BAD_KEY_FORMAT",     # API-key format invalid
    -2008: "UNKNOWN_KEY",        # invalid Api-Key ID
    -1022: "BAD_SIGNATURE",      # signature mismatch — wrong secret
}

# api_key -> last state we told the backend ("blocked:<code>" | "ok").
_reported: dict[str, str] = {}
_lock = threading.Lock()


def classify(parsed: Optional[dict]) -> Optional[Tuple[int, str, str]]:
    """(code, reason, message) when this is a credential rejection, else None."""
    if not isinstance(parsed, dict):
        return None
    code = parsed.get("code")
    if not isinstance(code, int) or code not in CREDENTIAL_CODES:
        return None
    return code, CREDENTIAL_CODES[code], str(parsed.get("msg") or "")[:250]


def report_blocked(api_key: str, code: int, reason: str, message: str) -> None:
    if not api_key:
        return
    state = f"blocked:{code}"
    with _lock:
        if _reported.get(api_key) == state:
            return
        _reported[api_key] = state

    log.error("[keys] %s… refused by Binance (%s %s)", api_key[:6], code, reason)
    _post({
        "api_key": api_key,
        "status": "blocked",
        "code": str(code),
        "reason": reason,
        "message": message,
    })


def report_ok(api_key: str) -> None:
    """A signed, account-scoped call succeeded — the key works from here."""
    if not api_key:
        return
    with _lock:
        # Nothing to say unless we previously said it was broken. A fresh
        # process has no memory, so the first success reports ok once and then
        # stays quiet; the backend treats a repeat as a no-op anyway.
        if _reported.get(api_key) == "ok":
            return
        first_time = api_key not in _reported
        _reported[api_key] = "ok"

    if not first_time:
        log.info("[keys] %s… works again", api_key[:6])
    _post({"api_key": api_key, "status": "ok"})


def _post(payload: dict) -> None:
    try:
        engine_client.post_json("key-status", payload)
    except Exception as exc:  # noqa: BLE001 - reporting must never break trading
        log.warning("[keys] could not report status: %s", exc)


def reset() -> None:
    """Test hook — forget what has been reported."""
    with _lock:
        _reported.clear()
