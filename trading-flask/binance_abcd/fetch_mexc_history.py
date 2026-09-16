"""MEXC closed trades + fee receipts — the MEXC twin of fetch_past_positions.

Binance's poller hangs off one income statement; MEXC has no such index, so
this one reads the account's own order and deal history instead. Per MEXC
account, per tick:

1. ``history_orders(states=3)`` over the window since the OLDER of the two
   watermarks — every FILLED order on every contract, entries included.
2. For each contract that had a filled order, ``order_deals`` — the fills, with
   their ``fee`` / ``feeCurrency`` / ``profit`` (the MEXC twin of userTrades).
3. ``funding_records`` for both position types (the endpoint requires one).

Two flows come off that:

* **Closes.** Every filled order with a closing side (2 = close short, 4 =
  close long) becomes one mexc_pastpositions row: quantity in COINS (dealVol ×
  contractSize), exit price vol-weighted over its deals (falling back to the
  order's dealAvgPrice), realized P&L summed from the deals' ``profit``.
  POSTed to /engine/mexc/past-positions/sync — idempotent on (api_key, symbol,
  order_id), so rows the webhook already wrote are only null-filled.
* **Receipts.** Every deal — entries included, which is the point — becomes a
  ``fill`` receipt (``amount`` = ``fee``, already positive when paid), every
  funding record a ``funding`` receipt (sign flipped: MEXC reports what the
  account received, the ledger records cost). POSTed to /engine/mexc/fees,
  where the API replays them into the actual fee per close.

Watermarks: out/last_mexc_closes_sync.json and out/last_mexc_fees_sync.json,
one epoch-ms per api_key, advanced only after the backend accepted the batch.
Rows younger than PAST_POSITIONS_INDEXING_LAG_SECONDS are deferred (neither
mark passes them) so MEXC can finish indexing an order's deals. The same
empty-vs-unavailable rule as every other poller: a failed history read skips
the account and holds both marks; a failed deals page or funding read holds
the FEE mark (a receipt skipped once would be skipped forever); the closes
flow posts what it saw either way, its mark only ever advancing over closes
actually seen.
"""

from __future__ import annotations

import logging
import time
from typing import Iterable, Optional

from binance_abcd import engine_client
from binance_abcd.accounts_api import fetch_accounts
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
from binance_abcd.mexc_adapter import deal_pnl
from binance_abcd.mexc_api import (
    POSITION_LONG,
    POSITION_SHORT,
    SIDE_CLOSE_LONG,
    SIDE_CLOSE_SHORT,
    SIDE_OPEN_LONG,
    SIDE_OPEN_SHORT,
    MexcFuturesAPI,
    to_ticker,
)

log = logging.getLogger(__name__)

EXCHANGE = "mexc"
WATERMARK_FILE = OUT_DIR / "last_mexc_closes_sync.json"
FEES_WATERMARK_FILE = OUT_DIR / "last_mexc_fees_sync.json"

_MAX_ORDER_PAGES = 5
_ORDER_PAGE = 100
_MAX_DEAL_PAGES = 3
_DEAL_PAGE = 1000
_MAX_FUNDING_PAGES = 3
_FUNDING_PAGE = 100

CLOSE_SIDES = frozenset({SIDE_CLOSE_SHORT, SIDE_CLOSE_LONG})

# MEXC side code -> (DB side, position_side). 1 open long / 2 close short are
# BUYs; 3 open short / 4 close long are SELLs.
_SIDE_MAP = {
    SIDE_OPEN_LONG: ("BUY", "LONG"),
    SIDE_CLOSE_SHORT: ("BUY", "SHORT"),
    SIDE_OPEN_SHORT: ("SELL", "SHORT"),
    SIDE_CLOSE_LONG: ("SELL", "LONG"),
}


def _int(value) -> Optional[int]:
    try:
        return int(str(value)) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _num(value) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def side_of(code) -> tuple[Optional[str], Optional[str]]:
    """(BUY|SELL, LONG|SHORT) for a MEXC side code; (None, None) when unknown."""
    return _SIDE_MAP.get(_int(code), (None, None))


def _contract_size(contracts: dict, symbol: str) -> Optional[float]:
    size = _num((contracts.get(symbol) or {}).get("contractSize"))
    return size if size and size > 0 else None


# --- fetchers (paged; None on a failed FIRST page) ------------------------------

def _fetch_history_orders(api: MexcFuturesAPI, start_ms: int, end_ms: int) -> Optional[tuple[list[dict], bool]]:
    """(orders, truncated). None when the first page fails — nothing is known."""
    rows: list[dict] = []
    for page in range(1, _MAX_ORDER_PAGES + 1):
        batch = api.history_orders(start_ms=start_ms, end_ms=end_ms, page_num=page, page_size=_ORDER_PAGE)
        if batch is None:
            return None if page == 1 else (rows, True)
        rows.extend(r for r in batch if isinstance(r, dict))
        if len(batch) < _ORDER_PAGE:
            return rows, False
    return rows, True  # more pages than we read — treat as truncated for the fee mark


