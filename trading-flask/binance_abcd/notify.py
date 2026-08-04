"""Telegram notifications for the BINANCE_ABCD engine.

Fire-and-forget: every send goes to a tiny background pool over the shared
pooled HTTP session, so a slow/DOWN Telegram never adds latency to the trade
path. Fully disabled unless a bot token AND a chat id are configured.

Two destinations (both optional, second falls back to the first):

  ``TELEGRAM_CHAT_ID``        public channel — entries, exits + PnL percent
  ``TELEGRAM_ADMIN_CHAT_ID``  ops alerts — rejected signals, account failures

The public channel is deliberately minimal: ticker, side, price, account counts
and — on a close — the realized PnL as a percentage. No leverage, no strategy
name, no USDT amounts.

Exits are announced ONCE per signal, not once per account. The realized PnL of
a close is only known after ``get_order_fill_summary`` reads userTrades, which
runs deferred per account — so a job opens an "exit batch" before the fan-out,
each account's bookkeeping reports into it, and the message is flushed when
every filled account has reported (or after ``TELEGRAM_PNL_WAIT_SECONDS``,
whichever comes first).

Config lives in ``hooks.py`` under ``BINANCE_ABCD_TELEGRAM_*`` and is read
through the ``hooks`` module (not `from`-imported) so it stays monkeypatchable.
"""

from __future__ import annotations

import html
import logging
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

from binance_abcd import hooks
from binance_abcd.http_client import get_session

log = logging.getLogger(__name__)

# Notifications are low volume and must never block a trade — two threads is plenty.
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="tg-notify")

# (emoji, label) per webhook action, worded as what the engine actually does.
_ACTION_LABEL = {
    "BUY": ("🟢", "Opening Long Positions"),
    "SELL": ("🔴", "Opening Short Positions"),
    "EXIT_LONG": ("🏁", "Closing Long Positions"),
    "EXIT_SHORT": ("🏁", "Closing Short Positions"),
}


# --- Formatting ---------------------------------------------------------------

def _esc(value: Any) -> str:
    return html.escape(str(value), quote=False)


def _fmt_price(price: Any) -> str:
    """Grouped thousands, 2 decimals — 109250.5 -> '109,250.50'. Sub-dollar
    tickers (DOGE at 0.14) keep 6 decimals so the price isn't rounded to '0.14'."""
    try:
        value = float(price)
    except (TypeError, ValueError):
        return _esc(price)
    return f"{value:,.6f}" if 0 < abs(value) < 1 else f"{value:,.2f}"


def _fmt_pct(value: Any) -> str:
    """Signed percent, 3 decimals. Normalizes -0.0 so a tiny loss never prints
    '-0.000%'. Empty string when not numeric (caller omits the line)."""
    try:
        pct = round(float(value), 3)
    except (TypeError, ValueError):
        return ""
    if pct == 0:
        pct = 0.0
    return f"{pct:+.3f}%"


def _accounts_line(filled: int, skipped: int, failed: int, verb: str) -> str:
    bits = [f"{filled} {verb}"]
    if skipped:
        bits.append(f"{skipped} skipped")
    if failed:
        bits.append(f"{failed} failed")
    return "Accounts: " + " · ".join(bits)


# --- Transport ----------------------------------------------------------------

def _enabled() -> bool:
    return bool(hooks.TELEGRAM_ENABLED and hooks.TELEGRAM_BOT_TOKEN and hooks.TELEGRAM_CHAT_ID)


def _admin_chat() -> str:
    return hooks.TELEGRAM_ADMIN_CHAT_ID or hooks.TELEGRAM_CHAT_ID


def _send_sync(text: str, chat_id: str) -> None:
    url = f"https://api.telegram.org/bot{hooks.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        response = get_session().post(url, json=payload, timeout=10)
        if not response.ok:
            log.warning("telegram send failed: %s %.200s", response.status_code, response.text)
    except Exception as exc:  # noqa: BLE001 - a notification must never raise
        log.warning("telegram send exception: %s", exc)


def _send(text: str, chat_id: Optional[str] = None) -> None:
    """Queue a message (no-op when notifications are off)."""
    if not _enabled():
        return
    target = chat_id or hooks.TELEGRAM_CHAT_ID
    try:
        _executor.submit(_send_sync, text, target)
    except RuntimeError:
        _send_sync(text, target)  # pool shut down (process exiting) — best effort


def _send_admin(text: str) -> None:
    _send(text, _admin_chat())


