"""Binance USD-M Futures REST client for the BINANCE_ABCD engine.

Ported from the reference engine (HMAC SHA256 signing, LOT_SIZE quantization,
position-mode verified cache) with one addition: a process-wide 429/418
backoff gate. When Binance rate-limits (429) or IP-bans (418) any request,
every subsequent request fails fast with ``{_error, rate_limited: True}``
until the window passes — the retry queue owns re-running, threads never
sleep inside the fan-out.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time
from decimal import ROUND_DOWN, Decimal, InvalidOperation
from typing import Any, Callable, Dict, List, Optional

import requests

from binance_abcd.hooks import API_TIMEOUT, BINANCE_API_BASE, POSITION_MODE_CACHE_TTL
from binance_abcd.http_client import get_session

log = logging.getLogger(__name__)

# --- 429/418 global backoff ---------------------------------------------------
_BACKOFF_LOCK = threading.Lock()
_backoff_until = 0.0
_backoff_alerted = False
_rate_limit_alert_hook: Optional[Callable[[str], None]] = None

_DEFAULT_BACKOFF_429 = 60.0
_DEFAULT_BACKOFF_418 = 300.0


def set_rate_limit_alert_hook(hook: Callable[[str], None]) -> None:
    """Called once per backoff window with a human-readable message."""
    global _rate_limit_alert_hook
    _rate_limit_alert_hook = hook


def rate_limited_until() -> float:
    """Epoch until which requests fail fast; 0 when clear."""
    with _BACKOFF_LOCK:
        return _backoff_until if time.time() < _backoff_until else 0.0


def _enter_backoff(status: int, retry_after: str | None) -> None:
    global _backoff_until, _backoff_alerted
    try:
        delay = float(retry_after) if retry_after else 0.0
    except ValueError:
        delay = 0.0
    if delay <= 0:
        delay = _DEFAULT_BACKOFF_418 if status == 418 else _DEFAULT_BACKOFF_429
    with _BACKOFF_LOCK:
        until = time.time() + delay
        fire_alert = until > _backoff_until and not _backoff_alerted
        _backoff_until = max(_backoff_until, until)
        if fire_alert:
            _backoff_alerted = True
    if fire_alert:
        message = f"Binance rate limit (HTTP {status}) — backing off {delay:.0f}s"
        log.critical("[Binance] %s", message)
        if _rate_limit_alert_hook:
            try:
                _rate_limit_alert_hook(message)
            except Exception:  # noqa: BLE001
                pass


def _backoff_error() -> Dict[str, Any]:
    return {
        "_error": True,
        "rate_limited": True,
        "message": "Binance rate-limit backoff in effect",
        "response": "",
        "http_status": 429,
    }


def _check_clear() -> bool:
    """True when requests may proceed; resets the alert flag once clear."""
    global _backoff_alerted
    with _BACKOFF_LOCK:
        if time.time() < _backoff_until:
            return False
        _backoff_alerted = False
        return True


# --- Position-mode verified cache: api_key -> epoch expiry --------------------
_MODE_VERIFIED: Dict[str, float] = {}
_MODE_VERIFIED_LOCK = threading.Lock()

# --- LOT_SIZE stepSize per symbol, cached per futures base_url ----------------
_STEP_SIZE_CACHE: Dict[str, Dict[str, str]] = {}
_STEP_SIZE_LOCK = threading.Lock()


def _quantize_to_step(quantity: float, step: str) -> Optional[str]:
    """Floor quantity to a multiple of step, formatted to step precision.
    None if the result is <= 0 (below one step) or inputs are bad."""
    try:
        q = Decimal(str(quantity))
        s = Decimal(str(step))
    except (InvalidOperation, ValueError):
        return None
    if s <= 0 or q <= 0:
        return None
    floored = ((q / s).to_integral_value(rounding=ROUND_DOWN) * s).quantize(s)
    if floored <= 0:
        return None
    return format(floored, "f")


def mark_position_mode_verified(api_key: str) -> None:
    if not api_key:
        return
    with _MODE_VERIFIED_LOCK:
        _MODE_VERIFIED[api_key] = time.time() + POSITION_MODE_CACHE_TTL


def is_position_mode_verified(api_key: str) -> bool:
    if not api_key:
        return False
    with _MODE_VERIFIED_LOCK:
        expiry = _MODE_VERIFIED.get(api_key)
        if expiry is None:
            return False
        if time.time() >= expiry:
            _MODE_VERIFIED.pop(api_key, None)
            return False
        return True


def invalidate_position_mode(api_key: str) -> None:
    if not api_key:
        return
    with _MODE_VERIFIED_LOCK:
        _MODE_VERIFIED.pop(api_key, None)


def _parse_binance_error_body(text: str) -> Optional[Dict[str, Any]]:
    if not text or not text.strip().startswith("{"):
        return None
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _is_no_need_position_side_change(parsed: Dict[str, Any]) -> bool:
    """-4059 'No need to change position side.' = already in the wanted mode."""
    if not isinstance(parsed.get("code"), int) or parsed["code"] != -4059:
        return False
    return "no need" in (parsed.get("msg") or "").lower()


def _sign(secret: str, query: str) -> str:
    return hmac.new(secret.encode("utf-8"), query.encode("utf-8"), hashlib.sha256).hexdigest()


class BinanceAPI:
    """Signed client for one account. base_url selects mainnet vs testnet (demo)."""

    def __init__(
        self,
        api_key: str,
        secret_key: str,
        base_url: Optional[str] = None,
        timeout: float = API_TIMEOUT,
    ):
        self.api_key = (api_key or "").strip()
        self.secret_key = (secret_key or "").strip()
        self.base_url = (base_url or BINANCE_API_BASE).rstrip("/")
        self.timeout = timeout

    def _handle_rate_limit(self, response: requests.Response | None) -> None:
        if response is not None and response.status_code in (418, 429):
            _enter_backoff(response.status_code, response.headers.get("Retry-After"))

    def _request_get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        if not _check_clear():
            return None
        params = dict(params or {})
        params["timestamp"] = int(time.time() * 1000)
        query = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        signature = _sign(self.secret_key, query)
        url = f"{self.base_url}{path}?{query}&signature={signature}"
        try:
            resp = get_session().get(url, headers={"X-MBX-APIKEY": self.api_key}, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            response = getattr(exc, "response", None)
            self._handle_rate_limit(response)
            log.error("[Binance] GET %s: %s", path, exc)
            if response is not None and response.text:
                log.error("[Binance] response: %.500s", response.text)
            return None

    def _request_post(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        if not _check_clear():
            return _backoff_error()
        params = dict(params or {})
        params["timestamp"] = int(time.time() * 1000)
        query = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        body = f"{query}&signature={_sign(self.secret_key, query)}"
        headers = {"X-MBX-APIKEY": self.api_key, "Content-Type": "application/x-www-form-urlencoded"}
        try:
            resp = get_session().post(f"{self.base_url}{path}", data=body, headers=headers, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            response = getattr(exc, "response", None)
            self._handle_rate_limit(response)
            err_text = ""
            http_status = None
            if response is not None:
                http_status = response.status_code
                err_text = (response.text or "")[:500]
                log.error("[Binance] POST %s: %s — %s", path, exc, err_text)
            else:
                # Timeout / connection error: execution status is UNKNOWN.
                log.error("[Binance] POST %s: %s", path, exc)
            return {
                "_error": True,
                "message": str(exc),
                "response": err_text,
                "http_status": http_status,
                "rate_limited": http_status in (418, 429),
            }

    # --- market data ----------------------------------------------------------

    def get_step_size(self, symbol: str) -> Optional[str]:
        """LOT_SIZE stepSize from /fapi/v1/exchangeInfo, cached per base_url."""
        symbol = symbol.upper()
        cache = _STEP_SIZE_CACHE.get(self.base_url)
        if cache is None:
            with _STEP_SIZE_LOCK:
                cache = _STEP_SIZE_CACHE.get(self.base_url)
                if cache is None:
                    parsed: Dict[str, str] = {}
                    data = self._request_get("/fapi/v1/exchangeInfo", {})
                    for entry in ((data or {}).get("symbols") or []):
                        sym = entry.get("symbol")
                        for f in (entry.get("filters") or []):
                            if f.get("filterType") == "LOT_SIZE":
                                step = f.get("stepSize")
                                if sym and step:
                                    parsed[sym] = step
                                break
                    if not parsed:
                        # Fetch failed — don't cache, next order retries.
                        log.warning("[Binance] exchangeInfo returned no stepSizes (%s)", self.base_url)
                        return None
                    cache = parsed
                    _STEP_SIZE_CACHE[self.base_url] = cache
                    log.info("[Binance] cached stepSize for %d symbols (%s)", len(cache), self.base_url)
        return cache.get(symbol)

    # --- account reads --------------------------------------------------------

    def get_account_v3(self) -> Optional[Dict[str, Any]]:
        return self._request_get("/fapi/v3/account")

    def get_balance_v3(self) -> Optional[List[Dict[str, Any]]]:
        data = self._request_get("/fapi/v3/balance")
        return data if isinstance(data, list) else None

    def get_positions_v3(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """GET /fapi/v3/positionRisk — positions with entryPrice etc. Weight 5."""
        params: Dict[str, Any] = {}
        if symbol:
            params["symbol"] = symbol.upper()
        data = self._request_get("/fapi/v3/positionRisk", params)
        if not isinstance(data, list):
            return []
        return [p for p in data if float(p.get("positionAmt", 0)) != 0]

    def get_user_trades(self, symbol: str, order_id: Optional[int] = None, limit: int = 10) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"symbol": symbol.upper(), "limit": limit}
        if order_id is not None:
            params["orderId"] = order_id
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
        """GET /fapi/v1/income (TRANSFER, REALIZED_PNL, ...). Weight 30."""
        params: Dict[str, Any] = {"limit": min(limit, 1000)}
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

    # --- position mode --------------------------------------------------------

    def get_dual_side_position(self) -> Optional[bool]:
        """True = hedge, False = one-way, None = unreadable."""
        data = self._request_get("/fapi/v1/positionSide/dual", {})
        if not isinstance(data, dict):
            return None
        value = data.get("dualSidePosition")
        if value in (True, "true", "True", 1, "1"):
            return True
        if value in (False, "false", "False", 0, "0"):
            return False
        return None

    def has_open_positions(self) -> Optional[bool]:
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
        """POST /fapi/v1/positionSide/dual. Fails (-4059) while positions exist."""
        return self._request_post("/fapi/v1/positionSide/dual", {"dualSidePosition": "true" if dual else "false"})

    def ensure_position_mode_matches(self, want_hedge: bool) -> tuple[bool, Optional[str]]:
        """Align the account's dualSidePosition with the engine's mode.
        (True, None) on success; (False, why) when the account can't be aligned."""
        current = self.get_dual_side_position()
        if current == want_hedge:
            return True, None

        open_positions = self.has_open_positions()

        # Switching one-way <-> hedge requires a flat account (Binance rule).
        need_switch = current is not None and current != want_hedge
        if need_switch and open_positions is True:
            return (
                False,
                "Cannot switch position mode: Binance requires a flat account. "
                "Close all USD-M positions and orders, then retry.",
            )

        # Mode unreadable but positions exist: cannot POST a change; proceed
        # (exits must never require a flat account).
        if current is None and open_positions is True:
            log.warning("[Binance] dualSidePosition unreadable with open positions — proceeding")
            return True, None

        result = self.set_dual_side_position(want_hedge)
        if isinstance(result, dict) and result.get("_error"):
            parsed = _parse_binance_error_body(result.get("response", "") or "")
            if isinstance(parsed, dict) and _is_no_need_position_side_change(parsed):
                return True, None
            if isinstance(parsed, dict) and isinstance(parsed.get("code"), int):
                message = str(parsed.get("msg", ""))[:500]
                if parsed["code"] == -4059:
                    message += " — close every open position for this API key, then retry."
                return False, message
            raw = result.get("response") or result.get("message") or "set_dual_side_position failed"
            return False, str(raw)[:500]

        after = self.get_dual_side_position()
        if after != want_hedge:
            return False, "Position mode still does not match after API set (check the Binance app)."
        return True, None

    # --- trading --------------------------------------------------------------

    def set_leverage(self, symbol: str, leverage: int) -> Optional[Dict[str, Any]]:
        """POST /fapi/v1/leverage (clamped 1-125)."""
        lev = max(1, min(125, int(leverage)))
        return self._request_post("/fapi/v1/leverage", {"symbol": symbol.upper(), "leverage": lev})

    def place_market_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        reduce_only: bool = False,
        position_mode: str = "hedge",
        new_order_resp_type: str = "RESULT",
    ) -> Optional[Dict[str, Any]]:
        """POST /fapi/v1/order MARKET. Hedge mode: reduce_only + SELL closes LONG,
        reduce_only + BUY closes SHORT."""
        symbol = symbol.upper()
        side = side.upper()
        if position_mode == "hedge":
            if reduce_only:
                position_side = "LONG" if side == "SELL" else "SHORT"
            else:
                position_side = "LONG" if side == "BUY" else "SHORT"
        else:
            position_side = "BOTH"

        # Floor to the symbol's stepSize so Binance doesn't -1111 the order.
        qty_str = str(quantity)
        step = self.get_step_size(symbol)
        if step:
            rounded = _quantize_to_step(quantity, step)
            if rounded is None:
                log.error("[Binance] %s quantity %s below one stepSize (%s) — order skipped", symbol, quantity, step)
                return {"_error": True, "message": "quantity below stepSize", "response": ""}
            if rounded != qty_str:
                log.info("[Binance] %s qty %s -> %s (stepSize %s)", symbol, quantity, rounded, step)
            qty_str = rounded

        params: Dict[str, Any] = {
            "symbol": symbol,
            "side": side,
            "positionSide": position_side,
            "type": "MARKET",
            "quantity": qty_str,
            "newOrderRespType": new_order_resp_type,
        }
        if reduce_only and position_mode != "hedge":
            params["reduceOnly"] = "true"
        return self._request_post("/fapi/v1/order", params)
