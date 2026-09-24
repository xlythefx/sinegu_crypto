"""BybitFuturesAPI — signing, the envelope-not-status rule, error verdicts,
qty rounding. All HTTP mocked at the session."""

from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import requests

import binance_abcd.bybit_api as bybit_api
import binance_abcd.key_status as key_status
from binance_abcd.bybit_api import BybitFuturesAPI, classify_code, to_symbol
from binance_abcd.hooks import BYBIT_RECV_WINDOW_MS, MEXC_RECV_WINDOW

KEY, SECRET = "bybitkey", "bybitsecret"
RECV = "5000"

BTC = {
    "symbol": "BTCUSDT", "status": "Trading",
    "lotSizeFilter": {"qtyStep": "0.001", "minOrderQty": "0.001", "maxMktOrderQty": "100"},
    "priceFilter": {"tickSize": "0.10"},
    "leverageFilter": {"maxLeverage": "100"},
}
DOGE = {
    "symbol": "DOGEUSDT", "status": "Trading",
    "lotSizeFilter": {"qtyStep": "1", "minOrderQty": "1", "maxMktOrderQty": "3000000"},
    "leverageFilter": {"maxLeverage": "75"},
}
DELISTED = {
    "symbol": "OLDUSDT", "status": "Delivering",
    "lotSizeFilter": {"qtyStep": "0.01", "minOrderQty": "0.01"},
}


def _api() -> BybitFuturesAPI:
    return BybitFuturesAPI(KEY, SECRET, base_url="https://bybit.test", recv_window_ms=5000)


def _ok(result, status=200):
    body = {"retCode": 0, "retMsg": "OK", "result": result}
    resp = MagicMock(status_code=status, text=json.dumps(body))
    resp.json.return_value = body
    return resp


def _list(rows, cursor=""):
    return _ok({"list": rows, "nextPageCursor": cursor})


def _refused(ret_code, msg="nope", status=200):
    body = {"retCode": ret_code, "retMsg": msg, "result": {}}
    resp = MagicMock(status_code=status, text=json.dumps(body))
    resp.json.return_value = body
    if status >= 400:
        resp.raise_for_status.side_effect = requests.HTTPError(f"{status}", response=resp)
    return resp


def _sig(payload, ts):
    return hmac.new(SECRET.encode(), (ts + KEY + RECV + payload).encode(), hashlib.sha256).hexdigest()


def _instrumented(api, rows=(BTC, DOGE, DELISTED)):
    """Prime the instruments cache without a network call."""
    bybit_api._INSTRUMENTS_CACHE[api.base_url] = (
        float("inf"), {r["symbol"]: r for r in rows},
    )


# --- Signing -----------------------------------------------------------------

def test_get_signs_the_query_string_in_url_order_and_sends_the_same_string():
    """Bybit verifies against the query string EXACTLY as it appears in the URL.

    The params below are deliberately out of alphabetical order: MEXC sorts its
    parameter string, and copying that helper here would make every signed GET
    fail with 10004.
    """
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session, \
         patch("binance_abcd.bybit_api.time.time", return_value=1700000000.123):
        session.return_value.get.return_value = _list([])
        api._request_get("/v5/position/list", {"category": "linear", "settleCoin": "USDT", "cursor": None})
    call = session.return_value.get.call_args
    assert call.args[0] == "https://bybit.test/v5/position/list?category=linear&settleCoin=USDT"
    headers = call.kwargs["headers"]
    assert headers["X-BAPI-API-KEY"] == KEY
    assert headers["X-BAPI-TIMESTAMP"] == "1700000000123"
    assert headers["X-BAPI-RECV-WINDOW"] == RECV
    assert headers["X-BAPI-SIGN"] == _sig("category=linear&settleCoin=USDT", "1700000000123")


def test_get_with_no_params_signs_the_empty_query_string():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session, \
         patch("binance_abcd.bybit_api.time.time", return_value=1.0):
        session.return_value.get.return_value = _ok({"readOnly": 0})
        api.query_api()
    call = session.return_value.get.call_args
    assert call.args[0].endswith("/v5/user/query-api")
    assert call.kwargs["headers"]["X-BAPI-SIGN"] == _sig("", "1000")


def test_post_signs_the_exact_compact_json_bytes_it_sends():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session, \
         patch("binance_abcd.bybit_api.time.time", return_value=2.0):
        session.return_value.post.return_value = _ok({"orderId": "123"})
        api.create_order("BTCUSDT", "Buy", "0.01", position_idx=1)
    call = session.return_value.post.call_args
    sent = call.kwargs["data"]
    assert sent == (
        '{"category":"linear","symbol":"BTCUSDT","side":"Buy",'
        '"orderType":"Market","qty":"0.01","positionIdx":1}'
    )
    assert "json" not in call.kwargs  # signing the bytes we send is the whole point
    assert call.kwargs["headers"]["X-BAPI-SIGN"] == _sig(sent, "2000")


