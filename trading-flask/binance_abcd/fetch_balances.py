"""Balance poller: Binance /fapi/v3/account per account -> POST /balances.

Sends balance + unrealized PnL; initial_deposit rides along and the backend
only applies it when the account has none yet.
"""

from __future__ import annotations

import logging

from binance_abcd import engine_client
from binance_abcd.accounts_api import account_futures_base_url, fetch_accounts
from binance_abcd.binance_api import BinanceAPI

log = logging.getLogger(__name__)


def fetch_and_save() -> dict | None:
    accounts = fetch_accounts()
    if not accounts:
        log.info("[balances] no accounts")
        return None

    rows = []
    for account in accounts:
        api = BinanceAPI(account["api_key"], account["secret_key"], base_url=account_futures_base_url(account))
        acc = api.get_account_v3()
        if not isinstance(acc, dict):
            log.warning("[balances] account read failed for %s", account.get("name"))
            continue
        try:
            balance = float(acc.get("totalWalletBalance") or 0)
            unrealized = float(acc.get("totalUnrealizedProfit") or 0)
        except (TypeError, ValueError):
            continue
        rows.append({
            "api_key": account["api_key"],
            "balance": balance,
            "unrealized_pnl": unrealized,
            "initial_deposit": balance,  # backend applies only when unset
        })

    if not rows:
        return None
    result = engine_client.post_json("balances", {"rows": rows})
    log.info("[balances] synced %d account(s)", len(rows))
    return result
