"""Operator endpoints under /admin, guarded by the X-Admin-Secret HEADER.

The secret is hooks.ADMIN_SECRET — the engine's own admin token, not the
TradingView webhook secret (that one sits at TradingView, in every developer's
.env and in the API's .env; a box with no BINANCE_ABCD_ADMIN_SECRET still
falls back to it, and says so at startup). Header only: a ``?secret=`` in the
query string lands in nginx's access log and in every proxy log between.

refresh-balances is synchronous by design: the future monthly invoice
generator calls it and blocks until every balance is fresh before computing
fees (the reference project's billing wrapper does exactly this).
"""

from __future__ import annotations

import hmac as hmac_mod
import html
import re
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request

from binance_abcd import hooks
from binance_abcd.accounts_api import accounts_cache_age, invalidate_accounts_cache
from binance_abcd.assets_api import assets_cache_age, invalidate_assets_cache

admin_bp = Blueprint("abcd_admin", __name__, url_prefix="/admin")


def _authorized() -> bool:
    # Read through the module so a test can monkeypatch hooks.ADMIN_SECRET.
    secret = hooks.ADMIN_SECRET
    supplied = request.headers.get("X-Admin-Secret") or ""
    return bool(secret) and hmac_mod.compare_digest(str(supplied), secret)


@admin_bp.route("/refresh-accounts", methods=["POST"])
def refresh_accounts():
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 403
    invalidate_accounts_cache()
    return jsonify({"success": True, "message": "accounts cache invalidated"})


@admin_bp.route("/refresh-assets", methods=["POST"])
def refresh_assets():
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 403
    invalidate_assets_cache()
    return jsonify({"success": True, "message": "assets cache invalidated"})


@admin_bp.route("/refresh-balances", methods=["POST"])
def refresh_balances():
    """Sync balances now.

    An optional ``api_keys`` list narrows the run to those accounts — the
    trader "Refresh balance" button sends exactly one, so a person pressing it
    costs one Binance call rather than one per account on the platform. Omit it
    (the invoice generator's call) to sync everything.
    """
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 403
    from binance_abcd.fetch_balances import fetch_and_save  # deferred: poller pulls in accounts

    body = request.get_json(silent=True) or {}
    raw = body.get("api_keys")
    api_keys = [str(k) for k in raw if k] if isinstance(raw, list) else None
    if api_keys is not None and not api_keys:
        return jsonify({"error": "api_keys was empty"}), 400

    result = fetch_and_save(api_keys)
    return jsonify({"success": bool(result), "result": result, "scoped": api_keys is not None})


@admin_bp.route("/refresh-positions", methods=["POST"])
def refresh_positions():
    """Sync open positions now, instead of at the poller's next tick (300 s).

    Same contract as /refresh-balances: an optional ``api_keys`` list narrows
    the run, an empty list is refused rather than read as "everything". An
    account whose read fails keeps its rows (the poller's rule — a failed read
    is never synced as flat).
    """
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 403
    from binance_abcd.fetch_positions import fetch_and_save  # deferred: poller pulls in accounts

    body = request.get_json(silent=True) or {}
    raw = body.get("api_keys")
    api_keys = [str(k) for k in raw if k] if isinstance(raw, list) else None
    if api_keys is not None and not api_keys:
        return jsonify({"error": "api_keys was empty"}), 400

    result = fetch_and_save(api_keys)
    return jsonify({"success": bool(result), "result": result, "scoped": api_keys is not None})


