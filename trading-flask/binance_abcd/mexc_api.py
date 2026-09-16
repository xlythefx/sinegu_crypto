"""MEXC USDT-M futures REST client — the OPEN-API, one host, no testnet.

Re-implemented from MEXC's futures Open API materials (a condensed copy lives
in the read-only reference project's api-docs/mexc/) for the engine's own
conventions: the same failure dict the Binance client returns, the same
"None is a failed read, [] is an empty one" rule, credential verdicts routed
through key_status, and units converted at this edge so nothing above it
knows a MEXC contract from a coin.

Signing (futures OPEN-API, NOT the spot v3 scheme with X-MEXC-APIKEY):
  - Headers: ApiKey, Request-Time (ms, string), Signature, Recv-Window,
    Content-Type: application/json, Language: English.
  - String to sign: access_key + request_time + parameter_string.
  - GET/DELETE parameter_string: business params with None dropped, sorted by
    key, joined k=v&k=v — and that SAME string is the query string sent.
  - POST parameter_string: the JSON body EXACTLY as sent (compact separators,
    no key sorting) — hence `data=payload`, never `json=`.
  - Path parameters are not signed. No params -> "".
  - signature = HMAC-SHA256(secret, string_to_sign).hexdigest() (lowercase).

Two MEXC facts that shape everything below:

* **Business errors arrive as HTTP 200 with `success: false`.** A wrong
  signature (602), an IP not on the key's whitelist (406), an unknown contract
  (1001) all come back 200. Both request methods therefore judge the ENVELOPE,
  not the status; a 2xx is not a success until `success` is true.
* **`vol` is in CONTRACTS.** Each contract is `contractSize` coins (BTC_USDT:
  0.0001), quantities must land on `volScale` decimals and at or above
  `minVol`, or the order is refused with 2015 "Price or quantity precision
  error". `coins_to_vol` is the one place that conversion happens on the way
  out; the adapter multiplies back on every read.

Host: https://api.mexc.com. The older contract.mexc.com answers 403 HTML from
the edge, not a JSON error.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time
from decimal import ROUND_DOWN, ROUND_HALF_EVEN, Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

import requests

from binance_abcd import key_status
from binance_abcd.exchange_api import failure
from binance_abcd.hooks import (
    API_TIMEOUT,
    MEXC_API_BASE,
    MEXC_CONTRACTS_CACHE_TTL,
    MEXC_FAIR_PRICE_CACHE_TTL,
    MEXC_RECV_WINDOW,
)
from binance_abcd.http_client import get_session

log = logging.getLogger(__name__)

EXCHANGE = "mexc"

# --- Error classification -----------------------------------------------------
# The request failed on the way, or MEXC itself was unwell: worth re-attempting
# (an exit re-reads first; an entry never replays a timeout — see the webhook).
TRANSIENT_CODES = frozenset({500, 501, 513, 9999})
# "Requests are too frequent" / "Trading too frequent": failed fast, before any
# order, so the retry queue may re-run it. Per key+endpoint on MEXC, so there is
# no process-wide gate like Binance's 429/418 backoff — one noisy account must
# not stall every other MEXC account.
RATE_LIMIT_CODES = frozenset({510, 2037})
# "This feature is under maintenance" / "System under maintenance". Treated as
# a REJECTION, not a transient: 604 is also what order/create answers for a
# key not whitelisted for API futures trading, which no retry ever fixes.
MAINTENANCE_CODES = frozenset({604, 801})
_TRANSIENT_HTTP = frozenset({408, 500, 502, 503, 504})

# Query parameter names for the time window on the history endpoints. The
# platform rule is snake_case for GET; the condensed docs list camelCase for
# history_orders only, which reads like a transcription slip. One place to
# flip if the live API disagrees (smoke check 3(e) in the plan).
HISTORY_START_PARAM = "start_time"
HISTORY_END_PARAM = "end_time"

# Order side codes.
SIDE_OPEN_LONG = 1
SIDE_CLOSE_SHORT = 2
SIDE_OPEN_SHORT = 3
SIDE_CLOSE_LONG = 4
ORDER_TYPE_MARKET = 5
POSITION_LONG = 1
POSITION_SHORT = 2
MODE_HEDGE = 1
MODE_ONE_WAY = 2
ORDER_STATE_FILLED = 3
ORDER_STATES_DEAD = frozenset({4, 5})  # cancelled, invalid


def to_contract_symbol(ticker: str) -> Optional[str]:
    """``BTCUSDT`` -> ``BTC_USDT``. A symbol already carrying an underscore is
    passed through upper-cased; anything not quoted in USDT is None — this
    engine trades USDT-margined contracts only, and guessing a quote is how a
    ticker ends up on the wrong contract."""
    sym = (ticker or "").strip().upper()
    if not sym:
        return None
    if "_" in sym:
        return sym
    if sym.endswith("USDT") and len(sym) > 4:
        return f"{sym[:-4]}_USDT"
    return None


def to_ticker(symbol: str) -> str:
    """``BTC_USDT`` -> ``BTCUSDT`` — the form every table and every signal uses."""
    return (symbol or "").replace("_", "").upper()


def classify_code(code: Optional[int], http_status: Optional[int]) -> dict:
    """The verdicts the failure dict carries, from MEXC's code + HTTP status."""
    return {
        "transient": http_status is None or http_status in _TRANSIENT_HTTP or code in TRANSIENT_CODES,
        "rate_limited": http_status == 429 or code in RATE_LIMIT_CODES,
        "credential": code in key_status.CREDENTIAL_CODES.get(EXCHANGE, {}),
        "maintenance": code in MAINTENANCE_CODES,
    }


