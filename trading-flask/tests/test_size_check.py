"""size_check: proposed sizing vs Binance's position limit at a leverage.

Figures from prod on 2026-11-12: SANTOSUSDT at 10x caps at $10,000; the master
held $17,028 and SANTOS marked ~$0.38.
"""

from __future__ import annotations

import binance_abcd.hooks as hooks
from binance_abcd import size_check

WEBHOOK_SECRET = "test-webhook-secret"

SANTOS_BRACKETS = [
    {"bracket": 1, "initialLeverage": 10, "notionalFloor": 0, "notionalCap": 10000},
    {"bracket": 2, "initialLeverage": 5, "notionalFloor": 10000, "notionalCap": 60000},
    {"bracket": 3, "initialLeverage": 4, "notionalFloor": 60000, "notionalCap": 70000},
    {"bracket": 4, "initialLeverage": 3, "notionalFloor": 70000, "notionalCap": 250000},
]


def test_cap_is_the_biggest_bracket_that_still_allows_the_leverage():
    assert size_check.cap_at(SANTOS_BRACKETS, 10) == {"max_leverage": 10, "cap_usd": 10000.0, "leverage_allowed": True}
    assert size_check.cap_at(SANTOS_BRACKETS, 5)["cap_usd"] == 60000.0
    assert size_check.cap_at(SANTOS_BRACKETS, 1)["cap_usd"] == 250000.0


def test_a_leverage_above_every_bracket_has_no_cap_and_is_flagged():
    """The 9 Nov case: 25x on a coin whose maximum is 10x (-4028)."""
    assert size_check.cap_at(SANTOS_BRACKETS, 25) == {"max_leverage": 10, "cap_usd": None, "leverage_allowed": False}


def test_full_stack_uses_the_engines_own_scaling():
    accounts = [{"name": "master", "is_master": True, "balance": 17028.24},
                {"name": "small", "balance": 600}]
    out = size_check.project(accounts, "SANTOSUSDT", 400, 1200, 0.38, 10000)
    master, small = out["accounts"]
    assert out["entries"] == 3
    # 400 x 17.028 = 6811.2, floored to a tenth of base (40) -> 6800 per entry.
    assert master["entry_qty"] == 6800 and master["full_qty"] == 20400
    assert master["full_usd"] == 7752.0 and master["over"] is False
    # Below the reference balance an account trades the unscaled base.
    assert small["entry_qty"] == 400 and small["full_qty"] == 1200
    assert out["over_count"] == 0
    assert out["price_headroom_pct"] == 29.0


def test_a_bigger_account_is_flagged_over_and_the_safe_balance_is_named():
    accounts = [{"name": "whale", "balance": 25000}, {"name": "master", "is_master": True, "balance": 17028}]
    out = size_check.project(accounts, "SANTOSUSDT", 500, 1500, 0.38, 10000)
    assert out["accounts"][0]["name"] == "whale" and out["accounts"][0]["over"] is True
    # The master at 500 base: 8,500 x 3 x $0.38 = $9,690 — under, but only just.
    assert out["accounts"][1]["full_usd"] == 9690.0 and out["accounts"][1]["over"] is False
    assert out["over_count"] == 1
    # full stack = 1500 coins x $0.38 = $570 per $1,000 of balance -> cap at ~$17,544
    assert round(out["safe_balance"]) == 17544


class _FakeClient:
    def __init__(self, brackets=SANTOS_BRACKETS, mark=0.38):
        self._brackets, self._mark = brackets, mark

    def leverage_brackets(self, ticker):
        return self._brackets

    def mark_price(self, ticker):
        return self._mark


def _fake_accounts(monkeypatch, accounts, client=None):
    import binance_abcd.accounts_api as accounts_api
    import binance_abcd.exchanges as exchanges
    monkeypatch.setattr(accounts_api, "fetch_accounts", lambda force=False, exchange=None: accounts)
    monkeypatch.setattr(exchanges, "client_for", lambda account: client or _FakeClient())


def test_route_needs_the_admin_secret(client):
    assert client.post("/admin/size-check", json={}).status_code == 403


def test_route_refuses_a_bad_ticker_or_size(client):
    h = {"X-Admin-Secret": WEBHOOK_SECRET}
    assert client.post("/admin/size-check", json={"exchange": "binance", "ticker": "x y", "base_size": 1}, headers=h).status_code == 400
    assert client.post("/admin/size-check", json={"exchange": "binance", "ticker": "SANTOSUSDT", "base_size": 0}, headers=h).status_code == 400
    assert client.post("/admin/size-check", json={"exchange": "binance", "ticker": "SANTOSUSDT", "base_size": 1, "leverage": 200}, headers=h).status_code == 400


def test_route_projects_real_accounts_only_and_never_returns_keys(client, monkeypatch):
    _fake_accounts(monkeypatch, [
        {"name": "master", "is_master": True, "balance": 17028.24, "api_key": "K1", "secret_key": "S1", "exchange": "binance"},
        {"name": "demo", "demo": 1, "balance": 90000, "api_key": "K2", "secret_key": "S2", "exchange": "binance"},
    ])
    r = client.post("/admin/size-check", headers={"X-Admin-Secret": WEBHOOK_SECRET},
                    json={"exchange": "binance", "ticker": "SANTOSUSDT", "base_size": 400, "max_size": 1200, "leverage": 10})
    assert r.status_code == 200
    body = r.get_json()
    assert body["cap_usd"] == 10000.0 and body["leverage"] == 10 and body["leverage_assumed"] is False
    assert [a["name"] for a in body["accounts"]] == ["master"]
    assert "K1" not in r.get_data(as_text=True) and "S1" not in r.get_data(as_text=True)


def test_route_without_a_leverage_assumes_the_engine_default(client, monkeypatch):
    _fake_accounts(monkeypatch, [{"name": "master", "is_master": True, "balance": 5000, "exchange": "binance"}])
    r = client.post("/admin/size-check", headers={"X-Admin-Secret": WEBHOOK_SECRET},
                    json={"exchange": "binance", "ticker": "SANTOSUSDT", "base_size": 400, "max_size": 1200})
    body = r.get_json()
    assert body["leverage"] == hooks.DEFAULT_LEVERAGE and body["leverage_assumed"] is True
    assert body["leverage_allowed"] is False and body["cap_usd"] is None


def test_route_says_so_when_binance_does_not_answer(client, monkeypatch):
    _fake_accounts(monkeypatch, [{"name": "master", "is_master": True, "balance": 5000, "exchange": "binance"}],
                   client=_FakeClient(brackets=None))
    r = client.post("/admin/size-check", headers={"X-Admin-Secret": WEBHOOK_SECRET},
                    json={"exchange": "binance", "ticker": "SANTOSUSDT", "base_size": 400})
    assert r.status_code == 503
