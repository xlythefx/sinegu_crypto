"""BybitAdapter through the exchange-neutral handle_entry / handle_exit:
positionIdx, reduce-only closes, qty rounding, the gross/net switch, and the
one-way-account case that would otherwise make every exit a no-op."""

from __future__ import annotations

from unittest.mock import patch

import binance_abcd.bybit_api as bybit_api
import binance_abcd.bybit_adapter as bybit_adapter
import binance_abcd.hooks as hooks
import binance_abcd.trading_handler as trading_handler
from binance_abcd.bybit_adapter import BybitAdapter, closed_gross_pnl, execution_gross_pnl
from binance_abcd.exchange_api import failure

BTC = {
    "symbol": "BTCUSDT", "status": "Trading",
    "lotSizeFilter": {"qtyStep": "0.001", "minOrderQty": "0.001", "maxMktOrderQty": "100"},
    "leverageFilter": {"maxLeverage": "100"},
}

HEDGE_LONG = {"symbol": "BTCUSDT", "side": "Buy", "size": "0.003", "avgPrice": "60000.5",
              "positionIdx": 1, "markPrice": "60500", "unrealisedPnl": "1.5",
              "positionValue": "181.5", "positionIM": "18.15", "positionMM": "0.9",
              "tradeMode": "0", "updatedTime": "1700000000000"}
HEDGE_SHORT = {"symbol": "BTCUSDT", "side": "Sell", "size": "0.002", "avgPrice": "61000",
               "positionIdx": 2, "markPrice": "60500", "unrealisedPnl": "1.0",
               "positionValue": "121", "tradeMode": "1", "positionIM": "12.1",
               "updatedTime": "1700000000000"}
ONE_WAY_LONG = {"symbol": "BTCUSDT", "side": "Buy", "size": "0.003", "avgPrice": "60000.5",
                "positionIdx": 0, "markPrice": "60500", "unrealisedPnl": "1.5",
                "updatedTime": "1700000000000"}
FLAT_HEDGE = [{"symbol": "BTCUSDT", "side": "", "size": "0", "positionIdx": 1},
              {"symbol": "BTCUSDT", "side": "", "size": "0", "positionIdx": 2}]


class FakeBybit:
    """A BybitFuturesAPI stand-in: canned answers per method, orders recorded."""

    api_key = "bybitkey"

    def __init__(self, *, positions=None, orders=None, executions=None, order=None,
                 base_url="https://bybit.test", leverage_result=None):
        self._positions = list(positions) if positions is not None else [[]]
        self._orders = list(orders or [{"retCode": 0, "result": {"orderId": "1321003749386327552"}}])
        self._executions = list(executions) if executions is not None else [[]]
        self._order = order
        self.base_url = base_url
        self._leverage_result = leverage_result
        self.created = []
        self.leverage_calls = []
        self.mode_calls = []
        self.position_reads = 0

    def instrument(self, symbol):
        return BTC if symbol == "BTCUSDT" else None

    def max_leverage(self, symbol):
        return 100 if symbol == "BTCUSDT" else None

    def round_qty(self, symbol, coins, *, closing=False):
        real = bybit_api.BybitFuturesAPI("k", "s")
        with patch.object(bybit_api.BybitFuturesAPI, "instrument", return_value=self.instrument(symbol)):
            return real.round_qty(symbol, coins, closing=closing)

    def positions(self, symbol=None):
        self.position_reads += 1
        answer = self._positions.pop(0) if len(self._positions) > 1 else self._positions[0]
        return None if answer is None else list(answer)

    def switch_mode(self, mode):
        self.mode_calls.append(mode)
        return {"retCode": 0, "result": {}}

    def set_leverage(self, symbol, leverage):
        self.leverage_calls.append((symbol, leverage))
        return self._leverage_result or {"retCode": 0, "result": {}}

    def create_order(self, symbol, side, qty, *, position_idx, reduce_only=False):
        self.created.append({"symbol": symbol, "side": side, "qty": qty,
                             "positionIdx": position_idx, "reduceOnly": reduce_only})
        return self._orders.pop(0) if len(self._orders) > 1 else self._orders[0]

    def executions(self, *, symbol=None, order_id=None, start_ms=None, end_ms=None, max_pages=10):
        answer = self._executions.pop(0) if len(self._executions) > 1 else self._executions[0]
        return (None, False) if answer is None else (list(answer), True)

    def order(self, order_id, symbol=None):
        return self._order

    def wallet_balance(self):
        return getattr(self, "_wallet", None)

    def query_api(self):
        return getattr(self, "_query_api", None)

    def transaction_log(self, *, kind, start_ms=None, end_ms=None, max_pages=5):
        answer = getattr(self, "_tx_log", {}).get(kind)
        return (None, False) if answer is None else (list(answer), True)


