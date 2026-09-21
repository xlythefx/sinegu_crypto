"""Operator endpoints under /admin, guarded by X-Admin-Secret (= webhook secret).

refresh-balances is synchronous by design: the future monthly invoice
generator calls it and blocks until every balance is fresh before computing
fees (the reference project's billing wrapper does exactly this).
"""

from __future__ import annotations

import hmac as hmac_mod
import html
import re
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request

from binance_abcd.accounts_api import accounts_cache_age, invalidate_accounts_cache
from binance_abcd.assets_api import assets_cache_age, invalidate_assets_cache
from binance_abcd.hooks import WEBHOOK_SECRET

admin_bp = Blueprint("abcd_admin", __name__, url_prefix="/admin")


def _authorized() -> bool:
    supplied = request.headers.get("X-Admin-Secret") or request.args.get("secret") or ""
    return bool(WEBHOOK_SECRET) and hmac_mod.compare_digest(str(supplied), WEBHOOK_SECRET)


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

    from binance_abcd import hooks, notify, reports  # deferred: reports pulls in the http client

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