# --- Public: lifecycle --------------------------------------------------------

def notify_startup(account_count: Optional[int] = None, asset_count: Optional[int] = None) -> None:
    lines = ["🤖 <b>BINANCE_ABCD engine</b>", "✅ Online and ready"]
    if account_count is not None:
        lines.append(f"👤 {account_count} account{'' if account_count == 1 else 's'} tradeable")
    if asset_count is not None:
        lines.append(f"🎯 {asset_count} asset{'' if asset_count == 1 else 's'} enabled")
    _send("\n".join(lines))


# --- Public: entries ----------------------------------------------------------

def notify_entry(
    action: str,
    ticker: str,
    *,
    fill_price: Any = None,
    price: Any = None,
    filled: int = 0,
    skipped: int = 0,
    failed: int = 0,
) -> None:
    """One public message per BUY/SELL signal. Suppressed when nothing filled —
    an all-skipped fan-out (maxed sizing, size too small) is not news.

    Leverage and strategy are deliberately NOT published — the channel shows
    what was traded and at what price, never how the engine is configured."""
    if filled <= 0:
        return
    emoji, label = _ACTION_LABEL.get(action.upper(), ("📈", action))
    lines = [f"{emoji} <b>{label} — {_esc(ticker)}</b>"]

    shown = fill_price if fill_price is not None else price
    if shown:  # never render a 0/None price to the channel
        lines.append(f"Entry Price: {_fmt_price(shown)}")
    lines.append(_accounts_line(filled, skipped, failed, "filled"))
    _send("\n".join(lines))


# --- Public: exits + realized PnL ---------------------------------------------

class _ExitBatch:
    """One EXIT signal's pending Telegram message, collecting per-account PnL."""

    __slots__ = ("action", "ticker", "price", "reports", "sealed", "expected",
                 "skipped", "failed", "timer")

    def __init__(self, action: str, ticker: str, price: Any) -> None:
        self.action = action
        self.ticker = ticker
        self.price = price
        self.reports: list[dict] = []
        self.sealed = False
        self.expected = 0
        self.skipped = 0
        self.failed = 0
        self.timer: Optional[threading.Timer] = None


_batches: dict[str, _ExitBatch] = {}
_batch_lock = threading.Lock()


def open_exit_batch(action: str, ticker: str, *, price: Any = None) -> Optional[str]:
    """Start collecting an exit's per-account PnL. Call BEFORE the fan-out so no
    report can arrive before the batch exists. None when notifications are off."""
    if not _enabled():
        return None
    batch_id = uuid.uuid4().hex
    batch = _ExitBatch(action, ticker, price)
    with _batch_lock:
        _batches[batch_id] = batch
    timer = threading.Timer(hooks.TELEGRAM_PNL_WAIT_SECONDS, _flush_exit_batch, args=(batch_id,))
    timer.daemon = True
    batch.timer = timer
    timer.start()
    return batch_id


def report_exit_fill(
    batch_id: Optional[str],
    *,
    realized_pnl: Any = None,
    exit_price: Any = None,
    quantity: Any = None,
    balance: Any = None,
) -> None:
    """One closed account reporting in. Flushes as soon as the batch is sealed
    and every expected account has reported."""
    if not batch_id:
        return
    with _batch_lock:
        batch = _batches.get(batch_id)
        if batch is None:  # already flushed (timed out) — drop the late report
            return
        batch.reports.append({
            "pnl": realized_pnl,
            "exit_price": exit_price,
            "quantity": quantity,
            "balance": balance,
        })
        ready = batch.sealed and len(batch.reports) >= batch.expected
    if ready:
        _flush_exit_batch(batch_id)


def seal_exit_batch(batch_id: Optional[str], *, expected: int, skipped: int = 0, failed: int = 0) -> None:
    """Declare how many accounts will report. Discards the batch (no message)
    when nothing actually closed; flushes immediately if all reports are in."""
    if not batch_id:
        return
    with _batch_lock:
        batch = _batches.get(batch_id)
        if batch is None:
            return
        batch.sealed = True
        batch.expected = expected
        batch.skipped = skipped
        batch.failed = failed
        if expected <= 0:
            _batches.pop(batch_id, None)
            if batch.timer:
                batch.timer.cancel()
            return
        ready = len(batch.reports) >= expected
    if ready:
        _flush_exit_batch(batch_id)


