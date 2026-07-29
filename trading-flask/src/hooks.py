import os
from pathlib import Path
from dotenv import load_dotenv

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env", override=False)


def _env_str(key: str) -> str:
    value = os.environ.get(key)
    if value is None:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


def _env_int(key: str) -> int:
    value = _env_str(key)
    try:
        return int(value)
    except (TypeError, ValueError):
        raise RuntimeError(f"Environment variable {key} must be an integer, got: {value}")


def _env_float(key: str) -> float:
    value = _env_str(key)
    try:
        return float(value)
    except (TypeError, ValueError):
        raise RuntimeError(f"Environment variable {key} must be a float, got: {value}")


def _env_bool(key: str) -> bool:
    value = _env_str(key).strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"Environment variable {key} must be boolean, got: {value}")


BINANCE_API_BASE: str = _env_str("BINANCE_API_BASE")
API_TIMEOUT: int = _env_int("BINANCE_API_TIMEOUT")
POSITION_MODE: str = _env_str("BINANCE_POSITION_MODE")
BINANCE_SYNC_POSITION_MODE_ON_STARTUP: bool = _env_bool("BINANCE_SYNC_POSITION_MODE_ON_STARTUP")
WEBHOOK_SECRET: str = _env_str("BINANCE_WEBHOOK_SECRET")
LIVE_QUANTITY: float = _env_float("BINANCE_LIVE_QUANTITY")
FLASK_PORT: int = _env_int("BINANCE_FLASK_PORT")
OUT_DIR: str = str(_PROJECT_ROOT / "out")
LOG_INTERVAL: int = _env_int("BINANCE_LOG_INTERVAL")

# ─── Account tier routing (by deposit + balance) ──────────────────────────
# MAIN: deposited >= MAIN_MIN_DEPOSIT (stays main forever, even if balance later drops),
#       OR promoted because balance reached LITE_MAX_BALANCE.
# LITE: deposited below MAIN_MIN_DEPOSIT and not yet promoted
#       (LITE_MIN_BALANCE <= balance < LITE_MAX_BALANCE).
# The two are mutually exclusive. Dust (deposit < MAIN_MIN_DEPOSIT and balance < LITE_MIN_BALANCE)
# trades on neither. Used to gate ENTRIES only; exits always close whatever exists.
MAIN_MIN_DEPOSIT: float = float(os.environ.get("BINANCE_MAIN_MIN_DEPOSIT") or "500")
LITE_MIN_BALANCE: float = float(os.environ.get("BINANCE_LITE_MIN_BALANCE") or "100")
LITE_MAX_BALANCE: float = float(os.environ.get("BINANCE_LITE_MAX_BALANCE") or "500")


