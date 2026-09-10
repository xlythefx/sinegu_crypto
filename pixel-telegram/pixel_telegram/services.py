"""systemd unit state, and what counts as a restart.

Identity of a "start" is ``ActiveEnterTimestampMonotonic`` (microseconds since
boot) rather than the human ``ActiveEnterTimestamp`` string, which is locale-
and timezone-formatted and would have to be parsed back. Monotonic resets to a
small number on reboot, so a reboot reads as "everything restarted" — which is
exactly the report wanted.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import time

import psutil

log = logging.getLogger(__name__)

_PROPERTIES = ("ActiveState", "SubState", "ActiveEnterTimestampMonotonic", "NRestarts")


def available() -> bool:
    return shutil.which("systemctl") is not None


def _show(unit: str) -> dict[str, str]:
    args = ["systemctl", "show", unit] + [f"-p{p}" for p in _PROPERTIES]
    result = subprocess.run(args, capture_output=True, text=True, timeout=15)
    values: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def unit_state(unit: str) -> dict:
    """Current state of one unit. Never raises — an unreadable unit is reported
    as ``unknown``, which is information, where a traceback is not."""
    if not available():
        return {"unit": unit, "available": False, "active": "unknown",
                "sub": "", "since_monotonic": 0, "started_at": None, "restarts": 0}
    try:
        values = _show(unit)
    except Exception as exc:  # noqa: BLE001
        log.warning("systemctl show %s failed: %s", unit, exc)
        return {"unit": unit, "available": False, "active": "unknown",
                "sub": "", "since_monotonic": 0, "started_at": None, "restarts": 0}

    try:
        monotonic = int(values.get("ActiveEnterTimestampMonotonic", "0") or 0)
    except ValueError:
        monotonic = 0
    try:
        restarts = int(values.get("NRestarts", "0") or 0)
    except ValueError:
        restarts = 0

    return {
        "unit": unit,
        "available": bool(values),
        "active": values.get("ActiveState", "unknown"),
        "sub": values.get("SubState", ""),
        "since_monotonic": monotonic,
        "started_at": psutil.boot_time() + monotonic / 1_000_000 if monotonic else None,
        "restarts": restarts,
    }


def collect(units) -> list[dict]:
    return [unit_state(u) for u in units]


def fingerprint(state: dict) -> str:
    """The value compared against the last run. Changes on a restart, on a
    stop, and on a reboot; stays identical while a service just keeps running."""
    return f"{state['active']}:{state['since_monotonic']}"


def is_healthy(state: dict) -> bool:
    return state["active"] == "active"


def status_dot(state: dict) -> str:
    if not state["available"] or state["active"] == "unknown":
        return "⚪"
    return "🟢" if is_healthy(state) else "🔴"


def uptime_seconds(state: dict) -> float:
    return max(0.0, time.time() - state["started_at"]) if state.get("started_at") else 0.0
