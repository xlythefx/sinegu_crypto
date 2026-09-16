"""POST /binance_abcd_webhook — the trade path.

Fast-ACK design: the request handler only validates (secret, action, ticker)
and enqueues a job on the dispatch pool, answering TradingView in milliseconds.
The job runs PER EXCHANGE — each enabled venue resolves its own asset row and
its own accounts — then fans out one task per account on the shared account
pool (the global in-flight ceiling). Per-(exchange, api_key, symbol) locks
serialize overlapping signals for the same account; retryable failures go to
the retry queue keyed by exchange + uni_id. One alert is sent to TradingView's
one webhook; every exchange sees every signal.
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
from typing import Any, Optional, Sequence

from flask import Blueprint, jsonify, request

from binance_abcd import engine_client, notify, symbol_locks
from binance_abcd.accounts_api import fetch_accounts
from binance_abcd.assets_api import get_asset
from binance_abcd.exchange_api import ExchangeClient
from binance_abcd.exchanges import client_for, exchange_of, label, labels, tradeable
from binance_abcd.exchanges import enabled as enabled_exchanges
from binance_abcd.hooks import (
    BOOKKEEPING_WORKERS,
    COARSE_STEP_TICKERS,
    DISPATCH_WORKERS,
    FANOUT_WORKERS,
    LEVERAGE_CACHE_TTL,
    MIN_DEPOSIT,
    OUT_DIR,
    REFERENCE_BALANCE,
    RETRY_ENABLED,
    WEBHOOK_PATHS,
    WEBHOOK_SECRET,
)
from binance_abcd.trading_handler import (
    get_order_fill_summary,
    handle_entry,
    handle_exit,
    position_risk_map,
)

log = logging.getLogger(__name__)

webhook_bp = Blueprint("abcd_webhook", __name__)

VALID_ACTIONS = ("BUY", "SELL", "EXIT_LONG", "EXIT_SHORT")
ENTRY_ACTIONS = ("BUY", "SELL")
# Ticker prefixes TradingView adds when the chart is on that venue.
_TICKER_PREFIXES = ("BINANCE:", "MEXC:")

_DISPATCH_EXECUTOR = ThreadPoolExecutor(max_workers=DISPATCH_WORKERS, thread_name_prefix="dispatch")
_ACCOUNT_EXECUTOR = ThreadPoolExecutor(max_workers=FANOUT_WORKERS, thread_name_prefix="account")
# Post-close bookkeeping only. Separate from the fan-out pool because the fill
# summary now sleeps between retries, and a whole fan-out closing at once would
# otherwise park every account worker on a sleep while the next signal waits.
_BOOKKEEPING_EXECUTOR = ThreadPoolExecutor(max_workers=BOOKKEEPING_WORKERS, thread_name_prefix="bookkeep")

TRADES_LOG = OUT_DIR / "webhook_trades.log"
_TRADES_LOG_LOCK = threading.Lock()

# Last leverage applied per (exchange, api_key, symbol) -> (leverage, epoch).
# Saves one POST /fapi/v1/leverage per account per signal when the value
# hasn't changed.
_LEVERAGE_APPLIED: dict[tuple[str, str, str], tuple[int, float]] = {}
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

    balance < REFERENCE_BALANCE -> base_size as-is; coarse tickers (BTCUSDT)
    step in whole base_size multiples per reference block; everything else
    scales in base_size/10 steps, floored. REFERENCE_BALANCE is env-driven and
    defaults to 1000 (this docstring said 500 until 2026-08-13, which was never
    the value the code used).
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


def _total_deposit(account: dict) -> Optional[float]:
    """Capital the account has been funded with, net of withdrawals.

    Falls back to initial_deposit when the backend predates `total_deposit`;
    None means unknown, which the deposit gate treats as ineligible.
    """
    for key in ("total_deposit", "initial_deposit"):
        raw = account.get(key)
        if raw in (None, ""):
            continue
        try:
            return float(raw)
        except (TypeError, ValueError):
            continue
    return None


def _deposit_gate(account: dict) -> tuple[bool, Optional[float]]:
    """(may_enter, total_deposit) for MIN_DEPOSIT.

    FAILS CLOSED: an unknown deposit blocks entries, same as an unconfigured
    asset does. A never-polled or underfunded account must not open positions.
    """
    deposit = _total_deposit(account)
    if MIN_DEPOSIT <= 0:
        return True, deposit
    if deposit is None:
        return False, None
    return deposit + 1e-9 >= MIN_DEPOSIT, deposit


def _parse_leverage(raw: Any) -> Optional[int]:
    if raw in (None, ""):
        return None
    try:
        lev = int(float(raw))
    except (TypeError, ValueError):
        return None
    return max(1, min(125, lev))


def _maybe_set_leverage(api: ExchangeClient, symbol: str, leverage: Optional[int]) -> None:
    """set_leverage only when the cached last-applied value differs.

    A venue that takes leverage ON the order (MEXC) has nothing to cache: the
    adapter just remembers the value for the entry it is about to place.
    """
    if leverage is None:
        return
    if api.LEVERAGE_PER_ORDER:
        api.set_leverage(symbol, leverage)
        return
    key = (api.exchange, api.api_key, symbol.upper())
    now = time.time()
    with _LEVERAGE_LOCK:
        cached = _LEVERAGE_APPLIED.get(key)
        if cached and cached[0] == leverage and (now - cached[1]) < LEVERAGE_CACHE_TTL:
            return
    result = api.set_leverage(symbol, leverage)
    if isinstance(result, dict) and result.get("_error"):
        log.warning("[%s] set_leverage %sx %s failed: %.200s", api.exchange, leverage, symbol, result.get("response"))
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


def _normalize_exchanges(raw: Any) -> tuple[Optional[list[str]], Optional[str]]:
    """Payload `exchanges` (CSV or list) -> (subset of the enabled exchanges,
    error). None means "every enabled exchange". A name that is unknown or not
    enabled on this box is an error, not a silent no-op: an admin restricting a
    manual trade to one venue must be told when that venue is not there."""
    if raw in (None, "", []):
        return None, None
    if isinstance(raw, str):
        names = [part.strip().lower() for part in raw.split(",") if part.strip()]
    elif isinstance(raw, (list, tuple)):
        names = [str(part).strip().lower() for part in raw if str(part).strip()]
    else:
        return None, "exchanges must be a list or comma-separated string"
    if not names:
        return None, None
    live = enabled_exchanges()
    unknown = [n for n in names if n not in live]
    if unknown:
        return None, f"unknown or disabled exchange: {', '.join(unknown)} (enabled: {', '.join(live)})"
    return list(dict.fromkeys(names)), None


# --- Stack cap (batched, DB-first) --------------------------------------------

def _fetch_open_amounts(symbol: str, position_side: str, exchange: str) -> Optional[dict[str, float]]:
    """One engine-API call: api_key -> abs(open amount) for symbol+side on one
    exchange. None when the backend is unreachable (callers fall back to the
    venue's own read)."""
    data = engine_client.get_json(
        "positions/check", params={"symbol": symbol.upper(), "position_side": position_side}, exchange=exchange
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
    engine_client.post_json("positions/upsert", payload, exchange=exchange_of(account))


def _store_open_strategy(account: dict, symbol: str, position_side: str, strategy: str) -> None:
    engine_client.post_json(
        "open-strategies",
        {"api_key": account["api_key"], "symbol": symbol, "position_side": position_side, "strategy": strategy},
        exchange=exchange_of(account),
    )


def _recover_strategy(account: dict, symbol: str, position_side: str) -> Optional[str]:
    data = engine_client.get_json(
        "open-strategies", params={"api_key": account["api_key"], "symbol": symbol}, exchange=exchange_of(account)
    )
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
        exchange=exchange_of(account),
    )


def _closed_increments(
    account: dict,
    asset: Optional[dict],
    symbol: str,
    closed_qty: float,
) -> tuple[Optional[int], Optional[int]]:
    """How many of THIS account's entry-sized units the closed position was
    worth, as (increments, cap) — the exit-side mirror of the entry's depth.

    The divisor is the SCALED entry size (`_scale_qty`), not the raw base_size,
    for exactly the reason the stack cap is measured that way: a 5,000 USDT
    account's entry is several base sizes, so dividing by base_size would report
    a 2-increment position as 10.

    Fail-soft everywhere — exits deliberately skip every asset gate, so a close
    must still work for a ticker whose asset row was disabled or deleted since
    the entry. No asset, no base size, or a zero scaled size just means the
    line is omitted from the message.

    Caveat worth knowing when reading a number back: the balance is today's, so
    a position opened before a large PnL swing is measured against a slightly
    different entry size than the one that opened it. Same approximation the
    entry-side `stacks_now` carries, and the reason this is rounded.
    """
    if not asset or closed_qty <= 0:
        return None, None
    try:
        base_size = float(asset.get("base_size") or 0)
        balance = float(account.get("balance") or 0)
    except (TypeError, ValueError):
        return None, None
    if base_size <= 0:
        return None, None
    unit = _scale_qty(symbol, base_size, balance)
    if unit <= 0:
        return None, None
    count = int(round(closed_qty / unit))
    if count < 1:  # closed less than one entry — still a real close, just not a stack
        count = 1
    cap = int(float(asset.get("max_increments") or 0)) or None
    return count, cap


def _deferred_close_bookkeeping(
    account: dict,
    api: ExchangeClient,
    symbol: str,
    position_side: str,
    closed_qty: float,
    entry_price: Optional[float],
    strategy: Optional[str],
    order_result: Any,
    exit_batch_id: Optional[str] = None,
    increments_closed: Optional[int] = None,
    max_increments: Optional[int] = None,
) -> None:
    """After a close: fill summary from the venue -> past-position row + strategy consume.
    Runs on the bookkeeping pool, off the close path; the poller safety-net catches misses.

    Also reports this account's realized PnL into the signal's Telegram exit
    batch — in a `finally` so a bookkeeping failure still releases the message
    instead of stalling it until the watchdog fires.
    """
    realized_pnl, exit_price = (None, None)
    try:
        order_id = None
        if isinstance(order_result, dict):
            order_id = order_result.get("orderId")
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
                        # The `Increments Closed (n/cap)` figure, kept on the row
                        # so the public trade count is increments, not close
                        # orders. Omitted (not null) when unknown: the API's
                        # null-fill leaves an earlier value untouched either way.
                        **({"increments_closed": increments_closed} if increments_closed else {}),
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
            exchange=exchange_of(account),
        )
        _consume_strategy(account, symbol, position_side)
    except Exception:  # noqa: BLE001 - bookkeeping must never bubble into the pool
        log.exception("deferred close bookkeeping failed for %s %s", account.get("name"), symbol)
    finally:
        notify.report_exit_fill(
            exit_batch_id,
            realized_pnl=realized_pnl,
            exit_price=exit_price,
            quantity=closed_qty,
            balance=account.get("balance"),
            increments=increments_closed,
            max_increments=max_increments,
        )


