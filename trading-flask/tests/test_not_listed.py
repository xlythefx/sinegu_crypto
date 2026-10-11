"""A coin the venue does not list on an account's network is a SKIP that names
the network — and every other failed read says what actually failed.

On 2026-10-11 the MEXC testnet (where demo MEXC accounts trade) did not list
LTC_USDT. Every LTC entry failed instantly, and the LTC exit was reported as
"could not read positions", retried for five minutes and escalated to a red
"manual action required" for a position that could not exist. The rules:

* "not listed" is asked only AFTER a read or an order failed, and only an
  affirmative absence from a list that WAS read counts — an unreadable list
  is unknown and keeps the retry, so no exit is ever skipped on a guess;
* the reason names the network: "not listed on MEXC Demo" / "… Production";
* a real read failure carries the venue's own answer instead of the generic
  "could not read positions".
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import requests

import binance_abcd.binance_api as binance_api
import binance_abcd.bybit_api as bybit_api
import binance_abcd.exchanges as exchanges
import binance_abcd.hooks as hooks
import binance_abcd.mexc_api as mexc_api
import binance_abcd.routes.webhook as webhook
import binance_abcd.trading_handler as trading_handler
from binance_abcd.binance_adapter import BinanceAdapter
from binance_abcd.bybit_adapter import BybitAdapter
from binance_abcd.exchange_api import read_failure_text
from binance_abcd.mexc_adapter import MexcAdapter
from binance_abcd.trading_handler import NOT_LISTED

BTC_SPEC = {"symbol": "BTC_USDT", "contractSize": 0.0001, "volScale": 0, "minVol": 1, "maxLeverage": 200}
LTC_SPEC = {"symbol": "LTC_USDT", "contractSize": 0.1, "volScale": 0, "minVol": 1, "maxLeverage": 100}
LTC_ASSET = {"ticker": "LTCUSDT", "base_size": 5.0, "max_size": 15.0, "max_increments": 3.0, "side": "ALL"}


@pytest.fixture(autouse=True)
def _no_mode_check_and_no_sleep(monkeypatch):
    monkeypatch.setattr(trading_handler, "ensure_position_mode", lambda api, ticker: None)
    monkeypatch.setattr(trading_handler, "EXIT_RETRY_ATTEMPTS", 2)
    monkeypatch.setattr(trading_handler, "EXIT_RETRY_SECONDS", 0.0)


def _mexc(base_url: str, contracts) -> MexcAdapter:
    api = mexc_api.MexcFuturesAPI("mx0k", "s", base_url=base_url)
    api.contracts = lambda: contracts  # the cached public list, per host
    return MexcAdapter(api)


def _response(status: int, body: str) -> requests.Response:
    resp = requests.Response()
    resp.status_code = status
    resp._content = body.encode()
    resp.url = "https://venue.test/path"
    return resp


def _session(get):
    session = MagicMock()
    session.get.side_effect = get
    return session


# --- The reason names the network ---------------------------------------------

def test_an_exit_on_a_coin_the_mexc_testnet_does_not_list_is_a_demo_skip():
    adapter = _mexc(hooks.MEXC_TESTNET_API_BASE, {"BTC_USDT": BTC_SPEC})
    result = trading_handler.handle_exit(adapter, "LTCUSDT", "LONG", None)
    assert result["status"] == NOT_LISTED
    assert result["reason"] == "not listed on MEXC Demo"


def test_the_same_gap_on_production_says_production():
    adapter = _mexc(hooks.MEXC_API_BASE, {"BTC_USDT": BTC_SPEC})
    result = trading_handler.handle_exit(adapter, "LTCUSDT", "LONG", None)
    assert result["reason"] == "not listed on MEXC Production"


def test_an_entry_on_an_unlisted_coin_is_a_skip_not_a_failure():
    adapter = _mexc(hooks.MEXC_TESTNET_API_BASE, {"BTC_USDT": BTC_SPEC})
    result = trading_handler.handle_entry(adapter, "LTCUSDT", "BUY", 5.0, 50.0)
    assert result["status"] == NOT_LISTED
    assert result["reason"] == "not listed on MEXC Demo"


def test_binance_and_bybit_name_their_networks_too():
    binance = BinanceAdapter(binance_api.BinanceAPI("k", "s", base_url=hooks.BINANCE_TESTNET_API_BASE))
    with patch.object(binance_api.BinanceAPI, "listed", return_value=False):
        assert binance.not_listed("RENDERUSDT") == "not listed on Binance Demo"

    bybit = BybitAdapter(bybit_api.BybitFuturesAPI("k", "s", base_url=hooks.BYBIT_API_BASE))
    with patch.object(bybit_api.BybitFuturesAPI, "listed", return_value=False):
        assert bybit.not_listed("RENDERUSDT") == "not listed on Bybit Production"


# --- Unknown is never "not listed" ---------------------------------------------

def test_an_unreadable_contract_list_keeps_the_exit_retrying():
    """The safety half: with no list to consult, the exit cannot know the coin
    is missing, so it stays a transient failure the retry queue owns."""
    adapter = _mexc(hooks.MEXC_TESTNET_API_BASE, None)
    result = trading_handler.handle_exit(adapter, "LTCUSDT", "LONG", None)
    assert result.get("status") != NOT_LISTED
    assert result["transient"] is True
    assert result["error"].startswith("could not read positions")


def test_a_listed_coin_whose_read_fails_names_the_cause():
    adapter = _mexc(hooks.MEXC_API_BASE, {"LTC_USDT": LTC_SPEC})

    def timeout(*_a, **_kw):
        raise requests.Timeout("read timed out")

    with patch.object(mexc_api, "get_session", return_value=_session(timeout)):
        result = trading_handler.handle_exit(adapter, "LTCUSDT", "LONG", None)

    assert result["transient"] is True
    assert result["error"] == (
        "could not read positions (GET /api/v1/private/position/open_positions: timed out)"
    )


def test_a_refused_mexc_read_quotes_mexcs_code_and_message():
    adapter = _mexc(hooks.MEXC_API_BASE, {"LTC_USDT": LTC_SPEC})
    body = '{"success":false,"code":510,"message":"Requests are too frequent"}'
    with patch.object(mexc_api, "get_session", return_value=_session(lambda *a, **kw: _response(200, body))):
        result = trading_handler.handle_exit(adapter, "LTCUSDT", "LONG", None)

    assert "510 Requests are too frequent" in result["error"]


# --- Binance: the listing check and the read error ------------------------------

def test_binance_listed_reads_exchange_info_per_host():
    api = binance_api.BinanceAPI("k", "s", base_url=hooks.BINANCE_TESTNET_API_BASE)
    info = {"symbols": [{"symbol": "BTCUSDT"}, {"symbol": "LTCUSDT"}]}
    with patch.object(binance_api.BinanceAPI, "_request_get", return_value=info) as get:
        assert api.listed("ltcusdt") is True
        assert api.listed("RENDERUSDT") is False
    assert get.call_count == 1  # cached for the host


def test_binance_listed_is_unknown_when_exchange_info_fails():
    api = binance_api.BinanceAPI("k", "s", base_url="https://fapi.test")
    with patch.object(binance_api.BinanceAPI, "_request_get", return_value=None):
        assert api.listed("LTCUSDT") is None


def test_a_binance_invalid_symbol_exit_is_a_skip_naming_the_network():
    """positionRisk answers -1121 for a symbol the host does not know — the
    read fails, and the listing settles that it is not a transient fault."""
    def get(url, **_kw):
        if "/fapi/v3/positionRisk" in url:
            return _response(400, '{"code":-1121,"msg":"Invalid symbol."}')
        return _response(200, '{"symbols":[{"symbol":"BTCUSDT"}]}')

    adapter = BinanceAdapter(binance_api.BinanceAPI("k", "s", base_url=hooks.BINANCE_TESTNET_API_BASE))
    with patch.object(binance_api, "get_session", return_value=_session(get)):
        result = trading_handler.handle_exit(adapter, "RENDERUSDT", "LONG", None)

    assert result["status"] == NOT_LISTED
    assert result["reason"] == "not listed on Binance Demo"


def test_a_binance_read_error_quotes_binances_code():
    api = binance_api.BinanceAPI("k", "s", base_url="https://fapi.test")
    body = '{"code":-1007,"msg":"Timeout waiting for response from backend server."}'
    with patch.object(binance_api, "get_session", return_value=_session(lambda *a, **kw: _response(408, body))):
        assert api.get_positions_v3("LTCUSDT") is None
    assert api.last_read_error == (
        "GET /fapi/v3/positionRisk: HTTP 408 -1007 Timeout waiting for response from backend server."
    )


def test_the_read_error_never_quotes_the_signed_url():
    api = binance_api.BinanceAPI("k", "s", base_url="https://fapi.test")

    def refuse(*_a, **_kw):
        raise requests.ConnectionError("https://fapi.test/fapi/v3/positionRisk?timestamp=1&signature=abc")

    with patch.object(binance_api, "get_session", return_value=_session(refuse)):
        api.get_positions_v3("LTCUSDT")
    assert api.last_read_error == "GET /fapi/v3/positionRisk: no answer (ConnectionError)"
    assert "signature" not in api.last_read_error


# --- Bybit: a list cut short by the page cap proves nothing --------------------

def test_bybit_listed_is_unknown_when_the_instrument_list_was_cut_short():
    api = bybit_api.BybitFuturesAPI("k", "s", base_url="https://bybit.test")
    with patch.object(bybit_api.BybitFuturesAPI, "_paged", return_value=([{"symbol": "BTCUSDT"}], False)):
        assert api.listed("LTCUSDT") is None


def test_bybit_listed_answers_from_a_complete_list():
    api = bybit_api.BybitFuturesAPI("k", "s", base_url="https://bybit.test")
    with patch.object(bybit_api.BybitFuturesAPI, "_paged", return_value=([{"symbol": "BTCUSDT"}], True)):
        assert api.listed("BTCUSDT") is True
        assert api.listed("LTCUSDT") is False


# --- The fan-out records a skip, never a retryable failure ---------------------

def _mexc_account(demo: bool) -> dict:
    return {
        "api_key": "mx0k", "secret_key": "s", "name": "MEXC Main", "uni_id": "u-dev",
        "exchange": "mexc", "demo": demo, "enabled": True,
        "balance": 10000.0, "total_deposit": 10000.0,
    }


def test_run_account_skips_an_exit_the_demo_network_cannot_hold():
    with patch.object(mexc_api.MexcFuturesAPI, "contracts", return_value={"BTC_USDT": BTC_SPEC}):
        result = webhook._run_account(
            _mexc_account(demo=True), "EXIT_LONG", "LTCUSDT", 50.0, None, None, LTC_ASSET, None,
        )
    assert result["status"] == "skipped"
    assert result["reason"] == "not listed on MEXC Demo"
    assert not result.get("retryable")


def test_run_account_skips_an_entry_the_demo_network_cannot_take():
    with (
        patch.object(mexc_api.MexcFuturesAPI, "contracts", return_value={"BTC_USDT": BTC_SPEC}),
        patch.object(webhook, "_upsert_position_api") as upsert,
    ):
        result = webhook._run_account(
            _mexc_account(demo=True), "BUY", "LTCUSDT", 50.0, 25, None, LTC_ASSET, {},
        )
    assert result["status"] == "skipped"
    assert result["reason"] == "not listed on MEXC Demo"
    assert result["sizing"]["quantity"] > 0  # the sizing still explains the row
    upsert.assert_not_called()


def test_run_account_names_production_for_a_live_account():
    with patch.object(mexc_api.MexcFuturesAPI, "contracts", return_value={"BTC_USDT": BTC_SPEC}):
        result = webhook._run_account(
            _mexc_account(demo=False), "EXIT_SHORT", "LTCUSDT", 50.0, None, None, LTC_ASSET, None,
        )
    assert result["reason"] == "not listed on MEXC Production"


def test_the_client_routes_a_demo_mexc_account_to_the_testnet_it_names():
    """The label is read off the host the requests go to, so it cannot drift
    from the routing in exchanges.base_url_for."""
    demo = exchanges.client_for(_mexc_account(demo=True))
    live = exchanges.client_for(_mexc_account(demo=False))
    assert demo.base_url == hooks.MEXC_TESTNET_API_BASE
    assert live.base_url == hooks.MEXC_API_BASE


# --- The wording itself ---------------------------------------------------------

@pytest.mark.parametrize("kwargs, expected", [
    ({"timed_out": True}, "GET /p: timed out"),
    ({"transport_error": "ConnectionError"}, "GET /p: no answer (ConnectionError)"),
    ({"http_status": 400, "code": -1121, "message": "Invalid symbol."}, "GET /p: HTTP 400 -1121 Invalid symbol."),
    ({"code": 1001, "message": "Contract does not exist"}, "GET /p: 1001 Contract does not exist"),
    ({"http_status": 503}, "GET /p: HTTP 503"),
    ({}, "GET /p: unreadable answer"),
])
def test_read_failure_text(kwargs, expected):
    assert read_failure_text("/p", **kwargs) == expected
