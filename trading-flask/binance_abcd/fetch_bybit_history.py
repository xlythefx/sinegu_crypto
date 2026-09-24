"""Closed trades and fee receipts for Bybit accounts.

The Bybit twin of fetch_mexc_history, and materially thinner, because Bybit
publishes what MEXC makes you assemble:

* **Closes come from ``/v5/position/closed-pnl``** — a real closed-trade index
  carrying quantity, both average prices, the realized figure and both fee
  legs. MEXC has no such endpoint, so its poller has to read every filled order
  and then per-symbol deals to reconstruct the same rows.
* **Receipts come from ``/v5/execution/list``** — fills AND
  ``execType=Funding`` rows in ONE paged read. MEXC needs one deals call per
  symbol plus two funding calls.

So the cost per account per tick is TWO requests regardless of how many symbols
the account traded, where MEXC's is ``1 + N_symbols + 2``. That is the
difference that decides how many accounts the venue carries.

The STRUCTURE is unchanged, because the structure is what is correct: two
watermarks, rows younger than PAST_POSITIONS_INDEXING_LAG_SECONDS deferred by
both, a failed history read skipping the account and holding both marks, a
failed receipts page holding the fee mark only, and marks advancing only after
the backend accepted the batch.
"""

from __future__ import annotations

import logging
import time
from typing import Iterable, Optional

from binance_abcd import engine_client
from binance_abcd.accounts_api import fetch_accounts
from binance_abcd.bybit_adapter import closed_gross_pnl, execution_gross_pnl
from binance_abcd.bybit_api import SIDE_BUY, SIDE_SELL, BybitFuturesAPI, num
from binance_abcd.exchanges import client_for, tradeable
from binance_abcd.fee_receipts import (
    FEE_OVERLAP_MS,
    load_marks,
    newest_charge,
    save_marks,
)
from binance_abcd.hooks import (
    FEES_LOOKBACK_HOURS,
    INCOME_LOOKBACK_HOURS,
    OUT_DIR,
    PAST_POSITIONS_INDEXING_LAG_SECONDS,
)

log = logging.getLogger(__name__)

EXCHANGE = "bybit"
WATERMARK_FILE = OUT_DIR / "last_bybit_closes_sync.json"
FEES_WATERMARK_FILE = OUT_DIR / "last_bybit_fees_sync.json"

_MAX_CLOSED_PNL_PAGES = 5   # limit 100 -> 500 closes per tick
_MAX_EXEC_PAGES = 10        # limit 100 -> 1000 executions per tick

# Both endpoints cap a query window at 7 days. Clamping here (rather than
# letting a stale watermark ask for 30) is the twin of the user-trades age
# clamp on the Binance side: a request Bybit refuses would look like "no
# history" and silently advance nothing forever.
_WINDOW_CAP_MS = 7 * 86_400_000 - 5 * 60_000


