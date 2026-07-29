"""Admin routes: refresh config, cache management."""

import importlib
import logging

from flask import Blueprint, jsonify, request

from bybit_src.assets_api import assets_cache_age, invalidate_assets_cache
from bybit_src.bybit_accounts_api import accounts_cache_age, invalidate_accounts_cache
from bybit_src.hooks import WEBHOOK_SECRET

logger = logging.getLogger(__name__)

bp = Blueprint("admin", __name__, url_prefix="/admin")


def _check_secret() -> bool:
    token = (
        request.headers.get("X-Admin-Secret")
        or request.args.get("secret")
        or (request.get_json(silent=True) or {}).get("secret")
    )
    return token == WEBHOOK_SECRET


@bp.route("/refresh", methods=["POST"])
def refresh():
    if not _check_secret():
        logger.warning("Admin refresh: unauthorized attempt from %s", request.remote_addr)
        return jsonify({"error": "Unauthorized"}), 403
    try:
        import bybit_src.hooks
        importlib.reload(bybit_src.hooks)
        logger.info("Config reloaded")
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.exception("Config reload failed: %s", e)
        return jsonify({"error": str(e)}), 500


@bp.route("/refresh-accounts", methods=["POST"])
def refresh_accounts():
    if not _check_secret():
        return jsonify({"error": "Unauthorized"}), 403
    invalidate_accounts_cache()
    logger.info("[admin] accounts cache invalidated")
    return jsonify({"success": True, "scope": "accounts"}), 200


@bp.route("/refresh-assets", methods=["POST"])
def refresh_assets():
    if not _check_secret():
        return jsonify({"error": "Unauthorized"}), 403
    invalidate_assets_cache()
    logger.info("[admin] assets cache invalidated")
    return jsonify({"success": True, "scope": "assets"}), 200


@bp.route("/fetch-balances-now", methods=["POST"])
def fetch_balances_now():
    if not _check_secret():
        return jsonify({"error": "Unauthorized"}), 403
    try:
        invalidate_accounts_cache()
        from bybit_src.fetch_balances import fetch_and_save
        ok = fetch_and_save()
        logger.info("[admin] fetch_balances_now ran (ok=%s)", ok)
        return jsonify({"success": bool(ok)}), 200
    except Exception as e:
        logger.exception("fetch_balances_now failed: %s", e)
        return jsonify({"error": str(e)}), 500


@bp.route("/refresh-all", methods=["POST"])
def refresh_all():
    if not _check_secret():
        return jsonify({"error": "Unauthorized"}), 403
    invalidate_accounts_cache()
    invalidate_assets_cache()
    fetched_ok = False
    try:
        from bybit_src.fetch_balances import fetch_and_save
        fetched_ok = bool(fetch_and_save())
    except Exception as e:
        logger.exception("refresh-all: fetch_balances failed: %s", e)
    logger.info("[admin] refresh-all done (balances_ok=%s)", fetched_ok)
    return jsonify({"success": True, "balances_fetched": fetched_ok}), 200


@bp.route("/cache-status", methods=["GET"])
def cache_status():
    if not _check_secret():
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify({
        "accounts_age_seconds": accounts_cache_age(),
        "assets_age_seconds": assets_cache_age(),
    }), 200
