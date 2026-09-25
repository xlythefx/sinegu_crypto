"""The balances / positions / transfers pollers across two venues: rows grouped
and posted per exchange, MEXC's units and derived fields converted at the
adapter, a failed read skipping ONE account, demo MEXC rows never polled."""

from __future__ import annotations

from unittest.mock import patch

import pytest

import binance_abcd.exchanges as exchanges
import binance_abcd.fetch_balances as fb
import binance_abcd.fetch_positions as fp
import binance_abcd.fetch_transfers as ft
import binance_abcd.hooks as hooks
from binance_abcd.mexc_adapter import MexcAdapter

BIN = {"api_key": "b-1", "secret_key": "s", "name": "Bin", "uni_id": "u1", "exchange": "binance", "demo": False}
MEX = {"api_key": "m-1", "secret_key": "s", "name": "Mex", "uni_id": "u2", "exchange": "mexc", "demo": False}
MEX_DEMO = {"api_key": "m-9", "secret_key": "s", "name": "Mex demo", "uni_id": "u3", "exchange": "mexc", "demo": True}
BYB = {"api_key": "y-1", "secret_key": "s", "name": "Byb", "uni_id": "u4", "exchange": "bybit", "demo": False}
BYB_DEMO = {"api_key": "y-9", "secret_key": "s", "name": "Byb demo", "uni_id": "u5", "exchange": "bybit", "demo": True}

BTC = {"symbol": "BTC_USDT", "contractSize": 0.0001, "volScale": 0, "minVol": 1}


@pytest.fixture(autouse=True)
def _two_exchanges(monkeypatch):
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance", "mexc"))


class FakeBinance:
    def __init__(self, api_key, secret_key, base_url=None):
        self.api_key, self.base_url = api_key, base_url

    def get_account_v3(self):
        return {"totalWalletBalance": "1000.0", "totalUnrealizedProfit": "5.0"}

    def get_positions_v3(self, symbol=None):
        return [{"symbol": "ETHUSDT", "positionAmt": "-0.5", "positionSide": "SHORT", "entryPrice": "3000",
                 "markPrice": "2990", "unRealizedProfit": "5", "updateTime": 1}]

    def get_income_history(self, income_type=None, symbol=None, start_time=None, end_time=None, limit=1000):
        return [{"income": "250", "tranId": 11, "asset": "USDT", "time": 5, "info": "TRANSFER"}]


class FakeMexc:
    fail = set()
    hosts: list[str] = []

    def __init__(self, api_key, secret_key, base_url=None):
        self.api_key, self.base_url = api_key, base_url
        FakeMexc.hosts.append(base_url)

    def asset(self, currency="USDT"):
        if "asset" in FakeMexc.fail:
            return None
        return {"currency": "USDT", "equity": 512.5, "unrealized": -3.25, "cashBalance": 515.75}

    def open_positions(self, symbol=None):
        if "positions" in FakeMexc.fail:
            return None
        return [{"positionId": 1, "symbol": "BTC_USDT", "positionType": 2, "holdVol": 20, "holdAvgPrice": 61000,
                 "openType": 1, "leverage": 10, "im": 12.2, "updateTime": "1700000000000"}]

    def contracts(self):
        return {"BTC_USDT": BTC}

    def fair_price(self, symbol):
        return 60000.0

    def transfer_records(self, *, state="SUCCESS", page_num=1, page_size=100):
        if "transfers" in FakeMexc.fail:
            return None
        if page_num > 1:
            return []
        return [
            {"id": 501, "txid": "tx-in", "currency": "USDT", "amount": 300, "type": "IN", "state": "SUCCESS", "createTime": 9_000},
            {"id": 502, "txid": "tx-out", "currency": "USDT", "amount": 50, "type": "OUT", "state": "SUCCESS", "createTime": 9_500},
            {"id": 400, "txid": "old", "currency": "USDT", "amount": 999, "type": "IN", "state": "SUCCESS", "createTime": 10},
        ]


