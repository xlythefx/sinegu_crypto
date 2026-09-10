"""Open-positions poller: /fapi/v3/positionRisk per account -> POST /positions/sync.

Full-replace semantics per api_key (the backend deletes the account's rows and
re-inserts the snapshot), so closed positions disappear on the next cycle.
"""

from __future__ import annotations

import logging

from binance_abcd import engine_client
from binance_abcd.accounts_api import account_futures_base_url, fetch_accounts
from binance_abcd.binance_api import BinanceAPI

log = logging.getLogger(__name__)

_FIELDS = {
    "entry_price": "entryPrice",
    "mark_price": "markPrice",
    "unrealized_profit": "unRealizedProfit",
    "notional": "notional",
    "initial_margin": "initialMargin",
    "maint_margin": "maintMargin",
    "isolated_margin": "isolatedMargin",
    "isolated_wallet": "isolatedWallet",
}


def _to_row(position: dict) -> dict | None:
    try:
        amt = float(position.get("positionAmt") or 0)
    except (TypeError, ValueError):
        return None
    if amt == 0:
        return None
    row = {
        "symbol": (position.get("symbol") or "").upper(),
        "position_side": (position.get("positionSide") or "BOTH").upper(),
        "position_amt": amt,
        "update_time": position.get("updateTime"),
    }
    for ours, theirs in _FIELDS.items():
        value = position.get(theirs)
        try:
            row[ours] = float(value) if value is not None else None
        except (TypeError, ValueError):
            row[ours] = None
    return row if row["symbol"] else None


def fetch_and_save() -> dict | None:
    accounts = fetch_accounts()
    if not accounts:
        log.info("[positions] no accounts")
        return None

    payload = []
    skipped = 0
    for account in accounts:
        api = BinanceAPI(account["api_key"], account["secret_key"], base_url=account_futures_base_url(account))
        positions = api.get_positions_v3()
        if positions is None:
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
        rows = [row for row in (_to_row(p) for p in positions) if row]
        payload.append({
            "api_key": account["api_key"],
            "uni_id": account.get("uni_id"),
            "positions": rows,
        })

    if not payload:
        if skipped:
            log.warning("[positions] every account read failed (%d) — nothing synced", skipped)
        return None
    result = engine_client.post_json("positions/sync", {"accounts": payload})
    log.info(
        "[positions] synced %d account(s)%s",
        len(payload), f", {skipped} skipped on read failure" if skipped else "",
    )
    return result
