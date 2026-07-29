"""Binance Lite Flask: handles webhook trades for accounts with 100 <= balance < 500 USDT."""

import logging
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

from flask import Flask, jsonify, request

try:
    from flask_cors import CORS
except ImportError:
    CORS = None

from binance_lite_src.hooks import LITE_FLASK_PORT, LITE_WEBHOOK_SECRET
from binance_lite_src.routes.webhook import _ensure_trades_log
from binance_lite_src.routes.webhook import bp as lite_webhook_bp
from src.routes.admin import bp as admin_bp


LOG_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"
LOG_DATEFMT = "%H:%M:%S"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, datefmt=LOG_DATEFMT)
logger = logging.getLogger(__name__)

app = Flask(__name__)
if CORS is not None:
    CORS(app)

app.register_blueprint(lite_webhook_bp)
app.register_blueprint(admin_bp)


@app.before_request
def log_request():
    logger.info(">>> %s %s from %s", request.method, request.path or "/", request.remote_addr or "?")


@app.after_request
def log_response(response):
    logger.info("<<< %s %s -> %s", request.method, request.path or "/", response.status_code)
    return response


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "binance-lite-flask"})


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(line_buffering=True)
            sys.stderr.reconfigure(line_buffering=True)
        except Exception:
            pass

    if not LITE_WEBHOOK_SECRET:
        logger.warning("BINANCE_LITE_WEBHOOK_SECRET not set — lite webhook will reject all requests")
    _ensure_trades_log()
    logger.info("Starting Binance Lite Flask on 0.0.0.0:%s", LITE_FLASK_PORT)
    app.run(host="0.0.0.0", port=LITE_FLASK_PORT, debug=False)