def _int(value) -> Optional[int]:
    try:
        return int(str(value)) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def closed_pnl_rows(rows: Iterable[dict], since_ms: int, cutoff_ms: int) -> list[dict]:
    """Closed-pnl rows -> bybit_pastpositions rows, grouped by closing order.

    Bybit can answer with more than one closed-pnl row for a single closing
    order (a close that spans position legs). `past-positions/sync` is
    idempotent on (api_key, symbol, order_id), so two such rows would collapse
    onto one another in the DB and silently lose half the trade — they are
    summed into one row here instead.
    """
    grouped: dict[tuple[str, int], dict] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        closed_ms = _int(row.get("updatedTime"))
        order_id = _int(row.get("orderId"))
        symbol = str(row.get("symbol") or "").upper()
        qty = num(row.get("closedSize")) or 0.0
        if closed_ms is None or order_id is None or not symbol or qty <= 0:
            continue
        if closed_ms <= since_ms or closed_ms > cutoff_ms:
            continue
        key = (symbol, order_id)
        bucket = grouped.get(key)
        if bucket is None:
            bucket = grouped[key] = {
                "symbol": symbol, "order_id": order_id, "side": row.get("side"),
                "closed_ms": closed_ms, "qty": 0.0,
                "entry_value": 0.0, "exit_value": 0.0,
                "closed_pnl": 0.0, "open_fee": 0.0, "close_fee": 0.0,
            }
        bucket["qty"] += qty
        bucket["closed_ms"] = max(bucket["closed_ms"], closed_ms)
        bucket["entry_value"] += num(row.get("cumEntryValue")) or 0.0
        bucket["exit_value"] += num(row.get("cumExitValue")) or 0.0
        bucket["closed_pnl"] += num(row.get("closedPnl")) or 0.0
        bucket["open_fee"] += num(row.get("openFee")) or 0.0
        bucket["close_fee"] += num(row.get("closeFee")) or 0.0

    out: list[dict] = []
    for bucket in grouped.values():
        qty = bucket["qty"]
        summed = {
            "symbol": bucket["symbol"],
            "side": bucket["side"],
            "cumEntryValue": bucket["entry_value"],
            "cumExitValue": bucket["exit_value"],
            "closedPnl": bucket["closed_pnl"],
            "openFee": bucket["open_fee"],
            "closeFee": bucket["close_fee"],
            "orderId": bucket["order_id"],
        }
        # `side` on a closed-pnl row is the CLOSING order's side: a Sell closed
        # a long. Kept in one place so closed_gross_pnl and this agree.
        closing_side = str(bucket["side"])
        position_side = "LONG" if closing_side == SIDE_SELL else "SHORT"
        out.append({
            "symbol": bucket["symbol"],
            "position_side": position_side,
            "side": "SELL" if closing_side == SIDE_SELL else "BUY",
            "position_amt": round(qty, 8),
            # Bybit carries the entry price on the closed row; Binance and MEXC
            # do not, so their columns stay null and are never backfilled.
            "entry_price": (bucket["entry_value"] / qty) if qty > 0 and bucket["entry_value"] else None,
            "exit_price": (bucket["exit_value"] / qty) if qty > 0 and bucket["exit_value"] else None,
            "realized_pnl": closed_gross_pnl(summed),
            "order_id": bucket["order_id"],
            "closed_ms": bucket["closed_ms"],
        })
    return out


def execution_receipts(rows: Iterable[dict], since_ms: int, cutoff_ms: int) -> list[dict]:
    """Executions -> exchange_fee_receipts rows, both kinds off one response.

    EVERY execution ships, entries included and zero-fee ones included: its
    quantity is what the API's fee replay needs to attribute a close.
    """
    floor = since_ms - FEE_OVERLAP_MS
    out: list[dict] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        at = _int(row.get("execTime"))
        ref = row.get("execId")
        if at is None or not ref or at <= floor or at > cutoff_ms:
            continue
        symbol = str(row.get("symbol") or "").upper()
        if not symbol:
            continue
        fee = num(row.get("execFee"))
        asset = str(row.get("feeCurrency") or "USDT").upper()
        is_funding = str(row.get("execType")) == "Funding"

        if is_funding:
            out.append({
                "symbol": symbol, "kind": "funding",
                # NOT sign-flipped, unlike Binance income and MEXC
                # funding_records. Those report what the account RECEIVED
                # (negative = paid), so they are negated to make cost positive.
                # Bybit reports funding as an execution FEE, which is already
                # what the account paid — the ledger's own basis. Flipping it
                # would invert every funding charge on the venue, and abs() is
                # not an option either: a funding CREDIT must stay negative.
                "ref": str(ref)[:64], "order_id": None,
                "side": None, "position_side": None, "qty": None, "price": None,
                "realized_pnl": None,
                "amount": fee if fee is not None else 0.0,
                "asset": asset, "charged_at": at,
            })
            continue

        side = str(row.get("side"))
        closed_size = num(row.get("closedSize")) or 0.0
        # Exact in BOTH position modes, and it replaces MEXC's four-code side
        # map: a non-zero closedSize means this execution CLOSED, so a Sell
        # closed a long; a zero one OPENED, so a Buy opened a long.
        if closed_size > 0:
            position_side = "LONG" if side == SIDE_SELL else "SHORT"
        else:
            position_side = "LONG" if side == SIDE_BUY else "SHORT"
        out.append({
            "symbol": symbol, "kind": "fill",
            "ref": str(ref)[:64],
            "order_id": _int(row.get("orderId")),
            "side": "BUY" if side == SIDE_BUY else "SELL",
            "position_side": position_side,
            "qty": num(row.get("execQty")),
            "price": num(row.get("execPrice")),
            "realized_pnl": execution_gross_pnl(row) or 0.0,
            "amount": fee if fee is not None else 0.0,
            "asset": asset, "charged_at": at,
        })
    return out


