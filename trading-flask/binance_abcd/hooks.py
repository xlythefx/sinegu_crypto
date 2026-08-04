"""Configuration for the BINANCE_ABCD engine.

Every setting is env-driven with the ``BINANCE_ABCD_`` prefix, loaded from
``trading-flask/.env`` (see .env.example for the full key list). Required keys
raise at import time so a misconfigured service refuses to start rather than
trading with defaults.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=False)

_PREFIX = "BINANCE_ABCD_"


def _env_str(name: str, default: str | None = None) -> str:
    value = os.environ.get(_PREFIX + name, default)
    if value is None:
        raise RuntimeError(f"Missing required env var {_PREFIX + name} (set it in trading-flask/.env)")
    return value


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(_PREFIX + name)
    try:
        return int(raw) if raw not in (None, "") else default
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(_PREFIX + name)
    try:
        return float(raw) if raw not in (None, "") else default
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(_PREFIX + name)
    if raw in (None, ""):
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# --- Service identity ---------------------------------------------------------
SERVICE_NAME = "binance-abcd"
WEBHOOK_PATH = "/binance_abcd_webhook"
FLASK_PORT = _env_int("FLASK_PORT", 5010)

# TradingView -> webhook shared secret. Required; compared with hmac.compare_digest.
WEBHOOK_SECRET = _env_str("WEBHOOK_SECRET")

# --- sinegutrade-api (engine machine-to-machine API) --------------------------
ENGINE_API_BASE = _env_str("ENGINE_API_BASE", "http://127.0.0.1:8000/api").rstrip("/")
ENGINE_SECRET = _env_str("ENGINE_SECRET")
ENGINE_API_TIMEOUT = _env_float("ENGINE_API_TIMEOUT", 10.0)
ENGINE_EXCHANGE = "binance"  # route segment: /engine/binance/...

# --- Binance futures ----------------------------------------------------------
BINANCE_API_BASE = _env_str("BINANCE_API_BASE", "https://fapi.binance.com").rstrip("/")
# Accounts flagged demo=1 route here instead (Binance futures testnet).
BINANCE_TESTNET_API_BASE = _env_str("TESTNET_API_BASE", "https://demo-fapi.binance.com").rstrip("/")
API_TIMEOUT = _env_float("API_TIMEOUT", 15.0)

# hedge (dual-side) or oneway; verified per account at startup, cached after.
POSITION_MODE = _env_str("POSITION_MODE", "hedge").strip().lower()
SYNC_POSITION_MODE_ON_STARTUP = _env_bool("SYNC_POSITION_MODE_ON_STARTUP", True)
POSITION_MODE_CACHE_TTL = _env_float("POSITION_MODE_CACHE_TTL", 21600.0)  # 6h

# --- Concurrency (queue + workers, fast ACK) ----------------------------------
DISPATCH_WORKERS = _env_int("DISPATCH_WORKERS", 8)     # concurrent signals
FANOUT_WORKERS = _env_int("FANOUT_WORKERS", 32)        # global in-flight account ceiling
HTTP_POOL_MAXSIZE = _env_int("HTTP_POOL_MAXSIZE", 64)  # shared requests.Session pool
WAITRESS_THREADS = _env_int("WAITRESS_THREADS", 16)

# --- Caches -------------------------------------------------------------------
ACCOUNTS_CACHE_TTL = _env_float("ACCOUNTS_CACHE_TTL", 90.0)
ASSETS_CACHE_TTL = _env_float("ASSETS_CACHE_TTL", 90.0)
LEVERAGE_CACHE_TTL = _env_float("LEVERAGE_CACHE_TTL", 86400.0)

# --- Pollers ------------------------------------------------------------------
RUN_POLLERS = _env_bool("RUN_POLLERS", True)
BALANCES_FETCH_INTERVAL = _env_float("BALANCES_FETCH_INTERVAL", 300.0)
POSITIONS_FETCH_INTERVAL = _env_float("POSITIONS_FETCH_INTERVAL", 300.0)
TRANSFERS_FETCH_INTERVAL = _env_float("TRANSFERS_FETCH_INTERVAL", 600.0)
TRANSFERS_LOOKBACK_DAYS = _env_int("TRANSFERS_LOOKBACK_DAYS", 3)
PAST_POSITIONS_FETCH_INTERVAL = _env_float("PAST_POSITIONS_FETCH_INTERVAL", 60.0)
INCOME_LOOKBACK_HOURS = _env_int("INCOME_LOOKBACK_HOURS", 24)
# Closes younger than this are deferred so Binance can index userTrades.
PAST_POSITIONS_INDEXING_LAG_SECONDS = _env_float("PAST_POSITIONS_INDEXING_LAG_SECONDS", 120.0)

# --- Retry queue --------------------------------------------------------------
RETRY_ENABLED = _env_bool("RETRY_ENABLED", True)
RETRY_INTERVAL_SECONDS = _env_float("RETRY_INTERVAL_SECONDS", 60.0)
RETRY_MAX_ATTEMPTS = _env_int("RETRY_MAX_ATTEMPTS", 5)

# --- Sizing -------------------------------------------------------------------
REFERENCE_BALANCE = _env_float("REFERENCE_BALANCE", 1000.0)
# Entries are refused below this much total deposited capital (initial_deposit
# net of later deposits/withdrawals, supplied by the accounts endpoint). The
# gate is on DEPOSIT, not balance: an account funded above the threshold keeps
# trading after a drawdown. 0 disables the gate. Exits are never gated — a
# position must always be closable.
MIN_DEPOSIT = _env_float("MIN_DEPOSIT", 1000.0)
# Tickers whose size only scales in whole base_size steps (no /10 fine steps).
COARSE_STEP_TICKERS = {
    t.strip().upper()
    for t in _env_str("COARSE_STEP_TICKERS", "BTCUSDT").split(",")
    if t.strip()
}

# --- Telegram notifications ----------------------------------------------------
# Entries, exits + PnL percent go to TELEGRAM_CHAT_ID; operational alerts
# (rejected signals, per-account failures, poller crashes) go to
# TELEGRAM_ADMIN_CHAT_ID, which falls back to the main chat when unset.
# Everything is off unless BOTH a bot token and a chat id are configured.
TELEGRAM_ENABLED = _env_bool("TELEGRAM_ENABLED", True)
TELEGRAM_BOT_TOKEN = _env_str("TELEGRAM_BOT_TOKEN", "")  # secret — .env only
TELEGRAM_CHAT_ID = _env_str("TELEGRAM_CHAT_ID", "")      # -100... id or @channelname
TELEGRAM_ADMIN_CHAT_ID = _env_str("TELEGRAM_ADMIN_CHAT_ID", "")
# How long an exit message waits for every closed account to report its realized
# PnL (read from userTrades, deferred) before sending with whatever arrived.
TELEGRAM_PNL_WAIT_SECONDS = _env_float("TELEGRAM_PNL_WAIT_SECONDS", 25.0)

# --- Local output -------------------------------------------------------------
OUT_DIR = PROJECT_ROOT / "out"
OUT_DIR.mkdir(exist_ok=True)


def engine_headers() -> dict[str, str]:
    """Headers for every sinegutrade-api engine call."""
    return {"X-Engine-Secret": ENGINE_SECRET, "Accept": "application/json"}


def engine_url(path: str) -> str:
    """Absolute URL for an engine endpoint path like 'accounts'."""
    return f"{ENGINE_API_BASE}/engine/{ENGINE_EXCHANGE}/{path.lstrip('/')}"