@admin_bp.route("/ledger", methods=["POST"])
def account_ledger():
    """One account's full income ledger, reconciled to its wallet (ledger.py).

    READ-ONLY at the exchange and writes nothing anywhere: the API asks for
    this to preview a transfer backfill, and decides what to store itself.
    Body: ``{"api_key": "..."}``. Costs one weight-30 call per 1000 ledger
    rows, so it is an admin action, never a poller step on a healthy account.
    """
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 403
    from binance_abcd.accounts_api import fetch_accounts  # deferred: pulls in the http client
    from binance_abcd.exchanges import client_for, exchange_of

    api_key = str((request.get_json(silent=True) or {}).get("api_key") or "")
    if not api_key:
        return jsonify({"error": "api_key is required"}), 400
    account = next((a for a in fetch_accounts() if a.get("api_key") == api_key), None)
    if account is None:
        # Only accounts the engine may trade are known to it: enabled, not a
        # sandbox, owner not suspended.
        return jsonify({"error": "ACCOUNT_NOT_TRADED", "message": "The engine does not trade this account."}), 404
    client = client_for(account)
    if not hasattr(client, "ledger"):
        return jsonify({"error": "NOT_SUPPORTED", "message": f"No ledger read for {exchange_of(account)} yet."}), 400
    payload = client.ledger()
    if payload is None:
        return jsonify({"error": "LEDGER_UNAVAILABLE",
                        "message": "The exchange's history could not be read completely. Try again in a minute."}), 502
    return jsonify({"success": True, "exchange": exchange_of(account), "ledger": payload})


# Manual closes run on their own small pool, never the webhook's dispatch pool:
# an admin closing twenty positions must not delay the next TradingView signal.
_CLOSE_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="manual-close")
CLOSE_MAX_POSITIONS = 50
# How long the request waits for the closes to finish. Shorter than the API's
# own timeout so a slow close answers "still running" instead of a 504; the
# job keeps going either way.
CLOSE_WAIT_SECONDS = 40.0


@admin_bp.route("/close-positions", methods=["POST"])
def close_positions():
    """Close specific open positions now — Admin Dashboard → Open positions.

    Body: ``{"positions": [{"exchange", "uni_id", "symbol", "side"}]}`` where
    side is LONG or SHORT. Each item closes that user's WHOLE side of that
    symbol on that venue (hedge mode: one position per symbol and side; one
    account per user per venue).

    It runs the same exit path a TradingView EXIT runs — re-read first, retry
    on a transient failure, bookkeeping, a trade_logs row — grouped into one
    job per (exchange, symbol, side) and narrowed to exactly the users named.

    **A group that closes the MASTER's position is announced like any exit**
    (owner, 2026-10-07): the channel publishes the master's trades, so a
    master close it never hears about leaves an entry with no exit and a
    daily recap short one close. The message is the ordinary exit message —
    nothing says "manual". A group of customers only stays silent: their
    closes are not a strategy exit, and announcing every such group would
    post one close several times. Failures still reach the admin chat.

    It also **waits for the result** (up to CLOSE_WAIT_SECONDS) so the page
    can show per-account outcomes rather than "accepted".
    """
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 403
    from binance_abcd.exchanges import enabled as enabled_exchanges
    from binance_abcd.routes import webhook

    raw = (request.get_json(silent=True) or {}).get("positions")
    if not isinstance(raw, list) or not raw:
        return jsonify({"error": "positions must be a non-empty list"}), 400
    if len(raw) > CLOSE_MAX_POSITIONS:
        return jsonify({"error": f"at most {CLOSE_MAX_POSITIONS} positions per request"}), 400

    live = set(enabled_exchanges())
    groups: dict[tuple[str, str, str], set[str]] = {}
    for item in raw:
        if not isinstance(item, dict):
            return jsonify({"error": "every position must be an object"}), 400
        exchange = str(item.get("exchange") or "").strip().lower()
        uni_id = str(item.get("uni_id") or "").strip()
        symbol = str(item.get("symbol") or "").strip().upper()
        side = str(item.get("side") or "").strip().upper()
        if not uni_id or not symbol or side not in ("LONG", "SHORT"):
            return jsonify({"error": "each position needs uni_id, symbol and side LONG|SHORT"}), 400
        # Same shape rule as the webhook: the symbol ends up inside a
        # hand-built signed query string.
        if not webhook.is_valid_ticker(symbol):
            return jsonify({"error": "invalid symbol"}), 400
        # Refused, never defaulted: the job falls back to EVERY live venue
        # when its target venue is not live, and with that venue's filter gone
        # it would close every account there.
        if exchange not in live:
            return jsonify({"error": "EXCHANGE_NOT_ENABLED",
                            "message": f"The engine is not trading '{exchange}'."}), 400
        groups.setdefault((exchange, symbol, side), set()).add(uni_id)

    # The master is read off the engine's own (cached) account list, never
    # from the request. An API that sends no `is_master` announces nothing.
    masters = {
        exchange: {a.get("uni_id") for a in webhook.fetch_accounts(exchange=exchange) if a.get("is_master")}
        for exchange in {ex for ex, _, _ in groups}
    }

    futures = {
        _CLOSE_EXECUTOR.submit(
            webhook._process_trade_job,
            f"EXIT_{side}", symbol, None, None, None,
            targets={exchange: uni_ids}, announce=bool(uni_ids & masters[exchange]),
        ): (exchange, symbol, side, uni_ids)
        for (exchange, symbol, side), uni_ids in groups.items()
    }
    wait(futures, timeout=CLOSE_WAIT_SECONDS)

    jobs = []
    for future, (exchange, symbol, side, uni_ids) in futures.items():
        job = {"exchange": exchange, "symbol": symbol, "side": side,
               "action": f"EXIT_{side}", "uni_ids": sorted(uni_ids)}
        if not future.done():
            job |= {"status": "running"}
        elif future.exception() is not None:
            job |= {"status": "crashed", "error": str(future.exception())}
        else:
            summary = future.result()
            job |= {"status": "done", "filled": summary.get("filled", 0),
                    "failed": summary.get("failed", 0), "skipped": summary.get("skipped", 0),
                    "category": summary.get("category"), "details": summary.get("details", [])}
        jobs.append(job)

    return jsonify({
        "success": all(j["status"] == "done" for j in jobs),
        "jobs": jobs,
        "filled": sum(j.get("filled", 0) for j in jobs),
        "failed": sum(j.get("failed", 0) for j in jobs) + sum(1 for j in jobs if j["status"] == "crashed"),
        "skipped": sum(j.get("skipped", 0) for j in jobs),
        "running": sum(1 for j in jobs if j["status"] == "running"),
    })


