"""Binance webhook route: POST /binance_webhook for TradingView alerts."""

import json
import logging
import math
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Callable, List, Optional

from flask import Blueprint, request, jsonify

import requests

from src.hooks import (
    API_BASE_URL,
    INSERT_PAST_POSITION_ENDPOINT,
    UPSERT_POSITION_ENDPOINT,
    TRADE_LOG_ENDPOINT,
    trading_api_headers,
    WEBHOOK_SECRET,
    OUTGOING_SECRET,
    OUT_DIR,
    POSITION_MODE,
    is_main_account,
)

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
from src.binance_api import BinanceAPI
from src.trading_handler import (
    handle_add,
    handle_exit_long,
    handle_exit_short,
    handle_sell,
    current_side_size,
)
from src.assets_api import get_enabled_assets
from src.binance_accounts_api import fetch_binance_accounts

logger = logging.getLogger(__name__)


COARSE_STEP_TICKERS = {"BTCUSDT"}

REFERENCE_BALANCE = 500.0


def _scale_qty(ticker: str, base_size: float, balance: float) -> float:
    if base_size <= 0 or balance <= 0:
        return 0.0
    if balance < REFERENCE_BALANCE:
        return round(base_size, 8)
    coarse = (ticker or "").upper() in COARSE_STEP_TICKERS
    if coarse:
        steps = math.floor(balance / REFERENCE_BALANCE)
        return round(steps * base_size, 8)
    step = base_size / 10.0
    raw = base_size * (balance / REFERENCE_BALANCE)
    steps = math.floor(raw / step)
    return round(steps * step, 8)


def _maybe_set_leverage(
    api_key: str,
    secret_key: str,
    account_name: str,
    symbol: str,
    leverage: int,
) -> None:
    """POST /fapi/v1/leverage for this symbol; log warning on failure but do not block the trade."""
    try:
        api = BinanceAPI(api_key, secret_key)
        res = api.set_leverage(symbol, leverage)
        if isinstance(res, dict) and res.get("_error"):
            raw = (res.get("response") or "")[:300]
            logger.warning("[%s] set_leverage %sx %s failed: %s", account_name, leverage, symbol, raw or res.get("message"))
        elif isinstance(res, dict) and isinstance(res.get("code"), int) and res["code"] < 0:
            logger.warning("[%s] set_leverage %s: %s", account_name, symbol, res)
        else:
            logger.info("[%s] Leverage set to %sx for %s", account_name, leverage, symbol)
    except Exception as e:
        logger.warning("[%s] set_leverage exception: %s", account_name, e)


def _parse_leverage(data: dict) -> Optional[int]:
    """Optional webhook field `leverage`: \"5\", 5, or 20 → 5x / 20x. None if omitted or invalid."""
    raw = data.get("leverage")
    if raw is None:
        return None
    s = str(raw).strip()
    if s == "":
        return None
    try:
        v = int(float(s))
    except (TypeError, ValueError):
        logger.warning("Invalid leverage ignored: %r", raw)
        return None
    if v < 1:
        logger.warning("leverage < 1 ignored, using 1")
        return 1
    if v > 125:
        logger.warning("leverage > 125 clamped to 125")
        return 125
    return v


def _get_trade_accounts():
    """Get list of (api_key, secret_key, name, uni_id, balance, initial_deposit, currency_type)
    for enabled accounts.

    Fetched fresh on every webhook so new accounts and updated balances are picked up.
    """
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

bp = Blueprint("webhook", __name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
TRADES_LOG = os.path.join(OUT_DIR, "webhook_trades.log")
TRADES_JSON = os.path.join(OUT_DIR, "binance_trades.json")

# Max accounts to execute concurrently when fanning out a webhook (fair fills).
ACCOUNT_FANOUT_CAP = 8
# Serialises appends to TRADES_JSON from the per-account worker threads.
_TRADE_JSON_LOCK = threading.Lock()


def _run_accounts_parallel(thunks: List[Callable[[], object]], cap: int = ACCOUNT_FANOUT_CAP) -> List[object]:
    """Run one thunk per account concurrently so every account hits the market at
    nearly the same instant (fair entry/exit price), instead of the old sequential
    stagger. Each thunk handles a single account end-to-end and returns its result;
    exceptions are isolated per account (logged, recorded as None). Results are
    returned in the same order as `thunks`.
    """
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


def _save_success_trade_json(action: str, ticker: str, account: str, binance_result: dict, price=None):
    """Append Binance API success response to binance_trades.json (JSONL) for binance_positions table planning."""
    if not binance_result or not isinstance(binance_result, dict):
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
            "binance_order": binance_result,
        }
        with _TRADE_JSON_LOCK:
            with open(TRADES_JSON, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, default=str) + "\n")
        logger.info("Saved Binance order to %s", TRADES_JSON)
    except Exception as e:
        logger.warning("Could not save trade JSON: %s", e)