class FakeBybit:
    fail: set = set()
    hosts: list[str] = []

    def __init__(self, api_key, secret_key, base_url=None):
        self.api_key, self.base_url = api_key, base_url
        FakeBybit.hosts.append(base_url)

    def wallet_balance(self):
        if "balance" in FakeBybit.fail:
            return None
        return {"totalWalletBalance": "2000.0", "totalPerpUPL": "7.5"}

    def positions(self, symbol=None):
        if "positions" in FakeBybit.fail:
            return None
        return [{"symbol": "BTCUSDT", "side": "Buy", "size": "0.004", "avgPrice": "60000",
                 "markPrice": "60500", "unrealisedPnl": "2.0", "positionValue": "242",
                 "positionIM": "24.2", "positionMM": "1.2", "positionIdx": 1,
                 "tradeMode": "0", "updatedTime": "1700000000000"}]

    def transaction_log(self, *, kind, start_ms=None, end_ms=None, max_pages=5):
        if "transfers" in FakeBybit.fail:
            return None, False
        if kind == "TRANSFER_IN":
            return [{"id": "701", "change": "400", "currency": "USDT",
                     "transactionTime": "9000", "cashBalance": "2400"}], True
        return [{"id": "702", "change": "-100", "currency": "USDT",
                 "transactionTime": "9500", "cashBalance": "2300"}], True


@pytest.fixture(autouse=True)
def _seams():
    FakeMexc.fail = set()
    FakeBybit.fail = set()
    with (
        patch.object(exchanges, "BinanceAPI", FakeBinance),
        patch.object(exchanges, "MexcFuturesAPI", FakeMexc),
        patch.object(exchanges, "BybitFuturesAPI", FakeBybit),
    ):
        yield


def _posts(module, accounts):
    posts = []
    with (
        patch.object(module, "fetch_accounts", return_value=list(accounts)),
        patch.object(module.engine_client, "post_json",
                     side_effect=lambda path, payload, *, exchange=None: posts.append((path, exchange, payload)) or {"success": True}),
    ):
        module.fetch_and_save()
    return posts


# --- Balances --------------------------------------------------------------------

def test_balances_are_posted_per_exchange_with_mexc_wallet_as_equity_minus_unrealized():
    posts = _posts(fb, [BIN, MEX, MEX_DEMO])
    by_ex = {ex: payload["rows"] for path, ex, payload in posts}
    assert set(by_ex) == {"binance", "mexc"}
    # No wallet-as-initial-deposit for Binance: its starting capital comes from
    # the ledger (test_ledger.py), never from a wallet that already holds the
    # deposit the transfers poller stores.
    assert by_ex["binance"] == [{"api_key": "b-1", "balance": 1000.0, "unrealized_pnl": 5.0}]
    # The demo row is polled too — against the testnet host (FakeMexc answers either).
    assert [r["api_key"] for r in by_ex["mexc"]] == ["m-1", "m-9"]
    assert by_ex["mexc"][0] == {"api_key": "m-1", "balance": pytest.approx(515.75), "unrealized_pnl": -3.25,
                                "initial_deposit": pytest.approx(515.75)}


def test_demo_mexc_rows_are_polled_on_the_testnet_host():
    FakeMexc.hosts = []
    _posts(fb, [MEX, MEX_DEMO])
    assert FakeMexc.hosts == [hooks.MEXC_API_BASE, hooks.MEXC_TESTNET_API_BASE]


def test_a_failed_mexc_balance_read_skips_that_account_only():
    FakeMexc.fail = {"asset"}
    posts = _posts(fb, [BIN, MEX])
    assert [ex for _, ex, _ in posts] == ["binance"]


# --- Bybit routes the same way ---------------------------------------------------

