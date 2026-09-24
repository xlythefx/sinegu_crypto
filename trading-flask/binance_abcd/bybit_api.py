"""Bybit V5 REST client — USDT perpetuals (mainnet or Demo Trading).

Written for this engine's conventions, not ported from anywhere: the same
failure dict the Binance and MEXC clients return, the same "None is a failed
read, [] is an empty one" rule, credential verdicts routed through key_status,
and sizes rounded to the venue's grid at this edge so nothing above it knows a
qtyStep from a coin.

Signing (V5, HMAC — the RSA key type is not supported here):
  - Headers: X-BAPI-API-KEY, X-BAPI-TIMESTAMP (ms, string), X-BAPI-SIGN,
    X-BAPI-RECV-WINDOW (ms, string), Content-Type: application/json.
  - String to sign: timestamp + api_key + recv_window + parameter_string.
    Note the ORDER — it is not MEXC's (key + time + params) and not Binance's
    (the query string alone).
  - GET parameter_string: business params with None dropped, in INSERTION
    ORDER, joined k=v&k=v — and that SAME string is the query string sent.
    Bybit does NOT sort; `mexc_api._param_string` does, so it must not be
    reused here.
  - POST parameter_string: the JSON body EXACTLY as sent (compact separators)
    — hence `data=payload`, never `json=`.
  - signature = HMAC-SHA256(secret, string_to_sign).hexdigest() (lowercase).

Four Bybit facts that shape everything below:

* **Business errors arrive as HTTP 200 with `retCode != 0`.** A bad signature
  (10004), an IP not on the key's list (10010), an unknown symbol — all come
  back 200. Both request methods judge the ENVELOPE, not the status.
* **`category=linear` rides every call**, and `/v5/position/list` for linear
  requires `symbol` OR `settleCoin`. A bare `category=linear` is REFUSED; the
  account-wide read therefore always sends `settleCoin=USDT`.
* **Sizes are already base coins** (no contract conversion, unlike MEXC), but
  they must land on the instrument's `qtyStep` at or above `minOrderQty`.
  `round_qty` is the one place that happens.
* **A MARKET order can be accepted and then cancelled unfilled.** Bybit
  converts a market order to an IOC limit inside a slippage band against the
  mark price, so `retCode == 0` means ACCEPTED, not filled — which is why the
  adapter's fill summary has to recognise a dead order rather than retrying
  forever. On Binance and MEXC a market order effectively always fills.

Hosts: https://api.bybit.com (live) and https://api-demo.bybit.com (Demo
Trading — the ordinary bybit.com login, but keys minted in its own module and
not interchangeable with live ones). Requests from US or Mainland-China IPs are
answered 403 by the edge with a non-JSON body, whatever the key.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time
from decimal import ROUND_DOWN, ROUND_HALF_EVEN, Decimal, InvalidOperation
from typing import Any, Dict, Optional

import requests

from binance_abcd import key_status
from binance_abcd.exchange_api import failure
from binance_abcd.hooks import (
    API_TIMEOUT,
    BYBIT_API_BASE,
    BYBIT_INSTRUMENTS_CACHE_TTL,
    BYBIT_RECV_WINDOW_MS,
)
from binance_abcd.http_client import get_session

log = logging.getLogger(__name__)

EXCHANGE = "bybit"

CATEGORY = "linear"       # USDT-margined perpetuals; never inverse, never option
ACCOUNT_TYPE = "UNIFIED"
SETTLE_COIN = "USDT"

# Title case — Bybit rejects "BUY".
SIDE_BUY = "Buy"
SIDE_SELL = "Sell"
ORDER_TYPE_MARKET = "Market"

# positionIdx: which leg of a symbol an order or position belongs to.
POSITION_IDX_ONE_WAY = 0
POSITION_IDX_HEDGE_LONG = 1
POSITION_IDX_HEDGE_SHORT = 2

# `mode` for POST /v5/position/switch-mode.
MODE_ONE_WAY = 0
MODE_HEDGE = 3

# An order in one of these states will never fill — stop asking for its fills.
ORDER_STATUSES_DEAD = frozenset({"Cancelled", "Rejected", "Deactivated"})

# --- Error classification -----------------------------------------------------
# The request failed on the way, or Bybit itself was unwell.
#   10000 server error · 10002 request expired (our clock drifted outside
#   recv_window) · 10016 internal service error.
# 10002 is deliberately TRANSIENT and deliberately absent from
# key_status.CREDENTIAL_CODES: it is a fault on OUR box, the twin of Binance's
# -1021. Flagging it would start a 3-day disconnect clock on every Bybit
# account whenever prod's NTP slips.
TRANSIENT_CODES = frozenset({10000, 10002, 10016})
# "Too many visits" / "exceeded IP rate limit": failed fast, before any order,
# so the retry queue may re-run it.
RATE_LIMIT_CODES = frozenset({10006, 10018})
# Treated as a REJECTION, not a transient — no retry inside the fan-out window
# fixes either of these.
#   10027 trading is banned for this account · 110063 settlement in progress.
MAINTENANCE_CODES = frozenset({10027, 110063})
_TRANSIENT_HTTP = frozenset({408, 500, 502, 503, 504})

# Codes that mean "the request achieved nothing because it was already so".
# Reported as SUCCESS: the call did what it was asked to (the leverage is the
# value we wanted, the mode is the mode we wanted) and, being a signed write,
# it also proves the key may trade. Handled in _request_post rather than at the
# call sites so a later caller cannot forget it — the reference implementation
# logged a warning on 110043 before every single entry.
NOT_MODIFIED_CODES = frozenset({
    110043,  # "leverage not modified"
    110025,  # "position mode is not modified"
})


def to_symbol(ticker: str) -> Optional[str]:
    """``BTCUSDT`` -> ``BTCUSDT``. Identity, but GUARDED to USDT quotes.

    Binance's adapter can pass a ticker straight through because its host
    serves USDⓈ-M only. Bybit's ``category=linear`` spans USDT *and* USDC
    settlement (``BTCPERP`` is a real linear USDC symbol) and ``BTCUSD`` is a
    real INVERSE symbol — so an unguarded pass-through can route a signal onto
    a contract the ``settleCoin=USDT`` reads will never see, leaving a position
    this engine cannot even observe, let alone close.
    """
    sym = (ticker or "").strip().upper()
    if not sym:
        return None
    return sym if sym.endswith("USDT") and len(sym) > 4 else None


def classify_code(code: Optional[int], http_status: Optional[int]) -> dict:
    """The verdicts the failure dict carries, from Bybit's retCode + HTTP status."""
    return {
        "transient": http_status is None or http_status in _TRANSIENT_HTTP or code in TRANSIENT_CODES,
        "rate_limited": http_status == 429 or code in RATE_LIMIT_CODES,
        "credential": code in key_status.CREDENTIAL_CODES.get(EXCHANGE, {}),
        "maintenance": code in MAINTENANCE_CODES,
    }


