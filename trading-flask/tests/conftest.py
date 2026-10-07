"""Test env + fixtures. Sets every BINANCE_ABCD_* var BEFORE binance_abcd.hooks
is imported (hooks reads os.environ at import time and raises on missing keys).
All HTTP is mocked — no test touches the network.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

os.environ.setdefault("BINANCE_ABCD_WEBHOOK_SECRET", "test-webhook-secret")
# Empty on purpose: the suite runs with /admin/* on the FALLBACK (webhook)
# secret, as every pre-existing admin test assumes, and a developer's real
# .env setting BINANCE_ABCD_ADMIN_SECRET must not flip that. test_admin_auth.py
# monkeypatches hooks.ADMIN_SECRET to exercise the separated token.
os.environ.setdefault("BINANCE_ABCD_ADMIN_SECRET", "")
os.environ.setdefault("BINANCE_ABCD_ENGINE_SECRET", "test-engine-secret")
os.environ.setdefault("BINANCE_ABCD_ENGINE_API_BASE", "http://engine.test/api")
os.environ.setdefault("BINANCE_ABCD_RUN_POLLERS", "false")
os.environ.setdefault("BINANCE_ABCD_RETRY_ENABLED", "true")
os.environ.setdefault("BINANCE_ABCD_RETRY_INTERVAL_SECONDS", "0.05")
# Binance only by default — the pre-MEXC suite must see exactly the engine it
# always did. Multi-exchange tests flip hooks.EXCHANGES with monkeypatch.
os.environ.setdefault("BINANCE_ABCD_EXCHANGES", "binance")
# No fallback leverage: a MEXC entry with none from the signal or the account
# must be refused, and a test that wants a default sets it explicitly.
os.environ.setdefault("BINANCE_ABCD_MEXC_DEFAULT_LEVERAGE", "0")
# Telegram AND Discord OFF for the whole suite. hooks.py load_dotenv()s the real
# .env, so without these the fan-out tests would post to the live channels.
# Setting them here wins: load_dotenv runs with override=False. test_notify.py
# re-enables notifications per-test by monkeypatching hooks, with _send (and
# discord_notify.post) captured.
os.environ.setdefault("BINANCE_ABCD_TELEGRAM_ENABLED", "false")
os.environ.setdefault("BINANCE_ABCD_TELEGRAM_BOT_TOKEN", "")
os.environ.setdefault("BINANCE_ABCD_TELEGRAM_CHAT_ID", "")
os.environ.setdefault("BINANCE_ABCD_TELEGRAM_ADMIN_CHAT_ID", "")
os.environ.setdefault("BINANCE_ABCD_DISCORD_ENABLED", "false")
os.environ.setdefault("BINANCE_ABCD_DISCORD_WEBHOOK_URL", "")
os.environ.setdefault("BINANCE_ABCD_DISCORD_WINS_WEBHOOK_URL", "")

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _isolate_trade_log(tmp_path, monkeypatch):
    """Keep test jobs from appending to the real out/webhook_trades.log."""
    import binance_abcd.routes.webhook as webhook

    monkeypatch.setattr(webhook, "TRADES_LOG", tmp_path / "webhook_trades.log")


@pytest.fixture(autouse=True)
def _isolate_report_state(tmp_path, monkeypatch):
    """Keep tests from reading or stamping the real out/report_state.json —
    a test that marked today's daily as sent would silence the live channel."""
    import binance_abcd.reports as reports

    monkeypatch.setattr(reports, "STATE_FILE", tmp_path / "report_state.json")


@pytest.fixture(autouse=True)
def _isolate_published_closes(tmp_path, monkeypatch):
    """Keep test closes out of the real out/published_closes.jsonl — the live
    daily recap SUMS that file, so a stray test row would move its Return."""
    import binance_abcd.published_closes as published_closes

    monkeypatch.setattr(published_closes, "LEDGER_FILE", tmp_path / "published_closes.jsonl")