# --- Local JSONL log ----------------------------------------------------------

def _append_trade_log(entry: dict) -> None:
    try:
        with _TRADES_LOG_LOCK:
            with open(TRADES_LOG, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, default=str) + "\n")
    except OSError:
        log.exception("could not append %s", TRADES_LOG)


def _post_trade_log(summary: dict, exchange: str) -> None:
    """Fire one exchange's aggregate row at that exchange's trade-logs endpoint,
    from the account pool. `exchange` is the route segment; the row itself
    does not carry it (the API stamps it from the route)."""
    payload = {k: v for k, v in summary.items() if k != "exchange"}
    _ACCOUNT_EXECUTOR.submit(engine_client.post_json, "trade-logs", payload, exchange=exchange)


# --- Per-account execution ----------------------------------------------------

def _avg_fill_price(order_result: Any) -> Optional[float]:
    """The order's real executed price. Binance can answer avgPrice '0.00' on a
    filled market order (and MEXC's create response carries no price at all),
    so a non-positive or missing value is reported as unknown."""
    if not isinstance(order_result, dict):
        return None
    try:
        avg = float(order_result.get("avgPrice"))
    except (TypeError, ValueError):
        return None
    return avg if avg > 0 else None


def _position_entry_price(
    accounts: list, results: list, symbol: str, position_side: str
) -> Optional[float]:
    """The open position's entry price, read ONCE for a whole entry fan-out.

    Binance answers ``avgPrice`` "0.00" often enough on a filled MARKET order
    that the public alert would otherwise publish TradingView's signal price
    instead of the executed one — or, when the signal carried no price at all
    (the admin manual-trade console sends none), no ``Entry Price:`` line
    whatsoever. The position read carries the true post-fill entry price,
    which is the same fallback ``binance-flask`` reads for its master account.

    Read once per SIGNAL, not once per account: the channel publishes a single
    price and this is a weight-5 call, so spending it per account would put the
    poller budget behind a decoration. It is the entry price of the whole open
    position, so on a stacked entry it is the blended average rather than this
    fill alone — which is why it is consulted only when no account reported a
    real avgPrice. Fail-soft: None on any read error, and the caller keeps the
    signal price. With several exchanges, the first account that filled on any
    of them answers for all — the venues trade the same market.
    """
    by_key = {(exchange_of(a), a.get("uni_id")): a for a in accounts}
    account = next(
        (by_key[(r.get("exchange", "binance"), r["uni_id"])] for r in results
         if r.get("status") == "filled" and by_key.get((r.get("exchange", "binance"), r.get("uni_id")))),
        None,
    )
    if account is None:
        return None
    api = client_for(account)
    risk = position_risk_map(api, symbol)
    if not risk:  # None = unreadable, {} = flat — neither is a price
        return None
    _, entry = risk.get(position_side) or risk.get("BOTH") or (0.0, None)
    try:
        entry = float(entry)
    except (TypeError, ValueError):
        return None
    return entry if entry > 0 else None


