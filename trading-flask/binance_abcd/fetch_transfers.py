"""Transfers poller: each venue's deposit/withdrawal history -> POST /transactions,
per exchange.

Looks back TRANSFERS_LOOKBACK_DAYS each cycle; the backend's (api_key, tran_id)
unique key makes re-sending the window idempotent. A venue whose read failed
(the adapter answers None) contributes nothing this tick and is retried next.
"""

from __future__ import annotations

import logging
import time

from binance_abcd import engine_client
from binance_abcd.accounts_api import fetch_accounts
from binance_abcd.exchanges import client_for, exchange_of, tradeable
from binance_abcd.hooks import TRANSFERS_LOOKBACK_DAYS

log = logging.getLogger(__name__)


def fetch_and_save() -> dict | None:
    accounts = fetch_accounts()
    if not accounts:
        log.info("[transfers] no accounts")
        return None

    start_time = int((time.time() - TRANSFERS_LOOKBACK_DAYS * 86400) * 1000)
    rows_by_exchange: dict[str, list[dict]] = {}
    for account in accounts:
        if tradeable(account):
            continue
        client = client_for(account)
        transfers = client.transfers_since(start_time)
        if transfers is None:
            log.warning("[transfers] read failed for %s — nothing sent this tick", account.get("name"))
            continue
        for transfer in transfers:
            rows_by_exchange.setdefault(exchange_of(account), []).append({
                "api_key": account["api_key"],
                "uni_id": account.get("uni_id"),
                **transfer,
            })

    if not rows_by_exchange:
        log.info("[transfers] nothing new")
        return None
    result = None
    for exchange, rows in rows_by_exchange.items():
        result = engine_client.post_json("transactions", {"rows": rows}, exchange=exchange)
        log.info("[transfers] sent %d %s row(s)", len(rows), exchange)
    return result