def _as_float(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def is_main_account(initial_deposit, balance) -> bool:
    """Account trades on the MAIN bot: deposited >= MAIN_MIN_DEPOSIT (stays main even if
    balance later drops), or promoted because balance reached LITE_MAX_BALANCE."""
    return _as_float(initial_deposit) >= MAIN_MIN_DEPOSIT or _as_float(balance) >= LITE_MAX_BALANCE


def is_lite_account(initial_deposit, balance) -> bool:
    """Account trades on the LITE bot: deposited below MAIN_MIN_DEPOSIT and not yet
    promoted (balance within [LITE_MIN_BALANCE, LITE_MAX_BALANCE))."""
    return _as_float(initial_deposit) < MAIN_MIN_DEPOSIT and LITE_MIN_BALANCE <= _as_float(balance) < LITE_MAX_BALANCE
POSITIONS_FETCH_INTERVAL: int = _env_int("BINANCE_POSITIONS_FETCH_INTERVAL")
TRANSFERS_FETCH_INTERVAL: int = _env_int("BINANCE_TRANSFERS_FETCH_INTERVAL")
BALANCES_FETCH_INTERVAL: int = _env_int("BINANCE_BALANCES_FETCH_INTERVAL")
TRANSFERS_LOOKBACK_DAYS: int = _env_int("BINANCE_TRANSFERS_LOOKBACK_DAYS")
API_BASE_URL: str = _env_str("BINANCE_API_BASE_URL")
ASSETS_ENDPOINT: str = _env_str("BINANCE_ASSETS_ENDPOINT")
ASSETS_BROKER: str = (os.environ.get("BINANCE_ASSETS_BROKER") or "Binance").strip()
BINANCE_ACCOUNTS_ENDPOINT: str = _env_str("BINANCE_ACCOUNTS_ENDPOINT")
INSERT_POSITIONS_ENDPOINT: str = _env_str("BINANCE_INSERT_POSITIONS_ENDPOINT")
INSERT_PAST_POSITION_ENDPOINT: str = _env_str("BINANCE_INSERT_PAST_POSITION_ENDPOINT")
SYNC_PAST_POSITIONS_ENDPOINT: str = (os.environ.get("BINANCE_SYNC_PAST_POSITIONS_ENDPOINT") or "/api/flask/sync-past-positions").strip()
UPSERT_POSITION_ENDPOINT: str = (os.environ.get("BINANCE_UPSERT_POSITION_ENDPOINT") or "/api/flask/position").strip()
POSITION_CHECK_ENDPOINT: str = (os.environ.get("BINANCE_POSITION_CHECK_ENDPOINT") or "/api/flask/position-check").strip()
TRADE_LOG_ENDPOINT: str = (os.environ.get("BINANCE_TRADE_LOG_ENDPOINT") or "/api/flask/trade-log").strip()
INSERT_TRANSACTIONS_ENDPOINT: str = _env_str("BINANCE_INSERT_TRANSACTIONS_ENDPOINT")
UPDATE_BALANCE_ENDPOINT: str = _env_str("BINANCE_UPDATE_BALANCE_ENDPOINT")
PAST_POSITIONS_FETCH_INTERVAL: int = int(os.environ.get("BINANCE_PAST_POSITIONS_FETCH_INTERVAL") or "60")
INCOME_LOOKBACK_HOURS: int = int(os.environ.get("BINANCE_INCOME_LOOKBACK_HOURS") or "24")
# Defer past-position rows whose close is newer than this, so Binance userTrades
# have time to index before we reconstruct (avoids writing un-enrichable junk rows).
PAST_POSITIONS_INDEXING_LAG_SECONDS: int = int(os.environ.get("BINANCE_PAST_POSITIONS_INDEXING_LAG_SECONDS") or "120")

# In-memory cache TTLs (seconds). Webhook reads accounts + assets from Laravel; caching
# avoids re-fetching on every trade. Default 60s; admin can force-invalidate via /admin/refresh-*.
ACCOUNTS_CACHE_TTL: int = int(os.environ.get("BINANCE_ACCOUNTS_CACHE_TTL") or "60")
ASSETS_CACHE_TTL: int = int(os.environ.get("BINANCE_ASSETS_CACHE_TTL") or "60")

# Secret/token used for calls from this Flask app -> trading-api /api/flask/*
# Keep webhook secret separate; this one defaults to Laravel's local default secret list.
TRADING_API_WEBHOOK_SECRET: str = (os.environ.get("TRADING_API_WEBHOOK_SECRET") or "binance_bot").strip()
TRADING_API_BEARER_TOKEN: str = (os.environ.get("TRADING_API_BEARER_TOKEN") or "").strip()
# Shared secret used by trading-api → Flask /close_position calls.
OUTGOING_SECRET: str = (os.environ.get("FLASK_OUTGOING_SECRET") or "").strip()


def trading_api_headers() -> dict:
    headers = {
        "X-Webhook-Secret": TRADING_API_WEBHOOK_SECRET,
        "Accept": "application/json",
    }
    if TRADING_API_BEARER_TOKEN:
        headers["Authorization"] = f"Bearer {TRADING_API_BEARER_TOKEN}"
    return headers
