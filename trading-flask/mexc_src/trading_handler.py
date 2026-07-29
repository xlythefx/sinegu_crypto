"""
Trading handlers for MEXC Futures (USDT-M perp).

Side codes (MEXC): 1 open long, 2 close short, 3 open short, 4 close long.
TradingView payload maps:
  BUY         -> open long  (side=1)
  SELL        -> open short (side=3)
  EXIT_LONG   -> close long (side=4)
  EXIT_SHORT  -> close short (side=2)

usdt_amount: USDT notional to open (e.g. 10). Converted to contracts at order time via:
  vol = usdt_amount / (fairPrice * contractSize), rounded to volScale decimals.

Market order: type=5, price=0. openType=1 isolated, 2 cross.
"""

import logging
from typing import Any, Dict, Optional

from mexc_src.hooks import DEFAULT_LEVERAGE, DEFAULT_OPEN_TYPE
from mexc_src.mexc_api import MexcFuturesAPI


def has_open_position(api_key: str, secret_key: str, symbol: str) -> Optional[bool]:
    """True if account has any non-zero position on symbol (either side).

    Returns None on API error so callers can fail-open.
    """
    try:
        api = MexcFuturesAPI(api_key, secret_key)
        positions = api.get_open_positions(symbol)
    except Exception as e:
        logging.warning("[MEXC-F] has_open_position error for %s: %s", symbol, e)
        return None
    if not positions:
        return False
    for p in positions:
        try:
            vol = float(p.get("holdVol", 0) or 0)
        except (TypeError, ValueError):
            vol = 0.0
        if vol > 0:
            return True
    return False


def _is_ok(res: Optional[Dict[str, Any]]) -> bool:
    return isinstance(res, dict) and res.get("success") is True and not res.get("_error")


def _err(res: Optional[Dict[str, Any]]) -> str:
    if not isinstance(res, dict):
        return "No response"
    if res.get("_error"):
        return res.get("message") or "HTTP error"
    return res.get("message") or f"code={res.get('code')}"


def _resolve_vol(api: MexcFuturesAPI, symbol: str, usdt_amount: float) -> float:
    """Convert USDT notional to contracts. Returns 0 if price/detail unavailable."""
    vol = api.usdt_to_vol(symbol, usdt_amount)
    if vol <= 0:
        logging.error("[MEXC-F] Cannot compute vol for %s (usdt=%s) — fair price or contract detail missing", symbol, usdt_amount)
    return vol


def _place_open(
    api: MexcFuturesAPI,
    symbol: str,
    side: int,
    vol: float,
    leverage: int,
    open_type: int,
) -> Optional[Dict[str, Any]]:
    # side 1 open-long -> positionType 1; side 3 open-short -> positionType 2.
    position_type = 1 if side == 1 else 2
    try:
        api.change_leverage(
            leverage=leverage,
            symbol=symbol,
            open_type=open_type,
            position_type=position_type,
        )
    except Exception as e:
        logging.info("[MEXC-F] change_leverage skipped: %s", e)
    return api.place_order(
        symbol=symbol,
        side=side,
        vol=vol,
        order_type=5,
        price=0,
        open_type=open_type,
        leverage=leverage,
    )


def _place_close(
    api: MexcFuturesAPI,
    symbol: str,
    side: int,
    vol: float,
    open_type: int,
) -> Optional[Dict[str, Any]]:
    return api.place_order(
        symbol=symbol,
        side=side,
        vol=vol,
        order_type=5,
        price=0,
        open_type=open_type,
        reduce_only=True,
    )


def handle_add(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
    usdt_amount: float,
    leverage: Optional[int] = None,
    open_type: Optional[int] = None,
    **_: Any,
) -> Optional[Dict[str, Any]]:
    """BUY — open long (market). usdt_amount is USDT notional (e.g. 10)."""
    lev = int(leverage or DEFAULT_LEVERAGE)
    ot = int(open_type or DEFAULT_OPEN_TYPE)
    logging.info("[MEXC-F] BUY open-long %s usdt=%s lev=%s openType=%s", ticker, usdt_amount, lev, ot)
    if not api_key or not secret_key:
        logging.warning("[MEXC-F] API key/secret missing - cannot BUY")
        return None
    api = MexcFuturesAPI(api_key, secret_key)
    vol = _resolve_vol(api, ticker, usdt_amount)
    if vol <= 0:
        return {"result": None, "error": "Cannot resolve contracts vol from USDT amount", "symbol": ticker}
    logging.info("[MEXC-F] BUY %s: usdt=%s -> vol=%s contracts", ticker, usdt_amount, vol)
    res = _place_open(api, ticker, side=1, vol=vol, leverage=lev, open_type=ot)
    if not _is_ok(res):
        logging.error("[MEXC-F] BUY failed %s: %s", ticker, _err(res))
        return {"result": None, "error": _err(res), "mexc_response": res, "symbol": ticker}
    logging.info("[MEXC-F] BUY success: %s", res.get("data"))
    return {"result": res, "symbol": ticker, "usdt_amount": usdt_amount, "vol": vol, "price": price, "leverage": lev}


