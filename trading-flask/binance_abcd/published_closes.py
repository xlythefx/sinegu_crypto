"""Every PnL percentage the public channel has published on a close.

The daily recap is the SUM of these, per venue, per calendar day — so a day
whose only close read ``PnL: +2.224%`` recaps as ``Return: +2.224%``, and two
closes of +1.100% and -0.300% recap as +0.800%. A reader adding up the channel
by hand gets the recap's number, every time.

Until 2026-09-28 the daily recap was the track record's day percentage instead:
the master's P&L over the capital WALKED from its deposits, where a close
divides by the wallet the exchange reported. Two honest measures, two different
denominators, and the channel printed both for the same trade (27 Sep: a lone
close of +2.224% under a daily of +2.189%). The weekly and monthly recaps still
chain the track record — they span days, and only the daily is ever set beside
the closes it covers.

Append-only JSON lines in ``out/`` (server-owned, excluded from the deploy
sync). Nothing here raises: a recap falls back to the track record for a day
the file cannot answer, and a failed append must never cost the close message.
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import date, datetime, timezone
from typing import Any, Optional

from binance_abcd import hooks

log = logging.getLogger(__name__)

LEDGER_FILE = hooks.OUT_DIR / "published_closes.jsonl"

_lock = threading.Lock()


def record(
    exchange: Optional[str],
    symbol: str,
    pct: float,
    increments: Any = None,
    at: Optional[datetime] = None,
) -> None:
    """Remember one published close. `pct` is stored ROUNDED to the 3 dp the
    channel printed, so the recap sums the figures a reader actually saw."""
    if not exchange:
        return
    try:
        count = int(round(float(increments))) if increments is not None else None
    except (TypeError, ValueError):
        count = None
    row = {
        "at": (at or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat(),
        "exchange": str(exchange).lower(),
        "symbol": str(symbol),
        "pct": round(float(pct), 3),
        "increments": count if count and count > 0 else None,
    }
    try:
        with _lock:
            LEDGER_FILE.parent.mkdir(parents=True, exist_ok=True)
            with LEDGER_FILE.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(row) + "\n")
    except Exception as exc:  # noqa: BLE001 - bookkeeping never costs a message
        log.warning("[published_closes] could not record %s %s: %s", exchange, symbol, exc)


def day_summary(exchange: str, day: date, tzinfo) -> Optional[dict]:
    """The closes published for `exchange` on `day` (a calendar day in
    `tzinfo`, the track record's own zone), rolled up; None when none were.

    ``{"return_pct", "trades", "assets": [{"symbol", "pct", "trades"}, ...]}``
    — trades count INCREMENTS, the same rule as the track record and the
    ``Increments Closed (n/cap)`` line (a close with no depth counts as 1).
    """
    try:
        with _lock:
            lines = LEDGER_FILE.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return None
    except Exception as exc:  # noqa: BLE001
        log.warning("[published_closes] unreadable (%s) — recap falls back", exc)
        return None

    wanted = str(exchange).lower()
    total = 0.0
    trades = 0
    by_symbol: dict[str, dict] = {}
    for line in lines:
        try:
            row = json.loads(line)
            if row.get("exchange") != wanted:
                continue
            when = datetime.fromisoformat(row["at"]).astimezone(tzinfo).date()
            pct = float(row["pct"])
        except (ValueError, KeyError, TypeError):
            continue
        if when != day:
            continue
        count = row.get("increments") or 1
        total += pct
        trades += count
        symbol = str(row.get("symbol") or "?")
        entry = by_symbol.setdefault(symbol, {"symbol": symbol, "pct": 0.0, "trades": 0})
        entry["pct"] += pct
        entry["trades"] += count

    if not by_symbol:
        return None
    return {
        "return_pct": total,
        "trades": trades,
        "assets": sorted(by_symbol.values(), key=lambda a: (-a["pct"], a["symbol"])),
    }
