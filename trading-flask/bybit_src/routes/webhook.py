"""Bybit webhook route: POST /bybit_webhook for TradingView alerts."""

import json
import logging
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Callable, List, Optional

from flask import Blueprint, request, jsonify

import requests as _requests

from bybit_src.hooks import (
    API_BASE_URL,
    INSERT_PAST_POSITION_ENDPOINT,
    LIVE_QUANTITY,
    OUT_DIR,
    trading_api_headers,
    WEBHOOK_SECRET,
)
from bybit_src.trading_handler import (
    handle_add,
    handle_exit_long,
    handle_exit_short,
    handle_sell,
    has_open_position,
)
from bybit_src.assets_api import get_enabled_assets, _to_bybit_symbol
from bybit_src.bybit_accounts_api import fetch_bybit_accounts

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
    accounts = fetch_bybit_accounts()
    if accounts and len(accounts) > 0:
        return [
            (a.get("api_key"), a.get("secret_key"), a.get("name") or "?", a.get("uni_id") or "")
            for a in accounts
        ]
    return []


def _parse_leverage(data: dict) -> Optional[int]:
    raw = data.get("leverage")
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        v = int(float(s))
    except (TypeError, ValueError):
        return None
    return max(1, min(v, 200))


bp = Blueprint("webhook", __name__)

TRADES_LOG = os.path.join(OUT_DIR, "webhook_trades.log")
TRADES_JSON = os.path.join(OUT_DIR, "bybit_trades.json")

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


def _save_success_trade_json(action: str, ticker: str, account: str, bybit_result: dict, price=None):
    if not bybit_result or not isinstance(bybit_result, dict):
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
            "bybit_order": bybit_result,
        }
        with _TRADE_JSON_LOCK:
            with open(TRADES_JSON, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, default=str) + "\n")
        logger.info("Saved Bybit order to %s", TRADES_JSON)
    except Exception as e:
        logger.warning("Could not save trade JSON: %s", e)


