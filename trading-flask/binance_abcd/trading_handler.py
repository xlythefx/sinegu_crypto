"""Per-account trade execution for BINANCE_ABCD.

BUY = market buy (open/stack LONG). SELL = market sell (open/stack SHORT).
EXIT_LONG / EXIT_SHORT = reduce-only close of that side. Every handler takes a
ready BinanceAPI client (built per account with the right base_url, so demo
accounts hit the testnet) and returns a dict the webhook aggregates.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from binance_abcd.binance_api import (
    BinanceAPI,
    error_summary,
    invalidate_position_mode,
    is_position_mode_verified,
    mark_position_mode_verified,
)
from binance_abcd.hooks import (
    EXIT_RETRY_ATTEMPTS,
    EXIT_RETRY_SECONDS,
    FILL_SUMMARY_ATTEMPTS,
    FILL_SUMMARY_RETRY_SECONDS,
    POSITION_MODE,
)

log = logging.getLogger(__name__)


def want_hedge() -> bool:
    return POSITION_MODE in ("hedge", "dual", "long_short")


def ensure_position_mode(api: BinanceAPI, ticker: str) -> Optional[Dict[str, Any]]:
    """Error dict when the account's position mode can't be aligned; None when fine.
    Skips the live check while the api_key's verified-cache entry is fresh."""
    if is_position_mode_verified(api.api_key):
        return None
    ok, err = api.ensure_position_mode_matches(want_hedge())
    if ok:
        mark_position_mode_verified(api.api_key)
        return None
    return {
        "result": None,
        "error": err,
        "binance_response": "",
        "symbol": ticker,
        "status": "position_mode_mismatch",
    }


def _place_market_order_retry(
    api: BinanceAPI,
    symbol: str,
    side: str,
    quantity: float,
    *,
    reduce_only: bool = False,
) -> Optional[Dict[str, Any]]:
    """place_market_order; on -4061 re-sync hedge mode once and retry."""
    result = api.place_market_order(symbol, side, quantity, reduce_only=reduce_only, position_mode=POSITION_MODE)
    if isinstance(result, dict) and result.get("_error"):
        response = str(result.get("response", ""))
        if "-4061" in response and want_hedge():
            log.warning("[Binance] -4061 on order — re-syncing hedge mode and retrying once")
            invalidate_position_mode(api.api_key)
            ok, _ = api.ensure_position_mode_matches(True)
            if ok:
                mark_position_mode_verified(api.api_key)
                result = api.place_market_order(
                    symbol, side, quantity, reduce_only=reduce_only, position_mode=POSITION_MODE
                )
    return result


def get_order_fill_summary(api: BinanceAPI, symbol: str, order_id: Any) -> tuple[Optional[float], Optional[float]]:
    """(summed realizedPnl, qty-weighted exit price) across every fill of order_id.

    One close can produce several fills; summing all of them is required or the
    PnL under-reports. Called deferred, off the close path.

    RETRIED, because Binance answers this query with an empty list for a second
    or two after the order fills — the trade exists, the index does not carry it
    yet. One attempt is why closes reached Telegram with no `PnL:` and no
    `Exit Price:` line at all: not an error, just nothing to report, so both
    lines were omitted rather than published as a guess. The waiting happens
    inside the exit batch's TELEGRAM_PNL_WAIT_SECONDS watchdog, so the message
    still goes out on time — keep the worst case (the sum of the backoffs)
    comfortably under it.
    """
    try:
        oid = int(order_id)
    except (TypeError, ValueError):
        return None, None

    trades: Optional[list] = None
    for attempt in range(1, max(1, FILL_SUMMARY_ATTEMPTS) + 1):
        trades = api.get_user_trades(symbol, order_id=oid, limit=50)
        if trades:
            break
        if attempt < FILL_SUMMARY_ATTEMPTS:
            time.sleep(FILL_SUMMARY_RETRY_SECONDS * attempt)
    if not trades:
        # Not fatal: the row is still written (with NULLs) and the
        # past-positions poller backfills it from /fapi/v1/income later. Only
        # the Telegram message, which is sent once and never edited, loses out.
        log.warning(
            "[Binance] no fills returned for %s order %s after %d attempt(s) — "
            "PnL will be backfilled by the poller, not published",
            symbol, oid, max(1, FILL_SUMMARY_ATTEMPTS),
        )
        return None, None
    pnl = 0.0
    notional = 0.0
    qty = 0.0
    saw_pnl = False
    for trade in trades:
        try:
            price = float(trade.get("price") or 0)
            fill_qty = float(trade.get("qty") or 0)
        except (TypeError, ValueError):
            continue
        notional += price * fill_qty
        qty += fill_qty
        realized = trade.get("realizedPnl")
        if realized is not None:
            try:
                pnl += float(realized)
                saw_pnl = True
            except (TypeError, ValueError):
                pass
    exit_price = (notional / qty) if qty > 0 else None
    return (pnl if saw_pnl else None), exit_price


def position_risk_map(api: BinanceAPI, symbol: str) -> Optional[Dict[str, tuple]]:
    """One GET /fapi/v3/positionRisk -> {positionSide: (signed_amt, entry_price)}.
    None on read failure, {} when flat."""
    sym = symbol.upper()
    try:
        risk = api.get_positions_v3(sym)
    except Exception as exc:  # noqa: BLE001
        log.warning("[Binance] positionRisk read failed for %s: %s", sym, exc)
        return None
    if risk is None:
        return None
    out: Dict[str, tuple] = {}
    for p in risk:
        if (p.get("symbol") or "").upper() != sym:
            continue
        try:
            amt = float(p.get("positionAmt") or 0)
        except (TypeError, ValueError):
            amt = 0.0
        if amt == 0:
            continue
        side = (p.get("positionSide") or "BOTH").upper()
        try:
            entry = float(p["entryPrice"]) if p.get("entryPrice") is not None else None
        except (TypeError, ValueError):
            entry = None
        out[side] = (amt, entry)
    return out


