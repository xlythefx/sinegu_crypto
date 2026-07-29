"""MEXC Futures webhook route: POST /mexc_webhook for TradingView alerts."""

import json
import logging
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

import requests
from flask import Blueprint, request, jsonify

from mexc_src.hooks import (
    API_BASE_URL,
    DEFAULT_LEVERAGE,
    DEFAULT_OPEN_TYPE,
    INSERT_PAST_POSITION_ENDPOINT,
    INSERT_POSITIONS_ENDPOINT,
    LIVE_QUANTITY,
    OUT_DIR,
    trading_api_headers,
    WEBHOOK_SECRET,
)
from mexc_src.trading_handler import (
    handle_add,
    handle_exit_long,
    handle_exit_short,
    handle_sell,
    has_open_position,
)
from mexc_src.assets_api import get_enabled_assets, _to_mexc_symbol, contract_symbol_to_tv_ticker
from mexc_src.mexc_api import MexcFuturesAPI
from mexc_src.mexc_accounts_api import fetch_mexc_accounts
from mexc_src.position_enrich import enrich_open_position_unrealized

logger = logging.getLogger(__name__)


def _flush_logs():
    try:
        sys.stdout.flush()
        sys.stderr.flush()
        for h in logging.root.handlers:
            if getattr(h, "stream", None) in (sys.stdout, sys.stderr):
                try:
                    h.flush()
                except Exception:
                    pass
    except Exception:
        pass


def _get_trade_accounts():
    accounts = fetch_mexc_accounts()
    if accounts and len(accounts) > 0:
        return [
            (a.get("api_key"), a.get("secret_key"), a.get("name") or "?", a.get("uni_id") or "")
            for a in accounts
        ]
    return []


def _place_order_id_from_response(res: Optional[Dict[str, Any]]) -> Optional[str]:
    """Extract exchange order id from POST /order/create response."""
    if not isinstance(res, dict):
        return None
    d = res.get("data")
    if isinstance(d, dict):
        oid = d.get("orderId") if d.get("orderId") is not None else d.get("order_id")
        if oid is not None and str(oid).strip() != "":
            return str(oid).strip()
    if isinstance(d, str) and d.strip():
        return d.strip()
    return None


