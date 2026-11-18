"""The SUB-MASTER signal feed (2026-11-18): /{venue}_submaster_webhook, its own
secret, sub-master-owned accounts only, nothing public, no main-account rule,
but REAL money — so a refused close is still emailed (stuck_exits).

Same mechanics as the test feed (test_test_feed.py): the API decides each
account's feed from its owner's role; the engine only filters on it.
"""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import binance_abcd.exchanges as exchanges
import binance_abcd.hooks as hooks
import binance_abcd.notify as notify
import binance_abcd.routes.webhook as webhook

MAIN_SECRET = "test-webhook-secret"
TEST_SECRET = "test-feed-secret"
SUB_SECRET = "sub-master-feed-secret"

ASSETS = {
    "DOGEUSDT": {"ticker": "DOGEUSDT", "base_size": 100.0, "max_size": 300.0,
                 "max_increments": 3.0, "side": "ALL"},
}


def _account(key: str, name: str, *, feed: str | None = "main", master: bool = False) -> dict:
    account = {
        "api_key": key, "secret_key": f"{key}-secret", "name": name, "uni_id": f"uni-{key}",
        "balance": 900.0, "initial_deposit": 1000.0, "total_deposit": 1000.0,
        "currency_type": "USDT", "demo": False, "enabled": True, "is_master": master,
    }
    if feed is not None:
        account["feed"] = feed
    return account


MAIN = _account("main", "master", master=True)
ALEX = _account("alex", "BOT ALEX G")
TESTER = _account("tess", "Tester Tess", feed="test")
DIMA = _account("dima", "Dima Sub", feed="submaster")


@pytest.fixture()
def sub_feed_on(monkeypatch):
    monkeypatch.setattr(hooks, "SUBMASTER_WEBHOOK_SECRET", SUB_SECRET)


def _entry_ok(api, symbol, side, quantity, price):
    return {"result": {"orderId": 1}, "symbol": symbol, "quantity": quantity, "price": price}


def _run(accounts, *, action="BUY", exit_result=None, **kwargs):
    side = "LONG" if action in ("BUY", "EXIT_LONG") else "SHORT"
    check = {"success": True, "positions": [
        {"api_key": a["api_key"], "position_side": side, "position_amt": 0, "entry_price": 1.0} for a in accounts
    ]}
    mocks = {}
    with (
        patch.object(webhook, "fetch_accounts", return_value=accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: ASSETS.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok) as mocks["entry"],
        patch.object(webhook, "_run_account", side_effect=exit_result) if exit_result else patch.object(webhook, "_bump"),
        patch.object(webhook.engine_client, "get_json", return_value=check),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
        patch.object(webhook, "_post_trade_log") as mocks["trade_log"],
        patch.object(webhook, "_main_account_full", return_value=None) as mocks["main_full"],
        patch.object(notify, "notify_entry") as mocks["public_entry"],
        patch.object(notify, "open_exit_batch", return_value=None) as mocks["exit_batch"],
        patch.object(notify, "notify_max_increments"),
        patch.object(notify, "notify_rejected") as mocks["rejected"],
        patch.object(notify, "notify_test_feed") as mocks["private_note"],
        patch.object(notify, "notify_test_feed_rejected") as mocks["private_rejected"],
        patch.object(webhook.stuck_exits, "report") as mocks["stuck"],
    ):
        summary = webhook._process_trade_job(action, "DOGEUSDT", 2.2, None, "ABCD", **kwargs)
    return summary, mocks


def _names(summary: dict) -> set:
    return {r["account"] for r in summary["details"]}


def _post(client, path, payload):
    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post(path, json=payload)
    return response, submit


# --- The route gate -----------------------------------------------------------

def test_the_sub_master_path_is_closed_while_no_secret_is_set(client, monkeypatch):
    monkeypatch.setattr(hooks, "SUBMASTER_WEBHOOK_SECRET", "")
    for secret in ("", MAIN_SECRET, SUB_SECRET):
        response, submit = _post(client, "/binance_submaster_webhook",
                                 {"secret": secret, "action": "BUY", "symbol": "DOGEUSDT"})
        assert response.status_code == 403, secret
        submit.assert_not_called()


def test_the_sub_master_path_dispatches_on_its_own_feed(client, sub_feed_on):
    response, submit = _post(client, "/binance_submaster_webhook",
                             {"secret": SUB_SECRET, "action": "BUY", "symbol": "DOGEUSDT"})
    assert response.status_code == 200
    assert response.get_json()["feed"] == "submaster"
    assert submit.call_args.kwargs["feed"] == "submaster"


def test_no_feeds_secret_opens_another(client, sub_feed_on, monkeypatch):
    monkeypatch.setattr(hooks, "TEST_WEBHOOK_SECRET", TEST_SECRET)
    for path, secret in (
        ("/binance_submaster_webhook", MAIN_SECRET),
        ("/binance_submaster_webhook", TEST_SECRET),
        ("/binance_abcd_webhook", SUB_SECRET),
        ("/binance_test_webhook", SUB_SECRET),
    ):
        response, submit = _post(client, path, {"secret": secret, "action": "BUY", "symbol": "DOGEUSDT"})
        assert response.status_code == 403, (path, secret)
        submit.assert_not_called()