def _run_account(
    account: dict,
    action: str,
    ticker: str,
    price: Optional[float],
    leverage: Optional[int],
    strategy: Optional[str],
    asset: Optional[dict],
    open_amounts: Optional[dict[str, float]],
    exit_batch_id: Optional[str] = None,
) -> dict:
    """Execute one signal on one account. Returns a result dict with
    status: filled | skipped | failed (+ retryable flag on failures)."""
    name = account.get("name") or account.get("api_key", "")[:8]
    exchange = exchange_of(account)
    base = {
        "account": name, "uni_id": account.get("uni_id"), "exchange": exchange,
        "status": "failed", "retryable": False,
    }
    is_entry = action in ENTRY_ACTIONS
    symbol = ticker.upper()

    # The one gate that applies to EXITS too: a row that can never be traded
    # on its venue (a MEXC account flagged demo — there is no MEXC testnet).
    # Nothing was ever opened through us on it, so there is nothing to close.
    untradeable = tradeable(account)
    if untradeable:
        _bump("accounts_skipped")
        return base | {"status": "skipped", "reason": untradeable}

    api = client_for(account)

    lock = symbol_locks.lock_for(account["api_key"], symbol, exchange)
    with lock:
        if is_entry:
            # The exchange itself refuses these credentials from our server
            # (Binance -2015 / MEXC 406: key invalid, our IP not allow-listed,
            # or a permission missing). Opening would burn an API call to be
            # told no, and the account has a disconnect deadline running.
            #
            # Entry-only, like every other gate here: an EXIT still tries. If
            # the user has since fixed their whitelist the exit goes through
            # and the success clears the flag — refusing to try would leave a
            # position open on an account we had written off.
            if account.get("key_blocked"):
                _bump("accounts_skipped")
                return base | {"status": "skipped", "reason": "api key blocked"}

            # Minimum-deposit gate, before any sizing work. Gated on deposited
            # capital, not balance, so a funded account keeps trading through a
            # drawdown. Exits never reach here — closing is always allowed.
            may_enter, total_deposit = _deposit_gate(account)
            if not may_enter:
                _bump("accounts_skipped")
                return base | {
                    "status": "skipped",
                    "reason": "deposit below minimum"
                    if total_deposit is not None
                    else "deposit unknown",
                    "sizing": {
                        "total_deposit": total_deposit,
                        "min_deposit": MIN_DEPOSIT,
                        "balance": float(account.get("balance") or 0),
                    },
                }

            # asset presence/base_size already validated job-level (fail closed).
            balance = float(account.get("balance") or 0)
            base_size = float(asset["base_size"])
            quantity = _scale_qty(symbol, base_size, balance)
            # Audit trail for the balance-proportional sizing: the INPUTS, not just
            # the answer, so any size (or skip) can be explained from the trade_logs
            # row alone without replaying the account's balance at signal time.
            sizing = {
                "balance": balance,
                "total_deposit": total_deposit,
                "min_deposit": MIN_DEPOSIT,
                "base_size": base_size,
                "reference_balance": REFERENCE_BALANCE,
                "coarse_step": symbol in COARSE_STEP_TICKERS,
                "quantity": quantity,
                "size_multiple": round(quantity / base_size, 6) if base_size else None,
                "stacks_now": None,
                # Two distinct numbers, deliberately both recorded: max_size is
                # the raw `assets.max_increments` COLUMN (position-size units),
                # max_increments is the entry COUNT derived from it. Storing only
                # the count would make a row unexplainable after someone edits
                # the asset; storing only the size repeats the confusion that
                # let the cap read "42 entries" for LTCUSDT.
                "max_size": float(asset.get("max_size") or 0),
                "max_increments": float(asset.get("max_increments") or 0),
            }
            if quantity <= 0:
                _bump("accounts_skipped")
                return base | {"status": "skipped", "reason": "size too small", "sizing": sizing}

            # Stack cap in whole increments: DB-first (batched), venue fallback.
            #
            # Measured in THIS ACCOUNT'S entry size (`quantity`), not the raw
            # base_size — so max_increments means "how many entries may stack",
            # the same number for everyone, and the exposure it allows scales
            # with the balance exactly as the entry does. Dividing by base_size
            # instead made the cap one fixed absolute size for every account:
            # anything from ~3x the reference balance up filled it with its
            # first entry and could never add.
            #
            # The divisor is the size THIS signal would open, so a balance that
            # moved since the earlier entries shifts the count slightly. That is
            # the intended reading: the cap is about exposure relative to what
            # the account trades today.
            position_side = "LONG" if action == "BUY" else "SHORT"
            max_increments = sizing["max_increments"]
            # `current` is resolved whenever it is already paid for: the batched
            # DB read covers the whole fan-out in one call, so the depth is free
            # even for an asset with no cap — and recording it makes an entry's
            # position in the stack explainable from the trade_logs row alone.
            # The per-account venue fallback is NOT spent just to decorate a
            # Telegram line: without the batch, only a real cap justifies it.
            current = None
            if open_amounts is not None:
                current = open_amounts.get(account["api_key"], 0.0)
            elif max_increments > 0:
                current = api.open_amount(symbol, position_side)

            stacks_now = None
            if current is not None:
                stacks_now = round(current / quantity, 4) if quantity else 0.0
                sizing["stacks_now"] = stacks_now
                if max_increments > 0 and stacks_now + 1 > max_increments + 1e-9:
                    _bump("accounts_skipped")
                    return base | {
                        "status": "skipped",
                        "reason": "maxed sizing",
                        "sizing": sizing,
                        # Depth this account is stuck at, for the admin note.
                        "increment": int(round(stacks_now)),
                        "max_increments": int(max_increments),
                    }
            elif max_increments > 0:
                # A cap is configured but the open size could not be read from
                # either source. Entering blind is how a stack walks past its
                # limit, so this fails closed — the same rule the asset and
                # deposit gates follow. Entry-only: exits never reach here, so
                # an unreadable account can still close what it holds.
                _bump("accounts_skipped")
                return base | {"status": "skipped", "reason": "stack depth unknown", "sizing": sizing}

            _maybe_set_leverage(api, symbol, leverage)
            result = handle_entry(api, symbol, "BUY" if action == "BUY" else "SELL", quantity, price)

            if result is None or result.get("result") is None:
                _bump("accounts_failed")
                # Entries retry ONLY when the request never reached the exchange
                # (a rate-limit backoff fails fast, before any order). A
                # timeout, by contrast, leaves the execution status unknown —
                # and an entry replayed blind is how one signal becomes two
                # positions. Exits are the opposite case: they re-read first.
                retryable = bool(result and result.get("rate_limited"))
                return base | {
                    "error": (result or {}).get("error", "no response"),
                    "retryable": retryable,
                    "sizing": sizing,
                }

            # The order's real executed price beats TradingView's `close` for the
            # snapshot: `price` is what the strategy saw, not what we paid. Still
            # only a hint — the positions poller overwrites it with the venue's
            # own entry price on the next tick.
            fill_price = _avg_fill_price(result.get("result"))
            new_amount = (open_amounts or {}).get(account["api_key"], 0.0) + quantity
            _upsert_position_api(account, symbol, position_side, new_amount, fill_price or price)
            if strategy:
                _store_open_strategy(account, symbol, position_side, strategy)
            _bump("accounts_traded")
            return base | {
                "status": "filled",
                "quantity": quantity,
                "fill_price": fill_price,
                "sizing": sizing,
                # Stack depth AFTER this fill: the pre-entry count plus this one.
                # Derived rather than re-read — the reference bot asks Binance for
                # the new position size per account per signal purely to print
                # this number, which is an API call per account we already have
                # the answer for.
                "increment": int(round(stacks_now)) + 1 if stacks_now is not None else None,
                "max_increments": int(max_increments) or None,
            }

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
            # Unconfirmed exits are safe to retry — every attempt re-reads the
            # position first, so a close that did land is seen as flat. But only
            # a TRANSIENT failure is worth repeating: a rejection (precision,
            # min notional, position-mode mismatch) answers the same way in 60s,
            # and marking it retryable is what buried a real problem under five
            # silent attempts before anyone was told.
            retryable = bool(result.get("transient") or result.get("rate_limited"))
            return base | {"error": result.get("error", "unknown"), "retryable": retryable}

        closed_qty = float(result.get("closed_quantity") or 0)
        entry_price = result.get("entry_price")
        tag = strategy or _recover_strategy(account, symbol, position_side)
        increments_closed, max_increments = _closed_increments(account, asset, symbol, closed_qty)
        _upsert_position_api(account, symbol, position_side, 0.0, None)
        _BOOKKEEPING_EXECUTOR.submit(
            _deferred_close_bookkeeping,
            account, api, symbol, position_side, closed_qty, entry_price, tag,
            result.get("result"), exit_batch_id,
            increments_closed, max_increments,
        )
        _bump("accounts_traded")
        return base | {
            "status": "filled",
            "closed_quantity": closed_qty,
            "increment": increments_closed,
            "max_increments": max_increments,
        }


