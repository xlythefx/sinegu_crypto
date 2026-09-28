"""Discord mirror of the engine's PUBLIC Telegram messages.

``notify.py`` composes every message once, in Telegram HTML, and posts the
public ones — entries, exits + PnL percent, the scheduled recaps — through
``notify._send_public``. That function is the only caller of :func:`post`
here, and the admin builders never reach it, so ops alerts (account names,
failures, counts) cannot land in Discord by construction of the call graph
rather than by a flag someone has to remember. There is no admin webhook and
no fallback of admin text to the public one: that fallback is exactly what
leaked account names into the public Telegram channel until 2026-09-04.

Privacy is structural for the same reason: this module receives the exact
string the public Telegram chat gets, plus one integer — a colour derived from
the action or from the sign of a PnL percent that is already printed. It never
sees a summary, an account, a balance or a name.

What it posts is an EMBED — a card with a coloured side bar — rather than a
plain message, because that is the one thing Discord can show that Telegram
cannot: green for a long entry, red for a short one, the exit's colour is the
sign of its PnL, recaps are blue, grey when there is nothing to judge. The
first line of the Telegram text becomes the embed title (titles do not render
markdown, so it is only unescaped); the rest is converted to Discord markdown
(``<b>`` → ``**``, ``<code>`` → backticks, and the ranking's ``4. ETHUSDT``
escaped so Discord does not re-indent it as an ordered list).

Transport mirrors ``notify.py``: fire-and-forget on its own background pool
over the shared HTTP session, never raises. ONE worker, not two, so an entry
is always posted before its exit and a rate-limit sleep throttles the queue
instead of a second thread hitting the same bucket — Discord allows 5 posts
per 2 s per webhook, and the last-Friday-of-month report tick can fire six
recaps in one second. A 429 is retried once after Discord's own ``Retry-After``.

The webhook URL IS the credential — its last path segment is the token, and
anyone holding it can post to the channel — so it lives in the gitignored
``.env`` only and is scrubbed from every log line: a ``requests``
``ConnectionError`` quotes the request path, which would otherwise write the
token to the journal on every outage.

Config is ``BINANCE_ABCD_DISCORD_*`` in ``hooks.py``, read through the module
so tests can monkeypatch it; independent of the Telegram keys.
"""

from __future__ import annotations

import html
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

from binance_abcd import hooks
from binance_abcd.http_client import get_session

log = logging.getLogger(__name__)

# One worker on purpose — see the module docstring (ordering + rate limit).
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="discord-notify")

# Embed side-bar colours. Hex here for legibility; JSON carries the decimal int.
GREEN = 0x2ECC71
RED = 0xE74C3C
BLUE = 0x3498DB
GREY = 0x95A5A6

# Discord's hard limits — over either is a 400, never a silent truncation.
TITLE_LIMIT = 256
DESCRIPTION_LIMIT = 4096
TIMEOUT_SECONDS = 10
# The longest a 429 may hold the (single) worker before the retry.
MAX_RETRY_AFTER_SECONDS = 5.0
# The attachment name the wins embed points its image at.
WIN_CARD_FILENAME = "pixel-alpha-daily.png"

# The only markup notify.py emits. Split with the capture group so the tags
# come back as their own tokens, in order.
_TAG_RE = re.compile(r"(</?(?:b|code)>)")
# Characters Discord reads as markdown in a description, escaped everywhere.
_MARKDOWN_SPECIALS_RE = re.compile(r"([\\*_~`|])")
# Block markers only count at a true line start AND followed by a space —
# `> quote`, `# heading`, `- bullet` — so `-0.500%` on its own line is text.
_LINE_START_MARKER_RE = re.compile(r"^(?=[>#-] )", re.MULTILINE)
# `4. ETHUSDT` at line start is an ordered-list item; `4\. ETHUSDT` is text.
_LINE_START_LIST_RE = re.compile(r"^(\d+)\.(?= )", re.MULTILINE)


def enabled() -> bool:
    url = str(hooks.DISCORD_WEBHOOK_URL or "")
    return bool(hooks.DISCORD_ENABLED and url.startswith("https://"))


def wins_enabled() -> bool:
    """The "wins" channel: a second webhook that only ever receives the daily
    win card. Same master switch as the mirror, its own URL."""
    url = str(hooks.DISCORD_WINS_WEBHOOK_URL or "")
    return bool(hooks.DISCORD_ENABLED and url.startswith("https://"))


# --- Rendering ----------------------------------------------------------------

def _escape_plain(segment: str) -> str:
    """Un-HTML a text run, then neutralise every inline character Discord
    would render. Line-start markers are handled on the assembled text, where
    a line start is a real one and not merely the start of a segment."""
    return _MARKDOWN_SPECIALS_RE.sub(r"\\\1", html.unescape(segment))


