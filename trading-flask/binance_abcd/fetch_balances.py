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

    Called on a TARGETED refresh (the trader's "recheck" button and the
    admin's) and on every poll of an account already FLAGGED — never on a
    healthy account's poll, where it would be one extra call per account per
    tick to re-answer a question that only changes when a human edits a key.

    It exists because a balance read cannot settle this verdict: reading is
    exactly what a key missing the futures permission can still do, so the
    button that says "I've fixed it — recheck" would otherwise clear nothing
    and report success on a key that still cannot place an order. Polling the
    flagged ones is the same rule stated the other way — an account we stop
    probing can never recover, and a trade verdict is not reachable by any
    other path: entries are skipped while blocked, and a flat account has no
    exit to try.

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
        if targeted or account.get("key_blocked"):
            # The read just proved the key READS, which is a different question
            # from whether it may trade. Asked when someone is waiting on the
            # answer (a recheck), and on every tick for an account already
            # flagged — a trade verdict cannot clear itself, because a blocked
            # account is skipped on entries and a flat one never exits, so
            # without this the poll would be the only thing still running and
            # it would never notice the key was fixed.
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
