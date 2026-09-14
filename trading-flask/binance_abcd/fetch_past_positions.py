"""Closed-trades poller — the safety net for the webhook's deferred insert,
and, since 2026-09-14, the shipper of fee receipts.

Per account, ONE unfiltered /fapi/v1/income call (weight 30 — the engine's
single most expensive read, see PAST_POSITIONS_FETCH_INTERVAL) feeds two
flows off the same response:

* **Closes.** REALIZED_PNL income since the closes watermark tells us which
  symbols closed; userTrades for those symbols are grouped per orderId and
  every order with realized PnL becomes one binance_pastpositions row
  (qty-weighted exit price, summed PnL). POSTed to /past-positions/sync, which
  is idempotent on (api_key, symbol, order_id) — rows the webhook already wrote
  are only null-filled, never duplicated. Unchanged in payload and endpoint.
* **Fee receipts** (fee_receipts.py). COMMISSION income since the FEE watermark
  names every symbol with a fill — entries included, which is the point: the
  closes flow only ever looks at fills since the last close, so an entry made
  before that close would never be seen. Each fill (with its commission) and
  each FUNDING_FEE row is POSTed to /engine/binance/fees, where the API
  replays them into the real fee per close.

One userTrades fetch per symbol serves both flows (its start is the earlier of
the two marks). Extra Binance weight: the userTrades calls (weight 5) for
symbols that had an entry but no close this tick — small next to the income
call both flows share.

Watermarks: out/last_income_sync.json (closes) and out/last_fees_sync.json
(receipts), one epoch-ms per api_key each, replaced atomically, advanced only
after the backend accepted the batch. Rows younger than
PAST_POSITIONS_INDEXING_LAG_SECONDS are deferred (neither mark passes them)
because Binance indexes userTrades with a small delay. A failed income read
skips the account and holds both marks; a failed userTrades read holds the FEE
mark for the account — a receipt skipped once would be skipped forever, since
the next tick starts past it — while the closes flow behaves as before.
"""

from __future__ import annotations

import logging
import time

from binance_abcd import engine_client
from binance_abcd.accounts_api import account_futures_base_url, fetch_accounts
from binance_abcd.binance_api import BinanceAPI
from binance_abcd.fee_receipts import (
    FEES_WATERMARK_FILE,
    fill_receipts,
    funding_receipts,
    load_marks,
    newest_charge,
    partition_income,
    save_marks,
    user_trades_start,
)
from binance_abcd.hooks import (
    FEES_LOOKBACK_HOURS,
    INCOME_LOOKBACK_HOURS,
    OUT_DIR,
    PAST_POSITIONS_INDEXING_LAG_SECONDS,
)

log = logging.getLogger(__name__)

WATERMARK_FILE = OUT_DIR / "last_income_sync.json"
_MAX_TRADE_PAGES = 5
_MAX_INCOME_PAGES = 5
_PAGE = 1000


def _fetch_income(api: BinanceAPI, since_ms: int) -> tuple[list[dict], bool] | None:
    """Every income row since since_ms, paged forward by time.

    ``None`` when the FIRST page fails — nothing is known, the account is
    skipped and both marks hold. A later page failing returns what arrived
    plus ``truncated=True``: the closes flow uses it as it always has (its
    mark only ever advances over closes actually seen), the fee flow holds
    its mark. Calls ``_request_get`` directly rather than
    ``get_income_history`` because that helper folds a failed read into ``[]``
    for callers that only insert — this one must tell them apart.
    """
    rows: list[dict] = []
    start = since_ms
    for _ in range(_MAX_INCOME_PAGES):
        page = api._request_get("/fapi/v1/income", {"limit": _PAGE, "startTime": start})  # noqa: SLF001
        if not isinstance(page, list):
            return None if not rows else (rows, True)
        rows.extend(page)
        if len(page) < _PAGE:
            break
        try:
            # Next page starts after the newest row seen — correct whichever
            # order Binance returns a page in.
            start = max(int(r.get("time") or 0) for r in page if isinstance(r, dict)) + 1
        except (TypeError, ValueError):
            break
    return rows, False


def _fetch_symbol_trades(api: BinanceAPI, symbol: str, since_ms: int) -> tuple[list[dict], bool]:
    """userTrades for symbol since since_ms, paged forward by time.

    Returns ``(fills, complete)``. ``complete`` is False when any page failed
    — the fee flow must then hold its watermark, because fills it never saw
    would otherwise be skipped forever. The closes flow just uses the fills.
    """
    trades: list[dict] = []
    start = since_ms
    for _ in range(_MAX_TRADE_PAGES):
        params = {"symbol": symbol, "limit": _PAGE, "startTime": start}
        page = api._request_get("/fapi/v1/userTrades", params)  # noqa: SLF001
        if not isinstance(page, list):
            return trades, False
        if not page:
            break
        trades.extend(page)
        if len(page) < _PAGE:
            break
        try:
            start = int(page[-1]["time"]) + 1
        except (KeyError, TypeError, ValueError):
            break
    return trades, True