def test_a_secret_shared_with_another_feed_is_refused(monkeypatch):
    """Read at import: a sub-master secret equal to the main or test one
    leaves the feed OFF (hooks.SUBMASTER_WEBHOOK_SECRET empty)."""
    import importlib

    monkeypatch.setenv("BINANCE_ABCD_SUBMASTER_WEBHOOK_SECRET", MAIN_SECRET)
    monkeypatch.setenv("BINANCE_ABCD_WEBHOOK_SECRET", MAIN_SECRET)
    try:
        reloaded = importlib.reload(hooks)
        assert reloaded.SUBMASTER_WEBHOOK_SECRET == ""
        assert reloaded.SUBMASTER_WEBHOOK_SECRET_IS_SHARED is True
        assert reloaded.submaster_feed_enabled() is False
    finally:
        monkeypatch.delenv("BINANCE_ABCD_SUBMASTER_WEBHOOK_SECRET")
        importlib.reload(hooks)


# --- Who trades it ------------------------------------------------------------

def test_a_main_signal_never_reaches_the_sub_master():
    summary, _ = _run([MAIN, ALEX, TESTER, DIMA])
    assert _names(summary) == {"master", "BOT ALEX G"}


def test_a_sub_master_signal_trades_sub_master_accounts_only():
    summary, _ = _run([MAIN, ALEX, TESTER, DIMA], feed="submaster")
    assert _names(summary) == {"Dima Sub"}
    assert summary["feed"] == "submaster"


def test_an_unknown_feed_value_is_main_never_private():
    weird = _account("weird", "Weird", feed="vip")
    assert hooks.account_feed(weird) == "main"
    summary, _ = _run([weird, DIMA], feed="submaster")
    assert _names(summary) == {"Dima Sub"}


def test_a_sub_master_entry_is_private_and_skips_the_main_account_rule():
    summary, mocks = _run([DIMA], feed="submaster")
    mocks["public_entry"].assert_not_called()
    mocks["main_full"].assert_not_called()
    mocks["private_note"].assert_called_once()
    assert mocks["private_note"].call_args.kwargs["feed"] == "submaster"
    rows = [c.args[0] for c in mocks["trade_log"].call_args_list]
    assert rows and all(r["feed"] == "submaster" for r in rows)


def test_a_sub_master_exit_opens_no_public_batch():
    _, mocks = _run([DIMA], action="EXIT_LONG", feed="submaster")
    mocks["exit_batch"].assert_not_called()


def test_a_refused_sub_master_close_is_still_emailed():
    """Real money: a close refused outright reaches stuck_exits like the main
    feed's — the test feed's never does."""
    failed = lambda account, *a, **k: {  # noqa: E731
        "account": account["name"], "uni_id": account["uni_id"], "exchange": "binance",
        "status": "failed", "error": "-2022 ReduceOnly Order is rejected.", "retryable": False,
    }
    _, mocks = _run([DIMA], action="EXIT_LONG", feed="submaster", exit_result=failed)
    mocks["stuck"].assert_called_once()
    assert mocks["stuck"].call_args.args[2][0]["uni_id"] == "uni-dima"

    _, mocks = _run([TESTER], action="EXIT_LONG", feed="test", exit_result=failed)
    mocks["stuck"].assert_not_called()


def test_a_manual_close_of_the_sub_master_alone_counts_as_its_feed():
    assert webhook._feed_of_accounts([DIMA]) == "submaster"
    assert webhook._feed_of_accounts([TESTER]) == "test"
    assert webhook._feed_of_accounts([DIMA, TESTER]) == "main"
    assert webhook._feed_of_accounts([DIMA, ALEX]) == "main"


# --- Messages and health ------------------------------------------------------

def test_sub_master_messages_carry_their_own_banner_and_go_to_the_admin_chat(monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "_send_private", lambda text: sent.append(text))
    notify.notify_test_feed("BUY", "DOGEUSDT", [("Dima Sub", {"status": "filled", "quantity": 100})],
                            filled=1, failed=0, skipped=0, feed="submaster")
    assert "SUB-MASTER FEED" in sent[0] and "TEST FEED" not in sent[0]
    notify.notify_test_feed_rejected("BUY", "DOGEUSDT", "asset_disabled", feed="submaster")
    assert "SUB-MASTER FEED" in sent[1]


def test_a_risk_alert_from_the_api_goes_to_the_admin_chat_only(client, monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "_send_private", lambda text: sent.append(text))
    monkeypatch.setattr(notify, "_send_public", lambda *a, **k: pytest.fail("never public"))
    headers = {"X-Admin-Secret": hooks.ADMIN_SECRET}
    response = client.post("/admin/risk-alert", headers=headers, json={
        "label": "Trade reached the wrong accounts", "title": "LONG DOGEUSDT reached 1 account outside the sub-master feed",
        "lines": ["• Carla <b>Customer</b> — role user"],
    })
    assert response.status_code == 200
    assert "HIGH RISK" in sent[0] and "&lt;b&gt;Customer" in sent[0]  # escaped
    assert client.post("/admin/risk-alert", json={"title": "x"}).status_code == 403
    assert client.post("/admin/risk-alert", headers=headers, json={}).status_code == 400


def test_health_lists_the_sub_master_feed(client, sub_feed_on):
    body = client.get("/health").get_json()
    assert body["submaster_feed"] == {"enabled": True}
    paths = {(w["feed"], w["path"]) for w in body["webhooks"]}
    assert ("submaster", "/binance_submaster_webhook") in paths


def test_nginx_proxies_the_sub_master_paths():
    script = Path(__file__).resolve().parents[2] / ".claude" / "deploy_sinegualcrypto.py"
    if not script.exists():
        pytest.skip("deploy script not present in this checkout")
    match = re.search(r"^ENGINE_WEBHOOK_PATHS = \((.*?)\)", script.read_text(encoding="utf-8"), re.M | re.S)
    proxied = set(re.findall(r'"(/[a-z_]+)"', match.group(1)))
    answered = {p for paths in hooks.FEED_PATHS.values() for p in paths.values()}
    assert answered <= proxied