# --- Job (one signal, all accounts, every exchange) ---------------------------

def _plan_exchange(
    exchange: str,
    action: str,
    symbol: str,
    uni_filter: Optional[set[str]],
) -> dict:
    """What one exchange will do with the signal.

    ``{"reject": reason}`` when an entry fails this venue's asset gate,
    ``{"empty": True}`` when it has no eligible accounts, otherwise the asset,
    the accounts and the batched open-amounts read. Each venue is planned on
    its own so a ticker not configured on MEXC cannot stop Binance trading it.
    """
    is_entry = action in ENTRY_ACTIONS
    asset = get_asset(symbol, exchange)
    if is_entry:
        # FAIL CLOSED: entries need an enabled asset row with a base size.
        if asset is None:
            return {"reject": "asset_not_configured"}
        if not asset.get("base_size"):
            return {"reject": "asset_misconfigured_base_size"}
        # Directional gate from the asset's side column (ALL | LONG | SHORT).
        allowed = asset.get("side", "ALL")
        wanted = "LONG" if action == "BUY" else "SHORT"
        if allowed not in ("ALL", wanted):
            return {"reject": f"side_{allowed}_blocks_{action}"}

    accounts = fetch_accounts(exchange=exchange)
    if uni_filter is not None:
        accounts = [a for a in accounts if a.get("uni_id") in uni_filter]
    if not accounts:
        return {"empty": True}

    open_amounts = None
    if is_entry:
        position_side = "LONG" if action == "BUY" else "SHORT"
        open_amounts = _fetch_open_amounts(symbol, position_side, exchange)  # one batched call
        if open_amounts is None:
            log.warning("[%s] engine positions/check unavailable — per-account venue fallback", exchange)
    return {"asset": asset, "accounts": accounts, "open_amounts": open_amounts}


