"""
Poll Bybit linear futures open positions for all bybit_accounts (enabled=1).
Loops every POSITIONS_FETCH_INTERVAL seconds and POSTs snapshots to trading-api.
Run: python -m bybit_src.fetch_positions
"""

import logging
import os
import sys
import time
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import requests

from bybit_src.hooks import (
    API_BASE_URL,
    INSERT_POSITIONS_ENDPOINT,
    trading_api_headers,
)
from bybit_src.bybit_api import BybitAPI, _is_ok
from bybit_src.bybit_accounts_api import fetch_bybit_accounts

POSITIONS_FETCH_INTERVAL: int = int(os.environ.get("POSITIONS_FETCH_INTERVAL", "10"))
CATEGORY = "linear"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _mask_api_key(key: str) -> str:
    if not key or len(key) < 12:
        return "***" if key else "-"
    return f"{key[:8]}...{key[-4:]}"


def _get_accounts():
    accounts = fetch_bybit_accounts()
    if accounts and len(accounts) > 0:
        return [
            (a.get("api_key"), a.get("secret_key"), a.get("name") or "?", a.get("uni_id") or "")
            for a in accounts
        ]
    return []


def _post_positions_to_api(accounts_payload: list) -> bool:
    if not API_BASE_URL:
        logger.warning("API_BASE_URL not set - cannot post positions")
        return False
    try:
        base = API_BASE_URL.rstrip("/")
        path = INSERT_POSITIONS_ENDPOINT if INSERT_POSITIONS_ENDPOINT.startswith("/") else "/" + INSERT_POSITIONS_ENDPOINT
        url = base + path
        resp = requests.post(
            url,
            json={"accounts": accounts_payload},
            headers=trading_api_headers(),
            timeout=15,
        )
        if resp.ok:
            data = resp.json()
            inserted = data.get("inserted", 0)
            logger.info("Posted positions to API %s (inserted: %d rows)", url, inserted)
            return True
        logger.warning("insert_bybit_positions API failed: %s %s", resp.status_code, resp.text[:200])
        return False
    except Exception as e:
        logger.warning("Could not post positions to API: %s", e)
        return False


def fetch_and_save() -> bool:
    accounts_list = _get_accounts()
    if not accounts_list:
        logger.warning("No Bybit accounts (check trading-api)")
        return False

    accounts_payload = []
    for api_key, secret_key, name, uni_id in accounts_list:
        masked = _mask_api_key(api_key)
        logger.info("Fetch positions [%s] API key: %s", name, masked)
        try:
            api = BybitAPI(api_key, secret_key)
            raw = api._get("/v5/position/list", {"category": CATEGORY})
        except Exception as e:
            logger.warning("[%s] API key: %s — failed: %s", name, masked, e)
            continue

        if not _is_ok(raw):
            logger.warning("[%s] get positions failed: %s", name, raw)
            continue

        position_list = (raw or {}).get("result", {}).get("list", [])
        open_positions = [p for p in position_list if float(p.get("size", 0) or 0) > 0]
        logger.info("[%s] %d open position(s)", name, len(open_positions))

        normalized = []
        for p in open_positions:
            normalized.append({
                "symbol":       p.get("symbol", ""),
                "side":         p.get("side", ""),
                "positionSide": "Long" if p.get("side") == "Buy" else "Short",
                "size":         p.get("size", 0),
                "avgPrice":     p.get("avgPrice", 0),
                "markPrice":    p.get("markPrice", 0),
                "liqPrice":     p.get("liqPrice", 0),
                "unrealisedPnl": p.get("unrealisedPnl", 0),
                "leverage":     p.get("leverage", 1),
                "positionIdx":  p.get("positionIdx", 0),
            })

        accounts_payload.append({
            "api_key":   api_key,
            "uni_id":    uni_id,
            "positions": normalized,
        })

    if accounts_payload:
        _post_positions_to_api(accounts_payload)
    logger.info("Positions update cycle done")
    return True


if __name__ == "__main__":
    while True:
        fetch_and_save()
        time.sleep(POSITIONS_FETCH_INTERVAL)
