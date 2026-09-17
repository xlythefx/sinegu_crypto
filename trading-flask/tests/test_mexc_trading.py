"""MexcAdapter through the exchange-neutral handle_entry / handle_exit: contract
sizing, leverage-on-the-order, hedge sides, the re-read-before-close rule, and
the no-testnet refusal in the fan-out."""

from __future__ import annotations

from unittest.mock import patch

import pytest

import binance_abcd.hooks as hooks
import binance_abcd.mexc_adapter as mexc_adapter
import binance_abcd.routes.webhook as webhook
import binance_abcd.trading_handler as trading_handler
from binance_abcd.exchange_api import failure
from binance_abcd.mexc_adapter import MexcAdapter

BTC = {"symbol": "BTC_USDT", "contractSize": 0.0001, "volScale": 0, "minVol": 1, "maxLeverage": 200, "apiAllowed": True}
LONG_ROW = {"positionId": 555, "symbol": "BTC_USDT", "positionType": 1, "holdVol": 30, "holdAvgPrice": 60000.5,
            "openType": 2, "leverage": 15, "updateTime": 1700000000000}
SHORT_ROW = {"positionId": 556, "symbol": "BTC_USDT", "positionType": 2, "holdVol": 10, "holdAvgPrice": 61000,
             "openType": 1, "leverage": 8}


class FakeMexc:
    """A MexcFuturesAPI stand-in: canned answers per method, orders recorded."""

    api_key = "mx0k"
    base_url = "https://mexc.test"

    def __init__(self, *, positions=None, orders=None, settings=None, deals=None, order=None, mode=1):
        self._positions = list(positions) if positions is not None else [[]]
        self._orders = list(orders or [{"success": True, "data": {"orderId": "800746480548793856", "ts": 1}}])
        self._settings = settings
        self._deals = list(deals) if deals is not None else [[]]
        self._order = order
        self._mode = mode
        self.created = []
        self.position_reads = 0

    def contracts(self):
        return {"BTC_USDT": BTC}

    def contract(self, symbol):
        return self.contracts().get(symbol)

    def contract_size(self, symbol):
        return 0.0001 if symbol == "BTC_USDT" else None

    def coins_to_vol(self, symbol, coins, *, closing=False):
        from binance_abcd.mexc_api import MexcFuturesAPI
        with patch.object(MexcFuturesAPI, "contract", return_value=self.contract(symbol)):
            return MexcFuturesAPI.coins_to_vol(MexcFuturesAPI("k", "s"), symbol, coins, closing=closing)

    def open_positions(self, symbol=None):
        self.position_reads += 1
        answer = self._positions.pop(0) if len(self._positions) > 1 else self._positions[0]
        return None if answer is None else list(answer)

    def leverage_settings(self, symbol):
        return self._settings

    def create_order(self, symbol, side, vol, *, open_type, leverage=None, position_id=None, position_mode=None, external_oid=None):
        self.created.append({"symbol": symbol, "side": side, "vol": vol, "openType": open_type, "leverage": leverage,
                             "positionId": position_id, "positionMode": position_mode})
        return self._orders.pop(0) if len(self._orders) > 1 else self._orders[0]

    def deal_details(self, order_id):
        return self._deals.pop(0) if len(self._deals) > 1 else self._deals[0]

    def get_order(self, order_id):
        return self._order

    def position_mode(self):
        return self._mode

    def change_position_mode(self, mode):
        self._mode = mode
        return {"success": True, "data": None}


@pytest.fixture(autouse=True)
def _no_mode_check_and_no_sleep(monkeypatch):
    monkeypatch.setattr(trading_handler, "ensure_position_mode", lambda api, ticker: None)
    monkeypatch.setattr(trading_handler, "EXIT_RETRY_ATTEMPTS", 2)
    monkeypatch.setattr(trading_handler, "EXIT_RETRY_SECONDS", 0.0)
    monkeypatch.setattr(trading_handler, "FILL_SUMMARY_ATTEMPTS", 2)
    monkeypatch.setattr(trading_handler, "FILL_SUMMARY_RETRY_SECONDS", 0.0)


