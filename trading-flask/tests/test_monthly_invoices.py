"""Automatic monthly invoicing — 1st of the month, 23:00 Asia/Manila.

The engine only decides WHEN; the API computes every fee and skips anything
already invoiced. What these pin is the timing and the safety rules: never
early, never twice, never on a first deploy after the firing time, a dead API
retried, a refusal final, and the result kept out of the public channel.
"""

from __future__ import annotations

import json
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest

import binance_abcd.monthly_invoices as mi
from binance_abcd import hooks, notify

MANILA = ZoneInfo("Asia/Manila")


def at(day, hour, minute=0, month=10):
    return datetime(2026, month, day, hour, minute, tzinfo=MANILA)


@pytest.fixture(autouse=True)
def _isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(mi, "STATE_FILE", tmp_path / "invoice_state.json")
    monkeypatch.setattr(mi, "_next_attempt", 0.0)
    monkeypatch.setattr(hooks, "MONTHLY_INVOICE_DAY", 1)
    monkeypatch.setattr(hooks, "MONTHLY_INVOICE_AT", "23:00")
    monkeypatch.setattr(hooks, "MONTHLY_INVOICE_CATCHUP_HOURS", 72.0)
    monkeypatch.setattr(mi, "_refresh_balances", lambda: None)


def _seed(state):
    mi.STATE_FILE.write_text(json.dumps(state), encoding="utf-8")


OK = ("ok", {"success": True, "totals": {"billed": 2, "amount": 150.0}, "created": [], "skipped": [], "failed": []})


def _tick(now, answer=OK, clock=1_000.0):
    with patch.object(mi, "request_invoices", return_value=answer) as req, \
            patch.object(mi.notify, "notify_monthly_invoices") as sent, \
            patch.object(mi.notify, "notify_monthly_invoices_refused") as refused, \
            patch.object(mi.notify, "notify_monthly_invoices_missed") as missed:
        mi.run_once(MANILA, now, monotonic=clock)
    return req, sent, refused, missed


def test_billing_month_is_the_month_before_the_firing():
    assert mi.billing_month(at(1, 23)) == "2026-09"
    assert mi.billing_month(datetime(2027, 1, 1, 23, tzinfo=MANILA)) == "2026-12"


def test_next_fire_rolls_into_next_month_after_it_passed():
    assert mi.next_fire(at(1, 22), 1, 23, 0) == at(1, 23)
    assert mi.next_fire(at(1, 23, 1), 1, 23, 0) == at(1, 23, month=11)


def test_nothing_happens_before_23_00_on_the_1st():
    _seed({"binance": "2026-08"})
    req, *_ = _tick(at(1, 22, 59))
    req.assert_not_called()


def test_bills_last_month_at_23_00_and_reports_privately():
    _seed({"binance": "2026-08"})
    req, sent, *_ = _tick(at(1, 23, 0))

    req.assert_called_once_with("binance", "2026-09")
    sent.assert_called_once()
    assert json.loads(mi.STATE_FILE.read_text())["binance"] == "2026-09"


def test_never_twice_in_one_month():
    _seed({"binance": "2026-09"})
    req, *_ = _tick(at(2, 9))
    req.assert_not_called()


def test_a_deploy_before_the_firing_time_on_the_1st_still_bills_tonight():
    """No state file, firing time still ahead: nothing to seed, runs at 23:00."""
    req, *_ = _tick(at(1, 12))
    req.assert_not_called()
    assert not mi.STATE_FILE.exists()


def test_first_run_after_the_firing_time_records_without_billing():
    req, sent, *_ = _tick(at(15, 10))
    req.assert_not_called()
    sent.assert_not_called()
    assert json.loads(mi.STATE_FILE.read_text())["binance"] == "2026-09"


def test_an_unreachable_api_is_retried_later_not_marked():
    _seed({"binance": "2026-08"})
    req, *_ = _tick(at(1, 23), answer=("retry", None), clock=1_000.0)
    assert json.loads(mi.STATE_FILE.read_text())["binance"] == "2026-08"

    # Inside the back-off nothing is tried; after it, it is.
    req, *_ = _tick(at(1, 23, 5), clock=1_000.0 + 60)
    req.assert_not_called()
    req, *_ = _tick(at(1, 23, 15), clock=1_000.0 + mi.RETRY_SECONDS + 1)
    req.assert_called_once()
    assert json.loads(mi.STATE_FILE.read_text())["binance"] == "2026-09"


def test_a_refusal_is_final_and_alerted():
    _seed({"binance": "2026-08"})
    _, sent, refused, _ = _tick(at(1, 23), answer=("refused", {"error_code": "MONTH_NOT_ENDED"}))
    refused.assert_called_once()
    sent.assert_not_called()
    assert json.loads(mi.STATE_FILE.read_text())["binance"] == "2026-09"


def test_catch_up_inside_the_window_then_missed_past_it():
    _seed({"binance": "2026-08"})
    req, *_ = _tick(at(3, 12))  # ~37h late
    req.assert_called_once()

    _seed({"binance": "2026-08"})
    req, _, _, missed = _tick(at(5, 0), clock=99_999.0)  # 73h late
    req.assert_not_called()
    missed.assert_called_once()
    assert json.loads(mi.STATE_FILE.read_text())["binance"] == "2026-09"


def test_the_summary_never_falls_back_to_the_public_channel(monkeypatch):
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "")
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "-100public")
    with patch.object(notify, "_send") as send:
        notify.notify_monthly_invoices("2026-09", "binance", OK[1])
    send.assert_not_called()


def test_the_summary_names_who_owes_what(monkeypatch):
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "-100admin")
    body = {
        "totals": {"billed": 1, "amount": 100.0, "zero_fee": 1, "skipped": 1, "failed": 0},
        "created": [
            {"owner_name": "Alice", "total_fee": 100.0, "due_date": "2026-10-08"},
            {"owner_name": "Bob", "total_fee": 0.0, "due_date": "2026-10-08"},
        ],
        "skipped": [{"owner_name": "Gary", "reason": "disconnected — bill by hand if owed"}],
        "failed": [],
    }
    with patch.object(notify, "_send") as send:
        notify.notify_monthly_invoices("2026-09", "binance", body)
    text, chat = send.call_args.args
    assert chat == "-100admin"
    assert "September 2026" in text and "Alice — $100.00" in text and "Gary" in text
    assert "Bob" not in text  # a $0 month is counted, not listed