def discard_exit_batch(batch_id: Optional[str]) -> None:
    """Drop a batch without sending (signal rejected before the fan-out)."""
    if not batch_id:
        return
    with _batch_lock:
        batch = _batches.pop(batch_id, None)
    if batch and batch.timer:
        batch.timer.cancel()


def _weighted(reports: list[dict], key: str) -> Optional[float]:
    """Quantity-weighted mean of `key` across reports that have both values,
    falling back to a plain mean when no quantities are known."""
    values = [(r[key], r.get("quantity")) for r in reports if r.get(key) is not None]
    if not values:
        return None
    total_qty = 0.0
    weighted = 0.0
    plain: list[float] = []
    for raw_value, raw_qty in values:
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        plain.append(value)
        try:
            qty = float(raw_qty)
        except (TypeError, ValueError):
            qty = 0.0
        if qty > 0:
            weighted += value * qty
            total_qty += qty
    if total_qty > 0:
        return weighted / total_qty
    return sum(plain) / len(plain) if plain else None


def _pnl_percent(reports: list[dict]) -> Optional[float]:
    """Realized PnL as a percent of the balance it was sized against.

    The denominator is `balance - pnl` per account — the balance BEFORE this
    close landed — summed across every account whose balance is known. Returns
    None when no account reported a PnL (or no balance to divide by): the
    channel publishes percentages only, never USDT amounts.
    """
    total = 0.0
    saw_pnl = False
    denom = 0.0
    for report in reports:
        try:
            pnl = float(report["pnl"])
        except (TypeError, ValueError, KeyError):
            continue
        total += pnl
        saw_pnl = True
        try:
            balance = float(report["balance"])
        except (TypeError, ValueError, KeyError):
            continue
        before = balance - pnl
        if before > 0:
            denom += before
    if not saw_pnl or denom <= 0:
        return None
    return total / denom * 100


def _flush_exit_batch(batch_id: str) -> None:
    """Render and send the batch's single message. Idempotent — the first caller
    (last report, or the watchdog timer) pops the batch and everyone else no-ops."""
    with _batch_lock:
        batch = _batches.pop(batch_id, None)
    if batch is None:
        return
    if batch.timer:
        batch.timer.cancel()

    emoji, label = _ACTION_LABEL.get(batch.action.upper(), ("🏁", batch.action))
    lines = [f"{emoji} <b>{label} — {_esc(batch.ticker)}</b>"]

    exit_price = _weighted(batch.reports, "exit_price")
    shown = exit_price if exit_price is not None else batch.price
    if shown:
        lines.append(f"Exit Price: {_fmt_price(shown)}")

    pct = _pnl_percent(batch.reports)
    if pct is not None:
        lines.append(f"PnL: {_fmt_pct(pct)}")

    closed = batch.expected if batch.sealed else len(batch.reports)
    lines.append(_accounts_line(closed, batch.skipped, batch.failed, "closed"))
    _send("\n".join(lines))


# --- Admin: operational alerts ------------------------------------------------

def notify_rejected(action: str, ticker: str, reason: str) -> None:
    """A signal never reached the fan-out (asset not configured, side gate, no accounts)."""
    _send_admin(
        f"⚠️ <b>Signal rejected</b> — {_esc(action)} {_esc(ticker)}\n"
        f"Reason: <code>{_esc(reason)}</code> — no order placed."
    )


def notify_account_failures(action: str, ticker: str, failures: list[tuple]) -> None:
    """One consolidated alert listing every account the exchange rejected.
    `failures` = list of (account_name, error)."""
    if not failures:
        return
    is_exit = action.upper().startswith("EXIT")
    if is_exit:
        head = "🔴 <b>EXIT FAILED — MANUAL ACTION REQUIRED</b>"
        sub = "positions may still be OPEN — check/close manually on:"
    else:
        head = "⚠️ <b>ENTRY REJECTED</b>"
        sub = "order not placed (out of sync with the rest) on:"
    lines = [head, f"{_esc(ticker)} ({_esc(action)}) — {sub}"]
    for name, error in failures[:20]:
        lines.append(f"  • {_esc(name)} — {_esc(error)}")
    if len(failures) > 20:
        lines.append(f"  … +{len(failures) - 20} more")
    lines.append(f"({len(failures)} account(s) affected)")
    _send_admin("\n".join(lines))


def notify_error(context: str, detail: str) -> None:
    """A hard operational error (poller crash, rate limit, job crash)."""
    _send_admin(f"❌ <b>Error</b> — {_esc(context)}\n{_esc(detail)}")
