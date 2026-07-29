"""Tests for the pure trade-log category reducer (_derive_trade_log)."""
from src.routes.webhook import _derive_trade_log


def _ok(realized_pnl=None):
    r = {"account": "a", "ok": True, "result": {"orderId": 1}}
    if realized_pnl is not None:
        r["realized_pnl"] = realized_pnl
    return r


def _skip(reason="maxed_sizing"):
    return {"account": "a", "ok": False, "result": {"skipped": reason}}


def _no_position():
    return {"account": "a", "ok": False, "result": {"status": "no long position to close"}}


def _fail(error="binance_error"):
    return {"account": "a", "ok": False, "result": {"error": error}}


def test_entry_when_any_success():
    d = _derive_trade_log("BUY", [_ok()])
    assert d["category"] == "ENTRY"
    assert d["accounts_total"] == 1 and d["accounts_success"] == 1


def test_exit_category_and_pnl_summed():
    d = _derive_trade_log("EXIT_LONG", [_ok(realized_pnl=1.5), _ok(realized_pnl=2.25)])
    assert d["category"] == "EXIT"
    assert d["realized_pnl"] == 3.75
    assert d["accounts_success"] == 2


def test_all_skipped_is_skipped_with_reason():
    d = _derive_trade_log("BUY", [_skip("maxed_sizing"), _skip("ineligible")])
    assert d["category"] == "SKIPPED"
    assert d["accounts_skipped"] == 2
    assert d["reason"] == "maxed_sizing"  # first non-ok reason


def test_no_position_close_is_skipped_not_failed():
    d = _derive_trade_log("EXIT_LONG", [_no_position()])
    assert d["category"] == "SKIPPED"
    assert d["accounts_skipped"] == 1
    assert d["accounts_failed"] == 0


def test_attempted_failure_is_failed():
    d = _derive_trade_log("BUY", [_fail("insufficient_margin")])
    assert d["category"] == "FAILED"
    assert d["accounts_failed"] == 1
    assert d["reason"] == "insufficient_margin"


def test_success_wins_over_skip_and_fail():
    d = _derive_trade_log("BUY", [_ok(), _skip(), _fail()])
    assert d["category"] == "ENTRY"
    assert d["accounts_success"] == 1
    assert d["accounts_skipped"] == 1
    assert d["accounts_failed"] == 1


def test_empty_and_none_results_are_failed():
    assert _derive_trade_log("BUY", [])["category"] == "FAILED"
    d = _derive_trade_log("BUY", [None])
    assert d["accounts_total"] == 0 and d["category"] == "FAILED"


def test_non_exit_never_sets_pnl():
    d = _derive_trade_log("BUY", [_ok(realized_pnl=5)])
    assert d["realized_pnl"] is None
