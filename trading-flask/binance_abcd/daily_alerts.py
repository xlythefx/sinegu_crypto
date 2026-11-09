"""Admin alerts that go out at most ONCE PER DAY per subject.

Built 2026-11-09 for the "coin turned off" rejection. With LTC switched off,
every LTC signal — main feed and test feed, several a day — posted the same
"Signal rejected" message to the admin group. The first one of the day says it
all; the rest are refused without a message. Only the Telegram message is held
back: every refused signal still writes its Signal Log row.

The day is the REPORT_TIMEZONE calendar day (Asia/Manila — the team's day, the
one the recaps use). State is a small JSON file in ``out/`` so a restart (every
engine deploy is one) does not repeat today's message. Nothing here raises: an
unreadable or unwritable file means "not sent yet", because one message too
many is better than a silent one.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from datetime import datetime, timezone
from typing import Iterable, Optional

from binance_abcd import hooks

log = logging.getLogger(__name__)

STATE_FILE = hooks.OUT_DIR / "daily_alerts.json"

_lock = threading.Lock()


def today() -> str:
    """Today's date in the team's timezone, as YYYY-MM-DD."""
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo(hooks.REPORT_TIMEZONE)
    except Exception:  # noqa: BLE001 - no tz database: UTC days, still once a day
        tz = timezone.utc
    return datetime.now(tz).date().isoformat()


def _load() -> dict:
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save(data: dict) -> None:
    directory = os.path.dirname(os.path.abspath(STATE_FILE))
    try:
        os.makedirs(directory, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=directory, prefix=".daily-alerts-", suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
        os.replace(tmp, STATE_FILE)
    except Exception as exc:  # noqa: BLE001
        log.warning("could not write %s: %s", STATE_FILE, exc)


def first_today(keys: Iterable[str], day: Optional[str] = None) -> bool:
    """True when at least one of `keys` has not alerted today — and then marks
    every key as alerted. Days other than today are dropped on each write, so
    the file never grows past one day's subjects."""
    keys = [k for k in keys if k]
    if not keys:
        return True
    day = day or today()
    with _lock:
        data = _load()
        if all(data.get(k) == day for k in keys):
            return False
        data = {k: d for k, d in data.items() if d == day}
        data.update({k: day for k in keys})
        _save(data)
        return True
