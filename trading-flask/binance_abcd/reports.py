"""Scheduled performance reports for the public Telegram channel.

Every other message this engine sends is EVENT-driven — a signal filled, an
order was rejected, a poller died. This module is the one thing that posts
because a clock ticked: a daily / weekly / monthly recap of how the strategy
performed, on the schedule configured in ``BINANCE_ABCD_REPORT_*``.

**The numbers come from ``GET /api/public/track-record``, not from a fresh
query.** That is the single most important decision in this file, for two
reasons:

1. *It cannot leak.* The channel is readable by anyone, so a report may contain
   percentages and counts of trades only — never a balance, a USD amount, an
   account count or a name (the same rule as ``/api/public/*`` and the rest of
   ``notify.py``). Deriving the recap from an endpoint that is ALREADY
   world-readable makes that property structural rather than something a future
   edit has to remember.
2. *It cannot disagree with the website.* The landing page's "See every trade,
   verified" section renders the same series. A second implementation of the
   P&L walk would eventually drift, and then the channel and the site would
   publish two different track records for the same month — which is worse than
   publishing neither.

So this module never touches Binance and never touches the DB. It slices that
endpoint's daily series to a window, chains the days in it, and hands a plain
dict to :func:`binance_abcd.notify.notify_report`, which owns every decision
about what the public channel is allowed to say.

Two details worth keeping:

* **Windows are UTC dates, because the series is.** ``closed_at`` is written in
  UTC by ``fetch_past_positions`` and Laravel runs on UTC, so a "day" in the
  series is a UTC day. A report always covers whole, COMPLETED UTC days — never
  the one in progress — so a figure is never revised after it is published.
  At the default 11:30 Asia/Manila (03:30 UTC) the day just ended 3.5 hours
  earlier, which is comfortably past the past-positions poller's backfill.
* **The period return is CHAINED, not summed** — identical to how the endpoint
  computes its own total. It is therefore a time-weighted return: a deposit
  landing mid-week cannot inflate it, because each day's return was already
  measured against that day's own capital.
"""

from __future__ import annotations

import json
import logging
import threading
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, time as dtime, timedelta, timezone
from typing import Any, Optional

from binance_abcd import hooks, notify
from binance_abcd.http_client import get_session

log = logging.getLogger(__name__)

_WEEKDAYS = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}

# Which period of each kind has already been posted, as {kind: 'YYYY-MM-DD'} of
# the firing day. Server-owned state: it is what stops a restart from re-posting
# a recap the channel already has. Module-level so tests can point it elsewhere.
STATE_FILE = hooks.OUT_DIR / "report_state.json"

# How far back last_fire/next_fire will walk looking for a matching day. Only a
# monthly schedule needs more than 7; 400 covers any of them with room to spare.
_SEARCH_DAYS = 400


# --- Schedules ------------------------------------------------------------------

@dataclass(frozen=True)
class Schedule:
    """One configured recap: what kind, and the local day/time it fires."""

    kind: str                       # 'daily' | 'weekly' | 'monthly'
    hour: int
    minute: int
    weekday: Optional[int] = None   # weekly only, 0=Mon .. 6=Sun
    monthday: Optional[Any] = None  # monthly only, 'last' or 1..28

    def describe(self) -> str:
        clock = f"{self.hour:02d}:{self.minute:02d}"
        if self.kind == "weekly":
            name = next(k for k, v in _WEEKDAYS.items() if v == self.weekday)
            return f"weekly {name} {clock}"
        if self.kind == "monthly":
            return f"monthly {self.monthday} {clock}"
        return f"daily {clock}"


def _parse_clock(raw: str) -> tuple[int, int]:
    hour, _, minute = raw.partition(":")
    hour_i, minute_i = int(hour), int(minute)
    if not (0 <= hour_i <= 23 and 0 <= minute_i <= 59):
        raise ValueError(f"time out of range: {raw!r}")
    return hour_i, minute_i


