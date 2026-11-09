"""VPS resource collection and the block-bar rendering used in the report."""

from __future__ import annotations

import os
import time
from typing import Optional

import psutil

from pixel_telegram import config

GB = 1024 ** 3


def fmt_duration(seconds: float) -> str:
    """'5d 3h' / '4h 12m' / '38m' — the two largest useful units, never more."""
    seconds = max(0, int(seconds))
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    if days:
        return f"{days}d {hours}h"
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def bar(percent: float, width: int = 10) -> str:
    """Ten cells of filled/empty block. Clamped, so a bogus 120% still renders."""
    pct = min(100.0, max(0.0, float(percent)))
    filled = int(round(pct / 100.0 * width))
    return "█" * filled + "░" * (width - filled)


def dot(percent: float, warn: float = 75.0, hot: float = 90.0) -> str:
    if percent >= hot:
        return "🔴"
    if percent >= warn:
        return "🟠"
    return "🟢"


def _load_average() -> Optional[tuple[float, float, float]]:
    """1/5/15-minute load. None on Windows, where psutil emulates it with a
    warm-up window that a oneshot process never lives long enough to fill."""
    if not hasattr(os, "getloadavg"):
        return None
    try:
        return os.getloadavg()
    except OSError:
        return None


# --- CPU: an AVERAGE over the time between checks, never a 1-second glance ----
#
# Until 2026-11-09 the CPU figure was psutil.cpu_percent(interval=1): one
# second, every two minutes. Both Laravel schedulers on the box start their
# per-minute PHP jobs in the same second, which holds both cores at ~98% for
# one or two seconds and then drops to idle — so whenever the watch timer's
# second landed on that burst, the admin group read "CPU 96%" from a box
# averaging 2–3% all day (10:40 UTC, 8 Nov). The watch now stores the CPU
# counters each run and reports busy time over the whole interval since the
# last one: a sustained load still reads as one, a two-second burst cannot.

# A previous reading older than this (timer stopped, box just deployed) or
# younger than CPU_WINDOW_MIN_SECONDS (a report right after a watch) is not a
# fair window; a CPU_SAMPLE_SECONDS sample is taken instead.
CPU_WINDOW_MIN_SECONDS = 30.0
CPU_WINDOW_MAX_SECONDS = 15 * 60.0
CPU_SAMPLE_SECONDS = 5.0


def cpu_snapshot(now: Optional[float] = None) -> dict:
    """The cumulative CPU counters, JSON-safe, stamped with the wall clock."""
    return {"at": time.time() if now is None else now, "times": psutil.cpu_times()._asdict()}


def _total_and_busy(times: dict) -> tuple[float, float]:
    """psutil's own arithmetic: guest time is already inside user/nice on
    Linux, and iowait is idle. Steal counts as busy — capacity we did not get."""
    total = sum(float(v) for v in times.values())
    total -= float(times.get("guest", 0.0)) + float(times.get("guest_nice", 0.0))
    idle = float(times.get("idle", 0.0)) + float(times.get("iowait", 0.0))
    return total, total - idle


def cpu_percent_between(before: dict, after: dict) -> Optional[float]:
    """Busy % between two snapshots, or None when they cannot be compared —
    malformed, or counters that went backwards (a reboot resets them)."""
    try:
        total_1, busy_1 = _total_and_busy(before["times"])
        total_2, busy_2 = _total_and_busy(after["times"])
    except (KeyError, TypeError, ValueError, AttributeError):
        return None
    elapsed = total_2 - total_1
    if elapsed <= 0 or busy_2 < busy_1:
        return None
    return max(0.0, min(100.0, (busy_2 - busy_1) / elapsed * 100.0))


def cpu_average(previous: Optional[dict], now: Optional[float] = None) -> tuple[float, float, dict]:
    """(percent, window in seconds, snapshot to store for the next run)."""
    now = time.time() if now is None else now
    if isinstance(previous, dict):
        try:
            window = now - float(previous.get("at"))
        except (TypeError, ValueError):
            window = -1.0
        if CPU_WINDOW_MIN_SECONDS <= window <= CPU_WINDOW_MAX_SECONDS:
            current = cpu_snapshot(now)
            percent = cpu_percent_between(previous, current)
            if percent is not None:
                return percent, window, current
    percent = psutil.cpu_percent(interval=CPU_SAMPLE_SECONDS)
    return percent, CPU_SAMPLE_SECONDS, cpu_snapshot()


def collect(previous_cpu: Optional[dict] = None, now: Optional[float] = None) -> dict:
    """Resources now. CPU is the average since `previous_cpu` (the snapshot the
    last watch stored) — see cpu_average(); the new snapshot is returned as
    `cpu_snapshot` for the caller to store."""
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage(config.DISK_PATH if os.path.exists(config.DISK_PATH) else os.path.abspath(os.sep))
    cpu_percent, cpu_window, snapshot = cpu_average(previous_cpu, now)
    return {
        "cpu_percent": cpu_percent,
        "cpu_window_seconds": cpu_window,
        "cpu_snapshot": snapshot,
        "ram_percent": memory.percent,
        "ram_used_gb": memory.used / GB,
        "ram_total_gb": memory.total / GB,
        "disk_percent": disk.used / disk.total * 100 if disk.total else 0.0,
        "disk_used_gb": disk.used / GB,
        "disk_total_gb": disk.total / GB,
        "uptime_seconds": max(0.0, time.time() - psutil.boot_time()),
        "load": _load_average(),
    }


def window_label(seconds: Optional[float]) -> str:
    """'2 min' / '5 s' — how long the CPU figure was averaged over."""
    if not seconds:
        return ""
    return f"{round(seconds / 60)} min" if seconds >= 90 else f"{round(seconds)} s"


def resource_lines(metrics: dict) -> list[str]:
    window = window_label(metrics.get("cpu_window_seconds"))
    lines = [
        f"{dot(metrics['cpu_percent'])} <b>CPU</b>  <code>{bar(metrics['cpu_percent'])}</code> "
        f"{metrics['cpu_percent']:.0f}%" + (f"  (avg {window})" if window else ""),
        f"{dot(metrics['ram_percent'])} <b>RAM</b>  <code>{bar(metrics['ram_percent'])}</code> "
        f"{metrics['ram_percent']:.0f}%  ({metrics['ram_used_gb']:.1f}/{metrics['ram_total_gb']:.1f} GB)",
        f"{dot(metrics['disk_percent'])} <b>Disk</b> <code>{bar(metrics['disk_percent'])}</code> "
        f"{metrics['disk_percent']:.0f}%  ({metrics['disk_used_gb']:.1f}/{metrics['disk_total_gb']:.1f} GB)",
    ]
    tail = f"⏱ Uptime {fmt_duration(metrics['uptime_seconds'])}"
    if metrics.get("load"):
        one, five, fifteen = metrics["load"]
        tail += f" · load {one:.2f} {five:.2f} {fifteen:.2f}"
    lines.append(tail)
    return lines


def breaches(metrics: dict) -> list[tuple[str, float, float]]:
    """Metrics currently over their alert threshold -> (key, value, threshold)."""
    checks = (
        ("disk", metrics["disk_percent"], config.DISK_ALERT_PERCENT),
        ("ram", metrics["ram_percent"], config.RAM_ALERT_PERCENT),
        ("cpu", metrics["cpu_percent"], config.CPU_ALERT_PERCENT),
    )
    return [(key, value, limit) for key, value, limit in checks if value >= limit]
