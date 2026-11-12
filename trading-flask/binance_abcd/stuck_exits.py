"""Tell the API a CLOSE needs a person NOW, so it can email (2026-11-12).

The failed-trade email is hourly, except for this: an exit the exchange
refused outright, or one the retry queue gave up on, may leave a REAL position
open — money at risk — and must not wait up to an hour. Called from the same
two places that send the red "EXIT FAILED — MANUAL ACTION REQUIRED" Telegram
alert (webhook._notify_job and retry_queue._requeue), main feed only.

Best-effort and off the trading path: one daemon thread per venue, a failed
POST is logged by engine_client and dropped (Telegram already carries it).
The API decides who gets the email (TRADE_ALERT_EMAILS) and words it.
"""

from __future__ import annotations

import threading

from binance_abcd import engine_client

# How many accounts one email lists (the rest are counted).
MAX_ACCOUNTS = 50


def report(action: str, ticker: str, accounts: list[dict], *, why: str, attempts: int | None = None) -> None:
    """`accounts` = [{exchange, uni_id?, name?, error?}]. `why` = "rejected"
    (refused outright) or "abandoned" (the retries ran out). Exits only."""
    if not str(action).upper().startswith("EXIT") or not accounts:
        return
    by_venue: dict[str, list[dict]] = {}
    for a in accounts:
        by_venue.setdefault(str(a.get("exchange") or "binance"), []).append({
            "uni_id": a.get("uni_id"),
            "name": a.get("name"),
            "error": (str(a.get("error"))[:300] if a.get("error") else None),
        })
    for exchange, rows in by_venue.items():
        payload = {
            "action": str(action).upper(), "ticker": str(ticker).upper(), "why": why,
            "attempts": attempts, "accounts": rows[:MAX_ACCOUNTS], "total": len(rows),
        }
        threading.Thread(
            target=engine_client.post_json, args=("alerts/exit-stuck", payload),
            kwargs={"exchange": exchange}, daemon=True, name="stuck-exit-mail",
        ).start()