@pytest.fixture(autouse=True)
def _isolate_watermarks(tmp_path, monkeypatch):
    """Keep poller tests from reading or advancing the real out/last_*_sync.json —
    a test that stamped a fresh closes or fee watermark would make the live
    poller skip everything older on its next tick."""
    import binance_abcd.fee_receipts as fee_receipts
    import binance_abcd.fetch_bybit_history as fetch_bybit_history
    import binance_abcd.fetch_mexc_history as fetch_mexc_history
    import binance_abcd.fetch_past_positions as fetch_past_positions

    monkeypatch.setattr(fetch_past_positions, "WATERMARK_FILE", tmp_path / "last_income_sync.json")
    monkeypatch.setattr(fetch_past_positions, "FEES_WATERMARK_FILE", tmp_path / "last_fees_sync.json")
    monkeypatch.setattr(fee_receipts, "FEES_WATERMARK_FILE", tmp_path / "last_fees_sync.json")
    monkeypatch.setattr(fetch_mexc_history, "WATERMARK_FILE", tmp_path / "last_mexc_closes_sync.json")
    monkeypatch.setattr(fetch_mexc_history, "FEES_WATERMARK_FILE", tmp_path / "last_mexc_fees_sync.json")
    monkeypatch.setattr(fetch_bybit_history, "WATERMARK_FILE", tmp_path / "last_bybit_closes_sync.json")
    monkeypatch.setattr(fetch_bybit_history, "FEES_WATERMARK_FILE", tmp_path / "last_bybit_fees_sync.json")


@pytest.fixture(autouse=True)
def _reset_exchange_state():
    """Per-test amnesia for the module-level venue caches and the key-status
    dedupe, so one test's contract/instrument map or blocked-key memory never
    leaks into the next."""
    import binance_abcd.bybit_api as bybit_api
    import binance_abcd.key_status as key_status
    import binance_abcd.mexc_api as mexc_api

    key_status.reset()
    mexc_api.reset_caches()
    bybit_api.reset_caches()
    yield
    key_status.reset()
    mexc_api.reset_caches()
    bybit_api.reset_caches()


@pytest.fixture()
def app():
    from binance_abcd.main import create_app

    application = create_app()
    application.config.update(TESTING=True)
    return application


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def fake_accounts():
    """Three accounts, all past the MIN_DEPOSIT gate.

    "Demo Two" is deliberately funded above the minimum but drawn down well
    below it — the case that proves the gate reads deposit, not balance.
    """
    return [
        {
            "api_key": "live-key-1",
            "secret_key": "live-secret-1",
            "name": "Live One",
            "uni_id": "uni-live-1",
            "balance": 1000.0,
            "initial_deposit": 1000.0,
            "total_deposit": 1000.0,
            "currency_type": "USDT",
            "demo": False,
            "enabled": True,
        },
        {
            "api_key": "demo-key-2",
            "secret_key": "demo-secret-2",
            "name": "Demo Two",
            "uni_id": "uni-demo-2",
            "balance": 300.0,
            "initial_deposit": 1500.0,
            "total_deposit": 1500.0,
            "currency_type": "USDT",
            "demo": True,
            "enabled": True,
        },
        {
            "api_key": "live-key-3",
            "secret_key": "live-secret-3",
            "name": "Live Three",
            "uni_id": "uni-live-3",
            "balance": 2500.0,
            "initial_deposit": 2000.0,
            "total_deposit": 2500.0,
            "currency_type": "USDT",
            "demo": False,
            "enabled": True,
        },
    ]


@pytest.fixture()
def fake_assets():
    """Assets as `assets_api` hands them downstream — i.e. already normalized.

    `max_size` is the raw `assets.max_increments` COLUMN (a position size);
    `max_increments` is the entry COUNT derived from it (max_size / base_size).
    Keep the two consistent when editing, or a fixture will describe an asset
    that the real loader could never produce.
    """
    return {
        "BTCUSDT": {"ticker": "BTCUSDT", "base_size": 0.005, "max_size": 0.05,
                    "max_increments": 10.0, "side": "ALL"},
        "ETHUSDT": {"ticker": "ETHUSDT", "base_size": 0.1, "max_size": 0.5,
                    "max_increments": 5.0, "side": "ALL"},
        "DOGEUSDT": {"ticker": "DOGEUSDT", "base_size": 100.0, "max_size": 300.0,
                     "max_increments": 3.0, "side": "LONG"},
    }