_TG_TAGS = re.compile(r"</?(?:b|i|u|s|code|pre)>")


def _plain(telegram_html: str) -> str:
    """The recap without Telegram's HTML tags, for showing on a web page."""
    return html.unescape(_TG_TAGS.sub("", telegram_html))


@admin_bp.route("/reports/preview", methods=["POST"])
def reports_preview():
    """Render a recap and send it to the ADMIN chat under a test banner —
    the Bot Engine admin page's "Recap previews" card.

    Body: ``{"kind": "daily|weekly|monthly", "on": "YYYY-MM-DD" | "yesterday" | null}``.
    `on` is the day the recap is rendered "as of" (at its scheduled time on
    that day) — ``yesterday`` is resolved here, in the report timezone, so
    the browser's clock never decides which day that is. Nothing reaches the
    public channel and the scheduler's state is untouched, so the real
    scheduled post is unaffected.
    """
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 403
    from zoneinfo import ZoneInfo

    from binance_abcd import notify, reports  # deferred: reports pulls in the http client

    body = request.get_json(silent=True) or {}
    kind = str(body.get("kind") or "").strip().lower()
    raw_on = body.get("on")
    on = None
    if raw_on:
        text = str(raw_on).strip().lower()
        if text == "yesterday":
            on = datetime.now(ZoneInfo(hooks.REPORT_TIMEZONE)).date() - timedelta(days=1)
        else:
            try:
                on = date.fromisoformat(text)
            except ValueError:
                return jsonify({"error": "on must be YYYY-MM-DD or 'yesterday'"}), 400

    try:
        rendered = reports.preview(kind, on=on)
    except reports.PreviewUnavailable as exc:
        return jsonify({"error": str(exc)}), 422

    return jsonify({
        "success": True,
        "kind": kind,
        "on": on.isoformat() if on else None,
        # Whether a Telegram copy actually went out; on a box without a bot
        # the page must say "rendered only" rather than claim a send.
        "telegram": notify.telegram_enabled(),
        "messages": [{"html": text, "text": _plain(text)} for text in rendered],
    })


@admin_bp.route("/stats", methods=["GET"])
def stats():
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 403
    from binance_abcd.retry_queue import queue_depth
    from binance_abcd.routes.webhook import metrics_snapshot

    return jsonify({
        "success": True,
        "metrics": metrics_snapshot(),
        "accounts_cache_age": accounts_cache_age(),
        "assets_cache_age": assets_cache_age(),
        "retry_queue_depth": queue_depth(),
    })
