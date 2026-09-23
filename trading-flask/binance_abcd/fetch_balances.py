"""Balance poller: one account read per account -> POST /balances, per exchange.

Sends balance + unrealized PnL; initial_deposit rides along and the backend
only applies it when the account has none yet. Rows are grouped by exchange
and posted to each venue's own /engine/{exchange}/balances.
"""

from __future__ import annotations

import logging

from binance_abcd import engine_client, key_status
from binance_abcd.accounts_api import fetch_accounts
from binance_abcd.exchanges import client_for, exchange_of, tradeable

log = logging.getLogger(__name__)


def _settle_trade_verdict(account: dict, client) -> None:
    """Ask the venue whether this key may TRADE, and record the answer.

    Only ever called on a TARGETED refresh — the trader's "recheck" button and
    the admin's — because it costs one extra call and answers a question the
    poller does not need to ask every five minutes.

    It exists because a balance read cannot settle this verdict: reading is
    exactly what a key missing the futures permission can still do, so the
    button that says "I've fixed it — recheck" would otherwise clear nothing
    and report success on a key that still cannot place an order.

    Best-effort in both directions: an unknown answer (MEXC, a testnet key, a
    failed diagnostic) leaves whatever verdict is standing untouched.
    """
    try:
        allowed = client.trade_permission()
    except Exception:  # noqa: BLE001 - a diagnostic must never fail a refresh
        return
    if allowed is None:
        return
    exchange = exchange_of(account)
    if allowed:
        key_status.report_ok(account["api_key"], exchange, scope=key_status.TRADE)
    else:
        key_status.report_blocked(
            account["api_key"], -2015, "TRADE_PERMISSION",
            "Futures trading is not enabled on this API key.",
            exchange, scope=key_status.TRADE,
        )


def fetch_and_save(api_keys: list[str] | None = None) -> dict | None:
    """Sync balances to the backend.

    ``api_keys`` narrows the run to specific accounts — that is what the
    trader-facing "Refresh balance" button uses, so one person pressing it
    costs one exchange call instead of one per account on the platform. None
    (the poller's call) means every tradeable account.
    """
    accounts = fetch_accounts()
    targeted = api_keys is not None
    if targeted:
        wanted = set(api_keys or [])
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
        if targeted:
            # The read just proved the key READS. Someone is waiting on an
            # answer about whether it can trade, which is a different question.
            _settle_trade_verdict(account, client)
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