def _adapter(**kwargs) -> tuple[BybitAdapter, FakeBybit]:
    api = FakeBybit(**kwargs)
    return BybitAdapter(api), api


# --- Entries ------------------------------------------------------------------

def test_entry_places_a_market_order_with_the_observed_hedge_position_idx():
    adapter, api = _adapter(positions=[[HEDGE_LONG, HEDGE_SHORT]])
    trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.003, 60000.0)
    assert api.created == [{"symbol": "BTCUSDT", "side": "Buy", "qty": "0.003",
                            "positionIdx": 1, "reduceOnly": False}]

    adapter, api = _adapter(positions=[[HEDGE_LONG, HEDGE_SHORT]])
    trading_handler.handle_entry(adapter, "BTCUSDT", "SELL", 0.002, 60000.0)
    assert api.created[0]["positionIdx"] == 2


def test_entry_on_a_one_way_account_uses_idx_zero():
    """The idx is READ off the account's own rows, never taken from config: a
    positionIdx that disagrees with the account's mode is rejected on EVERY
    order, and config cannot know which mode a customer's account is in."""
    adapter, api = _adapter(positions=[[ONE_WAY_LONG]])
    trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.003, 60000.0)
    assert api.created[0]["positionIdx"] == 0


def test_a_size_under_min_order_qty_is_refused_before_any_order():
    adapter, api = _adapter(positions=[[]])
    result = trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.0004, 60000.0)
    assert "size too small" in result["error"]
    assert api.created == []


def test_unreadable_positions_fail_the_entry_closed():
    """An order placed without knowing the account's real mode carries a
    positionIdx Bybit may reject — so an unreadable read is transient, not a
    guess."""
    adapter, api = _adapter(positions=[None])
    result = trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.003, 60000.0)
    assert api.created == []
    assert "could not read positions" in result["error"]


def test_an_unmappable_ticker_is_refused_not_guessed():
    adapter, api = _adapter(positions=[[]])
    for bad in ("BTCUSD", "BTCPERP"):
        result = trading_handler.handle_entry(adapter, bad, "BUY", 0.003, 60000.0)
        assert "not a USDT-quoted ticker" in result["error"]
    assert api.created == []


def test_a_refused_entry_carries_bybits_own_code_and_message():
    adapter, api = _adapter(
        positions=[[]],
        orders=[failure("ab not enough for new order", code=110007, transient=False)],
    )
    result = trading_handler.handle_entry(adapter, "BTCUSDT", "BUY", 0.003, 60000.0)
    assert "110007" in result["error"] or "ab not enough" in result["error"]


# --- Exits --------------------------------------------------------------------

def test_exit_flips_the_side_sets_reduce_only_and_matches_the_position_idx():
    adapter, api = _adapter(positions=[[HEDGE_LONG, HEDGE_SHORT]])
    trading_handler.handle_exit(adapter, "BTCUSDT", "LONG", 60500.0)
    assert api.created == [{"symbol": "BTCUSDT", "side": "Sell", "qty": "0.003",
                            "positionIdx": 1, "reduceOnly": True}]

    adapter, api = _adapter(positions=[[HEDGE_LONG, HEDGE_SHORT]])
    trading_handler.handle_exit(adapter, "BTCUSDT", "SHORT", 60500.0)
    assert api.created[0] == {"symbol": "BTCUSDT", "side": "Buy", "qty": "0.002",
                              "positionIdx": 2, "reduceOnly": True}