def _sign(secret: str, payload: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def _query_string(params: Optional[Dict[str, Any]]) -> str:
    """Business params, None dropped, in INSERTION ORDER — not sorted.

    Bybit verifies the signature against the query string exactly as it appears
    in the URL, so this is built once and used for both. Sorting it (as the
    MEXC client must) would make every signed GET fail.
    """
    return "&".join(f"{k}={v}" for k, v in (params or {}).items() if v is not None)


def _int_code(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def num(value: Any) -> Optional[float]:
    """Bybit sends "" for fields that do not apply to the account's margin mode
    (positionIM/positionMM under cross, several wallet totals under portfolio
    margin). Those are UNKNOWN, not zero — a 0 would be published as a real
    figure, so they must come back None."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# --- Public data cache (module-level: shared by every account) -----------------
_INSTRUMENTS_LOCK = threading.Lock()
_INSTRUMENTS_CACHE: Dict[str, tuple[float, Dict[str, dict]]] = {}  # base_url -> (expires, {symbol: row})


def reset_caches() -> None:
    """Test hook."""
    with _INSTRUMENTS_LOCK:
        _INSTRUMENTS_CACHE.clear()


class BybitFuturesAPI:
    """Signed client for one account. base_url selects mainnet vs Demo Trading;
    the instruments cache below is keyed by it."""

    def __init__(
        self,
        api_key: str,
        secret_key: str,
        base_url: Optional[str] = None,
        timeout: float = API_TIMEOUT,
        recv_window_ms: int = BYBIT_RECV_WINDOW_MS,
    ):
        self.api_key = (api_key or "").strip()
        self.secret_key = (secret_key or "").strip()
        self.base_url = (base_url or BYBIT_API_BASE).rstrip("/")
        self.timeout = timeout
        # Held as a STRING because the header and the signed payload must be
        # byte-identical; re-formatting an int at each use is how they drift.
        self.recv_window = str(int(recv_window_ms or 5000))

    # --- signing / transport ------------------------------------------------

    def _headers(self, signed_payload: str) -> Dict[str, str]:
        ts = str(int(time.time() * 1000))
        return {
            "X-BAPI-API-KEY": self.api_key,
            "X-BAPI-TIMESTAMP": ts,
            "X-BAPI-SIGN": _sign(self.secret_key, ts + self.api_key + self.recv_window + signed_payload),
            "X-BAPI-RECV-WINDOW": self.recv_window,
            "Content-Type": "application/json",
        }

    def _judge_body(self, body: Any, account_scoped: bool, scope: str = key_status.TRADE) -> None:
        """Route a credential verdict to key_status when the body carries one.

        key_status.classify reads `code` + `msg`/`message`; Bybit says `retCode`
        + `retMsg`, so the envelope is translated here rather than teaching
        key_status a third vocabulary.
        """
        if not account_scoped or not isinstance(body, dict):
            return
        verdict = key_status.classify(
            {"code": _int_code(body.get("retCode")), "message": body.get("retMsg")},
            EXCHANGE,
        )
        if verdict is not None:
            code, reason, message = verdict
            key_status.report_blocked(self.api_key, code, reason, message, EXCHANGE, scope=scope)

    @staticmethod
    def _parse_body(text: str) -> Optional[dict]:
        if not text or not text.lstrip().startswith("{"):
            return None
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return None
        return data if isinstance(data, dict) else None

    def _log_regional_block(self, path: str, http_status: Optional[int], text: str) -> None:
        """A 403 with no JSON body is the edge refusing us, not the key.

        Bybit answers 403 to every request from a US or Mainland-China IP
        whatever the credentials. It is a hosting fault and it must never reach
        key_status, because disconnecting customers' keys would not fix it.
        """
        if http_status == 403 and self._parse_body(text) is None:
            log.error(
                "[Bybit] 403 with no JSON body on %s — regional block? check this box's egress IP "
                "(Bybit refuses US and Mainland-China addresses)", path,
            )

    def _request_get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        account_scoped: bool = True,
    ) -> Optional[Any]:
        """The envelope's ``result`` on success; ``None`` on ANY failure —
        transport, non-2xx, bad JSON, or ``retCode != 0``.
        ``account_scoped=False`` for public data (instruments-info): such a call
        succeeds with any key, so it must never clear a blocked flag."""
        qs = _query_string(params)
        url = f"{self.base_url}{path}" + (f"?{qs}" if qs else "")
        try:
            resp = get_session().get(url, headers=self._headers(qs), timeout=self.timeout)
            resp.raise_for_status()
        except requests.RequestException as exc:
            response = getattr(exc, "response", None)
            http_status = response.status_code if response is not None else None
            text = (response.text or "")[:500] if response is not None else ""
            self._log_regional_block(path, http_status, text)
            self._judge_body(self._parse_body(text), account_scoped, key_status.READ)
            log.error("[Bybit] GET %s: %s%s", path, exc, f" — {text}" if text else "")
            return None
        try:
            envelope = resp.json()
        except ValueError:
            log.error("[Bybit] GET %s: non-JSON response %.200s", path, resp.text)
            return None
        if not isinstance(envelope, dict) or _int_code(envelope.get("retCode")) != 0:
            self._judge_body(envelope, account_scoped, key_status.READ)
            log.error("[Bybit] GET %s refused: %.300s", path, envelope)
            return None
        if account_scoped:
            key_status.report_ok(self.api_key, EXCHANGE, scope=key_status.READ)
        result = envelope.get("result")
        return result if result is not None else {}

    def _request_post(
        self,
        path: str,
        body: Optional[Dict[str, Any]] = None,
        *,
        ok_codes: frozenset = frozenset(),
    ) -> dict:
        """The full envelope on success, else the engine's failure dict with
        Bybit's ``retCode`` stamped on it and the transient / rate_limited /
        maintenance verdicts set.

        ``ok_codes`` are business codes to treat as success (see
        NOT_MODIFIED_CODES)."""
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
            self._log_regional_block(path, http_status, text)
            self._judge_body(parsed, True)
            code = _int_code(parsed.get("retCode")) if parsed else None
            verdict = classify_code(code, http_status)
            if response is not None:
                log.error("[Bybit] POST %s: %s — %s", path, exc, text)
            else:
                # Timeout / connection error: execution status is UNKNOWN.
                log.error("[Bybit] POST %s: %s", path, exc)
            return failure(
                (parsed or {}).get("retMsg") or str(exc),
                code=code, response=text, http_status=http_status,
                rate_limited=verdict["rate_limited"], transient=verdict["transient"],
                maintenance=verdict["maintenance"],
            )
        try:
            envelope = resp.json()
        except ValueError:
            log.error("[Bybit] POST %s: non-JSON response %.200s", path, resp.text)
            return failure(
                "non-JSON response", response=(resp.text or "")[:500],
                http_status=resp.status_code, transient=True,
            )
        body_dict = envelope if isinstance(envelope, dict) else {}
        code = _int_code(body_dict.get("retCode"))
        if code == 0 or code in ok_codes:
            if code:
                log.info("[Bybit] POST %s: %s (%s) — already so, treated as success",
                         path, code, body_dict.get("retMsg"))
            key_status.report_ok(self.api_key, EXCHANGE, scope=key_status.TRADE)
            return envelope
        self._judge_body(body_dict, True)
        verdict = classify_code(code, resp.status_code)
        text = json.dumps(envelope)[:500] if envelope is not None else ""
        log.error("[Bybit] POST %s refused: %s", path, text)
        return failure(
            str(body_dict.get("retMsg") or "request refused"),
            code=code, response=text, http_status=resp.status_code,
            rate_limited=verdict["rate_limited"], transient=verdict["transient"],
            maintenance=verdict["maintenance"],
        )

    def _paged(
        self,
        path: str,
        params: Dict[str, Any],
        *,
        max_pages: int,
        account_scoped: bool = True,
    ) -> tuple[Optional[list], bool]:
        """Follow Bybit's `nextPageCursor` and return (rows, complete).

        ``(None, False)`` when the FIRST page fails — unknown, not empty, which
        is what lets a watermark hold instead of advancing past unread history.
        ``(rows, False)`` when a later page fails or the cap is hit: what we
        have is real, but there is more.
        """
        rows: list = []
        cursor: Optional[str] = None
        for page in range(max_pages):
            result = self._request_get(path, {**params, "cursor": cursor}, account_scoped)
            if not isinstance(result, dict):
                return (None, False) if page == 0 else (rows, False)
            batch = result.get("list")
            if isinstance(batch, list):
                rows.extend(batch)
            cursor = result.get("nextPageCursor") or None
            if not cursor:
                return rows, True
        log.warning("[Bybit] %s hit the %d-page cap — more history is waiting", path, max_pages)
        return rows, False

    # --- public market data ---------------------------------------------------

    def instruments(self) -> Optional[Dict[str, dict]]:
        """Every linear instrument's spec keyed by symbol, cached per base_url.
        A failed fetch is NOT cached, so the next order retries it."""
        now = time.time()
        cached = _INSTRUMENTS_CACHE.get(self.base_url)
        if cached and cached[0] > now:
            return cached[1]
        with _INSTRUMENTS_LOCK:
            cached = _INSTRUMENTS_CACHE.get(self.base_url)
            if cached and cached[0] > now:
                return cached[1]
            rows, _complete = self._paged(
                "/v5/market/instruments-info",
                {"category": CATEGORY, "limit": 1000},
                max_pages=3,
                account_scoped=False,
            )
            if not rows:
                log.warning("[Bybit] instruments-info returned no instruments (%s)", self.base_url)
                return None
            parsed = {
                str(r.get("symbol")).upper(): r
                for r in rows if isinstance(r, dict) and r.get("symbol")
            }
            _INSTRUMENTS_CACHE[self.base_url] = (now + BYBIT_INSTRUMENTS_CACHE_TTL, parsed)
            log.info("[Bybit] cached %d instrument specs (%s)", len(parsed), self.base_url)
            return parsed

    def instrument(self, symbol: str) -> Optional[dict]:
        specs = self.instruments()
        return specs.get(symbol.upper()) if specs else None

    def max_leverage(self, symbol: str) -> Optional[int]:
        spec = self.instrument(symbol)
        value = num((spec or {}).get("leverageFilter", {}).get("maxLeverage"))
        return int(value) if value and value > 0 else None

    def round_qty(self, symbol: str, coins: float, *, closing: bool = False) -> Optional[str]:
        """Coins -> the qty string Bybit accepts. None means "do not place this".

        Entries FLOOR to ``qtyStep`` (never round a size up — the account did
        not ask for more exposure, and a size rounded up can breach the stack
        cap by one step). Exits round HALF-EVEN.

        The exit asymmetry matters here for a different reason than on MEXC.
        MEXC's dust came from converting coins to contracts and back; Bybit
        needs no conversion, but the dust arrives anyway from the core's float
        vocabulary — ``0.3 - 0.1`` is 0.19999999999999998, which floored to a
        0.001 step is 0.199, leaving 0.001 open forever while the exit reports
        success (the poller keeps seeing the position, the stack cap keeps
        counting it). Half-even turns it back into 0.2.
        """
        spec = self.instrument(symbol)
        if not spec:
            return None
        if str(spec.get("status")) != "Trading":
            log.warning("[Bybit] %s is not trading (status=%s)", symbol, spec.get("status"))
            return None
        lot = spec.get("lotSizeFilter") or {}
        try:
            step = Decimal(str(lot.get("qtyStep") or 0))
            min_qty = Decimal(str(lot.get("minOrderQty") or 0))
            max_mkt = Decimal(str(lot.get("maxMktOrderQty") or 0))
            amount = Decimal(str(coins))
        except (InvalidOperation, TypeError, ValueError):
            return None
        if step <= 0 or amount <= 0:
            return None
        rounding = ROUND_HALF_EVEN if closing else ROUND_DOWN
        qty = (amount / step).quantize(Decimal(1), rounding=rounding) * step
        if qty <= 0 or qty < min_qty:
            return None
        if max_mkt > 0 and qty > max_mkt:
            log.warning("[Bybit] %s qty %s exceeds maxMktOrderQty %s", symbol, qty, max_mkt)
            return None
        return format(qty.normalize(), "f")

    # --- account reads --------------------------------------------------------

    def wallet_balance(self) -> Optional[dict]:
        """GET /v5/account/wallet-balance — the UNIFIED account's first list row.
        No `coin` filter: one call answers totals AND per-coin, and the adapter
        falls back from one to the other."""
        result = self._request_get(
            "/v5/account/wallet-balance", {"accountType": ACCOUNT_TYPE}
        )
        if not isinstance(result, dict):
            return None
        rows = result.get("list")
        return rows[0] if isinstance(rows, list) and rows and isinstance(rows[0], dict) else None

    def positions(self, symbol: Optional[str] = None) -> Optional[list]:
        """GET /v5/position/list. None on a failed read, [] when nothing is open.

        For `linear` Bybit REQUIRES `symbol` or `settleCoin` — a bare
        `category=linear` is refused. The account-wide read therefore always
        sends settleCoin, which is the bug the reference implementation shipped
        (and then folded into an empty list, the very conflation that deleted
        live positions from the DB on 2026-08-18).

        Zero-size rows are kept: a flat symbol still returns its legs, and
        their `positionIdx` is how the adapter learns the account's mode.
        """
        params: Dict[str, Any] = {"category": CATEGORY}
        if symbol:
            params["symbol"] = symbol.upper()
        else:
            params["settleCoin"] = SETTLE_COIN
            params["limit"] = 200
        rows, _complete = self._paged("/v5/position/list", params, max_pages=3)
        return rows

    def query_api(self) -> Optional[dict]:
        """GET /v5/user/query-api — the key's OWN permissions, readOnly flag,
        bound IPs and expiry. Bybit's answer to Binance's apiRestrictions; MEXC
        publishes no equivalent."""
        result = self._request_get("/v5/user/query-api")
        return result if isinstance(result, dict) else None

    def order(self, order_id: str, symbol: Optional[str] = None) -> Optional[dict]:
        """One order, live first then history. Used only to learn whether an
        order is DEAD, which is what stops the fill-summary retry loop."""
        for path in ("/v5/order/realtime", "/v5/order/history"):
            params: Dict[str, Any] = {"category": CATEGORY, "orderId": str(order_id)}
            if symbol:
                params["symbol"] = symbol.upper()
            result = self._request_get(path, params)
            if isinstance(result, dict):
                rows = result.get("list")
                if isinstance(rows, list) and rows and isinstance(rows[0], dict):
                    return rows[0]
        return None

    def executions(
        self,
        *,
        symbol: Optional[str] = None,
        order_id: Optional[str] = None,
        start_ms: Optional[int] = None,
        end_ms: Optional[int] = None,
        max_pages: int = 10,
    ) -> tuple[Optional[list], bool]:
        """GET /v5/execution/list — fills AND `execType=Funding` rows, which is
        why one paged read feeds both halves of the receipts ledger."""
        params: Dict[str, Any] = {"category": CATEGORY, "limit": 100}
        if symbol:
            params["symbol"] = symbol.upper()
        if order_id:
            params["orderId"] = str(order_id)
        if start_ms is not None:
            params["startTime"] = int(start_ms)
        if end_ms is not None:
            params["endTime"] = int(end_ms)
        return self._paged("/v5/execution/list", params, max_pages=max_pages)

    def closed_pnl(
        self,
        *,
        symbol: Optional[str] = None,
        start_ms: Optional[int] = None,
        end_ms: Optional[int] = None,
        max_pages: int = 5,
    ) -> tuple[Optional[list], bool]:
        """GET /v5/position/closed-pnl — a real closed-trade index, which is why
        the Bybit history poller is thinner than MEXC's (there, closes had to be
        assembled from history_orders plus per-symbol order_deals)."""
        params: Dict[str, Any] = {"category": CATEGORY, "limit": 100}
        if symbol:
            params["symbol"] = symbol.upper()
        if start_ms is not None:
            params["startTime"] = int(start_ms)
        if end_ms is not None:
            params["endTime"] = int(end_ms)
        return self._paged("/v5/position/closed-pnl", params, max_pages=max_pages)

    def transaction_log(
        self,
        *,
        kind: str,
        start_ms: Optional[int] = None,
        end_ms: Optional[int] = None,
        max_pages: int = 5,
    ) -> tuple[Optional[list], bool]:
        """GET /v5/account/transaction-log, filtered to ONE `type`.

        One call per type rather than one unfiltered read, because this ledger
        also carries every TRADE and SETTLEMENT row: an active account
        generates hundreds inside the transfers lookback window, so an
        unfiltered read would page through the whole trading history to find
        two transfers — or hit the page cap and miss them.
        """
        params: Dict[str, Any] = {
            "accountType": ACCOUNT_TYPE,
            "category": CATEGORY,
            "type": kind,
            "limit": 50,
        }
        if start_ms is not None:
            params["startTime"] = int(start_ms)
        if end_ms is not None:
            params["endTime"] = int(end_ms)
        return self._paged("/v5/account/transaction-log", params, max_pages=max_pages)

    # --- writes ---------------------------------------------------------------

    def switch_mode(self, mode: int) -> dict:
        """POST /v5/position/switch-mode for every USDT symbol at once
        (`coin=USDT`), rather than one call per symbol. 110025 "not modified"
        is a success."""
        return self._request_post(
            "/v5/position/switch-mode",
            {"category": CATEGORY, "coin": SETTLE_COIN, "mode": int(mode)},
            ok_codes=NOT_MODIFIED_CODES,
        )

    def set_leverage(self, symbol: str, leverage: int) -> dict:
        """POST /v5/position/set-leverage. buyLeverage and sellLeverage are sent
        EQUAL — required in one-way mode and in hedge+cross, and always legal.
        110043 "leverage not modified" is a success."""
        lev = str(max(1, int(leverage)))
        return self._request_post(
            "/v5/position/set-leverage",
            {"category": CATEGORY, "symbol": symbol.upper(),
             "buyLeverage": lev, "sellLeverage": lev},
            ok_codes=NOT_MODIFIED_CODES,
        )

    def create_order(
        self,
        symbol: str,
        side: str,
        qty: str,
        *,
        position_idx: int,
        reduce_only: bool = False,
    ) -> dict:
        """POST /v5/order/create, market only. `retCode == 0` means ACCEPTED —
        a market order can still be cancelled unfilled inside Bybit's slippage
        band, which the adapter's fill summary is what notices."""
        body: Dict[str, Any] = {
            "category": CATEGORY,
            "symbol": symbol.upper(),
            "side": side,
            "orderType": ORDER_TYPE_MARKET,
            "qty": str(qty),
            "positionIdx": int(position_idx),
        }
        if reduce_only:
            body["reduceOnly"] = True
        return self._request_post("/v5/order/create", body)
