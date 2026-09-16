"""Balance poller: one account read per account -> POST /balances, per exchange.

Sends balance + unrealized PnL; initial_deposit rides along and the backend
only applies it when the account has none yet. Rows are grouped by exchange
and posted to each venue's own /engine/{exchange}/balances.
"""

from __future__ import annotations

import logging

from binance_abcd import engine_client
from binance_abcd.accounts_api import fetch_accounts
from binance_abcd.exchanges import client_for, exchange_of, tradeable

log = logging.getLogger(__name__)


def fetch_and_save(api_keys: list[str] | None = None) -> dict | None:
    """Sync balances to the backend.

    ``api_keys`` narrows the run to specific accounts — that is what the
    trader-facing "Refresh balance" button uses, so one person pressing it
    costs one exchange call instead of one per account on the platform. None
    (the poller's call) means every tradeable account.
    """
    accounts = fetch_accounts()
    if api_keys is not None:
        wanted = set(api_keys)
        accounts = [a for a in accounts if a.get("api_key") in wanted]
    if not accounts:
        log.info("[balances] no accounts")
        return None

    rows_by_exchange: dict[str, list[dict]] = {}
    for account in accounts:
        if tradeable(account):
            continue  # a row that cannot be traded on its venue is not polled either
        client = client_for(account)
        balance = client.account_balance()
        if balance is None:
            log.warning("[balances] account read failed for %s", account.get("name"))
            continue
        wallet, unrealized = balance
        rows_by_exchange.setdefault(exchange_of(account), []).append({
            "api_key": account["api_key"],
            "balance": wallet,
            "unrealized_pnl": unrealized,
            "initial_deposit": wallet,  # backend applies only when unset
        })

    if not rows_by_exchange:
        return None
    result = None
    for exchange, rows in rows_by_exchange.items():
        result = engine_client.post_json("balances", {"rows": rows}, exchange=exchange)
        log.info("[balances] synced %d %s account(s)", len(rows), exchange)
    return result
