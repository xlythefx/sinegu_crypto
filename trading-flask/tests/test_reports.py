"""Scheduled daily/weekly/monthly recaps (binance_abcd.reports + notify_report).

No network: the track record fetch is monkeypatched and Telegram is captured.
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from binance_abcd import hooks, notify, reports

MANILA = ZoneInfo("Asia/Manila")


def _now(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=MANILA)


@pytest.fixture()
def sent(monkeypatch):
    """Capture what reaches the channel instead of posting it."""
    messages: list[str] = []
    monkeypatch.setattr(notify, "_send", lambda text, chat_id=None: messages.append(text))
    return messages


@pytest.fixture()
def schedules():
    """The configured production schedules: daily 11:30, Friday 11:30, last-of-month 11:30."""
    return [
        reports.parse_schedule("daily", "11:30"),
        reports.parse_schedule("weekly", "fri 11:30"),
        reports.parse_schedule("monthly", "last 11:30"),
    ]


# --- Schedule parsing --------------------------------------------------------

def test_parses_the_configured_schedules(schedules):
    daily, weekly, monthly = schedules
    assert (daily.kind, daily.hour, daily.minute) == ("daily", 11, 30)
    assert (weekly.weekday, weekly.hour) == (4, 11)  # 4 = Friday
    assert monthly.monthday == "last"


def test_empty_value_disables_a_report():
    assert reports.parse_schedule("daily", "") is None
    assert reports.parse_schedule("weekly", "   ") is None


@pytest.mark.parametrize("kind,raw", [
    ("daily", "25:00"),
    ("daily", "fri 11:30"),
    ("weekly", "11:30"),
    ("weekly", "funday 11:30"),
    ("monthly", "31 11:30"),   # would silently never fire in February
    ("monthly", "0 11:30"),
])
def test_malformed_schedules_are_rejected(kind, raw):
    with pytest.raises(ValueError):
        reports.parse_schedule(kind, raw)


def test_a_bad_schedule_is_reported_not_raised(monkeypatch):
    """A typo in a recap time must not stop the engine from trading."""
    monkeypatch.setattr(hooks, "REPORT_DAILY_AT", "11:30")
    monkeypatch.setattr(hooks, "REPORT_WEEKLY_AT", "someday 11:30")
    monkeypatch.setattr(hooks, "REPORT_MONTHLY_AT", "")
    schedules, errors = reports.load_schedules()
    assert [s.kind for s in schedules] == ["daily"]
    assert len(errors) == 1 and "weekly" in errors[0]


# --- Firing times ------------------------------------------------------------

def test_last_fire_picks_todays_time_once_it_has_passed(schedules):
    daily = schedules[0]
    assert reports.last_fire(daily, _now("2026-09-07T11:29")).date().isoformat() == "2026-09-06"
    assert reports.last_fire(daily, _now("2026-09-07T11:30")).date().isoformat() == "2026-09-07"


def test_weekly_fires_on_friday_only(schedules):
    weekly = schedules[1]
    # 2026-09-07 is a Monday; the last Friday before it is 2026-09-04.
    assert reports.last_fire(weekly, _now("2026-09-07T12:00")).date().isoformat() == "2026-09-04"
    assert reports.next_fire(weekly, _now("2026-09-07T12:00")).date().isoformat() == "2026-09-11"


def test_monthly_last_resolves_per_month_length(schedules):
    monthly = schedules[2]
    assert reports.last_fire(monthly, _now("2026-10-05T09:00")).date().isoformat() == "2026-09-30"
    # February, and a leap year: 29 days, found without a hardcoded table.
    assert reports.last_fire(monthly, _now("2028-03-01T09:00")).date().isoformat() == "2028-02-29"


# --- Windows -----------------------------------------------------------------

def test_windows_end_on_the_last_completed_utc_day(schedules):
    daily, weekly, monthly = schedules
    fire = _now("2026-09-07T11:30").astimezone(timezone.utc)  # 03:30 UTC 2026-09-07
    assert reports.period_window(daily, fire) == ("2026-09-06", "2026-09-06")
    assert reports.period_window(weekly, fire) == ("2026-08-31", "2026-09-06")
    assert reports.period_window(monthly, fire) == ("2026-09-01", "2026-09-06")


def test_monthly_on_the_last_day_stops_short_of_it(schedules):
    """Documented consequence of firing on the last day at 11:30 local: the UTC
    month is not over yet, so its final day is not in the window."""
    monthly = schedules[2]
    fire = _now("2026-09-30T11:30").astimezone(timezone.utc)
    assert reports.period_window(monthly, fire) == ("2026-09-01", "2026-09-29")


def test_monthly_on_the_first_covers_the_whole_month():
    """The alternative schedule: '1 11:30' reports a complete calendar month."""
    monthly = reports.parse_schedule("monthly", "1 11:30")
    fire = _now("2026-10-01T11:30").astimezone(timezone.utc)
    assert reports.period_window(monthly, fire) == ("2026-09-01", "2026-09-30")


# --- Summarising the series ---------------------------------------------------

SERIES = [
    {"date": "2026-09-03", "pct": 5.0, "cumulative": 5.0, "trades": 4},
    {"date": "2026-09-04", "pct": 10.0, "cumulative": 15.5, "trades": 6},
    {"date": "2026-09-05", "pct": -2.0, "cumulative": 13.19, "trades": 3},
    {"date": "2026-09-06", "pct": 1.0, "cumulative": 14.32, "trades": 2},
]


def test_period_return_is_chained_not_summed():
    """1.10 x 0.98 x 1.01 = 1.08878 -> +8.878%, where summing would say +9%."""
    summary = reports.summarize(SERIES, "2026-09-04", "2026-09-06")
    assert summary["return_pct"] == pytest.approx(8.878, abs=1e-9)
    assert summary["trading_days"] == 3
    assert summary["winning_days"] == 2
    assert summary["losing_days"] == 1
    assert summary["trades"] == 11
    assert summary["best_pct"] == 10.0
    assert summary["worst_pct"] == -2.0


def test_all_time_is_taken_as_of_the_window_end_not_today():
    """A recap posted late still reads as it would have on the day it covers."""
    summary = reports.summarize(SERIES, "2026-09-04", "2026-09-04")
    assert summary["all_time_pct"] == 15.5


def test_an_empty_window_is_none_not_zero():
    summary = reports.summarize(SERIES, "2026-09-10", "2026-09-10")
    assert summary["return_pct"] is None
    assert summary["trading_days"] == 0
    assert summary["trades"] == 0
    # All-time still known — it is the last point at or before the window end.
    assert summary["all_time_pct"] == 14.32


def test_unparseable_points_are_skipped_not_crashed():
    series = SERIES + [{"date": "2026-09-07", "pct": None, "cumulative": None}, "junk"]
    summary = reports.summarize(series, "2026-09-03", "2026-09-07")
    assert summary["trading_days"] == 4


# --- Message ------------------------------------------------------------------

def test_daily_message_carries_only_percentages_and_trade_counts(sent):
    notify.notify_report("daily", reports.summarize(SERIES, "2026-09-06", "2026-09-06"))
    (text,) = sent
    assert "Daily Report — 6 Sep 2026" in text
    assert "Return: <b>+1.000%</b>" in text
    assert "Trades closed: 2" in text
    assert "All-time: +14.320%" in text
    # A single day has no spread to report, and never a count of accounts.
    assert "Best day" not in text
    assert "Trading days" not in text


def test_weekly_message_adds_the_day_breakdown(sent):
    notify.notify_report("weekly", reports.summarize(SERIES, "2026-08-31", "2026-09-06"))
    (text,) = sent
    assert "Weekly Report — 31 Aug - 6 Sep 2026" in text
    assert "Trading days: 4 (3 up / 1 down)" in text
    assert "Best day: +10.000% · Worst day: -2.000%" in text
    assert "Trades closed: 15" in text


def test_monthly_message_names_a_partial_month_range(sent):
    notify.notify_report("monthly", reports.summarize(SERIES, "2026-09-01", "2026-09-29"))
    (text,) = sent
    assert "Monthly Report — 1 - 29 Sep 2026" in text


def test_a_quiet_period_says_so_rather_than_publishing_zero(sent):
    notify.notify_report("daily", reports.summarize(SERIES, "2026-09-10", "2026-09-10"))
    (text,) = sent
    assert "No trades closed." in text
    assert "Return:" not in text


def test_no_report_ever_names_an_account_or_an_amount(sent):
    """The structural guarantee: the summary comes from /api/public/track-record,
    so there is no private field available to print even by mistake."""
    for kind in ("daily", "weekly", "monthly"):
        notify.notify_report(kind, reports.summarize(SERIES, "2026-09-03", "2026-09-06"))
    blob = "\n".join(sent)
    for forbidden in ("USDT", "$", "account", "uni_id", "balance"):
        assert forbidden not in blob


# --- Runner -------------------------------------------------------------------

@pytest.fixture()
def track_record(monkeypatch):
    """Serve a canned track record; the list lets a test make it unavailable."""
    payload = {"success": True, "available": True, "series": SERIES}
    box = {"payload": payload}
    monkeypatch.setattr(reports, "fetch_track_record", lambda: box["payload"])
    return box


def test_first_run_seeds_silently(schedules, track_record, sent):
    """A deploy must not immediately fire a daily, a weekly and a monthly."""
    reports.run_once(schedules, MANILA, _now("2026-09-07T12:00"))
    assert sent == []
    state = json.loads(reports.STATE_FILE.read_text("utf-8"))
    assert state == {"daily": "2026-09-07", "weekly": "2026-09-04", "monthly": "2026-08-31"}


def test_the_next_due_period_posts_once(schedules, track_record, sent):
    reports.run_once(schedules, MANILA, _now("2026-09-07T12:00"))   # seed
    reports.run_once(schedules, MANILA, _now("2026-09-08T11:31"))   # daily due
    assert len(sent) == 1 and "Daily Report" in sent[0]

    reports.run_once(schedules, MANILA, _now("2026-09-08T11:32"))   # same period
    assert len(sent) == 1


def test_a_missed_report_is_caught_up_inside_the_window(schedules, track_record, sent, monkeypatch):
    monkeypatch.setattr(hooks, "REPORT_CATCHUP_HOURS", 12.0)
    reports.run_once(schedules, MANILA, _now("2026-09-07T12:00"))
    reports.run_once(schedules, MANILA, _now("2026-09-08T20:00"))  # 8.5h late
    assert len(sent) == 1


def test_a_stale_report_is_dropped_not_posted_late(schedules, track_record, sent, monkeypatch):
    monkeypatch.setattr(hooks, "REPORT_CATCHUP_HOURS", 12.0)
    reports.run_once(schedules, MANILA, _now("2026-09-07T12:00"))
    reports.run_once(schedules, MANILA, _now("2026-09-09T09:00"))  # >12h past 09-08 11:30
    assert sent == []
    # ...and it is marked done, so it never posts later either. 09-09's own 11:30
    # has not passed yet at 09:00, so the period marked is 09-08's.
    state = json.loads(reports.STATE_FILE.read_text("utf-8"))
    assert state["daily"] == "2026-09-08"


def test_an_unavailable_track_record_defers_rather_than_marking_done(schedules, track_record, sent):
    """A failed read is not 'nothing happened' — same rule as the pollers."""
    reports.run_once(schedules, MANILA, _now("2026-09-07T12:00"))
    available = track_record["payload"]
    track_record["payload"] = None  # backend down
    reports.run_once(schedules, MANILA, _now("2026-09-08T11:31"))
    assert sent == []
    assert json.loads(reports.STATE_FILE.read_text("utf-8"))["daily"] == "2026-09-07"

    track_record["payload"] = available  # backend back
    reports.run_once(schedules, MANILA, _now("2026-09-08T11:35"))
    assert len(sent) == 1


def test_nothing_published_yet_is_skipped_quietly(schedules, track_record, sent):
    reports.run_once(schedules, MANILA, _now("2026-09-07T12:00"))
    track_record["payload"] = {"success": True, "available": False, "series": []}
    reports.run_once(schedules, MANILA, _now("2026-09-08T11:31"))
    assert sent == []
    assert json.loads(reports.STATE_FILE.read_text("utf-8"))["daily"] == "2026-09-08"


def test_reporter_is_off_when_disabled(monkeypatch):
    monkeypatch.setattr(hooks, "REPORT_ENABLED", False)
    assert reports.start_reporter(threading.Event()) is None


def test_reporter_survives_an_unknown_timezone(monkeypatch, sent):
    monkeypatch.setattr(hooks, "REPORT_TIMEZONE", "Mars/Olympus_Mons")
    alerts: list[tuple] = []
    monkeypatch.setattr(notify, "notify_error", lambda ctx, detail: alerts.append((ctx, detail)))
    assert reports.start_reporter(threading.Event()) is None
    assert alerts and "Mars/Olympus_Mons" in alerts[0][1]


def test_a_corrupt_state_file_is_treated_as_a_fresh_seed(schedules, track_record, sent):
    reports.STATE_FILE.write_text("{not json", encoding="utf-8")
    reports.run_once(schedules, MANILA, _now("2026-09-08T11:31"))
    # The file EXISTS, so this is not a first run — it posts rather than seeding.
    assert len(sent) == 1
    assert json.loads(reports.STATE_FILE.read_text("utf-8"))["daily"] == "2026-09-08"
