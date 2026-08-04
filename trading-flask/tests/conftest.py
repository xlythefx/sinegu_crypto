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
os.environ.setdefault("BINANCE_ABCD_ENGINE_SECRET", "test-engine-secret")
os.environ.setdefault("BINANCE_ABCD_ENGINE_API_BASE", "http://engine.test/api")
os.environ.setdefault("BINANCE_ABCD_RUN_POLLERS", "false")
os.environ.setdefault("BINANCE_ABCD_RETRY_ENABLED", "true")
os.environ.setdefault("BINANCE_ABCD_RETRY_INTERVAL_SECONDS", "0.05")
# Telegram OFF for the whole suite. hooks.py load_dotenv()s the real .env, so
# without these the fan-out tests would post to the live channel. Setting them
# here wins: load_dotenv runs with override=False. test_notify.py re-enables
# notifications per-test by monkeypatching hooks, with _send captured.
os.environ.setdefault("BINANCE_ABCD_TELEGRAM_ENABLED", "false")
os.environ.setdefault("BINANCE_ABCD_TELEGRAM_BOT_TOKEN", "")
os.environ.setdefault("BINANCE_ABCD_TELEGRAM_CHAT_ID", "")
os.environ.setdefault("BINANCE_ABCD_TELEGRAM_ADMIN_CHAT_ID", "")

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _isolate_trade_log(tmp_path, monkeypatch):
    """Keep test jobs from appending to the real out/webhook_trades.log."""
    import binance_abcd.routes.webhook as webhook

    monkeypatch.setattr(webhook, "TRADES_LOG", tmp_path / "webhook_trades.log")


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
    return {
        "BTCUSDT": {"ticker": "BTCUSDT", "base_size": 0.005, "max_increments": 10.0, "side": "ALL"},
        "ETHUSDT": {"ticker": "ETHUSDT", "base_size": 0.1, "max_increments": 5.0, "side": "ALL"},
        "DOGEUSDT": {"ticker": "DOGEUSDT", "base_size": 100.0, "max_increments": 3.0, "side": "LONG"},
    }
