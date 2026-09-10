"""POST /admin/refresh-balances — the auth gate and the api_keys narrowing.

The narrowing is the point: the trader-facing "Refresh balance" button routes
here with exactly one key, so one person pressing it must cost ONE Binance
call, not one per account on the platform.
"""

from __future__ import annotations

from unittest.mock import patch

SECRET = "test-webhook-secret"

ACCOUNTS = [
    {"api_key": "key-a", "secret_key": "sec-a", "name": "A"},
    {"api_key": "key-b", "secret_key": "sec-b", "name": "B"},
    {"api_key": "key-c", "secret_key": "sec-c", "name": "C"},
]


class _FakeBinance:
    """Records which api_key it was constructed with."""

    seen: list[str] = []

    def __init__(self, api_key, secret_key, base_url=None):
        _FakeBinance.seen.append(api_key)

    def get_account_v3(self):
        return {"totalWalletBalance": "1234.5", "totalUnrealizedProfit": "6.5"}


def _run(client, payload=None):
    _FakeBinance.seen = []
    import binance_abcd.fetch_balances as fb

    with patch.object(fb, "fetch_accounts", return_value=list(ACCOUNTS)), \
            patch.object(fb, "BinanceAPI", _FakeBinance), \
            patch.object(fb.engine_client, "post_json", return_value={"success": True}) as posted:
        response = client.post(
            "/admin/refresh-balances",
            json=payload if payload is not None else {},
            headers={"X-Admin-Secret": SECRET},
        )
    return response, posted


def test_unauthorized_without_the_secret(client):
    response = client.post("/admin/refresh-balances", json={})
    assert response.status_code == 403


def test_no_api_keys_syncs_every_account(client):
    response, posted = _run(client)

    assert response.status_code == 200
    assert response.get_json()["scoped"] is False
    assert _FakeBinance.seen == ["key-a", "key-b", "key-c"]
    assert len(posted.call_args[0][1]["rows"]) == 3


def test_one_api_key_reads_only_that_account(client):
    response, posted = _run(client, {"api_keys": ["key-b"]})

    assert response.status_code == 200
    assert response.get_json()["scoped"] is True
    assert _FakeBinance.seen == ["key-b"]

    rows = posted.call_args[0][1]["rows"]
    assert len(rows) == 1
    assert rows[0]["api_key"] == "key-b"
    assert rows[0]["balance"] == 1234.5


def test_an_unknown_api_key_reads_nothing(client):
    """A key that is not tradeable (disabled, suspended owner) must not be
    fetched just because someone asked for it — the accounts endpoint is still
    the authority on who may be touched."""
    response, posted = _run(client, {"api_keys": ["key-does-not-exist"]})

    assert response.status_code == 200
    assert _FakeBinance.seen == []
    posted.assert_not_called()


def test_an_empty_api_keys_list_is_rejected(client):
    """Empty must not silently mean "everything" — that would turn one
    trader's button press into a full platform sweep."""
    response = client.post(
        "/admin/refresh-balances",
        json={"api_keys": []},
        headers={"X-Admin-Secret": SECRET},
    )
    assert response.status_code == 400
