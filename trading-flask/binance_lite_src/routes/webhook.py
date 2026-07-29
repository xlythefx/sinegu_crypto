"""Binance Lite webhook route: POST /binance_lite_webhook.

Mirrors the main Binance flask bot's logic (balance-scaled base_size, max_sizing
cap, trade-log inserts, position upserts) so the two never diverge — the only
intentional differences are:
  - its own service/port (5003), route, secret, and file-log dir;
  - ENTRIES (BUY/SELL) are refused for tickers in LITE_NO_ENTRY_TICKERS (e.g. BTC);
    exits are always allowed so open positions can still close.
"""

import json
import logging
import os
import sys
import threading
from datetime import datetime
from typing import Optional

from flask import Blueprint, jsonify, request

import requests

from binance_lite_src.hooks import (
    LITE_NO_ENTRY_TICKERS,
    LITE_OUT_DIR,
    LITE_WEBHOOK_SECRET,
)
from src.hooks import is_lite_account
from src.assets_api import get_enabled_assets
from src.binance_accounts_api import fetch_binance_accounts
from src.hooks import API_BASE_URL, INSERT_PAST_POSITION_ENDPOINT, trading_api_headers
from src.routes.webhook import (
    COARSE_STEP_TICKERS,
    _derive_trade_log,
    _maybe_set_leverage,
    _parse_leverage,
    _post_trade_log_api,
    _run_accounts_parallel,
    _scale_qty,
    _upsert_position_api,
)
from src.trading_handler import (
    current_side_size,
    handle_add,
    handle_exit_long,
    handle_exit_short,
    handle_sell,
)

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
    """List of (api_key, secret_key, name, uni_id, balance, initial_deposit, currency_type) for enabled accounts."""
    accounts = fetch_binance_accounts()
    if not accounts:
        return []
    out = []
    for a in accounts:
        try:
            balance = float(a.get("balance") or 0)
        except (TypeError, ValueError):
            balance = 0.0
        try:
            initial_deposit = float(a.get("initial_deposit") or 0)
        except (TypeError, ValueError):
            initial_deposit = 0.0
        out.append((
            a.get("api_key"),
            a.get("secret_key"),
            a.get("name") or "?",
            a.get("uni_id") or "",
            balance,
            initial_deposit,
            (a.get("currency_type") or "USDT").upper(),
        ))
    return out


bp = Blueprint("lite_webhook", __name__)

TRADES_LOG = os.path.join(LITE_OUT_DIR, "webhook_trades.log")
TRADES_JSON = os.path.join(LITE_OUT_DIR, "binance_trades.json")

# Max accounts to execute concurrently (fair fills); serialise JSONL appends.
ACCOUNT_FANOUT_CAP = 8
_TRADE_JSON_LOCK = threading.Lock()


def _ensure_trades_log():
    os.makedirs(LITE_OUT_DIR, exist_ok=True)
    if not os.path.exists(TRADES_LOG):
        with open(TRADES_LOG, "a", encoding="utf-8") as f:
            f.write("# webhook_trades.log (lite) — one JSON line per webhook\n")


def _save_success_trade_json(action: str, ticker: str, account: str, binance_result: dict, price=None):
    if not binance_result or not isinstance(binance_result, dict):
        return
    try:
        os.makedirs(LITE_OUT_DIR, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        record = {
            "time_utc": ts,
            "action": action,
            "ticker": ticker,
            "account": account,
            "price": price,
            "binance_order": binance_result,
        }
        with _TRADE_JSON_LOCK:
            with open(TRADES_JSON, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, default=str) + "\n")
    except Exception as e:
        logger.warning("Could not save trade JSON: %s", e)


