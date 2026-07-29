"""POST /binance_abcd_webhook — the trade path.

Fast-ACK design: the request handler only validates (secret, action, ticker)
and enqueues a job on the dispatch pool, answering TradingView in milliseconds.
The job resolves the asset + accounts, then fans out one task per account on
the shared account pool (the global in-flight ceiling). Per-(api_key, symbol)
locks serialize overlapping signals for the same account; retryable failures
go to the retry queue keyed by uni_id.
"""

from __future__ import annotations

import hmac as hmac_mod
import json
import logging
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Optional

from flask import Blueprint, jsonify, request

from binance_abcd import engine_client, symbol_locks
from binance_abcd.accounts_api import account_futures_base_url, fetch_accounts
from binance_abcd.assets_api import get_asset
from binance_abcd.binance_api import BinanceAPI
from binance_abcd.hooks import (
    COARSE_STEP_TICKERS,
    DISPATCH_WORKERS,
    FANOUT_WORKERS,
    LEVERAGE_CACHE_TTL,
    OUT_DIR,
    REFERENCE_BALANCE,
    WEBHOOK_PATH,
    WEBHOOK_SECRET,
)
from binance_abcd.trading_handler import get_order_fill_summary, handle_entry, handle_exit

log = logging.getLogger(__name__)

webhook_bp = Blueprint("abcd_webhook", __name__)

VALID_ACTIONS = ("BUY", "SELL", "EXIT_LONG", "EXIT_SHORT")
ENTRY_ACTIONS = ("BUY", "SELL")

_DISPATCH_EXECUTOR = ThreadPoolExecutor(max_workers=DISPATCH_WORKERS, thread_name_prefix="dispatch")
_ACCOUNT_EXECUTOR = ThreadPoolExecutor(max_workers=FANOUT_WORKERS, thread_name_prefix="account")

TRADES_LOG = OUT_DIR / "webhook_trades.log"
_TRADES_LOG_LOCK = threading.Lock()

# Last leverage applied per (api_key, symbol) -> (leverage, epoch). Saves one
# POST /fapi/v1/leverage per account per signal when the value hasn't changed.
_LEVERAGE_APPLIED: dict[tuple[str, str], tuple[int, float]] = {}
_LEVERAGE_LOCK = threading.Lock()

_metrics_lock = threading.Lock()
_metrics = {
    "received": 0,
    "rejected": 0,
    "jobs_dispatched": 0,
    "jobs_done": 0,
    "accounts_traded": 0,
    "accounts_failed": 0,
    "accounts_skipped": 0,
}


def _bump(key: str, amount: int = 1) -> None:
    with _metrics_lock:
        _metrics[key] += amount


def metrics_snapshot() -> dict:
    with _metrics_lock:
        return dict(_metrics)


# --- Sizing -------------------------------------------------------------------

def _scale_qty(ticker: str, base_size: float, balance: float) -> float:
    """Balance-proportional size in units of base_size.

    balance < REFERENCE(500) -> base_size as-is; coarse tickers (BTCUSDT) step in
    whole base_size multiples per 500; everything else scales in base_size/10
    steps, floored.
    """
    try:
        base = float(base_size)
        bal = float(balance)
    except (TypeError, ValueError):
        return 0.0
    if base <= 0:
        return 0.0
    if bal < REFERENCE_BALANCE:
        return base
    if ticker.upper() in COARSE_STEP_TICKERS:
        return math.floor(bal / REFERENCE_BALANCE) * base
    step = base / 10.0
    scaled = base * (bal / REFERENCE_BALANCE)
    return round(math.floor(scaled / step) * step, 10)


def _parse_leverage(raw: Any) -> Optional[int]:
    if raw in (None, ""):
        return None
    try:
        lev = int(float(raw))
    except (TypeError, ValueError):
        return None
    return max(1, min(125, lev))


