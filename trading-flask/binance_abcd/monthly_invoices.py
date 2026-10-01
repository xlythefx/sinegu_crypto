"""Automatic monthly billing — invoice, two reminders, pause. 16:00 Thailand time.

The engine owns only the WHEN; every rule about money lives in the API. One
clock, four steps (owner, 2026-10-01), all at MONTHLY_INVOICE_AT in
MONTHLY_INVOICE_TIMEZONE:

  day 1  invoice  — refresh every balance, then POST /invoices/monthly for the
                    month that just ended. The API bills each customer through
                    InvoiceService, SKIPS anyone already invoiced (a re-run can
                    never overwrite a manual fee) and emails "invoice ready".
  day 2  gentle   — POST /invoices/remind {stage: gentle}: emails everyone
                    still unpaid.
  day 3  firm     — the same with stage firm: names the pause day.
  day 4  enforce  — POST /invoices/enforce: invoices due today go overdue, those
                    accounts stop trading, the customer is emailed "paused".
                    Paying switches trading back on (InvoiceService::settle).

Each outcome goes to the PRIVATE admin chat only (names and dollars — never
the public-channel fallback).

State lives in ``out/invoice_state.json``: the invoice step under the bare
exchange key (``{"binance": "2026-09"}``, the original shape), the others
under ``"binance:gentle"`` etc. Rules, per step:

* At STARTUP, a missing state file is a first deploy: a step whose time has
  already passed is recorded without running (a deploy mid-month must not
  suddenly bill or pause anyone) and the file is written either way. Never
  decided on a tick — see seed_state() for the 2026-10-01 incident.
* A step the engine was down for still runs within its catch-up window
  (invoice/pause 72 h; reminders 12 h — a stale reminder arriving after the
  pause is wrong, not late). Past it the step is marked and the admin chat is
  told.
* "Could not reach the API" is retried every RETRY_SECONDS; a definite answer
  (2xx, or a 4xx refusal) is final for that month.

Nothing here raises into the engine: a broken billing schedule must never stop
trading.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Optional

from binance_abcd import hooks, notify
from binance_abcd.http_client import get_session

log = logging.getLogger(__name__)

STATE_FILE = hooks.OUT_DIR / "invoice_state.json"

# Venues with a P&L source in the API (InvoiceService::canInvoice). Adding one
# is a line here once the API can price it.
INVOICED_EXCHANGES: tuple[str, ...] = ("binance",)

# Between attempts at an unreachable API, so a dead API costs one call (and,
# for the invoice step, one balance refresh) per ten minutes, not one a minute.
RETRY_SECONDS = 600.0

REMINDER_CATCHUP_HOURS = 12.0


@dataclass(frozen=True)
class Step:
    name: str
    #: Days after MONTHLY_INVOICE_DAY.
    offset: int
    path: str
    #: Extra JSON besides month_year.
    extra: tuple[tuple[str, str], ...] = ()

    def catchup_hours(self) -> float:
        return REMINDER_CATCHUP_HOURS if self.name in ("gentle", "firm") else hooks.MONTHLY_INVOICE_CATCHUP_HOURS

    def state_key(self, exchange: str) -> str:
        # The invoice step keeps the original key so an existing state file reads the same.
        return exchange if self.name == "invoice" else f"{exchange}:{self.name}"


STEPS: tuple[Step, ...] = (
    Step("invoice", 0, "invoices/monthly"),
    Step("gentle", 1, "invoices/remind", (("stage", "gentle"),)),
    Step("firm", 2, "invoices/remind", (("stage", "firm"),)),
    Step("enforce", 3, "invoices/enforce"),
)

_next_attempt: dict[str, float] = {}
_status: dict[str, Any] = {"enabled": False}


# --- Pure schedule math ----------------------------------------------------------

def parse_clock(raw: str) -> tuple[int, int]:
    hh, mm = raw.strip().split(":")
    hour, minute = int(hh), int(mm)
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"bad time {raw!r}")
    return hour, minute


def fire_time(now: datetime, day: int, hour: int, minute: int) -> datetime:
    """This month's firing moment for `day`, in `now`'s timezone."""
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


def call_api(step: Step, exchange: str, month: str) -> tuple[str, Optional[dict]]:
    """('ok', body) on 2xx, ('refused', body) on a 4xx answer, ('retry', None)
    when the API could not be reached or failed on its side."""
    try:
        response = get_session().post(
            hooks.engine_url(step.path, exchange),
            json={"month_year": month, **dict(step.extra)},
            headers=hooks.engine_headers(),
            timeout=hooks.MONTHLY_INVOICE_API_TIMEOUT,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("[invoices] %s %s %s: API unreachable: %s", step.name, exchange, month, exc)
        return "retry", None
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text[:300]}
    if response.ok and isinstance(body, dict) and body.get("success"):
        return "ok", body
    if 400 <= response.status_code < 500:
        return "refused", body if isinstance(body, dict) else {"raw": str(body)}
    log.warning("[invoices] %s %s %s: API HTTP %s", step.name, exchange, month, response.status_code)
    return "retry", None


def _report(step: Step, outcome: str, exchange: str, month: str, body: dict) -> None:
    if outcome == "refused":
        notify.notify_billing_refused(step.name, month, exchange, body)
    elif step.name == "invoice":
        notify.notify_monthly_invoices(month, exchange, body)
        # The public "invoices are out" post (owner, 2026-10-01) — only when
        # someone was actually billed; a month with no fees announces nothing.
        if int((body.get("totals") or {}).get("billed") or 0) > 0:
            notify.notify_billing_announcement(month)
    else:
        notify.notify_billing_step(step.name, month, exchange, body)


# --- Runner ------------------------------------------------------------------------------

def seed_state(tzinfo, now: Optional[datetime] = None) -> None:
    """At STARTUP only: with no state file, record every step whose time has
    already passed as done (a deploy mid-month must not suddenly bill or pause
    anyone) and WRITE the file — even when nothing has passed yet.

    This must never be decided on a tick. On 2026-10-01 it was: the engine
    started at 15:50, wrote no file because nothing was due, and the first tick
    after 16:00 saw "no file + time passed" and recorded September as done
    without billing it.
    """
    if STATE_FILE.exists():
        return
    now = now or datetime.now(tzinfo)
    hour, minute = parse_clock(hooks.MONTHLY_INVOICE_AT)
    state: dict = {}
    for step in STEPS:
        fire = fire_time(now, hooks.MONTHLY_INVOICE_DAY + step.offset, hour, minute)
        if now >= fire:
            for ex in INVOICED_EXCHANGES:
                state[step.state_key(ex)] = billing_month(fire)
            log.info("[invoices] first start — %s for %s recorded without running (was due %s)",
                     step.name, billing_month(fire), fire.isoformat())
    _save_state(state)


def run_once(tzinfo, now: Optional[datetime] = None, *, monotonic: Optional[float] = None) -> None:
    """One tick: run every step that is due and not yet done."""
    now = now or datetime.now(tzinfo)
    clock = time.monotonic() if monotonic is None else monotonic
    hour, minute = parse_clock(hooks.MONTHLY_INVOICE_AT)

    state = _load_state()
    changed = False

    for step in STEPS:
        fire = fire_time(now, hooks.MONTHLY_INVOICE_DAY + step.offset, hour, minute)
        if now < fire:
            continue
        month = billing_month(fire)
        pending = [ex for ex in INVOICED_EXCHANGES if state.get(step.state_key(ex)) != month]
        if not pending:
            continue

        late_hours = (now - fire).total_seconds() / 3600
        if late_hours > step.catchup_hours():
            for ex in pending:
                state[step.state_key(ex)] = month
            changed = True
            log.error("[invoices] %s for %s missed — %.1fh late (limit %.1fh)",
                      step.name, month, late_hours, step.catchup_hours())
            notify.notify_billing_missed(step.name, month, late_hours)
            continue

        if clock < _next_attempt.get(step.name, 0.0):
            continue
        _next_attempt[step.name] = clock + RETRY_SECONDS

        if step.name == "invoice":
            _refresh_balances()
        for ex in pending:
            outcome, body = call_api(step, ex, month)
            if outcome == "retry":
                continue  # unmarked: tried again after RETRY_SECONDS
            state[step.state_key(ex)] = month
            changed = True
            log.info("[invoices] %s %s %s: %s %s", step.name, ex, month, outcome, (body or {}).get("totals"))
            _report(step, outcome, ex, month, body or {})

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
    """What /health shows: whether it is on and when each step next fires."""
    tzinfo = _status.get("tz")
    if not _status.get("enabled") or tzinfo is None:
        return {"enabled": False}
    hour, minute = parse_clock(hooks.MONTHLY_INVOICE_AT)
    now = datetime.now(tzinfo)
    nxt = {s.name: next_fire(now, hooks.MONTHLY_INVOICE_DAY + s.offset, hour, minute).isoformat() for s in STEPS}
    return {
        "enabled": True,
        "timezone": hooks.MONTHLY_INVOICE_TIMEZONE,
        "next": nxt["invoice"],
        "steps": nxt,
        "done": _load_state(),
    }


def start_monthly_invoices(shutdown: threading.Event) -> Optional[threading.Thread]:
    """Start the scheduler; None (never raises) when off or misconfigured."""
    if not hooks.MONTHLY_INVOICE_ENABLED:
        log.info("[invoices] monthly billing disabled (BINANCE_ABCD_MONTHLY_INVOICE_ENABLED=false)")
        return None
    try:
        from zoneinfo import ZoneInfo

        tzinfo = ZoneInfo(hooks.MONTHLY_INVOICE_TIMEZONE)
        parse_clock(hooks.MONTHLY_INVOICE_AT)
        # The pause runs 3 days after the invoice and must stay inside the month.
        if not 1 <= hooks.MONTHLY_INVOICE_DAY <= 25:
            raise ValueError(f"MONTHLY_INVOICE_DAY must be 1-25, got {hooks.MONTHLY_INVOICE_DAY}")
    except Exception as exc:  # noqa: BLE001
        log.error("[invoices] monthly billing OFF — bad config: %s", exc)
        notify.notify_error("monthly billing disabled", str(exc))
        return None

    seed_state(tzinfo)
    _status.update(enabled=True, tz=tzinfo)
    thread = threading.Thread(target=_loop, args=(tzinfo, shutdown), name="monthly-invoices", daemon=True)
    thread.start()
    log.info("[invoices] scheduled at %s %s: %s", hooks.MONTHLY_INVOICE_AT, hooks.MONTHLY_INVOICE_TIMEZONE,
             ", ".join(f"{k} {v}" for k, v in monthly_invoices_status().get("steps", {}).items()))
    return thread
