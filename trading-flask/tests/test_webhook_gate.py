"""The webhook's request gate: secret, validation, fast-ACK shape.
Dispatch is mocked so no job actually runs."""

from __future__ import annotations

from unittest.mock import patch

import binance_abcd.routes.webhook as webhook

SECRET = "test-webhook-secret"


def _post(client, payload):
    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post("/binance_abcd_webhook", json=payload)
    return response, submit


def test_missing_secret_is_403(client):
    response, submit = _post(client, {"action": "BUY", "symbol": "BTCUSDT"})
    assert response.status_code == 403
    submit.assert_not_called()


def test_wrong_secret_is_403(client):
    response, submit = _post(client, {"secret": "nope", "action": "BUY", "symbol": "BTCUSDT"})
    assert response.status_code == 403
    submit.assert_not_called()


def test_invalid_action_is_400(client):
    response, submit = _post(client, {"secret": SECRET, "action": "HOLD", "symbol": "BTCUSDT"})
    assert response.status_code == 400
    submit.assert_not_called()


def test_missing_ticker_is_400(client):
    response, submit = _post(client, {"secret": SECRET, "action": "BUY"})
    assert response.status_code == 400
    submit.assert_not_called()


def test_valid_signal_fast_acks_and_dispatches(client):
    response, submit = _post(client, {
        "secret": SECRET,
        "action": "BUY",
        "symbol": "BTCUSDT",
        "price": "60000.5",
        "strategy": "VWMA-Reversion",
        "leverage": "25",
    })
    assert response.status_code == 200
    body = response.get_json()
    assert body["accepted"] is True and body["queued"] is True
    assert body["action"] == "BUY" and body["ticker"] == "BTCUSDT"
    assert body["price"] == 60000.5
    assert body["leverage"] == 25
    submit.assert_called_once()
    # args: (fn, action, ticker, price, leverage, strategy, target_uni_ids)
    args = submit.call_args.args
    assert args[0] is webhook._process_trade_job
    assert args[1:] == ("BUY", "BTCUSDT", 60000.5, 25, "VWMA-Reversion", None)


def test_binance_prefix_is_stripped(client):
    response, submit = _post(client, {"secret": SECRET, "action": "EXIT_LONG", "ticker": "BINANCE:ethusdt"})
    assert response.status_code == 200
    assert response.get_json()["ticker"] == "ETHUSDT"
    assert submit.call_args.args[2] == "ETHUSDT"


def test_leverage_is_clamped_1_to_125(client):
    _, submit = _post(client, {"secret": SECRET, "action": "BUY", "symbol": "BTCUSDT", "leverage": "999"})
    assert submit.call_args.args[4] == 125
    _, submit = _post(client, {"secret": SECRET, "action": "BUY", "symbol": "BTCUSDT", "leverage": "0"})
    assert submit.call_args.args[4] == 1
    _, submit = _post(client, {"secret": SECRET, "action": "BUY", "symbol": "BTCUSDT", "leverage": "junk"})
    assert submit.call_args.args[4] is None


def test_target_uni_ids_accepts_csv_and_list(client):
    _, submit = _post(client, {
        "secret": SECRET, "action": "BUY", "symbol": "BTCUSDT", "target_uni_ids": "a, b,,c",
    })
    assert submit.call_args.args[6] == {"a", "b", "c"}

    _, submit = _post(client, {
        "secret": SECRET, "action": "BUY", "symbol": "BTCUSDT", "target_uni_ids": ["x", "y"],
    })
    assert submit.call_args.args[6] == {"x", "y"}


def test_secret_accepted_from_query_string(client):
    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post(
            f"/binance_abcd_webhook?secret={SECRET}",
            json={"action": "SELL", "symbol": "BTCUSDT"},
        )
    assert response.status_code == 200
    submit.assert_called_once()
