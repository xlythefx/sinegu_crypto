"""No network, no systemd, no Telegram — every test drives pure functions or
monkeypatched state. `deploy-telegram` gates on this suite passing.
"""

from __future__ import annotations

import logging

import pytest
import requests

from pixel_telegram import config, metrics as metrics_mod, services, state as state_mod
from pixel_telegram import telegram
from pixel_telegram.main import build_report, service_changes, threshold_alerts


# --- Rendering ----------------------------------------------------------------

@pytest.mark.parametrize("percent,expected", [
    (0, "░░░░░░░░░░"),
    (50, "█████░░░░░"),
    (100, "██████████"),
    (-5, "░░░░░░░░░░"),   # clamped, never a negative repeat count
    (140, "██████████"),  # clamped, never wider than the bar
])
def test_bar_is_always_ten_cells(percent, expected):
    assert metrics_mod.bar(percent) == expected
    assert len(metrics_mod.bar(percent)) == 10


@pytest.mark.parametrize("percent,expected", [
    (0, "🟢"), (74.9, "🟢"), (75, "🟠"), (89.9, "🟠"), (90, "🔴"), (100, "🔴"),
])
def test_dot_thresholds_at_the_boundary(percent, expected):
    assert metrics_mod.dot(percent) == expected


@pytest.mark.parametrize("seconds,expected", [
    (0, "0m"), (90, "1m"), (3600, "1h 0m"), (86400 * 5 + 3600 * 3, "5d 3h"),
])
def test_fmt_duration(seconds, expected):
    assert metrics_mod.fmt_duration(seconds) == expected


def _metrics(cpu=10.0, ram=20.0, disk=30.0):
    return {"cpu_percent": cpu, "ram_percent": ram, "ram_used_gb": 1.0,
            "ram_total_gb": 4.0, "disk_percent": disk, "disk_used_gb": 10.0,
            "disk_total_gb": 48.0, "uptime_seconds": 3600.0, "load": None}


def _unit(name="nginx", active="active", monotonic=1000, available=True):
    return {"unit": name, "available": available, "active": active, "sub": "running",
            "since_monotonic": monotonic, "started_at": None, "restarts": 0}


def test_report_names_every_unit_and_survives_a_missing_engine():
    body = build_report(_metrics(), [_unit(), _unit("sinegualerts-engine", "failed")], None)
    assert config.label_for("nginx") in body
    assert config.label_for("sinegualerts-engine") in body
    assert "/health not answering" in body
    assert "🔴" in body  # the failed unit is visible without reading the words


# --- Unit names vs the labels people read -------------------------------------

def test_the_engine_unit_is_shown_by_its_product_name(monkeypatch):
    """systemctl must be asked for `sinegualerts-engine` (renaming that unit
    breaks the deploy), but nobody reading the group should see the address.

    Asserted against the shipped default rather than config.UNITS, so a local
    .env cannot make this pass or fail by accident.
    """
    units, labels = config._parse_units(config._DEFAULT_UNITS)
    assert "sinegualerts-engine" in units
    assert labels["sinegualerts-engine"] == "Pixel Alpha engine"

    monkeypatch.setattr(config, "UNIT_LABELS", labels)
    body = build_report(_metrics(), [_unit("sinegualerts-engine")], None)
    assert "Pixel Alpha engine" in body
    assert "sinegualerts-engine" not in body


def test_units_parse_with_and_without_labels():
    units, labels = config._parse_units("a=Alpha, b ,, c=  ")
    assert units == ("a", "b", "c")
    # An entry with no label (or an empty one) falls back to the unit name,
    # which is true rather than blank.
    assert labels == {"a": "Alpha", "b": "b", "c": "c"}


def test_relabelling_does_not_re_announce_a_service(monkeypatch):
    """State is keyed by the unit, so changing what a service is CALLED must
    not make it look brand new and report itself as restarted."""
    _, seen = service_changes({}, [_unit("nginx")])
    monkeypatch.setattr(config, "UNIT_LABELS", {"nginx": "Something else"})
    lines, _ = service_changes(seen, [_unit("nginx")])
    assert lines == []


# --- Restart detection --------------------------------------------------------

def test_first_run_seeds_silently():
    lines, seen = service_changes({}, [_unit()])
    assert lines == []
    assert seen == {"nginx": "active:1000"}


def test_first_run_still_reports_a_unit_that_is_already_down():
    lines, _ = service_changes({}, [_unit(active="failed")])
    assert len(lines) == 1 and "nginx" in lines[0]


def test_unchanged_unit_is_silent():
    lines, _ = service_changes({"nginx": "active:1000"}, [_unit()])
    assert lines == []


def test_restart_fires_once_then_goes_quiet():
    previous = {"nginx": "active:1000"}
    lines, seen = service_changes(previous, [_unit(monotonic=2000)])
    assert len(lines) == 1 and "restarted" in lines[0]
    # Same state on the next tick -> nothing.
    assert service_changes(seen, [_unit(monotonic=2000)])[0] == []


