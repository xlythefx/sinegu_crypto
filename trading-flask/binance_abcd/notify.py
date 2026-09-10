"""Telegram notifications for the BINANCE_ABCD engine.

Fire-and-forget: every send goes to a tiny background pool over the shared
pooled HTTP session, so a slow/DOWN Telegram never adds latency to the trade
path. Fully disabled unless a bot token AND a chat id are configured.

Two destinations (both optional, second falls back to the first):

  ``TELEGRAM_CHAT_ID``        public channel — entries, exits + PnL percent
  ``TELEGRAM_ADMIN_CHAT_ID``  ops alerts — rejected signals, account failures,
                              accounts already at their increment cap

The public channel is deliberately minimal: ticker, side, the exchange that
executed it, the stack depth this entry reached (``Increment (2/3)``), price,
and — on a close — the realized PnL as a percentage. No leverage, no strategy
name, no USDT amounts, and **no account counts**: how many customers filled is
business information, and the channel is readable by anyone. Operational counts
live in the trade log and, where they need a human, the admin channel.

The layout is shared with the ``binance-flask`` bot (``src/notify.py``) so the
two read identically when they publish into one channel — change one and change
the other. What differs by design is the source of the percentage: that bot
bills a master account, this engine has none and aggregates across every filled
account, so the same ``PnL:`` line will not carry the same number.

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

# Exchange shown on every public signal header. Several bots publish into one
# channel, so the header has to name which exchange actually executed the trade.
BROKER_LABEL = "Binance"

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


def _increment_line(increment: Any, max_increments: Any, label: str = "Increment") -> str:
    """Stack depth for the public channel: 'Increment (2/3)' when the cap is
    known, 'Increment (#2)' when the asset has no cap configured. Empty string
    when the depth could not be derived — the caller omits the line entirely
    rather than publishing a guess."""
    try:
        count = int(increment)
    except (TypeError, ValueError):
        return ""
    if count < 1:
        return ""
    try:
        limit = int(max_increments)
    except (TypeError, ValueError):
        limit = 0
    return f"{label} ({count}/{limit})" if limit > 0 else f"{label} (#{count})"


def _header(action: str, ticker: str, default_emoji: str = "📈") -> str:
    """The one headline every public signal opens with: what was done, to which
    ticker, on which exchange."""
    emoji, label = _ACTION_LABEL.get(action.upper(), (default_emoji, action))
    return f"{emoji} <b>{label} — {_esc(ticker)} · {_esc(BROKER_LABEL)}</b>"


def _modal(values: list) -> Any:
    """Most common value, ties broken toward the larger. Used to pick the one
    depth a whole fan-out publishes — accounts normally agree, and the mode
    stops a single out-of-step account from deciding what the channel says."""
    present = [v for v in values if v]
    if not present:
        return None
    return sorted(present, key=lambda v: (present.count(v), v), reverse=True)[0]


def _increment_bar(count: int, limit: int) -> str:
    """🟢 per filled increment, ⚪ per remaining slot. Admin channel only —
    the public channel gets the plain '2/3' with no bar."""
    if limit <= 0:
        return ""
    return "🟢" * min(count, limit) + "⚪" * max(limit - count, 0)


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
    """The engine came up — a deploy, a manual restart, or a crash systemd
    recovered (the unit is ``Restart=always``, so this fires on every one).

    Goes to the ADMIN chat, not the public channel, for two reasons: it is an
    ops event nobody following the trades needs, and the counts it carries are
    account data, which by this module's own rule never goes somewhere the
    whole internet can read.
    """
    lines = ["♻️ <b>BINANCE_ABCD engine restarted</b>", "✅ Online and ready"]
    if account_count is not None:
        lines.append(f"👤 {account_count} account{'' if account_count == 1 else 's'} tradeable")
    if asset_count is not None:
        lines.append(f"🎯 {asset_count} asset{'' if asset_count == 1 else 's'} enabled")
    _send_admin("\n".join(lines))


# --- Public: entries ----------------------------------------------------------

def notify_entry(
    action: str,
    ticker: str,
    *,
    fill_price: Any = None,
    price: Any = None,
    filled: int = 0,
    increment: Any = None,
    max_increments: Any = None,
) -> None:
    """One public message per BUY/SELL signal. Suppressed when nothing filled —
    an all-skipped fan-out (maxed sizing, size too small) is not news.

    Three lines at most: what was traded, how deep the stack now is, and the
    executed price. Leverage, strategy and ACCOUNT COUNTS are deliberately NOT
    published — how many customers filled is business information, and the
    channel is public. Operational counts live in the trade log and the admin
    channel instead."""
    if filled <= 0:
        return
    lines = [_header(action, ticker)]

    depth = _increment_line(increment, max_increments)
    if depth:
        lines.append(depth)

    shown = fill_price if fill_price is not None else price
    if shown:  # never render a 0/None price to the channel
        lines.append(f"Entry Price: {_fmt_price(shown)}")
    _send("\n".join(lines))


# --- Public: exits + realized PnL ---------------------------------------------

class _ExitBatch:
    """One EXIT signal's pending Telegram message, collecting per-account PnL."""

    __slots__ = ("action", "ticker", "price", "reports", "sealed", "expected", "timer")

    def __init__(self, action: str, ticker: str, price: Any) -> None:
        self.action = action
        self.ticker = ticker
        self.price = price
        self.reports: list[dict] = []
        self.sealed = False
        self.expected = 0
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
    increments: Any = None,
    max_increments: Any = None,
) -> None:
    """One closed account reporting in. Flushes as soon as the batch is sealed
    and every expected account has reported.

    `increments` is how many of THIS account's entry-sized units the closed
    position was worth — the exit-side mirror of the entry's stack depth.
    """
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
            "increments": increments,
            "max_increments": max_increments,
        })
        ready = batch.sealed and len(batch.reports) >= batch.expected
    if ready:
        _flush_exit_batch(batch_id)


