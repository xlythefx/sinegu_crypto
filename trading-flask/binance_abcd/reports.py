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

**One recap per exchange.** The channel labels every entry and exit with its
venue (`LTCUSDT · Binance`), so the recap is read per venue too: each firing
fetches ``track-record/{exchange}`` for every exchange in ``EXCHANGES`` and
posts one message per exchange that has a published record. An exchange the
master has no real account on answers ``available: false`` and posts nothing
— a "No trades closed" for a venue nobody trades would be noise. State is
kept per (kind, exchange), so one venue's failed fetch retries alone.

Two details worth keeping:

* **Windows are calendar days in the SERIES' timezone, ending TODAY.** The
  endpoint buckets its days in a configured reporting zone (Asia/Manila on
  prod) and says which in ``payload["timezone"]``; the window is cut in that
  same calendar, so "16 Sep" in the channel is the same set of trades as
  "16 Sep" on the landing page. The daily is the local day the schedule fires
  in — a recap at 23:30 is "today", which is what the audience asked for —
  the weekly is the seven days ending today, the monthly runs from the 1st.
  The trade-off is stated, not hidden: a close AFTER the firing time lands on
  the site and in the weekly/monthly, but no daily ever names it. Fire as late
  in the day as the past-positions backfill (~3 min) and the endpoint's 5-min
  cache allow; ``23:55`` is about the latest that is still honest.
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

from binance_abcd import exchanges, hooks, notify
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

def series_timezone(payload: dict):
    """The tzinfo the track record's days are bucketed in, from its own
    ``timezone`` field. UTC when the field is missing (an API older than this
    engine) or names a zone this box cannot resolve — the same calendar the
    endpoint used before it published one, so the window still lines up."""
    name = str(payload.get("timezone") or "").strip()
    if not name:
        return timezone.utc
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo(name)
    except Exception as exc:  # noqa: BLE001 - includes ZoneInfoNotFoundError
        log.warning("[reports] series timezone %r unusable (%s) — assuming UTC", name, exc)
        return timezone.utc


def period_window(schedule: Schedule, fire: datetime, tzinfo=timezone.utc) -> tuple[str, str]:
    """The inclusive date range a firing covers, as ISO strings, in the
    calendar the series is bucketed in (`tzinfo`, from :func:`series_timezone`).

    Every window ends on the day the schedule fires in — TODAY, locally. The
    daily is that one day; the weekly is the seven days ending on it; the
    monthly runs from the 1st to it, so ``monthly last`` covers the whole
    calendar month and reads "1 - 30 Sep". A ``monthly <1-28>`` schedule is
    therefore month-to-date, not the previous month.
    """
    end = fire.astimezone(tzinfo).date()
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
        "assets": rank_assets(window),
    }


def rank_assets(window: list) -> list[dict]:
    """The window's symbols ranked by their share of its return, best first.

    Every series point carries `assets`: each symbol's realized P&L over the
    SAME capital the day's own `pct` is measured on, so within one day the
    shares add up to the day's return exactly. Across several days they are
    SUMMED here, not chained — a symbol has no capital of its own to compound —
    so on a multi-day window the ranking is an attribution that does not
    reconcile to the chained period return. That is why ``notify_report``
    publishes it on the daily recap only.

    Empty, never None, on a payload predating the field: an engine newer than
    the API posts the recap without the ranking rather than not at all.
    """
    by_symbol: dict[str, dict] = {}
    for point in window:
        for asset in point.get("assets") or []:
            if not isinstance(asset, dict):
                continue
            symbol = str(asset.get("symbol") or "").strip()
            share = _as_float(asset.get("pct"))
            if not symbol or share is None:
                continue
            entry = by_symbol.setdefault(symbol, {"symbol": symbol, "pct": 0.0, "trades": 0})
            entry["pct"] += share
            count = _as_float(asset.get("trades"))
            entry["trades"] += int(count) if count else 0
    return sorted(by_symbol.values(), key=lambda a: (-a["pct"], a["symbol"]))


# --- Track record source ----------------------------------------------------------

def fetch_track_record(exchange: Optional[str] = None) -> Optional[dict]:
    """The published track record — one exchange's slice when `exchange` is
    given, the pooled record otherwise — or None when it could not be read.

    None means "unavailable", never "nothing happened" — the caller leaves the
    period unmarked and retries, exactly like the pollers' rule that an empty
    read and a failed read are different answers.
    """
    url = hooks.public_url(f"track-record/{exchange}" if exchange else "track-record")
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

def _publish(schedule: Schedule, fire: datetime, exchange: str) -> bool:
    """Post one exchange's recap. False means "could not, try again" — the
    period stays unmarked so the next tick retries it inside the catch-up window."""
    payload = fetch_track_record(exchange)
    if payload is None:
        log.warning("[reports] %s/%s deferred — track record unavailable", schedule.kind, exchange)
        return False
    if not payload.get("available"):
        # Nothing is published for this exchange yet (the master has no real
        # account there, or no closed trades). Not a transient failure, so mark
        # it done rather than retrying all window — and post nothing: a channel
        # recap for a venue with no record would be noise, not a report.
        log.info("[reports] %s/%s skipped — no track record published yet", schedule.kind, exchange)
        return True

    start, end = period_window(schedule, fire, series_timezone(payload))
    summary = summarize(payload.get("series") or [], start, end)
    notify.notify_report(schedule.kind, summary, exchange=exchanges.label(exchange))
    log.info(
        "[reports] posted %s/%s for %s..%s (%s trading days, %s trades)",
        schedule.kind, exchange, start, end, summary["trading_days"], summary["trades"],
    )
    return True