def fetch_and_save() -> dict | None:
    accounts = [a for a in fetch_accounts(exchange=EXCHANGE) if not tradeable(a)]
    if not accounts:
        log.info("[bybit-history] no accounts")
        return None

    close_marks = load_marks(WATERMARK_FILE)
    fee_marks = load_marks(FEES_WATERMARK_FILE)
    now_ms = int(time.time() * 1000)
    cutoff_ms = now_ms - int(PAST_POSITIONS_INDEXING_LAG_SECONDS * 1000)
    default_close_since = now_ms - INCOME_LOOKBACK_HOURS * 3600 * 1000
    default_fee_since = now_ms - FEES_LOOKBACK_HOURS * 3600 * 1000

    close_rows: list[dict] = []
    receipts: list[dict] = []
    new_close_marks = dict(close_marks)
    new_fee_marks = dict(fee_marks)

    for account in accounts:
        api_key = account["api_key"]
        close_since = close_marks.get(api_key, default_close_since)
        fee_since = fee_marks.get(api_key, default_fee_since)
        api: BybitFuturesAPI = client_for(account).api  # type: ignore[attr-defined]
        tag = {"api_key": api_key, "uni_id": account.get("uni_id")}

        window_start = max(min(close_since, fee_since - FEE_OVERLAP_MS), now_ms - _WINDOW_CAP_MS)

        closes, closes_complete = api.closed_pnl(
            start_ms=window_start, end_ms=now_ms, max_pages=_MAX_CLOSED_PNL_PAGES
        )
        if closes is None:
            log.warning("[bybit-history] closed-pnl read failed for %s — skipping this tick", api_key[:6])
            continue

        close_mark = close_since
        for close in closed_pnl_rows(closes, close_since, cutoff_ms):
            close_mark = max(close_mark, close["closed_ms"])
            row = dict(tag, **close)
            row["closed_at"] = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(row.pop("closed_ms") / 1000))
            row["strategy"] = None
            close_rows.append(row)
        new_close_marks[api_key] = close_mark

        execs, execs_complete = api.executions(
            start_ms=max(fee_since - FEE_OVERLAP_MS, now_ms - _WINDOW_CAP_MS),
            end_ms=now_ms,
            max_pages=_MAX_EXEC_PAGES,
        )
        if execs is None:
            # Closes still post; only the fee mark is held, so the receipts are
            # re-read next tick instead of being skipped forever.
            log.warning("[bybit-history] execution read failed for %s — fee mark held", api_key[:6])
            continue
        account_receipts = [dict(tag, **r) for r in execution_receipts(execs, fee_since, cutoff_ms)]
        receipts.extend(account_receipts)
        if execs_complete and closes_complete:
            new_fee_marks[api_key] = newest_charge(account_receipts, fee_since)

    result = _sync_closes(close_rows, new_close_marks)
    _sync_receipts(receipts, new_fee_marks)
    return result


def _sync_closes(rows: list[dict], marks: dict[str, int]) -> dict | None:
    if not rows:
        log.info("[bybit-history] nothing to sync")
        save_marks(WATERMARK_FILE, marks)
        return None

    result = engine_client.post_json("past-positions/sync", {"rows": rows}, exchange=EXCHANGE)
    if result is not None:
        # Only advance watermarks once the backend accepted the rows.
        save_marks(WATERMARK_FILE, marks)
        log.info(
            "[bybit-history] synced %d row(s): inserted=%s updated=%s skipped=%s",
            len(rows), result.get("inserted"), result.get("updated"), result.get("skipped"),
        )
    return result


def _sync_receipts(rows: list[dict], marks: dict[str, int]) -> dict | None:
    if not rows:
        save_marks(FEES_WATERMARK_FILE, marks)
        return None

    result = engine_client.post_json("fees", {"rows": rows}, exchange=EXCHANGE)
    if result is not None:
        save_marks(FEES_WATERMARK_FILE, marks)
        log.info(
            "[bybit-fees] synced %d receipt(s): inserted=%s rebased=%s unconfirmed=%s errors=%s",
            len(rows), result.get("inserted"), result.get("rebased"),
            result.get("unconfirmed"), result.get("errors"),
        )
    else:
        log.warning("[bybit-fees] backend rejected %d receipt(s) — fee marks held", len(rows))
    return result