def _order_failed(result: Any) -> bool:
    return result is None or (isinstance(result, dict) and result.get("_error"))


def _failure_dict(result: Any, ticker: str) -> Dict[str, Any]:
    """Normalized failure. `transient` is the one field callers act on: it marks
    a request that failed on the way (timeout, 408/-1007, 5xx) rather than an
    order the exchange refused, and only those are worth re-attempting."""
    if isinstance(result, dict):
        return {
            "result": None,
            "error": error_summary(result),
            "binance_response": result.get("response", ""),
            "symbol": ticker,
            "http_status": result.get("http_status"),
            "rate_limited": bool(result.get("rate_limited")),
            "transient": bool(result.get("transient")),
        }
    # No dict at all — an answer we cannot classify is unknown, not a refusal.
    return {"result": None, "error": "No response", "binance_response": "", "symbol": ticker, "transient": True}


def handle_entry(api: BinanceAPI, ticker: str, side: str, quantity: float, price: Optional[float]) -> Optional[Dict[str, Any]]:
    """BUY or SELL entry — market order opening/stacking the position."""
    side = side.upper()
    log.info("[Binance] %s %s qty=%s", side, ticker, quantity)
    pm_err = ensure_position_mode(api, ticker)
    if pm_err is not None:
        return pm_err
    result = _place_market_order_retry(api, ticker.upper(), side, quantity)
    if _order_failed(result):
        log.error("[Binance] %s failed for %s", side, ticker)
        return _failure_dict(result, ticker)
    return {"result": result, "symbol": ticker, "quantity": quantity, "price": price}


def handle_exit(api: BinanceAPI, ticker: str, position_side: str, price: Optional[float]) -> Optional[Dict[str, Any]]:
    """EXIT_LONG / EXIT_SHORT — reduce-only close of one side.

    Re-attempted up to EXIT_RETRY_ATTEMPTS times while the failure is TRANSIENT
    (a timeout, a 5xx, or Binance's 408/-1007 "execution status unknown" — the
    demo-fapi testnet answers that under load). Waiting the retry queue's 60s
    for a close is a long time to hold a position the strategy has exited, and
    the queue stays the backstop for whatever this loop cannot fix.

    Two properties make re-placing a close safe, and both must survive any edit
    here: every attempt RE-READS positionRisk, so an unconfirmed order that
    actually landed is seen as a flat side and closes nothing twice; and only a
    transient failure is repeated — a rejection (bad precision, min notional,
    position-mode mismatch) is an answer, and asking again just burns weight
    while a human waits to be told.

    realized_pnl is intentionally NOT fetched here: the caller defers the
    userTrades read (get_order_fill_summary) off the close path.
    """
    position_side = position_side.upper()  # LONG | SHORT
    sym = ticker.upper()
    log.info("[Binance] EXIT_%s %s", position_side, ticker)
    pm_err = ensure_position_mode(api, ticker)
    if pm_err is not None:
        return pm_err

    attempts = max(1, EXIT_RETRY_ATTEMPTS)
    failure: Dict[str, Any] = {
        "result": None, "error": "exit not attempted", "binance_response": "",
        "symbol": ticker, "transient": True,
    }

    for attempt in range(1, attempts + 1):
        if attempt > 1:
            # Held in the fan-out worker on purpose: the close is the work this
            # worker exists for. Keep the budget small (EXIT_RETRY_ATTEMPTS).
            time.sleep(EXIT_RETRY_SECONDS * (attempt - 1))

        risk = position_risk_map(api, sym)
        if risk is None:
            failure = {
                "result": None, "error": "could not read positions",
                "binance_response": "", "symbol": ticker, "transient": True,
            }
            log.warning("[Binance] EXIT_%s %s: positions unreadable (attempt %d/%d)",
                        position_side, sym, attempt, attempts)
            continue

        if want_hedge():
            amt, entry_price = risk.get(position_side, (0.0, None))
        else:
            amt, entry_price = risk.get("BOTH", (0.0, None))

        # SHORT positionAmt is negative on Binance; 0 = flat.
        open_for_side = amt > 0 if position_side == "LONG" else amt < 0
        if not open_for_side:
            if attempt > 1:
                # The previous attempt's unconfirmed order did reach the book —
                # exactly what re-reading before re-placing is here to catch.
                log.info("[Binance] EXIT_%s %s already flat on attempt %d — the "
                         "unconfirmed close had filled", position_side, sym, attempt)
            else:
                log.warning("[Binance] EXIT_%s ignored — no %s position for %s",
                            position_side, position_side, ticker)
            return {"status": f"no {position_side.lower()} position to close"}

        size = round(abs(amt), 8)
        close_side = "SELL" if position_side == "LONG" else "BUY"
        result = _place_market_order_retry(api, sym, close_side, size, reduce_only=True)
        if not _order_failed(result):
            log.info("[Binance] EXIT_%s closed %s %s", position_side, size, ticker)
            return {
                "result": result,
                "symbol": ticker,
                "closed_quantity": size,
                "side": position_side,
                "price": price,
                "entry_price": entry_price,
                "realized_pnl": None,
            }

        failure = _failure_dict(result, ticker)
        log.error("[Binance] EXIT_%s failed for %s (attempt %d/%d): %s",
                  position_side, ticker, attempt, attempts, failure["error"])
        if not failure.get("transient"):
            return failure

    return failure
