"""/admin/* auth: the X-Admin-Secret HEADER against hooks.ADMIN_SECRET.

The admin secret is the engine's OWN token. The TradingView webhook secret
also sits at TradingView, in every developer's .env and in the API's .env —
so once BINANCE_ABCD_ADMIN_SECRET is set, the token that fires a signal must
no longer be the token that closes every position. And it travels in a
header only: a ``?secret=`` query string lands in the access logs.
"""

from __future__ import annotations

import binance_abcd.hooks as hooks

WEBHOOK_SECRET = "test-webhook-secret"
ADMIN_SECRET = "test-admin-secret"


def test_without_its_own_secret_the_admin_surface_falls_back_to_the_webhook_secret(client):
    """A box deployed before the key existed keeps working (main() warns once)."""
    assert hooks.ADMIN_SECRET == WEBHOOK_SECRET and hooks.ADMIN_SECRET_IS_FALLBACK
    response = client.post("/admin/refresh-accounts", headers={"X-Admin-Secret": WEBHOOK_SECRET})
    assert response.status_code == 200


def test_the_admin_secret_is_accepted_in_the_header(client, monkeypatch):
    monkeypatch.setattr(hooks, "ADMIN_SECRET", ADMIN_SECRET)
    assert client.post("/admin/refresh-accounts", headers={"X-Admin-Secret": ADMIN_SECRET}).status_code == 200
    assert client.get("/admin/stats", headers={"X-Admin-Secret": ADMIN_SECRET}).status_code == 200


def test_the_webhook_secret_is_refused_once_the_admin_secret_differs(client, monkeypatch):
    monkeypatch.setattr(hooks, "ADMIN_SECRET", ADMIN_SECRET)
    assert hooks.WEBHOOK_SECRET == WEBHOOK_SECRET
    for path in ("/admin/refresh-accounts", "/admin/refresh-assets", "/admin/close-positions",
                 "/admin/ledger", "/admin/reports/preview"):
        response = client.post(path, json={}, headers={"X-Admin-Secret": WEBHOOK_SECRET})
        assert response.status_code == 403, path
    assert client.get("/admin/stats", headers={"X-Admin-Secret": WEBHOOK_SECRET}).status_code == 403


def test_the_secret_in_the_query_string_is_refused_even_when_right(client, monkeypatch):
    monkeypatch.setattr(hooks, "ADMIN_SECRET", ADMIN_SECRET)
    assert client.post(f"/admin/refresh-accounts?secret={ADMIN_SECRET}").status_code == 403
    # ...and on a fallback box the webhook secret in the query string is no better.
    monkeypatch.setattr(hooks, "ADMIN_SECRET", WEBHOOK_SECRET)
    assert client.post(f"/admin/refresh-accounts?secret={WEBHOOK_SECRET}").status_code == 403
    assert client.get(f"/admin/stats?secret={WEBHOOK_SECRET}").status_code == 403


def test_a_missing_or_wrong_header_is_refused(client, monkeypatch):
    monkeypatch.setattr(hooks, "ADMIN_SECRET", ADMIN_SECRET)
    assert client.post("/admin/refresh-accounts").status_code == 403
    assert client.post("/admin/refresh-accounts", headers={"X-Admin-Secret": "nope"}).status_code == 403


def test_an_empty_admin_secret_locks_the_surface(client, monkeypatch):
    """bool(secret) guards compare_digest: with nothing configured nothing
    matches, rather than an empty header matching an empty secret."""
    monkeypatch.setattr(hooks, "ADMIN_SECRET", "")
    assert client.post("/admin/refresh-accounts", headers={"X-Admin-Secret": ""}).status_code == 403