def _maybe_set_leverage(api: BinanceAPI, symbol: str, leverage: Optional[int]) -> None:
    """set_leverage only when the cached last-applied value differs."""
    if leverage is None:
        return
    key = (api.api_key, symbol.upper())
    now = time.time()
    with _LEVERAGE_LOCK:
        cached = _LEVERAGE_APPLIED.get(key)
        if cached and cached[0] == leverage and (now - cached[1]) < LEVERAGE_CACHE_TTL:
            return
    result = api.set_leverage(symbol, leverage)
    if isinstance(result, dict) and result.get("_error"):
        log.warning("[Binance] set_leverage %sx %s failed: %.200s", leverage, symbol, result.get("response"))
        return
    with _LEVERAGE_LOCK:
        _LEVERAGE_APPLIED[key] = (leverage, now)


def _normalize_target_uni_ids(raw: Any) -> Optional[set[str]]:
    """target_uni_ids as CSV string or list -> set, None when absent/empty."""
    if raw is None:
        return None
    if isinstance(raw, str):
        ids = {part.strip() for part in raw.split(",") if part.strip()}
    elif isinstance(raw, (list, tuple)):
        ids = {str(part).strip() for part in raw if str(part).strip()}
    else:
        return None
    return ids or None


# --- Stack cap (batched, DB-first) --------------------------------------------

def _fetch_open_amounts(symbol: str, position_side: str) -> Optional[dict[str, float]]:
    """One engine-API call: api_key -> abs(open amount) for symbol+side.
    None when the backend is unreachable (callers fall back to Binance)."""
    data = engine_client.get_json(
        "positions/check", params={"symbol": symbol.upper(), "position_side": position_side}
    )
    if data is None:
        return None
    amounts: dict[str, float] = {}
    for row in data.get("positions", []):
        try:
            amounts[row["api_key"]] = amounts.get(row["api_key"], 0.0) + abs(float(row["position_amt"]))
        except (KeyError, TypeError, ValueError):
            continue
    return amounts


def _binance_open_amount(api: BinanceAPI, symbol: str, position_side: str) -> float:
    """Fallback when the engine API is down: read the side's size from Binance."""
    try:
        for p in api.get_positions_v3(symbol):
            if (p.get("positionSide") or "BOTH").upper() == position_side:
                return abs(float(p.get("positionAmt") or 0))
    except Exception:  # noqa: BLE001
        pass
    return 0.0


# --- Bookkeeping helpers ------------------------------------------------------

def _upsert_position_api(account: dict, symbol: str, position_side: str, amount: float, entry_price: Optional[float]) -> None:
    payload = {
        "api_key": account["api_key"],
        "uni_id": account.get("uni_id"),
        "symbol": symbol,
        "position_side": position_side,
        "position_amt": amount,
    }
    if entry_price is not None:
        payload["entry_price"] = entry_price
    engine_client.post_json("positions/upsert", payload)


def _store_open_strategy(account: dict, symbol: str, position_side: str, strategy: str) -> None:
    engine_client.post_json(
        "open-strategies",
        {"api_key": account["api_key"], "symbol": symbol, "position_side": position_side, "strategy": strategy},
    )


def _recover_strategy(account: dict, symbol: str, position_side: str) -> Optional[str]:
    data = engine_client.get_json("open-strategies", params={"api_key": account["api_key"], "symbol": symbol})
    if not data:
        return None
    for row in data.get("open_strategies", []):
        if row.get("position_side") == position_side:
            return row.get("strategy")
    return None


def _consume_strategy(account: dict, symbol: str, position_side: str) -> None:
    engine_client.delete_json(
        "open-strategies",
        {"api_key": account["api_key"], "symbol": symbol, "position_side": position_side},
    )