# --- Entries -------------------------------------------------------------------

def test_entry_converts_coins_to_contracts_and_sends_leverage_on_the_order():
    api = FakeMexc(positions=[[]])
    adapter = MexcAdapter(api)
    adapter.set_leverage("BTCUSDT", 25)           # what _maybe_set_leverage does for LEVERAGE_PER_ORDER
    result = trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.005, 60000.0)

    assert result["result"]["orderId"] == 800746480548793856
    assert result["result"]["avgPrice"] is None   # MEXC's create answers no price; the position read fills it
    order = api.created[0]
    assert order == {"symbol": "BTC_USDT", "side": 1, "vol": "50", "openType": hooks.MEXC_OPEN_TYPE,
                     "leverage": 25, "positionId": None, "positionMode": 1}


def test_stacking_reuses_the_existing_positions_leverage_open_type_and_id():
    api = FakeMexc(positions=[[LONG_ROW]])
    adapter = MexcAdapter(api)
    adapter.set_leverage("BTCUSDT", 25)           # the signal says 25 — the position says 15; 15 wins (7004 otherwise)
    trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.001, None)
    order = api.created[0]
    assert (order["leverage"], order["openType"], order["positionId"]) == (15, 2, 555)
    # A SHORT entry on the same symbol does not inherit the LONG's settings.
    api2 = FakeMexc(positions=[[LONG_ROW]])
    adapter2 = MexcAdapter(api2)
    adapter2.set_leverage("BTCUSDT", 25)
    trading_handler.handle_entry(adapter2, "BTCUSDT", "SELL", 0.001, None)
    assert (api2.created[0]["side"], api2.created[0]["leverage"], api2.created[0]["positionId"]) == (3, 25, None)


def test_leverage_falls_back_to_the_accounts_setting_then_env_then_refuses(monkeypatch):
    settings = [{"positionType": 1, "leverage": 12}, {"positionType": 2, "leverage": 7}]
    api = FakeMexc(positions=[[]], settings=settings)
    trading_handler.handle_entry(MexcAdapter(api), "BTCUSDT", "SELL", 0.001, None)
    assert api.created[0]["leverage"] == 7                    # the SHORT setting

    monkeypatch.setattr(mexc_adapter, "MEXC_DEFAULT_LEVERAGE", 20)
    api = FakeMexc(positions=[[]], settings=[])
    trading_handler.handle_entry(MexcAdapter(api), "BTCUSDT", "BUY", 0.001, None)
    assert api.created[0]["leverage"] == 20

    monkeypatch.setattr(mexc_adapter, "MEXC_DEFAULT_LEVERAGE", 0)
    api = FakeMexc(positions=[[]], settings=None)
    result = trading_handler.handle_entry(MexcAdapter(api), "BTCUSDT", "BUY", 0.001, None)
    assert result["result"] is None and "leverage unknown" in result["error"]
    assert result["transient"] is False and api.created == []


def test_leverage_is_clamped_to_the_contracts_maximum():
    api = FakeMexc(positions=[[]])
    adapter = MexcAdapter(api)
    adapter.set_leverage("BTCUSDT", 125)
    trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.001, None)
    assert api.created[0]["leverage"] == 125  # maxLeverage 200 — untouched
    api = FakeMexc(positions=[[]])
    with patch.dict(BTC, {"maxLeverage": 50}):
        adapter = MexcAdapter(api)
        adapter.set_leverage("BTCUSDT", 125)
        trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.001, None)
    assert api.created[0]["leverage"] == 50


def test_a_size_under_one_contract_is_refused_before_any_order():
    api = FakeMexc(positions=[[]])
    adapter = MexcAdapter(api)
    adapter.set_leverage("BTCUSDT", 10)
    result = trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.00005, None)
    assert result["result"] is None and "size too small" in result["error"]
    assert result["transient"] is False and api.created == []


