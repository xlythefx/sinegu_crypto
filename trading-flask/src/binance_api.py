"""
Binance USD-M Futures REST client (unified).
TRADE: POST /fapi/v1/order. USER_DATA: GET /fapi/v3/account, /fapi/v3/balance.
Requires API key + HMAC SHA256 signature.
"""

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Dict, List, Optional

import certifi
import requests

from src.hooks import BINANCE_API_BASE, API_TIMEOUT

_TIMEOUT = API_TIMEOUT

# Pooled session: keep-alive to fapi.binance.com saves a TCP+TLS handshake per
# order on the latency-critical path. CA bundle is resolved once here instead of
# per request.
_SESSION = requests.Session()
_SESSION.verify = certifi.where()


def _parse_binance_error_body(text: str) -> Optional[Dict[str, Any]]:
    """Extract {code, msg} from Binance JSON error body."""
    if not text or not text.strip().startswith("{"):
        return None
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _is_no_need_position_side_change(parsed: Dict[str, Any]) -> bool:
    """
    Binance returns HTTP 400 with code -4059 and msg like 'No need to change position side.'
    when the account is *already* in the requested mode. That is success, not a blocking error.
    """
    if not isinstance(parsed.get("code"), int) or parsed["code"] != -4059:
        return False
    msg = (parsed.get("msg") or "").lower()
    return "no need" in msg


def _sign(secret: str, query: str) -> str:
    """HMAC SHA256 signature (hex)."""
    return hmac.new(secret.encode("utf-8"), query.encode("utf-8"), hashlib.sha256).hexdigest()