def _deferred_close_bookkeeping(
    account: dict,
    api: BinanceAPI,
    symbol: str,
    position_side: str,
    closed_qty: float,
    entry_price: Optional[float],
    strategy: Optional[str],
    order_result: Any,
) -> None:
    """After a close: fill summary from userTrades -> past-position row + strategy consume.
    Runs on the account pool, off the close path; the poller safety-net catches misses."""
    try:
        order_id = None
        if isinstance(order_result, dict):
            order_id = order_result.get("orderId")
        realized_pnl, exit_price = (None, None)
        if order_id is not None:
            realized_pnl, exit_price = get_order_fill_summary(api, symbol, order_id)

        engine_client.post_json(
            "past-positions/sync",
            {
                "rows": [
                    {
                        "api_key": account["api_key"],
                        "uni_id": account.get("uni_id"),
                        "symbol": symbol,
                        "position_side": position_side,
                        "position_amt": closed_qty,
                        "entry_price": entry_price,
                        "exit_price": exit_price,
                        "realized_pnl": realized_pnl,
                        "side": "SELL" if position_side == "LONG" else "BUY",
                        "order_id": order_id if order_id is not None else 0,
                        "closed_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                        "strategy": strategy,
                    }
                ]
            },
        )
        _consume_strategy(account, symbol, position_side)
    except Exception:  # noqa: BLE001 - bookkeeping must never bubble into the pool
        log.exception("deferred close bookkeeping failed for %s %s", account.get("name"), symbol)


# --- Local JSONL log ----------------------------------------------------------

def _append_trade_log(entry: dict) -> None:
    try:
        with _TRADES_LOG_LOCK:
            with open(TRADES_LOG, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, default=str) + "\n")
    except OSError:
        log.exception("could not append %s", TRADES_LOG)


def _post_trade_log(summary: dict) -> None:
    """Fire the aggregate row at the engine API from the account pool."""
    _ACCOUNT_EXECUTOR.submit(engine_client.post_json, "trade-logs", summary)


# --- Per-account execution ----------------------------------------------------

def _run_account(
    account: dict,
    action: str,
    ticker: str,
    price: Optional[float],
    leverage: Optional[int],
    strategy: Optional[str],
    asset: Optional[dict],
    open_amounts: Optional[dict[str, float]],
) -> dict:
    """Execute one signal on one account. Returns a result dict with
    status: filled | skipped | failed (+ retryable flag on failures)."""
    name = account.get("name") or account.get("api_key", "")[:8]
    base = {"account": name, "uni_id": account.get("uni_id"), "status": "failed", "retryable": False}
    is_entry = action in ENTRY_ACTIONS
    symbol = ticker.upper()

    api = BinanceAPI(account["api_key"], account["secret_key"], base_url=account_futures_base_url(account))

    lock = symbol_locks.lock_for(account["api_key"], symbol)
    with lock:
        if is_entry:
            # asset presence/base_size already validated job-level (fail closed).
            quantity = _scale_qty(symbol, asset["base_size"], float(account.get("balance") or 0))
            if quantity <= 0:
                _bump("accounts_skipped")
                return base | {"status": "skipped", "reason": "size too small"}

            # Stack cap in whole increments: DB-first (batched), Binance fallback.
            max_increments = float(asset.get("max_increments") or 0)
            if max_increments > 0:
                position_side = "LONG" if action == "BUY" else "SHORT"
                if open_amounts is not None:
                    current = open_amounts.get(account["api_key"], 0.0)
                else:
                    current = _binance_open_amount(api, symbol, position_side)
                stacks_now = round(current / asset["base_size"], 4) if asset["base_size"] else 0.0
                if stacks_now + 1 > max_increments + 1e-9:
                    _bump("accounts_skipped")
                    return base | {"status": "skipped", "reason": "maxed sizing"}

            _maybe_set_leverage(api, symbol, leverage)
            result = handle_entry(api, symbol, "BUY" if action == "BUY" else "SELL", quantity, price)

            if result is None or result.get("result") is None:
                _bump("accounts_failed")
                retryable = bool(result and result.get("rate_limited"))
                return base | {
                    "error": (result or {}).get("error", "no response"),
                    "retryable": retryable,
                }

            position_side = "LONG" if action == "BUY" else "SHORT"
            new_amount = (open_amounts or {}).get(account["api_key"], 0.0) + quantity
            _upsert_position_api(account, symbol, position_side, new_amount, price)
            if strategy:
                _store_open_strategy(account, symbol, position_side, strategy)
            _bump("accounts_traded")
            return base | {"status": "filled", "quantity": quantity}

        # --- EXIT_LONG / EXIT_SHORT ------------------------------------------
        position_side = "LONG" if action == "EXIT_LONG" else "SHORT"
        result = handle_exit(api, symbol, position_side, price)

        if result is None:
            _bump("accounts_failed")
            return base | {"error": "no response"}
        if result.get("status", "").startswith("no "):
            _bump("accounts_skipped")
            return base | {"status": "skipped", "reason": result["status"]}
        if result.get("result") is None:
            _bump("accounts_failed")
            # Unconfirmed exits are safe to retry (reduce-only cannot overshoot).
            return base | {"error": result.get("error", "unknown"), "retryable": True}

        closed_qty = float(result.get("closed_quantity") or 0)
        entry_price = result.get("entry_price")
        tag = strategy or _recover_strategy(account, symbol, position_side)
        _upsert_position_api(account, symbol, position_side, 0.0, None)
        _ACCOUNT_EXECUTOR.submit(
            _deferred_close_bookkeeping,
            account, api, symbol, position_side, closed_qty, entry_price, tag, result.get("result"),
        )
        _bump("accounts_traded")
        return base | {"status": "filled", "closed_quantity": closed_qty}