def _insert_past_position_api(
    api_key, uni_id, binance_res, symbol, position_side,
    price=None, entry_price=None, realized_pnl=None, strategy=None,
):
    try:
        side = (binance_res or {}).get("side", "SELL" if position_side == "LONG" else "BUY")
        order_id = (binance_res or {}).get("orderId")
        avg_price = (binance_res or {}).get("avgPrice")
        try:
            exit_price = float(avg_price) if avg_price else (float(price) if price is not None else None)
        except (TypeError, ValueError):
            exit_price = float(price) if price is not None else None
        executed_qty = (binance_res or {}).get("executedQty", "0")
        try:
            position_amt = float(executed_qty) if executed_qty else 0
        except (TypeError, ValueError):
            position_amt = 0
        try:
            entry = float(entry_price) if entry_price is not None else None
        except (TypeError, ValueError):
            entry = None
        try:
            pnl = float(realized_pnl) if realized_pnl is not None else None
        except (TypeError, ValueError):
            pnl = None
        closed_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        payload = {
            "api_key": api_key,
            "uni_id": uni_id,
            "symbol": symbol,
            "position_side": position_side,
            "position_amt": position_amt,
            "entry_price": entry,
            "exit_price": exit_price,
            "realized_pnl": pnl,
            "side": side,
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
        resp = requests.post(url, json=payload, headers=trading_api_headers(), timeout=10)
        if resp.ok:
            logger.info("Inserted past position [%s] %s %s", symbol, position_side, order_id)
        else:
            logger.warning("insert_past_position failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("Could not insert past position: %s", e)


def _insert_trade_log(action: str, ticker: str, success: bool, details: dict, price=None):
    try:
        os.makedirs(LITE_OUT_DIR, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        line = {
            "time_utc": ts,
            "action": action,
            "ticker": ticker,
            "success": success,
            "price": price,
            **{k: v for k, v in (details or {}).items() if k not in ("result",)},
        }
        if details and isinstance(details.get("result"), dict):
            r = details["result"]
            if "orderId" in r:
                line["orderId"] = r["orderId"]
            if "status" in r:
                line["order_status"] = r["status"]
        with open(TRADES_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(line) + "\n")
    except Exception as e:
        logger.warning("Could not write trade log: %s", e)


@bp.route("/binance_lite_webhook", methods=["POST"])
def binance_lite_webhook():
    """Receive TradingView webhook for Lite accounts. Same payload schema as main;
    mirrors main's sizing/gating, but refuses entries for LITE_NO_ENTRY_TICKERS."""
    try:
        logger.info("=" * 50 + " LITE WEBHOOK RECEIVED " + "=" * 50)
        _flush_logs()

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
        logger.info("LITE WEBHOOK payload: %s", json.dumps(_safe, indent=2))

        if not LITE_WEBHOOK_SECRET or secret != LITE_WEBHOOK_SECRET:
            logger.warning("LITE TRADE FAILED: Invalid secret")
            return jsonify({"error": "Unauthorized"}), 403

        action = str(data.get("action", "")).strip().upper()
        ticker_raw = str(data.get("symbol") or data.get("ticker") or "").strip()
        if ticker_raw.upper().startswith("BINANCE:"):
            ticker = ticker_raw[8:].upper()
        else:
            ticker = ticker_raw.upper() if ticker_raw else ""
        price_raw = data.get("price", data.get("close"))

        if not action or not ticker:
            _post_trade_log_api(
                "REJECTED", action=action or None, ticker=ticker or None,
                reason="missing_fields", message="LITE missing action or ticker",
            )
            return jsonify({"error": "Missing action or ticker"}), 400
        if action not in ("BUY", "SELL", "EXIT_LONG", "EXIT_SHORT"):
            _post_trade_log_api(
                "REJECTED", action=action, ticker=ticker,
                reason="invalid_action", message=f"LITE unknown action: {action}",
            )
            return jsonify({"error": f"Unknown action: {action}"}), 400

        # Resolve Binance symbol + sizing inputs from trading-api assets (same as main).
        binance_symbol = ticker
        try:
            quantity_override: Optional[float] = float(data.get("quantity")) if data.get("quantity") is not None else None
        except (TypeError, ValueError):
            quantity_override = None
        if quantity_override is not None and quantity_override <= 0:
            quantity_override = None

        asset_base_size: Optional[float] = None
        asset_max_sizing: Optional[float] = None
        asset_matched = False
        enabled_assets = get_enabled_assets()
        if enabled_assets is not None:
            for a in enabled_assets:
                if (a.get("ticker") or "").upper() == ticker or (a.get("binance_symbol") or "").upper() == ticker:
                    asset_matched = True
                    binance_symbol = a.get("binance_symbol", ticker)
                    try:
                        asset_base_size = float(a.get("base_size") or 0) or None
                    except (TypeError, ValueError):
                        asset_base_size = None
                    try:
                        asset_max_sizing = float(a.get("max_sizing") or 0) or None
                    except (TypeError, ValueError):
                        asset_max_sizing = None
                    break

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

        leverage_value = _parse_leverage(data)
        is_sizing_action = action in ("BUY", "SELL")

        # Lite-only gate: refuse ENTRIES for configured tickers (e.g. BTC). Exits pass.
        if is_sizing_action and binance_symbol.upper() in LITE_NO_ENTRY_TICKERS:
            logger.info("LITE SKIP %s %s — entries disabled for this ticker", action, binance_symbol)
            _post_trade_log_api(
                "SKIPPED", action=action, ticker=binance_symbol, success=False,
                price=price_value, strategy=strategy_name, leverage=leverage_value,
                reason="entry_disabled",
                message=f"LITE entries disabled for {binance_symbol}",
            )
            return jsonify({
                "action": action, "ticker": ticker, "success": False,
                "skipped": "entry_disabled",
            }), 200

        trade_accounts = _get_trade_accounts()
        if not trade_accounts:
            logger.error("LITE TRADE FAILED: No Binance accounts (check trading-api or .env)")
            return jsonify({"error": "No Binance accounts configured"}), 500

        # Fail-closed: a sized BUY/SELL requires a configured base_size on the assets row.
        if is_sizing_action and quantity_override is None:
            if not asset_matched:
                logger.error("LITE TRADE REFUSED %s %s — no enabled assets row matched", action, ticker)
                return jsonify({
                    "action": action, "ticker": ticker, "success": False,
                    "error": "asset_not_configured",
                }), 400
            if not asset_base_size:
                logger.error("LITE TRADE REFUSED %s %s — asset misconfigured (base_size=%s)", action, ticker, asset_base_size)
                return jsonify({
                    "action": action, "ticker": ticker, "success": False,
                    "error": "asset_misconfigured_base_size", "base_size": asset_base_size,
                }), 400

        logger.info(
            "LITE Executing %s for %s (binance=%s, base_size=%s, override=%s, leverage=%s) on %d accounts",
            action, ticker, binance_symbol, asset_base_size, quantity_override,
            f"{leverage_value}x" if leverage_value is not None else "default",
            len(trade_accounts),
        )
        _flush_logs()

        def _process_account(acct):
            """Execute the whole action for one account (mirrors main). Returns its
            result dict, or None when skipped before any order. Runs in a worker thread."""
            api_key, secret_key, name, uni_id, balance, initial_deposit, currency_type = acct
            if not api_key or not secret_key:
                logger.warning("[%s] LITE skip: missing api_key or secret_key", name)
                return None

            quantity: Optional[float] = None
            entry_current: Optional[float] = None
            entry_cap: Optional[float] = None
            if is_sizing_action:
                if quantity_override is not None:
                    quantity = quantity_override
                else:
                    if currency_type != "USDT":
                        logger.info("[%s] LITE skip: currency_type=%s — not USDT-margined", name, currency_type or "?")
                        return {"account": name, "result": {"skipped": "not_usdt"}, "ok": False}
                    if not asset_base_size:
                        logger.warning("[%s] LITE skip: no asset base_size for %s", name, ticker)
                        return {"account": name, "result": {"skipped": "no_base_size"}, "ok": False}
                    # Tier routing: lite trades only lite-tier accounts (deposit < 500 and
                    # balance in [100, 500)). Deposit >= 500 or balance >= 500 belong to main.
                    if not is_lite_account(initial_deposit, balance):
                        logger.info("[%s] LITE skip: not lite tier (deposit=%s balance=%s) — main handles it", name, initial_deposit, balance)
                        return {"account": name, "result": {"skipped": "not_lite_tier", "deposit": initial_deposit, "balance": balance}, "ok": False}
                    quantity = _scale_qty(binance_symbol, asset_base_size, balance)
                    min_step = asset_base_size if binance_symbol.upper() in COARSE_STEP_TICKERS else asset_base_size / 10.0
                    if quantity < min_step:
                        logger.info("[%s] LITE skip: scaled qty %s < min step %s (balance=%s)", name, quantity, min_step, balance)
                        return {"account": name, "result": {"skipped": "size_too_small", "quantity": quantity, "min_step": min_step}, "ok": False}

                    # Same-side current size + scaled cap (one read; reused below).
                    want_side = "LONG" if action == "BUY" else "SHORT"
                    entry_current = current_side_size(api_key, secret_key, binance_symbol, want_side)
                    entry_cap = _scale_qty(binance_symbol, asset_max_sizing, balance) if asset_max_sizing else None
                    if entry_cap and entry_cap > 0 and round(entry_current + quantity, 8) > entry_cap:
                        logger.info("[%s] LITE SKIP %s %s — maxed sizing: %.8f + %.8f > %.8f", name, action, binance_symbol, entry_current, quantity, entry_cap)
                        return {
                            "account": name,
                            "result": {"skipped": "maxed_sizing", "symbol": binance_symbol,
                                       "current": entry_current, "quantity": quantity, "max_sizing": entry_cap},
                            "ok": False, "size": round(entry_current, 8), "cap": entry_cap,
                        }

            if leverage_value is not None:
                _maybe_set_leverage(api_key, secret_key, name, binance_symbol, leverage_value)
            if action == "BUY":
                result = handle_add(api_key=api_key, secret_key=secret_key, ticker=binance_symbol, price=price_value, quantity=quantity)
            elif action == "SELL":
                result = handle_sell(api_key=api_key, secret_key=secret_key, ticker=binance_symbol, price=price_value, quantity=quantity)
            elif action == "EXIT_LONG":
                result = handle_exit_long(api_key=api_key, secret_key=secret_key, ticker=binance_symbol, price=price_value)
            elif action == "EXIT_SHORT":
                result = handle_exit_short(api_key=api_key, secret_key=secret_key, ticker=binance_symbol, price=price_value)
            else:
                result = None
            binance_res = result.get("result") if isinstance(result, dict) else result
            ok = (
                result is not None
                and result.get("status") not in ("no positions to close", "no long position to close", "no short position to close")
                and isinstance(binance_res, dict)
                and binance_res.get("orderId")
            )
            if ok:
                logger.info("LITE TRADE OK [%s]: %s %s", name, action, ticker)
                _save_success_trade_json(action, ticker, name, binance_res, price_value)
                if action in ("BUY", "SELL"):
                    _upsert_position_api(api_key, uni_id, binance_res, binance_symbol, action, quantity, strategy=strategy_name)
                if action == "EXIT_LONG":
                    _insert_past_position_api(
                        api_key, uni_id, binance_res, binance_symbol, "LONG", price_value,
                        entry_price=result.get("entry_price"), realized_pnl=result.get("realized_pnl"),
                        strategy=strategy_name,
                    )
                elif action == "EXIT_SHORT":
                    _insert_past_position_api(
                        api_key, uni_id, binance_res, binance_symbol, "SHORT", price_value,
                        entry_price=result.get("entry_price"), realized_pnl=result.get("realized_pnl"),
                        strategy=strategy_name,
                    )
            else:
                if result:
                    st = result.get("status", "no result")
                    err = result.get("error")
                    if st == "position_mode_mismatch" and err:
                        logger.warning("LITE TRADE [%s]: %s — %s", name, st, err)
                    else:
                        logger.warning("LITE TRADE [%s]: %s", name, st)
                else:
                    logger.warning("LITE TRADE FAILED [%s]: Binance returned no result", name)
            size_after = None
            if ok and action in ("BUY", "SELL") and entry_current is not None and quantity is not None:
                size_after = round(entry_current + quantity, 8)
            return {"account": name, "result": result, "ok": bool(ok), "size": size_after, "cap": entry_cap}

        # Fan out across accounts so every account fills near-simultaneously.
        account_results = _run_accounts_parallel(
            [(lambda a=acct: _process_account(a)) for acct in trade_accounts],
            cap=ACCOUNT_FANOUT_CAP,
        )
        results_by_account = [
            {"account": r["account"], "result": r["result"]}
            for r in account_results if r is not None
        ]
        any_success = any(bool(r.get("ok")) for r in account_results if r is not None)

        _insert_trade_log(action, ticker, any_success, {"accounts": results_by_account}, price_value)

        # Append-only trade-log row to trading-api (one per webhook, graceful category).
        derived = _derive_trade_log(action, account_results)
        _sized = next((r for r in account_results if r and r.get("size") is not None), None)
        _post_trade_log_api(
            derived["category"],
            action=action,
            ticker=ticker,
            success=any_success,
            price=price_value,
            strategy=strategy_name,
            leverage=leverage_value,
            counts=derived,
            reason=derived["reason"],
            realized_pnl=derived["realized_pnl"],
            position_size=_sized.get("size") if _sized else None,
            position_cap=_sized.get("cap") if _sized else None,
            message=(
                f"LITE {derived['category']} {action} {ticker} — "
                f"{derived['accounts_success']}/{derived['accounts_total']} ok"
            ),
            metadata={"accounts": results_by_account},
        )

        logger.info("LITE WEBHOOK DONE: action=%s ticker=%s success=%s", action, ticker, any_success)
        _flush_logs()

        summary = {
            "action": action, "ticker": ticker, "success": any_success,
            "accounts": len(trade_accounts), "details": results_by_account,
        }
        if price_value is not None:
            summary["price"] = price_value
        if strategy_name:
            summary["strategy"] = strategy_name
        if leverage_value is not None:
            summary["leverage"] = leverage_value
        return jsonify(summary), 200

    except Exception as e:
        logger.exception("LITE TRADE FAILED: %s", e)
        try:
            _post_trade_log_api(
                "FAILED", action=locals().get("action"), ticker=locals().get("ticker"),
                reason="exception", message="LITE " + str(e)[:480],
            )
        except Exception:
            pass
        return jsonify({"error": str(e)}), 500
