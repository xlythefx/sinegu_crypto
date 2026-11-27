"""Per-coin leverage (Admin -> Trading Assets, `assets.leverage`, 2026-11-10).

Prompted by SANTOSUSDT on 9 Nov 2026: Binance stopped accepting 25x on the
coin, every alert still asked for 25x, and every entry failed -2027 at every
size — even 250 SANTOS (~$98). Rules pinned here:
- the coin's own leverage beats the alert's; the alert's beats the default (25);
- the Signal Log row records what the entry ASKED for;
- a refused leverage is named in the failed entry and the admin alert, so a
  -2027 is not mistaken for "the position is too big";
- a refused leverage steps down to 15x, then 10x (owner, 2026-11-27), only
  below the one refused and only when the venue answered "no".
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
                               " — 25x leverage refused (-4028 Leverage 25 is not valid); 15x and 10x refused too")
    assert not result["retryable"]
    assert "leverage_fallback" not in result


def test_a_refusal_is_not_cached_so_a_corrected_coin_is_tried_next_signal():
    api = _FakeBinance(refuse='{"code":-4028,"msg":"Leverage 25 is not valid"}')
    _run(api, ASSET, 25, {"error": "-2027"})
    api.refuse = None
    _run(api, {**ASSET, "leverage": 10}, 25, {"result": {}})
    assert api.calls == [25, 15, 10, 10]


# --- Fallback: 15x, then 10x (owner, 2026-11-27) --------------------------------

_INVALID = '{"code":-4028,"msg":"Leverage %d is not valid"}'


class _CappedBinance(_FakeBinance):
    """Accepts any leverage up to `cap`, refuses the rest with -4028 — the
    coin-maximum case (SANTOSUSDT, 9 Nov 2026). `answer` overrides the refusal."""

    def __init__(self, cap: int, answer: dict | None = None):
        super().__init__()
        self.cap = cap
        self.answer = answer

    def set_leverage(self, symbol, leverage):
        self.calls.append(leverage)
        if leverage <= self.cap:
            return {"leverage": leverage}
        return self.answer or {"_error": True, "response": _INVALID % leverage, "transient": False}


def test_a_refused_25x_trades_at_15x():
    api = _CappedBinance(cap=20)
    result = _run(api, ASSET, 25, {"result": {"avgPrice": "0.394"}})
    assert api.calls == [25, 15]
    assert result["status"] == "filled"
    assert result["leverage"] == 15
    assert result["leverage_fallback"] == {
        "asked": 25, "used": 15, "refused": "-4028 Leverage 25 is not valid", "also_refused": [],
    }


def test_no_15x_either_trades_at_10x():
    api = _CappedBinance(cap=12)
    result = _run(api, ASSET, 25, {"result": {}})
    assert api.calls == [25, 15, 10]
    assert result["leverage"] == 10
    assert result["leverage_fallback"]["also_refused"] == [15]


def test_only_lower_leverages_are_tried():
    api = _CappedBinance(cap=5)
    _run(api, {**ASSET, "leverage": 12}, 25, {"error": "-2027"})
    assert api.calls == [12, 10]  # never 15: that would be HIGHER than the coin asks
    api.calls.clear()
    result = _run(api, {**ASSET, "leverage": 10}, 25, {"error": "-2027"})
    assert api.calls == [10]
    assert result["leverage_refused"] == "-4028 Leverage 10 is not valid"


def test_the_fallback_is_remembered_so_the_next_signal_does_not_ask_25x_again():
    api = _CappedBinance(cap=20)
    _run(api, ASSET, 25, {"result": {}})
    result = _run(api, ASSET, 25, {"result": {}})
    assert api.calls == [25, 15]
    assert result["leverage"] == 15
    assert result["leverage_fallback"]["refused"] == "-4028 Leverage 25 is not valid"


@pytest.mark.parametrize("answer", [
    {"_error": True, "response": "", "transient": True},                      # timeout: 25x may have landed
    {"_error": True, "response": "", "rate_limited": True},                   # every call refused alike
    {"_error": True, "response": '{"code":-2015,"msg":"Invalid API-key, IP, or permissions for action."}'},
])
def test_no_fallback_when_a_lower_leverage_cannot_be_the_fix(answer):
    api = _CappedBinance(cap=20, answer=answer)
    result = _run(api, ASSET, 25, {"error": "-2027"})
    assert api.calls == [25]
    assert "leverage_fallback" not in result


def test_the_fallback_can_be_switched_off(monkeypatch):
    monkeypatch.setattr(webhook, "LEVERAGE_FALLBACKS", ())
    api = _CappedBinance(cap=20)
    result = _run(api, ASSET, 25, {"error": "-2027"})
    assert api.calls == [25]
    assert result["leverage_refused"] == "-4028 Leverage 25 is not valid"


def test_the_position_limit_is_measured_at_the_leverage_actually_set():
    api = _CappedBinance(cap=20)
    seen = []

    def fit(_api, _symbol, _side, leverage, *_rest):
        seen.append(leverage)
        return {"action": "ok"}

    with patch.object(webhook.exchange_limit, "fit", side_effect=fit):
        _run(api, ASSET, 25, {"result": {}})
    assert seen == [15]


@pytest.mark.parametrize("raw, expected", [
    ("15,10", (15, 10)), ("10, 15", (15, 10)), ("15,15,x,0,200", (15,)), ("", ()),
])
def test_the_fallback_ladder_reads_strictly(raw, expected):
    from binance_abcd import hooks
    assert hooks._leverage_ladder(raw) == expected


def test_the_test_feed_summary_names_the_step_down():
    line = notify._test_result_line("Dima", {
        "status": "filled", "quantity": 400,
        "leverage_fallback": {"asked": 25, "used": 15, "refused": "-4028 Leverage 25 is not valid"},
    })
    assert "15x (25x refused)" in line


def test_the_main_feed_note_goes_out_once_a_day_per_coin():
    rows = [
        {"exchange": "binance", "status": "filled",
         "leverage_fallback": {"asked": 25, "used": 15, "refused": "-4028 Leverage 25 is not valid"}},
        {"exchange": "binance", "status": "filled",
         "leverage_fallback": {"asked": 25, "used": 15, "refused": "-4028 Leverage 25 is not valid"}},
        {"exchange": "binance", "status": "filled"},
    ]
    sent = []
    with patch.object(notify, "_send_admin", sent.append):
        webhook._notify_leverage_fallbacks("SELL", "SANTOSUSDT", rows)
        webhook._notify_leverage_fallbacks("SELL", "SANTOSUSDT", rows)
    assert len(sent) == 1
    assert "refused 25x" in sent[0] and "2 account(s) traded at 15x" in sent[0]
    assert "Admin → Trading Assets" in sent[0]


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
