"""Lite-specific config. Re-exports main hooks and adds BINANCE_LITE_* overrides."""

import os
from pathlib import Path

from src.hooks import *  # noqa: F401,F403 — re-export everything
from src.hooks import _env_int, _env_str  # type: ignore


_PROJECT_ROOT = Path(__file__).resolve().parent.parent

LITE_FLASK_PORT: int = int(os.environ.get("BINANCE_LITE_FLASK_PORT") or "5003")
LITE_WEBHOOK_SECRET: str = (
    os.environ.get("BINANCE_LITE_WEBHOOK_SECRET")
    or os.environ.get("BINANCE_WEBHOOK_SECRET")
    or ""
).strip()
LITE_OUT_DIR: str = str(_PROJECT_ROOT / "out_lite")

# Tier thresholds (LITE_MIN_BALANCE / LITE_MAX_BALANCE / MAIN_MIN_DEPOSIT) and the
# is_main_account / is_lite_account helpers are inherited from src.hooks (import * above)
# so the main and lite bots always agree on routing.

# Tickers (Binance symbols) for which the lite bot refuses ENTRIES (BUY/SELL).
# Exits (EXIT_LONG/EXIT_SHORT) are always allowed so open positions can still close.
# Comma-separated env override; defaults to blocking BTC.
LITE_NO_ENTRY_TICKERS = {
    t.strip().upper()
    for t in (os.environ.get("BINANCE_LITE_NO_ENTRY_TICKERS") or "BTCUSDT").split(",")
    if t.strip()
}