def _process_trade_job(
    action: str,
    ticker: str,
    price: Optional[float],
    leverage: Optional[int],
    strategy: Optional[str],
    target_uni_ids: Optional[set[str]] = None,
    is_retry: bool = False,
    announce: bool = True,
    exchanges: Optional[Sequence[str]] = None,
    targets: Optional[dict[str, set[str]]] = None,
) -> dict:
    """Runs on the dispatch pool. Fans the signal out to every account on every
    exchange it applies to, and returns the MERGED summary.

    `exchanges` narrows a live signal to a subset of the enabled venues (the
    admin manual-trade console); `targets` is the retry queue's
    {exchange: uni_ids} — a user with accounts on two venues is only ever
    replayed on the one that failed. `target_uni_ids` is the payload's flat
    user filter and applies on every venue.

    `announce` is whether THIS run owes the public channel a message. A live run
    always does; a retry does only when the live run published nothing (every
    account failed), which is the case where the close would otherwise never
    reach the channel at all. The retry queue clears the flag as soon as any run
    fills, so one signal is never announced twice.
    """
    started = time.time()
    symbol = ticker.upper()
    is_entry = action in ENTRY_ACTIONS
    position_side = "LONG" if action in ("BUY", "EXIT_LONG") else "SHORT"

    live = enabled_exchanges()
    if targets:
        run = [ex for ex in live if ex in targets]
    else:
        run = [ex for ex in live if not exchanges or ex in exchanges]
    if not run:
        run = list(live)

    plans = {
        ex: _plan_exchange(ex, action, symbol, targets.get(ex) if targets else target_uni_ids)
        for ex in run
    }
    runnable = {ex: plan for ex, plan in plans.items() if "accounts" in plan}

    if not runnable:
        # Nothing ran anywhere: every venue rejected the entry or had no
        # accounts. One alert for the whole signal, one rejected row per venue.
        reasons = {ex: plans[ex].get("reject", "no_accounts") for ex in run}
        distinct = sorted(set(reasons.values()))
        reason_text = distinct[0] if len(distinct) == 1 else "; ".join(
            f"{label(ex)}: {reason}" for ex, reason in reasons.items()
        )
        log.warning("signal rejected: %s %s (%s)", action, symbol, reason_text)
        notify.notify_rejected(action, symbol, reason_text, label=labels(run))
        per_exchange = [
            _reject_summary(action, symbol, price, strategy, leverage, reasons[ex], ex) for ex in run
        ]
        merged = _merge_summaries(action, symbol, price, strategy, leverage, per_exchange, is_retry=is_retry)
        _finish_job(merged, per_exchange, started)
        return merged

    # Exits announce once, with realized PnL — opened BEFORE the fan-out so no
    # account's deferred bookkeeping can report into a batch that doesn't exist
    # yet. A retry opens one only when the live run published nothing, so a
    # close that took two attempts still reaches the channel exactly once.
    exit_batch_id = None
    if not is_entry and announce:
        exit_batch_id = notify.open_exit_batch(action, symbol, price=price)

    futures = {}
    for ex, plan in runnable.items():
        for account in plan["accounts"]:
            future = _ACCOUNT_EXECUTOR.submit(
                _run_account, account, action, symbol, price, leverage, strategy, plan["asset"],
                plan["open_amounts"], exit_batch_id,
            )
            futures[future] = account
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
                "exchange": exchange_of(account),
                "status": "failed",
                "error": f"crash: {exc}",
                "retryable": False,
            })

    filled = sum(1 for r in results if r["status"] == "filled")
    failed = sum(1 for r in results if r["status"] == "failed")
    skipped = sum(1 for r in results if r["status"] == "skipped")

    # The retry decision is made BEFORE the alert, because it decides what the
    # alert says: a red "MANUAL ACTION REQUIRED" for a timeout the queue clears
    # 60s later is how a real alert learns to be ignored.
    retrying: dict[str, set[str]] = {}
    if RETRY_ENABLED and not is_retry:
        for r in results:
            if r["status"] == "failed" and r.get("retryable") and r.get("uni_id"):
                retrying.setdefault(r.get("exchange", "binance"), set()).add(r["uni_id"])
        if retrying:
            from binance_abcd.retry_queue import enqueue_retry  # local import: avoid cycle

            enqueue_retry(
                action, symbol, price, leverage, strategy, retrying,
                # Nothing filled -> this run published nothing, so the retry
                # inherits the message.
                announce=(filled == 0),
            )

    # What the channel prints beside an entry, best source first: a real
    # avgPrice from any account that filled, then the position's own entry
    # price (one extra read, only when the venue withheld every avgPrice), and
    # the signal price last — which for a manual trade does not exist at all.
    fill_price = _mean_fill_price(results)
    if is_entry and announce and not is_retry and filled and fill_price is None:
        all_accounts = [a for plan in runnable.values() for a in plan["accounts"]]
        fill_price = _position_entry_price(all_accounts, results, symbol, position_side)

    filled_on = [ex for ex in runnable if any(r.get("exchange") == ex and r["status"] == "filled" for r in results)]
    _notify_job(action, symbol, price, results,
                filled=filled, failed=failed, skipped=skipped,
                exit_batch_id=exit_batch_id, is_retry=is_retry,
                retrying=retrying, fill_price=fill_price,
                venue_label=labels(filled_on or list(runnable)),
                name_venues=len(live) > 1)

    per_exchange = []
    for ex in run:
        if ex in runnable:
            per_exchange.append(_exchange_summary(
                action, symbol, price, strategy, leverage, ex, is_retry,
                [r for r in results if r.get("exchange") == ex],
                target_count=len(runnable[ex]["accounts"]),
            ))
        elif "reject" in plans[ex]:
            # This venue refused the entry while another traded it: its Signal
            # Log still records why, but nobody is paged for it.
            log.warning("[%s] signal rejected: %s %s (%s)", ex, action, symbol, plans[ex]["reject"])
            per_exchange.append(_reject_summary(action, symbol, price, strategy, leverage, plans[ex]["reject"], ex))
        # A venue with no eligible accounts while another ran is skipped
        # silently — enabling MEXC before its first account exists must not
        # write a rejected row per signal.

    merged = _merge_summaries(action, symbol, price, strategy, leverage, per_exchange, is_retry=is_retry)
    _finish_job(merged, per_exchange, started)
    return merged


