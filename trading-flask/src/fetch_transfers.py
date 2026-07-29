"""
Fetch Binance Futures wallet transfers (deposits and withdrawals in/out of Futures).
Uses GET /fapi/v1/income with incomeType=TRANSFER. Only last N days (from hooks).
Loops every TRANSFERS_FETCH_INTERVAL seconds. Inserts into DB via insert_transactions API.
Run: python -m src.fetch_transfers
"""

import logging
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import requests

from src.hooks import (
    API_BASE_URL,
    INSERT_TRANSACTIONS_ENDPOINT,
    TRANSFERS_FETCH_INTERVAL,
    TRANSFERS_LOOKBACK_DAYS,
    trading_api_headers,
)
from src.binance_api import BinanceAPI
from src.binance_accounts_api import fetch_binance_accounts

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

INCOME_TYPE_TRANSFER = "TRANSFER"
DEFAULT_LIMIT = 1000


def _mask_api_key(key: str) -> str:
    if not key or len(key) < 12:
        return "***" if key else "-"
    return f"{key[:8]}...{key[-4:]}"


def _get_accounts():
    """List of (api_key, secret_key, name, uni_id) for enabled accounts from binance_accounts table."""
    accounts = fetch_binance_accounts()
    if accounts and len(accounts) > 0:
        return [(a.get("api_key"), a.get("secret_key"), a.get("name") or "?", a.get("uni_id") or "") for a in accounts]
    return []


def _post_transfers_to_api(accounts_payload: list) -> bool:
    """POST transfers to trading-api insert_transactions. Returns True on success."""
    if not API_BASE_URL:
        logger.warning("API_BASE_URL not set - cannot post transfers")
        return False
    try:
        base = API_BASE_URL.rstrip("/")
        path = INSERT_TRANSACTIONS_ENDPOINT if INSERT_TRANSACTIONS_ENDPOINT.startswith("/") else "/" + INSERT_TRANSACTIONS_ENDPOINT
        url = base + path
        resp = requests.post(url, json={"accounts": accounts_payload}, headers=trading_api_headers(), timeout=15)
        if resp.ok:
            data = resp.json()
            inserted = data.get("inserted", 0)
            skipped = data.get("skipped", 0)
            logger.info("Posted transfers to API %s (inserted: %d, skipped: %d)", url, inserted, skipped)
            return True
        logger.warning("insert_transactions API failed: %s %s", resp.status_code, resp.text[:200])
        return False
    except Exception as e:
        logger.warning("Could not post transfers to API: %s", e)
        return False


def _parse_transfer(record: dict) -> dict:
    """Normalize income record to a transfer entry with direction and amount."""
    income_str = record.get("income", "0")
    try:
        amount = float(income_str)
    except (TypeError, ValueError):
        amount = 0.0
    direction = "deposit" if amount > 0 else "withdrawal"
    ts = record.get("time")
    time_utc = None
    if ts is not None:
        try:
            time_utc = datetime.utcfromtimestamp(int(ts) / 1000).strftime("%Y-%m-%d %H:%M:%S")
        except (TypeError, ValueError):
            pass
    return {
        "tranId": record.get("tranId"),
        "time": ts,
        "time_utc": time_utc,
        "asset": record.get("asset", ""),
        "income": income_str,
        "amount": amount,
        "direction": direction,
        "info": record.get("info", ""),
    }


def fetch_and_save(limit: int = DEFAULT_LIMIT) -> bool:
    accounts_list = _get_accounts()
    if not accounts_list:
        logger.warning("No Binance accounts (check trading-api or .env)")
        return False

    now_ms = int(time.time() * 1000)
    start_ms = int((datetime.utcnow() - timedelta(days=TRANSFERS_LOOKBACK_DAYS)).timestamp() * 1000)
    accounts_payload = []

    for api_key, secret_key, name, uni_id in accounts_list:
        masked = _mask_api_key(api_key)
        logger.info("Fetch transfers [%s] API key: %s", name, masked)
        try:
            api = BinanceAPI(api_key, secret_key)
            raw = api.get_income_history(
                income_type=INCOME_TYPE_TRANSFER,
                start_time=start_ms,
                end_time=now_ms,
                limit=limit,
            )
        except Exception as e:
            logger.warning("[%s] API key: %s — failed: %s", name, masked, e)
            continue

        transfers = [_parse_transfer(r) for r in (raw or [])]
        total_deposits = sum(t["amount"] for t in transfers if t["amount"] > 0)
        total_withdrawals = sum(abs(t["amount"]) for t in transfers if t["amount"] < 0)
        logger.info("[%s] API key: %s — %d transfers, deposits: %s, withdrawals: %s",
                    name, masked, len(transfers), total_deposits, total_withdrawals)
        accounts_payload.append({"api_key": api_key, "uni_id": uni_id, "transfers": transfers})

    _post_transfers_to_api(accounts_payload)
    return True


if __name__ == "__main__":
    while True:
        fetch_and_save(limit=DEFAULT_LIMIT)
        time.sleep(TRANSFERS_FETCH_INTERVAL)