def parse_schedule(kind: str, raw: str) -> Optional[Schedule]:
    """Parse one ``BINANCE_ABCD_REPORT_*_AT`` value. None when empty (disabled);
    raises ValueError on anything malformed, which the caller downgrades to a
    logged + alerted skip rather than a failure to start."""
    text = (raw or "").strip().lower()
    if not text:
        return None
    parts = text.split()

    if kind == "daily":
        if len(parts) != 1:
            raise ValueError(f"daily wants 'HH:MM', got {raw!r}")
        hour, minute = _parse_clock(parts[0])
        return Schedule("daily", hour, minute)

    if len(parts) != 2:
        raise ValueError(f"{kind} wants '<anchor> HH:MM', got {raw!r}")
    anchor, clock = parts
    hour, minute = _parse_clock(clock)

    if kind == "weekly":
        weekday = _WEEKDAYS.get(anchor[:3])
        if weekday is None:
            raise ValueError(f"weekly wants a weekday (mon..sun), got {anchor!r}")
        return Schedule("weekly", hour, minute, weekday=weekday)

    if kind == "monthly":
        if anchor == "last":
            return Schedule("monthly", hour, minute, monthday="last")
        day = int(anchor)
        # Capped at 28, not 31: a schedule on the 30th would silently never fire
        # in February, and a recap that skips a month without saying so is the
        # kind of bug nobody reports. Use 'last' for end-of-month.
        if not 1 <= day <= 28:
            raise ValueError(f"monthly wants 'last' or a day 1-28, got {anchor!r}")
        return Schedule("monthly", hour, minute, monthday=day)

    raise ValueError(f"unknown report kind {kind!r}")


def load_schedules() -> tuple[list[Schedule], list[str]]:
    """Every configured schedule, plus a message per one that could not be read."""
    configured = [
        ("daily", hooks.REPORT_DAILY_AT),
        ("weekly", hooks.REPORT_WEEKLY_AT),
        ("monthly", hooks.REPORT_MONTHLY_AT),
    ]
    schedules: list[Schedule] = []
    errors: list[str] = []
    for kind, raw in configured:
        try:
            schedule = parse_schedule(kind, raw)
        except ValueError as exc:
            errors.append(f"{kind}: {exc}")
            continue
        if schedule:
            schedules.append(schedule)
    return schedules, errors


def _matches(schedule: Schedule, day: date) -> bool:
    if schedule.kind == "daily":
        return True
    if schedule.kind == "weekly":
        return day.weekday() == schedule.weekday
    if schedule.monthday == "last":
        return day.day == monthrange(day.year, day.month)[1]
    return day.day == schedule.monthday


def _at(schedule: Schedule, day: date, tzinfo) -> datetime:
    return datetime.combine(day, dtime(schedule.hour, schedule.minute), tzinfo=tzinfo)


def last_fire(schedule: Schedule, now: datetime) -> Optional[datetime]:
    """The most recent instant this schedule should have fired at, at or before
    `now`. None if nothing matched inside the search window."""
    for back in range(_SEARCH_DAYS):
        day = now.date() - timedelta(days=back)
        if not _matches(schedule, day):
            continue
        fire = _at(schedule, day, now.tzinfo)
        if fire <= now:
            return fire
    return None


def next_fire(schedule: Schedule, now: datetime) -> Optional[datetime]:
    """The next instant this schedule fires after `now` — for /health only."""
    for ahead in range(_SEARCH_DAYS):
        day = now.date() + timedelta(days=ahead)
        if not _matches(schedule, day):
            continue
        fire = _at(schedule, day, now.tzinfo)
        if fire > now:
            return fire
    return None


# --- Window + summary -------------------------------------------------------------

def period_window(schedule: Schedule, fire_utc: datetime) -> tuple[str, str]:
    """The inclusive UTC date range a firing covers, as ISO strings.

    It always ends on the last COMPLETED UTC day — the day containing `fire_utc`
    is still in progress, and a published percentage must never be revised.

    The consequence for a ``monthly last`` schedule is deliberate and visible in
    the message: firing on the last day of the month at 11:30 Manila is 03:30
    UTC that same day, so the month's final ~20 hours fall outside the window
    and the recap reads e.g. "1 - 29 Sep". Move the schedule to ``1 HH:MM`` to
    report whole calendar months instead.
    """
    end = fire_utc.date() - timedelta(days=1)
    if schedule.kind == "daily":
        start = end
    elif schedule.kind == "weekly":
        start = end - timedelta(days=6)
    else:
        start = end.replace(day=1)
    return start.isoformat(), end.isoformat()