def _exchange_summary(
    action: str, symbol: str, price, strategy, leverage, exchange: str, is_retry: bool,
    results: list, *, target_count: int,
) -> dict:
    """One venue's trade-logs row — today's exact shape plus `exchange`."""
    filled = sum(1 for r in results if r["status"] == "filled")
    failed = sum(1 for r in results if r["status"] == "failed")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    return {
        "action": action,
        "ticker": symbol,
        "success": filled > 0 and failed == 0,
        "price": price,
        "strategy": strategy,
        "leverage": leverage,
        "category": "retry" if is_retry else "signal",
        "target_count": target_count,
        "filled": filled,
        "failed": failed,
        "skipped": skipped,
        "details": results,
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "exchange": exchange,
    }


def _merge_summaries(action: str, symbol: str, price, strategy, leverage, per_exchange: list, *, is_retry: bool) -> dict:
    """The whole signal as one dict — what the retry queue and the local JSONL
    read. Counts are summed, `details` concatenated (every row carries its
    `exchange`), `category` is rejected only when NO venue ran it."""
    ran = [s for s in per_exchange if s["category"] != "rejected"]
    filled = sum(s["filled"] for s in per_exchange)
    failed = sum(s["failed"] for s in per_exchange)
    return {
        "action": action,
        "ticker": symbol,
        "success": filled > 0 and failed == 0,
        "price": price,
        "strategy": strategy,
        "leverage": leverage,
        "category": ("retry" if is_retry else "signal") if ran else "rejected",
        "target_count": sum(s["target_count"] for s in per_exchange),
        "filled": filled,
        "failed": failed,
        "skipped": sum(s["skipped"] for s in per_exchange),
        "details": [row for s in per_exchange for row in s["details"]],
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "exchanges": [s["exchange"] for s in per_exchange],
    }


