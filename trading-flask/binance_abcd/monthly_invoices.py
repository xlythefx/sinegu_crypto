"""Automatic monthly invoicing — the 1st of every month, 23:00 GMT+8.

The engine owns only the WHEN. At the configured moment it:

1. refreshes every tradeable account's balance from the exchange — the
   invoice's high-water-mark test reads the LIVE balance + unrealized P&L, so
   it should be minutes old, not a poll old;
2. POSTs ``/api/engine/{exchange}/invoices/monthly`` with the month that just
   ended. Laravel's InvoiceService computes every fee (the same call Admin →
   Invoice Testing makes) and SKIPS any account already invoiced for that
   month, so a retry or a catch-up can never overwrite a manual fee;
3. reports the outcome to the PRIVATE admin chat — customer names and dollar
   amounts, so it is sent only when an admin chat id is configured, never via
   the public-channel fallback.

State lives in ``out/invoice_state.json`` (``{exchange: "YYYY-MM"}``), the
same shape of rule the recap scheduler follows:

* A missing state file is a FIRST RUN: a month whose firing time has already
  passed is recorded without billing, so deploying on the 15th does not
  suddenly invoice everyone for last month. A firing time still ahead (deploy
  before 23:00 on the 1st) runs normally.
* A run the engine was down for is still made within
  MONTHLY_INVOICE_CATCHUP_HOURS; past that it is marked and the admin chat is
  told to invoice by hand.
* "Could not reach the API" is retried every RETRY_SECONDS; a definite answer
  (2xx, or a 4xx refusal) is final for that month.

Nothing here raises into the engine: a broken invoice schedule must never stop
trading.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from datetime import date, datetime, timedelta
from typing import Any, Optional

from binance_abcd import hooks, notify
from binance_abcd.http_client import get_session

log = logging.getLogger(__name__)

STATE_FILE = hooks.OUT_DIR / "invoice_state.json"

# Venues with a P&L source in the API (InvoiceService::canInvoice). Adding one
# is a line here once the API can price it.
INVOICED_EXCHANGES: tuple[str, ...] = ("binance",)

# Between attempts at an unreachable API, so a dead API costs one balance
# refresh per ten minutes rather than one a minute.
RETRY_SECONDS = 600.0

_next_attempt = 0.0
_status: dict[str, Any] = {"enabled": False}


# --- Pure schedule math ----------------------------------------------------------

def parse_clock(raw: str) -> tuple[int, int]:
    hh, mm = raw.strip().split(":")
    hour, minute = int(hh), int(mm)
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"bad time {raw!r}")
    return hour, minute


def fire_time(now: datetime, day: int, hour: int, minute: int) -> datetime:
    """This month's firing moment, in `now`'s timezone."""
    return now.replace(day=day, hour=hour, minute=minute, second=0, microsecond=0)


def next_fire(now: datetime, day: int, hour: int, minute: int) -> datetime:
    fire = fire_time(now, day, hour, minute)
    if fire > now:
        return fire
    first_next = (now.replace(day=1) + timedelta(days=32)).replace(day=1)
    return fire_time(first_next, day, hour, minute)


def billing_month(fire: datetime) -> str:
    """The month that ended before this firing: firing in October bills September."""
    previous = date(fire.year, fire.month, 1) - timedelta(days=1)
    return previous.strftime("%Y-%m")


# --- State ---------------------------------------------------------------------------

def _load_state() -> dict:
    try:
        parsed = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as exc:  # noqa: BLE001 - a truncated file is "empty", not a crash
        log.warning("[invoices] state unreadable (%s) — treating as empty", exc)
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _save_state(state: dict) -> None:
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        log.warning("[invoices] could not write state: %s", exc)


# --- Side effects ----------------------------------------------------------------------

def _refresh_balances() -> None:
    """Best effort: a failed refresh leaves the last poll (≤ 5 min old) in place."""
    try:
        from binance_abcd.fetch_balances import fetch_and_save  # deferred: pulls in accounts

        fetch_and_save(None)
    except Exception as exc:  # noqa: BLE001
        log.warning("[invoices] balance refresh before invoicing failed: %s", exc)


def request_invoices(exchange: str, month: str) -> tuple[str, Optional[dict]]:
    """('ok', body) on 2xx, ('refused', body) on a 4xx answer, ('retry', None)
    when the API could not be reached or failed on its side."""
    try:
        response = get_session().post(
            hooks.engine_url("invoices/monthly", exchange),
            json={"month_year": month},
            headers=hooks.engine_headers(),
            timeout=hooks.MONTHLY_INVOICE_API_TIMEOUT,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("[invoices] %s %s: API unreachable: %s", exchange, month, exc)
        return "retry", None
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text[:300]}
    if response.ok and isinstance(body, dict) and body.get("success"):
        return "ok", body
    if 400 <= response.status_code < 500:
        return "refused", body if isinstance(body, dict) else {"raw": str(body)}
    log.warning("[invoices] %s %s: API HTTP %s", exchange, month, response.status_code)
    return "retry", None


# --- Runner ------------------------------------------------------------------------------

def run_once(tzinfo, now: Optional[datetime] = None, *, monotonic: Optional[float] = None) -> None:
    """One tick: invoice last month on every venue that has not been, if due."""
    global _next_attempt
    now = now or datetime.now(tzinfo)
    clock = time.monotonic() if monotonic is None else monotonic
    hour, minute = parse_clock(hooks.MONTHLY_INVOICE_AT)
    fire = fire_time(now, hooks.MONTHLY_INVOICE_DAY, hour, minute)
    if now < fire:
        return
    month = billing_month(fire)

    first_run = not STATE_FILE.exists()
    state = _load_state()
    pending = [ex for ex in INVOICED_EXCHANGES if state.get(ex) != month]
    if not pending:
        return

    if first_run:
        # Deployed after this month's firing time: record it, bill nothing.
        for ex in pending:
            state[ex] = month
        _save_state(state)
        log.info("[invoices] first run — %s recorded as done without billing (fired %s)", month, fire.isoformat())
        return

    late_hours = (now - fire).total_seconds() / 3600
    if late_hours > hooks.MONTHLY_INVOICE_CATCHUP_HOURS:
        for ex in pending:
            state[ex] = month
        _save_state(state)
        log.error("[invoices] %s missed — %.1fh late (limit %.1fh)", month, late_hours, hooks.MONTHLY_INVOICE_CATCHUP_HOURS)
        notify.notify_monthly_invoices_missed(month, late_hours)
        return

    if clock < _next_attempt:
        return
    _next_attempt = clock + RETRY_SECONDS

    _refresh_balances()
    changed = False
    for ex in pending:
        outcome, body = request_invoices(ex, month)
        if outcome == "retry":
            continue  # unmarked: the next attempt in RETRY_SECONDS tries again
        state[ex] = month
        changed = True
        if outcome == "ok":
            totals = (body or {}).get("totals") or {}
            log.info("[invoices] %s %s: %s", ex, month, totals)
            notify.notify_monthly_invoices(month, ex, body or {})
        else:
            log.error("[invoices] %s %s refused: %s", ex, month, body)
            notify.notify_monthly_invoices_refused(month, ex, body or {})
    if changed:
        _save_state(state)


def _loop(tzinfo, shutdown: threading.Event) -> None:
    while not shutdown.is_set():
        try:
            run_once(tzinfo)
        except Exception:  # noqa: BLE001 - the scheduler must never die
            log.exception("[invoices] tick failed")
        if shutdown.wait(hooks.MONTHLY_INVOICE_TICK_SECONDS):
            break


def monthly_invoices_status() -> dict:
    """What /health shows: whether it is on and when it next fires."""
    tzinfo = _status.get("tz")
    if not _status.get("enabled") or tzinfo is None:
        return {"enabled": False}
    hour, minute = parse_clock(hooks.MONTHLY_INVOICE_AT)
    now = datetime.now(tzinfo)
    fire = next_fire(now, hooks.MONTHLY_INVOICE_DAY, hour, minute)
    return {
        "enabled": True,
        "timezone": hooks.MONTHLY_INVOICE_TIMEZONE,
        "next": fire.isoformat(),
        "bills_month": billing_month(fire),
        "last_billed": _load_state(),
    }


def start_monthly_invoices(shutdown: threading.Event) -> Optional[threading.Thread]:
    """Start the scheduler; None (never raises) when off or misconfigured."""
    if not hooks.MONTHLY_INVOICE_ENABLED:
        log.info("[invoices] monthly invoicing disabled (BINANCE_ABCD_MONTHLY_INVOICE_ENABLED=false)")
        return None
    try:
        from zoneinfo import ZoneInfo

        tzinfo = ZoneInfo(hooks.MONTHLY_INVOICE_TIMEZONE)
        parse_clock(hooks.MONTHLY_INVOICE_AT)
        if not 1 <= hooks.MONTHLY_INVOICE_DAY <= 28:
            raise ValueError(f"MONTHLY_INVOICE_DAY must be 1-28, got {hooks.MONTHLY_INVOICE_DAY}")
    except Exception as exc:  # noqa: BLE001
        log.error("[invoices] monthly invoicing OFF — bad config: %s", exc)
        notify.notify_error("monthly invoicing disabled", str(exc))
        return None

    _status.update(enabled=True, tz=tzinfo)
    thread = threading.Thread(target=_loop, args=(tzinfo, shutdown), name="monthly-invoices", daemon=True)
    thread.start()
    log.info("[invoices] scheduled: day %s at %s %s — next %s",
             hooks.MONTHLY_INVOICE_DAY, hooks.MONTHLY_INVOICE_AT, hooks.MONTHLY_INVOICE_TIMEZONE,
             monthly_invoices_status().get("next"))
    return thread