def test_recv_window_is_milliseconds_not_seconds():
    """MEXC's Recv-Window is SECONDS (default 20); Bybit's is MILLISECONDS.
    Copying MEXC's number here would ask for a 20 ms window and fail every call."""
    assert _api().recv_window == "5000"
    assert BYBIT_RECV_WINDOW_MS == 5000
    assert MEXC_RECV_WINDOW != BYBIT_RECV_WINDOW_MS


# --- The envelope decides, not the status ------------------------------------

def test_a_nonzero_ret_code_on_http_200_is_a_failure():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session:
        session.return_value.get.return_value = _refused(10001, "params error")
        assert api._request_get("/v5/position/list", {"category": "linear"}) is None

    with patch("binance_abcd.bybit_api.get_session") as session:
        session.return_value.post.return_value = _refused(110007, "ab not enough for new order")
        result = api.create_order("BTCUSDT", "Buy", "1", position_idx=0)
    assert result["_error"] is True
    assert result["code"] == 110007
    assert result["transient"] is False  # an answer that repeats identically
    assert "ab not enough" in result["message"]


def test_verdicts_by_code():
    assert classify_code(10016, 200)["transient"] is True
    assert classify_code(10000, 200)["transient"] is True
    assert classify_code(None, None)["transient"] is True      # timeout: unknown
    assert classify_code(None, 503)["transient"] is True
    assert classify_code(10006, 200)["rate_limited"] is True
    assert classify_code(10018, 200)["rate_limited"] is True
    assert classify_code(None, 429)["rate_limited"] is True
    assert classify_code(10027, 200)["maintenance"] is True
    assert classify_code(10027, 200)["transient"] is False     # a rejection, not a retry
    assert classify_code(110063, 200)["maintenance"] is True
    assert classify_code(10010, 200)["credential"] is True
    assert classify_code(10010, 200)["transient"] is False
    # An ordinary order rejection is none of the three.
    verdict = classify_code(110007, 200)
    assert not any(verdict[k] for k in ("transient", "rate_limited", "credential", "maintenance"))


def test_10002_is_transient_and_never_a_credential_fault():
    """"Request expired" means OUR clock drifted outside recv_window — Binance's
    -1021 twin. Flagging it would start a 3-day disconnect clock on every Bybit
    account whenever prod's NTP slips."""
    verdict = classify_code(10002, 200)
    assert verdict["transient"] is True
    assert verdict["credential"] is False
    assert 10002 not in key_status.CREDENTIAL_CODES["bybit"]


def test_a_timeout_reports_no_http_status_and_stays_transient():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session:
        session.return_value.post.side_effect = requests.Timeout("timed out")
        result = api.create_order("BTCUSDT", "Buy", "1", position_idx=0)
    assert result["_error"] is True
    assert result["http_status"] is None
    assert result["transient"] is True


def test_a_403_with_no_json_body_is_not_a_credential_fault(caplog):
    """US / Mainland-China IPs are refused by Bybit's edge whatever the key.
    Disconnecting customers' keys would not fix it, so it must not reach
    key_status."""
    api = _api()
    resp = MagicMock(status_code=403, text="<html>403 Forbidden</html>")
    resp.raise_for_status.side_effect = requests.HTTPError("403", response=resp)
    with caplog.at_level("ERROR"), \
         patch("binance_abcd.bybit_api.get_session") as session, \
         patch("binance_abcd.key_status._post") as post:
        session.return_value.get.return_value = resp
        assert api._request_get("/v5/position/list", {"category": "linear"}) is None
    assert "regional block" in caplog.text
    assert post.call_count == 0


# --- "Not modified" is a success ---------------------------------------------

def test_110043_leverage_not_modified_is_a_success():
    """Setting the leverage it already has achieved what was asked. The
    reference implementation logged a warning on this before every entry."""
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session, \
         patch("binance_abcd.key_status._post") as post:
        session.return_value.post.return_value = _refused(110043, "leverage not modified")
        result = api.set_leverage("BTCUSDT", 25)
    assert result.get("_error") is not True
    # A signed WRITE succeeded, so it also proves the key may trade.
    assert post.call_args.args[0]["status"] == "ok"


def test_110025_position_mode_not_modified_is_a_success():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session, patch("binance_abcd.key_status._post"):
        session.return_value.post.return_value = _refused(110025, "position mode is not modified")
        assert api.switch_mode(3).get("_error") is not True


# --- key_status wiring --------------------------------------------------------

def test_credential_codes_report_the_key_blocked_once():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session, patch("binance_abcd.key_status._post") as post:
        session.return_value.get.return_value = _refused(10010, "Unmatched IP, please check your API key's bound IP")
        api.positions("BTCUSDT")
        api.positions("BTCUSDT")
    assert post.call_count == 1
    payload, exchange = post.call_args.args
    assert exchange == "bybit"
    assert payload["status"] == "blocked"
    assert payload["code"] == "10010"
    assert payload["reason"] == "IP_NOT_WHITELISTED"


