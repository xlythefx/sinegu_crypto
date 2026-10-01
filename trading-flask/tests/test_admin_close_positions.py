"""POST /admin/close-positions — Admin Dashboard → Open positions' "Close".

Closes exactly the positions named, through the normal exit path, silently
(no public announcement), and waits for the result. The guards matter more
than the happy path: a job whose venue is not live falls back to EVERY live
venue with no user filter, so an unknown exchange must be refused up front.
"""

from __future__ import annotations

from unittest.mock import patch

SECRET = "test-webhook-secret"
HEADERS = {"X-Admin-Secret": SECRET}


def _summary(filled=1):
    return {"filled": filled, "failed": 0, "skipped": 0, "category": "signal",
            "details": [{"account": "A", "status": "filled", "closed_quantity": 1.0}]}


def _post(client, positions):
    import binance_abcd.routes.webhook as webhook

    with patch.object(webhook, "_process_trade_job", return_value=_summary()) as job:
        response = client.post("/admin/close-positions", json={"positions": positions}, headers=HEADERS)
    return response, job


def test_unauthorized_without_the_secret(client):
    assert client.post("/admin/close-positions", json={"positions": []}).status_code == 403


def test_an_empty_list_is_refused(client):
    response, job = _post(client, [])
    assert response.status_code == 400
    job.assert_not_called()


def test_a_venue_the_engine_does_not_trade_is_refused_not_widened(client):
    response, job = _post(client, [{"exchange": "mexc", "uni_id": "u1", "symbol": "LTCUSDT", "side": "LONG"}])
    assert response.status_code == 400
    assert response.get_json()["error"] == "EXCHANGE_NOT_ENABLED"
    job.assert_not_called()


def test_a_bad_side_is_refused(client):
    response, job = _post(client, [{"exchange": "binance", "uni_id": "u1", "symbol": "LTCUSDT", "side": "BOTH"}])
    assert response.status_code == 400
    job.assert_not_called()


def test_groups_by_symbol_and_side_targets_only_those_users_and_never_announces(client):
    response, job = _post(client, [
        {"exchange": "binance", "uni_id": "u1", "symbol": "ltcusdt", "side": "long"},
        {"exchange": "binance", "uni_id": "u2", "symbol": "LTCUSDT", "side": "LONG"},
        {"exchange": "binance", "uni_id": "u1", "symbol": "BTCUSDT", "side": "SHORT"},
    ])

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["filled"] == 2
    calls = {(c.args[0], c.args[1]): c.kwargs for c in job.call_args_list}
    assert set(calls) == {("EXIT_LONG", "LTCUSDT"), ("EXIT_SHORT", "BTCUSDT")}
    assert calls[("EXIT_LONG", "LTCUSDT")]["targets"] == {"binance": {"u1", "u2"}}
    assert calls[("EXIT_SHORT", "BTCUSDT")]["targets"] == {"binance": {"u1"}}
    assert all(kw["announce"] is False for kw in calls.values())


def test_a_silent_run_never_hands_its_retry_a_public_announcement(monkeypatch):
    """The retry of a run that owed no message must not inherit one."""
    import binance_abcd.routes.webhook as webhook

    account = {"api_key": "k", "secret_key": "s", "name": "A", "uni_id": "u1"}
    monkeypatch.setattr(webhook, "_plan_exchange",
                        lambda *a, **k: {"asset": None, "accounts": [account], "open_amounts": None})
    monkeypatch.setattr(webhook, "_run_account", lambda *a, **k: {
        "account": "A", "uni_id": "u1", "exchange": "binance",
        "status": "failed", "error": "timeout", "retryable": True})
    monkeypatch.setattr(webhook, "_finish_job", lambda *a, **k: None)

    import binance_abcd.retry_queue as retry_queue

    with patch.object(retry_queue, "enqueue_retry") as enqueue:
        webhook._process_trade_job("EXIT_LONG", "LTCUSDT", None, None, None,
                                   targets={"binance": {"u1"}}, announce=False)

    assert enqueue.call_args.kwargs["announce"] is False
