"""engine_client — header attach, URL join, None-on-failure."""

from __future__ import annotations

import logging
from unittest.mock import MagicMock, patch

import binance_abcd.engine_client as engine_client


def _response(ok=True, status=200, payload=None, raise_json=False):
    response = MagicMock()
    response.ok = ok
    response.status_code = status
    response.text = "body"
    if raise_json:
        response.json.side_effect = ValueError("not json")
    else:
        response.json.return_value = payload if payload is not None else {"success": True, "x": 1}
    return response


def test_get_attaches_engine_secret_header_and_url():
    session = MagicMock()
    session.request.return_value = _response()
    with patch.object(engine_client, "get_session", return_value=session):
        data = engine_client.get_json("accounts", params={"a": 1})

    assert data == {"success": True, "x": 1}
    _, kwargs = session.request.call_args
    args, _ = session.request.call_args
    assert args == ("GET", "http://engine.test/api/engine/binance/accounts")
    assert kwargs["headers"]["X-Engine-Secret"] == "test-engine-secret"
    assert kwargs["params"] == {"a": 1}


def test_non_2xx_returns_none():
    session = MagicMock()
    session.request.return_value = _response(ok=False, status=503)
    with patch.object(engine_client, "get_session", return_value=session):
        assert engine_client.get_json("accounts") is None


def test_network_error_returns_none():
    session = MagicMock()
    session.request.side_effect = ConnectionError("refused")
    with patch.object(engine_client, "get_session", return_value=session):
        assert engine_client.post_json("balances", {"rows": []}) is None


def test_bad_json_returns_none():
    session = MagicMock()
    session.request.return_value = _response(raise_json=True)
    with patch.object(engine_client, "get_session", return_value=session):
        assert engine_client.get_json("assets") is None


def test_unsuccessful_payload_returns_none():
    session = MagicMock()
    session.request.return_value = _response(payload={"success": False, "error_code": "X"})
    with patch.object(engine_client, "get_session", return_value=session):
        assert engine_client.get_json("accounts") is None


# --- What a failure may leave in the log ----------------------------------------

def test_a_failed_body_never_reaches_the_log(caplog):
    """The /accounts answer carries every api_key and secret_key, and a 500
    that echoes a request can too. Only status, size and the error/message
    strings are logged — never a slice of the body."""
    leak = {"secret_key": "SHOULD-NOT-APPEAR", "message": "boom", "error_code": "E42"}
    response = _response(ok=False, status=500, payload=leak)
    response.text = '{"secret_key":"SHOULD-NOT-APPEAR","message":"boom"}'
    response.content = response.text.encode()
    session = MagicMock()
    session.request.return_value = response
    with caplog.at_level(logging.WARNING, logger="binance_abcd.engine_client"), \
            patch.object(engine_client, "get_session", return_value=session):
        assert engine_client.get_json("accounts") is None

    assert "SHOULD-NOT-APPEAR" not in caplog.text
    assert "HTTP 500" in caplog.text and "message=boom" in caplog.text and "error_code=E42" in caplog.text


def test_a_non_json_failure_logs_status_and_size_only(caplog):
    response = _response(ok=False, status=502, raise_json=True)
    response.text = "<html>SHOULD-NOT-APPEAR</html>"
    response.content = response.text.encode()
    session = MagicMock()
    session.request.return_value = response
    with caplog.at_level(logging.WARNING, logger="binance_abcd.engine_client"), \
            patch.object(engine_client, "get_session", return_value=session):
        assert engine_client.get_json("accounts") is None

    assert "SHOULD-NOT-APPEAR" not in caplog.text
    assert f"HTTP 502, {len(response.content)} bytes" in caplog.text


def test_an_unsuccessful_payload_never_reaches_the_log(caplog):
    payload = {"success": False, "error": "nope",
               "accounts": [{"api_key": "k", "secret_key": "SHOULD-NOT-APPEAR"}]}
    session = MagicMock()
    session.request.return_value = _response(payload=payload)
    with caplog.at_level(logging.WARNING, logger="binance_abcd.engine_client"), \
            patch.object(engine_client, "get_session", return_value=session):
        assert engine_client.get_json("accounts") is None

    assert "SHOULD-NOT-APPEAR" not in caplog.text
    assert "error=nope" in caplog.text


def test_error_fields_renders_only_the_named_scalars():
    body = {"error": "x", "message": "y", "secret_key": "z", "errors": {"api_key": ["leak"]}, "error_code": 7}
    assert engine_client.error_fields(body) == "error=x error_code=7 message=y"
    assert engine_client.error_fields({"error": True, "message": ["list"]}) == ""
    assert engine_client.error_fields("not a dict") == ""
    assert engine_client.error_fields(None) == ""
    # A long message is bounded, so a body stuffed into `message` cannot flood the journal.
    assert len(engine_client.error_fields({"message": "m" * 5000})) < 300
