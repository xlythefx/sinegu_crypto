"""Transfers poller: /fapi/v1/income?incomeType=TRANSFER -> POST /transactions.

Looks back TRANSFERS_LOOKBACK_DAYS each cycle; the backend's (api_key, tran_id)
unique key makes re-sending the window idempotent.
"""

from __future__ import annotations

import logging
import time

from binance_abcd import engine_client
from binance_abcd.accounts_api import account_futures_base_url, fetch_accounts
from binance_abcd.binance_api import BinanceAPI
from binance_abcd.hooks import TRANSFERS_LOOKBACK_DAYS

log = logging.getLogger(__name__)


def fetch_and_save() -> dict | None:
    accounts = fetch_accounts()
    if not accounts:
        log.info("[transfers] no accounts")
        return None

    start_time = int((time.time() - TRANSFERS_LOOKBACK_DAYS * 86400) * 1000)
    rows = []
    for account in accounts:
        api = BinanceAPI(account["api_key"], account["secret_key"], base_url=account_futures_base_url(account))
        for income in api.get_income_history(income_type="TRANSFER", start_time=start_time):
            try:
                amount = float(income.get("income") or 0)
                tran_id = int(income.get("tranId"))
            except (TypeError, ValueError):
                continue
            if amount == 0:
                continue
            rows.append({
                "api_key": account["api_key"],
                "uni_id": account.get("uni_id"),
                "type": "DEPOSIT" if amount > 0 else "WITHDRAWAL",
                "amount": abs(amount),
                "tran_id": tran_id,
                "currency": income.get("asset") or "USDT",
                "transaction_time": income.get("time"),
                "info": (income.get("info") or "")[:64] or None,
            })

    if not rows:
        log.info("[transfers] nothing new")
        return None
    result = engine_client.post_json("transactions", {"rows": rows})
    log.info("[transfers] sent %d row(s)", len(rows))
    return result
