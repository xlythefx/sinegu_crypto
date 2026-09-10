"""Operator endpoints under /admin, guarded by X-Admin-Secret (= webhook secret).

refresh-balances is synchronous by design: the future monthly invoice
generator calls it and blocks until every balance is fresh before computing
fees (the reference project's billing wrapper does exactly this).
"""

from __future__ import annotations

import hmac as hmac_mod

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
