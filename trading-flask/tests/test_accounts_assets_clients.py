"""TTLCache semantics + accounts/assets client parsing."""

from __future__ import annotations

import threading
import time
from unittest.mock import patch

import binance_abcd.accounts_api as accounts_api
import binance_abcd.assets_api as assets_api
from binance_abcd.cache import TTLCache


def test_ttl_cache_caches_within_ttl():
    calls = []
    cache = TTLCache(10.0, lambda: calls.append(1) or {"v": len(calls)})
    assert cache.get() == {"v": 1}
    assert cache.get() == {"v": 1}
    assert len(calls) == 1


def test_ttl_cache_refreshes_after_expiry():
    calls = []
    cache = TTLCache(0.01, lambda: calls.append(1) or {"v": len(calls)})
    cache.get()
    time.sleep(0.03)
    assert cache.get() == {"v": 2}


def test_ttl_cache_serves_stale_on_loader_failure():
    state = {"fail": False}

    def loader():
        if state["fail"]:
            raise RuntimeError("backend down")
        return ["good"]

    cache = TTLCache(0.01, loader)
    assert cache.get() == ["good"]
    state["fail"] = True
    time.sleep(0.03)
    assert cache.get() == ["good"]  # stale value, not None


def test_ttl_cache_single_flight():
    """Concurrent expired gets trigger exactly one loader call."""
    calls = []

    def slow_loader():
        calls.append(1)
        time.sleep(0.05)
        return {"v": len(calls)}

    cache = TTLCache(60.0, slow_loader)
    threads = [threading.Thread(target=cache.get) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(calls) == 1


def test_accounts_client_filters_incomplete_rows():
    payload = {"success": True, "accounts": [
        {"api_key": "k1", "secret_key": "s1", "uni_id": "u1"},
        {"api_key": "", "secret_key": "s2"},       # unusable
        {"secret_key": "s3"},                       # unusable
    ]}
    with patch.object(accounts_api.engine_client, "get_json", return_value=payload):
        accounts_api.invalidate_accounts_cache()
        accounts = accounts_api.fetch_accounts(force=True)
    assert [a["api_key"] for a in accounts] == ["k1"]


def test_demo_flag_selects_testnet_base():
    assert "demo-fapi" in accounts_api.account_futures_base_url({"demo": True})
    assert "demo-fapi" not in accounts_api.account_futures_base_url({"demo": False})
    assert "demo-fapi" not in accounts_api.account_futures_base_url({})


def test_assets_client_indexes_enabled_by_ticker():
    payload = {"success": True, "assets": [
        {"ticker": "btcusdt", "base_size": "0.005", "max_increments": "10", "side": "all", "enabled": True},
        {"ticker": "OFFUSDT", "base_size": 1, "max_increments": 1, "side": "ALL", "enabled": False},
        {"ticker": "", "base_size": 1, "enabled": True},
        {"ticker": "BADUSDT", "base_size": "junk", "max_increments": None, "side": None, "enabled": True},
    ]}
    with patch.object(assets_api.engine_client, "get_json", return_value=payload):
        assets_api.invalidate_assets_cache()
        assets = assets_api.fetch_assets(force=True)

    assert set(assets) == {"BTCUSDT", "BADUSDT"}
    btc = assets["BTCUSDT"]
    assert btc["base_size"] == 0.005 and btc["max_increments"] == 10.0 and btc["side"] == "ALL"
    # Unparseable numerics collapse to 0 (entry will fail closed on base_size).
    assert assets["BADUSDT"]["base_size"] == 0.0
    assert assets["BADUSDT"]["side"] == "ALL"
