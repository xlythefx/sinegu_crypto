"""
Poll Bybit UNIFIED wallet USDT balance for all bybit_accounts (enabled=1).
Loops every BALANCES_FETCH_INTERVAL seconds and POSTs to trading-api update_balance.
Run: python -m bybit_src.fetch_balances
"""

import logging
import sys
import time
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import requests

from bybit_src.hooks import (
    API_BASE_URL,
    BALANCES_FETCH_INTERVAL,
    UPDATE_BALANCE_ENDPOINT,
    trading_api_headers,
)
from bybit_src.bybit_api import BybitAPI
from bybit_src.bybit_accounts_api import fetch_bybit_accounts

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _mask_api_key(key: str) -> str:
    if not key or len(key) < 12:
        return "***" if key else "-"
    return f"{key[:8]}...{key[-4:]}"


def _get_accounts():
    accounts = fetch_bybit_accounts()
    if accounts and len(accounts) > 0:
        return [(a.get("api_key"), a.get("secret_key"), a.get("name") or "?") for a in accounts]
    return []


def _post_balances_to_api(accounts_payload: list) -> bool:
    if not API_BASE_URL:
        logger.warning("API_BASE_URL not set - cannot post balances")
        return False
    try:
        base = API_BASE_URL.rstrip("/")
        path = UPDATE_BALANCE_ENDPOINT if UPDATE_BALANCE_ENDPOINT.startswith("/") else "/" + UPDATE_BALANCE_ENDPOINT
        url = base + path
        resp = requests.post(
            url,
            json={"accounts": accounts_payload, "broker": "bybit"},
            headers=trading_api_headers(),
            timeout=15,
        )
        if resp.ok:
            data = resp.json()
            updated = data.get("updated", 0)
            logger.info("Posted balance updates to API %s (updated: %d accounts)", url, updated)
            return True
        logger.warning("update_balance API failed: %s %s", resp.status_code, resp.text[:200])
        return False
    except Exception as e:
        logger.warning("Could not post balances to API: %s", e)
        return False


def fetch_and_save() -> bool:
    accounts_list = _get_accounts()
    if not accounts_list:
        logger.warning("No Bybit accounts (check trading-api)")
        return False

    accounts_payload = []
    for api_key, secret_key, name in accounts_list:
        masked = _mask_api_key(api_key)
        logger.info("Fetch balance [%s] API key: %s", name, masked)
        try:
            api = BybitAPI(api_key, secret_key)
            balance = api.get_usdt_balance()
        except Exception as e:
            logger.warning("[%s] API key: %s — failed: %s", name, masked, e)
            continue

        logger.info("[%s] API key: %s — USDT balance: %s", name, masked, balance)
        accounts_payload.append({
            "api_key": api_key,
            "balance": balance,
            "initial_deposit": balance,
        })

    _post_balances_to_api(accounts_payload)
    logger.info("Balance update cycle done")
    return True


if __name__ == "__main__":
    while True:
        fetch_and_save()
        time.sleep(BALANCES_FETCH_INTERVAL)
