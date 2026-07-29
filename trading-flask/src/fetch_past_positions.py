"""Authoritative past-position sync.

Periodically pulls REALIZED_PNL events from Binance `/fapi/v1/income` per
account and upserts them into `binance_pastpositions` via
trading-api `/api/flask/sync-past-positions`.

This is the safety net for the webhook insert path
(src/routes/webhook.py::_insert_past_position_api): if WAMP/trading-api was
down, or Binance hadn't indexed `userTrades` yet at close time, the syncer
fills the gap on the next cycle. Also captures liquidations and manual
closes made directly in the Binance app.
"""

import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import requests

from src.hooks import (
    API_BASE_URL,
    INCOME_LOOKBACK_HOURS,
    OUT_DIR,
    PAST_POSITIONS_FETCH_INTERVAL,
    PAST_POSITIONS_INDEXING_LAG_SECONDS,
    SYNC_PAST_POSITIONS_ENDPOINT,
    trading_api_headers,
)
from src.binance_api import BinanceAPI
from src.binance_accounts_api import fetch_binance_accounts

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

LAST_SYNC_FILE = Path(OUT_DIR) / "last_income_sync.json"


def _mask_api_key(key: str) -> str:
    if not key or len(key) < 12:
        return "***" if key else "-"
    return f"{key[:8]}...{key[-4:]}"


