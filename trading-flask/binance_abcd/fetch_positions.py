"""Open-positions poller: every account's open positions -> POST /positions/sync,
per exchange.

Full-replace semantics per api_key (the backend deletes the account's rows and
re-inserts the snapshot), so closed positions disappear on the next cycle.
The adapter answers in the row shape the backend stores (symbol as a ticker,
size in coins, SHORT negative), whatever the venue's own units.
"""

from __future__ import annotations

import logging

from binance_abcd import engine_client
from binance_abcd.accounts_api import fetch_accounts
from binance_abcd.exchanges import client_for, exchange_of, tradeable

log = logging.getLogger(__name__)


def fetch_and_save(api_keys: list[str] | None = None) -> dict | None:
    """Sync open positions to the backend.

    ``api_keys`` narrows the run to specific accounts (an admin's "Refresh"
    on one user); None — the poller's and Admin → Trading Positions' call —
    means every tradeable account.
    """
    accounts = fetch_accounts()
    if api_keys is not None:
        wanted = set(api_keys)
        accounts = [a for a in (accounts or []) if a.get("api_key") in wanted]
    if not accounts:
        log.info("[positions] no accounts")
        return None

    payload_by_exchange: dict[str, list[dict]] = {}
    skipped = 0
    for account in accounts:
        if tradeable(account):
            continue
        client = client_for(account)
        rows = client.open_positions_rows()
        if rows is None:
            # SKIP, never sync an empty list on a failed read. The sync is a
            # full replace per api_key, so sending [] here would delete this
            # account's live positions from the DB — and the entry-side stack
            # cap counts open size from exactly those rows, so it would then
            # read 0 open and let a position stack past its limit. Leaving the
            # rows untouched keeps them merely stale, which the next successful
            # tick corrects. Same rule as the balance poller.
            log.warning("[positions] read failed for %s — leaving its rows alone", account.get("name"))
            skipped += 1
            continue
        payload_by_exchange.setdefault(exchange_of(account), []).append({
            "api_key": account["api_key"],
            "uni_id": account.get("uni_id"),
            "positions": rows,
        })

    if not payload_by_exchange:
        if skipped:
            log.warning("[positions] every account read failed (%d) — nothing synced", skipped)
        return None
    result = None
    for exchange, payload in payload_by_exchange.items():
        result = engine_client.post_json("positions/sync", {"accounts": payload}, exchange=exchange)
        log.info(
            "[positions] synced %d %s account(s)%s",
            len(payload), exchange, f", {skipped} skipped on read failure" if skipped else "",
        )
    return result