def test_every_bybit_poller_posts_to_the_bybit_route(monkeypatch):
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance", "mexc", "bybit"))

    balances = {ex: p["rows"] for _path, ex, p in _posts(fb, [BIN, BYB])}
    assert balances["bybit"] == [
        {"api_key": "y-1", "balance": 2000.0, "unrealized_pnl": 7.5, "initial_deposit": 2000.0}
    ]

    positions = {ex: p for _path, ex, p in _posts(fp, [BYB])}
    row = positions["bybit"]["accounts"][0]["positions"][0]
    assert row["symbol"] == "BTCUSDT" and row["position_amt"] == 0.004
    assert row["mark_price"] == 60500.0 and row["notional"] == 242.0

    transfers = {ex: p["rows"] for _path, ex, p in _posts(ft, [BYB])}
    assert [(r["type"], r["amount"], r["tran_id"]) for r in transfers["bybit"]] == [
        ("DEPOSIT", 400.0, "701"), ("WITHDRAWAL", 100.0, "702"),
    ]


def test_demo_bybit_rows_are_polled_on_the_demo_host(monkeypatch):
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance", "mexc", "bybit"))
    FakeBybit.hosts = []
    _posts(fb, [BYB, BYB_DEMO])
    assert FakeBybit.hosts == [hooks.BYBIT_API_BASE, hooks.BYBIT_DEMO_API_BASE]


def test_a_failed_bybit_read_skips_that_account_rather_than_syncing_empty(monkeypatch):
    """A full-replace positions sync fed "flat" for "unreadable" DELETES live
    rows — the 2026-08-18 incident. Same rule on every venue."""
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance", "mexc", "bybit"))
    FakeBybit.fail = {"positions"}
    posts = _posts(fp, [BIN, BYB])
    assert [ex for _path, ex, _p in posts] == ["binance"]

    FakeBybit.fail = {"transfers"}
    assert _posts(ft, [BYB]) == []


def test_admin_refresh_narrows_to_one_mexc_key(client):
    posts = []
    with (
        patch.object(fb, "fetch_accounts", return_value=[BIN, MEX]),
        patch.object(fb.engine_client, "post_json",
                     side_effect=lambda path, payload, *, exchange=None: posts.append((exchange, payload)) or {"success": True}),
    ):
        response = client.post("/admin/refresh-balances", json={"api_keys": ["m-1"]}, headers={"X-Admin-Secret": "test-webhook-secret"})
    assert response.status_code == 200
    assert posts == [("mexc", {"rows": [{"api_key": "m-1", "balance": pytest.approx(515.75), "unrealized_pnl": -3.25,
                                          "initial_deposit": pytest.approx(515.75)}]})]


# --- Positions -------------------------------------------------------------------

def test_positions_are_synced_per_exchange_in_coins_with_derived_mexc_fields():
    posts = _posts(fp, [BIN, MEX, MEX_DEMO])
    by_ex = {ex: payload["accounts"] for path, ex, payload in posts}
    assert set(by_ex) == {"binance", "mexc"}
    assert by_ex["binance"][0]["positions"][0]["symbol"] == "ETHUSDT"
    mexc = by_ex["mexc"]
    assert [a["api_key"] for a in mexc] == ["m-1", "m-9"]
    row = mexc[0]["positions"][0]
    assert row["symbol"] == "BTCUSDT" and row["position_side"] == "SHORT"
    assert row["position_amt"] == pytest.approx(-0.002)              # 20 contracts × 0.0001, SHORT negative
    assert row["entry_price"] == 61000 and row["mark_price"] == 60000.0
    assert row["unrealized_profit"] == pytest.approx((61000 - 60000) * 0.002)   # a short gained as price fell
    assert row["notional"] == pytest.approx(0.002 * 60000)
    assert row["initial_margin"] == 12.2 and row["isolated_margin"] == 12.2   # openType 1 = isolated
    assert row["maint_margin"] is None and row["isolated_wallet"] is None
    assert row["update_time"] == 1700000000000                       # string on the wire, int in the row