def _insert_past_position_api(
    api_key: str,
    uni_id: str,
    bybit_result: dict,
    symbol: str,
    position_side: str,
    price=None,
    strategy=None,
):
    try:
        order_id = (bybit_result.get("result") or {}).get("orderId") or bybit_result.get("order_id")
        closed_qty = bybit_result.get("closed_quantity", 0)
        closed_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        exit_price = float(price) if price is not None else None
        payload = {
            "api_key": api_key,
            "uni_id": uni_id,
            "symbol": symbol,
            "position_side": position_side,
            "position_amt": closed_qty,
            "exit_price": exit_price,
            "order_id": order_id,
            "closed_at": closed_at,
        }
        if strategy:
            payload["strategy"] = strategy
        if not API_BASE_URL:
            return
        base = API_BASE_URL.rstrip("/")
        path = INSERT_PAST_POSITION_ENDPOINT if INSERT_PAST_POSITION_ENDPOINT.startswith("/") else "/" + INSERT_PAST_POSITION_ENDPOINT
        url = base + path
        resp = _requests.post(url, json=payload, headers=trading_api_headers(), timeout=10)
        if resp.ok:
            logger.info("Inserted past position [%s] %s %s", symbol, position_side, order_id)
        else:
            logger.warning("insert_past_position failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("Could not insert past position: %s", e)


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
        with open(TRADES_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(line) + "\n")
    except Exception as e:
        logger.warning("Could not write trade log: %s", e)


@bp.route("/bybit_webhook", methods=["POST"])
def bybit_webhook():
    """TradingView webhook: secret, action, symbol; optional quantity, price, strategy, leverage."""
    try:
        logger.info("=" * 50 + " WEBHOOK RECEIVED " + "=" * 50)
        _flush_logs()
        ct = request.content_type or ""
        cl = getattr(request, "content_length", None)
        logger.info("WEBHOOK body: Content-Type=%s Content-Length=%s", ct, cl)

        data = request.get_json(silent=True) or {}
        if not data and request.data:
            try:
                data = json.loads(request.data.decode("utf-8", errors="replace"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
        if not isinstance(data, dict):
            data = {}

        secret = data.get("secret") or request.args.get("secret") or request.form.get("secret")
        _safe = {k: ("***" if k == "secret" else v) for k, v in data.items()}
        logger.info("WEBHOOK payload: %s", json.dumps(_safe, indent=2))
        _flush_logs()

        if secret != WEBHOOK_SECRET:
            logger.warning("TRADE FAILED: Invalid secret")
            return jsonify({"error": "Unauthorized"}), 403

        action = str(data.get("action", "")).strip().upper()
        ticker_raw = str(data.get("symbol") or data.get("ticker") or "").strip()
        if ticker_raw.upper().startswith("BYBIT:"):
            ticker = ticker_raw[6:].upper()
        else:
            ticker = ticker_raw.upper() if ticker_raw else ""
        price_raw = data.get("price", data.get("close"))

        if not action or not ticker:
            logger.warning("TRADE FAILED: Missing action or ticker")
            return jsonify({"error": "Missing action or ticker"}), 400

        if action not in ("BUY", "SELL", "EXIT_LONG", "EXIT_SHORT"):
            logger.warning("TRADE FAILED: Unknown action=%s", action)
            return jsonify({"error": f"Unknown action: {action}. Use BUY, SELL, EXIT_LONG, EXIT_SHORT"}), 400

        # Resolve Bybit symbol and sizing from trading-api assets
        bybit_symbol = _to_bybit_symbol(ticker)
        quantity = float(data.get("quantity", 0)) if data.get("quantity") is not None else None
        leverage_value = _parse_leverage(data)

        enabled_assets = get_enabled_assets()
        if enabled_assets is not None:
            asset = None
            for a in enabled_assets:
                if (a.get("ticker") or "").upper() == ticker or (a.get("bybit_symbol") or "").upper() == ticker:
                    asset = a
                    break
            if asset:
                bybit_symbol = asset.get("bybit_symbol", bybit_symbol)
                if quantity is None or quantity <= 0:
                    quantity = float(asset.get("base_size", LIVE_QUANTITY))
        if quantity is None or quantity <= 0:
            quantity = LIVE_QUANTITY

        price_value = None
        if price_raw is not None:
            try:
                price_value = float(price_raw)
            except (ValueError, TypeError):
                pass

        strategy_raw = data.get("strategy")
        strategy_name = (
            str(strategy_raw).strip()
            if strategy_raw is not None and str(strategy_raw).strip() != ""
            else None
        )

        trade_accounts = _get_trade_accounts()
        if not trade_accounts:
            logger.error("TRADE FAILED: No Bybit accounts (check trading-api)")
            return jsonify({"error": "No Bybit accounts configured"}), 500

        logger.info(
            "Executing %s for %s (bybit=%s, qty=%s, leverage=%s) on %d accounts",
            action,
            ticker,
            bybit_symbol,
            quantity,
            f"{leverage_value}x" if leverage_value is not None else "default",
            len(trade_accounts),
        )
        _flush_logs()

        def _process_account(acct):
            """Execute the action for one Bybit account; returns {account, result, ok}
            or None when skipped before any order. Runs in a worker thread and only
            reads request-scoped vars (all read-only here)."""
            api_key, secret_key, name, uni_id = acct
            if not api_key or not secret_key:
                logger.warning("[%s] Skipping: missing api_key or secret_key", name)
                return None
            if action in ("BUY", "SELL"):
                has_pos = has_open_position(api_key, secret_key, bybit_symbol)
                if has_pos is True:
                    logger.info("[%s] SKIP %s %s — position already exists", name, action, bybit_symbol)
                    return {
                        "account": name,
                        "result": {"skipped": "position_exists", "symbol": bybit_symbol},
                        "ok": False,
                    }
                if has_pos is None:
                    logger.warning(
                        "[%s] position check unavailable for %s — proceeding (fail-open)",
                        name, bybit_symbol,
                    )
            if action == "BUY":
                result = handle_add(
                    api_key=api_key,
                    secret_key=secret_key,
                    ticker=bybit_symbol,
                    price=price_value,
                    quantity=quantity,
                    leverage=leverage_value,
                )
            elif action == "SELL":
                result = handle_sell(
                    api_key=api_key,
                    secret_key=secret_key,
                    ticker=bybit_symbol,
                    price=price_value,
                    quantity=quantity,
                    leverage=leverage_value,
                )
            elif action == "EXIT_LONG":
                result = handle_exit_long(
                    api_key=api_key,
                    secret_key=secret_key,
                    ticker=bybit_symbol,
                    price=price_value,
                )
            elif action == "EXIT_SHORT":
                result = handle_exit_short(
                    api_key=api_key,
                    secret_key=secret_key,
                    ticker=bybit_symbol,
                    price=price_value,
                )
            else:
                result = None

            bybit_res = result.get("result") if isinstance(result, dict) else result
            ok = (
                result is not None
                and result.get("status") not in ("no long position to close", "no short position to close")
                and isinstance(bybit_res, dict)
                and bybit_res.get("retCode") == 0
            )
            if ok:
                logger.info("TRADE OK [%s]: %s %s", name, action, ticker)
                _save_success_trade_json(action, ticker, name, result, price_value)
                if action == "EXIT_LONG":
                    _insert_past_position_api(api_key, uni_id, result, bybit_symbol, "LONG", price_value, strategy_name)
                elif action == "EXIT_SHORT":
                    _insert_past_position_api(api_key, uni_id, result, bybit_symbol, "SHORT", price_value, strategy_name)
            else:
                if result:
                    st = result.get("status", "no result")
                    err = result.get("error")
                    if err:
                        logger.warning("TRADE [%s]: %s — %s", name, st, err)
                    else:
                        logger.warning("TRADE [%s]: %s", name, st)
                else:
                    logger.warning("TRADE FAILED [%s]: Bybit returned no result", name)
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

        _insert_trade_log(action, ticker, success, {"accounts": results_by_account}, price_value)

        logger.info("WEBHOOK DONE: action=%s ticker=%s success=%s", action, ticker, success)
        _flush_logs()

        summary = {
            "action": action,
            "ticker": ticker,
            "success": success,
            "accounts": len(trade_accounts),
            "details": results_by_account,
        }
        if price_value is not None:
            summary["price"] = price_value
        if strategy_name:
            summary["strategy"] = strategy_name
        if leverage_value is not None:
            summary["leverage"] = leverage_value
        return jsonify(summary), 200

    except Exception as e:
        logger.exception("TRADE FAILED: %s", e)
        return jsonify({"error": str(e)}), 500