def test_an_unmappable_ticker_is_refused_not_guessed():
    api = FakeMexc()
    result = trading_handler.handle_entry(MexcAdapter(api), "BTCUSD", "BUY", 1, None)
    assert result["result"] is None and "not a USDT-quoted ticker" in result["error"]
    assert api.created == []


def test_unreadable_positions_fail_the_entry_closed():
    api = FakeMexc(positions=[None])
    adapter = MexcAdapter(api)
    adapter.set_leverage("BTCUSDT", 10)
    result = trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.001, None)
    assert result["result"] is None and result["transient"] is True and api.created == []


def test_7002_resyncs_hedge_mode_once_and_retries():
    mismatch = failure("Position mode mismatch", code=7002, transient=False)
    api = FakeMexc(positions=[[]], orders=[mismatch, {"success": True, "data": {"orderId": "9"}}], mode=2)
    adapter = MexcAdapter(api)
    adapter.set_leverage("BTCUSDT", 10)
    result = trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.001, None)
    assert result["result"]["orderId"] == 9
    assert len(api.created) == 2 and api._mode == 1


def test_a_refused_entry_carries_mexcs_code_and_message():
    api = FakeMexc(positions=[[]], orders=[failure("Balance insufficient", code=2005, transient=False)])
    adapter = MexcAdapter(api)
    adapter.set_leverage("BTCUSDT", 10)
    result = trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.001, None)
    assert result["result"] is None
    assert result["error"] == "2005 Balance insufficient"
    assert result["transient"] is False and result["rate_limited"] is False


# --- Exits -----------------------------------------------------------------------

def test_exit_closes_the_whole_position_with_the_close_side_and_position_id():
    api = FakeMexc(positions=[[LONG_ROW, SHORT_ROW]])
    result = trading_handler.handle_exit(MexcAdapter(api), "BTCUSDT", "LONG", 59000.0)
    assert result["closed_quantity"] == pytest.approx(0.003)     # 30 contracts × 0.0001, in coins
    assert result["entry_price"] == 60000.5
    assert result["side"] == "LONG"
    assert result["result"]["orderId"] == 800746480548793856
    order = api.created[0]
    assert order == {"symbol": "BTC_USDT", "side": 4, "vol": "30", "openType": 2, "leverage": None,
                     "positionId": 555, "positionMode": 1}


def test_exit_short_uses_side_2_and_the_shorts_own_row():
    api = FakeMexc(positions=[[LONG_ROW, SHORT_ROW]])
    result = trading_handler.handle_exit(MexcAdapter(api), "BTCUSDT", "SHORT", None)
    assert result["closed_quantity"] == pytest.approx(0.001)
    assert api.created[0]["side"] == 2 and api.created[0]["positionId"] == 556 and api.created[0]["openType"] == 1


def test_exit_with_nothing_open_is_a_skip_not_an_order():
    api = FakeMexc(positions=[[SHORT_ROW]])
    result = trading_handler.handle_exit(MexcAdapter(api), "BTCUSDT", "LONG", None)
    assert result == {"status": "no long position to close"}
    assert api.created == []


def test_a_transient_exit_failure_rereads_and_stops_when_flat():
    """The 408 twin on MEXC: the first close is unconfirmed, the re-read finds
    the side flat, so nothing is placed twice."""
    timeout = failure("read timed out", transient=True)
    api = FakeMexc(positions=[[LONG_ROW], []], orders=[timeout])
    result = trading_handler.handle_exit(MexcAdapter(api), "BTCUSDT", "LONG", None)
    assert result == {"status": "no long position to close"}
    assert len(api.created) == 1 and api.position_reads == 2


def test_nothing_left_to_close_is_reread_rather_than_alerted():
    gone = failure("Position is nonexistent or closed", code=2009, transient=False)
    api = FakeMexc(positions=[[LONG_ROW], []], orders=[gone])
    result = trading_handler.handle_exit(MexcAdapter(api), "BTCUSDT", "LONG", None)
    assert result == {"status": "no long position to close"}