def test_a_failed_mexc_position_read_leaves_that_accounts_rows_alone():
    FakeMexc.fail = {"positions"}
    posts = _posts(fp, [BIN, MEX])
    assert [ex for _, ex, _ in posts] == ["binance"]


def test_mexc_positions_are_none_when_contract_sizes_are_unknown():
    class _NoContracts(FakeMexc):
        def contracts(self):
            return None

    assert MexcAdapter(_NoContracts("k", "s")).open_positions_rows() is None


# --- Transfers -------------------------------------------------------------------

def test_transfers_are_posted_per_exchange_with_mexc_ids_and_txids():
    with patch.object(ft, "TRANSFERS_LOOKBACK_DAYS", 0), patch.object(ft.time, "time", return_value=1.0):
        posts = _posts(ft, [BIN, MEX, MEX_DEMO])
    by_ex = {ex: payload["rows"] for path, ex, payload in posts}
    assert by_ex["binance"] == [{"api_key": "b-1", "uni_id": "u1", "type": "DEPOSIT", "amount": 250.0, "tran_id": 11,
                                 "currency": "USDT", "transaction_time": 5, "info": "TRANSFER"}]
    assert by_ex["mexc"][:2] == [
        {"api_key": "m-1", "uni_id": "u2", "type": "DEPOSIT", "amount": 300.0, "tran_id": 501, "currency": "USDT",
         "transaction_time": 9000, "info": "tx-in"},
        {"api_key": "m-1", "uni_id": "u2", "type": "WITHDRAWAL", "amount": 50.0, "tran_id": 502, "currency": "USDT",
         "transaction_time": 9500, "info": "tx-out"},
    ]  # id 400 is older than the window
    assert {r["api_key"] for r in by_ex["mexc"]} == {"m-1", "m-9"}  # the demo row too


def test_a_failed_mexc_transfer_read_sends_nothing_for_that_account():
    FakeMexc.fail = {"transfers"}
    with patch.object(ft, "TRANSFERS_LOOKBACK_DAYS", 0), patch.object(ft.time, "time", return_value=1.0):
        posts = _posts(ft, [BIN, MEX])
    assert [ex for _, ex, _ in posts] == ["binance"]


# --- Startup ---------------------------------------------------------------------------

def test_startup_counts_accounts_per_venue_including_demo_rows(monkeypatch):
    import binance_abcd.main as main

    monkeypatch.setattr(hooks, "SYNC_POSITION_MODE_ON_STARTUP", False)
    with (
        patch.object(main, "fetch_accounts", return_value=[BIN, MEX, MEX_DEMO]),
        patch.object(main, "fetch_assets", side_effect=lambda force=False, exchange="binance": {"BTCUSDT": {}} if exchange == "mexc" else {"BTCUSDT": {}, "ETHUSDT": {}}),
    ):
        accounts, assets = main.startup_checks()
    assert accounts == {"Binance": 1, "MEXC": 2}
    assert assets == {"Binance": 2, "MEXC": 1}


def test_startup_notification_prints_the_per_venue_split(monkeypatch):
    from binance_abcd import notify

    sent = []
    monkeypatch.setattr(hooks, "TELEGRAM_ENABLED", True)
    monkeypatch.setattr(hooks, "TELEGRAM_BOT_TOKEN", "t")
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "-1")
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "-2")
    monkeypatch.setattr(notify, "_send", lambda text, chat_id=None: sent.append(text))
    notify.notify_startup({"Binance": 2, "MEXC": 1}, {"Binance": 3, "MEXC": 3})
    assert "👤 3 accounts tradeable (Binance 2 · MEXC 1)" in sent[0]
    assert "🎯 6 assets enabled (Binance 3 · MEXC 3)" in sent[0]


def test_health_lists_every_enabled_exchange(client):
    body = client.get("/health").get_json()
    assert set(body["exchanges"]) == {"binance", "mexc"}
    assert set(body["exchanges"]["mexc"]) == {"accounts_cache_age", "assets_cache_age"}
