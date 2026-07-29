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


BYBIT_API_BASE: str = _env_str("BYBIT_API_BASE")
API_TIMEOUT: int = _env_int("BYBIT_API_TIMEOUT")
POSITION_MODE: str = _env_str("BYBIT_POSITION_MODE")
BYBIT_WARN_POSITION_MODE_MISMATCH: bool = _env_bool("BYBIT_WARN_POSITION_MODE_MISMATCH")
WEBHOOK_SECRET: str = _env_str("BYBIT_WEBHOOK_SECRET")
LIVE_QUANTITY: float = _env_float("BYBIT_LIVE_QUANTITY")
DEFAULT_LEVERAGE: int = _env_int("BYBIT_DEFAULT_LEVERAGE")
FLASK_PORT: int = _env_int("BYBIT_FLASK_PORT")
OUT_DIR: str = str(_PROJECT_ROOT / "bybit_src" / "out")
LOG_INTERVAL: int = _env_int("BYBIT_LOG_INTERVAL")
BALANCES_FETCH_INTERVAL: int = _env_int("BYBIT_BALANCES_FETCH_INTERVAL")
API_BASE_URL: str = _env_str("BYBIT_API_BASE_URL")
ASSETS_ENDPOINT: str = _env_str("BYBIT_ASSETS_ENDPOINT")
BYBIT_ACCOUNTS_ENDPOINT: str = _env_str("BYBIT_ACCOUNTS_ENDPOINT")
INSERT_POSITIONS_ENDPOINT: str = _env_str("BYBIT_INSERT_POSITIONS_ENDPOINT")
INSERT_PAST_POSITION_ENDPOINT: str = _env_str("BYBIT_INSERT_PAST_POSITION_ENDPOINT")
UPDATE_BALANCE_ENDPOINT: str = _env_str("BYBIT_UPDATE_BALANCE_ENDPOINT")

ACCOUNTS_CACHE_TTL: int = int(os.environ.get("BYBIT_ACCOUNTS_CACHE_TTL") or "60")
ASSETS_CACHE_TTL: int = int(os.environ.get("BYBIT_ASSETS_CACHE_TTL") or "60")

# Secret/token used for calls from this Flask app -> trading-api /api/flask/*
# Keep webhook secret separate; this one defaults to Laravel's local default secret list.
TRADING_API_WEBHOOK_SECRET: str = (os.environ.get("TRADING_API_WEBHOOK_SECRET") or WEBHOOK_SECRET).strip()
TRADING_API_BEARER_TOKEN: str = (os.environ.get("TRADING_API_BEARER_TOKEN") or "").strip()


def trading_api_headers() -> dict:
    headers = {"X-Webhook-Secret": TRADING_API_WEBHOOK_SECRET}
    if TRADING_API_BEARER_TOKEN:
        headers["Authorization"] = f"Bearer {TRADING_API_BEARER_TOKEN}"
    return headers
