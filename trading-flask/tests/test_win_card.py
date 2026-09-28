"""The Discord "wins" channel: a positive daily recap is also posted there as an
image card. Covers the card's figures (reports.build_win_card), when it fires,
the multipart post, and that its webhook token never reaches a log line.

No network — the track record, the session and the pool are all stand-ins.
"""

from __future__ import annotations

import json
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from binance_abcd import discord_notify, hooks, notify, reports, win_card

from tests.test_reports import SERIES

MANILA = ZoneInfo("Asia/Manila")
WINS = "https://discord.com/api/webhooks/1550420000000000000/WINS-SECRET-token"


def _now(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=MANILA)


def _day(end: str) -> dict:
    return reports.summarize(SERIES, end, end)


# --- The card's figures -----------------------------------------------------------

def test_card_figures_come_from_the_public_series():
    card = reports.build_win_card(SERIES, _day("2026-09-06"), "Binance")
    assert card.date_label == "Sep 6, 2026"          # no zero padding
    assert card.venue == "Binance"
    assert card.return_pct == pytest.approx(1.0)
    assert card.trades == 2
    # Month to date, chained one trading day at a time from 0.
    assert card.curve == pytest.approx([0.0, 5.0, 15.5, 13.19, 14.3219])
    assert card.month_pct == pytest.approx(14.3219)
    assert (card.month_green, card.month_days) == (3, 4)
    # Ranked best first — the recap's own ranking.
    assert (card.top_symbol, card.top_pct) == ("LTCUSDT", pytest.approx(1.6))


def test_green_streak_counts_back_to_the_last_red_day():
    assert reports.build_win_card(SERIES, _day("2026-09-06"), "Binance").green_streak == 1
    assert reports.build_win_card(SERIES, _day("2026-09-04"), "Binance").green_streak == 2


def test_the_card_carries_no_amount_or_name():
    """Same rule as /api/public/*: percentages, counts and tickers only."""
    fields = set(win_card.WinCard.__dataclass_fields__)
    assert fields == {
        "date_label", "venue", "return_pct", "trades", "curve", "green_streak",
        "month_pct", "month_green", "month_days", "top_symbol", "top_pct",
    }


def test_render_produces_a_png():
    pytest.importorskip("PIL")
    png = win_card.render(reports.build_win_card(SERIES, _day("2026-09-06"), "Binance"))
    assert png is not None and png.startswith(b"\x89PNG")


def test_a_render_failure_returns_none_instead_of_raising(monkeypatch):
    monkeypatch.setattr(win_card, "_render", lambda card: 1 / 0)
    assert win_card.render(reports.build_win_card(SERIES, _day("2026-09-06"), "Binance")) is None


# --- When it fires ----------------------------------------------------------------

@pytest.fixture()
def wins(monkeypatch):
    """Wins channel on, both channels captured, the track record canned."""
    posted: list[tuple[str, object]] = []
    monkeypatch.setattr(notify, "_send", lambda text, chat_id=None: None)
    monkeypatch.setattr(discord_notify, "post", lambda *a, **k: None)
    monkeypatch.setattr(discord_notify, "wins_enabled", lambda: True)
    monkeypatch.setattr(discord_notify, "post_win", lambda text, png: posted.append((text, png)))
    monkeypatch.setattr(win_card, "render", lambda card: b"PNG")
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance",))
    payload = {"success": True, "available": True, "timezone": "Asia/Manila", "series": SERIES}
    monkeypatch.setattr(reports, "fetch_track_record", lambda exchange=None: payload)
    return posted


SCHEDULES = [
    reports.parse_schedule("daily", "23:55"),
    reports.parse_schedule("weekly", "fri 23:55"),
]


def test_a_green_day_goes_to_the_wins_channel(wins):
    reports.run_once(SCHEDULES, MANILA, _now("2026-09-05T23:56"))  # seed
    reports.run_once(SCHEDULES, MANILA, _now("2026-09-06T23:56"))  # +1.0% day
    assert len(wins) == 1
    text, png = wins[0]
    assert "Winning day — 6 Sep 2026 · Binance" in text
    assert "+1.000%" in text
    assert png == b"PNG"