def test_a_one_way_account_still_answers_long_and_short():
    """The regression this venue is most exposed to.

    A Bybit UNIFIED account may not support hedge mode on linear at all. The
    core asks for `risk.get("LONG")`, so if position_map keyed a one-way row as
    "BOTH", every exit would read "no position to close" — positions would open
    and never close. A one-way `side: "Buy"` row IS a long, so it is mapped as
    one.
    """
    adapter, api = _adapter(positions=[[ONE_WAY_LONG]])
    assert adapter.position_map("BTCUSDT") == {"LONG": (0.003, 60000.5)}

    adapter, api = _adapter(positions=[[ONE_WAY_LONG]])
    trading_handler.handle_exit(adapter, "BTCUSDT", "LONG", 60500.0)
    assert api.created[0]["positionIdx"] == 0
    assert api.created[0]["reduceOnly"] is True

    adapter, api = _adapter(positions=[[ONE_WAY_LONG]])
    result = trading_handler.handle_exit(adapter, "BTCUSDT", "SHORT", 60500.0)
    assert result["status"] == "no short position to close"
    assert api.created == []


def test_exit_closes_the_whole_position_using_bybits_own_size_string():
    """Bybit's own `size` goes on the wire verbatim when it matches what we were
    asked to close — never a coin figure float arithmetic has shaved a step off."""
    row = dict(HEDGE_LONG, size="0.2")
    adapter, api = _adapter(positions=[[row]])
    adapter.position_map("BTCUSDT")
    result = adapter.place_market_exit("BTCUSDT", "LONG", 0.3 - 0.1)  # 0.19999999999999998
    assert result.get("_error") is not True
    assert api.created[0]["qty"] == "0.2"


def test_a_partial_close_rounds_half_even_rather_than_flooring():
    adapter, api = _adapter(positions=[[dict(HEDGE_LONG, size="0.5")]])
    adapter.position_map("BTCUSDT")
    adapter.place_market_exit("BTCUSDT", "LONG", 0.3 - 0.1)
    assert api.created[0]["qty"] == "0.2"


def test_110017_on_a_close_is_reread_rather_than_alerted():
    """"Reduce-only rule not satisfied" means the position moved under us. Marked
    transient so handle_exit re-reads; a flat re-read is "nothing to close", not
    a red MANUAL ACTION alert for a position that is already closed."""
    adapter, api = _adapter(
        positions=[[HEDGE_LONG], []],
        orders=[failure("Reduce-only rule not satisfied", code=110017, transient=False)],
    )
    result = trading_handler.handle_exit(adapter, "BTCUSDT", "LONG", 60500.0)
    assert result["status"] == "no long position to close"


# --- Leverage -----------------------------------------------------------------

def test_set_leverage_posts_and_is_clamped_to_the_instrument_max():
    adapter, api = _adapter()
    assert adapter.set_leverage("BTCUSDT", 25) is None
    assert api.leverage_calls == [("BTCUSDT", 25)]

    adapter, api = _adapter()
    adapter.set_leverage("BTCUSDT", 500)
    assert api.leverage_calls == [("BTCUSDT", 100)]


def test_leverage_is_posted_not_carried_on_the_order():
    """Binance-shaped, unlike MEXC — so there is no signal/account/env ladder
    and no reuse of an existing position's leverage."""
    assert BybitAdapter.LEVERAGE_PER_ORDER is False


# --- Fill summary -------------------------------------------------------------

