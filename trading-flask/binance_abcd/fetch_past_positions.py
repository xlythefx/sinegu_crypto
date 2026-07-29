"""Closed-trades poller — the safety net for the webhook's deferred insert.

Per account: REALIZED_PNL income since the watermark tells us which symbols
closed; userTrades for those symbols are grouped per orderId and every order
with realized PnL becomes one binance_pastpositions row (qty-weighted exit
price, summed PnL). POSTed to /past-positions/sync, which is idempotent on
(api_key, symbol, order_id) — rows the webhook already wrote are only
null-filled, never duplicated.

Watermark: out/last_income_sync.json, one epoch-ms per api_key, replaced
atomically. Closes younger than PAST_POSITIONS_INDEXING_LAG_SECONDS are
deferred (the watermark does not advance past them) because Binance indexes
userTrades with a small delay.
"""

from __future__ import annotations

import json
import logging
import os
import time

from binance_abcd import engine_client
from binance_abcd.accounts_api import account_futures_base_url, fetch_accounts
from binance_abcd.binance_api import BinanceAPI
from binance_abcd.hooks import (
    INCOME_LOOKBACK_HOURS,
    OUT_DIR,
    PAST_POSITIONS_INDEXING_LAG_SECONDS,
)

log = logging.getLogger(__name__)

WATERMARK_FILE = OUT_DIR / "last_income_sync.json"
_MAX_TRADE_PAGES = 5


def _load_watermarks() -> dict[str, int]:
    try:
        with open(WATERMARK_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
        return {k: int(v) for k, v in data.items()} if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_watermarks(marks: dict[str, int]) -> None:
    tmp = WATERMARK_FILE.with_suffix(".json.tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(marks, fh)
        os.replace(tmp, WATERMARK_FILE)
    except OSError:
        log.exception("could not persist watermarks")


def _income_symbols(api: BinanceAPI, since_ms: int) -> set[str]:
    """Symbols with REALIZED_PNL income since since_ms."""
    symbols: set[str] = set()
    for income in api.get_income_history(income_type="REALIZED_PNL", start_time=since_ms):
        symbol = (income.get("symbol") or "").upper()
        if symbol:
            symbols.add(symbol)
    return symbols


def _fetch_symbol_trades(api: BinanceAPI, symbol: str, since_ms: int) -> list[dict]:
    """userTrades for symbol since since_ms, paged forward by time."""
    trades: list[dict] = []
    start = since_ms
    for _ in range(_MAX_TRADE_PAGES):
        params = {"symbol": symbol, "limit": 1000, "startTime": start}
        page = api._request_get("/fapi/v1/userTrades", params)  # noqa: SLF001
        if not isinstance(page, list) or not page:
            break
        trades.extend(page)
        if len(page) < 1000:
            break
        try:
            start = int(page[-1]["time"]) + 1
        except (KeyError, TypeError, ValueError):
            break
    return trades


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

    watermarks = _load_watermarks()
    now_ms = int(time.time() * 1000)
    cutoff_ms = now_ms - int(PAST_POSITIONS_INDEXING_LAG_SECONDS * 1000)
    default_since = now_ms - INCOME_LOOKBACK_HOURS * 3600 * 1000

    all_rows = []
    new_marks = dict(watermarks)

    for account in accounts:
        api_key = account["api_key"]
        since_ms = watermarks.get(api_key, default_since)
        api = BinanceAPI(api_key, account["secret_key"], base_url=account_futures_base_url(account))

        symbols = _income_symbols(api, since_ms)
        if not symbols:
            continue

        account_mark = since_ms
        for symbol in sorted(symbols):
            trades = _fetch_symbol_trades(api, symbol, since_ms)
            for close in _reconstruct_closes(trades, symbol):
                if close["closed_ms"] <= since_ms:
                    continue  # already synced in an earlier cycle
                if close["closed_ms"] > cutoff_ms:
                    continue  # too fresh — defer so Binance finishes indexing
                account_mark = max(account_mark, close["closed_ms"])
                all_rows.append({
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
        new_marks[api_key] = account_mark

    if not all_rows:
        log.info("[past-positions] nothing to sync")
        _save_watermarks(new_marks)
        return None

    result = engine_client.post_json("past-positions/sync", {"rows": all_rows})
    if result is not None:
        # Only advance watermarks once the backend accepted the rows.
        _save_watermarks(new_marks)
        log.info(
            "[past-positions] synced %d row(s): inserted=%s updated=%s skipped=%s",
            len(all_rows), result.get("inserted"), result.get("updated"), result.get("skipped"),
        )
    return result
