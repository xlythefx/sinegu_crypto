"""Delivery timing (2026-10-25): the Signal Log's proof that a signal
TradingView marked "failed — timed out" still arrived and traded.

On 24 Oct 2026 the 14:15 UTC LTC entry fired at :01, reached the engine at
:09 — past TradingView's ~3 s timeout — and filled five accounts anyway. The
engine now records when the alert fired (the payload's `sent_at`, i.e.
TradingView's `{{timenow}}`), when it arrived and how fast we answered, and
stamps that on every trade-logs row the job writes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

import pytest

import binance_abcd.routes.webhook as webhook

SECRET = "test-webhook-secret"


def _post(client, payload):
    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post("/binance_abcd_webhook", json=payload)
    return response, submit


def _signal(**extra):
    return {"secret": SECRET, "action": "BUY", "symbol": "LTCUSDT", **extra}


@pytest.mark.parametrize("raw, expected", [
    ("2026-10-24T14:15:01Z", datetime(2026, 10, 24, 14, 15, 1, tzinfo=timezone.utc)),
    ("2026-10-24T22:15:01+08:00", datetime(2026, 10, 24, 14, 15, 1, tzinfo=timezone.utc)),
    ("2026-10-24 14:15:01", datetime(2026, 10, 24, 14, 15, 1, tzinfo=timezone.utc)),
    (1761315301, datetime(2025, 10, 24, 14, 15, 1, tzinfo=timezone.utc)),
    ("1761315301000", datetime(2025, 10, 24, 14, 15, 1, tzinfo=timezone.utc)),
])
def test_sent_at_reads_timenow_and_epoch_values(raw, expected):
    assert webhook._parse_sent_at(raw) == expected


@pytest.mark.parametrize("raw", [None, "", "{{timenow}}", "yesterday", True, 0, -5, float("nan"), [], {}])
def test_an_unreadable_sent_at_is_none_never_an_error(raw):
    assert webhook._parse_sent_at(raw) is None


def test_the_webhook_hands_its_timing_to_the_job(client):
    response, submit = _post(client, _signal(sent_at="2026-10-24T14:15:01Z"))
    assert response.status_code == 200
    delivery = submit.call_args.kwargs["delivery"]
    assert delivery["sent_at"] == "2026-10-24T14:15:01.000Z"
    received = datetime.fromisoformat(delivery["received_at"].replace("Z", "+00:00"))
    assert abs((datetime.now(timezone.utc) - received).total_seconds()) < 5
    assert 0 <= delivery["ack_ms"] < 1000


def test_a_bad_sent_at_never_refuses_the_signal(client):
    """An alert whose author pasted the field without TradingView's
    placeholder, or another provider's odd format: the trade still goes."""
    response, submit = _post(client, _signal(sent_at="not a time"))
    assert response.status_code == 200
    assert submit.call_args.kwargs["delivery"]["sent_at"] is None
    assert submit.call_args.kwargs["delivery"]["received_at"]


def test_an_alert_without_sent_at_still_records_arrival(client):
    response, submit = _post(client, _signal())
    assert response.status_code == 200
    delivery = submit.call_args.kwargs["delivery"]
    assert delivery["sent_at"] is None
    assert delivery["received_at"].endswith("Z")


def test_every_trade_log_row_of_the_job_carries_the_timing():
    delivery = {"sent_at": "2026-10-24T14:15:01.000Z", "received_at": "2026-10-24T14:15:09.120Z", "ack_ms": 2.5}
    with (
        patch.object(webhook, "get_asset", return_value=None),
        patch.object(webhook, "_post_trade_log") as trade_log,
        patch.object(webhook, "_append_trade_log") as local,
        patch.object(webhook.notify, "notify_rejected"),
    ):
        webhook._process_trade_job("BUY", "NOPEUSDT", None, None, None, delivery=delivery)
    row = trade_log.call_args.args[0]
    assert {k: row[k] for k in delivery} == delivery
    assert {k: local.call_args.args[0][k] for k in delivery} == delivery


def test_a_job_without_timing_posts_none():
    """A retry or an internal call has no webhook behind it."""
    with (
        patch.object(webhook, "get_asset", return_value=None),
        patch.object(webhook, "_post_trade_log") as trade_log,
        patch.object(webhook, "_append_trade_log"),
        patch.object(webhook.notify, "notify_rejected"),
    ):
        webhook._process_trade_job("BUY", "NOPEUSDT", None, None, None)
    assert "received_at" not in trade_log.call_args.args[0]