def _fetch_deals(api: MexcFuturesAPI, symbol: str, start_ms: int, end_ms: int) -> tuple[list[dict], bool]:
    """(deals, complete). complete=False when any page failed."""
    rows: list[dict] = []
    for page in range(1, _MAX_DEAL_PAGES + 1):
        batch = api.order_deals(symbol, start_ms=start_ms, end_ms=end_ms, page_num=page, page_size=_DEAL_PAGE)
        if batch is None:
            return rows, False
        rows.extend(r for r in batch if isinstance(r, dict))
        if len(batch) < _DEAL_PAGE:
            return rows, True
    return rows, False


def _fetch_funding(api: MexcFuturesAPI, start_ms: int, end_ms: int) -> Optional[list[dict]]:
    """Both position types; None when any page of either fails."""
    rows: list[dict] = []
    for position_type in (POSITION_LONG, POSITION_SHORT):
        for page in range(1, _MAX_FUNDING_PAGES + 1):
            batch = api.funding_records(
                position_type, start_ms=start_ms, end_ms=end_ms, page_num=page, page_size=_FUNDING_PAGE
            )
            if batch is None:
                return None
            rows.extend(r for r in batch if isinstance(r, dict))
            if len(batch) < _FUNDING_PAGE:
                break
    return rows


# --- builders (pure) -------------------------------------------------------------

def history_closes(
    orders: Iterable[dict],
    deals_by_symbol: dict[str, list[dict]],
    contracts: dict,
    since_ms: int,
    cutoff_ms: int,
) -> list[dict]:
    """Filled closing orders -> past-position rows (without api_key/uni_id).

    ``since_ms`` is the closes watermark (rows at or before it were synced in an
    earlier cycle); rows younger than ``cutoff_ms`` are deferred so MEXC can
    finish indexing their deals. Each row carries ``closed_ms`` for the caller's
    watermark.
    """
    closes: list[dict] = []
    for order in orders:
        side_code = _int(order.get("side"))
        if side_code not in CLOSE_SIDES:
            continue
        deal_vol = _num(order.get("dealVol")) or 0.0
        order_id = _int(order.get("orderId"))
        symbol = str(order.get("symbol") or "").upper()
        closed_ms = _int(order.get("updateTime")) or _int(order.get("createTime")) or 0
        if deal_vol <= 0 or order_id is None or not symbol:
            continue
        if closed_ms <= since_ms or closed_ms > cutoff_ms:
            continue
        size = _contract_size(contracts, symbol)
        if size is None:
            log.warning("[mexc-history] no contract size for %s — close %s skipped this tick", symbol, order_id)
            continue

        fills = [d for d in deals_by_symbol.get(symbol, []) if _int(d.get("orderId")) == order_id]
        pnl = 0.0
        saw_pnl = False
        notional = 0.0
        qty = 0.0
        for deal in fills:
            price = _num(deal.get("price")) or 0.0
            vol = _num(deal.get("vol")) or 0.0
            notional += price * vol
            qty += vol
            profit = deal_pnl(deal)
            if profit is not None:
                pnl += profit
                saw_pnl = True
        if qty > 0:
            exit_price: Optional[float] = round(notional / qty, 8)
            realized: Optional[float] = round(pnl, 8) if saw_pnl else None
        else:
            # Deals not indexed (or outside the deals window): the order's own
            # averages stand in; the next tick's overlap can null-fill nothing
            # more, so this is final for the row.
            exit_price = _num(order.get("dealAvgPrice"))
            realized = _num(order.get("profit"))

        side, position_side = _SIDE_MAP[side_code]
        closes.append({
            "symbol": to_ticker(symbol),
            "position_side": position_side,
            "position_amt": round(deal_vol * size, 8),
            "entry_price": None,  # not derivable from the closing order
            "exit_price": exit_price,
            "realized_pnl": realized,
            "side": side,
            "order_id": order_id,
            "closed_ms": closed_ms,
        })
    return closes


def deal_receipts(
    deals: Iterable[dict], symbol: str, contracts: dict, since_ms: int, cutoff_ms: int
) -> list[dict]:
    """order_deals rows -> ``fill`` receipts (without api_key/uni_id), one per deal,
    entries included. ``since_ms`` is the fee watermark; deals older than it
    minus the overlap are on the ledger already, younger than ``cutoff_ms`` are
    deferred and the caller's mark must not pass them."""
    receipts: list[dict] = []
    floor = since_ms - FEE_OVERLAP_MS
    size = _contract_size(contracts, symbol)
    if size is None:
        log.warning("[fees] no contract size for %s — its receipts wait for the next tick", symbol)
        return receipts
    for deal in deals:
        if not isinstance(deal, dict):
            continue
        at = _int(deal.get("timestamp"))
        ref = _int(deal.get("id"))
        order_id = _int(deal.get("orderId"))
        vol = _num(deal.get("vol"))
        price = _num(deal.get("price"))
        fee = _num(deal.get("fee"))
        if at is None or ref is None or order_id is None or vol is None or price is None or fee is None:
            log.warning("[fees] skipping malformed deal on %s: %r", symbol, deal)
            continue
        if at <= floor or at > cutoff_ms:
            continue
        side, position_side = side_of(deal.get("side"))
        receipts.append({
            "symbol": to_ticker(symbol),
            "kind": "fill",
            "ref": ref,
            "order_id": order_id,
            "side": side,
            "position_side": position_side,
            "qty": round(vol * size, 8),
            "price": price,
            "realized_pnl": deal_pnl(deal) or 0.0,
            "amount": fee,  # positive = the account paid; a rebate stays negative
            "asset": str(deal.get("feeCurrency") or "USDT").upper(),
            "charged_at": at,
        })
    return receipts


