"""
Binance Flask: receive TradingView webhooks and execute on Binance Futures.
POST /binance_webhook with secret, action (add/exit/sell/order), symbol.
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

import json
import logging

from flask import Flask, jsonify, request

try:
    from flask_cors import CORS
except ImportError:
    CORS = None

from src.hooks import (
    BINANCE_SYNC_POSITION_MODE_ON_STARTUP,
    FLASK_PORT,
    OUT_DIR,
    POSITION_MODE,
    WEBHOOK_SECRET,
)
from src.binance_api import BinanceAPI
from src.assets_api import fetch_assets
from src.binance_accounts_api import fetch_binance_accounts
from src.routes.webhook import bp as webhook_bp
from src.routes.webhook import _ensure_trades_log
from src.routes.admin import bp as admin_bp

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
    return jsonify({"status": "ok", "service": "binance-flask"})


def _mask_api_key(key: str) -> str:
    """Show first 8 and last 4 chars for display."""
    if not key or len(key) < 12:
        return "***" if key else "-"
    return f"{key[:8]}...{key[-4:]}"


def _startup_display_binance_accounts():
    """Fetch and display enabled Binance accounts (name, api_key). Webhook fetches fresh on each request (new DB accounts included)."""
    accounts = fetch_binance_accounts()
    if accounts is None:
        logger.warning("Could not load Binance accounts from trading-api")
        return
    logger.info("=" * 60)
    logger.info("BINANCE ACCOUNTS (enabled=1)")
    logger.info("=" * 60)
    for a in accounts:
        name = a.get("name") or "-"
        api_key = a.get("api_key") or ""
        masked = _mask_api_key(api_key)
        logger.info("  Name: %s | API key: %s", name, masked)
    logger.info("=" * 60)
    logger.info("Total: %d enabled accounts", len(accounts))


def _startup_binance_position_mode():
    """Log each account's mode; if BINANCE_SYNC_POSITION_MODE_ON_STARTUP, force POSITION_MODE via Binance API."""
    accounts = fetch_binance_accounts()
    if not accounts:
        return
    want_hedge = POSITION_MODE.strip().lower() in ("hedge", "dual", "long_short")
    for a in accounts:
        api_key = (a.get("api_key") or "").strip()
        secret = (a.get("secret_key") or "").strip()
        name = a.get("name") or "?"
        if not api_key or not secret:
            continue
        api = BinanceAPI(api_key, secret)
        current = api.get_dual_side_position()
        if current is None:
            logger.warning("[%s] Could not read Binance position mode (dualSidePosition)", name)
            continue
        mode_str = "hedge (dual)" if current else "one-way"
        logger.info("[%s] Binance position mode: %s (hooks POSITION_MODE=%s)", name, mode_str, POSITION_MODE)

        if BINANCE_SYNC_POSITION_MODE_ON_STARTUP and current != want_hedge:
            logger.info("[%s] Applying hedge mode via API (POST /fapi/v1/positionSide/dual)...", name)
            res = api.set_dual_side_position(want_hedge)
            if isinstance(res, dict) and res.get("_error"):
                logger.warning("[%s] set_dual_side_position failed: %s", name, res.get("response", res.get("message", ""))[:300])
            elif isinstance(res, dict) and isinstance(res.get("code"), int) and res["code"] < 0:
                msg = str(res)
                logger.warning("[%s] set_dual_side_position: %s", name, msg)
                if res.get("code") == -4059 or "4059" in msg:
                    logger.warning(
                        "[%s] Binance will not change mode while positions or orders exist. Close them and restart Flask.",
                        name,
                    )
            else:
                after = api.get_dual_side_position()
                if after == want_hedge:
                    logger.info("[%s] Hedge mode is now active on Binance.", name)
                else:
                    logger.warning("[%s] API reported success but mode is still %s — check Binance.", name, after)

        elif current != want_hedge and not BINANCE_SYNC_POSITION_MODE_ON_STARTUP:
            logger.warning(
                "[%s] Mismatch: Binance is %s but POSITION_MODE=%s — set BINANCE_SYNC_POSITION_MODE_ON_STARTUP or fix in app.",
                name,
                mode_str,
                POSITION_MODE,
            )
        elif current == want_hedge:
            logger.info("[%s] Position mode already matches bot (%s).", name, "hedge" if want_hedge else "one-way")


def _startup_display_assets():
    """Fetch and display loaded assets from trading-api."""
    assets = fetch_assets()
    if assets is None:
        logger.warning("Could not load assets from trading-api (API may be offline)")
        return
    logger.info("=" * 60)
    logger.info("ASSETS LOADED FROM TRADING-API")
    logger.info("=" * 60)
    for a in assets:
        ticker = a.get("ticker", "")
        binance = a.get("binance_symbol", ticker)
        base_size = a.get("base_size", 0)
        enabled = a.get("enabled", True)
        status = "enabled" if enabled else "disabled"
        extra = []
        if a.get("type"):
            extra.append(f"type={a['type']}")
        if a.get("broker"):
            extra.append(f"broker={a['broker']}")
        suffix = " | " + ", ".join(extra) if extra else ""
        logger.info("  %s | Binance: %s | base_size: %s | %s%s",
                    ticker or "-", binance, base_size, status, suffix)
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
    _startup_display_binance_accounts()
    _startup_binance_position_mode()
    _startup_display_assets()
    _ensure_trades_log()
    logger.info("Starting Flask on 0.0.0.0:%s", FLASK_PORT)
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=False)