def _insert_past_position_api(
    api_key,
    secret_key,
    uni_id,
    contract_symbol: str,
    position_side: str,
    pos: dict,
    price=None,
    strategy=None,
    *,
    closed_vol: Optional[float] = None,
    place_response: Optional[dict] = None,
):
    """POST closed MEXC position to trading-api mexc-past-position.

    ``symbol`` in DB is TradingView-style (e.g. BTCUSDT). Exit price / PnL prefer the
    closing order (``get_order``) when ``place_response`` contains an order id.
    """
    try:
        entry_price = float(pos.get("openAvgPrice") or pos.get("holdAvgPrice") or 0)
        try:
            position_amt = float(closed_vol) if closed_vol is not None else float(pos.get("holdVol") or 0)
        except (TypeError, ValueError):
            position_amt = 0.0

        close_oid = _place_order_id_from_response(place_response)
        order_id = close_oid or str(pos.get("positionId") or "")

        exit_price: Optional[float] = float(price) if price is not None else None
        realized_pnl: Optional[float] = None
        api_client: Optional[MexcFuturesAPI] = None

        if secret_key and close_oid:
            api_client = MexcFuturesAPI(api_key, secret_key)
            od = api_client.get_order(close_oid)
            if isinstance(od, dict) and od.get("success"):
                row = od.get("data") if isinstance(od.get("data"), dict) else {}
                if row:
                    try:
                        dap = float(row.get("dealAvgPrice") or 0)
                        if dap and (exit_price is None or exit_price == 0):
                            exit_price = dap
                    except (TypeError, ValueError):
                        pass
                    if row.get("profit") is not None:
                        try:
                            realized_pnl = float(row.get("profit") or 0)
                        except (TypeError, ValueError):
                            pass

        if realized_pnl is None:
            try:
                realized_pnl = float(pos.get("realised") or pos.get("realized") or 0)
            except (TypeError, ValueError):
                realized_pnl = 0.0

        if (exit_price is None or exit_price == 0) and secret_key:
            try:
                ac = api_client or MexcFuturesAPI(api_key, secret_key)
                fp = ac.get_fair_price(contract_symbol)
                if fp:
                    exit_price = float(fp)
            except Exception:
                pass
        if exit_price is None:
            exit_price = 0.0

        display_symbol = contract_symbol_to_tv_ticker(contract_symbol)
        side = "BUY" if position_side == "LONG" else "SELL"
        closed_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        payload = {
            "api_key": api_key,
            "uni_id": uni_id,
            "symbol": display_symbol,
            "position_side": position_side,
            "position_amt": position_amt,
            "entry_price": entry_price,
            "exit_price": float(exit_price),
            "realized_pnl": float(realized_pnl),
            "side": side,
            "order_id": order_id,
            "closed_at": closed_at,
            "strategy": (strategy.strip() if isinstance(strategy, str) else strategy) or "",
        }
        if not API_BASE_URL:
            logger.warning("API_BASE_URL not set — cannot insert past position")
            return
        base = API_BASE_URL.rstrip("/")
        path = INSERT_PAST_POSITION_ENDPOINT if INSERT_PAST_POSITION_ENDPOINT.startswith("/") else "/" + INSERT_PAST_POSITION_ENDPOINT
        resp = requests.post(base + path, json=payload, headers=trading_api_headers(), timeout=10)
        if resp.ok:
            logger.info("Inserted past position [%s] %s %s", display_symbol, position_side, order_id)
        else:
            logger.warning("insert_past_position failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("Could not insert past position: %s", e)


def _insert_mexc_position_api(api_key, secret_key, uni_id, symbol, position_type):
    """Fetch open position from MEXC after order and POST snapshot to mexc_positions."""
    try:
        from mexc_src.mexc_api import MexcFuturesAPI
        api = MexcFuturesAPI(api_key, secret_key)
        pos = api.get_position_for(symbol, position_type=position_type)
        if not pos:
            logger.warning("Could not fetch position for %s (type=%s) after open", symbol, position_type)
            return
        pos = enrich_open_position_unrealized(api, pos)
        if not API_BASE_URL:
            return
        base = API_BASE_URL.rstrip("/")
        path = INSERT_POSITIONS_ENDPOINT if INSERT_POSITIONS_ENDPOINT.startswith("/") else "/" + INSERT_POSITIONS_ENDPOINT
        payload = {"accounts": [{"api_key": api_key, "uni_id": uni_id, "positions": [pos]}]}
        resp = requests.post(base + path, json=payload, headers=trading_api_headers(), timeout=10)
        if resp.ok:
            logger.info("Inserted mexc_position [%s] type=%s", symbol, position_type)
        else:
            logger.warning("insert_mexc_position failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("Could not insert mexc position: %s", e)


bp = Blueprint("webhook", __name__)

TRADES_LOG = os.path.join(OUT_DIR, "webhook_trades.log")
TRADES_JSON = os.path.join(OUT_DIR, "mexc_trades.json")

# Max accounts to execute concurrently (fair fills); serialise JSONL appends.
ACCOUNT_FANOUT_CAP = 8
_TRADE_JSON_LOCK = threading.Lock()


def _run_accounts_parallel(thunks: List[Callable[[], object]], cap: int = ACCOUNT_FANOUT_CAP) -> List[object]:
    """Run one thunk per account concurrently so every account hits the market at
    nearly the same instant (fair entry/exit price). Each thunk handles a single
    account end-to-end; exceptions are isolated per account (logged, recorded as
    None). Results are returned in the same order as `thunks`."""
    if not thunks:
        return []
    workers = max(1, min(len(thunks), cap))
    results: List[object] = [None] * len(thunks)
    if workers == 1:
        for i, t in enumerate(thunks):
            try:
                results[i] = t()
            except Exception as e:
                logger.exception("account task %d failed: %s", i, e)
        return results
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="acct") as ex:
        fut_to_idx = {ex.submit(t): i for i, t in enumerate(thunks)}
        for fut in as_completed(fut_to_idx):
            i = fut_to_idx[fut]
            try:
                results[i] = fut.result()
            except Exception as e:
                logger.exception("account task %d failed: %s", i, e)
    return results


def _ensure_trades_log():
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.exists(TRADES_LOG):
        with open(TRADES_LOG, "a", encoding="utf-8") as f:
            f.write("# webhook_trades.log — one JSON line per webhook\n")


def _save_success_trade_json(action: str, ticker: str, account: str, mexc_result: dict, price=None):
    if not mexc_result or not isinstance(mexc_result, dict):
        return
    try:
        os.makedirs(OUT_DIR, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        record = {
            "time_utc": ts,
            "action": action,
            "ticker": ticker,
            "account": account,
            "price": price,
            "mexc_order": mexc_result,
        }
        with _TRADE_JSON_LOCK:
            with open(TRADES_JSON, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, default=str) + "\n")
        logger.info("Saved MEXC order to %s", TRADES_JSON)
    except Exception as e:
        logger.warning("Could not save trade JSON: %s", e)


def _insert_trade_log(action: str, ticker: str, success: bool, details: dict, price=None):
    try:
        os.makedirs(OUT_DIR, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        line = {
            "time_utc": ts,
            "action": action,
            "ticker": ticker,
            "success": success,
            "price": price,
            **{k: v for k, v in (details or {}).items() if k not in ("result",)},
        }
        with _TRADE_JSON_LOCK:
            with open(TRADES_LOG, "a", encoding="utf-8") as f:
                f.write(json.dumps(line) + "\n")
    except Exception as e:
        logger.warning("Could not write trade log: %s", e)


def _parse_int(value, default=None):
    if value is None or value == "":
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _parse_float(value, default=None):
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _run_mexc_webhook_job(payload: Dict[str, Any], ticker_in: str) -> Dict[str, Any]:
    """Synchronous trade path (MEXC + trading-api). Fans out across accounts in
    parallel and returns a summary dict so the route reports the real result
    instead of a fire-and-forget ack. An optional ``_status`` key carries a
    non-200 HTTP code for the caller."""
    try:
        _safe_payload = {k: ("***" if k == "secret" else v) for k, v in payload.items()}
        logger.info("WEBHOOK JOB START %s", json.dumps(_safe_payload, default=str)[:2000])
        _flush_logs()

        action = str(payload.get("action", "")).strip().upper()
        mexc_symbol = _to_mexc_symbol(ticker_in)
        usdt_amount = _parse_float(payload.get("quantity"))
        leverage = _parse_int(payload.get("leverage"), default=DEFAULT_LEVERAGE)
        open_type = _parse_int(payload.get("openType") or payload.get("open_type"), default=DEFAULT_OPEN_TYPE)
        price_value = _parse_float(payload.get("price", payload.get("close")))

        strategy_raw = payload.get("strategy")
        strategy_name = (
            str(strategy_raw).strip()
            if strategy_raw is not None and str(strategy_raw).strip() != ""
            else None
        )

        enabled_assets = get_enabled_assets()
        if enabled_assets is not None:
            asset = None
            for a in enabled_assets:
                if (a.get("ticker") or "").upper() == ticker_in or (a.get("mexc_symbol") or "").upper() == ticker_in:
                    asset = a
                    break
            if asset:
                mexc_symbol = asset.get("mexc_symbol", mexc_symbol)
                if usdt_amount is None or usdt_amount <= 0:
                    usdt_amount = float(asset.get("base_size", LIVE_QUANTITY))
        if usdt_amount is None or usdt_amount <= 0:
            usdt_amount = LIVE_QUANTITY

        trade_accounts = _get_trade_accounts()
        if not trade_accounts:
            logger.error("TRADE FAILED: No MEXC accounts (check trading-api)")
            return {
                "action": action,
                "ticker": ticker_in,
                "contract": mexc_symbol,
                "success": False,
                "error": "No MEXC accounts configured",
                "_status": 500,
            }

        logger.info(
            "Executing %s for %s (contract=%s, usdt=%s, lev=%s, openType=%s) on %d accounts",
            action,
            ticker_in,
            mexc_symbol,
            usdt_amount,
            leverage,
            open_type,
            len(trade_accounts),
        )
        _flush_logs()

        def _process_account(acct):
            """Execute the action for one MEXC account; returns {account, result, ok}
            or None when skipped before any order. Runs in a worker thread and only
            reads request-scoped vars (all read-only here)."""
            api_key, secret_key, name, uni_id = acct
            if not api_key or not secret_key:
                logger.warning("[%s] Skipping: missing api_key or secret_key", name)
                return None
            common = dict(
                api_key=api_key,
                secret_key=secret_key,
                ticker=mexc_symbol,
                price=price_value,
                open_type=open_type,
            )
            if action in ("BUY", "SELL"):
                has_pos = has_open_position(api_key, secret_key, mexc_symbol)
                if has_pos is True:
                    logger.info("[%s] SKIP %s %s — position already exists", name, action, mexc_symbol)
                    return {
                        "account": name,
                        "result": {"skipped": "position_exists", "symbol": mexc_symbol},
                        "ok": False,
                    }
                if has_pos is None:
                    logger.warning(
                        "[%s] position check unavailable for %s — proceeding (fail-open)",
                        name, mexc_symbol,
                    )
            if action == "BUY":
                result = handle_add(usdt_amount=usdt_amount, leverage=leverage, **common)
            elif action == "SELL":
                result = handle_sell(usdt_amount=usdt_amount, leverage=leverage, **common)
            elif action == "EXIT_LONG":
                result = handle_exit_long(**common)
            elif action == "EXIT_SHORT":
                result = handle_exit_short(**common)
            else:
                result = None

            mexc_res = result.get("result") if isinstance(result, dict) else result
            ok = (
                result is not None
                and result.get("status") not in (
                    "no long position to close",
                    "no short position to close",
                )
                and isinstance(mexc_res, dict)
                and mexc_res.get("success") is True
            )
            if ok:
                logger.info("TRADE OK [%s]: %s %s", name, action, ticker_in)
                _save_success_trade_json(action, ticker_in, name, mexc_res, price_value)
                if action == "EXIT_LONG":
                    _insert_past_position_api(
                        api_key, secret_key, uni_id, mexc_symbol, "LONG",
                        result.get("position") or {}, price_value, strategy_name,
                        closed_vol=result.get("closed_vol"), place_response=mexc_res,
                    )
                elif action == "EXIT_SHORT":
                    _insert_past_position_api(
                        api_key, secret_key, uni_id, mexc_symbol, "SHORT",
                        result.get("position") or {}, price_value, strategy_name,
                        closed_vol=result.get("closed_vol"), place_response=mexc_res,
                    )
                elif action == "BUY":
                    _insert_mexc_position_api(api_key, secret_key, uni_id, mexc_symbol, position_type=1)
                elif action == "SELL":
                    _insert_mexc_position_api(api_key, secret_key, uni_id, mexc_symbol, position_type=2)
            else:
                if result:
                    st = result.get("status", "no result")
                    err = result.get("error")
                    if err:
                        logger.warning("TRADE [%s]: %s — %s", name, st, err)
                    else:
                        logger.warning("TRADE [%s]: %s", name, st)
                else:
                    logger.warning("TRADE FAILED [%s]: MEXC returned no result", name)
            return {"account": name, "result": result, "ok": bool(ok)}

        # Fan out across accounts so every account fills near-simultaneously.
        account_results = _run_accounts_parallel(
            [(lambda a=acct: _process_account(a)) for acct in trade_accounts],
            cap=ACCOUNT_FANOUT_CAP,
        )
        results_by_account = [
            {"account": r["account"], "result": r["result"]}
            for r in account_results if r is not None
        ]
        success = any(bool(r.get("ok")) for r in account_results if r is not None)

        _insert_trade_log(action, ticker_in, success, {"accounts": results_by_account}, price_value)

        logger.info("WEBHOOK JOB DONE: action=%s ticker=%s success=%s", action, ticker_in, success)
        _flush_logs()

        summary = {
            "action": action,
            "ticker": ticker_in,
            "contract": mexc_symbol,
            "success": success,
            "accounts": len(trade_accounts),
            "details": results_by_account,
        }
        if price_value is not None:
            summary["price"] = price_value
        if strategy_name:
            summary["strategy"] = strategy_name
        return summary
    except Exception as e:
        logger.exception("WEBHOOK JOB crashed")
        return {
            "action": str(payload.get("action", "")).strip().upper(),
            "ticker": ticker_in,
            "success": False,
            "error": str(e),
            "_status": 500,
        }


@bp.route("/mexc_webhook", methods=["POST"])
def mexc_webhook():
    """TradingView webhook: validate, then execute synchronously (parallel fan-out)
    and return the real per-account result."""
    try:
        logger.info("WEBHOOK received")
        _flush_logs()

        data = request.get_json(silent=True) or {}
        if not data and request.data:
            try:
                data = json.loads(request.data.decode("utf-8", errors="replace"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
        if not isinstance(data, dict):
            data = {}

        if not data.get("secret"):
            data["secret"] = request.args.get("secret") or request.form.get("secret")

        secret = data.get("secret")
        _safe = {k: ("***" if k == "secret" else v) for k, v in data.items()}
        logger.info("WEBHOOK payload: %s", json.dumps(_safe, indent=2))
        if secret != WEBHOOK_SECRET:
            logger.warning("TRADE FAILED: Invalid secret")
            return jsonify({"error": "Unauthorized"}), 403

        action = str(data.get("action", "")).strip().upper()
        ticker_raw = str(data.get("symbol") or data.get("ticker") or "").strip()
        if ticker_raw.upper().startswith("MEXC:"):
            ticker_in = ticker_raw[5:].upper()
        else:
            ticker_in = ticker_raw.upper() if ticker_raw else ""

        if not action or not ticker_in:
            logger.warning("TRADE FAILED: Missing action or ticker")
            return jsonify({"error": "Missing action or ticker"}), 400

        if action not in ("BUY", "SELL", "EXIT_LONG", "EXIT_SHORT"):
            logger.warning("TRADE FAILED: Unknown action=%s", action)
            return jsonify({"error": f"Unknown action: {action}. Use BUY, SELL, EXIT_LONG, EXIT_SHORT"}), 400

        summary = _run_mexc_webhook_job(dict(data), ticker_in)
        status = int(summary.pop("_status", 200))
        return jsonify(summary), status

    except Exception as e:
        logger.exception("TRADE FAILED: %s", e)
        return jsonify({"error": str(e)}), 500
