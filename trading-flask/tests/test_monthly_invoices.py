"""Automatic monthly billing — 1st invoice, 2nd/3rd reminders, 4th pause, 16:00 Bangkok.

The engine only decides WHEN; the API computes every fee, sends every email
and skips anything already done. What these pin is the timing and the safety
rules: never early, never twice, never on a first deploy after a step's time,
a dead API retried, a refusal final, a stale reminder dropped, and every
outcome kept out of the public channel.
"""

from __future__ import annotations

import json
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest

import binance_abcd.monthly_invoices as mi
from binance_abcd import hooks, notify

BKK = ZoneInfo("Asia/Bangkok")


def at(day, hour, minute=0, month=10):
    return datetime(2026, month, day, hour, minute, tzinfo=BKK)


@pytest.fixture(autouse=True)
def _isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(mi, "STATE_FILE", tmp_path / "invoice_state.json")
    monkeypatch.setattr(mi, "_next_attempt", {})
    monkeypatch.setattr(hooks, "MONTHLY_INVOICE_DAY", 1)
    monkeypatch.setattr(hooks, "MONTHLY_INVOICE_AT", "16:00")
    monkeypatch.setattr(hooks, "MONTHLY_INVOICE_CATCHUP_HOURS", 72.0)
    monkeypatch.setattr(mi, "_refresh_balances", lambda: None)


def _seed(state):
    mi.STATE_FILE.write_text(json.dumps(state), encoding="utf-8")


def _state():
    return json.loads(mi.STATE_FILE.read_text())


#: Everything for September already done — a test opts a step back in.
SEPT_DONE = {"binance": "2026-09", "binance:gentle": "2026-09", "binance:firm": "2026-09", "binance:enforce": "2026-09"}
AUG_DONE = {k: "2026-08" for k in SEPT_DONE}

OK = ("ok", {"success": True, "totals": {"billed": 2, "amount": 150.0}, "created": [], "skipped": [], "failed": []})


def _tick(now, answer=OK, clock=1_000.0):
    with patch.object(mi, "call_api", return_value=answer) as req, \
            patch.object(mi.notify, "notify_monthly_invoices") as invoiced, \
            patch.object(mi.notify, "notify_billing_step") as step, \
            patch.object(mi.notify, "notify_billing_refused") as refused, \
            patch.object(mi.notify, "notify_billing_missed") as missed:
        mi.run_once(BKK, now, monotonic=clock)
    return req, invoiced, step, refused, missed


def _called_steps(req):
    return [(c.args[0].name, c.args[1], c.args[2]) for c in req.call_args_list]


def test_billing_month_is_the_month_before_the_firing():
    assert mi.billing_month(at(1, 16)) == "2026-09"
    assert mi.billing_month(datetime(2027, 1, 4, 16, tzinfo=BKK)) == "2026-12"


def test_next_fire_rolls_into_next_month_after_it_passed():
    assert mi.next_fire(at(1, 15), 1, 16, 0) == at(1, 16)
    assert mi.next_fire(at(1, 16, 1), 1, 16, 0) == at(1, 16, month=11)


def test_nothing_happens_before_16_00_on_the_1st():
    _seed(AUG_DONE)
    req, *_ = _tick(at(1, 15, 59))
    req.assert_not_called()


def test_the_1st_invoices_last_month_and_reports_privately():
    _seed(AUG_DONE)
    req, invoiced, *_ = _tick(at(1, 16, 0))
    assert _called_steps(req) == [("invoice", "binance", "2026-09")]
    invoiced.assert_called_once()
    assert _state()["binance"] == "2026-09"


@pytest.mark.parametrize("day,name", [(2, "gentle"), (3, "firm"), (4, "enforce")])
def test_each_following_day_runs_its_own_step_at_the_same_hour(day, name):
    _seed({**SEPT_DONE, f"binance:{name}": "2026-08"})
    req, *_ = _tick(at(day, 15, 59))
    req.assert_not_called()
    req, _, step, *_ = _tick(at(day, 16, 0))
    assert _called_steps(req) == [(name, "binance", "2026-09")]
    step.assert_called_once()
    assert _state()[f"binance:{name}"] == "2026-09"


def test_reminders_carry_their_stage_to_the_api():
    assert dict(next(s for s in mi.STEPS if s.name == "gentle").extra) == {"stage": "gentle"}
    assert dict(next(s for s in mi.STEPS if s.name == "firm").extra) == {"stage": "firm"}


