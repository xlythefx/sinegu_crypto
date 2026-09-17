"""The exchange registry: which venues run, how an account becomes a client,
and how every engine-API call finds its /engine/{exchange}/ segment."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import binance_abcd.accounts_api as accounts_api
import binance_abcd.assets_api as assets_api
import binance_abcd.engine_client as engine_client
import binance_abcd.exchanges as exchanges
import binance_abcd.hooks as hooks
import binance_abcd.key_status as key_status
from binance_abcd.binance_adapter import BinanceAdapter
from binance_abcd.mexc_adapter import MexcAdapter


# --- Registry ------------------------------------------------------------------

def test_default_is_binance_only():
    assert exchanges.enabled() == ("binance",)
    assert exchanges.labels(exchanges.enabled()) == "Binance"


def test_enabled_follows_hooks_at_call_time(monkeypatch):
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance", "mexc"))
    assert exchanges.enabled() == ("binance", "mexc")
    assert exchanges.labels(["binance", "mexc"]) == "Binance + MEXC"
    assert exchanges.spec("mexc").assets_broker == "MEXC"


def test_unknown_exchange_is_an_error():
    with pytest.raises(ValueError):
        exchanges.spec("kraken")
    with pytest.raises(ValueError):
        exchanges.client_for({"api_key": "k", "secret_key": "s", "exchange": "kraken"})


# --- client_for ------------------------------------------------------------------

def test_binance_accounts_get_a_binance_adapter_with_the_right_host():
    live = exchanges.client_for({"api_key": "k", "secret_key": "s"})           # no exchange key = Binance
    demo = exchanges.client_for({"api_key": "k", "secret_key": "s", "demo": True, "exchange": "binance"})
    assert isinstance(live, BinanceAdapter) and live.exchange == "binance"
    assert "demo-fapi" not in live.base_url
    assert "demo-fapi" in demo.base_url
    assert live.LEVERAGE_PER_ORDER is False


def test_mexc_accounts_get_a_mexc_adapter_on_the_one_mexc_host():
    client = exchanges.client_for({"api_key": "mx0k", "secret_key": "s", "exchange": "mexc"})
    assert isinstance(client, MexcAdapter) and client.exchange == "mexc"
    assert client.base_url == hooks.MEXC_API_BASE
    assert client.api_key == "mx0k"
    assert client.LEVERAGE_PER_ORDER is True


def test_the_raw_classes_are_the_patch_seam():
    fake = MagicMock(name="BinanceAPI")
    with patch.object(exchanges, "BinanceAPI", fake):
        exchanges.client_for({"api_key": "k", "secret_key": "s", "demo": True})
    fake.assert_called_once_with("k", "s", base_url=hooks.BINANCE_TESTNET_API_BASE)

    fake = MagicMock(name="MexcFuturesAPI")
    with patch.object(exchanges, "MexcFuturesAPI", fake):
        exchanges.client_for({"api_key": "k", "secret_key": "s", "exchange": "mexc"})
    fake.assert_called_once_with("k", "s", base_url=hooks.MEXC_API_BASE)


# --- demo rows route to the venue's testnet -------------------------------------

def test_demo_mexc_rows_route_to_the_mexc_testnet_host():
    live = exchanges.client_for({"api_key": "k", "secret_key": "s", "exchange": "mexc"})
    demo = exchanges.client_for({"api_key": "k", "secret_key": "s", "exchange": "mexc", "demo": True})
    assert live.base_url == hooks.MEXC_API_BASE
    assert demo.base_url == hooks.MEXC_TESTNET_API_BASE
    assert "testnet" in demo.base_url and "testnet" not in live.base_url
    # No venue refuses a row today; the gate exists for one that would.
    for account in ({"exchange": "mexc", "demo": True}, {"exchange": "mexc"}, {"exchange": "binance", "demo": True}, {}):
        assert exchanges.tradeable(account) is None


# --- accounts_api: one load per exchange, rows stamped -------------------------

def test_fetch_accounts_merges_every_enabled_exchange_and_stamps_rows(monkeypatch):
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance", "mexc"))
    payloads = {
        "binance": {"success": True, "accounts": [{"api_key": "b1", "secret_key": "s", "uni_id": "u1"}]},
        "mexc": {"success": True, "accounts": [{"api_key": "m1", "secret_key": "s", "uni_id": "u1"}]},
    }
    calls = []

    def get_json(path, params=None, *, exchange=None):
        calls.append((path, exchange))
        return payloads[exchange]

    with patch.object(accounts_api.engine_client, "get_json", side_effect=get_json):
        accounts_api.invalidate_accounts_cache()
        rows = accounts_api.fetch_accounts(force=True)
        only_mexc = accounts_api.fetch_accounts(exchange="mexc")

    assert [(r["api_key"], r["exchange"]) for r in rows] == [("b1", "binance"), ("m1", "mexc")]
    assert [r["api_key"] for r in only_mexc] == ["m1"]
    assert ("accounts", "binance") in calls and ("accounts", "mexc") in calls


def test_fetch_assets_asks_each_venue_for_its_own_broker(monkeypatch):
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance", "mexc"))
    seen = []

    def get_json(path, params=None, *, exchange=None):
        seen.append((exchange, params["broker"]))
        return {"success": True, "assets": [
            {"ticker": "BTCUSDT", "base_size": 0.001, "max_increments": 0.003, "side": "ALL", "enabled": True},
        ]}

    with patch.object(assets_api.engine_client, "get_json", side_effect=get_json):
        assets_api.invalidate_assets_cache()
        assert assets_api.get_asset("BTCUSDT", "mexc")["max_increments"] == 3.0
        assert assets_api.get_asset("btcusdt") is not None  # default: binance
    assert ("mexc", "MEXC") in seen and ("binance", "Binance") in seen


# --- engine_client: the segment follows the exchange -----------------------------

def test_engine_client_routes_by_exchange():
    with patch.object(engine_client, "get_session") as session:
        response = session.return_value.request.return_value
        response.ok = True
        response.json.return_value = {"success": True}
        engine_client.get_json("accounts", exchange="mexc")
        engine_client.post_json("fees", {"rows": []}, exchange="mexc")
        engine_client.post_json("balances", {"rows": []})
    urls = [c.args[1] for c in session.return_value.request.call_args_list]
    assert urls == [
        "http://engine.test/api/engine/mexc/accounts",
        "http://engine.test/api/engine/mexc/fees",
        "http://engine.test/api/engine/binance/balances",
    ]


# --- key_status: codes are per exchange ------------------------------------------

def test_credential_codes_are_scoped_to_their_exchange():
    assert key_status.classify({"code": 406, "message": "Accessing IP is not in the whitelist"}, "mexc") == (
        406, "IP_NOT_WHITELISTED", "Accessing IP is not in the whitelist",
    )
    assert key_status.classify({"code": 406}, "binance") is None        # 406 means nothing on Binance
    assert key_status.classify({"code": -2015, "msg": "x"}, "mexc") is None
    assert key_status.classify({"code": -2015, "msg": "x"})[1] == "IP_OR_PERMISSION"
    assert key_status.classify({"code": True}, "mexc") is None           # bool is not a code


def test_blocked_reports_go_to_the_exchanges_own_route():
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_blocked("mx0k", 402, "KEY_EXPIRED", "expired", "mexc")
        key_status.report_blocked("mx0k", 402, "KEY_EXPIRED", "expired", "mexc")  # deduped
        key_status.report_ok("mx0k", "mexc")
        key_status.report_ok("mx0k")  # a Binance key with the same string is another key
    assert [(c.args[0], c.args[1]["status"], c.kwargs["exchange"]) for c in post.call_args_list] == [
        ("key-status", "blocked", "mexc"),
        ("key-status", "ok", "mexc"),
        ("key-status", "ok", "binance"),
    ]