def test_a_public_call_never_clears_a_block_but_a_private_one_does():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session, patch("binance_abcd.key_status._post") as post:
        session.return_value.get.return_value = _refused(10004, "error sign")
        api.positions("BTCUSDT")

        # instruments-info is PUBLIC — it succeeds with any key, so a 200 here
        # says nothing about the credentials.
        session.return_value.get.return_value = _list([BTC])
        api.instruments()
        assert [c.args[0]["status"] for c in post.call_args_list] == ["blocked"]

        # A signed, account-scoped read is what clears it.
        api.wallet_balance()
    assert [c.args[0]["status"] for c in post.call_args_list] == ["blocked", "ok"]


def test_rate_limits_and_timeouts_never_touch_the_key():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session, patch("binance_abcd.key_status._post") as post:
        session.return_value.get.return_value = _refused(10006, "too many visits")
        api.positions("BTCUSDT")
        session.return_value.get.side_effect = requests.Timeout("timed out")
        api.positions("BTCUSDT")
    assert post.call_count == 0


# --- Instruments + sizing -----------------------------------------------------

def test_instrument_specs_are_fetched_once_and_a_failure_is_not_cached():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session:
        session.return_value.get.return_value = _refused(10016, "service error")
        assert api.instruments() is None
        session.return_value.get.return_value = _list([BTC, DOGE])
        assert set(api.instruments()) == {"BTCUSDT", "DOGEUSDT"}
        api.instruments()  # cached
        assert session.return_value.get.call_count == 2


def test_round_qty_floors_an_entry_and_refuses_dust():
    api = _api()
    _instrumented(api)
    assert api.round_qty("BTCUSDT", 0.0039) == "0.003"      # floored to the step
    assert api.round_qty("BTCUSDT", 0.0009) is None          # under minOrderQty
    assert api.round_qty("DOGEUSDT", 2.9) == "2"             # integer step
    assert api.round_qty("BTCUSDT", 0) is None
    assert api.round_qty("NOPEUSDT", 1) is None              # unknown symbol
    assert api.round_qty("OLDUSDT", 1) is None               # status != Trading
    assert api.round_qty("BTCUSDT", 500) is None             # over maxMktOrderQty


def test_round_qty_rounds_a_closing_size_to_the_nearest_step():
    """Closing a position whose coin figure carries float dust.

    `0.3 - 0.1` is 0.19999999999999998, which floored to a 0.001 step is 0.199
    — so the close would leave 0.001 open forever while reporting success, the
    poller would keep seeing the position and the stack cap would keep counting
    it. Half-even on an exit turns it back into 0.2.
    """
    api = _api()
    _instrumented(api)
    dust = 0.3 - 0.1
    assert api.round_qty("BTCUSDT", dust, closing=True) == "0.2"
    assert api.round_qty("BTCUSDT", dust) == "0.199"


# --- Reads --------------------------------------------------------------------

def test_the_account_wide_position_read_sends_settle_coin():
    """/v5/position/list for linear REQUIRES symbol or settleCoin. Omitting it
    is refused — and the reference implementation then folded that refusal into
    an empty list, which is the conflation that deletes live positions."""
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session:
        session.return_value.get.return_value = _list([])
        api.positions()
    assert "settleCoin=USDT" in session.return_value.get.call_args.args[0]


def test_positions_is_none_on_failure_and_empty_when_flat():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session:
        session.return_value.get.return_value = _refused(10016, "service error")
        assert api.positions("BTCUSDT") is None
        session.return_value.get.return_value = _list([])
        assert api.positions("BTCUSDT") == []


def test_cursor_paging_follows_and_reports_incompleteness():
    api = _api()
    with patch("binance_abcd.bybit_api.get_session") as session:
        session.return_value.get.side_effect = [_list([{"a": 1}], "next"), _list([{"a": 2}], "")]
        rows, complete = api.closed_pnl(start_ms=0, end_ms=1)
    assert rows == [{"a": 1}, {"a": 2}] and complete is True

    with patch("binance_abcd.bybit_api.get_session") as session:
        session.return_value.get.side_effect = [_list([{"a": 1}], "next"), _refused(10016)]
        rows, complete = api.closed_pnl(start_ms=0, end_ms=1)
    assert rows == [{"a": 1}] and complete is False

    with patch("binance_abcd.bybit_api.get_session") as session:
        session.return_value.get.return_value = _refused(10016)
        rows, complete = api.closed_pnl(start_ms=0, end_ms=1)
    # First page failed: UNKNOWN, not empty — the watermark must not advance.
    assert rows is None and complete is False


def test_empty_strings_read_as_unknown_not_zero():
    """Bybit sends "" for fields that do not apply to the account's margin mode.
    A 0 there would be published as a real figure."""
    assert bybit_api.num("") is None
    assert bybit_api.num(None) is None
    assert bybit_api.num("0") == 0.0


def test_to_symbol_guards_the_usdt_quote():
    """`category=linear` also lists USDC symbols, and BTCUSD is INVERSE — a
    guess lands on a contract the settleCoin=USDT reads never see."""
    assert to_symbol("btcusdt") == "BTCUSDT"
    assert to_symbol("BTCUSD") is None
    assert to_symbol("BTCPERP") is None
    assert to_symbol("") is None
