"""engine_client — header attach, URL join, None-on-failure."""

from __future__ import annotations

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