def test_a_stopped_service_reports_as_down_not_restarted():
    lines, _ = service_changes({"nginx": "active:1000"}, [_unit(active="inactive", monotonic=0)])
    assert len(lines) == 1 and "went" in lines[0]


def test_unreadable_unit_is_skipped_entirely():
    lines, seen = service_changes({}, [_unit(available=False, active="unknown")])
    assert lines == [] and seen == {}


# --- Thresholds ---------------------------------------------------------------

def test_breach_alerts_then_is_suppressed_by_the_cooldown():
    metrics = _metrics(disk=95.0)
    lines, alerts = threshold_alerts(metrics, {}, now=1000.0, cooldown_seconds=3600)
    assert len(lines) == 1 and "Disk" in lines[0]
    assert alerts["disk"] == 1000.0

    quiet, _ = threshold_alerts(metrics, alerts, now=1600.0, cooldown_seconds=3600)
    assert quiet == []

    later, _ = threshold_alerts(metrics, alerts, now=5000.0, cooldown_seconds=3600)
    assert len(later) == 1


def test_recovery_rearms_the_alert_immediately():
    _, alerts = threshold_alerts(_metrics(disk=95.0), {}, now=1000.0, cooldown_seconds=3600)
    # Back under the threshold: the cooldown entry is dropped ...
    _, cleared = threshold_alerts(_metrics(disk=10.0), alerts, now=1100.0, cooldown_seconds=3600)
    assert cleared == {}
    # ... so the next breach alerts even though an hour has not passed.
    lines, _ = threshold_alerts(_metrics(disk=95.0), cleared, now=1200.0, cooldown_seconds=3600)
    assert len(lines) == 1


def test_nothing_over_threshold_is_silent():
    lines, alerts = threshold_alerts(_metrics(), {}, now=1000.0, cooldown_seconds=3600)
    assert lines == [] and alerts == {}


# --- Transport & state --------------------------------------------------------

def test_send_is_a_noop_without_credentials(monkeypatch):
    monkeypatch.setattr(config, "BOT_TOKEN", "")
    monkeypatch.setattr(config, "CHAT_ID", "")
    monkeypatch.setattr(telegram.requests, "post",
                        lambda *a, **k: pytest.fail("must not call Telegram"))
    assert telegram.send("hello") is False


def test_state_roundtrip_and_unreadable_file(tmp_path):
    path = str(tmp_path / "nested" / "state.json")
    state_mod.save(path, {"units": {"nginx": "active:1"}})
    assert state_mod.load(path)["units"]["nginx"] == "active:1"

    with open(path, "w", encoding="utf-8") as f:
        f.write("{ truncated")
    assert state_mod.load(path) == {}          # treated as empty, never a crash
    assert state_mod.load(str(tmp_path / "missing.json")) == {}


def test_fingerprint_changes_on_restart_and_on_stop():
    assert services.fingerprint(_unit()) == "active:1000"
    assert services.fingerprint(_unit(monotonic=2000)) != services.fingerprint(_unit())
    assert services.fingerprint(_unit(active="failed")) != services.fingerprint(_unit())


# --- The token never reaches the journal ----------------------------------------

def _armed(monkeypatch):
    monkeypatch.setattr(config, "ENABLED", True)
    monkeypatch.setattr(config, "BOT_TOKEN", "123456:SHOULD-NOT-APPEAR")
    monkeypatch.setattr(config, "CHAT_ID", "-1001")


def test_a_failed_send_never_logs_the_bot_token(monkeypatch, caplog):
    """A requests error quotes the URL it failed on, and the token is IN it
    (/bot<TOKEN>/sendMessage) — the one line a failed alert leaves must not
    hand the bot to whoever reads the journal."""
    _armed(monkeypatch)

    def refused(url, **kwargs):
        raise requests.ConnectionError(f"Max retries exceeded with url: {url}")

    monkeypatch.setattr(telegram.requests, "post", refused)
    with caplog.at_level(logging.WARNING, logger="pixel_telegram.telegram"):
        assert telegram.send("hello") is False

    assert "SHOULD-NOT-APPEAR" not in caplog.text
    assert "/bot***/sendMessage" in caplog.text


def test_a_refused_send_is_scrubbed_too(monkeypatch, caplog):
    _armed(monkeypatch)

    class _Refused:
        ok = False
        status_code = 401
        text = "Unauthorized: bot123456:SHOULD-NOT-APPEAR"

    monkeypatch.setattr(telegram.requests, "post", lambda *a, **k: _Refused())
    with caplog.at_level(logging.WARNING, logger="pixel_telegram.telegram"):
        assert telegram.send("hello") is False

    assert "SHOULD-NOT-APPEAR" not in caplog.text and "401" in caplog.text