# --- Job (one signal, all accounts) -------------------------------------------

def _process_trade_job(
    action: str,
    ticker: str,
    price: Optional[float],
    leverage: Optional[int],
    strategy: Optional[str],
    target_uni_ids: Optional[set[str]] = None,
    is_retry: bool = False,
) -> dict:
    """Runs on the dispatch pool. Fans the signal out to every account."""
    started = time.time()
    symbol = ticker.upper()
    is_entry = action in ENTRY_ACTIONS

    asset = get_asset(symbol)
    if is_entry:
        # FAIL CLOSED: entries need an enabled asset row with a base size.
        if asset is None:
            summary = _reject_summary(action, symbol, price, strategy, leverage, "asset_not_configured")
            _finish_job(summary, [], started)
            return summary
        if not asset.get("base_size"):
            summary = _reject_summary(action, symbol, price, strategy, leverage, "asset_misconfigured_base_size")
            _finish_job(summary, [], started)
            return summary
        # Directional gate from the asset's side column (ALL | LONG | SHORT).
        allowed = asset.get("side", "ALL")
        wanted = "LONG" if action == "BUY" else "SHORT"
        if allowed not in ("ALL", wanted):
            summary = _reject_summary(action, symbol, price, strategy, leverage, f"side_{allowed}_blocks_{action}")
            _finish_job(summary, [], started)
            return summary

    accounts = fetch_accounts()
    if target_uni_ids is not None:
        accounts = [a for a in accounts if a.get("uni_id") in target_uni_ids]
    if not accounts:
        summary = _reject_summary(action, symbol, price, strategy, leverage, "no_accounts")
        _finish_job(summary, [], started)
        return summary

    open_amounts = None
    if is_entry:
        position_side = "LONG" if action == "BUY" else "SHORT"
        open_amounts = _fetch_open_amounts(symbol, position_side)  # one batched call
        if open_amounts is None:
            log.warning("engine positions/check unavailable — per-account Binance fallback")

    futures = {
        _ACCOUNT_EXECUTOR.submit(
            _run_account, account, action, symbol, price, leverage, strategy, asset, open_amounts
        ): account
        for account in accounts
    }
    results = []
    for future in as_completed(futures):
        account = futures[future]
        try:
            results.append(future.result())
        except Exception as exc:  # noqa: BLE001 - one account must never kill the job
            log.exception("account task crashed for %s", account.get("name"))
            _bump("accounts_failed")
            results.append({
                "account": account.get("name"),
                "uni_id": account.get("uni_id"),
                "status": "failed",
                "error": f"crash: {exc}",
                "retryable": False,
            })

    filled = sum(1 for r in results if r["status"] == "filled")
    failed = sum(1 for r in results if r["status"] == "failed")
    skipped = sum(1 for r in results if r["status"] == "skipped")

    summary = {
        "action": action,
        "ticker": symbol,
        "success": filled > 0 and failed == 0,
        "price": price,
        "strategy": strategy,
        "leverage": leverage,
        "category": "retry" if is_retry else "signal",
        "target_count": len(accounts),
        "filled": filled,
        "failed": failed,
        "skipped": skipped,
        "details": results,
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    }
    _finish_job(summary, results, started)

    # Hand retryable failures to the retry queue (entries: only rate-limited
    # ones — an unconfirmed entry retried blind could double a position).
    retry_ids = [r["uni_id"] for r in results if r["status"] == "failed" and r.get("retryable") and r.get("uni_id")]
    if retry_ids and not is_retry:
        from binance_abcd.retry_queue import enqueue_retry  # local import: avoid cycle

        enqueue_retry(action, symbol, price, leverage, strategy, retry_ids)

    return summary


