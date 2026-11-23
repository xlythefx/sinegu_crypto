"""/admin/payment-received — the API settled an invoice; the engine only relays
it to the ADMIN Telegram group (never the public channel)."""

from __future__ import annotations

from unittest.mock import patch

import binance_abcd.notify as notify

SECRET = "test-webhook-secret"

PAYMENT = {
    "invoice_id": 15,
    "name": "Sam Carter",
    "amount": 24.04,
    "period": "October 2026",
    "method": "Card (Stripe)",
    "exchange": "binance",
    "was_paused": False,
    "test": False,
}


def test_the_payment_goes_to_the_admin_chat_only(client):
    with patch.object(notify, "_send_private") as private, patch.object(notify, "_send_public") as public:
        response = client.post("/admin/payment-received", json=PAYMENT, headers={"X-Admin-Secret": SECRET})

    assert response.status_code == 200
    public.assert_not_called()
    (text,), _ = private.call_args
    assert "Invoice paid — Sam Carter" in text
    assert "$24.04 for October 2026 · Card (Stripe)" in text
    assert "Invoice #15 · Binance" in text
    assert "switched back on" not in text


def test_it_needs_the_admin_secret(client):
    with patch.object(notify, "_send_private") as private:
        response = client.post("/admin/payment-received", json=PAYMENT, headers={"X-Admin-Secret": "nope"})
    assert response.status_code == 403
    private.assert_not_called()


def test_it_needs_an_invoice_id(client):
    with patch.object(notify, "_send_private") as private:
        response = client.post("/admin/payment-received", json={"name": "x"}, headers={"X-Admin-Secret": SECRET})
    assert response.status_code == 400
    private.assert_not_called()


def test_a_paused_account_is_said_to_be_back_on():
    text = notify.render_payment_received({**PAYMENT, "was_paused": True})
    assert "Trading had been paused for this invoice and is switched back on." in text


def test_a_test_payment_never_reads_as_revenue():
    text = notify.render_payment_received({**PAYMENT, "test": True, "method": "Card (Stripe test mode)"})
    assert "Test payment — Sam Carter" in text
    assert "not real money" in text
    assert "Invoice paid" not in text


def test_names_are_escaped_and_bad_amounts_survive():
    text = notify.render_payment_received({"invoice_id": 3, "name": "<b>Eve</b>", "amount": "n/a", "exchange": "kraken"})
    assert "&lt;b&gt;Eve&lt;/b&gt;" in text
    assert "an unknown amount" in text
    assert "kraken" in text
