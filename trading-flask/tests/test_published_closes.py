"""The daily recap is the SUM of the close percentages the channel published.

27 Sep 2026: a lone LTCUSDT close posted +2.224% and the daily recap under it
said +2.189% — the close divided by the wallet, the recap by the track
record's walked capital. A reader adding up the channel must get the recap.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from binance_abcd import hooks, notify, published_closes, reports

MANILA = ZoneInfo("Asia/Manila")


@pytest.fixture()
def sent(monkeypatch):
    monkeypatch.setattr(hooks, "TELEGRAM_ENABLED", True)
    monkeypatch.setattr(hooks, "TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "-100123")
    monkeypatch.setattr(hooks, "TELEGRAM_PNL_WAIT_SECONDS", 30.0)
    messages: list[str] = []
    monkeypatch.setattr(notify, "_send", lambda text, chat_id=None: messages.append(text))
    yield messages
    for batch in list(notify._batches.values()):
        if batch.timer:
            batch.timer.cancel()
    notify._batches.clear()


def _close(ticker, pnl, *, balance=10_000.0, increments=1, is_master=True):
    batch_id = notify.open_exit_batch("EXIT_LONG", ticker, price=61)
    notify.seal_exit_batch(batch_id, expected=1)
    notify.report_exit_fill(batch_id, realized_pnl=pnl, exit_price=61.0, quantity=100,
                            balance=balance, exchange="binance", is_master=is_master,
                            increments=increments, max_increments=3)


def test_a_published_close_is_recorded_as_printed(sent):
    _close("LTCUSDT", 100.0, increments=2)
    assert "PnL: +0.939%" in sent[0]
    today = datetime.now(timezone.utc).astimezone(MANILA).date()
    day = published_closes.day_summary("binance", today, MANILA)
    assert day["return_pct"] == pytest.approx(0.939)
    assert day["trades"] == 2  # increments, like "Increments Closed (2/3)"
    assert day["assets"] == [{"symbol": "LTCUSDT", "pct": pytest.approx(0.939), "trades": 2}]


def test_a_close_without_a_pnl_line_is_not_recorded(sent):
    _close("LTCUSDT", 100.0, is_master=False)  # the master did not fill
    assert "PnL:" not in sent[0]
    today = datetime.now(timezone.utc).astimezone(MANILA).date()
    assert published_closes.day_summary("binance", today, MANILA) is None


def test_the_daily_recap_is_the_sum_of_the_days_closes():
    # 27 Sep, Manila: two closes, plus one on the 26th and one on another venue.
    published_closes.record("binance", "LTCUSDT", 2.2241, increments=2,
                            at=datetime(2026, 9, 26, 22, 30, tzinfo=timezone.utc))  # 06:30 on the 27th
    published_closes.record("binance", "BTCUSDT", -0.5, increments=1,
                            at=datetime(2026, 9, 27, 10, 0, tzinfo=timezone.utc))
    published_closes.record("binance", "LTCUSDT", 9.0,
                            at=datetime(2026, 9, 26, 15, 0, tzinfo=timezone.utc))   # 23:00 on the 26th
    published_closes.record("mexc", "LTCUSDT", 5.0,
                            at=datetime(2026, 9, 27, 1, 0, tzinfo=timezone.utc))

    from_track_record = {
        "start": "2026-09-27", "end": "2026-09-27", "return_pct": 1.689,
        "trading_days": 1, "winning_days": 1, "losing_days": 0, "trades": 3,
        "best_pct": 1.689, "worst_pct": 1.689,
        "assets": [{"symbol": "LTCUSDT", "pct": 1.689, "trades": 3}],
    }
    summary = reports.with_published_closes(from_track_record, "binance", MANILA)

    assert summary["return_pct"] == pytest.approx(2.224 - 0.5)  # rounded as printed
    assert summary["trades"] == 3
    assert [a["symbol"] for a in summary["assets"]] == ["LTCUSDT", "BTCUSDT"]
    text = notify.render_report("daily", summary, "Binance")
    assert "Return: <b>+1.724%</b>" in text
    assert "LTCUSDT +2.224% · 2 trades" in text
    assert "BTCUSDT -0.500% · 1 trade" in text


def test_a_day_with_no_recorded_close_keeps_the_track_record():
    summary = {"start": "2026-09-27", "end": "2026-09-27", "return_pct": 2.189,
               "trading_days": 1, "trades": 2, "assets": []}
    assert reports.with_published_closes(summary, "binance", MANILA) is summary


def test_weekly_and_monthly_stay_on_the_track_record():
    published_closes.record("binance", "LTCUSDT", 5.0,
                            at=datetime(2026, 9, 27, 1, 0, tzinfo=timezone.utc))
    payload = {"timezone": "Asia/Manila",
               "series": [{"date": "2026-09-27", "pct": 2.189, "trades": 2}]}
    fire = datetime(2026, 9, 27, 23, 55, tzinfo=MANILA)
    weekly = reports.daily_or_period_summary(
        reports.Schedule("weekly", 23, 55, weekday=6), fire, payload, "binance")
    daily = reports.daily_or_period_summary(
        reports.Schedule("daily", 23, 55), fire, payload, "binance")
    assert weekly["return_pct"] == pytest.approx(2.189)
    assert daily["return_pct"] == pytest.approx(5.0)
    assert daily["end"] == date(2026, 9, 27).isoformat()
