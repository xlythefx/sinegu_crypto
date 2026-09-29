"""POST /admin/refresh-positions — Admin → Trading Positions' "Refresh".

The page reads the DB, and the positions poller rewrites it every 300 s, so a
refresh that only re-read the DB showed nothing new. This route syncs now.
Same contract as /admin/refresh-balances: auth-gated, optional api_keys
narrowing, an empty list refused, and a failed read never synced as flat.
"""

from __future__ import annotations

from unittest.mock import patch

SECRET = "test-webhook-secret"

ACCOUNTS = [
    {"api_key": "key-a", "secret_key": "sec-a", "name": "A"},
    {"api_key": "key-b", "secret_key": "sec-b", "name": "B"},
]


class _FakeBinance:
    seen: list[str] = []
    fail: set[str] = set()

    def __init__(self, api_key, secret_key, base_url=None):
        self.api_key = api_key
        _FakeBinance.seen.append(api_key)

    def get_positions_v3(self):
        return None if self.api_key in _FakeBinance.fail else []


def _run(client, payload=None, fail=()):
    _FakeBinance.seen = []
    _FakeBinance.fail = set(fail)
    import binance_abcd.exchanges as exchanges
    import binance_abcd.fetch_positions as fp

    with patch.object(fp, "fetch_accounts", return_value=list(ACCOUNTS)), \
            patch.object(exchanges, "BinanceAPI", _FakeBinance), \
            patch.object(fp.engine_client, "post_json", return_value={"success": True}) as posted:
        response = client.post(
            "/admin/refresh-positions",
            json=payload if payload is not None else {},
            headers={"X-Admin-Secret": SECRET},
        )
    return response, posted


def test_unauthorized_without_the_secret(client):
    assert client.post("/admin/refresh-positions", json={}).status_code == 403


def test_no_api_keys_syncs_every_account(client):
    response, posted = _run(client)

    assert response.status_code == 200
    assert response.get_json()["scoped"] is False
    assert _FakeBinance.seen == ["key-a", "key-b"]
    assert [a["api_key"] for a in posted.call_args[0][1]["accounts"]] == ["key-a", "key-b"]


def test_one_api_key_reads_only_that_account(client):
    response, posted = _run(client, {"api_keys": ["key-b"]})

    assert response.get_json()["scoped"] is True
    assert _FakeBinance.seen == ["key-b"]
    assert [a["api_key"] for a in posted.call_args[0][1]["accounts"]] == ["key-b"]


def test_an_empty_list_is_refused_not_read_as_everything(client):
    response = client.post("/admin/refresh-positions", json={"api_keys": []}, headers={"X-Admin-Secret": SECRET})
    assert response.status_code == 400


def test_a_failed_read_is_not_synced_as_flat(client):
    """positions/sync is a full replace per api_key: sending [] for a failed
    read would delete that account's live positions."""
    _, posted = _run(client, fail={"key-a"})

    assert [a["api_key"] for a in posted.call_args[0][1]["accounts"]] == ["key-b"]