def _as_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def summarize(series: list, start: str, end: str) -> dict:
    """Roll the track record's daily points up over [start, end] (ISO dates,
    which compare correctly as strings).

    `return_pct` chains the days rather than adding them, matching the endpoint's
    own total exactly — see the module docstring. It is None, not 0, when the
    window holds no priced day: "no trades closed" and "closed flat" are
    different statements and the channel should not conflate them.
    """
    points = sorted(
        (p for p in series if isinstance(p, dict) and p.get("date")),
        key=lambda p: str(p["date"]),
    )
    window = [p for p in points if start <= str(p["date"]) <= end]

    growth = 1.0
    percents: list[float] = []
    trades = 0
    for point in window:
        percent = _as_float(point.get("pct"))
        if percent is None:
            continue
        percents.append(percent)
        # Floored at 0 for the same reason the endpoint floors it: a day that
        # loses more than the whole account must not compound into a negative
        # factor and flip the sign of everything after it.
        growth *= max(0.0, 1 + percent / 100)
        count = _as_float(point.get("trades"))
        trades += int(count) if count else 0

    # All-time as of the END of the window, never as of today — a monthly recap
    # posted late must still read as it would have on the day it covers.
    prior = [p for p in points if str(p["date"]) <= end]
    all_time = _as_float(prior[-1].get("cumulative")) if prior else None

    return {
        "start": start,
        "end": end,
        "return_pct": (growth - 1) * 100 if percents else None,
        "trading_days": len(percents),
        "winning_days": sum(1 for p in percents if p > 0),
        "losing_days": sum(1 for p in percents if p < 0),
        "trades": trades,
        "best_pct": max(percents) if percents else None,
        "worst_pct": min(percents) if percents else None,
        "all_time_pct": all_time,
    }


# --- Track record source ----------------------------------------------------------

def fetch_track_record() -> Optional[dict]:
    """The published track record, or None when it could not be read.

    None means "unavailable", never "nothing happened" — the caller leaves the
    period unmarked and retries, exactly like the pollers' rule that an empty
    read and a failed read are different answers.
    """
    url = hooks.public_url("track-record")
    try:
        response = get_session().get(
            url, timeout=hooks.ENGINE_API_TIMEOUT, headers={"Accept": "application/json"}
        )
    except Exception as exc:  # noqa: BLE001 - a report must never raise
        log.warning("[reports] track record request failed: %s", exc)
        return None
    if not response.ok:
        log.warning("[reports] track record -> HTTP %s", response.status_code)
        return None
    try:
        data = response.json()
    except ValueError:
        log.warning("[reports] track record returned non-JSON")
        return None
    return data if isinstance(data, dict) else None


# --- State ------------------------------------------------------------------------

def _load_state() -> dict:
    try:
        raw = STATE_FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except Exception as exc:  # noqa: BLE001
        log.warning("[reports] state unreadable (%s) — treating as empty", exc)
        return {}
    try:
        parsed = json.loads(raw)
    except ValueError:
        log.warning("[reports] state is not valid JSON — treating as empty")
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _save_state(state: dict) -> None:
    try:
        STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        log.warning("[reports] could not write state: %s", exc)


# --- Runner -------------------------------------------------------------------------

def _publish(schedule: Schedule, fire: datetime) -> bool:
    """Post one recap. False means "could not, try again" — the period stays
    unmarked so the next tick retries it inside the catch-up window."""
    payload = fetch_track_record()
    if payload is None:
        log.warning("[reports] %s deferred — track record unavailable", schedule.kind)
        return False
    if not payload.get("available"):
        # Nothing is published yet (no master account, or no closed trades). Not
        # a transient failure, so mark it done rather than retrying all window.
        log.info("[reports] %s skipped — no track record published yet", schedule.kind)
        return True

    start, end = period_window(schedule, fire.astimezone(timezone.utc))
    summary = summarize(payload.get("series") or [], start, end)
    notify.notify_report(schedule.kind, summary)
    log.info(
        "[reports] posted %s for %s..%s (%s trading days, %s trades)",
        schedule.kind, start, end, summary["trading_days"], summary["trades"],
    )
    return True


