"""An exit that the exchange never confirmed must recover, and say so honestly.

Prod, 2026-08-28: LTCUSDT EXIT_LONG came back `408 Client Error` on two demo
accounts and Telegram announced "EXIT FAILED — MANUAL ACTION REQUIRED" — while
the retry queue was, unannounced, already fixing it. Both halves of that are
tested here: the recovery (retry the close, but only when the failure says
nothing about the order) and the wording (red is reserved for a failure nobody
is going to fix).
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import requests

import binance_abcd.retry_queue as retry_queue
import binance_abcd.routes.webhook as webhook
import binance_abcd.trading_handler as trading_handler
from binance_abcd import notify
from binance_abcd.binance_adapter import BinanceAdapter
from binance_abcd.binance_api import BinanceAPI, error_summary
import binance_abcd.exchanges as exchanges

# Binance ships -1007 as HTTP 408. The body is the half that matters: the order
# may have executed, which is why the close is re-read before it is re-placed.
_TIMEOUT_BODY = (
    '{"code":-1007,"msg":"Timeout waiting for response from backend server. '
    'Send status unknown; execution status unknown."}'
)
_TIMEOUT_ERROR = {
    "_error": True,
    "message": "408 Client Error: Request Timeout for url: https://demo-fapi.binance.com/fapi/v1/order",
    "response": _TIMEOUT_BODY,
    "http_status": 408,
    "rate_limited": False,
    "transient": True,
}
_PRECISION_ERROR = {
    "_error": True,
    "message": "400 Client Error: Bad Request for url: https://fapi.binance.com/fapi/v1/order",
    "response": '{"code":-1111,"msg":"Precision is over the maximum defined for this asset."}',
    "http_status": 400,
    "rate_limited": False,
    "transient": False,
}

_OPEN_LONG = [{"symbol": "LTCUSDT", "positionAmt": "0.5", "positionSide": "LONG", "entryPrice": "100.0"}]


@pytest.fixture(autouse=True)
def _fast_exit_retry(monkeypatch):
    """No real sleeping — the backoff is held in the fan-out worker."""
    monkeypatch.setattr(trading_handler, "EXIT_RETRY_ATTEMPTS", 2)
    monkeypatch.setattr(trading_handler, "EXIT_RETRY_SECONDS", 0.0)


@pytest.fixture(autouse=True)
def _clean_queue():
    with retry_queue._LOCK:
        retry_queue._QUEUE.clear()
        retry_queue._ACTIVE_KEYS.clear()
    yield
    with retry_queue._LOCK:
        retry_queue._QUEUE.clear()
        retry_queue._ACTIVE_KEYS.clear()


def _api(positions: list, orders: list) -> MagicMock:
    api = MagicMock(name="BinanceAPI")
    api.api_key = "k"
    api.get_positions_v3.side_effect = positions
    api.place_market_order.side_effect = orders
    return api


def _exit(api: MagicMock):
    with patch.object(trading_handler, "ensure_position_mode", return_value=None):
        return trading_handler.handle_exit(BinanceAdapter(api), "LTCUSDT", "LONG", 100.0)


# --- The transport verdict: failed on the way vs refused ----------------------

def test_408_and_5xx_and_timeouts_are_transient():
    api = BinanceAPI("k", "s", base_url="https://demo-fapi.test")

    for status in (408, 500, 502, 503, 504):
        response = MagicMock(status_code=status, text=_TIMEOUT_BODY, headers={})
        response.raise_for_status.side_effect = requests.HTTPError("boom", response=response)
        with patch("binance_abcd.binance_api.get_session") as session:
            session.return_value.post.return_value = response
            assert api._request_post("/fapi/v1/order", {})["transient"] is True, status

    # No response at all (connection reset / read timeout): execution unknown.
    with patch("binance_abcd.binance_api.get_session") as session:
        session.return_value.post.side_effect = requests.Timeout("Read timed out")
        assert api._request_post("/fapi/v1/order", {})["transient"] is True


def test_a_rejected_order_is_not_transient():
    """-1111 will be rejected identically in 60s; repeating it only delays the
    moment a human is told."""
    api = BinanceAPI("k", "s", base_url="https://fapi.test")
    response = MagicMock(status_code=400, text=_PRECISION_ERROR["response"], headers={})
    response.raise_for_status.side_effect = requests.HTTPError("bad", response=response)
    with patch("binance_abcd.binance_api.get_session") as session:
        session.return_value.post.return_value = response
        assert api._request_post("/fapi/v1/order", {})["transient"] is False


def test_error_summary_prefers_binances_own_words():
    """'408 Client Error' does not say 'execution status unknown' — the body
    does, and that is the difference the alert has to carry."""
    assert error_summary(_TIMEOUT_ERROR).startswith("-1007 Timeout waiting for response")
    assert "execution status unknown" in error_summary(_TIMEOUT_ERROR)
    assert error_summary(_PRECISION_ERROR).startswith("-1111 Precision is over")
    # No body to quote -> the transport error stands.
    assert error_summary({"_error": True, "message": "Read timed out"}) == "Read timed out"


# --- handle_exit: re-read, then re-place --------------------------------------

def test_transient_exit_is_reattempted_and_closes():
    api = _api([_OPEN_LONG, _OPEN_LONG], [_TIMEOUT_ERROR, {"orderId": 7}])
    result = _exit(api)
    assert result["result"] == {"orderId": 7}
    assert result["closed_quantity"] == 0.5
    assert api.place_market_order.call_count == 2


def test_a_landed_but_unconfirmed_close_is_not_placed_twice():
    """The whole reason every attempt re-reads positionRisk: the 408'd order
    reached the book, so the second attempt must find the side flat and stop."""
    api = _api([_OPEN_LONG, []], [_TIMEOUT_ERROR])
    result = _exit(api)
    assert result == {"status": "no long position to close"}
    assert api.place_market_order.call_count == 1


def test_a_rejected_exit_is_not_reattempted():
    api = _api([_OPEN_LONG], [_PRECISION_ERROR])
    result = _exit(api)
    assert result["result"] is None
    assert result["transient"] is False
    assert result["error"].startswith("-1111")
    assert api.place_market_order.call_count == 1


def test_an_unreadable_position_is_reread_before_giving_up():
    api = _api([None, _OPEN_LONG], [{"orderId": 9}])
    result = _exit(api)
    assert result["result"] == {"orderId": 9}
    assert api.get_positions_v3.call_count == 2


def test_exhausted_attempts_return_the_transient_failure():
    api = _api([_OPEN_LONG, _OPEN_LONG], [_TIMEOUT_ERROR, _TIMEOUT_ERROR])
    result = _exit(api)
    assert result["result"] is None
    assert result["transient"] is True
    assert api.place_market_order.call_count == 2


# --- The fan-out: which alert, and who retries --------------------------------

def _run_exit_job(fake_accounts, fake_assets, exit_result):
    """One EXIT_LONG fan-out with Binance, the engine API and Telegram mocked;
    returns (summary, notify_account_failures mock)."""
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", side_effect=lambda *a, **kw: MagicMock()),
        patch.object(webhook, "handle_exit", side_effect=lambda api, t, ps, p: dict(exit_result)),
        patch.object(webhook.engine_client, "get_json", return_value={"success": True, "positions": []}),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
        patch.object(webhook.engine_client, "delete_json", return_value={"success": True}),
        patch.object(webhook.notify, "notify_account_failures") as failures,
    ):
        summary = webhook._process_trade_job("EXIT_LONG", "BTCUSDT", 100.0, None, "strat")
    return summary, failures


def _transient_exit_failure() -> dict:
    return {"result": None, "error": "-1007 Timeout waiting for response", "transient": True}


def test_a_transient_exit_failure_queues_a_retry_and_alerts_amber(fake_accounts, fake_assets):
    summary, failures = _run_exit_job(fake_accounts, fake_assets, _transient_exit_failure())

    assert summary["failed"] == 3
    assert all(r["retryable"] for r in summary["details"])
    # Queued before the alert, so the alert can say the engine is handling it.
    assert retry_queue.queue_depth() == 1
    job = retry_queue._QUEUE[0]
    assert job.uni_ids == sorted(a["uni_id"] for a in fake_accounts)
    # Nothing filled -> this run published nothing, so the retry owes the message.
    assert job.announce is True

    retrying = [c for c in failures.call_args_list if c.kwargs.get("retrying")]
    manual = [c for c in failures.call_args_list if not c.kwargs.get("retrying")]
    assert len(retrying[0].args[2]) == 3          # all three accounts, amber
    assert manual[0].args[2] == []                # nothing for a human to do yet


def test_a_rejected_exit_alerts_red_immediately(fake_accounts, fake_assets):
    rejected = {"result": None, "error": "-1111 Precision is over the maximum", "transient": False}
    summary, failures = _run_exit_job(fake_accounts, fake_assets, rejected)

    assert summary["failed"] == 3
    assert not any(r["retryable"] for r in summary["details"])
    assert retry_queue.queue_depth() == 0

    manual = [c for c in failures.call_args_list if not c.kwargs.get("retrying")]
    retrying = [c for c in failures.call_args_list if c.kwargs.get("retrying")]
    assert len(manual[0].args[2]) == 3
    assert retrying[0].args[2] == []


def test_a_retried_exit_still_reaches_the_channel(fake_accounts, fake_assets):
    """The live run published nothing (every account failed), so the retry
    opens the exit batch — otherwise a close that took two goes is announced
    nowhere."""
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts[:1]),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", side_effect=lambda *a, **kw: MagicMock()),
        patch.object(webhook, "handle_exit",
                     side_effect=lambda api, t, ps, p: {"result": {"orderId": 3}, "closed_quantity": 0.5,
                                                        "entry_price": 100.0}),
        patch.object(webhook.engine_client, "get_json", return_value={"success": True, "positions": []}),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
        patch.object(webhook.engine_client, "delete_json", return_value={"success": True}),
        patch.object(webhook.notify, "open_exit_batch", return_value="batch-1") as open_batch,
    ):
        webhook._process_trade_job("EXIT_LONG", "BTCUSDT", 100.0, None, "strat",
                                   target_uni_ids={"uni-live-1"}, is_retry=True, announce=True)
    open_batch.assert_called_once()


def test_a_retry_never_announces_a_signal_the_live_run_already_published(fake_accounts, fake_assets):
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts[:1]),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", side_effect=lambda *a, **kw: MagicMock()),
        patch.object(webhook, "handle_exit",
                     side_effect=lambda api, t, ps, p: {"result": {"orderId": 3}, "closed_quantity": 0.5,
                                                        "entry_price": 100.0}),
        patch.object(webhook.engine_client, "get_json", return_value={"success": True, "positions": []}),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
        patch.object(webhook.engine_client, "delete_json", return_value={"success": True}),
        patch.object(webhook.notify, "open_exit_batch", return_value="batch-1") as open_batch,
    ):
        webhook._process_trade_job("EXIT_LONG", "BTCUSDT", 100.0, None, "strat",
                                   target_uni_ids={"uni-live-1"}, is_retry=True, announce=False)
    open_batch.assert_not_called()


# --- The ending: the queue is the only thing that can declare it manual -------

def test_exhausting_the_retries_raises_the_red_alert():
    retry_queue.enqueue_retry("EXIT_LONG", "LTCUSDT", None, None, None, {"binance": ["u1"]})
    job = retry_queue._QUEUE.pop(0)
    job.attempts = retry_queue.RETRY_MAX_ATTEMPTS - 1

    summary = {"details": [{"uni_id": "u1", "status": "failed", "retryable": True}]}
    with (
        patch("binance_abcd.routes.webhook._process_trade_job", return_value=summary),
        patch.object(notify, "notify_retry_abandoned") as abandoned,
    ):
        retry_queue._run_due_job(job)

    abandoned.assert_called_once()
    assert abandoned.call_args.args[0] == "EXIT_LONG"
    assert abandoned.call_args.args[2] == ["u1"]


def test_a_retry_that_comes_back_rejected_is_reported_not_dropped():
    """It stops being retryable, so it leaves the queue — and used to leave in
    silence, with the position still open."""
    retry_queue.enqueue_retry("EXIT_LONG", "LTCUSDT", None, None, None, {"binance": ["u1"]})
    job = retry_queue._QUEUE.pop(0)

    summary = {"details": [{"uni_id": "u1", "status": "failed", "retryable": False}]}
    with (
        patch("binance_abcd.routes.webhook._process_trade_job", return_value=summary),
        patch.object(notify, "notify_retry_abandoned") as abandoned,
    ):
        retry_queue._run_due_job(job)

    assert retry_queue.queue_depth() == 0
    abandoned.assert_called_once()
    assert abandoned.call_args.args[2] == ["u1"]


def test_announce_is_cleared_once_a_run_fills():
    retry_queue.enqueue_retry("EXIT_LONG", "LTCUSDT", None, None, None, {"binance": ["u1", "u2"]}, announce=True)
    job = retry_queue._QUEUE.pop(0)

    summary = {"details": [
        {"uni_id": "u1", "status": "filled"},
        {"uni_id": "u2", "status": "failed", "retryable": True},
    ]}
    with patch("binance_abcd.routes.webhook._process_trade_job", return_value=summary):
        retry_queue._run_due_job(job)

    assert retry_queue.queue_depth() == 1
    assert retry_queue._QUEUE[0].announce is False
