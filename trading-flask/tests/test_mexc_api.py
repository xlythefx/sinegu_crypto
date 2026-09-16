"""MexcFuturesAPI — signing, the envelope-not-status rule, error verdicts,
contract sizing. All HTTP mocked at the session."""

from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import requests

import binance_abcd.key_status as key_status
import binance_abcd.mexc_api as mexc_api
from binance_abcd.mexc_api import MexcFuturesAPI, classify_code, to_contract_symbol, to_ticker

KEY, SECRET = "mx0key", "mx0secret"
BTC = {"symbol": "BTC_USDT", "contractSize": 0.0001, "volScale": 0, "minVol": 1, "maxVol": 500000,
       "priceScale": 1, "maxLeverage": 200, "apiAllowed": True}
DOGE = {"symbol": "DOGE_USDT", "contractSize": 100, "volScale": 0, "minVol": 1, "apiAllowed": True}
NOAPI = {"symbol": "NOAPI_USDT", "contractSize": 1, "volScale": 2, "minVol": 0.01, "apiAllowed": False}


def _api() -> MexcFuturesAPI:
    return MexcFuturesAPI(KEY, SECRET, base_url="https://mexc.test", recv_window=20)


def _ok(data, status=200):
    resp = MagicMock(status_code=status, text=json.dumps({"success": True, "code": 0, "data": data}))
    resp.json.return_value = {"success": True, "code": 0, "data": data}
    return resp


def _refused(code, message="nope", status=200):
    body = {"success": False, "code": code, "message": message}
    resp = MagicMock(status_code=status, text=json.dumps(body))
    resp.json.return_value = body
    if status >= 400:
        resp.raise_for_status.side_effect = requests.HTTPError(f"{status}", response=resp)
    return resp


def _sig(param_string, ts):
    return hmac.new(SECRET.encode(), (KEY + ts + param_string).encode(), hashlib.sha256).hexdigest()


# --- Signing -----------------------------------------------------------------

def test_get_signs_the_sorted_query_and_sends_the_same_string():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session, patch("binance_abcd.mexc_api.time.time", return_value=1700000000.123):
        session.return_value.get.return_value = _ok([])
        api._request_get("/api/v1/private/position/open_positions", {"symbol": "BTC_USDT", "page_num": 1, "skip": None})
    call = session.return_value.get.call_args
    assert call.args[0] == "https://mexc.test/api/v1/private/position/open_positions?page_num=1&symbol=BTC_USDT"
    headers = call.kwargs["headers"]
    assert headers["ApiKey"] == KEY
    assert headers["Request-Time"] == "1700000000123"
    assert headers["Signature"] == _sig("page_num=1&symbol=BTC_USDT", "1700000000123")
    assert headers["Recv-Window"] == "20"
    assert headers["Language"] == "English"


def test_get_with_no_params_signs_the_empty_string():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session, patch("binance_abcd.mexc_api.time.time", return_value=1.0):
        session.return_value.get.return_value = _ok({"positionMode": 1})
        api._request_get("/api/v1/private/position/position_mode")
    call = session.return_value.get.call_args
    assert call.args[0].endswith("/position_mode")
    assert call.kwargs["headers"]["Signature"] == _sig("", "1000")


def test_post_signs_the_exact_compact_json_bytes_it_sends():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session, patch("binance_abcd.mexc_api.time.time", return_value=2.0):
        session.return_value.post.return_value = _ok({"orderId": "800746480548793856", "ts": 1})
        result = api.create_order("BTC_USDT", 1, "3", open_type=1, leverage=25, position_mode=1)
    call = session.return_value.post.call_args
    body = call.kwargs["data"]
    assert body == '{"symbol":"BTC_USDT","price":0,"vol":3,"side":1,"type":5,"openType":1,"leverage":25,"positionMode":1}'
    assert "json" not in call.kwargs
    assert call.kwargs["headers"]["Signature"] == _sig(body, "2000")
    assert result["data"]["orderId"] == "800746480548793856"


def test_none_valued_params_are_dropped_from_body_and_signature():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.post.return_value = _ok({})
        api.change_leverage(10, symbol="BTC_USDT", open_type=1, position_type=1)
    body = json.loads(session.return_value.post.call_args.kwargs["data"])
    assert "positionId" not in body and body["leverage"] == 10


