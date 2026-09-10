"""pixel-telegram — VPS ops alerts for the Pixel Alpha admin group.

Two systemd timers drive the same script:

  report   every 4 hours   one snapshot: CPU / RAM / disk, uptime, each watched
                           unit's state, and the engine's own /health
  watch    every 2 minutes silent unless something CHANGED — a service
                           restarted or went down, or a resource crossed its
                           threshold (rate-limited by a cooldown)

Deliberately standalone: it does not import ``binance_abcd``, because the case
it exists for is the engine being the thing that is down.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime

import requests

from pixel_telegram import config, metrics as metrics_mod, services, state as state_mod
from pixel_telegram.telegram import esc, get_updates, send

log = logging.getLogger("pixel_telegram")


# --- Engine health ------------------------------------------------------------

def engine_health() -> dict | None:
    """The engine's /health, best-effort. None when it does not answer — which
    the report shows as a line of its own rather than omitting silently."""
    try:
        response = requests.get(config.ENGINE_HEALTH_URL, timeout=5)
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else None
    except Exception:  # noqa: BLE001
        return None


def engine_line(health: dict | None) -> str:
    if health is None:
        return "🤖 engine: <i>/health not answering</i>"
    pollers = health.get("pollers") or []
    parts = [f"pollers {len(pollers)}" if pollers else "pollers off",
             f"retry queue {health.get('retry_queue_depth', 0)}"]
    if health.get("rate_limited_until"):
        parts.append("⚠️ rate-limited")
    return "🤖 engine: " + esc(" · ".join(parts))


# --- Message building ---------------------------------------------------------

def build_report(metrics: dict, unit_states: list[dict], health: dict | None) -> str:
    lines = [f"🖥 <b>{esc(config.VPS_NAME)}</b>",
             f"<i>{datetime.now().strftime('%a %d %b %Y · %H:%M')}</i>",
             ""]
    lines += metrics_mod.resource_lines(metrics)
    lines += ["", "<b>Services</b>"]
    for unit in unit_states:
        dot = services.status_dot(unit)
        name = esc(config.label_for(unit["unit"]))
        if not unit["available"]:
            lines.append(f"{dot} {name} · <i>not readable here</i>")
        elif services.is_healthy(unit):
            up = metrics_mod.fmt_duration(services.uptime_seconds(unit))
            lines.append(f"{dot} {name} · up {up}")
        else:
            detail = "/".join(p for p in (unit["active"], unit["sub"]) if p)
            lines.append(f"{dot} {name} · <b>{esc(detail)}</b>")
    lines += ["", engine_line(health)]
    return "\n".join(lines)


def service_changes(seen: dict, unit_states: list[dict]) -> tuple[list[str], dict]:
    """Alert lines for units whose state changed, plus the map to store.

    A unit not in ``seen`` is being observed for the first time: it is seeded
    silently, otherwise the very first run after a deploy announces every
    service on the box as freshly restarted. The one exception is a unit that
    is already DOWN on that first run — that is not noise, it is the report.
    """
    lines: list[str] = []
    updated = dict(seen)

    for unit in unit_states:
        key = unit["unit"]
        if not unit["available"]:
            continue  # nothing to compare (no systemctl, or unit not installed)
        current = services.fingerprint(unit)
        previous = seen.get(key)
        updated[key] = current
        # Keyed by the UNIT (the address that stays stable across a relabel),
        # displayed by the LABEL — renaming a label must not make every service
        # look brand new and re-announce itself as restarted.
        name = esc(config.label_for(key))

        if previous is None:
            if not services.is_healthy(unit):
                lines.append(f"🔴 <b>{name}</b> is {esc(unit['active'])}"
                             f"{'/' + esc(unit['sub']) if unit['sub'] else ''}")
            continue
        if current == previous:
            continue

        if services.is_healthy(unit):
            up = metrics_mod.fmt_duration(services.uptime_seconds(unit))
            lines.append(f"♻️ <b>{name}</b> restarted · running {up}")
        else:
            detail = "/".join(p for p in (unit["active"], unit["sub"]) if p)
            lines.append(f"🔴 <b>{name}</b> went {esc(detail)}")

    return lines, updated


def threshold_alerts(metrics: dict, alerts: dict, now: float,
                     cooldown_seconds: float) -> tuple[list[str], dict]:
    """Lines for metrics over their threshold, honouring the per-metric cooldown.

    A metric that has dropped back under its threshold is cleared from the
    cooldown map, so a recovery re-arms the alert immediately instead of the
    box going quiet for the rest of the hour.
    """
    labels = {"cpu": ("CPU", "cpu_percent"), "ram": ("RAM", "ram_percent"),
              "disk": ("Disk", "disk_percent")}
    over = {key: (value, limit) for key, value, limit in metrics_mod.breaches(metrics)}
    updated = {k: v for k, v in alerts.items() if k in over}
    lines: list[str] = []

    for key, (value, limit) in over.items():
        last = alerts.get(key)
        # A metric with no recorded alert always fires. Defaulting it to 0 and
        # comparing would make "never alerted" mean "alerted at the epoch",
        # which is only ever true by accident of the clock being large.
        if last is not None and now - float(last) < cooldown_seconds:
            continue
        label, _ = labels[key]
        lines.append(f"🔴 <b>{label} {value:.0f}%</b> — over the {limit:.0f}% threshold "
                     f"on {esc(config.VPS_NAME)}")
        updated[key] = now

    return lines, updated


# --- Commands -----------------------------------------------------------------

def cmd_report(args) -> int:
    metrics = metrics_mod.collect()
    unit_states = services.collect(config.UNITS)
    body = build_report(metrics, unit_states, engine_health())
    return 0 if send(body, dry=args.dry) else 1


def cmd_watch(args) -> int:
    store = state_mod.load(config.STATE_FILE)
    now = time.time()

    unit_states = services.collect(config.UNITS)
    service_lines, seen = service_changes(store.get("units") or {}, unit_states)

    metrics = metrics_mod.collect()
    metric_lines, alerts = threshold_alerts(
        metrics, store.get("alerts") or {}, now, config.ALERT_COOLDOWN_MINUTES * 60)

    store["units"] = seen
    store["alerts"] = alerts
    store["last_watch_at"] = now
    state_mod.save(config.STATE_FILE, store)

    lines = service_lines + metric_lines
    if not lines:
        log.info("watch: nothing changed")
        return 0

    body = "\n".join([f"⚠️ <b>{esc(config.VPS_NAME)}</b>", ""] + lines)
    return 0 if send(body, dry=args.dry) else 1


def cmd_test(args) -> int:
    watching = ", ".join(config.label_for(u) for u in config.UNITS)
    body = (f"✅ <b>pixel-telegram</b> is wired up\n"
            f"Reporting <b>{esc(config.VPS_NAME)}</b> · "
            f"watching {esc(watching) or 'no units'}")
    return 0 if send(body, dry=args.dry) else 1


def cmd_chat_id(args) -> int:
    """Print the chat ids the bot can currently see.

    Telegram only reveals a group through an update, so send any message in the
    group first. A supergroup id starts -100 and CHANGES if a plain group is
    later upgraded — if messages stop arriving, run this again.
    """
    seen = {}
    for update in get_updates():
        for key in ("message", "edited_message", "channel_post", "my_chat_member"):
            chat = (update.get(key) or {}).get("chat")
            if chat:
                seen[chat["id"]] = f"{chat.get('type')} · {chat.get('title') or chat.get('username') or ''}"
    if not seen:
        print("No updates. Send a message in the group, then run this again.")
        print("(If the bot has privacy mode on, add it as an admin first.)")
        return 1
    for chat_id, label in seen.items():
        print(f"{chat_id}\t{label}")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="pixel-telegram", description=__doc__)
    # --dry is declared per subcommand only. A copy on the top-level parser
    # would be silently overwritten by the subparser's own default, so
    # `main --dry report` would send for real.
    sub = parser.add_subparsers(dest="command")
    for name, fn, help_text in (
        ("report", cmd_report, "post the 4-hourly resource + services snapshot"),
        ("watch", cmd_watch, "post only if a service or resource changed"),
        ("test", cmd_test, "post one line to prove the chat id works"),
        ("chat-id", cmd_chat_id, "print the chat ids the bot can see"),
    ):
        p = sub.add_parser(name, help=help_text)
        p.add_argument("--dry", action="store_true",
                       help="print the message instead of sending it")
        p.set_defaults(func=fn)

    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return 2

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s")
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