def to_markdown(text: str) -> str:
    """Telegram HTML → Discord markdown. Deliberately minimal: ``<b>`` and
    ``<code>`` are the only tags ``notify.py`` writes, and ``_esc`` there is
    ``html.escape`` — so unescaping entities and swapping two tags is the whole
    job. Inside ``<code>`` nothing is markdown, so only backticks are removed."""
    out: list[str] = []
    in_code = False
    for token in _TAG_RE.split(text):
        if token in ("<b>", "</b>"):
            out.append("**")
        elif token in ("<code>", "</code>"):
            in_code = token == "<code>"
            out.append("`")
        elif token:
            out.append(html.unescape(token).replace("`", "'") if in_code else _escape_plain(token))
    joined = "".join(out)
    joined = _LINE_START_MARKER_RE.sub("\\\\", joined)
    return _LINE_START_LIST_RE.sub(r"\1\\.", joined)


def _split(text: str) -> tuple[str, str]:
    """First line → title (tags stripped, entities unescaped, NOT markdown-escaped:
    embed titles render no markdown, so a backslash there would show). The rest
    → description, minus the blank line the recap opens with."""
    head, _, rest = text.partition("\n")
    title = html.unescape(_TAG_RE.sub("", head)).strip()[:TITLE_LIMIT]
    description = to_markdown(rest).lstrip("\n")[:DESCRIPTION_LIMIT]
    return title, description


def build_embed(text: str, color: int) -> dict[str, Any]:
    """The one embed a message becomes. ``description`` is omitted rather than
    sent empty — Discord rejects ``""`` with a 400 — and a header-only entry
    (no depth line, no price) is a real message."""
    title, description = _split(text)
    embed: dict[str, Any] = {"title": title, "color": int(color)}
    if description:
        embed["description"] = description
    return embed


# --- Transport ----------------------------------------------------------------

def _redact(message: str) -> str:
    """Scrub every webhook URL and its bare token out of anything logged."""
    for url in (str(hooks.DISCORD_WEBHOOK_URL or ""), str(hooks.DISCORD_WINS_WEBHOOK_URL or "")):
        if not url:
            continue
        token = url.rstrip("/").rsplit("/", 1)[-1]
        for secret in (url, token):
            if secret:
                message = message.replace(secret, "***")
    return message


def _retry_after(response: Any) -> float:
    """Seconds Discord asked us to wait: the ``Retry-After`` header (integer
    seconds), else the body's ``retry_after`` (float seconds on the current
    API), else one second. Clamped so a hostile value cannot park the worker."""
    wait: float
    try:
        wait = float(response.headers.get("Retry-After"))
    except (TypeError, ValueError, AttributeError):
        try:
            wait = float(response.json().get("retry_after"))
        except Exception:  # noqa: BLE001 - any shape of body → the default
            wait = 1.0
    return min(max(wait, 0.0), MAX_RETRY_AFTER_SECONDS)


def _post_sync(
    payload: dict[str, Any], url: Optional[str] = None, png: Optional[bytes] = None
) -> None:
    """One webhook post. With `png`, it is a multipart upload (``payload_json``
    + ``files[0]``) so the embed can show the image as ``attachment://``."""
    url = url or str(hooks.DISCORD_WEBHOOK_URL or "")

    def send():
        if png is None:
            return get_session().post(url, json=payload, timeout=TIMEOUT_SECONDS)
        return get_session().post(
            url,
            data={"payload_json": json.dumps(payload)},
            files={"files[0]": (WIN_CARD_FILENAME, png, "image/png")},
            timeout=TIMEOUT_SECONDS,
        )

    try:
        response = send()
        if response.status_code == 429:
            wait = _retry_after(response)
            log.info("discord rate limited, retrying in %.1fs", wait)
            time.sleep(wait)
            response = send()
        if not response.ok:
            log.warning("discord send failed: %s %.200s", response.status_code, _redact(response.text))
    except Exception as exc:  # noqa: BLE001 - a notification must never raise
        log.warning("discord send exception: %s", _redact(str(exc)))


def post(text: str, *, color: int) -> None:
    """Mirror one PUBLIC message (Telegram-HTML text) as a coloured embed.
    No-op while the mirror is off. Only ``notify._send_public`` calls this."""
    if not enabled() or not text.strip():
        return
    payload = {"embeds": [build_embed(text, color)]}
    try:
        _executor.submit(_post_sync, payload)
    except RuntimeError:
        _post_sync(payload)  # pool shut down (process exiting) — best effort


def post_win(text: str, png: Optional[bytes]) -> None:
    """The daily win to the WINS channel: the card ALONE in a green embed — no
    title, no text (the owner's call, 2026-09-28: the card says it all). The
    text is only the fallback, posted when the card could not be drawn. Only
    ``notify.notify_daily_win`` calls this, with public recap text."""
    if not wins_enabled() or not text.strip():
        return
    if png is not None:
        embed: dict[str, Any] = {
            "color": GREEN,
            "image": {"url": f"attachment://{WIN_CARD_FILENAME}"},
        }
    else:
        embed = build_embed(text, GREEN)
    payload = {"embeds": [embed]}
    url = str(hooks.DISCORD_WINS_WEBHOOK_URL)
    try:
        _executor.submit(_post_sync, payload, url, png)
    except RuntimeError:
        _post_sync(payload, url, png)