def handle_sell(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
    usdt_amount: float,
    leverage: Optional[int] = None,
    open_type: Optional[int] = None,
    **_: Any,
) -> Optional[Dict[str, Any]]:
    """SELL — open short (market). usdt_amount is USDT notional (e.g. 10)."""
    lev = int(leverage or DEFAULT_LEVERAGE)
    ot = int(open_type or DEFAULT_OPEN_TYPE)
    logging.info("[MEXC-F] SELL open-short %s usdt=%s lev=%s openType=%s", ticker, usdt_amount, lev, ot)
    if not api_key or not secret_key:
        logging.warning("[MEXC-F] API key/secret missing - cannot SELL")
        return None
    api = MexcFuturesAPI(api_key, secret_key)
    vol = _resolve_vol(api, ticker, usdt_amount)
    if vol <= 0:
        return {"result": None, "error": "Cannot resolve contracts vol from USDT amount", "symbol": ticker}
    logging.info("[MEXC-F] SELL %s: usdt=%s -> vol=%s contracts", ticker, usdt_amount, vol)
    res = _place_open(api, ticker, side=3, vol=vol, leverage=lev, open_type=ot)
    if not _is_ok(res):
        logging.error("[MEXC-F] SELL failed %s: %s", ticker, _err(res))
        return {"result": None, "error": _err(res), "mexc_response": res, "symbol": ticker}
    logging.info("[MEXC-F] SELL success: %s", res.get("data"))
    return {"result": res, "symbol": ticker, "usdt_amount": usdt_amount, "vol": vol, "price": price, "leverage": lev}


def handle_exit_long(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
    open_type: Optional[int] = None,
    **_: Any,
) -> Optional[Dict[str, Any]]:
    """EXIT_LONG — close long of full open size (reads holdVol from open position)."""
    ot = int(open_type or DEFAULT_OPEN_TYPE)
    logging.info("[MEXC-F] EXIT_LONG close-long %s", ticker)
    if not api_key or not secret_key:
        logging.warning("[MEXC-F] API key/secret missing - cannot EXIT_LONG")
        return None
    api = MexcFuturesAPI(api_key, secret_key)
    pos = api.get_position_for(ticker, position_type=1)
    if not pos:
        logging.warning("[MEXC-F] EXIT_LONG ignored — no open long on %s", ticker)
        return {"status": "no long position to close", "symbol": ticker}
    try:
        vol = float(pos.get("holdVol") or 0)
    except (TypeError, ValueError):
        vol = 0.0
    if vol <= 0:
        return {"status": "no long position to close", "symbol": ticker}
    res = _place_close(api, ticker, side=4, vol=vol, open_type=ot)
    if not _is_ok(res):
        logging.error("[MEXC-F] EXIT_LONG failed %s: %s", ticker, _err(res))
        return {"result": None, "error": _err(res), "mexc_response": res, "symbol": ticker}
    logging.info("[MEXC-F] EXIT_LONG closed %s %s contracts", vol, ticker)
    return {"result": res, "symbol": ticker, "closed_vol": vol, "side": "LONG", "price": price, "position": pos}


def handle_exit_short(
    api_key: str,
    secret_key: str,
    ticker: str,
    price: Optional[float],
    open_type: Optional[int] = None,
    **_: Any,
) -> Optional[Dict[str, Any]]:
    """EXIT_SHORT — close short of full open size (reads holdVol from open position)."""
    ot = int(open_type or DEFAULT_OPEN_TYPE)
    logging.info("[MEXC-F] EXIT_SHORT close-short %s", ticker)
    if not api_key or not secret_key:
        logging.warning("[MEXC-F] API key/secret missing - cannot EXIT_SHORT")
        return None
    api = MexcFuturesAPI(api_key, secret_key)
    pos = api.get_position_for(ticker, position_type=2)
    if not pos:
        logging.warning("[MEXC-F] EXIT_SHORT ignored — no open short on %s", ticker)
        return {"status": "no short position to close", "symbol": ticker}
    try:
        vol = float(pos.get("holdVol") or 0)
    except (TypeError, ValueError):
        vol = 0.0
    if vol <= 0:
        return {"status": "no short position to close", "symbol": ticker}
    res = _place_close(api, ticker, side=2, vol=vol, open_type=ot)
    if not _is_ok(res):
        logging.error("[MEXC-F] EXIT_SHORT failed %s: %s", ticker, _err(res))
        return {"result": None, "error": _err(res), "mexc_response": res, "symbol": ticker}
    logging.info("[MEXC-F] EXIT_SHORT closed %s %s contracts", vol, ticker)
    return {"result": res, "symbol": ticker, "closed_vol": vol, "side": "SHORT", "price": price, "position": pos}