def test_a_rejected_exit_is_returned_with_its_code():
    rejected = failure("Order quantity error", code=2011, transient=False)
    api = FakeMexc(positions=[[LONG_ROW]], orders=[rejected])
    result = trading_handler.handle_exit(MexcAdapter(api), "BTCUSDT", "LONG", None)
    assert result["result"] is None and result["transient"] is False
    assert result["error"] == "2011 Order quantity error"
    assert len(api.created) == 1


# --- Fill summary ------------------------------------------------------------------

def test_fill_summary_sums_profit_and_weights_price_by_contracts():
    deals = [
        {"id": 1, "orderId": "9", "side": 4, "vol": 20, "price": 59000, "fee": 0.02, "feeCurrency": "USDT", "profit": -2.0},
        {"id": 2, "orderId": "9", "side": 4, "vol": 10, "price": 59300, "fee": 0.01, "feeCurrency": "USDT", "profit": -0.7},
    ]
    api = FakeMexc(deals=[[], deals])
    pnl, exit_price = trading_handler.get_order_fill_summary(MexcAdapter(api), "BTCUSDT", "9")
    assert pnl == pytest.approx(-2.7)
    assert exit_price == pytest.approx(59100.0)


def test_fill_summary_gives_up_once_the_order_is_dead():
    api = FakeMexc(deals=[[]], order={"orderId": "9", "state": 4})
    assert trading_handler.get_order_fill_summary(MexcAdapter(api), "BTCUSDT", "9") == (None, None)


def test_fill_summary_adds_the_fee_back_when_profit_is_net(monkeypatch):
    monkeypatch.setattr(mexc_adapter, "DEAL_PROFIT_IS_NET", True)
    deals = [{"id": 1, "orderId": "9", "side": 4, "vol": 10, "price": 100, "fee": 0.5, "profit": 9.5}]
    api = FakeMexc(deals=[deals])
    pnl, _ = trading_handler.get_order_fill_summary(MexcAdapter(api), "BTCUSDT", "9")
    assert pnl == pytest.approx(10.0)


# --- The fan-out: demo MEXC rows trade the testnet, live rows mainnet ---------------

def test_run_account_builds_a_demo_mexc_client_on_the_testnet_host(fake_assets):
    account = {"api_key": "mx0k", "secret_key": "s", "name": "Demo MEXC", "uni_id": "u1",
               "balance": 5000.0, "total_deposit": 5000.0, "demo": True, "exchange": "mexc"}
    seen = {}

    def entry(api, symbol, side, quantity, price):
        seen["api"] = api
        return {"result": {"orderId": 1, "avgPrice": None}, "quantity": quantity}

    with (
        patch.object(webhook, "handle_entry", side_effect=entry),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
    ):
        result = webhook._run_account(account, "BUY", "BTCUSDT", 100.0, 10, None, fake_assets["BTCUSDT"], {})
    assert result["status"] == "filled" and result["exchange"] == "mexc"
    assert seen["api"].base_url == hooks.MEXC_TESTNET_API_BASE


def test_run_account_builds_a_mexc_client_and_reports_its_exchange(fake_assets):
    account = {"api_key": "mx0k", "secret_key": "s", "name": "Live MEXC", "uni_id": "u1",
               "balance": 1000.0, "total_deposit": 1000.0, "demo": False, "exchange": "mexc"}
    seen = {}

    def entry(api, symbol, side, quantity, price):
        seen["api"] = api
        return {"result": {"orderId": 1, "avgPrice": None}, "quantity": quantity}

    with (
        patch.object(webhook, "handle_entry", side_effect=entry),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}) as post,
    ):
        result = webhook._run_account(account, "BUY", "BTCUSDT", 100.0, 10, "strat", fake_assets["BTCUSDT"], {})
    assert result["status"] == "filled" and result["exchange"] == "mexc"
    assert isinstance(seen["api"], MexcAdapter)
    assert seen["api"]._leverage == {"BTC_USDT": 10}            # leverage memoised, not POSTed
    assert {c.kwargs["exchange"] for c in post.call_args_list} == {"mexc"}
    assert {c.args[0] for c in post.call_args_list} == {"positions/upsert", "open-strategies"}
