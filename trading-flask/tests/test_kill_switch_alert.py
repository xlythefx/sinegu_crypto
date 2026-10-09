"""/admin/kill-switch — the API's kill switch turned a coin off; the engine
only relays it to the ADMIN Telegram group (never the public channel)."""

from __future__ import annotations

from unittest.mock import patch

import binance_abcd.notify as notify

SECRET = "test-webhook-secret"


def test_the_alert_goes_to_the_admin_chat_only(client):
    with patch.object(notify, "_send_private") as private, patch.object(notify, "_send_public") as public:
        response = client.post(
            "/admin/kill-switch",
            json={"exchange": "binance", "ticker": "ltcusdt", "losses": 3,
                  "reason": "The master lost 3 trades in a row on LTCUSDT."},
            headers={"X-Admin-Secret": SECRET},
        )

    assert response.status_code == 200
    public.assert_not_called()
    (text,), _ = private.call_args
    assert "Kill switch — LTCUSDT switched off" in text
    assert "Binance" in text
    assert "The master lost 3 trades in a row on LTCUSDT." in text
    assert "Open positions still close" in text


def test_it_needs_the_admin_secret(client):
    with patch.object(notify, "_send_private") as private:
        response = client.post("/admin/kill-switch", json={"ticker": "LTCUSDT"}, headers={"X-Admin-Secret": "nope"})
    assert response.status_code == 403
    private.assert_not_called()


def test_it_needs_a_ticker(client):
    with patch.object(notify, "_send_private") as private:
        response = client.post("/admin/kill-switch", json={"losses": 3}, headers={"X-Admin-Secret": SECRET})
    assert response.status_code == 400
    private.assert_not_called()


def test_the_message_survives_an_unknown_venue_and_no_reason():
    text = notify.render_kill_switch("kraken", "LTCUSDT", 4, "")
    assert "LTCUSDT switched off" in text
    assert "lost 4 trades in a row" in text