class BinanceAPI:
    """Unified client for Binance Futures: TRADE + USER_DATA."""

    def __init__(
        self,
        api_key: str,
        secret_key: str,
        base_url: Optional[str] = None,
        timeout: int = _TIMEOUT,
    ):
        self.api_key = (api_key or "").strip()
        self.secret_key = (secret_key or "").strip()
        self.base_url = (base_url or BINANCE_API_BASE).rstrip("/")
        self.timeout = timeout

    def _request_get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        """GET with timestamp + signature."""
        params = dict(params or {})
        params["timestamp"] = int(time.time() * 1000)
        query = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        params["signature"] = _sign(self.secret_key, query)
        url = f"{self.base_url}{path}"
        headers = {"X-MBX-APIKEY": self.api_key}
        try:
            full_query = query + "&signature=" + params["signature"]
            resp = _SESSION.get(
                url + "?" + full_query,
                headers=headers,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as e:
            logging.error("[Binance] GET %s: %s", path, e)
            if hasattr(e, "response") and e.response is not None and e.response.text:
                logging.error("[Binance] response: %s", e.response.text[:500])
            return None

    def _request_post(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        """POST with timestamp + signature."""
        params = dict(params or {})
        params["timestamp"] = int(time.time() * 1000)
        query = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        params["signature"] = _sign(self.secret_key, query)
        body = query + "&signature=" + params["signature"]
        url = f"{self.base_url}{path}"
        headers = {"X-MBX-APIKEY": self.api_key, "Content-Type": "application/x-www-form-urlencoded"}
        try:
            resp = _SESSION.post(
                url, data=body, headers=headers, timeout=self.timeout
            )
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as e:
            err_text = ""
            if hasattr(e, "response") and e.response is not None:
                err_text = (e.response.text or "")[:500]
                logging.error("[Binance] POST %s: %s — %s", path, e, err_text)
            else:
                logging.error("[Binance] POST %s: %s", path, e)
            return {"_error": True, "message": str(e), "response": err_text}

    def get_account_v3(self, recv_window: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """GET /fapi/v3/account."""
        params = {}
        if recv_window is not None:
            params["recvWindow"] = recv_window
        return self._request_get("/fapi/v3/account", params)

    def get_balance_v3(self, recv_window: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """GET /fapi/v3/balance."""
        params = {}
        if recv_window is not None:
            params["recvWindow"] = recv_window
        data = self._request_get("/fapi/v3/balance", params)
        return data if isinstance(data, list) else None

    def get_positions(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """Parse positions from account. Optional symbol filter. No entryPrice — use get_positions_v3 for full risk data."""
        acc = self.get_account_v3()
        if not acc or "positions" not in acc:
            return []
        positions = acc["positions"]
        if symbol:
            symbol = symbol.upper()
            positions = [p for p in positions if p.get("symbol") == symbol]
        return [p for p in positions if float(p.get("positionAmt", 0)) != 0]

    def get_positions_v3(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """GET /fapi/v3/positionRisk (Position Information V3). Returns positions with entryPrice, markPrice, unRealizedProfit, etc. Weight: 5."""
        params = {}
        if symbol:
            params["symbol"] = symbol.upper()
        data = self._request_get("/fapi/v3/positionRisk", params)
        if not isinstance(data, list):
            return []
        return [p for p in data if float(p.get("positionAmt", 0)) != 0]

    def get_position_risk(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """GET /fapi/v3/positionRisk. Returns positions with entryPrice (for symbol or all). Used by exit handlers."""
        return self.get_positions_v3(symbol)

    def get_user_trades(
        self,
        symbol: str,
        order_id: Optional[int] = None,
        limit: int = 10,
        start_time: Optional[int] = None,
        from_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """GET /fapi/v1/userTrades. Returns fills with realizedPnl.

        Optional `order_id` filter; `start_time` (ms) and `from_id` (trade id) support
        windowed/paginated scans used by the past-position syncer. Weight: 5.
        """
        params = {"symbol": symbol.upper(), "limit": limit}
        if order_id is not None:
            params["orderId"] = order_id
        if from_id is not None:
            params["fromId"] = from_id
        elif start_time is not None:
            params["startTime"] = start_time
        data = self._request_get("/fapi/v1/userTrades", params)
        return data if isinstance(data, list) else []

    def get_income_history(
        self,
        income_type: Optional[str] = None,
        symbol: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """GET /fapi/v1/income. incomeType e.g. TRANSFER (wallet in/out), REALIZED_PNL, FUNDING_FEE. Weight: 30."""
        params = {"limit": min(limit, 1000)}
        if income_type:
            params["incomeType"] = income_type
        if symbol:
            params["symbol"] = symbol.upper()
        if start_time is not None:
            params["startTime"] = start_time
        if end_time is not None:
            params["endTime"] = end_time
        data = self._request_get("/fapi/v1/income", params)
        return data if isinstance(data, list) else []

    def get_dual_side_position(self) -> Optional[bool]:
        """
        Read dualSidePosition from account (GET /fapi/v2/account or v3).
        True = hedge (dual side), False = one-way. None if unknown/error.
        """
        for path in ("/fapi/v2/account", "/fapi/v3/account"):
            data = self._request_get(path, {})
            if not isinstance(data, dict):
                continue
            v = data.get("dualSidePosition")
            if v in (True, "true", "True", 1, "1"):
                return True
            if v in (False, "false", "False", 0, "0"):
                return False
        return None

    def has_open_positions(self) -> Optional[bool]:
        """
        True if any USD-M futures position is non-zero (GET /fapi/v3/account positions).
        Binance blocks POST /positionSide/dual while any position exists (-4059), even with no open orders.
        """
        acc = self.get_account_v3()
        if not acc or "positions" not in acc:
            return None
        for p in acc["positions"]:
            try:
                if abs(float(p.get("positionAmt", 0) or 0)) > 1e-12:
                    return True
            except (TypeError, ValueError):
                continue
        return False

    def set_dual_side_position(self, dual: bool) -> Optional[Dict[str, Any]]:
        """
        POST /fapi/v1/positionSide/dual — set hedge vs one-way.
        dual=True → hedge (LONG/SHORT). dual=False → one-way (BOTH).
        Fails (-4059) if open positions or open orders exist.
        """
        params = {"dualSidePosition": "true" if dual else "false"}
        return self._request_post("/fapi/v1/positionSide/dual", params)

    def ensure_position_mode_matches(self, want_hedge: bool) -> tuple[bool, Optional[str]]:
        """
        Ensure account dualSidePosition matches bot (hedge vs one-way).
        Calls set_dual_side_position if needed. Call before orders to avoid -4061.
        Returns (True, None) on success, (False, error_message) on failure.
        """
        current = self.get_dual_side_position()
        if current == want_hedge:
            return True, None
        if current is None:
            logging.warning(
                "[Binance] dualSidePosition missing from account response — will try POST /positionSide/dual "
                "(ensure API key has Futures + read permission)"
            )

        open_pos = self.has_open_positions()

        # Switching one-way ↔ hedge requires a flat account (Binance rule). EXIT_* and reduce-only orders
        # intentionally run while a position exists — only block when we *know* mode is wrong and must change.
        need_mode_switch = current is not None and current != want_hedge
        if need_mode_switch and open_pos is True:
            return (
                False,
                "Cannot switch position mode: Binance requires a flat account (zero size on every symbol). "
                "Close positions and open orders on USD-M Futures, then retry.",
            )

        # Mode unknown but we have open positions: cannot POST a mode change while non-flat; assume hedge matches.
        if current is None and open_pos is True:
            logging.warning(
                "[Binance] dualSidePosition unreadable with open positions — skipping POST /positionSide/dual; "
                "proceeding (EXIT/BUY cannot require flat account)."
            )
            return True, None

        if open_pos is None:
            logging.warning("[Binance] Could not read positions; attempting set_dual_side_position anyway")
        logging.info("[Binance] Switching position mode to %s via API...", "hedge" if want_hedge else "one-way")
        res = self.set_dual_side_position(want_hedge)
        if isinstance(res, dict) and res.get("_error"):
            raw = res.get("response", "") or ""
            parsed = _parse_binance_error_body(raw)
            if isinstance(parsed, dict) and _is_no_need_position_side_change(parsed):
                logging.info(
                    "[Binance] Already in %s mode (Binance: %s) — continuing to order.",
                    "hedge" if want_hedge else "one-way",
                    (parsed.get("msg") or "").strip(),
                )
                return True, None
            if isinstance(parsed, dict) and isinstance(parsed.get("code"), int):
                code = parsed["code"]
                msg = parsed.get("msg", raw)[:500]
                if code == -4059:
                    msg += (
                        " — Close every open *position* (and orders) on USD-M Futures for this API key, "
                        "then retry. 'No orders' is not enough if any position size is non-zero."
                    )
                return False, msg
            return False, raw[:500] if raw else res.get("message", "set_dual_side_position failed")[:500]
        if isinstance(res, dict) and isinstance(res.get("code"), int) and res["code"] < 0:
            msg = res.get("msg", str(res))
            if res.get("code") == -4059:
                msg += (
                    " — Close all positions on this Futures account (not only orders), then retry."
                )
            return False, msg
        after = self.get_dual_side_position()
        if after != want_hedge:
            if after is None:
                return (
                    False,
                    "Position mode could not be verified after API set (dualSidePosition still missing). "
                    "Enable 'Enable Reading' + Futures on the API key, or set hedge mode once in Binance Futures UI.",
                )
            return False, "Position mode still does not match after API set (check Binance app)"
        return True, None

    def set_leverage(self, symbol: str, leverage: int, recv_window: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        POST /fapi/v1/leverage — set target leverage for a symbol (1–125; max per symbol is enforced by Binance).
        Call before opening/adjusting positions when the webhook sends a leverage value.
        """
        lev = int(leverage)
        if lev < 1:
            lev = 1
        if lev > 125:
            lev = 125
        params: Dict[str, Any] = {"symbol": symbol.upper(), "leverage": lev}
        if recv_window is not None:
            params["recvWindow"] = recv_window
        return self._request_post("/fapi/v1/leverage", params)

    def place_market_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        reduce_only: bool = False,
        position_mode: str = "hedge",
        new_order_resp_type: str = "RESULT",
    ) -> Optional[Dict[str, Any]]:
        """
        POST /fapi/v1/order MARKET. side = BUY or SELL.
        In hedge mode: reduce_only=True + SELL closes LONG; reduce_only=True + BUY closes SHORT.
        """
        symbol = symbol.upper()
        side = side.upper()
        if position_mode == "hedge":
            if reduce_only:
                position_side = "LONG" if side == "SELL" else "SHORT"
            else:
                position_side = "LONG" if side == "BUY" else "SHORT"
        else:
            position_side = "BOTH"
        params = {
            "symbol": symbol,
            "side": side,
            "positionSide": position_side,
            "type": "MARKET",
            "quantity": str(quantity),
            "newOrderRespType": new_order_resp_type,
        }
        if reduce_only and position_mode != "hedge":
            params["reduceOnly"] = "true"
        return self._request_post("/fapi/v1/order", params)
