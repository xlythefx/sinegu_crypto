"""BINANCE_ABCD engine entry point — `python -m binance_abcd.main`.

One process runs everything: the Flask app (served by waitress — a production
WSGI server that works identically on the Windows dev box and the Ubuntu VPS;
gunicorn is Linux-only and Flask's dev server is not production grade) plus
the pollers as daemon threads (RUN_POLLERS gates them for dev).
"""

from __future__ import annotations

import logging
import signal
import threading
import time

from flask import Flask, jsonify

from binance_abcd import hooks, notify
from binance_abcd.accounts_api import accounts_cache_age, account_futures_base_url, fetch_accounts
from binance_abcd.assets_api import assets_cache_age, fetch_assets
from binance_abcd.binance_api import (
    BinanceAPI,
    mark_position_mode_verified,
    rate_limited_until,
    set_rate_limit_alert_hook,
)
from binance_abcd.reports import reports_status, start_reporter
from binance_abcd.retry_queue import queue_depth, start_retry_queue
from binance_abcd.routes.admin import admin_bp
from binance_abcd.routes.webhook import metrics_snapshot, webhook_bp
from binance_abcd.trading_handler import want_hedge

log = logging.getLogger(__name__)

_shutdown = threading.Event()
_pollers_running: list[str] = []


def create_app() -> Flask:
    app = Flask(__name__)
    try:
        from flask_cors import CORS

        CORS(app)
    except ImportError:
        pass
    app.register_blueprint(webhook_bp)
    app.register_blueprint(admin_bp)

    @app.route("/health")
    def health():
        return jsonify({
            "status": "ok",
            "service": hooks.SERVICE_NAME,
            "accounts_cache_age": accounts_cache_age(),
            "assets_cache_age": assets_cache_age(),
            "metrics": metrics_snapshot(),
            "retry_queue_depth": queue_depth(),
            "rate_limited_until": rate_limited_until() or None,
            "pollers": list(_pollers_running),
            "reports": reports_status(),
        })

    return app


def _mask(key: str) -> str:
    return f"{key[:6]}...{key[-4:]}" if len(key) > 12 else "***"


def startup_checks() -> tuple[int, int]:
    """Print accounts/assets, sync position mode per account (seeds the
    verified cache so the trade path never re-checks). Returns the
    (account, asset) counts for the Telegram startup ping."""
    accounts = fetch_accounts(force=True)
    log.info("accounts enabled for trading: %d", len(accounts))
    for account in accounts:
        log.info(
            "  %-24s %s balance=%-10s %s",
            account.get("name"),
            _mask(account.get("api_key", "")),
            account.get("balance"),
            "DEMO/testnet" if account.get("demo") else "LIVE",
        )

    if hooks.SYNC_POSITION_MODE_ON_STARTUP:
        for account in accounts:
            api = BinanceAPI(
                account["api_key"], account["secret_key"], base_url=account_futures_base_url(account)
            )
            ok, err = api.ensure_position_mode_matches(want_hedge())
            if ok:
                mark_position_mode_verified(account["api_key"])
            else:
                log.warning("position mode NOT aligned for %s: %s", account.get("name"), err)

    assets = fetch_assets(force=True)
    log.info("assets enabled: %s", ", ".join(sorted(assets)) or "(none)")
    return len(accounts), len(assets)


def _poller_loop(name: str, fetch_fn, interval: float, start_delay: float = 0.0) -> None:
    """Run fetch_fn every interval; log failure transitions and recoveries.

    `start_delay` staggers the first tick so the pollers don't all fire on the
    same second. They share one IP's Binance weight budget, and intervals of
    300/300/600 realign on every multiple — spreading the starts turns one tall
    burst into a few short ones without changing how often anything runs.
    """
    failing = False
    _pollers_running.append(name)
    if start_delay > 0 and _shutdown.wait(start_delay):
        _pollers_running.remove(name)
        return
    while not _shutdown.is_set():
        try:
            fetch_fn()
            if failing:
                log.info("[%s] recovered", name)
                failing = False
        except Exception as exc:  # noqa: BLE001 - a poller must never die
            if not failing:
                log.exception("[%s] failing", name)
                notify.notify_error(f"poller '{name}' failing", str(exc))
                failing = True
        if _shutdown.wait(interval):
            break
    try:
        _pollers_running.remove(name)
    except ValueError:
        pass


def start_pollers() -> None:
    from binance_abcd.fetch_balances import fetch_and_save as balances
    from binance_abcd.fetch_past_positions import fetch_and_save as past_positions
    from binance_abcd.fetch_positions import fetch_and_save as positions
    from binance_abcd.fetch_transfers import fetch_and_save as transfers

    jobs = [
        ("balances", balances, hooks.BALANCES_FETCH_INTERVAL),
        ("positions", positions, hooks.POSITIONS_FETCH_INTERVAL),
        ("transfers", transfers, hooks.TRANSFERS_FETCH_INTERVAL),
        ("past-positions", past_positions, hooks.PAST_POSITIONS_FETCH_INTERVAL),
    ]
    for index, (name, fn, interval) in enumerate(jobs):
        threading.Thread(
            target=_poller_loop,
            args=(name, fn, interval, index * hooks.POLLER_START_STAGGER_SECONDS),
            name=f"poller-{name}",
            daemon=True,
        ).start()
    log.info("pollers started: %s", ", ".join(name for name, _, _ in jobs))


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s [%(threadName)s] %(message)s",
    )
    def _on_rate_limit(message: str) -> None:
        log.critical("RATE LIMIT ALERT: %s", message)
        notify.notify_error("Binance rate limit / ban", message)

    set_rate_limit_alert_hook(_on_rate_limit)

    log.info("starting %s on port %s (webhook %s)", hooks.SERVICE_NAME, hooks.FLASK_PORT, hooks.WEBHOOK_PATH)
    account_count, asset_count = startup_checks()
    notify.notify_startup(account_count, asset_count)
    start_retry_queue(_shutdown)
    start_reporter(_shutdown)
    if hooks.RUN_POLLERS:
        start_pollers()
    else:
        log.info("pollers disabled (BINANCE_ABCD_RUN_POLLERS=false)")

    def _handle_signal(signum, frame):  # noqa: ARG001
        log.info("signal %s — shutting down", signum)
        _shutdown.set()
        raise SystemExit(0)

    signal.signal(signal.SIGINT, _handle_signal)
    try:
        signal.signal(signal.SIGTERM, _handle_signal)
    except (AttributeError, ValueError):
        pass

    from waitress import serve

    serve(create_app(), host="0.0.0.0", port=hooks.FLASK_PORT, threads=hooks.WAITRESS_THREADS)


if __name__ == "__main__":
    main()