def run_once(schedules: list[Schedule], tzinfo, now: Optional[datetime] = None) -> None:
    """One scheduler tick: post whatever is due and not yet posted."""
    now = now or datetime.now(tzinfo)
    # A missing state file is a FIRST RUN, and every period already in the past
    # is seeded as sent without posting. Otherwise the first deploy immediately
    # fires a daily, a weekly and a monthly recap at once — the same rule
    # pixel-telegram uses so a deploy doesn't announce itself as news.
    first_run = not STATE_FILE.exists()
    state = _load_state()
    changed = False

    for schedule in schedules:
        fire = last_fire(schedule, now)
        if fire is None:
            continue
        key = fire.date().isoformat()
        if state.get(schedule.kind) == key:
            continue

        if first_run:
            log.info("[reports] seeding %s at %s (first run — not posting)", schedule.kind, key)
            state[schedule.kind] = key
            changed = True
            continue

        late_hours = (now - fire).total_seconds() / 3600
        if late_hours > hooks.REPORT_CATCHUP_HOURS:
            log.warning(
                "[reports] skipping %s %s — %.1fh late (catch-up limit %.1fh)",
                schedule.kind, key, late_hours, hooks.REPORT_CATCHUP_HOURS,
            )
            state[schedule.kind] = key
            changed = True
            continue

        if _publish(schedule, fire):
            state[schedule.kind] = key
            changed = True

    if changed:
        _save_state(state)


def _loop(schedules: list[Schedule], tzinfo, shutdown: threading.Event) -> None:
    while not shutdown.is_set():
        try:
            run_once(schedules, tzinfo)
        except Exception:  # noqa: BLE001 - the reporter must never die
            log.exception("[reports] tick failed")
        if shutdown.wait(hooks.REPORT_TICK_SECONDS):
            break


_status: dict[str, Any] = {"enabled": False, "schedules": []}


def reports_status() -> dict:
    """What /health shows: the configured schedules and when each next fires."""
    tzinfo = _status.get("tz")
    schedules = _status.get("schedules") or []
    if not tzinfo or not schedules:
        return {"enabled": bool(_status.get("enabled")), "schedules": []}
    now = datetime.now(tzinfo)
    return {
        "enabled": True,
        "timezone": hooks.REPORT_TIMEZONE,
        "schedules": [
            {
                "kind": s.kind,
                "at": s.describe(),
                "next": (lambda f: f.isoformat() if f else None)(next_fire(s, now)),
            }
            for s in schedules
        ],
    }


def start_reporter(shutdown: threading.Event) -> Optional[threading.Thread]:
    """Start the recap scheduler. Returns None (and never raises) when reports
    are off or misconfigured — the engine's job is trading, and a broken recap
    schedule must not keep it from starting."""
    if not hooks.REPORT_ENABLED:
        log.info("[reports] disabled (BINANCE_ABCD_REPORT_ENABLED=false)")
        return None

    try:
        from zoneinfo import ZoneInfo

        tzinfo = ZoneInfo(hooks.REPORT_TIMEZONE)
    except Exception as exc:  # noqa: BLE001 - includes ZoneInfoNotFoundError
        # On Windows there is no system tz database, so this is what a missing
        # `tzdata` package looks like (it is in requirements.txt for that reason).
        log.error("[reports] unusable timezone %r: %s — reports off", hooks.REPORT_TIMEZONE, exc)
        notify.notify_error("scheduled reports disabled", f"timezone {hooks.REPORT_TIMEZONE!r}: {exc}")
        return None

    schedules, errors = load_schedules()
    for message in errors:
        log.error("[reports] ignoring schedule — %s", message)
        notify.notify_error("report schedule ignored", message)
    if not schedules:
        log.warning("[reports] nothing scheduled")
        return None

    _status.update(enabled=True, schedules=schedules, tz=tzinfo)
    thread = threading.Thread(
        target=_loop, args=(schedules, tzinfo, shutdown), name="reporter", daemon=True
    )
    thread.start()
    log.info(
        "[reports] scheduled (%s): %s",
        hooks.REPORT_TIMEZONE, ", ".join(s.describe() for s in schedules),
    )
    return thread
