"""ledger.py — an account's income ledger reconciled to its wallet, and the
balance poller seeding a NEW account's starting capital from it.

The incident it exists for (2026-09-25): `initial_deposit` was the wallet at
the first poll, and the transfers poller then stored the deposit that funded
that wallet — two customers were counted at twice their capital."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest

import binance_abcd.exchanges as exchanges
import binance_abcd.fetch_balances as fb
import binance_abcd.hooks as hooks
from binance_abcd import ledger


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    monkeypatch.setattr(ledger, "PAGE_PAUSE_SECONDS", 0)
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance",))


# Ten days ago: inside the ledger's lookback whatever clock reads it.
T0 = int(time.time() * 1000) - 10 * 86_400_000


def income(kind, amount, t, tran_id=None, asset="USDT", symbol=""):
    t = T0 + t
    return {"incomeType": kind, "income": str(amount), "time": t, "asset": asset,
            "tranId": tran_id if tran_id is not None else t - T0, "symbol": symbol, "info": kind}


class FakeApi:
    """A ledger served in pages of `page_size`, and a wallet that may move."""

    def __init__(self, rows, wallet, page_size=1000, wallets=None, fail_page=None, others=None):
        self.rows, self.page_size = rows, page_size
        self.wallets = list(wallets) if wallets else None
        self.wallet, self.fail_page, self.others = wallet, fail_page, others or {}
        self.pages = 0

    def get_account_v3(self):
        value = self.wallets.pop(0) if self.wallets else self.wallet
        assets = [{"asset": "USDT", "walletBalance": str(value)}]
        assets += [{"asset": a, "walletBalance": str(v)} for a, v in self.others.items()]
        return {"assets": assets, "totalWalletBalance": str(value), "totalUnrealizedProfit": "0"}

    def get_income_page(self, start_time, limit=1000):
        self.pages += 1
        if self.fail_page == self.pages:
            return None
        return [r for r in self.rows if r["time"] >= start_time][: min(limit, self.page_size)]


# The master account's real shape: funded, withdrawn, funded again, traded.
MASTER = [
    income("TRANSFER", 1000, 100, tran_id=1),
    income("COMMISSION", -2, 110, symbol="BTCUSDT"),
    income("REALIZED_PNL", 10, 120, symbol="BTCUSDT"),
    income("TRANSFER", -995, 130, tran_id=2),
    income("TRANSFER", 1050, 140, tran_id=3),
    income("FUNDING_FEE", -0.5, 150, symbol="BTCUSDT"),
]
MASTER_WALLET = 1000 - 2 + 10 - 995 + 1050 - 0.5  # 1062.5


def test_a_ledger_that_explains_the_whole_wallet_opens_at_zero():
    out = ledger.read(FakeApi(MASTER, MASTER_WALLET))
    assert out["opening_balance"] == pytest.approx(0)
    assert out["wallet_balance"] == pytest.approx(1062.5)
    assert [(t["type"], t["amount"], t["tran_id"]) for t in out["transfers"]] == [
        ("DEPOSIT", 1000.0, 1), ("WITHDRAWAL", 995.0, 2), ("DEPOSIT", 1050.0, 3),
    ]
    assert out["ledger_start"] == T0 + 100 and out["truncated"] is False
    assert out["unclassified_types"] == []


def test_money_older_than_the_ledger_is_the_opening_balance():
    """An account older than Binance's retention: what the wallet holds beyond
    every visible row is the honest `initial_deposit` remainder."""
    out = ledger.read(FakeApi(MASTER, MASTER_WALLET + 400))
    assert out["opening_balance"] == pytest.approx(400)


def test_pages_are_walked_without_losing_rows_that_share_a_millisecond(monkeypatch):
    monkeypatch.setattr(ledger, "PAGE_LIMIT", 3)
    rows = [income("COMMISSION", -1, 100 + i // 2, symbol=f"S{i}") for i in range(7)]
    api = FakeApi(rows, wallet=-7, page_size=3)
    out = ledger.read(api)
    assert out["rows"] == 7
    assert out["opening_balance"] == pytest.approx(0)


def test_a_failed_page_is_no_ledger_at_all(monkeypatch):
    monkeypatch.setattr(ledger, "PAGE_LIMIT", 2)
    assert ledger.read(FakeApi(MASTER, MASTER_WALLET, page_size=2, fail_page=2)) is None


def test_a_wallet_that_moves_during_the_read_is_retried_then_refused():
    # Moved once, then stable: the second attempt is used.
    api = FakeApi(MASTER, MASTER_WALLET, wallets=[900, MASTER_WALLET, MASTER_WALLET, MASTER_WALLET])
    assert ledger.read(api)["opening_balance"] == pytest.approx(0)
    # Never stable: no answer rather than a wrong one.
    api = FakeApi(MASTER, MASTER_WALLET, wallets=[1, 2, 3, 4, 5, 6])
    assert ledger.read(api) is None


def test_non_usdt_money_is_reported_so_the_api_can_refuse_it():
    rows = MASTER + [income("TRANSFER", 1, 160, tran_id=9, asset="BNB")]
    out = ledger.read(FakeApi(rows, MASTER_WALLET, others={"BNB": 1}))
    assert out["non_usdt_rows"] == {"BNB": 1}
    assert out["other_wallets"] == {"BNB": 1.0}
    # …and it never enters the USDT sum.
    assert out["opening_balance"] == pytest.approx(0)


def test_money_that_is_neither_a_transfer_nor_a_trade_is_named():
    rows = MASTER + [income("WELCOME_BONUS", 5, 160)]
    out = ledger.read(FakeApi(rows, MASTER_WALLET + 5))
    assert out["unclassified_types"] == ["WELCOME_BONUS"]
    assert out["opening_balance"] == pytest.approx(0)


# --- The balance poller seeds a NEW account from its ledger ----------------------

NEW = {"api_key": "b-new", "secret_key": "s", "name": "New", "uni_id": "u9",
       "exchange": "binance", "demo": False, "initial_deposit": None}
SEEDED = {**NEW, "api_key": "b-old", "initial_deposit": 1000.0}


def _run(accounts, api):
    posts = []
    with (
        patch.object(exchanges, "BinanceAPI", lambda *a, **k: api),
        patch.object(fb, "fetch_accounts", return_value=list(accounts)),
        patch.object(fb.engine_client, "post_json",
                     side_effect=lambda path, payload, *, exchange=None: posts.append((path, exchange, payload)) or {"success": True}),
    ):
        fb.fetch_and_save()
    return posts


def test_a_new_account_is_seeded_from_its_ledger_never_from_its_wallet():
    posts = _run([NEW], FakeApi(MASTER, MASTER_WALLET))
    paths = [p for p, _, _ in posts]
    assert paths == ["ledger", "balances"]
    _, exchange, seed = posts[0]
    assert exchange == "binance" and seed["api_key"] == "b-new"
    assert seed["ledger"]["opening_balance"] == pytest.approx(0)
    # The wallet (which already holds the deposits) is NOT sent as a start.
    assert "initial_deposit" not in posts[1][2]["rows"][0]


def test_an_unreadable_ledger_leaves_the_start_unset_rather_than_guess():
    posts = _run([NEW], FakeApi(MASTER, MASTER_WALLET, fail_page=1))
    assert [p for p, _, _ in posts] == ["balances"]
    assert "initial_deposit" not in posts[0][2]["rows"][0]


def test_an_account_that_already_has_a_start_costs_no_ledger_read():
    api = FakeApi(MASTER, MASTER_WALLET)
    posts = _run([SEEDED], api)
    assert [p for p, _, _ in posts] == ["balances"] and api.pages == 0
