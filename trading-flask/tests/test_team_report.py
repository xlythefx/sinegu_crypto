"""/admin/team-report — a scheduled report the API built (the weekly Customers
vs master summary); the engine only relays it to the ADMIN Telegram group."""

from __future__ import annotations

from unittest.mock import patch

import binance_abcd.notify as notify

SECRET = "test-webhook-secret"
BODY = {
    "title": "Customers vs master — 16–22 Nov",
    "lines": ["Master +2.31%", "• Sam Carter −4.17 pp · 6 missed"],
    "link": "https://pixel-alpha.com/admin/vs-master",
}


def test_the_report_goes_to_the_admin_chat_only(client):
    with patch.object(notify, "_send_private") as private, patch.object(notify, "_send_public") as public:
        response = client.post("/admin/team-report", json=BODY, headers={"X-Admin-Secret": SECRET})

    assert response.status_code == 200
    public.assert_not_called()
    (text,), _ = private.call_args
    assert text.startswith("📊 <b>Customers vs master — 16–22 Nov</b>")
    assert "Sam Carter −4.17 pp · 6 missed" in text
    assert 'href="https://pixel-alpha.com/admin/vs-master"' in text
    assert "HIGH RISK" not in text


def test_it_needs_the_secret_and_a_title(client):
    with patch.object(notify, "_send_private") as private:
        assert client.post("/admin/team-report", json=BODY, headers={"X-Admin-Secret": "nope"}).status_code == 403
        assert client.post("/admin/team-report", json={"lines": []}, headers={"X-Admin-Secret": SECRET}).status_code == 400
    private.assert_not_called()


def test_only_an_https_link_is_rendered_and_text_is_escaped():
    text = notify.render_team_report("<b>x</b>", ["a < b"], "javascript:alert(1)")
    assert "&lt;b&gt;x&lt;/b&gt;" in text
    assert "a &lt; b" in text
    assert "href" not in text
