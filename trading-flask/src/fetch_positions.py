"""Fetch Binance positions. Loops every POSITIONS_FETCH_INTERVAL seconds, inserts into DB via insert_positions API."""

import logging
import sys
import time
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import requests

from src.hooks import (
    API_BASE_URL,
    INSERT_POSITIONS_ENDPOINT,
    POSITIONS_FETCH_INTERVAL,
    trading_api_headers,
)
from src.binance_api import BinanceAPI
from src.binance_accounts_api import fetch_binance_accounts

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _mask_api_key(key: str) -> str:
    if not key or len(key) < 12:
        return "***" if key else "-"
    return f"{key[:8]}...{key[-4:]}"


def _get_trade_accounts():
    """Get list of (api_key, secret_key, name, uni_id) for enabled accounts from binance_accounts table."""
    accounts = fetch_binance_accounts()
    if accounts and len(accounts) > 0:
        return [(a.get("api_key"), a.get("secret_key"), a.get("name") or "?", a.get("uni_id") or "") for a in accounts]
    return []


def _post_positions_to_api(accounts_payload: list) -> bool:
    """POST positions to trading-api insert_positions. Returns True on success."""
    if not API_BASE_URL:
        logger.warning("API_BASE_URL not set - cannot post positions")
        return False
    try:
        base = API_BASE_URL.rstrip("/")
        path = INSERT_POSITIONS_ENDPOINT if INSERT_POSITIONS_ENDPOINT.startswith("/") else "/" + INSERT_POSITIONS_ENDPOINT
        url = base + path
        resp = requests.post(url, json={"accounts": accounts_payload}, headers=trading_api_headers(), timeout=15)
        if resp.ok:
            data = resp.json()
            inserted = data.get("inserted", 0)
            logger.info("Posted %d positions to API %s", inserted, url)
            return True
        logger.warning("insert_positions API failed: %s %s", resp.status_code, resp.text[:200])
        return False
    except Exception as e:
        logger.warning("Could not post positions to API: %s", e)
        return False


def fetch_and_save():
    trade_accounts = _get_trade_accounts()
    if not trade_accounts:
        logger.warning("No Binance accounts (check trading-api or .env)")
        return

    accounts_payload = []
    total_positions = 0

    for api_key, secret_key, name, uni_id in trade_accounts:
        masked = _mask_api_key(api_key)
        logger.info("Fetch positions [%s] API key: %s", name, masked)
        try:
            api = BinanceAPI(api_key, secret_key)
            positions = api.get_positions_v3()
        except Exception as e:
            logger.warning("[%s] API key: %s — failed: %s", name, masked, e)
            continue

        logger.info("[%s] API key: %s — %d positions", name, masked, len(positions))
        total_positions += len(positions)
        accounts_payload.append({"api_key": api_key, "uni_id": uni_id, "positions": positions})

    _post_positions_to_api(accounts_payload)


if __name__ == "__main__":
    while True:
        fetch_and_save()
        time.sleep(POSITIONS_FETCH_INTERVAL)