# --- The envelope decides, not the HTTP status ----------------------------------

def test_success_false_on_http_200_is_a_failure():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.get.return_value = _refused(1001, "Contract does not exist")
        assert api._request_get("/api/v1/private/position/open_positions") is None
        session.return_value.post.return_value = _refused(2015, "Price or quantity precision error")
        result = api.create_order("BTC_USDT", 1, "3", open_type=1, leverage=5)
    assert result["_error"] is True
    assert result["code"] == 2015
    assert result["transient"] is False and result["rate_limited"] is False
    assert "precision" in result["message"]


def test_verdicts_by_code():
    assert classify_code(500, 200)["transient"] and classify_code(9999, 200)["transient"]
    assert classify_code(None, None)["transient"]            # no response at all
    assert classify_code(None, 503)["transient"]
    assert classify_code(510, 200)["rate_limited"] and classify_code(2037, 200)["rate_limited"]
    assert classify_code(None, 429)["rate_limited"]
    assert classify_code(604, 200)["maintenance"] and not classify_code(604, 200)["transient"]
    assert classify_code(406, 200)["credential"] and not classify_code(406, 200)["transient"]
    assert not classify_code(2005, 200)["transient"]         # balance insufficient: a refusal


def test_post_verdicts_land_on_the_failure_dict():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.post.return_value = _refused(510, "Requests are too frequent")
        rate = api.create_order("BTC_USDT", 1, "3", open_type=1, leverage=5)
        session.return_value.post.return_value = _refused(604, "under maintenance")
        maint = api.create_order("BTC_USDT", 1, "3", open_type=1, leverage=5)
        session.return_value.post.side_effect = requests.Timeout("read timed out")
        timeout = api.create_order("BTC_USDT", 1, "3", open_type=1, leverage=5)
    assert rate["rate_limited"] is True and rate["transient"] is False
    assert maint["maintenance"] is True and maint["transient"] is False
    assert timeout["transient"] is True and timeout["http_status"] is None


def test_http_5xx_is_transient_and_carries_the_status():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.post.return_value = _refused(500, "Internal error", status=502)
        result = api.create_order("BTC_USDT", 1, "3", open_type=1, leverage=5)
    assert result["transient"] is True and result["http_status"] == 502 and result["code"] == 500


# --- Credential verdicts reach key_status, successes clear them -------------------

def test_credential_codes_report_the_key_blocked_once():
    api = _api()
    with patch.object(key_status.engine_client, "post_json") as post, patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.get.return_value = _refused(406, "Accessing IP is not in the whitelist")
        api.open_positions()
        api.open_positions()  # same verdict, one report
    blocked = [c for c in post.call_args_list if c.args[1]["status"] == "blocked"]
    assert len(blocked) == 1
    assert blocked[0].args[1]["code"] == "406" and blocked[0].kwargs["exchange"] == "mexc"


def test_a_public_call_never_clears_a_block_but_a_private_one_does():
    api = _api()
    with patch.object(key_status.engine_client, "post_json") as post, patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.get.return_value = _refused(602, "Confirming signature failed")
        api.asset("USDT")
        session.return_value.get.return_value = _ok([BTC])
        api.contracts()                                   # public: says nothing about the key
        assert [c.args[1]["status"] for c in post.call_args_list] == ["blocked"]
        session.return_value.get.return_value = _ok({"equity": 1})
        api.asset("USDT")                                 # signed + account-scoped: clears it
    assert [c.args[1]["status"] for c in post.call_args_list] == ["blocked", "ok"]


def test_rate_limits_and_timeouts_never_touch_the_key():
    api = _api()
    with patch.object(key_status.engine_client, "post_json") as post, patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.get.return_value = _refused(510, "too frequent")
        api.open_positions()
        session.return_value.get.side_effect = requests.Timeout("x")
        api.open_positions()
    post.assert_not_called()


# --- Contracts and sizing ------------------------------------------------------------

def _with_contracts(api, session):
    session.return_value.get.return_value = _ok([BTC, DOGE, NOAPI])
    assert api.contracts() is not None


