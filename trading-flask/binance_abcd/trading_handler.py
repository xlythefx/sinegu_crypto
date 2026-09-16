"""Per-account trade execution for the BINANCE_ABCD engine — exchange-neutral.

BUY = market buy (open/stack LONG). SELL = market sell (open/stack SHORT).
EXIT_LONG / EXIT_SHORT = reduce-only close of that side. Every handler takes a
ready ExchangeClient (built per account by exchanges.client_for, so a demo
Binance account hits the testnet and a MEXC account signs the MEXC way) and
returns a dict the webhook aggregates. Nothing here knows a venue's field
names: the adapter answers in coins and LONG/SHORT, and the retry semantics
below — transient vs rejection, re-read before every close attempt — are
therefore written once for every exchange.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from binance_abcd.binance_api import (
    error_summary,
    is_position_mode_verified,
    mark_position_mode_verified,
)
from binance_abcd.exchange_api import ExchangeClient, mode_key, want_hedge  # noqa: F401 - want_hedge re-exported
from binance_abcd.hooks import (
    EXIT_RETRY_ATTEMPTS,
    EXIT_RETRY_SECONDS,
    FILL_SUMMARY_ATTEMPTS,
    FILL_SUMMARY_RETRY_SECONDS,
)

log = logging.getLogger(__name__)


def ensure_position_mode(api: ExchangeClient, ticker: str) -> Optional[Dict[str, Any]]:
    """Error dict when the account's position mode can't be aligned; None when fine.
    Skips the live check while the account's verified-cache entry is fresh."""
    if is_position_mode_verified(mode_key(api)):
        return None
    ok, err = api.ensure_position_mode_matches(want_hedge())
    if ok:
        mark_position_mode_verified(mode_key(api))
        return None
    return {
        "result": None,
        "error": err,
        "exchange_response": "",
        "symbol": ticker,
        "status": "position_mode_mismatch",
    }


def get_order_fill_summary(api: ExchangeClient, symbol: str, order_id: Any) -> tuple[Optional[float], Optional[float]]:
    """(summed realized PnL, qty-weighted exit price) across every fill of order_id.

    One close can produce several fills; summing all of them is required or the
    PnL under-reports. Called deferred, off the close path.

    RETRIED, because exchanges answer this query with nothing for a second or
    two after the order fills — the trade exists, the index does not carry it
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

    summary = None
    for attempt in range(1, max(1, FILL_SUMMARY_ATTEMPTS) + 1):
        summary = api.fill_summary_once(symbol, oid)
        if summary is not None:
            break
        if attempt < FILL_SUMMARY_ATTEMPTS:
            time.sleep(FILL_SUMMARY_RETRY_SECONDS * attempt)
    if summary is None:
        # Not fatal: the row is still written (with NULLs) and the closed-trades
        # poller backfills it later. Only the Telegram message, which is sent
        # once and never edited, loses out.
        log.warning(
            "[%s] no fills returned for %s order %s after %d attempt(s) — "
            "PnL will be backfilled by the poller, not published",
            api.exchange, symbol, oid, max(1, FILL_SUMMARY_ATTEMPTS),
        )
        return None, None
    return summary


def position_risk_map(api: ExchangeClient, symbol: str) -> Optional[Dict[str, tuple]]:
    """{position_side: (signed_coins, entry_price)} for one ticker — None on a
    failed read, {} when flat. The name predates the adapters (it was one
    GET /fapi/v3/positionRisk); the webhook still calls it by this name."""
    return api.position_map(symbol.upper())


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
            "exchange_response": result.get("response", ""),
            "symbol": ticker,
            "http_status": result.get("http_status"),
            "rate_limited": bool(result.get("rate_limited")),
            "transient": bool(result.get("transient")),
        }
    # No dict at all — an answer we cannot classify is unknown, not a refusal.
    return {"result": None, "error": "No response", "exchange_response": "", "symbol": ticker, "transient": True}


def handle_entry(api: ExchangeClient, ticker: str, side: str, quantity: float, price: Optional[float]) -> Optional[Dict[str, Any]]:
    """BUY or SELL entry — market order opening/stacking the position."""
    side = side.upper()
    log.info("[%s] %s %s qty=%s", api.exchange, side, ticker, quantity)
    pm_err = ensure_position_mode(api, ticker)
    if pm_err is not None:
        return pm_err
    result = api.place_market_entry(ticker.upper(), side, quantity)
    if _order_failed(result):
        log.error("[%s] %s failed for %s", api.exchange, side, ticker)
        return _failure_dict(result, ticker)
    return {"result": result, "symbol": ticker, "quantity": quantity, "price": price}


def handle_exit(api: ExchangeClient, ticker: str, position_side: str, price: Optional[float]) -> Optional[Dict[str, Any]]:
    """EXIT_LONG / EXIT_SHORT — reduce-only close of one side.

    Re-attempted up to EXIT_RETRY_ATTEMPTS times while the failure is TRANSIENT
    (a timeout, a 5xx, or Binance's 408/-1007 "execution status unknown" — the
    demo-fapi testnet answers that under load). Waiting the retry queue's 60s
    for a close is a long time to hold a position the strategy has exited, and
    the queue stays the backstop for whatever this loop cannot fix.

    Two properties make re-placing a close safe, and both must survive any edit
    here: every attempt RE-READS the position, so an unconfirmed order that
    actually landed is seen as a flat side and closes nothing twice; and only a
    transient failure is repeated — a rejection (bad precision, min notional,
    position-mode mismatch) is an answer, and asking again just burns weight
    while a human waits to be told.

    realized_pnl is intentionally NOT fetched here: the caller defers the fill
    read (get_order_fill_summary) off the close path.
    """
    position_side = position_side.upper()  # LONG | SHORT
    sym = ticker.upper()
    log.info("[%s] EXIT_%s %s", api.exchange, position_side, ticker)
    pm_err = ensure_position_mode(api, ticker)
    if pm_err is not None:
        return pm_err

    attempts = max(1, EXIT_RETRY_ATTEMPTS)
    failure: Dict[str, Any] = {
        "result": None, "error": "exit not attempted", "exchange_response": "",
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
                "exchange_response": "", "symbol": ticker, "transient": True,
            }
            log.warning("[%s] EXIT_%s %s: positions unreadable (attempt %d/%d)",
                        api.exchange, position_side, sym, attempt, attempts)
            continue

        if want_hedge():
            amt, entry_price = risk.get(position_side, (0.0, None))
        else:
            amt, entry_price = risk.get("BOTH", (0.0, None))

        # SHORT is negative in the adapter vocabulary (as on Binance); 0 = flat.
        open_for_side = amt > 0 if position_side == "LONG" else amt < 0
        if not open_for_side:
            if attempt > 1:
                # The previous attempt's unconfirmed order did reach the book —
                # exactly what re-reading before re-placing is here to catch.
                log.info("[%s] EXIT_%s %s already flat on attempt %d — the "
                         "unconfirmed close had filled", api.exchange, position_side, sym, attempt)
            else:
                log.warning("[%s] EXIT_%s ignored — no %s position for %s",
                            api.exchange, position_side, position_side, ticker)
            return {"status": f"no {position_side.lower()} position to close"}

        size = round(abs(amt), 8)
        result = api.place_market_exit(sym, position_side, size)
        if not _order_failed(result):
            log.info("[%s] EXIT_%s closed %s %s", api.exchange, position_side, size, ticker)
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
        log.error("[%s] EXIT_%s failed for %s (attempt %d/%d): %s",
                  api.exchange, position_side, ticker, attempt, attempts, failure["error"])
        if not failure.get("transient"):
            return failure

    return failure
