"""Detect and report API keys the exchange refuses for THIS server.

The failure this exists for is Binance error -2015 — "Invalid API-key, IP, or
permissions for action" — which is what a key restricted to someone's home IP
says when our server uses it. It is invisible from the user's side: the account
looks connected, the dashboard shows a balance that never updates, and the
account silently receives no trades. MEXC has the same failure under its own
codes (406 "Accessing IP is not in the whitelist", 402 "API Key expired" — keys
without IP binding expire after 90 days there).

Three rules make the report trustworthy:

- **Only the exchange decides.** A credential verdict comes from an error code
  the exchange returned, never from a timeout, a 5xx, or a rate limit — those
  say nothing about the key and must never disconnect anyone.
- **A success clears only what it PROVES.** A signed GET proves the key can
  read; it says nothing about whether it may trade, and on every venue those
  are two separate permissions. So a read success clears a verdict raised on a
  read — which is how a user who whitelists our IP un-flags themselves without
  asking anyone — but never one raised on a refused order. Until 2026-09-23 any
  success cleared everything, and a real customer key with Reading enabled and
  Futures NOT enabled therefore flapped: flagged by the refused order, cleared
  by the poller 90 seconds later, so the account read "connected" with a live
  balance and silently took no trades for a day.
- **An ambiguous code is sharpened by what we already know.** Binance answers
  -2015 for three different faults (bad key / IP not allow-listed / permission
  missing). When a signed READ has succeeded on the same key, the IP is
  demonstrably allowed and the key demonstrably exists, so a refused WRITE can
  only be the missing futures permission — reported as TRADE_PERMISSION, which
  is the one reading the customer can act on.

Reports are deduplicated per (exchange, key), so a poller finding the same
broken key every five minutes costs one POST, not one per tick, and they go to
that exchange's own /engine/{exchange}/key-status.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from typing import Optional, Tuple

from binance_abcd import engine_client

log = logging.getLogger(__name__)

# What a signed call proves about the credentials. Reads and trading are
# separate permissions everywhere, so a verdict carries the scope it was
# reached in and is only cleared by a success in that scope (or a wider one).
READ = "read"
TRADE = "trade"

# Per exchange: the error codes that mean "these credentials cannot be used
# from here". Everything else (rate limits, timestamp drift, order rejections)
# is a transient or unrelated fault and must NOT flag the account.
CREDENTIAL_CODES: dict[str, dict[int, str]] = {
    "binance": {
        -2015: "IP_OR_PERMISSION",   # invalid key, IP not allow-listed, or missing permission
        -2014: "BAD_KEY_FORMAT",     # API-key format invalid
        -2008: "UNKNOWN_KEY",        # invalid Api-Key ID
        -1022: "BAD_SIGNATURE",      # signature mismatch — wrong secret
    },
    "mexc": {
        401: "NOT_LOGGED_IN",        # "Not logged in or login has expired" — the key is not recognised
        402: "KEY_EXPIRED",          # keys without IP binding expire after 90 days
        406: "IP_NOT_WHITELISTED",   # our server's IP is not on the key's allow-list
        602: "BAD_SIGNATURE",        # "Confirming signature failed" — wrong secret
        701: "PERMISSION_READ",      # the key lacks a permission the call needs
        702: "PERMISSION_WRITE",
        703: "PERMISSION_TRADE_READ",
        704: "PERMISSION_TRADE_WRITE",
    },
    # Bybit V5. Deliberately EXCLUDED, each for a reason a test pins:
    #   10002 "request expired" — our clock drifted outside recv_window. A fault
    #         on OUR box (Binance's -1021 twin); flagging it would start a 3-day
    #         disconnect clock on every account whenever prod's NTP slips.
    #   10006/10018 rate limits — say nothing about the key.
    #   10007/10008/10028 — their meanings are not settled enough to disconnect
    #         a working account over. Left out until a real refusal is seen.
    "bybit": {
        10003: "UNKNOWN_KEY",        # "API key is invalid" — deleted or mistyped
        10004: "BAD_SIGNATURE",      # "error sign" — the secret does not match
        10005: "PERMISSION_DENIED",  # permission denied, WITHOUT naming which one
        10009: "IP_BANNED",          # our egress IP is banned at Bybit — ours to fix
        10010: "IP_NOT_WHITELISTED", # "unmatched IP" — not on the key's bound list
        33004: "KEY_EXPIRED",        # a Bybit key with no IP bound expires at 90 days
    },
}

_LABEL = {"binance": "Binance", "mexc": "MEXC", "bybit": "Bybit"}

# Codes that do not say WHICH credential fault they are, and the reason they
# collapse to once a signed read has proved the key and the IP are fine.
# MEXC needs no entry: 406 (IP), 402 (expired) and 701-704 (permissions) each
# name their own fault already.
#
# Bybit sits between the two. It is PRECISE about the IP (10010), the key
# (10003), the secret (10004) and expiry (33004) — and then collapses every
# permission fault into a single 10005, which is Binance's -2015 problem in
# miniature. So it gets one entry, and the existing machinery does the rest: a
# read success sets read_ok and sharpens the verdict, and a refused READ clears
# that proof so it downgrades back.
_AMBIGUOUS: dict[tuple[str, int], str] = {
    ("binance", -2015): "TRADE_PERMISSION",
    ("bybit", 10005): "TRADE_PERMISSION",
}


@dataclass
class _KeyState:
    """What we last told the backend about one key, and what we have proved."""

    reported: Optional[str] = None      # "ok" | "blocked:<code>:<reason>"
    read_ok: bool = False               # a signed READ has succeeded
    blocked_scope: Optional[str] = None # scope of the verdict currently standing


_states: dict[tuple[str, str], _KeyState] = {}
_lock = threading.Lock()


def classify(parsed: Optional[dict], exchange: str = "binance") -> Optional[Tuple[int, str, str]]:
    """(code, reason, message) when this is a credential rejection, else None.
    Binance bodies say ``msg``, MEXC bodies say ``message``."""
    if not isinstance(parsed, dict):
        return None
    code = parsed.get("code")
    codes = CREDENTIAL_CODES.get(exchange, {})
    if not isinstance(code, int) or isinstance(code, bool) or code not in codes:
        return None
    message = parsed.get("msg") if parsed.get("msg") is not None else parsed.get("message")
    return code, codes[code], str(message or "")[:250]


def report_blocked(
    api_key: str,
    code: int,
    reason: str,
    message: str,
    exchange: str = "binance",
    scope: str = TRADE,
) -> None:
    """The exchange refused these credentials. `scope` is what was being
    attempted — TRADE for a refused order, READ for a refused account read."""
    if not api_key:
        return
    with _lock:
        state = _states.setdefault((exchange, api_key), _KeyState())
        if scope == READ:
            # Reads are failing too, so this is the key or the IP — not a
            # permission that only bites on orders. Forget the earlier proof.
            state.read_ok = False
        elif state.read_ok:
            reason = _AMBIGUOUS.get((exchange, code), reason)
        state.blocked_scope = scope
        # The reason is part of the identity: the same -2015 sharpening into
        # TRADE_PERMISSION is a different thing to tell the customer.
        wanted = f"blocked:{code}:{reason}"
        if state.reported == wanted:
            return
        state.reported = wanted

    log.error("[keys] %s… refused by %s (%s %s)", api_key[:6], _LABEL.get(exchange, exchange), code, reason)
    _post({
        "api_key": api_key,
        "status": "blocked",
        "code": str(code),
        "reason": reason,
        "message": message,
    }, exchange)


def report_ok(api_key: str, exchange: str = "binance", scope: str = READ) -> None:
    """A signed, account-scoped call succeeded — the key works from here FOR
    THAT SCOPE. A read never clears a verdict an order earned (see module doc)."""
    if not api_key:
        return
    with _lock:
        state = _states.setdefault((exchange, api_key), _KeyState())
        if scope == READ:
            state.read_ok = True
            if state.blocked_scope == TRADE:
                return
        state.blocked_scope = None
        # Nothing to say unless we previously said it was broken. A fresh
        # process has no memory, so the first success reports ok once and then
        # stays quiet; the backend treats a repeat as a no-op anyway.
        if state.reported == "ok":
            return
        first_time = state.reported is None
        state.reported = "ok"

    if not first_time:
        log.info("[keys] %s… works again on %s", api_key[:6], _LABEL.get(exchange, exchange))
    _post({"api_key": api_key, "status": "ok"}, exchange)


def _post(payload: dict, exchange: str) -> None:
    try:
        engine_client.post_json("key-status", payload, exchange=exchange)
    except Exception as exc:  # noqa: BLE001 - reporting must never break trading
        log.warning("[keys] could not report status: %s", exc)


def reset() -> None:
    """Test hook — forget what has been reported."""
    with _lock:
        _states.clear()


# --- What a human should do about it -----------------------------------------

# Per exchange, in the venue's own words: what the customer has to change. The
# ops alert carries this because "Invalid API-key, IP, or permissions" names
# three possible faults and no fix, and whoever reads the alert has to tell a
# customer something actionable.
FIXES: dict[str, dict[str, str]] = {
    "binance": {
        "TRADE_PERMISSION": (
            'the key can read but may not trade — tick "Enable Futures" on it '
            "(Binance → API Management → edit key)"
        ),
        "IP_OR_PERMISSION": (
            'add our server IP under "Restrict access to trusted IPs" and tick '
            '"Enable Futures"'
        ),
        "BAD_KEY_FORMAT": "the key is not a valid Binance key — reconnect with a fresh one",
        "UNKNOWN_KEY": "the key was deleted or regenerated on Binance — reconnect with a fresh one",
        "BAD_SIGNATURE": "the secret does not match the key — reconnect with a fresh pair",
    },
    "mexc": {
        "IP_NOT_WHITELISTED": 'bind our server IP under "Link IP address"',
        "KEY_EXPIRED": "the key expired (MEXC keys with no IP bound last 90 days) — reconnect a fresh, IP-bound one",
        "NOT_LOGGED_IN": "MEXC no longer recognises the key — reconnect with a fresh one",
        "BAD_SIGNATURE": "the secret does not match the key — reconnect with a fresh pair",
        "PERMISSION_READ": "tick Futures → Read on the key",
        "PERMISSION_WRITE": "tick Futures → Trade on the key",
        "PERMISSION_TRADE_READ": "tick Futures → Read on the key",
        "PERMISSION_TRADE_WRITE": "tick Futures → Trade on the key (and finish KYC — MEXC needs it for futures API trading)",
    },
    "bybit": {
        "TRADE_PERMISSION": (
            'the key can read but may not trade — tick "Unified Trading → Trade" '
            "on it (Bybit → API → edit the key)"
        ),
        "PERMISSION_DENIED": (
            'the key is missing a permission — tick "Unified Trading → Trade" '
            '(on a classic account: "Contract → Orders, Positions")'
        ),
        "IP_NOT_WHITELISTED": (
            'add our server IP to the key\'s allow-list (Bybit → API → edit key → '
            '"Only IPs with permissions granted have access")'
        ),
        # The only fix on this screen the CUSTOMER cannot perform — say so, or
        # whoever reads the alert sends them to edit a key that is fine.
        "IP_BANNED": "Bybit has banned our server's IP — ours to fix, not the customer's",
        "KEY_EXPIRED": "the key expired (a Bybit key with no IP bound lasts 90 days) — reconnect a fresh, IP-bound one",
        "UNKNOWN_KEY": "Bybit no longer recognises the key — reconnect with a fresh one",
        "BAD_SIGNATURE": "the secret does not match the key — reconnect with a fresh pair",
    },
}


def fix_for(error_text: str, exchange: str = "binance") -> Optional[str]:
    """The one-line fix for a credential rejection, recognised from the error
    text the fan-out recorded. None when the failure is not a credential fault
    — an order rejection or an outage has no key to fix.

    Matched on the venue's own message rather than a code because that is all
    the fan-out keeps per account; the reading is deliberately conservative, as
    a wrong fix sends a customer to edit a key that was never the problem.
    """
    text = (error_text or "").lower()
    if not text:
        return None
    fixes = FIXES.get(exchange, {})
    if exchange == "binance":
        if "invalid api-key" in text or "-2015" in text:
            # The fan-out only has Binance's sentence, which does not say which
            # of the three faults it was. Name both halves of the fix.
            return fixes.get("IP_OR_PERMISSION")
        if "api-key format" in text or "-2014" in text:
            return fixes.get("BAD_KEY_FORMAT")
        if "signature" in text or "-1022" in text:
            return fixes.get("BAD_SIGNATURE")
    elif exchange == "mexc":
        if "whitelist" in text:
            return fixes.get("IP_NOT_WHITELISTED")
        if "expired" in text:
            return fixes.get("KEY_EXPIRED")
        if "signature" in text:
            return fixes.get("BAD_SIGNATURE")
        if "permission" in text:
            return fixes.get("PERMISSION_TRADE_WRITE")
    elif exchange == "bybit":
        # Most specific first, and note two Bybit-only traps: its message for a
        # bad secret is "error sign", which does NOT contain "signature"; and
        # "API key is invalid" has to be tested before anything looser, or the
        # dead-key case falls through to the permission one.
        if "unmatched ip" in text or "10010" in text:
            return fixes.get("IP_NOT_WHITELISTED")
        if "banned" in text or "10009" in text:
            return fixes.get("IP_BANNED")
        if "expired" in text or "33004" in text:
            return fixes.get("KEY_EXPIRED")
        if "sign" in text or "10004" in text:
            return fixes.get("BAD_SIGNATURE")
        if "api key is invalid" in text or "10003" in text:
            return fixes.get("UNKNOWN_KEY")
        if "permission" in text or "10005" in text:
            return fixes.get("PERMISSION_DENIED")
    return None