def _mean_fill_price(results: list) -> Optional[float]:
    """Average executed price across the accounts that filled. Order-independent
    (as_completed is not deterministic) and None when no fill reported a price."""
    prices = [r["fill_price"] for r in results if r.get("fill_price")]
    return sum(prices) / len(prices) if prices else None


def _published_increment(results: list) -> tuple[Optional[int], Optional[int]]:
    """The stack depth to publish for a whole fan-out, as (increment, max).

    The reference bot shows the MASTER account's depth; this engine has no
    master in its account payload, so it publishes the most common depth among
    the accounts that filled. They all trade the same signal against the same
    per-asset cap, so they normally agree — the mode is what keeps one account
    that connected late (still at #1 while everyone else is at #3) from
    deciding what the channel says. Ties break toward the deeper count, since
    that is the one the cap is about.
    """
    depths = [r["increment"] for r in results
              if r.get("status") == "filled" and r.get("increment")]
    if not depths:
        return None, None
    ranked = sorted(depths, key=lambda d: (depths.count(d), d), reverse=True)
    winner = ranked[0]
    caps = [r["max_increments"] for r in results
            if r.get("status") == "filled" and r.get("increment") == winner
            and r.get("max_increments")]
    return winner, (caps[0] if caps else None)


def _account_label(row: dict, name_venues: bool) -> str:
    """'Live One (MEXC)' when more than one venue is enabled, else the bare name —
    admin alerts name accounts, and two venues can hold the same account name."""
    name = row.get("account")
    if not name_venues:
        return name
    return f"{name} ({label(row.get('exchange', 'binance'))})"


def _notify_job(
    action: str,
    symbol: str,
    price: Optional[float],
    results: list,
    *,
    filled: int,
    failed: int,
    skipped: int,
    exit_batch_id: Optional[str],
    is_retry: bool,
    retrying: dict[str, set[str]],
    fill_price: Optional[float] = None,
    venue_label: Optional[str] = None,
    name_venues: bool = False,
) -> None:
    """Telegram fan-out for one finished job. Never raises — a notification
    problem must not fail the trade job that already executed."""
    try:
        if exit_batch_id:
            # Releases the exit message once every closed account reports its PnL
            # (or discards it when nothing actually closed).
            notify.seal_exit_batch(exit_batch_id, expected=filled, label=venue_label)
        elif action in ENTRY_ACTIONS and not is_retry:
            increment, max_increments = _published_increment(results)
            notify.notify_entry(
                action, symbol,
                fill_price=fill_price if fill_price is not None else _mean_fill_price(results),
                price=price,
                filled=filled, increment=increment, max_increments=max_increments,
                label=venue_label,
            )
            # Accounts already at their cap: an add that placed nothing. Admin
            # only, and live runs only — a retry re-walks the same accounts and
            # would repeat the note every 60s.
            notify.notify_max_increments(
                action, symbol,
                [(_account_label(r, name_venues), r.get("increment"), r.get("max_increments"))
                 for r in results if r.get("reason") == "maxed sizing"],
            )
        if failed and not is_retry:
            # Two audiences, one fan-out: what the engine is about to re-place
            # itself, and what will stay broken until someone opens the exchange.
            # Sending both under one red headline is what made the real one
            # unreadable. Retry runs stay silent entirely — the queue reports
            # the ending, once, when there is one.
            failures = [r for r in results if r["status"] == "failed"]

            def _queued(r: dict) -> bool:
                return r.get("uni_id") in retrying.get(r.get("exchange", "binance"), set())

            notify.notify_account_failures(
                action, symbol,
                [(_account_label(r, name_venues), r.get("error") or "unknown") for r in failures
                 if not _queued(r)],
            )
            notify.notify_account_failures(
                action, symbol,
                [(_account_label(r, name_venues), r.get("error") or "unknown") for r in failures
                 if _queued(r)],
                retrying=True,
            )
    except Exception:  # noqa: BLE001
        log.exception("telegram notification failed for %s %s", action, symbol)


