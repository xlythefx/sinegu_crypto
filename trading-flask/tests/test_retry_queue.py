"""Retry queue — dedupe, uni_id targeting, max-attempt abandonment."""

from __future__ import annotations

from unittest.mock import patch

import pytest

import binance_abcd.retry_queue as retry_queue


@pytest.fixture(autouse=True)
def clean_queue():
    with retry_queue._LOCK:
        retry_queue._QUEUE.clear()
        retry_queue._ACTIVE_KEYS.clear()
    yield
    with retry_queue._LOCK:
        retry_queue._QUEUE.clear()
        retry_queue._ACTIVE_KEYS.clear()


def test_enqueue_and_dedupe():
    assert retry_queue.enqueue_retry("BUY", "BTCUSDT", 100.0, None, None, {"binance": ["u1", "u2"]}) is True
    # Same key (order-insensitive, deduped ids) is rejected while active.
    assert retry_queue.enqueue_retry("BUY", "BTCUSDT", 100.0, None, None, {"binance": ["u2", "u1", "u1"]}) is False
    # Different ticker is its own key.
    assert retry_queue.enqueue_retry("BUY", "ETHUSDT", 100.0, None, None, {"binance": ["u1"]}) is True
    assert retry_queue.queue_depth() == 2


def test_empty_ids_are_rejected():
    assert retry_queue.enqueue_retry("BUY", "BTCUSDT", None, None, None, {"binance": []}) is False


def test_due_job_redispatches_only_failing_ids():
    retry_queue.enqueue_retry("BUY", "BTCUSDT", 100.0, 10, "strat", {"binance": ["u1", "u2"]})
    job = retry_queue._QUEUE.pop(0)  # the timekeeper pops due jobs before running

    summary = {"details": [
        {"uni_id": "u1", "status": "filled"},
        {"uni_id": "u2", "status": "failed", "retryable": True},
    ]}
    with patch("binance_abcd.routes.webhook._process_trade_job", return_value=summary) as process:
        retry_queue._run_due_job(job)

    process.assert_called_once_with(
        "BUY", "BTCUSDT", 100.0, 10, "strat", targets={"binance": {"u1", "u2"}},
        is_retry=True, announce=False,
    )
    # u2 still failing -> requeued with only u2.
    assert retry_queue.queue_depth() == 1
    assert retry_queue._QUEUE[0].targets == {"binance": ["u2"]}
    assert retry_queue._QUEUE[0].attempts == 1


def test_success_clears_active_key():
    retry_queue.enqueue_retry("BUY", "BTCUSDT", None, None, None, {"binance": ["u1"]})
    job = retry_queue._QUEUE.pop(0)

    summary = {"details": [{"uni_id": "u1", "status": "filled"}]}
    with patch("binance_abcd.routes.webhook._process_trade_job", return_value=summary):
        retry_queue._run_due_job(job)

    assert retry_queue.queue_depth() == 0
    # Key released -> the same retry may be enqueued again.
    assert retry_queue.enqueue_retry("BUY", "BTCUSDT", None, None, None, {"binance": ["u1"]}) is True


def test_max_attempts_abandons_job():
    retry_queue.enqueue_retry("BUY", "BTCUSDT", None, None, None, {"binance": ["u1"]})
    job = retry_queue._QUEUE.pop(0)
    job.attempts = retry_queue.RETRY_MAX_ATTEMPTS - 1

    summary = {"details": [{"uni_id": "u1", "status": "failed", "retryable": True}]}
    with patch("binance_abcd.routes.webhook._process_trade_job", return_value=summary):
        retry_queue._run_due_job(job)

    assert retry_queue.queue_depth() == 0
    # Abandoned -> key released.
    assert retry_queue.enqueue_retry("BUY", "BTCUSDT", None, None, None, {"binance": ["u1"]}) is True
