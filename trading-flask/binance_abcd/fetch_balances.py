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


def fetch_and_save(api_keys: list[str] | None = None) -> dict | None:
    """Sync balances to the backend.

    ``api_keys`` narrows the run to specific accounts — that is what the
    trader-facing "Refresh balance" button uses, so one person pressing it
    costs one Binance call instead of one per account on the platform. None
    (the poller's call) means every tradeable account.
    """
    accounts = fetch_accounts()
    if api_keys is not None:
        wanted = set(api_keys)
        accounts = [a for a in accounts if a.get("api_key") in wanted]
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