def _load_last_sync() -> Dict[str, int]:
    try:
        if LAST_SYNC_FILE.exists():
            with open(LAST_SYNC_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return {str(k): int(v) for k, v in data.items() if isinstance(v, (int, float))}
    except (OSError, ValueError, json.JSONDecodeError) as e:
        logger.warning("Could not read %s: %s", LAST_SYNC_FILE, e)
    return {}


def _save_last_sync(state: Dict[str, int]) -> None:
    try:
        LAST_SYNC_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = LAST_SYNC_FILE.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(state, f)
        tmp.replace(LAST_SYNC_FILE)
    except OSError as e:
        logger.warning("Could not write %s: %s", LAST_SYNC_FILE, e)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _fetch_all_realized_pnl(api: BinanceAPI, start_time_ms: int) -> List[Dict[str, Any]]:
    """Page through /fapi/v1/income until fewer than 1000 events come back."""
    all_events: List[Dict[str, Any]] = []
    cursor = start_time_ms
    safety = 0
    while True:
        safety += 1
        if safety > 50:
            logger.warning("income pagination safety limit hit at %d events", len(all_events))
            break
        events = api.get_income_history(income_type="REALIZED_PNL", start_time=cursor, limit=1000)
        if not events:
            break
        all_events.extend(events)
        if len(events) < 1000:
            break
        last_time = max((int(e.get("time") or 0) for e in events), default=cursor)
        if last_time <= cursor:
            break
        cursor = last_time + 1
    return all_events


def _income_symbols(events: List[Dict[str, Any]]) -> List[str]:
    """Distinct symbols that produced REALIZED_PNL in the window — the only place
    we need to scan userTrades. (We no longer trust the income `info` field as an
    order id; userTrades carry the authoritative orderId + realizedPnl + price.)"""
    syms = {(e.get("symbol") or "").upper() for e in events if e.get("symbol")}
    syms.discard("")
    return sorted(syms)


def _fetch_symbol_trades(api: BinanceAPI, symbol: str, start_ms: int) -> List[Dict[str, Any]]:
    """Page /fapi/v1/userTrades for `symbol` from `start_ms`, forward by trade id."""
    all_fills: List[Dict[str, Any]] = []
    from_id: Optional[int] = None
    safety = 0
    while True:
        safety += 1
        if safety > 50:
            logger.warning("userTrades pagination safety limit hit for %s at %d fills", symbol, len(all_fills))
            break
        if from_id is not None:
            batch = api.get_user_trades(symbol, from_id=from_id, limit=1000)
        else:
            batch = api.get_user_trades(symbol, start_time=start_ms, limit=1000)
        if not batch:
            break
        all_fills.extend(batch)
        if len(batch) < 1000:
            break
        try:
            max_id = max(int(f.get("id") or 0) for f in batch)
        except (TypeError, ValueError):
            break
        if max_id <= 0:
            break
        from_id = max_id + 1
    return all_fills


def _reconstruct_close(order_id: str, fills: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Build a close from all fills of one order. Returns None for opening-only
    orders (no realized PnL) or empty/zero-qty groups."""
    qty_sum = 0.0
    notional_sum = 0.0  # sum(price*qty) for weighted-avg exit price
    pnl_sum = 0.0
    has_realized = False
    side: Optional[str] = None
    position_side: Optional[str] = None
    closed_at_ms = 0
    for f in fills:
        try:
            qty = float(f.get("qty") or 0)
            price = float(f.get("price") or 0)
        except (TypeError, ValueError):
            continue
        try:
            rp = float(f.get("realizedPnl")) if f.get("realizedPnl") is not None else 0.0
        except (TypeError, ValueError):
            rp = 0.0
        if rp != 0.0:
            has_realized = True
        pnl_sum += rp
        qty_sum += qty
        notional_sum += price * qty
        side = side or f.get("side")
        position_side = position_side or f.get("positionSide")
        try:
            t = int(f.get("time") or 0)
        except (TypeError, ValueError):
            t = 0
        if t > closed_at_ms:
            closed_at_ms = t

    # Opening-only orders carry no realized PnL; they are not closes.
    if qty_sum <= 0 or not has_realized:
        return None

    exit_price = notional_sum / qty_sum
    # Infer position_side for one-way mode (positionSide=BOTH): SELL closes LONG.
    if not position_side or position_side == "BOTH":
        if side == "SELL":
            position_side = "LONG"
        elif side == "BUY":
            position_side = "SHORT"
        else:
            position_side = "BOTH"

    return {
        "order_id": str(order_id),
        "realized_pnl": round(pnl_sum, 8),
        "exit_price": round(exit_price, 8),
        "position_amt": round(qty_sum, 8),
        "side": side or "",
        "position_side": position_side,
        "closed_at_ms": closed_at_ms,
    }


def _reconstruct_closes(symbol: str, fills: List[Dict[str, Any]], cutoff_ms: int) -> List[Dict[str, Any]]:
    """Group a symbol's fills by orderId and emit one row per close. Closes newer
    than `cutoff_ms` are deferred (let userTrades finish indexing) so we never
    write the old BOTH/$0 placeholder rows."""
    by_order: Dict[str, List[Dict[str, Any]]] = {}
    for f in fills:
        oid = str(f.get("orderId") or "").strip()
        if not oid:
            continue
        by_order.setdefault(oid, []).append(f)

    rows: List[Dict[str, Any]] = []
    for oid, oid_fills in by_order.items():
        close = _reconstruct_close(oid, oid_fills)
        if close is None:
            continue
        if close["closed_at_ms"] > cutoff_ms:
            continue  # too recent — retry next cycle
        close["symbol"] = symbol
        rows.append(_build_row(close))
    return rows


def _build_row(close: Dict[str, Any]) -> Dict[str, Any]:
    closed_at = datetime.fromtimestamp(close["closed_at_ms"] / 1000.0, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    return {
        "symbol": close["symbol"],
        "position_side": close["position_side"],
        "position_amt": close["position_amt"],
        "entry_price": 0,  # not derivable from fills; server recovers strategy, entry stays 0
        "exit_price": close["exit_price"],
        "realized_pnl": close["realized_pnl"],
        "side": close["side"],
        "order_id": close["order_id"],
        "closed_at": closed_at,
    }


def _post_batch(accounts_payload: List[Dict[str, Any]]) -> bool:
    if not API_BASE_URL:
        logger.warning("API_BASE_URL not set - cannot post past positions")
        return False
    if not accounts_payload:
        return True
    try:
        base = API_BASE_URL.rstrip("/")
        path = SYNC_PAST_POSITIONS_ENDPOINT if SYNC_PAST_POSITIONS_ENDPOINT.startswith("/") else "/" + SYNC_PAST_POSITIONS_ENDPOINT
        url = base + path
        resp = requests.post(url, json={"accounts": accounts_payload}, headers=trading_api_headers(), timeout=30)
        if resp.ok:
            data = resp.json() if resp.content else {}
            logger.info(
                "sync-past-positions OK: inserted=%s updated=%s skipped=%s",
                data.get("inserted"), data.get("updated"), data.get("skipped"),
            )
            return True
        logger.warning("sync-past-positions failed: %s %s", resp.status_code, resp.text[:300])
        return False
    except Exception as e:
        logger.warning("Could not POST past positions: %s", e)
        return False


def fetch_and_sync() -> None:
    accounts = fetch_binance_accounts()
    if not accounts:
        logger.warning("No Binance accounts (check trading-api or .env)")
        return

    last_sync = _load_last_sync()
    now = _now_ms()
    lookback_ms = INCOME_LOOKBACK_HOURS * 3600 * 1000
    # Closes newer than this are deferred so Binance userTrades can index first.
    cutoff = now - PAST_POSITIONS_INDEXING_LAG_SECONDS * 1000

    accounts_payload: List[Dict[str, Any]] = []
    new_last_sync = dict(last_sync)

    for a in accounts:
        api_key = (a.get("api_key") or "").strip()
        secret_key = (a.get("secret_key") or "").strip()
        name = a.get("name") or "?"
        uni_id = a.get("uni_id") or ""
        if not api_key or not secret_key:
            continue

        masked = _mask_api_key(api_key)
        start_ms = last_sync.get(api_key, now - lookback_ms)

        try:
            api = BinanceAPI(api_key, secret_key)
            events = _fetch_all_realized_pnl(api, start_ms)
        except Exception as e:
            logger.warning("[%s] API key: %s — income fetch failed: %s", name, masked, e)
            continue

        if not events:
            logger.info("[%s] API key: %s — no REALIZED_PNL since %d", name, masked, start_ms)
            new_last_sync[api_key] = min(now, cutoff)
            continue

        # Reconstruct closes from userTrades (authoritative orderId + realizedPnl
        # + price), scanning only the symbols income flagged. No dependency on the
        # unreliable income `info` field.
        symbols = _income_symbols(events)
        rows: List[Dict[str, Any]] = []
        for symbol in symbols:
            try:
                fills = _fetch_symbol_trades(api, symbol, start_ms)
                rows.extend(_reconstruct_closes(symbol, fills, cutoff))
            except Exception as e:
                logger.warning("[%s] userTrades %s failed: %s", name, symbol, e)

        logger.info("[%s] API key: %s — %d events, %d symbols, %d close rows",
                    name, masked, len(events), len(symbols), len(rows))

        if rows:
            accounts_payload.append({"api_key": api_key, "uni_id": uni_id, "rows": rows})

        # Advance the watermark only up to the indexing cutoff so closes newer than
        # the cutoff are reprocessed next cycle. Upserts are idempotent on orderId,
        # so the small re-scan overlap is harmless.
        max_event_time = max((int(e.get("time") or 0) for e in events), default=now)
        new_last_sync[api_key] = max(start_ms, min(max_event_time + 1, cutoff))

    ok = _post_batch(accounts_payload)
    if ok:
        _save_last_sync(new_last_sync)
    # If POST failed we keep the previous last_sync_ms so next cycle retries.


if __name__ == "__main__":
    while True:
        try:
            fetch_and_sync()
        except Exception as e:
            logger.exception("fetch_and_sync crashed: %s", e)
        time.sleep(PAST_POSITIONS_FETCH_INTERVAL)
