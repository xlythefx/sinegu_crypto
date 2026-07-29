"""Tests for assets fetch — verifies broker filter is passed to trading-api."""
from unittest.mock import MagicMock, patch

import src.assets_api as assets_api


def _ok_payload(assets):
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = {"success": True, "assets": assets}
    return resp


def test_fetch_passes_broker_filter():
    with patch("src.assets_api.requests.get") as g:
        g.return_value = _ok_payload([
            {"ticker": "LTCUSDT", "base_size": 1.0, "enabled": True},
        ])
        result = assets_api._fetch_assets_uncached(timeout=5)

    assert result is not None
    args, kwargs = g.call_args
    assert kwargs["params"] == {"broker": "Binance"}, (
        "Assets fetch must pass broker=Binance so Capital.com rows can't sneak in by ticker."
    )


def test_fetch_returns_normalized_rows():
    with patch("src.assets_api.requests.get") as g:
        g.return_value = _ok_payload([
            {"ticker": "BTCUSD", "base_size": "0.001", "enabled": True},
        ])
        rows = assets_api._fetch_assets_uncached(timeout=5)

    assert len(rows) == 1
    row = rows[0]
    assert row["ticker"] == "BTCUSD"
    assert row["binance_symbol"] == "BTCUSDT"  # mapped via TICKER_TO_BINANCE
    assert row["base_size"] == 0.001
    assert row["enabled"] is True


def test_fetch_parses_max_sizing():
    with patch("src.assets_api.requests.get") as g:
        g.return_value = _ok_payload([
            {"ticker": "BTCUSD", "base_size": "0.02", "max_sizing": "0.06", "enabled": True},
        ])
        rows = assets_api._fetch_assets_uncached(timeout=5)

    assert rows[0]["max_sizing"] == 0.06


def test_fetch_max_sizing_absent_or_zero_is_none():
    with patch("src.assets_api.requests.get") as g:
        g.return_value = _ok_payload([
            {"ticker": "BTCUSD", "base_size": "0.02", "enabled": True},               # absent
            {"ticker": "ETHUSD", "base_size": "0.1", "max_sizing": "0", "enabled": True},  # zero
        ])
        rows = assets_api._fetch_assets_uncached(timeout=5)

    assert rows[0]["max_sizing"] is None
    assert rows[1]["max_sizing"] is None


def test_fetch_handles_request_failure():
    import requests
    with patch("src.assets_api.requests.get") as g:
        g.side_effect = requests.RequestException("network down")
        assert assets_api._fetch_assets_uncached(timeout=5) is None