def _sign(secret: str, payload: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def _param_string(params: Optional[Dict[str, Any]]) -> str:
    clean = {k: v for k, v in (params or {}).items() if v is not None}
    return "&".join(f"{k}={clean[k]}" for k in sorted(clean))


def _int_code(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _unwrap_list(data: Any) -> Optional[list]:
    """History endpoints answer either a bare list or a pagination wrapper with
    ``resultList``; both shapes are documented and both have been seen live."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        inner = data.get("resultList")
        if inner is None:
            inner = data.get("result_list")
        if isinstance(inner, list):
            return inner
        if not data:
            return []
    return None


# --- Public data caches (module-level: shared by every account) ---------------
_CONTRACTS_LOCK = threading.Lock()
_CONTRACTS_CACHE: Dict[str, tuple[float, Dict[str, dict]]] = {}  # base_url -> (expires, {symbol: row})
_FAIR_LOCK = threading.Lock()
_FAIR_CACHE: Dict[tuple[str, str], tuple[float, float]] = {}    # (base_url, symbol) -> (expires, price)


def reset_caches() -> None:
    """Test hook."""
    with _CONTRACTS_LOCK:
        _CONTRACTS_CACHE.clear()
    with _FAIR_LOCK:
        _FAIR_CACHE.clear()


class MexcFuturesAPI:
    """Signed client for one account. One base_url — there is no testnet."""

    def __init__(
        self,
        api_key: str,
        secret_key: str,
        base_url: Optional[str] = None,
        timeout: float = API_TIMEOUT,
        recv_window: int = MEXC_RECV_WINDOW,
    ):
        self.api_key = (api_key or "").strip()
        self.secret_key = (secret_key or "").strip()
        self.base_url = (base_url or MEXC_API_BASE).rstrip("/")
        self.timeout = timeout
        self.recv_window = int(recv_window or 0)

    # --- signing / transport ------------------------------------------------

    def _headers(self, param_string: str) -> Dict[str, str]:
        ts = str(int(time.time() * 1000))
        headers = {
            "ApiKey": self.api_key,
            "Request-Time": ts,
            "Signature": _sign(self.secret_key, self.api_key + ts + param_string),
            "Content-Type": "application/json",
            # Default message language is Chinese; alerts quote these messages.
            "Language": "English",
        }
        if self.recv_window > 0:
            headers["Recv-Window"] = str(self.recv_window)
        return headers

    def _judge_body(self, body: Any, account_scoped: bool) -> None:
        """Route a credential verdict to key_status when the body carries one."""
        if not account_scoped or not isinstance(body, dict):
            return
        verdict = key_status.classify(body, EXCHANGE)
        if verdict is not None:
            code, reason, message = verdict
            key_status.report_blocked(self.api_key, code, reason, message, EXCHANGE)

    @staticmethod
    def _parse_body(text: str) -> Optional[dict]:
        if not text or not text.lstrip().startswith("{"):
            return None
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return None
        return data if isinstance(data, dict) else None

    def _request_get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        account_scoped: bool = True,
    ) -> Optional[Any]:
        """The envelope's ``data`` on success; ``None`` on ANY failure — transport,
        non-2xx, bad JSON, or ``success: false``. ``account_scoped=False`` for
        public data (contract specs, fair price): such a call succeeds with any
        key, so it must never clear a blocked flag."""
        param_string = _param_string(params)
        url = f"{self.base_url}{path}" + (f"?{param_string}" if param_string else "")
        try:
            resp = get_session().get(url, headers=self._headers(param_string), timeout=self.timeout)
            resp.raise_for_status()
        except requests.RequestException as exc:
            response = getattr(exc, "response", None)
            text = (response.text or "")[:500] if response is not None else ""
            self._judge_body(self._parse_body(text), account_scoped)
            log.error("[MEXC] GET %s: %s%s", path, exc, f" — {text}" if text else "")
            return None
        try:
            envelope = resp.json()
        except ValueError:
            log.error("[MEXC] GET %s: non-JSON response %.200s", path, resp.text)
            return None
        if not isinstance(envelope, dict) or envelope.get("success") is not True:
            self._judge_body(envelope, account_scoped)
            log.error("[MEXC] GET %s refused: %.300s", path, envelope)
            return None
        if account_scoped:
            key_status.report_ok(self.api_key, EXCHANGE)
        data = envelope.get("data")
        return data if data is not None else {}

    def _request_post(self, path: str, body: Optional[Dict[str, Any]] = None) -> dict:
        """The full envelope (``{"success": True, "code": 0, "data": ...}``) on
        success, else the engine's failure dict with MEXC's ``code`` stamped on
        it and the transient / rate_limited / maintenance verdicts set."""
        clean = {k: v for k, v in (body or {}).items() if v is not None}
        payload = json.dumps(clean, separators=(",", ":")) if clean else ""
        try:
            resp = get_session().post(
                f"{self.base_url}{path}",
                data=payload if payload else None,
                headers=self._headers(payload),
                timeout=self.timeout,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            response = getattr(exc, "response", None)
            http_status = response.status_code if response is not None else None
            text = (response.text or "")[:500] if response is not None else ""
            parsed = self._parse_body(text)
            self._judge_body(parsed, True)
            code = _int_code(parsed.get("code")) if parsed else None
            verdict = classify_code(code, http_status)
            if response is not None:
                log.error("[MEXC] POST %s: %s — %s", path, exc, text)
            else:
                # Timeout / connection error: execution status is UNKNOWN.
                log.error("[MEXC] POST %s: %s", path, exc)
            return failure(
                (parsed or {}).get("message") or str(exc),
                code=code, response=text, http_status=http_status,
                rate_limited=verdict["rate_limited"], transient=verdict["transient"],
                maintenance=verdict["maintenance"],
            )
        try:
            envelope = resp.json()
        except ValueError:
            log.error("[MEXC] POST %s: non-JSON response %.200s", path, resp.text)
            return failure("non-JSON response", response=(resp.text or "")[:500], http_status=resp.status_code, transient=True)
        if not isinstance(envelope, dict) or envelope.get("success") is not True:
            body_dict = envelope if isinstance(envelope, dict) else {}
            self._judge_body(body_dict, True)
            code = _int_code(body_dict.get("code"))
            verdict = classify_code(code, resp.status_code)
            text = json.dumps(envelope)[:500] if envelope is not None else ""
            log.error("[MEXC] POST %s refused: %s", path, text)
            return failure(
                str(body_dict.get("message") or "request refused"),
                code=code, response=text, http_status=resp.status_code,
                rate_limited=verdict["rate_limited"], transient=verdict["transient"],
                maintenance=verdict["maintenance"],
            )
        key_status.report_ok(self.api_key, EXCHANGE)
        return envelope

    # --- public market data ---------------------------------------------------

    def contracts(self) -> Optional[Dict[str, dict]]:
        """Every contract's spec keyed by symbol (GET /api/v1/contract/detail
        with no symbol), cached per base_url. A failed fetch is NOT cached, so
        the next order retries it."""
        now = time.time()
        cached = _CONTRACTS_CACHE.get(self.base_url)
        if cached and cached[0] > now:
            return cached[1]
        with _CONTRACTS_LOCK:
            cached = _CONTRACTS_CACHE.get(self.base_url)
            if cached and cached[0] > now:
                return cached[1]
            data = self._request_get("/api/v1/contract/detail", account_scoped=False)
            rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) and data.get("symbol") else None)
            if not rows:
                log.warning("[MEXC] contract/detail returned no contracts (%s)", self.base_url)
                return None
            parsed = {str(r.get("symbol")).upper(): r for r in rows if isinstance(r, dict) and r.get("symbol")}
            _CONTRACTS_CACHE[self.base_url] = (now + MEXC_CONTRACTS_CACHE_TTL, parsed)
            log.info("[MEXC] cached %d contract specs (%s)", len(parsed), self.base_url)
            return parsed

    def contract(self, symbol: str) -> Optional[dict]:
        contracts = self.contracts()
        return contracts.get(symbol.upper()) if contracts else None

    def contract_size(self, symbol: str) -> Optional[float]:
        """Coins per contract; None when the contract is unknown or the spec is
        unusable — never a guessed 1.0, which would misprice every quantity."""
        spec = self.contract(symbol)
        if not spec:
            return None
        try:
            size = float(spec.get("contractSize") or 0)
        except (TypeError, ValueError):
            return None
        return size if size > 0 else None

    def fair_price(self, symbol: str) -> Optional[float]:
        """GET /api/v1/contract/fair_price/{symbol}, cached briefly — one positions
        tick asks for the same symbol once per account holding it."""
        key = (self.base_url, symbol.upper())
        now = time.time()
        cached = _FAIR_CACHE.get(key)
        if cached and cached[0] > now:
            return cached[1]
        data = self._request_get(f"/api/v1/contract/fair_price/{symbol.upper()}", account_scoped=False)
        if not isinstance(data, dict):
            return None
        try:
            price = float(data.get("fairPrice") or 0)
        except (TypeError, ValueError):
            return None
        if price <= 0:
            return None
        with _FAIR_LOCK:
            _FAIR_CACHE[key] = (now + MEXC_FAIR_PRICE_CACHE_TTL, price)
        return price

    def coins_to_vol(self, symbol: str, coins: float, *, closing: bool = False) -> Optional[str]:
        """Coins -> contracts as the string MEXC accepts.

        Entries FLOOR to ``volScale`` decimals (never round a size up — the
        account did not ask for more exposure) and refuse anything under
        ``minVol`` or on a contract flagged ``apiAllowed: false``. Exits round
        half-even, so a whole position whose coin figure carries float dust
        (2.9999999 contracts) closes as 3, never as a partial close that leaves
        one contract open. None means "do not place this order".
        """
        spec = self.contract(symbol)
        if not spec:
            return None
        if spec.get("apiAllowed") is False:
            log.warning("[MEXC] %s is not API-tradable (apiAllowed=false)", symbol)
            return None
        try:
            size = Decimal(str(spec.get("contractSize") or 0))
            scale = int(spec.get("volScale") or 0)
            min_vol = Decimal(str(spec.get("minVol") or 0))
            amount = Decimal(str(coins))
        except (InvalidOperation, TypeError, ValueError):
            return None
        if size <= 0 or amount <= 0:
            return None
        quantum = Decimal(1).scaleb(-scale)
        vol = (amount / size).quantize(quantum, rounding=ROUND_HALF_EVEN if closing else ROUND_DOWN)
        if vol <= 0 or (min_vol > 0 and vol < min_vol):
            return None
        return format(vol.normalize(), "f")

    # --- account -----------------------------------------------------------

    def asset(self, currency: str = "USDT") -> Optional[dict]:
        """GET /api/v1/private/account/asset/{currency}."""
        data = self._request_get(f"/api/v1/private/account/asset/{currency.upper()}")
        return data if isinstance(data, dict) and data else None

    def transfer_records(self, *, state: str = "SUCCESS", page_num: int = 1, page_size: int = 100) -> Optional[List[dict]]:
        """GET /api/v1/private/account/transfer_record — one page of futures-wallet
        transfers. None on a failed read."""
        data = self._request_get(
            "/api/v1/private/account/transfer_record",
            {"state": state, "page_num": int(page_num), "page_size": int(min(page_size, 100))},
        )
        return _unwrap_list(data)

    # --- positions ----------------------------------------------------------

    def open_positions(self, symbol: Optional[str] = None) -> Optional[List[dict]]:
        """GET /api/v1/private/position/open_positions — rows with holdVol > 0.
        **None is a failed read; [] is genuinely flat** (see BinanceAPI.get_positions_v3
        for why the two must never be the same value)."""
        params = {"symbol": symbol.upper()} if symbol else None
        data = self._request_get("/api/v1/private/position/open_positions", params)
        rows = _unwrap_list(data)
        if rows is None:
            return None
        out = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            try:
                if float(row.get("holdVol") or 0) > 0:
                    out.append(row)
            except (TypeError, ValueError):
                continue
        return out

    def position_mode(self) -> Optional[int]:
        """1 hedge (dual-side), 2 one-way, None unreadable."""
        data = self._request_get("/api/v1/private/position/position_mode")
        raw = data.get("positionMode") if isinstance(data, dict) else data
        mode = _int_code(raw)
        return mode if mode in (MODE_HEDGE, MODE_ONE_WAY) else None

    def change_position_mode(self, mode: int) -> dict:
        """POST /api/v1/private/position/change_position_mode — only while flat."""
        return self._request_post("/api/v1/private/position/change_position_mode", {"positionMode": int(mode)})

    def leverage_settings(self, symbol: str) -> Optional[List[dict]]:
        """GET /api/v1/private/position/leverage?symbol= — the account's current
        leverage per positionType on that contract."""
        data = self._request_get("/api/v1/private/position/leverage", {"symbol": symbol.upper()})
        return _unwrap_list(data)

    def change_leverage(
        self,
        leverage: int,
        *,
        symbol: Optional[str] = None,
        open_type: Optional[int] = None,
        position_type: Optional[int] = None,
        position_id: Optional[int] = None,
    ) -> dict:
        """POST /api/v1/private/position/change_leverage. With a position:
        positionId; without: symbol + openType + positionType."""
        body: Dict[str, Any] = {"leverage": int(leverage)}
        if position_id is not None:
            body["positionId"] = int(position_id)
        else:
            body["symbol"] = symbol.upper() if symbol else None
            body["openType"] = int(open_type) if open_type is not None else None
            body["positionType"] = int(position_type) if position_type is not None else None
        return self._request_post("/api/v1/private/position/change_leverage", body)

    # --- orders -------------------------------------------------------------

    def create_order(
        self,
        symbol: str,
        side: int,
        vol: str,
        *,
        open_type: int,
        leverage: Optional[int] = None,
        position_id: Optional[int] = None,
        position_mode: Optional[int] = None,
        external_oid: Optional[str] = None,
    ) -> dict:
        """POST /api/v1/private/order/create — a MARKET order (type 5, price 0,
        the form proven live in the reference). `vol` is CONTRACTS as returned
        by coins_to_vol. side: 1 open long, 2 close short, 3 open short, 4 close
        long. `leverage` is required when opening; MEXC rejects a value that
        differs from an existing position's (7004), which is why the adapter
        reuses the position's own leverage when stacking."""
        try:
            vol_number: Any = int(vol) if "." not in str(vol) else float(vol)
        except (TypeError, ValueError):
            return failure(f"bad vol {vol!r}", transient=False)
        body: Dict[str, Any] = {
            "symbol": symbol.upper(),
            "price": 0,
            "vol": vol_number,
            "side": int(side),
            "type": ORDER_TYPE_MARKET,
            "openType": int(open_type),
            "leverage": int(leverage) if leverage is not None else None,
            "positionId": int(position_id) if position_id is not None else None,
            "positionMode": int(position_mode) if position_mode is not None else None,
            "externalOid": external_oid,
        }
        return self._request_post("/api/v1/private/order/create", body)

    def get_order(self, order_id: Any) -> Optional[dict]:
        """GET /api/v1/private/order/get/{orderId} — state, dealAvgPrice, dealVol."""
        oid = str(order_id or "").strip()
        if not oid:
            return None
        data = self._request_get(f"/api/v1/private/order/get/{oid}")
        return data if isinstance(data, dict) and data else None

    def deal_details(self, order_id: Any) -> Optional[List[dict]]:
        """GET /api/v1/private/order/deal_details/{orderId} — the order's fills
        (vol, price, fee, feeCurrency, profit). None on a failed read, [] while
        MEXC has not indexed them yet."""
        oid = str(order_id or "").strip()
        if not oid:
            return None
        return _unwrap_list(self._request_get(f"/api/v1/private/order/deal_details/{oid}"))

    def history_orders(
        self,
        *,
        states: str = str(ORDER_STATE_FILLED),
        start_ms: int,
        end_ms: int,
        page_num: int = 1,
        page_size: int = 100,
    ) -> Optional[List[dict]]:
        """GET /api/v1/private/order/list/history_orders — one page, all symbols."""
        data = self._request_get(
            "/api/v1/private/order/list/history_orders",
            {
                "states": states,
                HISTORY_START_PARAM: int(start_ms),
                HISTORY_END_PARAM: int(end_ms),
                "page_num": int(page_num),
                "page_size": int(min(page_size, 100)),
            },
        )
        return _unwrap_list(data)

    def order_deals(
        self, symbol: str, *, start_ms: int, end_ms: int, page_num: int = 1, page_size: int = 1000
    ) -> Optional[List[dict]]:
        """GET /api/v1/private/order/list/order_deals/v3 — one page of fills for
        one contract (the MEXC twin of Binance userTrades)."""
        data = self._request_get(
            "/api/v1/private/order/list/order_deals/v3",
            {
                "symbol": symbol.upper(),
                "start_time": int(start_ms),
                "end_time": int(end_ms),
                "page_num": int(page_num),
                "page_size": int(min(page_size, 1000)),
            },
        )
        return _unwrap_list(data)

    def funding_records(
        self, position_type: int, *, start_ms: int, end_ms: int, page_num: int = 1, page_size: int = 100
    ) -> Optional[List[dict]]:
        """GET /api/v1/private/position/funding_records — one page for one
        position type (the endpoint requires it, so a full read is two calls)."""
        data = self._request_get(
            "/api/v1/private/position/funding_records",
            {
                "position_type": int(position_type),
                "start_time": int(start_ms),
                "end_time": int(end_ms),
                "page_num": int(page_num),
                "page_size": int(min(page_size, 100)),
            },
        )
        return _unwrap_list(data)