def _reject_summary(action: str, symbol: str, price, strategy, leverage, reason: str) -> dict:
    log.warning("signal rejected: %s %s (%s)", action, symbol, reason)
    return {
        "action": action,
        "ticker": symbol,
        "success": False,
        "price": price,
        "strategy": strategy,
        "leverage": leverage,
        "category": "rejected",
        "target_count": 0,
        "filled": 0,
        "failed": 0,
        "skipped": 0,
        "details": [{"reason": reason}],
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    }


def _finish_job(summary: dict, results: list, started: float) -> None:
    _bump("jobs_done")
    summary_local = summary | {"elapsed_s": round(time.time() - started, 3)}
    _append_trade_log(summary_local)
    _post_trade_log({k: v for k, v in summary.items()})
    log.info(
        "job done: %s %s -> filled=%s failed=%s skipped=%s in %.2fs",
        summary["action"], summary["ticker"], summary["filled"], summary["failed"], summary["skipped"],
        time.time() - started,
    )


# --- The route ----------------------------------------------------------------

@webhook_bp.route(WEBHOOK_PATH, methods=["POST"])
def binance_abcd_webhook():
    _bump("received")

    data = request.get_json(silent=True)
    if data is None:
        try:
            data = json.loads(request.get_data(as_text=True) or "{}")
        except (json.JSONDecodeError, TypeError):
            data = {}
    if not isinstance(data, dict):
        data = {}

    secret = str(data.get("secret") or request.args.get("secret") or request.form.get("secret") or "")
    if not WEBHOOK_SECRET or not hmac_mod.compare_digest(secret, WEBHOOK_SECRET):
        _bump("rejected")
        return jsonify({"error": "Unauthorized"}), 403

    action = str(data.get("action") or "").upper().strip()
    raw_ticker = str(data.get("symbol") or data.get("ticker") or "").strip()
    if raw_ticker.upper().startswith("BINANCE:"):
        raw_ticker = raw_ticker[len("BINANCE:"):]
    ticker = raw_ticker.upper()

    if action not in VALID_ACTIONS:
        _bump("rejected")
        return jsonify({"error": f"invalid action (expected one of {', '.join(VALID_ACTIONS)})"}), 400
    if not ticker:
        _bump("rejected")
        return jsonify({"error": "missing symbol/ticker"}), 400

    price: Optional[float] = None
    raw_price = data.get("price", data.get("close"))
    if raw_price not in (None, ""):
        try:
            price = float(raw_price)
        except (TypeError, ValueError):
            price = None

    leverage = _parse_leverage(data.get("leverage"))
    strategy = (str(data.get("strategy")).strip() or None) if data.get("strategy") else None
    target_uni_ids = _normalize_target_uni_ids(data.get("target_uni_ids"))

    _DISPATCH_EXECUTOR.submit(
        _process_trade_job, action, ticker, price, leverage, strategy, target_uni_ids
    )
    _bump("jobs_dispatched")

    response = {
        "accepted": True,
        "queued": True,
        "action": action,
        "ticker": ticker,
    }
    if price is not None:
        response["price"] = price
    if strategy:
        response["strategy"] = strategy
    if leverage is not None:
        response["leverage"] = leverage
    return jsonify(response), 200