def _reconstruct_closes(trades: list[dict], symbol: str) -> list[dict]:
    """Group fills per orderId; every order with realized PnL is one close."""
    orders: dict[int, list[dict]] = {}
    for trade in trades:
        try:
            order_id = int(trade.get("orderId"))
        except (TypeError, ValueError):
            continue
        orders.setdefault(order_id, []).append(trade)

    closes = []
    for order_id, fills in orders.items():
        pnl = 0.0
        qty = 0.0
        notional = 0.0
        saw_pnl = False
        last_time = 0
        side = ""
        position_side = ""
        for fill in fills:
            try:
                fill_qty = float(fill.get("qty") or 0)
                fill_price = float(fill.get("price") or 0)
            except (TypeError, ValueError):
                continue
            realized = fill.get("realizedPnl")
            try:
                realized_f = float(realized) if realized is not None else 0.0
            except (TypeError, ValueError):
                realized_f = 0.0
            if realized_f != 0.0:
                saw_pnl = True
            pnl += realized_f
            qty += fill_qty
            notional += fill_qty * fill_price
            last_time = max(last_time, int(fill.get("time") or 0))
            side = (fill.get("side") or side or "").upper()
            position_side = (fill.get("positionSide") or position_side or "BOTH").upper()

        # Opening orders have zero realizedPnl on every fill — skip them.
        if not saw_pnl or qty <= 0:
            continue
        if position_side == "BOTH":
            # One-way: a closing SELL closed a LONG, a closing BUY closed a SHORT.
            position_side = "LONG" if side == "SELL" else "SHORT"
        closes.append({
            "symbol": symbol,
            "order_id": order_id,
            "position_side": position_side,
            "side": side or ("SELL" if position_side == "LONG" else "BUY"),
            "position_amt": round(qty, 8),
            "exit_price": round(notional / qty, 8) if qty else None,
            "realized_pnl": round(pnl, 8),
            "closed_ms": last_time,
        })
    return closes


def fetch_and_save() -> dict | None:
    accounts = fetch_accounts()
    if not accounts:
        log.info("[past-positions] no accounts")
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
        api = BinanceAPI(api_key, account["secret_key"], base_url=account_futures_base_url(account))

        income = _fetch_income(api, min(close_since, fee_since))
        if income is None:
            log.warning("[past-positions] income read failed for %s — skipping this tick", api_key[:6])
            continue
        income_rows, truncated = income
        parts = partition_income(income_rows, close_since, fee_since)

        symbols = parts.close_symbols | parts.fee_symbols
        if not symbols and not parts.funding:
            continue

        close_mark = close_since
        fees_complete = not truncated
        account_receipts = funding_receipts(parts.funding, account, fee_since, cutoff_ms)
        trades_start = user_trades_start(close_since, fee_since, now_ms)

        for symbol in sorted(symbols):
            trades, complete = _fetch_symbol_trades(api, symbol, trades_start)
            if not complete and symbol in parts.fee_symbols:
                fees_complete = False

            if symbol in parts.close_symbols:
                for close in _reconstruct_closes(trades, symbol):
                    if close["closed_ms"] <= close_since:
                        continue  # already synced in an earlier cycle
                    if close["closed_ms"] > cutoff_ms:
                        continue  # too fresh — defer so Binance finishes indexing
                    close_mark = max(close_mark, close["closed_ms"])
                    close_rows.append({
                        "api_key": api_key,
                        "uni_id": account.get("uni_id"),
                        "symbol": close["symbol"],
                        "position_side": close["position_side"],
                        "position_amt": close["position_amt"],
                        "entry_price": None,  # not derivable from fills
                        "exit_price": close["exit_price"],
                        "realized_pnl": close["realized_pnl"],
                        "side": close["side"],
                        "order_id": close["order_id"],
                        "closed_at": time.strftime(
                            "%Y-%m-%d %H:%M:%S", time.gmtime(close["closed_ms"] / 1000)
                        ),
                        "strategy": None,
                    })

            if symbol in parts.fee_symbols:
                account_receipts.extend(fill_receipts(trades, symbol, account, fee_since, cutoff_ms))

        new_close_marks[api_key] = close_mark
        receipts.extend(account_receipts)
        if fees_complete:
            new_fee_marks[api_key] = newest_charge(account_receipts, fee_since)

    result = _sync_closes(close_rows, new_close_marks)
    _sync_receipts(receipts, new_fee_marks)
    return result


def _sync_closes(rows: list[dict], marks: dict[str, int]) -> dict | None:
    if not rows:
        log.info("[past-positions] nothing to sync")
        save_marks(WATERMARK_FILE, marks)
        return None

    result = engine_client.post_json("past-positions/sync", {"rows": rows})
    if result is not None:
        # Only advance watermarks once the backend accepted the rows.
        save_marks(WATERMARK_FILE, marks)
        log.info(
            "[past-positions] synced %d row(s): inserted=%s updated=%s skipped=%s",
            len(rows), result.get("inserted"), result.get("updated"), result.get("skipped"),
        )
    return result


def _sync_receipts(rows: list[dict], marks: dict[str, int]) -> dict | None:
    if not rows:
        save_marks(FEES_WATERMARK_FILE, marks)
        return None

    result = engine_client.post_json("fees", {"rows": rows})
    if result is not None:
        save_marks(FEES_WATERMARK_FILE, marks)
        log.info(
            "[fees] synced %d receipt(s): inserted=%s rebased=%s unconfirmed=%s errors=%s",
            len(rows), result.get("inserted"), result.get("rebased"),
            result.get("unconfirmed"), result.get("errors"),
        )
    else:
        log.warning("[fees] backend rejected %d receipt(s) — fee marks held", len(rows))
    return result