def _marked(state: dict, kind: str, exchange: str) -> Optional[str]:
    """The firing day already handled for (kind, exchange). State is
    ``{kind: {exchange: 'YYYY-MM-DD'}}``; a bare string under `kind` is the
    pre-per-exchange file and counts for every exchange, so an upgrade neither
    re-posts nor drops a period."""
    entry = state.get(kind)
    if isinstance(entry, dict):
        return entry.get(exchange)
    return entry if isinstance(entry, str) else None


def _mark(state: dict, kind: str, exchange: str, key: str) -> None:
    entry = state.get(kind)
    if not isinstance(entry, dict):
        # Promote the legacy string: every exchange inherits it, then this one moves on.
        entry = {name: entry for name in exchanges.enabled()} if isinstance(entry, str) else {}
        state[kind] = entry
    entry[exchange] = key


def run_once(schedules: list[Schedule], tzinfo, now: Optional[datetime] = None) -> None:
    """One scheduler tick: post whatever is due and not yet posted — one recap
    per (schedule, exchange), since the channel labels every entry and exit
    with its venue and the recap has to be readable the same way."""
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

        for exchange in exchanges.enabled():
            if _marked(state, schedule.kind, exchange) == key:
                continue

            if first_run:
                log.info("[reports] seeding %s/%s at %s (first run — not posting)", schedule.kind, exchange, key)
                _mark(state, schedule.kind, exchange, key)
                changed = True
                continue

            late_hours = (now - fire).total_seconds() / 3600
            if late_hours > hooks.REPORT_CATCHUP_HOURS:
                log.warning(
                    "[reports] skipping %s/%s %s — %.1fh late (catch-up limit %.1fh)",
                    schedule.kind, exchange, key, late_hours, hooks.REPORT_CATCHUP_HOURS,
                )
                _mark(state, schedule.kind, exchange, key)
                changed = True
                continue

            if _publish(schedule, fire, exchange):
                _mark(state, schedule.kind, exchange, key)
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


# --- Preview (CLI + admin endpoint) --------------------------------------------------

KINDS = ("daily", "weekly", "monthly")


class PreviewUnavailable(ValueError):
    """The requested recap cannot be rendered here (schedule disabled, bad kind)."""


def preview(kind: str, now: Optional[datetime] = None, on: Optional[date] = None) -> list[str]:
    """Build the `kind` recap for the window that would apply if it fired
    right now — or at its scheduled time on the day `on` — and send it to the
    ADMIN chat with a test banner, one per enabled exchange with a published
    record. Nothing reaches the public channel and the state file is
    untouched, so the real scheduled post is unaffected. Returns the rendered
    texts (for stdout / the admin page).

    ``python -m binance_abcd.reports preview daily [YYYY-MM-DD]``, and the
    Bot Engine admin page through ``POST /admin/reports/preview``.
    """
    from zoneinfo import ZoneInfo

    if kind not in KINDS:
        raise PreviewUnavailable(f"kind must be one of {', '.join(KINDS)}")
    schedule = parse_schedule(kind, {
        "daily": hooks.REPORT_DAILY_AT,
        "weekly": hooks.REPORT_WEEKLY_AT,
        "monthly": hooks.REPORT_MONTHLY_AT,
    }[kind])
    if schedule is None:
        raise PreviewUnavailable(
            f"{kind} recap is disabled (empty BINANCE_ABCD_REPORT_{kind.upper()}_AT)"
        )
    tzinfo = ZoneInfo(hooks.REPORT_TIMEZONE)
    if on is not None:
        now = _at(schedule, on, tzinfo)
    now = now or datetime.now(tzinfo)

    rendered: list[str] = []
    for exchange in exchanges.enabled():
        payload = fetch_track_record(exchange)
        if payload is None:
            log.warning("[reports] preview %s/%s — track record unavailable", kind, exchange)
            continue
        if not payload.get("available"):
            log.info("[reports] preview %s/%s — no track record published", kind, exchange)
            continue
        start, end = period_window(schedule, now, series_timezone(payload))
        summary = summarize(payload.get("series") or [], start, end)
        rendered.append(notify.preview_report(kind, summary, exchange=exchanges.label(exchange)))
    return rendered


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    args = sys.argv[1:]
    usage = "usage: python -m binance_abcd.reports preview <daily|weekly|monthly> [YYYY-MM-DD]"
    if len(args) not in (2, 3) or args[0] != "preview" or args[1] not in ("daily", "weekly", "monthly"):
        raise SystemExit(usage)
    try:
        on_day = date.fromisoformat(args[2]) if len(args) == 3 else None
    except ValueError:
        raise SystemExit(usage) from None
    try:
        texts = preview(args[1], on=on_day)
    except PreviewUnavailable as exc:
        raise SystemExit(str(exc)) from None
    for text in texts:
        print(text, end="\n\n")
    if not texts:
        print("(nothing to preview — no exchange has a published track record)")
    # The sender is fire-and-forget on a pool; a one-shot process has to wait
    # for it or the message dies with the interpreter.
    notify._executor.shutdown(wait=True)
