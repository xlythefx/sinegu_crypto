"""Stub required env vars BEFORE importing src.hooks (which reads os.environ at import time)."""
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

os.environ.setdefault("BINANCE_API_BASE", "https://fapi.binance.com")
os.environ.setdefault("BINANCE_API_TIMEOUT", "10")
os.environ.setdefault("BINANCE_POSITION_MODE", "hedge")
os.environ.setdefault("BINANCE_SYNC_POSITION_MODE_ON_STARTUP", "false")
os.environ.setdefault("BINANCE_WEBHOOK_SECRET", "test-secret")
os.environ.setdefault("BINANCE_LIVE_QUANTITY", "1")
os.environ.setdefault("BINANCE_FLASK_PORT", "5001")
os.environ.setdefault("BINANCE_LOG_INTERVAL", "60")
os.environ.setdefault("BINANCE_POSITIONS_FETCH_INTERVAL", "10")
os.environ.setdefault("BINANCE_TRANSFERS_FETCH_INTERVAL", "60")
os.environ.setdefault("BINANCE_BALANCES_FETCH_INTERVAL", "60")
os.environ.setdefault("BINANCE_TRANSFERS_LOOKBACK_DAYS", "3")
os.environ.setdefault("BINANCE_API_BASE_URL", "http://localhost")
os.environ.setdefault("BINANCE_ASSETS_ENDPOINT", "/api/flask/assets")
os.environ.setdefault("BINANCE_ASSETS_BROKER", "Binance")
os.environ.setdefault("BINANCE_ACCOUNTS_ENDPOINT", "/api/flask/binance-accounts")
os.environ.setdefault("BINANCE_INSERT_POSITIONS_ENDPOINT", "/api/flask/positions")
os.environ.setdefault("BINANCE_INSERT_PAST_POSITION_ENDPOINT", "/api/flask/past-position")
os.environ.setdefault("BINANCE_INSERT_TRANSACTIONS_ENDPOINT", "/api/flask/transactions")
os.environ.setdefault("BINANCE_UPDATE_BALANCE_ENDPOINT", "/api/flask/update-balance")