def test_never_twice_in_one_month():
    _seed(SEPT_DONE)
    req, *_ = _tick(at(4, 20))
    req.assert_not_called()


def test_a_deploy_before_the_time_on_the_1st_still_bills_today():
    req, *_ = _tick(at(1, 12))
    req.assert_not_called()
    assert not mi.STATE_FILE.exists()


def test_first_run_after_the_time_records_without_running():
    req, invoiced, step, *_ = _tick(at(15, 10))
    req.assert_not_called()
    invoiced.assert_not_called()
    step.assert_not_called()
    assert _state() == SEPT_DONE


def test_an_unreachable_api_is_retried_later_not_marked():
    _seed(AUG_DONE)
    req, *_ = _tick(at(1, 16), answer=("retry", None), clock=1_000.0)
    assert _state()["binance"] == "2026-08"

    req, *_ = _tick(at(1, 16, 5), clock=1_000.0 + 60)
    req.assert_not_called()
    req, *_ = _tick(at(1, 16, 15), clock=1_000.0 + mi.RETRY_SECONDS + 1)
    req.assert_called_once()
    assert _state()["binance"] == "2026-09"


def test_a_refusal_is_final_and_alerted():
    _seed(AUG_DONE)
    _, invoiced, _, refused, _ = _tick(at(1, 16), answer=("refused", {"error_code": "MONTH_NOT_ENDED"}))
    refused.assert_called_once()
    invoiced.assert_not_called()
    assert _state()["binance"] == "2026-09"


def test_invoice_catches_up_for_three_days_but_a_reminder_only_for_twelve_hours():
    _seed({**SEPT_DONE, "binance": "2026-08"})
    req, *_ = _tick(at(3, 4))  # invoice ~36h late: still made
    assert ("invoice", "binance", "2026-09") in _called_steps(req)

    _seed({**SEPT_DONE, "binance:gentle": "2026-08"})
    req, _, _, _, missed = _tick(at(3, 9), clock=50_000.0)  # gentle 17h late: dropped
    req.assert_not_called()
    missed.assert_called_once()
    assert _state()["binance:gentle"] == "2026-09"


def test_an_existing_one_key_state_file_keeps_its_meaning():
    """Written by the first release (invoice only): later steps still run on time."""
    _seed({"binance": "2026-09"})
    req, *_ = _tick(at(2, 16))
    assert _called_steps(req) == [("gentle", "binance", "2026-09")]


def test_summaries_never_fall_back_to_the_public_channel(monkeypatch):
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "")
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "-100public")
    with patch.object(notify, "_send") as send:
        notify.notify_monthly_invoices("2026-09", "binance", OK[1])
        notify.notify_billing_step("enforce", "2026-09", "binance", {"totals": {"overdue": 1}, "paused": [{"owner_name": "A"}]})
        notify.notify_billing_missed("gentle", "2026-09", 20)
    send.assert_not_called()


def test_the_invoice_summary_names_who_owes_what(monkeypatch):
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "-100admin")
    body = {
        "totals": {"billed": 1, "amount": 100.0, "zero_fee": 1, "skipped": 1, "failed": 0, "emailed": 1},
        "created": [
            {"owner_name": "Alice", "total_fee": 100.0, "due_date": "2026-10-04"},
            {"owner_name": "Bob", "total_fee": 0.0, "due_date": "2026-10-04"},
        ],
        "skipped": [{"owner_name": "Gary", "reason": "disconnected — bill by hand if owed"}],
        "failed": [],
    }
    with patch.object(notify, "_send") as send:
        notify.notify_monthly_invoices("2026-09", "binance", body)
    text, chat = send.call_args.args
    assert chat == "-100admin"
    assert "September 2026" in text and "Alice — $100.00" in text and "Gary" in text and "emailed 1" in text
    assert "Bob" not in text  # a $0 month is counted, not listed


def test_the_pause_summary_lists_who_was_paused(monkeypatch):
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "-100admin")
    body = {"totals": {"overdue": 1, "disabled": 1, "emailed": 1, "amount": 80.0},
            "paused": [{"owner_name": "Late Larry", "total_fee": 80.0}]}
    with patch.object(notify, "_send") as send:
        notify.notify_billing_step("enforce", "2026-09", "binance", body)
    text = send.call_args.args[0]
    assert "paused" in text.lower() and "Late Larry — $80.00" in text and "accounts paused 1" in text
