"""
Poll MEXC Futures open positions for all enabled accounts.
Loops every POSITIONS_FETCH_INTERVAL seconds, snapshotting open positions to
POST /api/flask/mexc-positions (replaces previous snapshot). Closed positions
are recorded by the webhook handler at trade time, not here.

Run: python -m mexc_src.fetch_positions
"""

import logging
import sys
import time
from pathlib import Path
from typing import List, Tuple

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import requests

from mexc_src.hooks import (
    API_BASE_URL,
    INSERT_POSITIONS_ENDPOINT,
    POSITIONS_FETCH_INTERVAL,
    trading_api_headers,
)
from mexc_src.mexc_api import MexcFuturesAPI
from mexc_src.position_enrich import enrich_open_position_unrealized
from mexc_src.mexc_accounts_api import fetch_mexc_accounts

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _mask(key: str) -> str:
    if not key or len(key) < 12:
        return "***" if key else "-"
    return f"{key[:8]}...{key[-4:]}"


def _get_accounts() -> List[Tuple[str, str, str, str]]:
    accounts = fetch_mexc_accounts()
    if not accounts:
        return []
    return [
        (a.get("api_key", ""), a.get("secret_key", ""), a.get("name") or "?", a.get("uni_id") or "")
        for a in accounts
    ]


def _post_url(endpoint: str) -> str:
    base = (API_BASE_URL or "").rstrip("/")
    path = endpoint if endpoint.startswith("/") else "/" + endpoint
    return base + path


def _post_positions(accounts_payload: list) -> bool:
    try:
        resp = requests.post(
            _post_url(INSERT_POSITIONS_ENDPOINT),
            json={"accounts": accounts_payload},
            headers=trading_api_headers(),
            timeout=15,
        )
        if resp.ok:
            inserted = resp.json().get("inserted", 0)
            logger.info("Positions snapshot saved (%d rows)", inserted)
            return True
        logger.warning("insert_positions failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("Could not post positions: %s", e)
    return False


def fetch_and_save() -> None:
    accounts = _get_accounts()
    if not accounts:
        logger.warning("No MEXC accounts (check trading-api)")
        return

    accounts_payload: List[dict] = []

    for api_key, secret_key, name, uni_id in accounts:
        masked = _mask(api_key)
        logger.info("Fetch positions [%s] %s", name, masked)
        try:
            api = MexcFuturesAPI(api_key, secret_key)
            positions = api.get_open_positions()
        except Exception as e:
            logger.warning("[%s] fetch failed: %s", name, e)
            continue

        logger.info("[%s] %d open positions", name, len(positions))

        enriched = [enrich_open_position_unrealized(api, p) for p in positions]
        accounts_payload.append({
            "api_key": api_key,
            "uni_id": uni_id,
            "positions": enriched,
        })

    if accounts_payload:
        _post_positions(accounts_payload)


if __name__ == "__main__":
    logger.info("MEXC Fetch Positions starting (interval=%ss)", POSITIONS_FETCH_INTERVAL)
    while True:
        try:
            fetch_and_save()
        except Exception as e:
            logger.exception("fetch_and_save error: %s", e)
        time.sleep(POSITIONS_FETCH_INTERVAL)
