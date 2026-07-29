"""
Trading handlers for Binance USD-M Futures.
ADD = market BUY. EXIT = close all for symbol. SELL = market SELL (new short). ORDER = explicit.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

import requests

from src.binance_api import BinanceAPI
from src.hooks import API_BASE_URL, POSITION_CHECK_ENDPOINT, POSITION_MODE, trading_api_headers


def _sum_side(positions: List[Dict[str, Any]], want_side: str,
              side_key: str, amt_key: str) -> float:
    """Sum abs(amount) of positions open on want_side ('LONG'|'SHORT').

    Hedge-mode rows carry positionSide LONG/SHORT; one-way (BOTH) rows are
    attributed by the sign of the (signed) amount. Mirrors binance-flask.
    """
    total = 0.0
    for p in positions:
        try:
            amt = float(p.get(amt_key) or 0)
        except (TypeError, ValueError):
            continue
        ps = (p.get(side_key) or "").upper()
        if ps == want_side:
            total += abs(amt)
        elif ps == "BOTH" and ((want_side == "LONG" and amt > 0) or (want_side == "SHORT" and amt < 0)):
            total += abs(amt)
    return total


def _db_side_size(api_key: str, symbol: str, want_side: str) -> Optional[float]:
    """Same-side open size from the trading-api DB (/position-check is side-aware).

    Returns the summed size, or None if the DB is unavailable (caller falls back).
    """
    if not API_BASE_URL:
        return None
    try:
        base = API_BASE_URL.rstrip("/")
        path = POSITION_CHECK_ENDPOINT if POSITION_CHECK_ENDPOINT.startswith("/") else "/" + POSITION_CHECK_ENDPOINT
        url = base + path
        resp = requests.get(url, params={"api_key": api_key, "symbol": symbol},
                            headers=trading_api_headers(), timeout=5)
        if not resp.ok:
            logging.warning("[DB] position-check failed: %s", resp.status_code)
            return None
        data = resp.json()
        if not data.get("success"):
            return None
        return _sum_side(data.get("positions", []), want_side,
                         side_key="position_side", amt_key="position_amt")
    except Exception as e:
        logging.warning("[DB] position-check error for %s: %s", symbol, e)
        return None


def _binance_side_size(api_key: str, secret_key: str, symbol: str, want_side: str) -> Optional[float]:
    """Same-side open size straight from Binance (fallback when the DB is down).

    Returns None only if the API call raises; get_positions_v3 already returns []
    on a read error, which surfaces here as 0.0 (fail-open).
    """
    try:
        api = BinanceAPI(api_key, secret_key)
        positions = api.get_positions_v3(symbol)
    except Exception as e:
        logging.warning("[Binance] side-size error for %s: %s", symbol, e)
        return None
    return _sum_side(positions or [], want_side,
                     side_key="positionSide", amt_key="positionAmt")


def current_side_size(api_key: str, secret_key: str, symbol: str, want_side: str) -> float:
    """abs(position size) currently open on the side we're about to trade.

    DB-first (fast; kept current by write-through upserts), Binance API fallback
    when the DB is unavailable. Fail-open: returns 0.0 if neither source can be
    read, so the max-sizing gate never blocks an entry on a transient glitch.
    """
    want_side = (want_side or "").upper()
    db = _db_side_size(api_key, symbol, want_side)
    if db is not None:
        return db
    logging.info("[DB] unavailable for %s — falling back to Binance for side size", symbol)
    binance = _binance_side_size(api_key, secret_key, symbol, want_side)
    return binance if binance is not None else 0.0


def _db_has_position(api_key: str, symbol: str) -> Optional[bool]:
    """Binary 'any open position for symbol?' from the trading-api DB. None if unavailable."""
    if not API_BASE_URL:
        return None
    try:
        base = API_BASE_URL.rstrip("/")
        path = POSITION_CHECK_ENDPOINT if POSITION_CHECK_ENDPOINT.startswith("/") else "/" + POSITION_CHECK_ENDPOINT
        resp = requests.get(base + path, params={"api_key": api_key, "symbol": symbol},
                            headers=trading_api_headers(), timeout=5)
        if not resp.ok:
            logging.warning("[DB] position-check failed: %s", resp.status_code)
            return None
        data = resp.json()
        if not data.get("success"):
            return None
        return bool(data.get("has_position"))
    except Exception as e:
        logging.warning("[DB] position-check error for %s: %s", symbol, e)
        return None


def _binance_has_position(api_key: str, secret_key: str, symbol: str) -> Optional[bool]:
    """Binary 'any open position for symbol?' straight from Binance. None on read error."""
    try:
        api = BinanceAPI(api_key, secret_key)
        positions = api.get_positions_v3(symbol)
    except Exception as e:
        logging.warning("[Binance] has_open_position error for %s: %s", symbol, e)
        return None
    return bool(positions)  # get_positions_v3 already drops zero-amount entries


def has_open_position(api_key: str, secret_key: str, symbol: str) -> Optional[bool]:
    """Does this account hold ANY open position for symbol? True (block) / False (allow) /
    None (fail-open). DB-first; if the DB says 'none', double-check Binance for staleness.
    Used by the binance-lite bot for its one-position-at-a-time gate.
    """
    db = _db_has_position(api_key, symbol)
    if db is True:
        return True
    binance = _binance_has_position(api_key, secret_key, symbol)
    if db is False:
        # Trust the DB unless Binance reveals a position the DB hasn't caught up to.
        return True if binance is True else False
    return binance  # DB unavailable -> Binance verdict (or None -> fail-open)


def _want_hedge() -> bool:
    return POSITION_MODE.strip().lower() in ("hedge", "dual", "long_short")


def _ensure_position_mode(api: BinanceAPI, ticker: str) -> Optional[Dict[str, Any]]:
    """Return error dict if Binance position mode does not match POSITION_MODE (and API set failed)."""
    ok, err = api.ensure_position_mode_matches(_want_hedge())
    if ok:
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
    position_mode: str = POSITION_MODE,
):
    """place_market_order; on -4061, sync hedge once and retry (Binance can lag after set_dual_side)."""
    result = api.place_market_order(symbol, side, quantity, reduce_only=reduce_only, position_mode=position_mode)
    if isinstance(result, dict) and result.get("_error"):
        resp = str(result.get("response", ""))
        if "-4061" in resp and _want_hedge():
            logging.warning("[Binance] -4061 on order — re-syncing hedge mode and retrying once")
            ok, _ = api.ensure_position_mode_matches(True)
            if ok:
                result = api.place_market_order(symbol, side, quantity, reduce_only=reduce_only, position_mode=position_mode)
    return result


def _get_position_sides(api: BinanceAPI, symbol: str) -> Optional[List[Tuple[str, float]]]:
    """
    Get (positionSide, size) for symbol. Hedge: LONG/SHORT; One-way: BOTH.
    Returns e.g. [("LONG", 0.01)] or [] if flat.
    """
    acc = api.get_account_v3()
    if not acc or "positions" not in acc:
        return None
    symbol = symbol.upper()
    out: List[Tuple[str, float]] = []
    for pos in acc["positions"]:
        if pos.get("symbol") != symbol:
            continue
        amt = float(pos.get("positionAmt", 0))
        if amt == 0:
            continue
        side = pos.get("positionSide", "BOTH")
        out.append((side, abs(amt)))
    return out


def _get_position_signed(api: BinanceAPI, symbol: str) -> Optional[float]:
    """Position size: + = long, - = short, 0 = flat."""
    acc = api.get_account_v3()
    if not acc or "positions" not in acc:
        return None
    symbol = symbol.upper()
    for pos in acc["positions"]:
        if pos.get("symbol") == symbol:
            return float(pos.get("positionAmt", 0))
    return 0.0


def _get_entry_price_from_risk(api: BinanceAPI, symbol: str, position_side: str) -> Optional[float]:
    """Get entry price for symbol+position_side from /fapi/v2/positionRisk."""
    try:
        risk = api.get_position_risk(symbol)
        for p in risk or []:
            if p.get("symbol") == symbol.upper() and p.get("positionSide") == position_side:
                ep = p.get("entryPrice")
                return float(ep) if ep is not None else None
    except (TypeError, ValueError):
        pass
    return None


def _get_realized_pnl_after_close(api: BinanceAPI, symbol: str, order_id: Any) -> Optional[float]:
    """Fetch userTrades for order_id and return summed realizedPnl across all fills.

    A single close can fill in multiple trades; summing avoids under-reporting PnL
    (the previous version only read the first fill).
    """
    try:
        trades = api.get_user_trades(symbol, order_id=int(order_id), limit=100)
        if not trades:
            return None
        total = 0.0
        found = False
        for t in trades:
            pnl = t.get("realizedPnl")
            if pnl is None:
                continue
            try:
                total += float(pnl)
                found = True
            except (TypeError, ValueError):
                continue
        return total if found else None
    except (TypeError, ValueError):
        pass
    return None


def handle_add(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
    quantity: float,
) -> Optional[Dict[str, Any]]:
    """ADD — place market BUY."""
    logging.info("[Binance] Processing ADD for %s qty=%s", ticker, quantity)
    if not api_key or not secret_key:
        logging.warning("[Binance] API key or secret missing - cannot ADD")
        return None
    api = BinanceAPI(api_key, secret_key)
    pm_err = _ensure_position_mode(api, ticker)
    if pm_err is not None:
        return pm_err
    result = _place_market_order_retry(api, ticker.upper(), "BUY", quantity, position_mode=POSITION_MODE)
    if result is None or (isinstance(result, dict) and result.get("_error")):
        err = result.get("message", "Unknown error") if isinstance(result, dict) else "No response"
        resp = result.get("response", "") if isinstance(result, dict) else ""
        logging.error("[Binance] ADD failed for %s: %s | %s", ticker, err, resp)
        return {"result": None, "error": err, "binance_response": resp, "symbol": ticker}
    logging.info("[Binance] ADD success: %s", result)
    return {"result": result, "symbol": ticker, "quantity": quantity, "price": price}


def handle_sell(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
    quantity: float,
) -> Optional[Dict[str, Any]]:
    """SELL — place market SELL (new short)."""
    logging.info("[Binance] Processing SELL for %s qty=%s", ticker, quantity)
    if not api_key or not secret_key:
        logging.warning("[Binance] API key or secret missing - cannot SELL")
        return None
    api = BinanceAPI(api_key, secret_key)
    pm_err = _ensure_position_mode(api, ticker)
    if pm_err is not None:
        return pm_err
    result = _place_market_order_retry(api, ticker.upper(), "SELL", quantity, reduce_only=False, position_mode=POSITION_MODE)
    if result is None or (isinstance(result, dict) and result.get("_error")):
        err = result.get("message", "Unknown error") if isinstance(result, dict) else "No response"
        resp = result.get("response", "") if isinstance(result, dict) else ""
        logging.error("[Binance] SELL failed for %s: %s | %s", ticker, err, resp)
        return {"result": None, "error": err, "binance_response": resp, "symbol": ticker}
    logging.info("[Binance] SELL success: %s", result)
    return {"result": result, "symbol": ticker, "quantity": quantity, "price": price}


def handle_exit_long(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
) -> Optional[Dict[str, Any]]:
    """EXIT_LONG — close only LONG position for symbol (hedge mode). One-way: same as EXIT if long."""
    logging.info("[Binance] Processing EXIT_LONG for %s", ticker)
    if not api_key or not secret_key:
        logging.warning("[Binance] API key or secret missing - cannot EXIT_LONG")
        return None
    api = BinanceAPI(api_key, secret_key)
    sym = ticker.upper()
    pm_err = _ensure_position_mode(api, ticker)
    if pm_err is not None:
        return pm_err

    if POSITION_MODE == "hedge":
        sides = _get_position_sides(api, sym)
        if sides is None:
            logging.error("[Binance] Could not get account/positions")
            return None
        long_size = next((sz for ps, sz in sides if ps == "LONG"), None)
        if long_size is None or long_size <= 0:
            logging.warning("[Binance] EXIT_LONG ignored — no LONG position for %s", ticker)
            return {"status": "no long position to close"}
        size = round(long_size, 8)
        entry_price = _get_entry_price_from_risk(api, sym, "LONG")
        result = _place_market_order_retry(api, sym, "SELL", size, reduce_only=True, position_mode=POSITION_MODE)
        if result is None:
            logging.error("[Binance] EXIT_LONG failed for %s", ticker)
            return None
        order_id = result.get("orderId")
        realized_pnl = _get_realized_pnl_after_close(api, sym, order_id) if order_id else None
        logging.info("[Binance] EXIT_LONG closed %s %s", size, ticker)
        return {"result": result, "symbol": ticker, "closed_quantity": size, "side": "LONG", "price": price, "entry_price": entry_price, "realized_pnl": realized_pnl}
    else:
        position_amt = _get_position_signed(api, sym)
        if position_amt is None:
            logging.error("[Binance] Could not get account/positions")
            return None
        if position_amt <= 0:
            logging.warning("[Binance] EXIT_LONG ignored — no long position for %s", ticker)
            return {"status": "no long position to close"}
        size = round(position_amt, 8)
        entry_price = _get_entry_price_from_risk(api, sym, "BOTH")
        result = _place_market_order_retry(api, sym, "SELL", size, reduce_only=True, position_mode=POSITION_MODE)
        if result is None:
            logging.error("[Binance] EXIT_LONG failed for %s", ticker)
            return None
        order_id = result.get("orderId")
        realized_pnl = _get_realized_pnl_after_close(api, sym, order_id) if order_id else None
        logging.info("[Binance] EXIT_LONG closed %s %s", size, ticker)
        return {"result": result, "symbol": ticker, "closed_quantity": size, "price": price, "entry_price": entry_price, "realized_pnl": realized_pnl}


def handle_exit_short(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
) -> Optional[Dict[str, Any]]:
    """EXIT_SHORT — close only SHORT position for symbol (hedge mode). One-way: same as EXIT if short."""
    logging.info("[Binance] Processing EXIT_SHORT for %s", ticker)
    if not api_key or not secret_key:
        logging.warning("[Binance] API key or secret missing - cannot EXIT_SHORT")
        return None
    api = BinanceAPI(api_key, secret_key)
    sym = ticker.upper()
    pm_err = _ensure_position_mode(api, ticker)
    if pm_err is not None:
        return pm_err

    if POSITION_MODE == "hedge":
        sides = _get_position_sides(api, sym)
        if sides is None:
            logging.error("[Binance] Could not get account/positions")
            return None
        short_size = next((sz for ps, sz in sides if ps == "SHORT"), None)
        if short_size is None or short_size <= 0:
            logging.warning("[Binance] EXIT_SHORT ignored — no SHORT position for %s", ticker)
            return {"status": "no short position to close"}
        size = round(short_size, 8)
        entry_price = _get_entry_price_from_risk(api, sym, "SHORT")
        result = _place_market_order_retry(api, sym, "BUY", size, reduce_only=True, position_mode=POSITION_MODE)
        if result is None:
            logging.error("[Binance] EXIT_SHORT failed for %s", ticker)
            return None
        order_id = result.get("orderId")
        realized_pnl = _get_realized_pnl_after_close(api, sym, order_id) if order_id else None
        logging.info("[Binance] EXIT_SHORT closed %s %s", size, ticker)
        return {"result": result, "symbol": ticker, "closed_quantity": size, "side": "SHORT", "price": price, "entry_price": entry_price, "realized_pnl": realized_pnl}
    else:
        position_amt = _get_position_signed(api, sym)
        if position_amt is None:
            logging.error("[Binance] Could not get account/positions")
            return None
        if position_amt >= 0:
            logging.warning("[Binance] EXIT_SHORT ignored — no short position for %s", ticker)
            return {"status": "no short position to close"}
        size = round(abs(position_amt), 8)
        entry_price = _get_entry_price_from_risk(api, sym, "BOTH")
        result = _place_market_order_retry(api, sym, "BUY", size, reduce_only=True, position_mode=POSITION_MODE)
        if result is None:
            logging.error("[Binance] EXIT_SHORT failed for %s", ticker)
            return None
        order_id = result.get("orderId")
        realized_pnl = _get_realized_pnl_after_close(api, sym, order_id) if order_id else None
        logging.info("[Binance] EXIT_SHORT closed %s %s", size, ticker)
        return {"result": result, "symbol": ticker, "closed_quantity": size, "price": price, "entry_price": entry_price, "realized_pnl": realized_pnl}