def seal_exit_batch(batch_id: Optional[str], *, expected: int) -> None:
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

    lines = [_header(batch.action, batch.ticker, default_emoji="🏁")]

    # How deep the stack was that just closed — the mirror of the entry line.
    depth = _increment_line(
        _modal([r.get("increments") for r in batch.reports]),
        _modal([r.get("max_increments") for r in batch.reports]),
        label="Increments Closed",
    )
    if depth:
        lines.append(depth)

    exit_price = _weighted(batch.reports, "exit_price")
    shown = exit_price if exit_price is not None else batch.price
    if shown:
        lines.append(f"Exit Price: {_fmt_price(shown)}")

    pct = _pnl_percent(batch.reports)
    if pct is not None:
        lines.append(f"PnL: {_fmt_pct(pct)}")

    _send("\n".join(lines))


# --- Public: scheduled performance reports ------------------------------------

_REPORT_META = {
    "daily": ("📅", "Daily Report"),
    "weekly": ("🗓", "Weekly Report"),
    "monthly": ("🏆", "Monthly Report"),
}

_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _parse_iso_day(value: Any) -> Optional[tuple]:
    """('2026-09-06') -> (2026, 9, 6); None for anything else."""
    try:
        year, month, day = (int(part) for part in str(value).split("-"))
    except (TypeError, ValueError):
        return None
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return year, month, day


def _fmt_day_range(start: Any, end: Any) -> str:
    """'6 Sep 2026' for one day, '1 - 29 Sep 2026' inside a month, '31 Aug -
    6 Sep 2026' across one. Falls back to the raw strings if either is unparseable
    — a report with an odd-looking heading still beats no report."""
    first, last = _parse_iso_day(start), _parse_iso_day(end)
    if not first or not last:
        return f"{_esc(start)} - {_esc(end)}"
    fy, fm, fd = first
    ly, lm, ld = last
    if first == last:
        return f"{fd} {_MONTHS[fm - 1]} {fy}"
    if (fy, fm) == (ly, lm):
        return f"{fd} - {ld} {_MONTHS[lm - 1]} {ly}"
    head = f"{fd} {_MONTHS[fm - 1]}" + (f" {fy}" if fy != ly else "")
    return f"{head} - {ld} {_MONTHS[lm - 1]} {ly}"


def notify_report(kind: str, summary: dict) -> None:
    """A scheduled daily/weekly/monthly recap for the PUBLIC channel.

    Same privacy rule as every other public message, and here it is structural
    rather than remembered: `summary` is built by ``reports.py`` out of
    ``/api/public/track-record``, which is world-readable already — so there is
    no balance, no USD amount, no account count and no name available to print
    even by mistake. What ships is a percentage return, counts of TRADES and
    trading days, and the all-time figure as of the end of the period.

    A window with no priced day says so ("No trades closed") rather than
    publishing "+0.000%": a quiet week and a flat week are different claims, and
    staying silent instead would make the bot look broken.
    """
    emoji, label = _REPORT_META.get(kind, ("📊", "Performance Report"))
    lines = [
        f"{emoji} <b>{label} — {_fmt_day_range(summary.get('start'), summary.get('end'))}</b>",
        "",
    ]

    if summary.get("trading_days"):
        lines.append(f"Return: <b>{_fmt_pct(summary.get('return_pct'))}</b>")
        if kind != "daily":
            days = summary.get("trading_days", 0)
            lines.append(
                f"Trading days: {days} "
                f"({summary.get('winning_days', 0)} up / {summary.get('losing_days', 0)} down)"
            )
        trades = summary.get("trades", 0)
        lines.append(f"Trades closed: {trades}")
        best, worst = summary.get("best_pct"), summary.get("worst_pct")
        # Only once there are two days to compare — on a single trading day the
        # best and the worst are both just the return already printed above.
        if kind != "daily" and best is not None and summary.get("trading_days", 0) > 1:
            lines.append(f"Best day: {_fmt_pct(best)} · Worst day: {_fmt_pct(worst)}")
    else:
        lines.append("No trades closed.")

    all_time = summary.get("all_time_pct")
    if all_time is not None:
        lines.append(f"All-time: {_fmt_pct(all_time)}")

    _send("\n".join(lines))


