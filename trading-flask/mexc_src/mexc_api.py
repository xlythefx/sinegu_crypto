"""
MEXC Futures (contract) REST client — OPEN-API.

Signing (per api-docs/mexc/futures-integration-guide.md):
  - Headers: ApiKey, Request-Time, Signature, optional Recv-Window.
  - String to sign: accessKey + timestamp + parameterString.
  - GET/DELETE parameterString: sort params in dict order, join `k=v` with `&`.
  - POST parameterString: the JSON body as sent (no key sort).
  - signature = HMAC_SHA256(secretKey, string_to_sign).hex()  (lowercase hex)
  - null business params excluded from signing and omitted for GET.

Base: https://api.mexc.com (per MEXC futures changelog; same paths as before).
Public: /api/v1/contract/... — private: /api/v1/private/... (signed).
"""

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Dict, List, Optional

import certifi
import requests

from mexc_src.hooks import MEXC_API_BASE, API_TIMEOUT

_TIMEOUT = API_TIMEOUT

# Pooled session: keep-alive + one-time CA bundle resolution on the order path.
_SESSION = requests.Session()
_SESSION.verify = certifi.where()


def _drop_none(params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return {k: v for k, v in (params or {}).items() if v is not None}


def _sort_join(params: Dict[str, Any]) -> str:
    """k=v joined with & in dict (ascending key) order."""
    return "&".join(f"{k}={params[k]}" for k in sorted(params.keys()))


def _sign(secret: str, payload: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


class MexcFuturesAPI:
    """Client for MEXC USDT-M futures REST (/api/v1 on api.mexc.com)."""

    def __init__(
        self,
        api_key: str,
        secret_key: str,
        base_url: Optional[str] = None,
        timeout: int = _TIMEOUT,
    ):
        self.api_key = (api_key or "").strip()
        self.secret_key = (secret_key or "").strip()
        self.base_url = (base_url or MEXC_API_BASE).rstrip("/")
        self.timeout = timeout

    # --- signing / transport ---

    def _headers(self, param_string: str) -> Dict[str, str]:
        ts = str(int(time.time() * 1000))
        signature = _sign(self.secret_key, self.api_key + ts + param_string)
        return {
            "ApiKey": self.api_key,
            "Request-Time": ts,
            "Signature": signature,
            "Content-Type": "application/json",
        }

    def _request_get(
        self, path: str, params: Optional[Dict[str, Any]] = None, method: str = "GET"
    ) -> Optional[Any]:
        clean = _drop_none(params)
        param_string = _sort_join(clean) if clean else ""
        headers = self._headers(param_string)
        url = f"{self.base_url}{path}"
        if param_string:
            url = f"{url}?{param_string}"
        try:
            resp = _SESSION.request(
                method, url, headers=headers, timeout=self.timeout
            )
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as e:
            body = ""
            if hasattr(e, "response") and e.response is not None:
                body = (e.response.text or "")[:500]
            logging.error("[MEXC-F] %s %s: %s — %s", method, path, e, body)
            return {"_error": True, "message": str(e), "response": body}

    def _request_post(self, path: str, body: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        clean = _drop_none(body)
        payload = json.dumps(clean, separators=(",", ":")) if clean else ""
        headers = self._headers(payload)
        url = f"{self.base_url}{path}"
        try:
            resp = _SESSION.post(
                url,
                data=payload if payload else None,
                headers=headers,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as e:
            body_text = ""
            if hasattr(e, "response") and e.response is not None:
                body_text = (e.response.text or "")[:500]
            logging.error("[MEXC-F] POST %s: %s — %s", path, e, body_text)
            return {"_error": True, "message": str(e), "response": body_text}

    # --- public market (no auth) ---

    def get_fair_price(self, symbol: str) -> float:
        """GET /api/v1/contract/fair_price/{symbol} — no auth."""
        data = self._request_get(f"/api/v1/contract/fair_price/{symbol}")
        if not isinstance(data, dict) or not data.get("success"):
            return 0.0
        try:
            return float((data.get("data") or {}).get("fairPrice", 0) or 0)
        except (TypeError, ValueError):
            return 0.0

    def get_contract_detail(self, symbol: str) -> Dict[str, Any]:
        """GET /api/v1/contract/detail?symbol=... — returns contractSize, volScale, etc."""
        data = self._request_get("/api/v1/contract/detail", {"symbol": symbol})
        if not isinstance(data, dict) or not data.get("success"):
            return {}
        row = data.get("data") or {}
        return row if isinstance(row, dict) else {}

    def usdt_to_vol(self, symbol: str, usdt_amount: float) -> float:
        """Convert a USDT notional amount to contracts for a market order.
        vol = usdt_amount / (fairPrice * contractSize), rounded to volScale decimals.
        Returns 0 if price or contract info unavailable.
        """
        detail = self.get_contract_detail(symbol)
        if not detail:
            return 0.0
        try:
            contract_size = float(detail.get("contractSize", 1) or 1)
            vol_scale = int(detail.get("volScale", 0) or 0)
        except (TypeError, ValueError):
            return 0.0
        fair_price = self.get_fair_price(symbol)
        if not fair_price or not contract_size:
            return 0.0
        raw = usdt_amount / (fair_price * contract_size)
        return round(raw, vol_scale) if vol_scale else float(int(raw))

    # --- account ---

    def get_account_assets(self) -> List[Dict[str, Any]]:
        """GET /api/v1/private/account/assets — all currencies."""
        data = self._request_get("/api/v1/private/account/assets")
        if not isinstance(data, dict) or not data.get("success"):
            return []
        out = data.get("data") or []
        return out if isinstance(out, list) else []

    def get_asset(self, currency: str) -> Dict[str, Any]:
        """GET /api/v1/private/account/asset/{currency}."""
        c = (currency or "USDT").upper()
        data = self._request_get(f"/api/v1/private/account/asset/{c}")
        if not isinstance(data, dict) or not data.get("success"):
            return {}
        row = data.get("data") or {}
        return row if isinstance(row, dict) else {}

    def get_usdt_available(self) -> float:
        row = self.get_asset("USDT")
        try:
            return float(row.get("availableBalance", 0) or 0)
        except (TypeError, ValueError):
            return 0.0

    def get_usdt_equity(self) -> float:
        row = self.get_asset("USDT")
        try:
            return float(row.get("equity", 0) or 0)
        except (TypeError, ValueError):
            return 0.0

    # --- positions ---

    def get_open_positions(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """GET /api/v1/private/position/open_positions. positionType 1=long, 2=short."""
        params: Dict[str, Any] = {}
        if symbol:
            params["symbol"] = symbol
        data = self._request_get("/api/v1/private/position/open_positions", params)
        if not isinstance(data, dict) or not data.get("success"):
            return []
        out = data.get("data") or []
        return out if isinstance(out, list) else []

    def get_position_for(self, symbol: str, position_type: int) -> Optional[Dict[str, Any]]:
        """Find open position for symbol + side (1=long, 2=short)."""
        for p in self.get_open_positions(symbol):
            if int(p.get("positionType") or 0) == position_type:
                return p
        return None

    # --- leverage ---

    def change_leverage(
        self,
        leverage: int,
        symbol: Optional[str] = None,
        position_id: Optional[int] = None,
        open_type: Optional[int] = None,
        position_type: Optional[int] = None,
    ) -> Dict[str, Any]:
        """POST /api/v1/private/position/change_leverage."""
        body: Dict[str, Any] = {"leverage": int(leverage)}
        if position_id is not None:
            body["positionId"] = int(position_id)
        else:
            if symbol:
                body["symbol"] = symbol
            if open_type is not None:
                body["openType"] = int(open_type)
            if position_type is not None:
                body["positionType"] = int(position_type)
        return self._request_post("/api/v1/private/position/change_leverage", body) or {}

    # --- orders ---

    def place_order(
        self,
        symbol: str,
        side: int,
        vol: float,
        order_type: int = 5,
        price: float = 0,
        open_type: int = 1,
        leverage: Optional[int] = None,
        external_oid: Optional[str] = None,
        position_id: Optional[int] = None,
        position_mode: Optional[int] = None,
        reduce_only: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        POST /api/v1/private/order/create.
        side: 1 open long, 2 close short, 3 open short, 4 close long.
        type: 1 limit, 2 post-only, 3 IOC, 4 FOK, 5 market.
        openType: 1 isolated, 2 cross.
        """
        body: Dict[str, Any] = {
            "symbol": symbol,
            "price": price,
            "vol": vol,
            "side": int(side),
            "type": int(order_type),
            "openType": int(open_type),
        }
        if leverage is not None:
            body["leverage"] = int(leverage)
        if external_oid:
            body["externalOid"] = external_oid
        if position_id is not None:
            body["positionId"] = int(position_id)
        if position_mode is not None:
            body["positionMode"] = int(position_mode)
        if reduce_only is not None:
            body["reduceOnly"] = bool(reduce_only)
        return self._request_post("/api/v1/private/order/create", body)

    def cancel_orders(self, order_ids: List[int]) -> Optional[Dict[str, Any]]:
        """POST /api/v1/private/order/cancel — body is JSON array of ids."""
        payload = json.dumps([int(x) for x in order_ids], separators=(",", ":"))
        headers = self._headers(payload)
        url = f"{self.base_url}/api/v1/private/order/cancel"
        try:
            resp = requests.post(
                url, data=payload, headers=headers, timeout=self.timeout, verify=certifi.where()
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            body = ""
            if hasattr(e, "response") and e.response is not None:
                body = (e.response.text or "")[:500]
            logging.error("[MEXC-F] POST cancel: %s — %s", e, body)
            return {"_error": True, "message": str(e), "response": body}

    def cancel_all(self, symbol: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """POST /api/v1/private/order/cancel_all. Empty symbol = all contracts."""
        return self._request_post("/api/v1/private/order/cancel_all", {"symbol": symbol or ""})

    def get_open_orders(self, page_num: int = 1, page_size: int = 20) -> List[Dict[str, Any]]:
        data = self._request_get(
            "/api/v1/private/order/list/open_orders",
            {"page_num": page_num, "page_size": min(page_size, 100)},
        )
        if not isinstance(data, dict) or not data.get("success"):
            return []
        out = data.get("data") or []
        return out if isinstance(out, list) else []

    def get_order(self, order_id: str) -> Dict[str, Any]:
        """GET /api/v1/private/order/get/{orderId} — fill price, profit, state."""
        oid = str(order_id or "").strip()
        if not oid:
            return {}
        return self._request_get(f"/api/v1/private/order/get/{oid}") or {}

    def get_history_positions(
        self,
        symbol: str,
        page_num: int = 1,
        page_size: int = 20,
        position_type: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """GET /api/v1/private/position/list/history_positions — paginated or bare list."""
        params: Dict[str, Any] = {
            "symbol": symbol,
            "page_num": int(page_num),
            "page_size": int(min(page_size, 100)),
        }
        if position_type is not None:
            params["position_type"] = int(position_type)
        data = self._request_get("/api/v1/private/position/list/history_positions", params)
        if not isinstance(data, dict) or not data.get("success"):
            return []
        raw = data.get("data")
        if isinstance(raw, list):
            return raw
        if isinstance(raw, dict):
            inner = raw.get("resultList") or raw.get("result_list")
            if isinstance(inner, list):
                return inner
        return []
