"""
Trading handlers for Bybit V5 USDT linear futures.
BUY/SELL = open long/short MARKET orders.
EXIT_LONG/EXIT_SHORT = close position with reduceOnly MARKET orders.
positionIdx: 0=one-way, 1=hedge Buy(long), 2=hedge Sell(short).
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from bybit_src.bybit_api import BybitAPI, _is_ok
from bybit_src.hooks import POSITION_MODE, DEFAULT_LEVERAGE

CATEGORY = "linear"


def has_open_position(api_key: str, secret_key: str, symbol: str) -> Optional[bool]:
    """True if account has any non-zero position on symbol (either side).

    Returns None on API error so callers can fail-open.
    """
    try:
        api = BybitAPI(api_key, secret_key)
        positions = api.get_positions(category=CATEGORY, symbol=symbol)
    except Exception as e:
        logging.warning("[Bybit] has_open_position error for %s: %s", symbol, e)
        return None
    if not positions:
        return False
    for p in positions:
        try:
            sz = float(p.get("size", 0) or 0)
        except (TypeError, ValueError):
            sz = 0.0
        if sz != 0:
            return True
    return False


def _want_hedge() -> bool:
    return POSITION_MODE.strip().lower() in ("hedge", "dual", "long_short")


def _open_position_idx(side: str) -> int:
    """positionIdx for opening: hedge Buy=1, hedge Sell=2, one-way=0."""
    if _want_hedge():
        return 1 if side.lower() == "buy" else 2
    return 0


def _close_position_idx(position_side: str) -> int:
    """positionIdx for closing: hedge long(Buy)=1, hedge short(Sell)=2, one-way=0."""
    if _want_hedge():
        return 1 if position_side.lower() in ("long", "buy") else 2
    return 0


def _get_position_size(api: BybitAPI, symbol: str, side_filter: Optional[str] = None) -> Optional[List[Tuple[str, float]]]:
    """
    Return list of (side, size) for open positions on symbol.
    side_filter: 'Buy'(long) or 'Sell'(short); None = all sides.
    """
    positions = api.get_positions(category=CATEGORY, symbol=symbol)
    if positions is None:
        return None
    out: List[Tuple[str, float]] = []
    for p in positions:
        sz = float(p.get("size", 0) or 0)
        if sz == 0:
            continue
        side = p.get("side", "")
        if side_filter and side.lower() != side_filter.lower():
            continue
        out.append((side, sz))
    return out


def _maybe_set_leverage(api: BybitAPI, symbol: str, leverage: int, name: str) -> None:
    try:
        res = api.set_leverage(symbol, leverage, category=CATEGORY)
        if not _is_ok(res):
            logging.warning("[Bybit/%s] set_leverage %sx %s: %s", name, leverage, symbol, res)
        else:
            logging.info("[Bybit/%s] Leverage set to %sx for %s", name, leverage, symbol)
    except Exception as e:
        logging.warning("[Bybit/%s] set_leverage exception: %s", name, e)


def handle_add(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
    quantity: float,
    leverage: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """BUY — open long MARKET order."""
    logging.info("[Bybit] Processing BUY for %s qty=%s", ticker, quantity)
    if not api_key or not secret_key:
        logging.warning("[Bybit] API key or secret missing - cannot BUY")
        return None
    api = BybitAPI(api_key, secret_key)
    lev = leverage if leverage is not None else DEFAULT_LEVERAGE
    _maybe_set_leverage(api, ticker, lev, "BUY")
    idx = _open_position_idx("Buy")
    result = api.place_market_order(ticker.upper(), "Buy", quantity, category=CATEGORY, position_idx=idx)
    if result is None or (isinstance(result, dict) and result.get("_error")):
        err = result.get("message", "Unknown error") if isinstance(result, dict) else "No response"
        resp = result.get("response", "") if isinstance(result, dict) else ""
        logging.error("[Bybit] BUY failed for %s: %s | %s", ticker, err, resp)
        return {"result": None, "error": err, "bybit_response": resp, "symbol": ticker}
    if not _is_ok(result):
        logging.error("[Bybit] BUY non-zero retCode: %s", result)
        return {"result": None, "error": result.get("retMsg", "Non-zero retCode"), "bybit_response": str(result), "symbol": ticker}
    order_id = result.get("result", {}).get("orderId")
    logging.info("[Bybit] BUY success orderId=%s", order_id)
    return {"result": result, "order_id": order_id, "symbol": ticker, "quantity": quantity, "price": price}


def handle_sell(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
    quantity: float,
    leverage: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """SELL — open short MARKET order."""
    logging.info("[Bybit] Processing SELL for %s qty=%s", ticker, quantity)
    if not api_key or not secret_key:
        logging.warning("[Bybit] API key or secret missing - cannot SELL")
        return None
    api = BybitAPI(api_key, secret_key)
    lev = leverage if leverage is not None else DEFAULT_LEVERAGE
    _maybe_set_leverage(api, ticker, lev, "SELL")
    idx = _open_position_idx("Sell")
    result = api.place_market_order(ticker.upper(), "Sell", quantity, category=CATEGORY, position_idx=idx)
    if result is None or (isinstance(result, dict) and result.get("_error")):
        err = result.get("message", "Unknown error") if isinstance(result, dict) else "No response"
        resp = result.get("response", "") if isinstance(result, dict) else ""
        logging.error("[Bybit] SELL failed for %s: %s | %s", ticker, err, resp)
        return {"result": None, "error": err, "bybit_response": resp, "symbol": ticker}
    if not _is_ok(result):
        logging.error("[Bybit] SELL non-zero retCode: %s", result)
        return {"result": None, "error": result.get("retMsg", "Non-zero retCode"), "bybit_response": str(result), "symbol": ticker}
    order_id = result.get("result", {}).get("orderId")
    logging.info("[Bybit] SELL success orderId=%s", order_id)
    return {"result": result, "order_id": order_id, "symbol": ticker, "quantity": quantity, "price": price}


def handle_exit_long(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
) -> Optional[Dict[str, Any]]:
    """EXIT_LONG — close LONG position (Sell reduceOnly)."""
    logging.info("[Bybit] Processing EXIT_LONG for %s", ticker)
    if not api_key or not secret_key:
        logging.warning("[Bybit] API key or secret missing - cannot EXIT_LONG")
        return None
    api = BybitAPI(api_key, secret_key)
    sym = ticker.upper()
    sides = _get_position_size(api, sym, side_filter="Buy")
    if sides is None:
        logging.error("[Bybit] Could not get positions for %s", sym)
        return None
    if not sides:
        logging.warning("[Bybit] EXIT_LONG ignored — no long position for %s", sym)
        return {"status": "no long position to close"}
    _, size = sides[0]
    idx = _close_position_idx("Buy")
    result = api.place_market_order(sym, "Sell", size, category=CATEGORY, position_idx=idx, reduce_only=True)
    if result is None or (isinstance(result, dict) and result.get("_error")):
        err = result.get("message", "Unknown error") if isinstance(result, dict) else "No response"
        resp = result.get("response", "") if isinstance(result, dict) else ""
        logging.error("[Bybit] EXIT_LONG failed for %s: %s | %s", ticker, err, resp)
        return {"result": None, "error": err, "bybit_response": resp, "symbol": ticker}
    if not _is_ok(result):
        logging.error("[Bybit] EXIT_LONG non-zero retCode: %s", result)
        return {"result": None, "error": result.get("retMsg", "Non-zero retCode"), "bybit_response": str(result), "symbol": ticker}
    order_id = result.get("result", {}).get("orderId")
    logging.info("[Bybit] EXIT_LONG closed %s %s orderId=%s", size, sym, order_id)
    return {"result": result, "order_id": order_id, "symbol": ticker, "closed_quantity": size, "side": "LONG", "price": price}


def handle_exit_short(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
) -> Optional[Dict[str, Any]]:
    """EXIT_SHORT — close SHORT position (Buy reduceOnly)."""
    logging.info("[Bybit] Processing EXIT_SHORT for %s", ticker)
    if not api_key or not secret_key:
        logging.warning("[Bybit] API key or secret missing - cannot EXIT_SHORT")
        return None
    api = BybitAPI(api_key, secret_key)
    sym = ticker.upper()
    sides = _get_position_size(api, sym, side_filter="Sell")
    if sides is None:
        logging.error("[Bybit] Could not get positions for %s", sym)
        return None
    if not sides:
        logging.warning("[Bybit] EXIT_SHORT ignored — no short position for %s", sym)
        return {"status": "no short position to close"}
    _, size = sides[0]
    idx = _close_position_idx("Sell")
    result = api.place_market_order(sym, "Buy", size, category=CATEGORY, position_idx=idx, reduce_only=True)
    if result is None or (isinstance(result, dict) and result.get("_error")):
        err = result.get("message", "Unknown error") if isinstance(result, dict) else "No response"
        resp = result.get("response", "") if isinstance(result, dict) else ""
        logging.error("[Bybit] EXIT_SHORT failed for %s: %s | %s", ticker, err, resp)
        return {"result": None, "error": err, "bybit_response": resp, "symbol": ticker}
    if not _is_ok(result):
        logging.error("[Bybit] EXIT_SHORT non-zero retCode: %s", result)
        return {"result": None, "error": result.get("retMsg", "Non-zero retCode"), "bybit_response": str(result), "symbol": ticker}
    order_id = result.get("result", {}).get("orderId")
    logging.info("[Bybit] EXIT_SHORT closed %s %s orderId=%s", size, sym, order_id)
    return {"result": result, "order_id": order_id, "symbol": ticker, "closed_quantity": size, "side": "SHORT", "price": price}