def test_a_red_day_is_not_posted(wins):
    reports.run_once(SCHEDULES, MANILA, _now("2026-09-04T23:56"))  # seed
    reports.run_once(SCHEDULES, MANILA, _now("2026-09-05T23:56"))  # −2.0% day
    assert wins == []


def test_a_day_without_trades_is_not_a_win(wins):
    reports.run_once(SCHEDULES, MANILA, _now("2026-09-07T23:56"))
    reports.run_once(SCHEDULES, MANILA, _now("2026-09-08T23:56"))
    assert wins == []


def test_only_the_daily_recap_can_post_a_win(wins):
    """Friday 4 Sep is a green day AND a weekly: one win, from the daily."""
    reports.run_once(SCHEDULES, MANILA, _now("2026-09-03T23:56"))  # seed
    reports.run_once(SCHEDULES, MANILA, _now("2026-09-04T23:56"))
    assert len(wins) == 1


def test_a_rounded_to_zero_day_is_not_celebrated():
    assert notify.is_daily_win({"trading_days": 1, "return_pct": 0.0004}) is False
    assert notify.is_daily_win({"trading_days": 1, "return_pct": 0.001}) is True
    assert notify.is_daily_win({"trading_days": 0, "return_pct": None}) is False


# --- Transport ----------------------------------------------------------------------

class _Response:
    status_code = 200
    ok = True
    text = ""
    headers: dict = {}


class _Session:
    def __init__(self, exc=None):
        self.calls = []
        self.exc = exc

    def post(self, url, json=None, data=None, files=None, timeout=None):
        self.calls.append({"url": url, "json": json, "data": data, "files": files})
        if self.exc:
            raise self.exc
        return _Response()


class _Inline:
    def submit(self, fn, *args):
        fn(*args)


@pytest.fixture()
def transport(monkeypatch):
    monkeypatch.setattr(hooks, "DISCORD_ENABLED", True)
    monkeypatch.setattr(hooks, "DISCORD_WINS_WEBHOOK_URL", WINS)
    monkeypatch.setattr(discord_notify, "_executor", _Inline())
    session = _Session()
    monkeypatch.setattr(discord_notify, "get_session", lambda: session)
    return session


def test_wins_channel_is_off_without_its_own_url(monkeypatch):
    monkeypatch.setattr(hooks, "DISCORD_ENABLED", True)
    monkeypatch.setattr(hooks, "DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/1/main")
    monkeypatch.setattr(hooks, "DISCORD_WINS_WEBHOOK_URL", "")
    assert discord_notify.wins_enabled() is False


def test_the_card_is_uploaded_and_shown_in_a_green_embed(transport):
    discord_notify.post_win("🏆 <b>Winning day — 6 Sep 2026</b>\nReturn: <b>+1.000%</b>", b"PNG")
    (call,) = transport.calls
    assert call["url"] == WINS
    name, body, mime = call["files"]["files[0]"]
    assert (name, body, mime) == (discord_notify.WIN_CARD_FILENAME, b"PNG", "image/png")
    (embed,) = json.loads(call["data"]["payload_json"])["embeds"]
    assert embed["color"] == discord_notify.GREEN
    assert embed["image"] == {"url": f"attachment://{discord_notify.WIN_CARD_FILENAME}"}


def test_without_a_card_it_still_posts_the_embed(transport):
    discord_notify.post_win("🏆 <b>Winning day</b>\nReturn: +1%", None)
    (call,) = transport.calls
    assert call["files"] is None
    assert "image" not in call["json"]["embeds"][0]


def test_the_wins_token_never_reaches_a_log(monkeypatch, caplog):
    monkeypatch.setattr(hooks, "DISCORD_ENABLED", True)
    monkeypatch.setattr(hooks, "DISCORD_WINS_WEBHOOK_URL", WINS)
    monkeypatch.setattr(discord_notify, "_executor", _Inline())
    boom = _Session(exc=RuntimeError(f"connection failed for url: {WINS}"))
    monkeypatch.setattr(discord_notify, "get_session", lambda: boom)
    discord_notify.post_win("🏆 <b>x</b>\ny", b"PNG")
    assert "WINS-SECRET-token" not in caplog.text
    assert "***" in caplog.text
