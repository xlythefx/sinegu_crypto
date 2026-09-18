"""Discord mirror: gating, the embed payload, Telegram-HTML → markdown, and a
transport that never raises and never logs the webhook token.

No network — the shared session is replaced by a fake that records every
post, and the one-worker pool by a stub that runs the job inline.
"""

from __future__ import annotations

import logging

import pytest
import requests

from binance_abcd import discord_notify, hooks

WEBHOOK = "https://discord.com/api/webhooks/1550028864275619980/SECRETTOKEN-abc"


class _Response:
    def __init__(self, status: int, text: str = "", headers: dict | None = None, body: dict | None = None):
        self.status_code = status
        self.ok = 200 <= status < 300
        self.text = text
        self.headers = headers or {}
        self._body = body

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


class _FakeSession:
    """Records every post; answers from a queue of responses (or raises)."""

    def __init__(self, *responses):
        self.responses = list(responses) or [_Response(204)]
        self.calls: list[tuple[str, dict, int]] = []

    def post(self, url, json=None, timeout=None):
        self.calls.append((url, json, timeout))
        answer = self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]
        if isinstance(answer, Exception):
            raise answer
        return answer


class _InlineExecutor:
    def submit(self, fn, *args):
        fn(*args)


class _ClosedExecutor:
    def submit(self, fn, *args):
        raise RuntimeError("cannot schedule new futures after shutdown")


@pytest.fixture()
def on(monkeypatch):
    """Mirror enabled, transport captured."""
    monkeypatch.setattr(hooks, "DISCORD_ENABLED", True)
    monkeypatch.setattr(hooks, "DISCORD_WEBHOOK_URL", WEBHOOK)
    monkeypatch.setattr(discord_notify, "_executor", _InlineExecutor())
    session = _FakeSession()
    monkeypatch.setattr(discord_notify, "get_session", lambda: session)
    return session


# --- Gating -------------------------------------------------------------------

def test_the_suite_runs_with_the_mirror_off():
    """conftest pre-seeds the keys off — the same guard that keeps the fan-out
    tests from posting to the live Telegram channel."""
    assert discord_notify.enabled() is False


def test_off_without_a_webhook_url(monkeypatch):
    monkeypatch.setattr(hooks, "DISCORD_ENABLED", True)
    monkeypatch.setattr(hooks, "DISCORD_WEBHOOK_URL", "")
    assert discord_notify.enabled() is False
    called = []
    monkeypatch.setattr(discord_notify, "get_session", lambda: called.append(1))
    discord_notify.post("🟢 <b>hello</b>", color=discord_notify.GREEN)
    assert called == []


def test_off_when_disabled_even_with_a_url(monkeypatch):
    monkeypatch.setattr(hooks, "DISCORD_ENABLED", False)
    monkeypatch.setattr(hooks, "DISCORD_WEBHOOK_URL", WEBHOOK)
    assert discord_notify.enabled() is False


def test_on_with_url_and_flag(monkeypatch):
    monkeypatch.setattr(hooks, "DISCORD_ENABLED", True)
    monkeypatch.setattr(hooks, "DISCORD_WEBHOOK_URL", WEBHOOK)
    assert discord_notify.enabled() is True


# --- Payload ------------------------------------------------------------------

def test_posts_one_embed_with_title_description_and_decimal_colour(on):
    discord_notify.post(
        "🟢 <b>Opening Long Positions — BTCUSDT · Binance</b>\nIncrement (2/3)\nEntry Price: 109,250.50",
        color=discord_notify.GREEN,
    )
    assert len(on.calls) == 1
    url, payload, timeout = on.calls[0]
    assert url == WEBHOOK  # verbatim — no ?wait, no rewrite
    assert timeout == discord_notify.TIMEOUT_SECONDS
    assert list(payload) == ["embeds"]
    (embed,) = payload["embeds"]
    assert embed == {
        "title": "🟢 Opening Long Positions — BTCUSDT · Binance",
        "description": "Increment (2/3)\nEntry Price: 109,250.50",
        "color": 3066993,  # 0x2ECC71 as the decimal int Discord wants
    }


def test_title_is_unescaped_but_never_markdown_escaped():
    """Embed titles render no markdown, so a backslash there would show."""
    embed = discord_notify.build_embed("🏁 <b>Closing — A_B &amp; C</b>\nx", discord_notify.GREY)
    assert embed["title"] == "🏁 Closing — A_B & C"
    assert "\\" not in embed["title"]


def test_recap_drops_the_blank_line_after_its_header():
    text = "📅 <b>Daily Report — 16 Sep 2026 · Binance</b>\n\nReturn: <b>+1.000%</b>\nTrades closed: 4"
    embed = discord_notify.build_embed(text, discord_notify.BLUE)
    assert embed["description"] == "Return: **+1.000%**\nTrades closed: 4"


def test_header_only_message_omits_description_rather_than_sending_empty():
    """Discord 400s on description "" — and an entry with no depth and no price
    is a real message."""
    embed = discord_notify.build_embed("🟢 <b>Opening Long Positions — BTCUSDT · Binance</b>", discord_notify.GREEN)
    assert "description" not in embed
    assert embed["title"].endswith("Binance")