def test_fill_summary_sums_gross_pnl_and_weights_price_by_qty():
    execs = [
        {"execPrice": "60000", "execQty": "0.002", "execFee": "0.066", "closedPnl": "1.0"},
        {"execPrice": "60500", "execQty": "0.001", "execFee": "0.033", "closedPnl": "0.5"},
    ]
    adapter, _api = _adapter(executions=[execs])
    pnl, price = adapter.fill_summary_once("BTCUSDT", 1)
    assert round(price, 4) == round((60000 * 0.002 + 60500 * 0.001) / 0.003, 4)
    # CLOSED_PNL_IS_NET is True, so each fill's fee is added back to reach gross.
    assert round(pnl, 6) == round(1.0 + 0.066 + 0.5 + 0.033, 6)


def test_fill_summary_gives_up_once_the_order_is_cancelled():
    """A Bybit market order is an IOC limit inside a slippage band, so it can be
    ACCEPTED and then cancelled having filled nothing. Without this branch every
    such order burns the whole retry budget and then publishes a close with no
    PnL line."""
    adapter, _api = _adapter(executions=[[]], order={"orderStatus": "Cancelled"})
    assert adapter.fill_summary_once("BTCUSDT", 1) == (None, None)


def test_fill_summary_keeps_retrying_while_the_order_is_still_live():
    adapter, _api = _adapter(executions=[[]], order={"orderStatus": "New"})
    assert adapter.fill_summary_once("BTCUSDT", 1) is None


def test_a_failed_execution_read_is_none_not_empty():
    adapter, _api = _adapter(executions=[None])
    assert adapter.fill_summary_once("BTCUSDT", 1) is None


# --- The gross/net switch -----------------------------------------------------

def test_closed_gross_pnl_prefers_the_value_fields():
    """cumExitValue - cumEntryValue is gross BY DEFINITION, so a wrong
    CLOSED_PNL_IS_NET cannot corrupt it."""
    row = {"side": "Sell", "cumEntryValue": "1000", "cumExitValue": "1010",
           "closedPnl": "9.0", "openFee": "0.55", "closeFee": "0.45", "symbol": "BTCUSDT"}
    assert closed_gross_pnl(row) == 10.0

    short = {"side": "Buy", "cumEntryValue": "1010", "cumExitValue": "1000",
             "closedPnl": "9.0", "openFee": "0.55", "closeFee": "0.45"}
    assert closed_gross_pnl(short) == 10.0


def test_closed_gross_pnl_falls_back_to_the_switch_when_values_are_missing():
    row = {"side": "Sell", "closedPnl": "9.0", "openFee": "0.55", "closeFee": "0.45"}
    assert bybit_adapter.CLOSED_PNL_IS_NET is True
    assert round(closed_gross_pnl(row), 6) == 10.0

    with patch.object(bybit_adapter, "CLOSED_PNL_IS_NET", False):
        assert closed_gross_pnl(row) == 9.0

    assert closed_gross_pnl({"side": "Sell"}) is None


def test_closed_gross_pnl_logs_and_falls_back_on_a_direction_disagreement(caplog):
    """If our reading of `side` is wrong, every realized P&L has the wrong sign.
    The guard makes that loud the first time it happens rather than silent."""
    row = {"side": "Sell", "cumEntryValue": "1000", "cumExitValue": "1010",
           "closedPnl": "-50", "openFee": "0.5", "closeFee": "0.5", "symbol": "BTCUSDT",
           "orderId": "1"}
    with caplog.at_level("ERROR"):
        value = closed_gross_pnl(row)
    assert "direction disagreement" in caplog.text
    assert value == -49.0  # fell back to closedPnl + fees


def test_execution_gross_pnl_adds_the_fee_back_only_when_the_switch_says_net():
    row = {"closedPnl": "1.0", "execFee": "0.066"}
    assert round(execution_gross_pnl(row), 6) == 1.066
    with patch.object(bybit_adapter, "CLOSED_PNL_IS_NET", False):
        assert execution_gross_pnl(row) == 1.0
    assert execution_gross_pnl({}) is None


# --- Poller-facing reads ------------------------------------------------------

