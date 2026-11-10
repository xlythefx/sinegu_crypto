"""Per-coin leverage (Admin -> Trading Assets, `assets.leverage`, 2026-11-10).

Prompted by SANTOSUSDT on 9 Nov 2026: Binance stopped accepting 25x on the
coin, every alert still asked for 25x, and every entry failed -2027 at every
size — even 250 SANTOS (~$98). Rules pinned here:
- the coin's own leverage beats the alert's; the alert's beats the default (25);
- the Signal Log row records what the entry ASKED for;
- a refused leverage is named in the failed entry and the admin alert, so a
  -2027 is not mistaken for "the position is too big".
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

import binance_abcd.assets_api as assets_api
import binance_abcd.notify as notify
import binance_abcd.routes.webhook as webhook

ASSET = {"ticker": "SANTOSUSDT", "base_size": 150.0, "max_size": 450.0, "max_increments": 3.0,
         "side": "ALL", "streak_sizes": {}, "leverage": None}


@pytest.fixture(autouse=True)
def _fresh_leverage_cache():
    webhook._LEVERAGE_APPLIED.clear()
    yield
    webhook._LEVERAGE_APPLIED.clear()


# --- Which leverage an entry asks for ------------------------------------------

def test_the_coins_own_leverage_beats_the_alerts():
    assert webhook._effective_leverage({**ASSET, "leverage": 10}, 25) == 10


def test_a_coin_without_one_uses_the_alerts():
    assert webhook._effective_leverage(ASSET, 20) == 20


def test_neither_set_falls_back_to_25x():
    assert webhook._effective_leverage(ASSET, None) == 25
    assert webhook._effective_leverage(None, None) == 25


def test_the_default_can_be_switched_off(monkeypatch):
    monkeypatch.setattr(webhook, "DEFAULT_LEVERAGE", 0)
    assert webhook._effective_leverage(ASSET, None) is None
    assert webhook._effective_leverage({**ASSET, "leverage": 10}, None) == 10


@pytest.mark.parametrize("raw, expected", [
    (10, 10), ("10", 10), (125, 125), (1, 1),
    (None, None), ("", None), (0, None), (126, None), ("ten", None),
])
def test_the_asset_list_reads_leverage_strictly(raw, expected):
    assert assets_api._asset_leverage({"leverage": raw}) == expected
    assert assets_api._asset_leverage({}) is None  # an API older than the column


# --- What the account run does with it -----------------------------------------

class _FakeBinance:
    LEVERAGE_PER_ORDER = False
    exchange = "binance"
    api_key = "bk1"

    def __init__(self, refuse: str | None = None):
        self.refuse = refuse
        self.calls: list[int] = []

    def set_leverage(self, symbol, leverage):
        self.calls.append(leverage)
        if self.refuse:
            return {"_error": True, "response": self.refuse}
        return {"leverage": leverage}

    def open_amount(self, symbol, side):
        return 0.0


def _account() -> dict:
    return {"api_key": "bk1", "secret_key": "s", "name": "Tal's API", "uni_id": "u1",
            "exchange": "binance", "demo": False, "enabled": True,
            "balance": 1017.0, "total_deposit": 1017.0}


def _run(api, asset, signal_leverage, entry_result):
    with (
        patch.object(webhook, "client_for", return_value=api),
        patch.object(webhook, "handle_entry", return_value=entry_result),
        patch.object(webhook, "_upsert_position_api"),
        patch.object(webhook, "_store_open_strategy"),
    ):
        return webhook._run_account(_account(), "SELL", "SANTOSUSDT", 0.394, signal_leverage, None, asset, {})


def test_the_entry_sets_the_coins_leverage_and_records_it():
    api = _FakeBinance()
    result = _run(api, {**ASSET, "leverage": 10}, 25, {"result": {"avgPrice": "0.394"}})
    assert api.calls == [10]
    assert result["status"] == "filled"
    assert result["leverage"] == 10


def test_a_refused_leverage_is_named_on_the_failed_entry():
    api = _FakeBinance(refuse='{"code":-4028,"msg":"Leverage 25 is not valid"}')
    result = _run(api, ASSET, 25, {"error": "-2027 Exceeded the maximum allowable position at current leverage."})
    assert result["status"] == "failed"
    assert result["leverage_refused"] == "-4028 Leverage 25 is not valid"
    assert result["error"] == ("-2027 Exceeded the maximum allowable position at current leverage."
                               " — 25x leverage refused (-4028 Leverage 25 is not valid)")
    assert not result["retryable"]


def test_a_refusal_is_not_cached_so_a_corrected_coin_is_tried_next_signal():
    api = _FakeBinance(refuse='{"code":-4028,"msg":"Leverage 25 is not valid"}')
    _run(api, ASSET, 25, {"error": "-2027"})
    api.refuse = None
    _run(api, {**ASSET, "leverage": 10}, 25, {"result": {}})
    assert api.calls == [25, 10]


def test_an_applied_leverage_is_not_set_twice():
    api = _FakeBinance()
    _run(api, {**ASSET, "leverage": 10}, 25, {"result": {}})
    _run(api, {**ASSET, "leverage": 10}, 25, {"result": {}})
    assert api.calls == [10]


def test_the_signal_log_row_records_the_venues_leverage():
    row = webhook._exchange_summary("SELL", "SANTOSUSDT", 0.394, None, 10, "binance", False, [], target_count=0)
    assert row["leverage"] == 10


# --- The admin alert -----------------------------------------------------------

def test_the_alert_says_the_leverage_was_refused_and_where_to_fix_it():
    sent = []
    with patch.object(notify, "_send_admin", sent.append):
        notify.notify_account_failures("SELL", "SANTOSUSDT", [
            ("Tal's API", "-2027 Exceeded … — 25x leverage refused (-4028 Leverage 25 is not valid)", "binance"),
        ])
    assert "refused the leverage" in sent[0]
    assert "Admin → Trading Assets" in sent[0]


def test_an_ordinary_rejection_gets_no_leverage_line():
    sent = []
    with patch.object(notify, "_send_admin", sent.append):
        notify.notify_account_failures("SELL", "SANTOSUSDT", [("Tal's API", "-2019 Margin is insufficient.", "binance")])
    assert "leverage" not in sent[0].lower()
