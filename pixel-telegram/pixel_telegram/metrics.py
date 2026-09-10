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


def collect(cpu_interval: float = 1.0) -> dict:
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage(config.DISK_PATH if os.path.exists(config.DISK_PATH) else os.path.abspath(os.sep))
    return {
        "cpu_percent": psutil.cpu_percent(interval=cpu_interval),
        "ram_percent": memory.percent,
        "ram_used_gb": memory.used / GB,
        "ram_total_gb": memory.total / GB,
        "disk_percent": disk.used / disk.total * 100 if disk.total else 0.0,
        "disk_used_gb": disk.used / GB,
        "disk_total_gb": disk.total / GB,
        "uptime_seconds": max(0.0, time.time() - psutil.boot_time()),
        "load": _load_average(),
    }


def resource_lines(metrics: dict) -> list[str]:
    lines = [
        f"{dot(metrics['cpu_percent'])} <b>CPU</b>  <code>{bar(metrics['cpu_percent'])}</code> "
        f"{metrics['cpu_percent']:.0f}%",
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