def _reject_summary(action: str, symbol: str, price, strategy, leverage, reason: str, exchange: str) -> dict:
    """One venue's rejected trade-logs row. Pure — the caller decides whether
    the rejection is worth an alert (only when NO venue ran the signal)."""
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
        "details": [{"reason": reason, "exchange": exchange}],
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "exchange": exchange,
    }


def _finish_job(merged: dict, per_exchange: list, started: float) -> None:
    """One JSONL line for the whole signal; one trade-logs POST per venue."""
    _bump("jobs_done")
    summary_local = merged | {"elapsed_s": round(time.time() - started, 3)}
    _append_trade_log(summary_local)
    for summary in per_exchange:
        _post_trade_log(summary, summary["exchange"])
    log.info(
        "job done: %s %s [%s] -> filled=%s failed=%s skipped=%s in %.2fs",
        merged["action"], merged["ticker"], ",".join(merged.get("exchanges") or []),
        merged["filled"], merged["failed"], merged["skipped"],
        time.time() - started,
    )


# --- The routes: one public path per venue -----------------------------------

# TradingView names perpetual contracts with a `.P` suffix (`MEXC:BTCUSDT.P`,
# `BINANCE:BTCUSDT.P`), and `{{ticker}}` carries it. The engine's asset rows
# and the venues' own symbols never do.
_PERP_SUFFIX = ".P"


def _normalize_ticker(raw: Any) -> str:
    """``MEXC:btcusdt.p`` -> ``BTCUSDT``: drop the chart's venue prefix and
    perpetual suffix, upper-case what is left. Empty when nothing was sent."""
    ticker = str(raw or "").strip().upper()
    for prefix in _TICKER_PREFIXES:
        if ticker.startswith(prefix):
            ticker = ticker[len(prefix):]
            break
    if ticker.endswith(_PERP_SUFFIX):
        ticker = ticker[: -len(_PERP_SUFFIX)]
    return ticker

def _handle_webhook(exchange: str):
    """The trade path for ONE venue. The path a TradingView alert posts to is
    what decides which exchange's accounts the signal trades — so each venue
    gets its own alert(s), nothing in the payload names it, and an alert can
    never fan out to a venue its author did not point it at."""
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

    # After the secret gate, so an unauthenticated probe learns nothing about
    # which venues this box runs.
    if exchange not in enabled_exchanges():
        _bump("rejected")
        return jsonify({"error": f"{exchange} is not enabled on this engine (BINANCE_ABCD_EXCHANGES)"}), 400

    action = str(data.get("action") or "").upper().strip()
    ticker = _normalize_ticker(data.get("symbol") or data.get("ticker"))

    if action not in VALID_ACTIONS:
        _bump("rejected")
        return jsonify({"error": f"invalid action (expected one of {', '.join(VALID_ACTIONS)})"}), 400
    if not ticker:
        _bump("rejected")
        return jsonify({"error": "missing symbol/ticker"}), 400

    # A payload may still name the venue (the admin console does); it just has
    # to agree with the path it was posted to. A mismatch is a misconfigured
    # alert, and trading the wrong venue silently is the worst answer to that.
    named, exchanges_error = _normalize_exchanges(data.get("exchanges"))
    if exchanges_error:
        _bump("rejected")
        return jsonify({"error": exchanges_error}), 400
    if named and named != [exchange]:
        _bump("rejected")
        return jsonify({"error": f"this webhook trades {exchange} only (payload named {', '.join(named)})"}), 400

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
        _process_trade_job, action, ticker, price, leverage, strategy, target_uni_ids,
        exchanges=[exchange],
    )
    _bump("jobs_dispatched")

    response = {
        "accepted": True,
        "queued": True,
        "action": action,
        "ticker": ticker,
        "exchange": exchange,
        "exchanges": [exchange],
    }
    if price is not None:
        response["price"] = price
    if strategy:
        response["strategy"] = strategy
    if leverage is not None:
        response["leverage"] = leverage
    return jsonify(response), 200


def _register_webhooks() -> None:
    """One Flask endpoint per venue, at that venue's path. Every known path is
    registered even when the venue is off, so a disabled venue answers a clear
    400 rather than nginx's 404 — the two look identical from TradingView."""
    for venue, path in WEBHOOK_PATHS.items():
        webhook_bp.add_url_rule(
            path,
            endpoint=f"{venue}_abcd_webhook",
            view_func=(lambda v: (lambda: _handle_webhook(v)))(venue),
            methods=["POST"],
        )


_register_webhooks()


def binance_abcd_webhook():
    """Kept for callers that import the original view by name."""
    return _handle_webhook("binance")
