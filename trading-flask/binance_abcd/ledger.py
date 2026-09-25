"""An account's full money history from the exchange's own ledger — the source
of truth for what was deposited, withdrawn, and held before we connected.

Why it exists: the transfers poller only ever asks for the last
TRANSFERS_LOOKBACK_DAYS, and `initial_deposit` was the wallet balance at the
first poll. Both answers are partial, and together they double-count: a
customer who deposits, then connects, has the deposit stored once as their
initial balance AND once more as the transfer the poller finds in its 3-day
window. On 2026-09-25 two real customer accounts carried roughly twice the
capital they had.

Binance keeps about six months of income history (every TRANSFER,
REALIZED_PNL, COMMISSION, FUNDING_FEE…), and that ledger reconciles to the
wallet to the cent — verified on the master account that day: 11,321 rows
summing to exactly its walletBalance. So instead of guessing, we compute:

    opening balance = wallet balance now − Σ every income row we can see

That is the money the account held BEFORE the oldest row Binance still
returns. For an account younger than the retention window it is 0 — every
dollar is then explained by a real transfer — and for an older one it is the
honest remainder that `initial_deposit` must stand in for.

Binance only. Pure apart from the two reads it is handed.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

log = logging.getLogger(__name__)

# Ask for more than Binance keeps; it simply answers with what it has.
LOOKBACK_DAYS = 400
PAGE_LIMIT = 1000
# 1000 rows a page. A very active account runs to tens of thousands of rows
# over six months (the master: 11,321 in 12 pages). A cap reached means the
# read is INCOMPLETE, and an incomplete ledger must never set a balance.
MAX_PAGES = 200
PAGE_PAUSE_SECONDS = 0.3
# A trade can land between the wallet read and the last page. The wallet is
# read on both sides of the ledger and the whole read retried if it moved.
STABLE_ATTEMPTS = 3

# Income that is the account's CAPITAL moving, as opposed to what trading did
# to it. The same single type the transfers poller stores.
FLOW_TYPES = frozenset({"TRANSFER"})
# What trading does to a futures wallet. Anything outside both sets is still
# summed (the opening balance must reconcile) but named, so a human can see
# money that is neither a transfer nor a trade before trusting the figure.
TRADING_TYPES = frozenset({"REALIZED_PNL", "COMMISSION", "FUNDING_FEE"})

ASSET = "USDT"


def _usdt_wallet(account: Any) -> tuple[Optional[float], dict[str, float]]:
    """(USDT walletBalance, {other asset: walletBalance}) — None if unreadable."""
    if not isinstance(account, dict):
        return None, {}
    usdt = None
    others: dict[str, float] = {}
    for row in account.get("assets") or []:
        try:
            value = float(row.get("walletBalance") or 0)
        except (TypeError, ValueError):
            continue
        if row.get("asset") == ASSET:
            usdt = value
        elif abs(value) > 1e-8:
            others[str(row.get("asset"))] = value
    return usdt, others


def _read_pages(api: Any, start_ms: int) -> tuple[Optional[list[dict]], bool, int]:
    """(rows ascending, truncated, pages) — rows None when any page failed."""
    seen: set = set()
    rows: list[dict] = []
    start = start_ms
    for page_no in range(1, MAX_PAGES + 1):
        page = api.get_income_page(start, PAGE_LIMIT)
        if page is None:
            return None, False, page_no
        new = 0
        for row in page:
            # tranId is only unique WITHIN an income type, and the next page
            # starts AT the last row's timestamp (inclusive) so rows sharing a
            # millisecond are never skipped — hence the de-duplication.
            key = (row.get("incomeType"), row.get("tranId"), row.get("symbol"), row.get("time"))
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)
            new += 1
        if len(page) < PAGE_LIMIT or new == 0:
            return rows, False, page_no
        start = int(page[-1]["time"])
        time.sleep(PAGE_PAUSE_SECONDS)
    return rows, True, MAX_PAGES


def summarize(rows: list[dict], wallet: float, other_wallets: dict[str, float]) -> dict:
    """The ledger payload the API plans a backfill from. Pure."""
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    non_usdt: dict[str, int] = {}
    transfers: list[dict] = []
    total = 0.0
    for row in rows:
        kind = str(row.get("incomeType") or "")
        asset = str(row.get("asset") or "")
        try:
            amount = float(row.get("income") or 0)
        except (TypeError, ValueError):
            continue
        if asset != ASSET:
            non_usdt[asset] = non_usdt.get(asset, 0) + 1
            continue
        total += amount
        sums[kind] = sums.get(kind, 0.0) + amount
        counts[kind] = counts.get(kind, 0) + 1
        if kind in FLOW_TYPES and amount != 0:
            try:
                tran_id = int(row.get("tranId"))
            except (TypeError, ValueError):
                continue
            # Same shape BinanceAdapter.transfers_since posts, so a transfer
            # the poller already stored is recognised by its tran_id.
            transfers.append({
                "type": "DEPOSIT" if amount > 0 else "WITHDRAWAL",
                "amount": abs(amount),
                "tran_id": tran_id,
                "currency": asset,
                "transaction_time": int(row.get("time") or 0),
                "info": (row.get("info") or "")[:64] or None,
            })

    return {
        "wallet_balance": round(wallet, 8),
        "income_total": round(total, 8),
        "opening_balance": round(wallet - total, 8),
        "ledger_start": int(rows[0]["time"]) if rows else None,
        "ledger_end": int(rows[-1]["time"]) if rows else None,
        "rows": len(rows),
        "sums": {k: round(v, 8) for k, v in sorted(sums.items())},
        "counts": dict(sorted(counts.items())),
        "unclassified_types": sorted(k for k in sums if k not in FLOW_TYPES | TRADING_TYPES),
        # A ledger or wallet in several currencies cannot be summed into one
        # USDT balance; the API refuses to set anything from either.
        "non_usdt_rows": non_usdt,
        "other_wallets": {k: round(v, 8) for k, v in other_wallets.items()},
        "transfers": transfers,
    }


def read(api: Any, now_ms: Optional[int] = None) -> Optional[dict]:
    """The account's ledger, reconciled to its wallet — None when it cannot be
    read completely and consistently (a failed page, or a wallet that kept
    moving while the pages were read)."""
    now_ms = now_ms or int(time.time() * 1000)
    start_ms = now_ms - LOOKBACK_DAYS * 86_400_000
    for attempt in range(1, STABLE_ATTEMPTS + 1):
        before, others = _usdt_wallet(api.get_account_v3())
        if before is None:
            return None
        rows, truncated, pages = _read_pages(api, start_ms)
        if rows is None:
            log.warning("[ledger] an income page failed — ledger not usable")
            return None
        after, _ = _usdt_wallet(api.get_account_v3())
        if after is None:
            return None
        if abs(after - before) <= 1e-8:
            payload = summarize(rows, after, others)
            payload["pages"] = pages
            payload["truncated"] = truncated
            return payload
        log.info("[ledger] wallet moved during the read (attempt %d) — retrying", attempt)
    log.warning("[ledger] wallet kept moving over %d attempts — ledger not usable", STABLE_ATTEMPTS)
    return None