def test_over_long_title_and_description_are_sliced_to_the_limits():
    text = "<b>" + "T" * 300 + "</b>\n" + "D" * 5000
    embed = discord_notify.build_embed(text, discord_notify.GREY)
    assert len(embed["title"]) == discord_notify.TITLE_LIMIT
    assert len(embed["description"]) == discord_notify.DESCRIPTION_LIMIT


def test_nothing_is_posted_for_blank_text(on):
    discord_notify.post("   \n", color=discord_notify.GREY)
    assert on.calls == []


# --- HTML → markdown ----------------------------------------------------------

def test_bold_and_code_become_markdown():
    assert discord_notify.to_markdown("Return: <b>+1.000%</b>") == "Return: **+1.000%**"
    assert discord_notify.to_markdown("Reason: <code>x_y</code>") == "Reason: `x_y`"


def test_inline_specials_are_escaped_outside_code_only():
    assert discord_notify.to_markdown("a*b_c~d|e\\f") == "a\\*b\\_c\\~d\\|e\\\\f"
    assert discord_notify.to_markdown("<code>a*b`c</code>") == "`a*b'c`"


def test_entities_are_unescaped():
    assert discord_notify.to_markdown("A &amp; B &lt;C&gt;") == "A & B <C>"


def test_ranking_lines_do_not_become_an_ordered_list():
    """The daily podium is 🥇🥈🥉 then `4. ETHUSDT …` — which Discord would
    otherwise re-indent as list item 4."""
    text = "🥇 BTCUSDT +0.900% · 2 trades\n4. ETHUSDT -0.100% · 1 trade\n10. SOLUSDT +0.000%"
    out = discord_notify.to_markdown(text)
    assert "\n4\\. ETHUSDT" in out
    assert "\n10\\. SOLUSDT" in out
    assert out.startswith("🥇 BTCUSDT")


def test_line_start_block_markers_are_escaped_only_when_they_would_render():
    assert discord_notify.to_markdown("> quoted\n# heading\n- bullet") == "\\> quoted\n\\# heading\n\\- bullet"
    # A negative return on its own line is text, not a bullet; mid-line > is text.
    assert discord_notify.to_markdown("-0.500%\na > b") == "-0.500%\na > b"
    assert discord_notify.to_markdown("Return: <b>-0.500%</b>") == "Return: **-0.500%**"


# --- Transport ----------------------------------------------------------------

def test_a_failed_status_is_logged_and_never_raised(on, caplog):
    on.responses = [_Response(400, '{"code":50035,"message":"Invalid Form Body"}')]
    with caplog.at_level(logging.WARNING, logger="binance_abcd.discord_notify"):
        discord_notify.post("🟢 <b>x</b>\ny", color=discord_notify.GREEN)
    assert "discord send failed: 400" in caplog.text


def test_a_timeout_is_swallowed(on, caplog):
    on.responses = [requests.Timeout("read timed out")]
    with caplog.at_level(logging.WARNING, logger="binance_abcd.discord_notify"):
        discord_notify.post("🟢 <b>x</b>\ny", color=discord_notify.GREEN)
    assert "discord send exception" in caplog.text


def test_pool_shutdown_falls_back_to_a_synchronous_post(on, monkeypatch):
    monkeypatch.setattr(discord_notify, "_executor", _ClosedExecutor())
    discord_notify.post("🟢 <b>x</b>\ny", color=discord_notify.GREEN)
    assert len(on.calls) == 1


def test_a_rate_limit_is_retried_once_after_retry_after(on, monkeypatch):
    slept = []
    monkeypatch.setattr(discord_notify.time, "sleep", lambda s: slept.append(s))
    on.responses = [_Response(429, headers={"Retry-After": "2"}), _Response(204)]
    discord_notify.post("🟢 <b>x</b>\ny", color=discord_notify.GREEN)
    assert len(on.calls) == 2
    assert slept == [2.0]


def test_retry_after_is_clamped_and_falls_back_to_the_body(monkeypatch):
    assert discord_notify._retry_after(_Response(429, headers={"Retry-After": "600"})) == discord_notify.MAX_RETRY_AFTER_SECONDS
    assert discord_notify._retry_after(_Response(429, body={"retry_after": 0.25})) == 0.25
    assert discord_notify._retry_after(_Response(429)) == 1.0


def test_the_webhook_token_never_reaches_the_log(on, caplog):
    """requests quotes the request PATH in a ConnectionError — and the path
    IS the secret. One outage must not write it to the journal."""
    on.responses = [requests.ConnectionError(
        "HTTPSConnectionPool(host='discord.com', port=443): Max retries exceeded "
        "with url: /api/webhooks/1550028864275619980/SECRETTOKEN-abc (Caused by ...)"
    )]
    with caplog.at_level(logging.WARNING, logger="binance_abcd.discord_notify"):
        discord_notify.post("🟢 <b>x</b>\ny", color=discord_notify.GREEN)
    assert "SECRETTOKEN" not in caplog.text
    assert WEBHOOK not in caplog.text
    assert "discord send exception" in caplog.text

    on.responses = [_Response(404, f"Unknown Webhook {WEBHOOK}")]
    with caplog.at_level(logging.WARNING, logger="binance_abcd.discord_notify"):
        discord_notify.post("🟢 <b>x</b>\ny", color=discord_notify.GREEN)
    assert "SECRETTOKEN" not in caplog.text