def funding_receipts_mexc(rows: Iterable[dict], since_ms: int, cutoff_ms: int) -> list[dict]:
    """funding_records rows -> ``funding`` receipts (without api_key/uni_id).
    Sign flipped like Binance's: MEXC's ``funding`` is what the account RECEIVED
    (as its ``holdFee`` is documented: positive received, negative paid); the
    ledger records cost, so a payment is positive."""
    receipts: list[dict] = []
    floor = since_ms - FEE_OVERLAP_MS
    for row in rows:
        if not isinstance(row, dict):
            continue
        at = _int(row.get("settleTime"))
        ref = _int(row.get("id"))
        funding = _num(row.get("funding"))
        symbol = str(row.get("symbol") or "").upper()
        if at is None or ref is None or funding is None or not symbol:
            log.warning("[fees] skipping malformed funding row: %r", row)
            continue
        if at <= floor or at > cutoff_ms:
            continue
        receipts.append({
            "symbol": to_ticker(symbol),
            "kind": "funding",
            "ref": ref,
            "order_id": None,
            "side": None,
            "position_side": None,
            "qty": None,
            "price": None,
            "realized_pnl": None,
            "amount": -funding,
            "asset": "USDT",
            "charged_at": at,
        })
    return receipts


# --- the tick -------------------------------------------------------------------

def fetch_and_save() -> dict | None:
    accounts = [a for a in fetch_accounts(exchange=EXCHANGE) if not tradeable(a)]
    if not accounts:
        log.info("[mexc-history] no accounts")
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
        api: MexcFuturesAPI = client_for(account).api  # type: ignore[attr-defined]

        contracts = api.contracts()
        if contracts is None:
            log.warning("[mexc-history] contract specs unavailable — skipping %s this tick", api_key[:6])
            continue

        window_start = min(close_since, fee_since - FEE_OVERLAP_MS)
        history = _fetch_history_orders(api, window_start, now_ms)
        if history is None:
            log.warning("[mexc-history] order history read failed for %s — skipping this tick", api_key[:6])
            continue
        orders, truncated = history
        fees_complete = not truncated
        close_mark = close_since
        account_receipts: list[dict] = []
        tag = {"api_key": api_key, "uni_id": account.get("uni_id")}

        symbols = sorted({str(o.get("symbol") or "").upper() for o in orders if o.get("symbol")})
        deals_by_symbol: dict[str, list[dict]] = {}
        for symbol in symbols:
            deals, complete = _fetch_deals(api, symbol, window_start, now_ms)
            if not complete:
                fees_complete = False
            deals_by_symbol[symbol] = deals
            account_receipts.extend(
                dict(tag, **r) for r in deal_receipts(deals, symbol, contracts, fee_since, cutoff_ms)
            )

        for close in history_closes(orders, deals_by_symbol, contracts, close_since, cutoff_ms):
            close_mark = max(close_mark, close["closed_ms"])
            row = dict(tag, **close)
            row["closed_at"] = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(row.pop("closed_ms") / 1000))
            row["strategy"] = None
            close_rows.append(row)

        funding = _fetch_funding(api, fee_since - FEE_OVERLAP_MS, now_ms)
        if funding is None:
            fees_complete = False
        else:
            account_receipts.extend(dict(tag, **r) for r in funding_receipts_mexc(funding, fee_since, cutoff_ms))

        new_close_marks[api_key] = close_mark
        receipts.extend(account_receipts)
        if fees_complete:
            new_fee_marks[api_key] = newest_charge(account_receipts, fee_since)

    result = _sync_closes(close_rows, new_close_marks)
    _sync_receipts(receipts, new_fee_marks)
    return result


def _sync_closes(rows: list[dict], marks: dict[str, int]) -> dict | None:
    if not rows:
        log.info("[mexc-history] nothing to sync")
        save_marks(WATERMARK_FILE, marks)
        return None

    result = engine_client.post_json("past-positions/sync", {"rows": rows}, exchange=EXCHANGE)
    if result is not None:
        # Only advance watermarks once the backend accepted the rows.
        save_marks(WATERMARK_FILE, marks)
        log.info(
            "[mexc-history] synced %d row(s): inserted=%s updated=%s skipped=%s",
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
            "[mexc-fees] synced %d receipt(s): inserted=%s rebased=%s unconfirmed=%s errors=%s",
            len(rows), result.get("inserted"), result.get("rebased"),
            result.get("unconfirmed"), result.get("errors"),
        )
    else:
        log.warning("[mexc-fees] backend rejected %d receipt(s) — fee marks held", len(rows))
    return result
