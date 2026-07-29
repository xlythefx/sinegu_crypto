"""
Bybit Flask: receive TradingView webhooks and execute on Bybit USDT linear futures.
POST /bybit_webhook with secret, action (BUY/SELL/EXIT_LONG/EXIT_SHORT), symbol.
"""

import os
import sys
from pathlib import Path

import certifi
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import logging

from flask import Flask, jsonify, request

try:
    from flask_cors import CORS
except ImportError:
    CORS = None

from bybit_src.hooks import (
    API_BASE_URL,
    BYBIT_WARN_POSITION_MODE_MISMATCH,
    FLASK_PORT,
    POSITION_MODE,
    WEBHOOK_SECRET,
)
from bybit_src.assets_api import fetch_assets
from bybit_src.bybit_accounts_api import fetch_bybit_accounts
from bybit_src.bybit_api import BybitAPI
from bybit_src.routes.webhook import bp as webhook_bp
from bybit_src.routes.webhook import _ensure_trades_log
from bybit_src.routes.admin import bp as admin_bp

LOG_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"
LOG_DATEFMT = "%H:%M:%S"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, datefmt=LOG_DATEFMT)
logger = logging.getLogger(__name__)
logging.getLogger("werkzeug").setLevel(logging.INFO)

app = Flask(__name__)
if CORS is not None:
    CORS(app)

app.register_blueprint(webhook_bp)
app.register_blueprint(admin_bp)


def _flush():
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


@app.before_request
def log_request():
    logger.info(">>> %s %s from %s", request.method, request.path or "/", request.remote_addr or "?")
    _flush()


@app.after_request
def log_response(response):
    logger.info("<<< %s %s -> %s", request.method, request.path or "/", response.status_code)
    _flush()
    return response


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "bybit-flask"})


def _mask_api_key(key: str) -> str:
    if not key or len(key) < 12:
        return "***" if key else "-"
    return f"{key[:8]}...{key[-4:]}"


def _startup_display_bybit_accounts():
    accounts = fetch_bybit_accounts()
    if accounts is None:
        logger.warning("Could not load Bybit accounts from trading-api")
        return
    logger.info("=" * 60)
    logger.info("BYBIT ACCOUNTS (enabled=1)")
    logger.info("=" * 60)
    for a in accounts:
        name = a.get("name") or "-"
        api_key = a.get("api_key") or ""
        masked = _mask_api_key(api_key)
        logger.info("  Name: %s | API key: %s", name, masked)
    logger.info("=" * 60)
    logger.info("Total: %d enabled accounts", len(accounts))


def _startup_check_position_mode():
    """Log position mode for each account; warn on mismatch (Bybit requires UI toggle)."""
    if not BYBIT_WARN_POSITION_MODE_MISMATCH:
        return
    accounts = fetch_bybit_accounts()
    if not accounts:
        return
    want_hedge = POSITION_MODE.strip().lower() in ("hedge", "dual", "long_short")
    for a in accounts:
        api_key = (a.get("api_key") or "").strip()
        secret = (a.get("secret_key") or "").strip()
        name = a.get("name") or "?"
        if not api_key or not secret:
            continue
        api = BybitAPI(api_key, secret)
        current = api.get_position_mode()
        if current is None:
            logger.warning("[%s] Could not read Bybit position mode (account/info)", name)
            continue
        mode_str = "hedge" if current else "one-way"
        logger.info("[%s] Bybit position mode: %s (hooks POSITION_MODE=%s)", name, mode_str, POSITION_MODE)
        if current != want_hedge:
            logger.warning(
                "[%s] Mismatch: Bybit is %s but POSITION_MODE=%s — change via Bybit UI: "
                "Derivatives → Settings → Position Mode.",
                name, mode_str, POSITION_MODE,
            )


def _startup_display_assets():
    assets = fetch_assets()
    if assets is None:
        logger.warning("Could not load assets from trading-api (API may be offline)")
        return
    logger.info("=" * 60)
    logger.info("ASSETS LOADED FROM TRADING-API (Bybit mapping)")
    logger.info("=" * 60)
    for a in assets:
        ticker = a.get("ticker", "")
        bybit = a.get("bybit_symbol", ticker)
        base_size = a.get("base_size", 0)
        enabled = a.get("enabled", True)
        status = "enabled" if enabled else "disabled"
        logger.info("  %s | Bybit: %s | base_size: %s | %s", ticker or "-", bybit, base_size, status)
    logger.info("=" * 60)
    logger.info("Total: %d assets", len(assets))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(line_buffering=True)
            sys.stderr.reconfigure(line_buffering=True)
        except Exception:
            pass

    if not WEBHOOK_SECRET:
        logger.warning("WEBHOOK_SECRET not set - webhook will reject all requests")
    _startup_display_bybit_accounts()
    _startup_check_position_mode()
    _startup_display_assets()
    _ensure_trades_log()
    logger.info("API base: %s", API_BASE_URL)
    logger.info("Starting Flask on 0.0.0.0:%s", FLASK_PORT)
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=False)
