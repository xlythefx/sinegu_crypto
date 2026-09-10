"""Configuration for the pixel-telegram ops reporter.

Env-driven with the ``PIXEL_TG_`` prefix, loaded from ``pixel-telegram/.env``
(see .env.example for the full key list). Nothing raises at import: this tool's
whole job is to still run when other things are broken, so a missing key means
"disabled" or "default", never a crash.

Read through the module (``from pixel_telegram import config`` then
``config.CHAT_ID``), not ``from``-imported, so tests can monkeypatch it — same
convention as the engine's ``hooks.py``.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=False)

_PREFIX = "PIXEL_TG_"


def _env_str(name: str, default: str = "") -> str:
    return os.environ.get(_PREFIX + name, default) or default


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(_PREFIX + name)
    try:
        return int(raw) if raw not in (None, "") else default
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(_PREFIX + name)
    try:
        return float(raw) if raw not in (None, "") else default
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(_PREFIX + name)
    if raw in (None, ""):
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# --- Telegram -----------------------------------------------------------------
# The bot is the same one that posts to the public channel; only the chat differs.
# Off unless BOTH a token and a chat id are set (same rule as the engine).
ENABLED = _env_bool("ENABLED", True)
BOT_TOKEN = _env_str("BOT_TOKEN")       # secret — .env only, never committed
CHAT_ID = _env_str("CHAT_ID")           # the "Pixel Alpha Admin Control" group

# --- What this box is called in the message -----------------------------------
VPS_NAME = _env_str("VPS_NAME", "Pixel Alpha VPS")

# --- Services watched for restarts / outages ----------------------------------
# Comma-separated `unit=Label` pairs (the label is optional and defaults to the
# unit name). Configurable rather than hardcoded because the php-fpm unit
# carries the PHP version in its name and moves on an upgrade.
#
# The two halves are deliberately different things. The UNIT is an address that
# systemctl must resolve — `sinegualerts-engine` is what the service is actually
# called on the box, and renaming it would break the deploy script, the sudoers
# rule and the journal reads. The LABEL is what a person reads in Telegram, and
# there it is Pixel Alpha. Same rule as the rest of the product: if a human
# reads it, it says Pixel Alpha; if a machine resolves it, leave it alone.
_DEFAULT_UNITS = ("sinegualerts-engine=Pixel Alpha engine,"
                  "nginx=Web server (nginx),"
                  "php8.3-fpm=API runtime (php-fpm)")


def _parse_units(raw: str) -> tuple[tuple[str, ...], dict[str, str]]:
    units: list[str] = []
    labels: dict[str, str] = {}
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        unit, _, label = entry.partition("=")
        unit = unit.strip()
        if not unit:
            continue
        units.append(unit)
        labels[unit] = label.strip() or unit
    return tuple(units), labels


UNITS, UNIT_LABELS = _parse_units(_env_str("UNITS", _DEFAULT_UNITS))


def label_for(unit: str) -> str:
    """What a person reads for this unit. Falls back to the unit name, so an
    unlabelled entry degrades to something true rather than to nothing."""
    return UNIT_LABELS.get(unit, unit)

# The engine's own health endpoint, read best-effort for the report footer.
ENGINE_HEALTH_URL = _env_str("ENGINE_HEALTH_URL", "http://127.0.0.1:5010/health")

# --- Resource thresholds ------------------------------------------------------
DISK_PATH = _env_str("DISK_PATH", "/")
CPU_ALERT_PERCENT = _env_float("CPU_ALERT_PERCENT", 95.0)
RAM_ALERT_PERCENT = _env_float("RAM_ALERT_PERCENT", 90.0)
DISK_ALERT_PERCENT = _env_float("DISK_ALERT_PERCENT", 90.0)
# One alert per metric per this many minutes, so a box that sits at 91% disk
# does not post every two minutes until everyone mutes the group.
ALERT_COOLDOWN_MINUTES = _env_int("ALERT_COOLDOWN_MINUTES", 60)

# --- State --------------------------------------------------------------------
# Last-seen unit states + last-alert times. Lives beside the code (excluded from
# the deploy sync) so a redeploy does not re-announce every service as restarted.
STATE_FILE = _env_str("STATE_FILE", str(PROJECT_ROOT / "state" / "state.json"))

HTTP_TIMEOUT = _env_float("HTTP_TIMEOUT", 10.0)