def _insert_past_position_api(
    api_key: str,
    uni_id: str,
    binance_res: dict,
    symbol: str,
    position_side: str,
    price=None,
    entry_price=None,
    realized_pnl=None,
    strategy=None,
):
    """POST closed position to trading-api insert_past_position. entry_price/realized_pnl from handler when available."""
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
            logger.warning("API_BASE_URL not set - cannot insert past position")
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


def _upsert_position_api(
    api_key: str,
    uni_id: str,
    binance_res: dict,
    symbol: str,
    action: str,
    quantity: float,
    strategy=None,
):
    """POST new position increment to trading-api so the DB reflects the trade immediately.

    The strategy (from the entry alert) is persisted server-side in the
    entry-strategy map so a later close that doesn't carry a strategy
    (manual / liquidation / background syncer) can recover the tag.
    """
    try:
        avg_price = (binance_res or {}).get("avgPrice")
        try:
            entry_price = float(avg_price) if avg_price else None
        except (TypeError, ValueError):
            entry_price = None

        hedge = POSITION_MODE.strip().lower() in ("hedge", "dual", "long_short")
        if hedge:
            position_side = "LONG" if action == "BUY" else "SHORT"
        else:
            position_side = "BOTH"

        position_amt = quantity if action == "BUY" else -quantity

        payload = {
            "api_key": api_key,
            "uni_id": uni_id,
            "symbol": symbol,
            "position_side": position_side,
            "position_amt": position_amt,
            "entry_price": entry_price,
        }
        if strategy:
            payload["strategy"] = strategy
        if not API_BASE_URL:
            logger.warning("API_BASE_URL not set - cannot upsert position")
            return
        base = API_BASE_URL.rstrip("/")
        path = UPSERT_POSITION_ENDPOINT if UPSERT_POSITION_ENDPOINT.startswith("/") else "/" + UPSERT_POSITION_ENDPOINT
        url = base + path
        resp = requests.post(url, json=payload, headers=trading_api_headers(), timeout=10)
        if resp.ok:
            data = resp.json()
            logger.info("Upserted position [%s] %s %s — %s (total: %s)",
                        symbol, action, position_amt, data.get("action"), data.get("position_amt"))
        else:
            logger.warning("upsert_position failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("Could not upsert position: %s", e)


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


# Outcomes that mean "nothing to do" rather than a real failure (EXIT on a flat book).
_NO_POSITION_STATUSES = (
    "no positions to close",
    "no long position to close",
    "no short position to close",
)


def _derive_trade_log(action: str, account_results: list) -> dict:
    """Reduce per-account outcomes to ONE webhook-level trade-log row.

    Pure function (no I/O) so it can be unit-tested. A non-ok account is a SKIP
    when it never attempted an order (pre-trade skip / nothing to close), else a
    FAILURE. Category precedence: any success wins (ENTRY/EXIT), then FAILED, then
    SKIPPED. `reason` carries the first non-ok reason; `realized_pnl` sums
    successful exits.
    """
    rows = [r for r in (account_results or []) if r is not None]
    total = len(rows)
    success = 0
    failed = 0
    skipped = 0
    reason = None
    pnl_sum = 0.0
    pnl_seen = False
    is_exit = action in ("EXIT_LONG", "EXIT_SHORT")

    for r in rows:
        res = r.get("result") if isinstance(r, dict) else None
        res = res if isinstance(res, dict) else {}
        if r.get("ok"):
            success += 1
            if is_exit:
                try:
                    rp = r.get("realized_pnl", res.get("realized_pnl"))
                    if rp is not None:
                        pnl_sum += float(rp)
                        pnl_seen = True
                except (TypeError, ValueError):
                    pass
            continue
        # non-ok: classify skip vs failure
        is_skip = bool(res.get("skipped")) or res.get("status") in _NO_POSITION_STATUSES
        if is_skip:
            skipped += 1
        else:
            failed += 1
        if reason is None:
            reason = res.get("skipped") or res.get("error") or res.get("status")

    if success > 0:
        category = "EXIT" if is_exit else "ENTRY"
    elif failed > 0:
        category = "FAILED"
    elif skipped > 0:
        category = "SKIPPED"
    else:
        category = "FAILED"  # no accounts processed / nothing happened

    return {
        "category": category,
        "accounts_total": total,
        "accounts_success": success,
        "accounts_failed": failed,
        "accounts_skipped": skipped,
        "reason": reason,
        "realized_pnl": round(pnl_sum, 8) if pnl_seen else None,
    }


def _send_trade_log(payload: dict) -> None:
    """POST a trade-log row to trading-api. Best-effort; runs on a daemon thread
    so logging never blocks or breaks a webhook. Failures are logged, not raised."""
    def _post():
        try:
            if not API_BASE_URL:
                return
            base = API_BASE_URL.rstrip("/")
            path = TRADE_LOG_ENDPOINT if TRADE_LOG_ENDPOINT.startswith("/") else "/" + TRADE_LOG_ENDPOINT
            resp = requests.post(base + path, json=payload, headers=trading_api_headers(), timeout=10)
            if not resp.ok:
                logger.warning("trade-log POST failed: %s %s", resp.status_code, resp.text[:200])
        except Exception as e:
            logger.warning("trade-log POST exception: %s", e)

    try:
        threading.Thread(target=_post, name="trade-log", daemon=True).start()
    except Exception as e:
        logger.warning("trade-log thread spawn failed: %s", e)


def _post_trade_log_api(
    category: str,
    action: str = None,
    ticker: str = None,
    success: bool = False,
    price=None,
    strategy=None,
    leverage=None,
    counts: dict = None,
    reason: str = None,
    message: str = None,
    metadata: dict = None,
    realized_pnl=None,
    position_size=None,
    position_cap=None,
) -> None:
    """Build a trade-log payload and fire it (non-blocking) at trading-api."""
    payload = {
        "category": category,
        "action": action,
        "ticker": ticker,
        "success": bool(success),
        "price": price,
        "strategy": strategy,
        "leverage": leverage,
        "reason": reason,
        "message": message,
        "realized_pnl": realized_pnl,
        "position_size": position_size,
        "position_cap": position_cap,
    }
    if counts:
        payload.update({
            "accounts_total": counts.get("accounts_total", 0),
            "accounts_success": counts.get("accounts_success", 0),
            "accounts_failed": counts.get("accounts_failed", 0),
            "accounts_skipped": counts.get("accounts_skipped", 0),
        })
    if metadata is not None:
        payload["metadata"] = metadata
    _send_trade_log(payload)


@bp.route("/binance_webhook", methods=["POST"])
def binance_webhook():
    """Receive TradingView webhook: secret, action, symbol; optional quantity, price, strategy, leverage (1–125x)."""
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
        if ticker_raw.upper().startswith("BINANCE:"):
            ticker = ticker_raw[8:].upper()
        else:
            ticker = ticker_raw.upper() if ticker_raw else ""
        price_raw = data.get("price", data.get("close"))

        if not action or not ticker:
            logger.warning("TRADE FAILED: Missing action or ticker")
            _post_trade_log_api(
                "REJECTED", action=action or None, ticker=ticker or None,
                reason="missing_fields", message="Missing action or ticker",
            )
            return jsonify({"error": "Missing action or ticker"}), 400

        if action not in ("BUY", "SELL", "EXIT_LONG", "EXIT_SHORT"):
            logger.warning("TRADE FAILED: Unknown action=%s", action)
            _post_trade_log_api(
                "REJECTED", action=action, ticker=ticker,
                reason="invalid_action", message=f"Unknown action: {action}",
            )
            return jsonify({"error": f"Unknown action: {action}. Use BUY, SELL, EXIT_LONG, EXIT_SHORT"}), 400

        # Resolve Binance symbol + sizing inputs from trading-api assets.
        # quantity_override (webhook `"quantity"` field) bypasses auto-scaling on every account.
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

        trade_accounts = _get_trade_accounts()
        if not trade_accounts:
            logger.error("TRADE FAILED: No Binance accounts (check trading-api or .env)")
            return jsonify({"error": "No Binance accounts configured"}), 500

        is_sizing_action = action in ("BUY", "SELL")

        # Fail-closed: a sized BUY/SELL requires a configured base_size on the assets row.
        if is_sizing_action and quantity_override is None:
            if not asset_matched:
                logger.error(
                    "TRADE REFUSED %s %s — no enabled assets row matched (broker=Binance). Populate the asset.",
                    action, ticker,
                )
                return jsonify({
                    "action": action,
                    "ticker": ticker,
                    "success": False,
                    "error": "asset_not_configured",
                }), 400
            if not asset_base_size:
                logger.error(
                    "TRADE REFUSED %s %s — asset misconfigured (base_size=%s). "
                    "Set base_size in trading-api assets row before trading.",
                    action, ticker, asset_base_size,
                )
                return jsonify({
                    "action": action,
                    "ticker": ticker,
                    "success": False,
                    "error": "asset_misconfigured_base_size",
                    "base_size": asset_base_size,
                }), 400

        logger.info(
            "Executing %s for %s (binance=%s, base_size=%s, override=%s, leverage=%s) on %d accounts",
            action,
            ticker,
            binance_symbol,
            asset_base_size,
            quantity_override,
            f"{leverage_value}x" if leverage_value is not None else "default",
            len(trade_accounts),
        )
        _flush_logs()

        def _process_account(acct):
            """Execute the whole action for one account and return its result dict
            (or None when the account is skipped before any order). Runs in a worker
            thread; only reads the outer request-scoped vars (all read-only here)."""
            api_key, secret_key, name, uni_id, balance, initial_deposit, currency_type = acct
            if not api_key or not secret_key:
                logger.warning("[%s] Skipping: missing api_key or secret_key", name)
                return None

            # Per-account quantity (BUY/SELL only; EXITs close whatever exists).
            # entry_current = same-side size BEFORE this entry; entry_cap = scaled max_sizing
            # cap (None = unlimited). Both are computed once and reused for the cap gate AND
            # for size-vs-cap reporting on the trade log.
            quantity: Optional[float] = None
            entry_current: Optional[float] = None
            entry_cap: Optional[float] = None
            if is_sizing_action:
                if quantity_override is not None:
                    quantity = quantity_override
                else:
                    if currency_type != "USDT":
                        logger.info("[%s] Skipped: currency_type=%s — not USDT-margined", name, currency_type or "?")
                        return {"account": name, "result": {"skipped": "not_usdt"}, "ok": False}
                    if not asset_base_size:
                        logger.warning("[%s] Skipped: no asset base_size for %s", name, ticker)
                        return {"account": name, "result": {"skipped": "no_base_size"}, "ok": False}
                    # Tier routing: main bot trades only main-tier accounts (deposit >= 500
                    # or promoted by balance >= 500). Lite-tier accounts trade on the lite bot.
                    if not is_main_account(initial_deposit, balance):
                        logger.info("[%s] Skipped: not main tier (deposit=%s balance=%s) — lite handles it", name, initial_deposit, balance)
                        return {"account": name, "result": {"skipped": "not_main_tier", "deposit": initial_deposit, "balance": balance}, "ok": False}
                    quantity = _scale_qty(binance_symbol, asset_base_size, balance)
                    min_step = asset_base_size if binance_symbol.upper() in COARSE_STEP_TICKERS else asset_base_size / 10.0
                    if quantity < min_step:
                        logger.info("[%s] Skipped: scaled qty %s < min step %s (balance=%s)", name, quantity, min_step, balance)
                        return {"account": name, "result": {"skipped": "size_too_small", "quantity": quantity, "min_step": min_step}, "ok": False}

                    # Same-side current size + scaled cap (one read; reused below).
                    want_side = "LONG" if action == "BUY" else "SHORT"
                    entry_current = current_side_size(api_key, secret_key, binance_symbol, want_side)
                    entry_cap = _scale_qty(binance_symbol, asset_max_sizing, balance) if asset_max_sizing else None
                    # Max position size cap: block if this entry would push the same-side
                    # position past the scaled cap. Falsy cap -> unlimited.
                    if entry_cap and entry_cap > 0 and round(entry_current + quantity, 8) > entry_cap:
                        logger.info("[%s] SKIP %s %s — maxed sizing: %.8f + %.8f > %.8f", name, action, binance_symbol, entry_current, quantity, entry_cap)
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
                logger.info("TRADE OK [%s]: %s %s", name, action, ticker)
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
                        logger.warning("TRADE [%s]: %s — %s", name, st, err)
                    else:
                        logger.warning("TRADE [%s]: %s", name, st)
                else:
                    logger.warning("TRADE FAILED [%s]: Binance returned no result", name)
            # Resulting same-side size after a successful entry (assume full fill).
            size_after = None
            if ok and action in ("BUY", "SELL") and entry_current is not None and quantity is not None:
                size_after = round(entry_current + quantity, 8)
            return {"account": name, "result": result, "ok": bool(ok), "size": size_after, "cap": entry_cap}

        # Fan out across accounts so every account fills near-simultaneously
        # (fair price), instead of a sequential stagger. Each account uses its
        # own API key, so parallel order placement is per-key rate-limit-safe.
        account_results = _run_accounts_parallel(
            [(lambda a=acct: _process_account(a)) for acct in trade_accounts],
            cap=ACCOUNT_FANOUT_CAP,
        )
        results_by_account = [
            {"account": r["account"], "result": r["result"]}
            for r in account_results if r is not None
        ]
        any_success = any(bool(r.get("ok")) for r in account_results if r is not None)

        success = any_success
        _insert_trade_log(action, ticker, success, {"accounts": results_by_account}, price_value)

        # Append-only trade-log row to trading-api (one per webhook, graceful category).
        derived = _derive_trade_log(action, account_results)
        _sized = next((r for r in account_results if r and r.get("size") is not None), None)
        _post_trade_log_api(
            derived["category"],
            action=action,
            ticker=ticker,
            success=success,
            price=price_value,
            strategy=strategy_name,
            leverage=leverage_value,
            counts=derived,
            reason=derived["reason"],
            realized_pnl=derived["realized_pnl"],
            position_size=_sized.get("size") if _sized else None,
            position_cap=_sized.get("cap") if _sized else None,
            message=(
                f"{derived['category']} {action} {ticker} — "
                f"{derived['accounts_success']}/{derived['accounts_total']} ok"
            ),
            metadata={"accounts": results_by_account},
        )

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
        # Best-effort: still record one row so a crash is visible in Trading Logs.
        try:
            _post_trade_log_api(
                "FAILED",
                action=locals().get("action"),
                ticker=locals().get("ticker"),
                reason="exception",
                message=str(e)[:500],
            )
        except Exception:
            pass
        return jsonify({"error": str(e)}), 500


@bp.route("/close_position", methods=["POST"])
def close_position():
    """User-initiated close. Called by trading-api → BinanceController::closePosition.

    Auth: X-Outgoing-Secret header must equal hooks.OUTGOING_SECRET.
    Body: {api_key, secret_key, symbol, position_side ('LONG'|'SHORT')}.
    Reuses handle_exit_long / handle_exit_short and inserts the closed
    position into trading-api so the user sees it in past-positions immediately.
    """
    if not OUTGOING_SECRET:
        logger.error("close_position called but FLASK_OUTGOING_SECRET is not set")
        return jsonify({"error": "Outgoing secret not configured on Flask"}), 500
    if request.headers.get("X-Outgoing-Secret") != OUTGOING_SECRET:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json(silent=True) or {}
    api_key = (data.get("api_key") or "").strip()
    secret_key = (data.get("secret_key") or "").strip()
    symbol = (data.get("symbol") or "").strip().upper()
    position_side = (data.get("position_side") or "").strip().upper()

    if not api_key or not secret_key or not symbol or position_side not in ("LONG", "SHORT"):
        return jsonify({"error": "Missing or invalid fields"}), 400

    try:
        if position_side == "LONG":
            result = handle_exit_long(api_key=api_key, secret_key=secret_key, ticker=symbol, price=None)
        else:
            result = handle_exit_short(api_key=api_key, secret_key=secret_key, ticker=symbol, price=None)
    except Exception as e:
        logger.exception("close_position failed: %s", e)
        return jsonify({"error": str(e)}), 500

    binance_res = result.get("result") if isinstance(result, dict) else None
    ok = (
        result is not None
        and result.get("status") not in ("no positions to close", "no long position to close", "no short position to close")
        and isinstance(binance_res, dict)
        and binance_res.get("orderId")
    )

    if ok:
        # Best-effort: write the closed trade to trading-api so the user sees it without waiting for the sync loop.
        _insert_past_position_api(
            api_key, "", binance_res, symbol, position_side, None,
            entry_price=result.get("entry_price"),
            realized_pnl=result.get("realized_pnl"),
        )
        return jsonify({
            "ok": True,
            "exit_price": (binance_res or {}).get("avgPrice"),
            "realized_pnl": result.get("realized_pnl"),
            "order_id": binance_res.get("orderId"),
        }), 200

    return jsonify({"ok": False, "result": result}), 400