def test_account_balance_reads_both_figures_without_arithmetic():
    adapter, api = _adapter()
    api._wallet = {"totalWalletBalance": "1234.5", "totalPerpUPL": "12.25"}
    assert adapter.account_balance() == (1234.5, 12.25)

    # Portfolio margin leaves the account-level totals empty — fall back to USDT.
    api._wallet = {"totalWalletBalance": "", "totalPerpUPL": "",
                   "coin": [{"coin": "USDT", "walletBalance": "500", "unrealisedPnl": "-2"}]}
    assert adapter.account_balance() == (500.0, -2.0)

    api._wallet = None
    assert adapter.account_balance() is None


def test_open_positions_rows_map_every_field_off_the_row():
    """No second call and no derivation, unlike MEXC where mark price and
    notional have to be fetched and computed."""
    adapter, _api = _adapter(positions=[[HEDGE_LONG, HEDGE_SHORT]])
    rows = {r["position_side"]: r for r in adapter.open_positions_rows()}
    long_row = rows["LONG"]
    assert long_row["symbol"] == "BTCUSDT"
    assert long_row["position_amt"] == 0.003
    assert long_row["mark_price"] == 60500.0
    assert long_row["notional"] == 181.5
    assert long_row["maint_margin"] == 0.9
    assert long_row["isolated_margin"] is None      # tradeMode 0 = cross
    assert rows["SHORT"]["position_amt"] == -0.002  # SHORT is negative, Binance-style
    assert rows["SHORT"]["isolated_margin"] == 12.1  # tradeMode 1 = isolated


def test_open_positions_is_none_on_a_failed_read_and_empty_when_flat():
    adapter, _api = _adapter(positions=[None])
    assert adapter.open_positions_rows() is None
    adapter, _api = _adapter(positions=[FLAT_HEDGE])
    assert adapter.open_positions_rows() == []


def test_trade_permission_reads_the_keys_own_permissions():
    adapter, api = _adapter()
    api._query_api = {"readOnly": 0, "permissions": {"ContractTrade": ["Order", "Position"]}}
    assert adapter.trade_permission() is True

    api._query_api = {"readOnly": 1, "permissions": {"ContractTrade": ["Order"]}}
    assert adapter.trade_permission() is False

    api._query_api = {"readOnly": 0, "permissions": {"Derivatives": ["DerivativesTrade"]}}
    assert adapter.trade_permission() is True

    api._query_api = {"readOnly": 0, "permissions": {"Spot": ["SpotTrade"]}}
    assert adapter.trade_permission() is False

    api._query_api = None
    assert adapter.trade_permission() is None


def test_trade_permission_is_unknown_on_the_demo_host():
    """api-demo does not serve /v5/user/query-api, and None always leaves the
    standing verdict alone."""
    adapter, api = _adapter(base_url=hooks.BYBIT_DEMO_API_BASE)
    api._query_api = {"readOnly": 0, "permissions": {"ContractTrade": ["Order"]}}
    assert adapter.trade_permission() is None


def test_transfers_are_read_from_the_account_ledger_in_both_directions():
    adapter, api = _adapter()
    api._tx_log = {
        "TRANSFER_IN": [{"id": "111", "change": "500", "currency": "USDT",
                         "transactionTime": "1700000000000", "cashBalance": "1500"}],
        "TRANSFER_OUT": [{"id": "222", "change": "-200", "currency": "USDT",
                          "transactionTime": "1700000100000", "cashBalance": "1300"}],
    }
    rows = adapter.transfers_since(0)
    assert [(r["type"], r["amount"], r["tran_id"]) for r in rows] == [
        ("DEPOSIT", 500.0, "111"), ("WITHDRAWAL", 200.0, "222"),
    ]
    # balance_after is populated here, unlike on the other two venues.
    assert rows[0]["balance_after"] == 1500.0


def test_a_failed_transfer_read_is_none_never_empty():
    """fetch_transfers retries an unknown; an empty list ASSERTS no money moved.
    A missed deposit reads as profit and invoices 20% of the customer's own
    capital."""
    adapter, api = _adapter()
    api._tx_log = {"TRANSFER_IN": None, "TRANSFER_OUT": []}
    assert adapter.transfers_since(0) is None