# --- Admin: operational alerts ------------------------------------------------

def notify_rejected(action: str, ticker: str, reason: str) -> None:
    """A signal never reached the fan-out (asset not configured, side gate, no accounts)."""
    _send_admin(
        f"⚠️ <b>Signal rejected</b> — {_esc(action)} {_esc(ticker)}\n"
        f"Reason: <code>{_esc(reason)}</code> — no order placed."
    )


def notify_account_failures(
    action: str, ticker: str, failures: list[tuple], *, retrying: bool = False
) -> None:
    """One consolidated alert listing every account the exchange rejected.
    `failures` = list of (account_name, error).

    `retrying=True` when the retry queue has already taken these accounts: the
    close is UNCONFIRMED, not abandoned, and the engine re-places it on its own.
    The red MANUAL ACTION wording is reserved for a failure nobody is going to
    fix — a non-transient rejection here, or `notify_retry_abandoned` once the
    attempts run out. An alert that cries wolf on every exchange timeout is an
    alert that stops being read, which costs exactly the real one.
    """
    if not failures:
        return
    is_exit = action.upper().startswith("EXIT")
    if retrying:
        head = "⏳ <b>EXIT UNCONFIRMED — RETRYING</b>" if is_exit else "⏳ <b>ENTRY DELAYED — RETRYING</b>"
        sub = ("the exchange did not confirm the close on:" if is_exit
               else "the order has not been placed yet on:")
    elif is_exit:
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
    if retrying:
        lines.append(
            f"Retrying every {int(hooks.RETRY_INTERVAL_SECONDS)}s, up to "
            f"{hooks.RETRY_MAX_ATTEMPTS} attempts — a red alert follows only if they all fail."
        )
    _send_admin("\n".join(lines))


def notify_retry_abandoned(action: str, ticker: str, uni_ids: list, attempts: int) -> None:
    """The engine has STOPPED retrying — the one moment a human is actually
    needed, and until now it was a log line nobody reads.

    Sent both when the attempts run out and when a retry run hits a failure
    that is no longer worth repeating. Identifies users by uni_id rather than
    account name because this far from the fan-out the queue carries ids, not
    accounts.
    """
    if not uni_ids:
        return
    is_exit = action.upper().startswith("EXIT")
    if is_exit:
        head = "🔴 <b>EXIT FAILED — MANUAL ACTION REQUIRED</b>"
        sub = f"gave up after {attempts} attempt(s) — positions may still be OPEN for:"
    else:
        head = "⚠️ <b>ENTRY ABANDONED</b>"
        sub = f"gave up after {attempts} attempt(s) — no order was placed for:"
    lines = [head, f"{_esc(ticker)} ({_esc(action)}) — {sub}"]
    for uni_id in list(uni_ids)[:20]:
        lines.append(f"  • user <code>{_esc(uni_id)}</code>")
    if len(uni_ids) > 20:
        lines.append(f"  … +{len(uni_ids) - 20} more")
    lines.append(f"({len(uni_ids)} account(s) affected)")
    _send_admin("\n".join(lines))


def notify_max_increments(action: str, ticker: str, entries: list[tuple]) -> None:
    """Calm ADMIN note: accounts whose same-side position is already at its
    `max_increments` cap, so this add placed nothing.

    Not a failure and never retried — the intended exposure is already on. It
    goes to the admin channel rather than the public one for the same reason
    the account counts came off the entry message: it is operational detail,
    and a trader seeing "no add placed" would read it as a missed trade.

    `entries` = list of (account_name, increment, max_increments); increment
    may be None when the depth could not be derived, and then the line just
    says the account is already at its cap.
    """
    if not entries:
        return
    lines = [f"📊 <b>Max increments reached — {_esc(ticker)} ({_esc(action)})</b>"]
    for name, inc, limit in entries[:20]:
        try:
            count, cap = int(inc), int(limit)
        except (TypeError, ValueError):
            lines.append(f"  • {_esc(name)} — already at max · no add placed")
            continue
        if cap > 0:
            lines.append(f"  • {_esc(name)} — {count}/{cap} {_increment_bar(count, cap)} · no add placed")
        else:
            lines.append(f"  • {_esc(name)} — at increment #{count} (max) · no add placed")
    if len(entries) > 20:
        lines.append(f"  … +{len(entries) - 20} more")
    lines.append(f"({len(entries)} account(s) affected)")
    _send_admin("\n".join(lines))


def notify_error(context: str, detail: str) -> None:
    """A hard operational error (poller crash, rate limit, job crash)."""
    _send_admin(f"❌ <b>Error</b> — {_esc(context)}\n{_esc(detail)}")
