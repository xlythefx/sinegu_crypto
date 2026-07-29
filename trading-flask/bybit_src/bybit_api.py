"""
Bybit V5 REST client (USDT linear futures).
Auth: HMAC_SHA256 — sign string = timestamp + api_key + recv_window + (queryString | jsonBody).
Headers: X-BAPI-API-KEY, X-BAPI-TIMESTAMP, X-BAPI-SIGN, X-BAPI-RECV-WINDOW.
POST bodies are JSON; GET params go in the query string.
Response envelope: {retCode, retMsg, result, retExtInfo, time} — retCode=0 is success.
"""

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Dict, List, Optional

import certifi
import requests

from bybit_src.hooks import BYBIT_API_BASE, API_TIMEOUT

_TIMEOUT = API_TIMEOUT
RECV_WINDOW = "5000"

# Pooled session: keep-alive + one-time CA bundle resolution on the order path.
_SESSION = requests.Session()
_SESSION.verify = certifi.where()


def _sign(secret: str, payload: str) -> str:
    """HMAC-SHA256 (lowercase hex) over payload = ts + api_key + recv_window + qs/body."""
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def _is_ok(data: Any) -> bool:
    return isinstance(data, dict) and data.get("retCode") == 0


class BybitAPI:
    """Unified Bybit V5 client for linear futures (+ wallet balance)."""

    def __init__(
        self,
        api_key: str,
        secret_key: str,
        base_url: Optional[str] = None,
        timeout: int = _TIMEOUT,
    ):
        self.api_key = (api_key or "").strip()
        self.secret_key = (secret_key or "").strip()
        self.base_url = (base_url or BYBIT_API_BASE).rstrip("/")
        self.timeout = timeout

    def _headers(self, ts: str, sign: str) -> Dict[str, str]:
        return {
            "X-BAPI-API-KEY": self.api_key,
            "X-BAPI-TIMESTAMP": ts,
            "X-BAPI-SIGN": sign,
            "X-BAPI-RECV-WINDOW": RECV_WINDOW,
            "Content-Type": "application/json",
        }

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        qs = "&".join(f"{k}={v}" for k, v in (params or {}).items())
        ts = str(int(time.time() * 1000))
        payload = ts + self.api_key + RECV_WINDOW + qs
        sign = _sign(self.secret_key, payload)
        url = f"{self.base_url}{path}" + (f"?{qs}" if qs else "")
        try:
            resp = _SESSION.get(
                url, headers=self._headers(ts, sign), timeout=self.timeout
            )
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as e:
            body = ""
            if hasattr(e, "response") and e.response is not None:
                body = (e.response.text or "")[:500]
            logging.error("[Bybit] GET %s: %s — %s", path, e, body)
            return None

    def _post(self, path: str, body: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        body = body or {}
        body_str = json.dumps(body, separators=(",", ":"))
        ts = str(int(time.time() * 1000))
        payload = ts + self.api_key + RECV_WINDOW + body_str
        sign = _sign(self.secret_key, payload)
        url = f"{self.base_url}{path}"
        try:
            resp = _SESSION.post(
                url,
                data=body_str,
                headers=self._headers(ts, sign),
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as e:
            err_text = ""
            if hasattr(e, "response") and e.response is not None:
                err_text = (e.response.text or "")[:500]
                logging.error("[Bybit] POST %s: %s — %s", path, e, err_text)
            else:
                logging.error("[Bybit] POST %s: %s", path, e)
            return {"_error": True, "message": str(e), "response": err_text}

    # --- Account / wallet ---

    def get_wallet_balance(self, account_type: str = "UNIFIED", coin: Optional[str] = None) -> Optional[Any]:
        """GET /v5/account/wallet-balance."""
        params: Dict[str, Any] = {"accountType": account_type}
        if coin:
            params["coin"] = coin.upper()
        return self._get("/v5/account/wallet-balance", params)

    def get_usdt_balance(self) -> float:
        """Convenience: totalWalletBalance (USD) from UNIFIED account."""
        data = self.get_wallet_balance("UNIFIED", "USDT")
        if not _is_ok(data):
            return 0.0
        try:
            lst = data["result"]["list"]
            if not lst:
                return 0.0
            coins = lst[0].get("coin", [])
            usdt = next((c for c in coins if c.get("coin") == "USDT"), None)
            if usdt:
                return float(usdt.get("walletBalance") or 0)
        except (KeyError, IndexError, TypeError, ValueError):
            pass
        return 0.0

    def get_account_info(self) -> Optional[Any]:
        """GET /v5/account/info — marginMode, unifiedMarginStatus, dcpStatus, hedgingMode."""
        return self._get("/v5/account/info")

    def get_position_mode(self) -> Optional[bool]:
        """
        Read hedging mode from /v5/account/info.
        Returns True = hedge (both sides), False = one-way, None on error.
        """
        data = self.get_account_info()
        if not _is_ok(data):
            return None
        result = (data or {}).get("result", {})
        v = result.get("hedgingMode")
        if v in (True, "true", "True", 1, "1", "hedgeMode"):
            return True
        if v in (False, "false", "False", 0, "0", "oneWay"):
            return False
        return None

    # --- Positions ---

    def get_positions(
        self, category: str = "linear", symbol: Optional[str] = None, settle_coin: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """GET /v5/position/list. Returns list[] entries with size, side, avgPrice, etc."""
        params: Dict[str, Any] = {"category": category}
        if symbol:
            params["symbol"] = symbol.upper()
        elif settle_coin:
            params["settleCoin"] = settle_coin.upper()
        data = self._get("/v5/position/list", params)
        if not _is_ok(data):
            return []
        lst = (data or {}).get("result", {}).get("list", [])
        return [p for p in lst if float(p.get("size", 0) or 0) != 0]

    def get_position_side(self, symbol: str, category: str = "linear") -> Optional[List[Dict[str, Any]]]:
        """
        Return open position sides for symbol. Each entry has 'side' (Buy=long, Sell=short)
        and 'size'. Filters out zero-size rows.
        """
        return self.get_positions(category=category, symbol=symbol)

    # --- Leverage ---

    def set_leverage(
        self,
        symbol: str,
        leverage: int,
        category: str = "linear",
    ) -> Optional[Dict[str, Any]]:
        """
        POST /v5/position/set-leverage.
        buyLeverage and sellLeverage must be equal in cross-margin mode.
        category must be 'linear' or 'inverse'.
        """
        lev = str(max(1, int(leverage)))
        body = {
            "category": category,
            "symbol": symbol.upper(),
            "buyLeverage": lev,
            "sellLeverage": lev,
        }
        return self._post("/v5/position/set-leverage", body)

    # --- Orders ---

    def place_order(
        self,
        category: str,
        symbol: str,
        side: str,
        order_type: str,
        qty: str,
        *,
        price: Optional[str] = None,
        position_idx: int = 0,
        reduce_only: bool = False,
        time_in_force: Optional[str] = None,
        order_link_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        POST /v5/order/create.
        side = 'Buy' | 'Sell' (Title case per Bybit spec).
        position_idx: 0=one-way, 1=hedge-buy(long), 2=hedge-sell(short).
        """
        body: Dict[str, Any] = {
            "category": category,
            "symbol": symbol.upper(),
            "side": side,
            "orderType": order_type,
            "qty": str(qty),
            "positionIdx": position_idx,
        }
        if price is not None:
            body["price"] = str(price)
        if reduce_only:
            body["reduceOnly"] = True
        if time_in_force:
            body["timeInForce"] = time_in_force
        if order_link_id:
            body["orderLinkId"] = order_link_id
        return self._post("/v5/order/create", body)

    def place_market_order(
        self,
        symbol: str,
        side: str,
        qty: float,
        *,
        category: str = "linear",
        position_idx: int = 0,
        reduce_only: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """
        Convenience wrapper: MARKET order.
        side = 'Buy' | 'Sell'. positionIdx set by caller based on mode.
        """
        return self.place_order(
            category=category,
            symbol=symbol.upper(),
            side=side,
            order_type="Market",
            qty=str(qty),
            position_idx=position_idx,
            reduce_only=reduce_only,
        )
