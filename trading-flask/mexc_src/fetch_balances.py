"""
Poll MEXC Futures (contract) USDT wallet for all mexc_accounts (enabled=1).
Loops every BALANCES_FETCH_INTERVAL seconds and POSTs the futures wallet equity
to trading-api (/api/flask/balance?broker=mexc).
Run: python -m mexc_src.fetch_balances
"""

import logging
import sys
import time
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import requests

from mexc_src.hooks import (
    API_BASE_URL,
    BALANCES_FETCH_INTERVAL,
    UPDATE_BALANCE_ENDPOINT,
    trading_api_headers,
)
from mexc_src.mexc_api import MexcFuturesAPI
from mexc_src.mexc_accounts_api import fetch_mexc_accounts

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _mask_api_key(key: str) -> str:
    if not key or len(key) < 12:
        return "***" if key else "-"
    return f"{key[:8]}...{key[-4:]}"


def _get_accounts():
    accounts = fetch_mexc_accounts()
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
            json={"accounts": accounts_payload, "broker": "mexc"},
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
        logger.warning("No MEXC accounts (check trading-api)")
        return False

    accounts_payload = []
    for api_key, secret_key, name in accounts_list:
        masked = _mask_api_key(api_key)
        logger.info("Fetch futures USDT [%s] API key: %s", name, masked)
        try:
            api = MexcFuturesAPI(api_key, secret_key)
            row = api.get_asset("USDT")
        except Exception as e:
            logger.warning("[%s] API key: %s — failed: %s", name, masked, e)
            continue

        if not row:
            logger.warning("[%s] API key: %s — no USDT asset data", name, masked)
            continue

        try:
            equity = float(row.get("equity", 0) or 0)
        except (TypeError, ValueError):
            equity = 0.0

        logger.info("[%s] API key: %s — USDT equity: %s", name, masked, equity)
        accounts_payload.append({
            "api_key": api_key,
            "balance": equity,
            "initial_deposit": equity,
        })

    _post_balances_to_api(accounts_payload)
    logger.info("Balance update cycle done")
    return True


if __name__ == "__main__":
    while True:
        fetch_and_save()
        time.sleep(BALANCES_FETCH_INTERVAL)