def test_contract_specs_are_fetched_once_and_never_cached_on_failure():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.get.return_value = _refused(500, "busy")
        assert api.contracts() is None
        session.return_value.get.return_value = _ok([BTC, DOGE])
        assert api.contract("btc_usdt")["contractSize"] == 0.0001
        assert api.contract_size("DOGE_USDT") == 100.0
        assert api.contract_size("XRP_USDT") is None
        api.contracts()
    assert session.return_value.get.call_count == 2  # one failed, one cached


def test_coins_to_vol_floors_entries_and_refuses_dust_and_untradable_contracts():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        _with_contracts(api, session)
        assert api.coins_to_vol("BTC_USDT", 0.005) == "50"        # 0.005 / 0.0001
        assert api.coins_to_vol("BTC_USDT", 0.00029) == "2"       # floored, never up
        assert api.coins_to_vol("BTC_USDT", 0.00009) is None      # < minVol (1 contract)
        assert api.coins_to_vol("DOGE_USDT", 250) == "2"          # 2.5 contracts of 100 -> 2
        assert api.coins_to_vol("NOAPI_USDT", 5) is None          # apiAllowed false
        assert api.coins_to_vol("XRP_USDT", 5) is None            # unknown contract
        assert api.coins_to_vol("BTC_USDT", 0) is None


def test_coins_to_vol_rounds_a_closing_size_to_the_nearest_contract():
    """A whole position read back through float arithmetic (2.9999999 contracts)
    must close as 3, not as 2 with one contract left open."""
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        _with_contracts(api, session)
        assert api.coins_to_vol("BTC_USDT", 0.00029999999, closing=True) == "3"
        assert api.coins_to_vol("BTC_USDT", 0.00029999999) == "2"


# --- Symbol mapping ---------------------------------------------------------------

def test_symbol_mapping():
    assert to_contract_symbol("BTCUSDT") == "BTC_USDT"
    assert to_contract_symbol("ethusdt") == "ETH_USDT"
    assert to_contract_symbol("BTC_USDT") == "BTC_USDT"
    assert to_contract_symbol("BTCUSD") is None
    assert to_contract_symbol("USDT") is None
    assert to_contract_symbol("") is None
    assert to_ticker("BTC_USDT") == "BTCUSDT"


# --- Reads: None vs [] and the two history shapes ---------------------------------

def test_open_positions_is_none_on_failure_and_empty_when_flat():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.get.side_effect = requests.ConnectionError("down")
        assert api.open_positions() is None
        session.return_value.get.side_effect = None
        session.return_value.get.return_value = _ok([])
        assert api.open_positions() == []
        session.return_value.get.return_value = _ok([{"holdVol": 0, "positionType": 1}, {"holdVol": 2, "positionType": 2}])
        assert [p["positionType"] for p in api.open_positions()] == [2]


def test_history_endpoints_accept_a_bare_list_or_a_result_list():
    api = _api()
    rows = [{"orderId": "1"}]
    with patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.get.return_value = _ok(rows)
        assert api.history_orders(start_ms=1, end_ms=2) == rows
        session.return_value.get.return_value = _ok({"pageSize": 100, "totalCount": 1, "resultList": rows})
        assert api.order_deals("BTC_USDT", start_ms=1, end_ms=2) == rows
        session.return_value.get.return_value = _ok({"pageSize": 100, "totalCount": 0})
        assert api.funding_records(1, start_ms=1, end_ms=2) is None   # a wrapper with no list is not an answer
        query = session.return_value.get.call_args.args[0]
    assert "position_type=1" in query and "start_time=1" in query


def test_position_mode_reads_either_shape():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.get.return_value = _ok({"positionMode": 2})
        assert api.position_mode() == 2
        session.return_value.get.return_value = _ok(1)
        assert api.position_mode() == 1
        session.return_value.get.return_value = _ok({"positionMode": 7})
        assert api.position_mode() is None


def test_reset_caches_forgets_contracts():
    api = _api()
    with patch("binance_abcd.mexc_api.get_session") as session:
        session.return_value.get.return_value = _ok([BTC])
        api.contracts()
        mexc_api.reset_caches()
        api.contracts()
    assert session.return_value.get.call_count == 2
