"""Tiny JSON state file: what each unit looked like last run, and when each
metric last alerted.

Written atomically (temp file + replace) because the watch job runs every two
minutes and a machine that dies mid-write must not come back to a truncated
file — an unreadable state file is treated as empty, which re-seeds silently
rather than announcing every service as restarted.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile

log = logging.getLogger(__name__)


def load(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save(path: str, data: dict) -> None:
    directory = os.path.dirname(os.path.abspath(path))
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".state-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
        os.replace(tmp, path)
    except Exception as exc:  # noqa: BLE001
        log.warning("could not write state file %s: %s", path, exc)
        try:
            os.unlink(tmp)
        except OSError:
            pass
