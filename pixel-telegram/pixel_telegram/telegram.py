"""Telegram transport — one plain POST, HTML parse mode.

Deliberately not the engine's pooled/threaded sender: this process is a oneshot
systemd job that exits right after, so a background pool would just be a way to
drop the message on the way out.
"""

from __future__ import annotations

import html
import logging
from typing import Any, Optional

import requests

from pixel_telegram import config

log = logging.getLogger(__name__)

API = "https://api.telegram.org"


def esc(value: Any) -> str:
    return html.escape(str(value), quote=False)


def enabled() -> bool:
    return bool(config.ENABLED and config.BOT_TOKEN and config.CHAT_ID)


def _redact(message: str) -> str:
    """Scrub the bot token out of anything logged. A requests ConnectionError
    quotes the URL it failed on, and the token is IN the Telegram URL
    (/bot<TOKEN>/sendMessage) — so the one line a failed alert leaves in the
    journal would otherwise hand the bot to whoever reads it. Same rule as the
    engine's notify._redact."""
    token = str(config.BOT_TOKEN or "")
    return message.replace(token, "***") if token else message


def send(text: str, *, dry: bool = False, chat_id: Optional[str] = None) -> bool:
    """Post one message. Returns True when Telegram accepted it.

    Never raises: this runs unattended from a timer, and a failed alert must
    show up as a log line, not as a unit in `failed` state that then needs its
    own alert.
    """
    if dry:
        print(text)
        return True
    if not enabled():
        log.warning("telegram disabled (no PIXEL_TG_BOT_TOKEN / PIXEL_TG_CHAT_ID) — not sent")
        return False
    url = f"{API}/bot{config.BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id or config.CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        response = requests.post(url, json=payload, timeout=config.HTTP_TIMEOUT)
        if not response.ok:
            log.warning("telegram send failed: %s %.200s", response.status_code, _redact(response.text))
            return False
        return True
    except Exception as exc:  # noqa: BLE001 - an alert must never crash the job
        log.warning("telegram send exception: %s", _redact(str(exc)))
        return False


def get_updates() -> list[dict]:
    """Raw getUpdates, used only by the `chat-id` helper."""
    if not config.BOT_TOKEN:
        raise SystemExit("PIXEL_TG_BOT_TOKEN is not set in pixel-telegram/.env")
    response = requests.get(f"{API}/bot{config.BOT_TOKEN}/getUpdates",
                            timeout=config.HTTP_TIMEOUT)
    response.raise_for_status()
    return response.json().get("result") or []
