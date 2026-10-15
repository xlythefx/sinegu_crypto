"""The TEST signal feed (2026-10-15): /{venue}_test_webhook, its own secret,
tester-owned accounts only, nothing public, no main-account rule.

The API decides each account's feed from its owner's role (`feed` on
GET /engine/{x}/accounts); the engine only filters on it.
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
TESTER_DEMO = dict(_account("demo", "Tester Demo", feed="test"), demo=True)


@pytest.fixture()
def test_feed_on(monkeypatch):
    monkeypatch.setattr(hooks, "TEST_WEBHOOK_SECRET", TEST_SECRET)


def _entry_ok(api, symbol, side, quantity, price):
    return {"result": {"orderId": 1}, "symbol": symbol, "quantity": quantity, "price": price}


def _run(accounts, open_sizes=None, *, action="BUY", **kwargs):
    """One job against these accounts. Returns (summary, mocks)."""
    side = "LONG" if action in ("BUY", "EXIT_LONG") else "SHORT"
    check = {"success": True, "positions": [
        {"api_key": k, "position_side": side, "position_amt": v, "entry_price": 1.0}
        for k, v in (open_sizes or {}).items()
    ]}
    mocks = {}
    with (
        patch.object(webhook, "fetch_accounts", return_value=accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: ASSETS.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok) as mocks["entry"],
        patch.object(webhook.engine_client, "get_json", return_value=check),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}) as mocks["post"],
        patch.object(webhook, "_post_trade_log") as mocks["trade_log"],
        patch.object(webhook, "_main_account_full", return_value=None) as mocks["main_full"],
        patch.object(notify, "notify_entry") as mocks["public_entry"],
        patch.object(notify, "open_exit_batch", return_value=None) as mocks["exit_batch"],
        patch.object(notify, "notify_max_increments") as mocks["max_note"],
        patch.object(notify, "notify_rejected") as mocks["rejected"],
        patch.object(notify, "notify_test_feed") as mocks["test_note"],
        patch.object(notify, "notify_test_feed_rejected") as mocks["test_rejected"],
    ):
        summary = webhook._process_trade_job(action, "DOGEUSDT", 2.2, None, "ABCD", **kwargs)
    return summary, mocks


def _names(summary: dict) -> set:
    return {r["account"] for r in summary["details"]}


# --- The route gate -----------------------------------------------------------

def _post(client, path, payload):
    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post(path, json=payload)
    return response, submit


def test_the_test_path_is_closed_while_no_test_secret_is_set(client, monkeypatch):
    monkeypatch.setattr(hooks, "TEST_WEBHOOK_SECRET", "")
    for secret in ("", MAIN_SECRET, "anything"):
        response, submit = _post(client, "/binance_test_webhook",
                                 {"secret": secret, "action": "BUY", "symbol": "DOGEUSDT"})
        assert response.status_code == 403, secret
        submit.assert_not_called()


def test_the_test_path_takes_the_test_secret_and_dispatches_on_the_test_feed(client, test_feed_on):
    response, submit = _post(client, "/binance_test_webhook",
                             {"secret": TEST_SECRET, "action": "BUY", "symbol": "DOGEUSDT"})
    assert response.status_code == 200
    assert response.get_json()["feed"] == "test"
    assert submit.call_args.args[0] is webhook._process_trade_job
    assert submit.call_args.kwargs == {"exchanges": ["binance"], "feed": "test"}


def test_neither_feeds_secret_opens_the_other(client, test_feed_on):
    """A leaked test-server token must never fire a real customer's trade,
    and a TradingView alert must never reach tester accounts."""
    response, submit = _post(client, "/binance_test_webhook",
                             {"secret": MAIN_SECRET, "action": "BUY", "symbol": "DOGEUSDT"})
    assert response.status_code == 403
    submit.assert_not_called()

    response, submit = _post(client, "/binance_abcd_webhook",
                             {"secret": TEST_SECRET, "action": "BUY", "symbol": "DOGEUSDT"})
    assert response.status_code == 403
    submit.assert_not_called()


def test_a_test_path_for_a_venue_this_engine_does_not_trade_is_a_400(client, test_feed_on):
    response, submit = _post(client, "/mexc_test_webhook",
                             {"secret": TEST_SECRET, "action": "BUY", "symbol": "DOGEUSDT"})
    assert response.status_code == 400
    submit.assert_not_called()


# --- Who trades it ------------------------------------------------------------

def test_a_main_signal_never_reaches_a_tester_account():
    summary, mocks = _run([MAIN, ALEX, TESTER])
    assert _names(summary) == {"master", "BOT ALEX G"}
    assert mocks["entry"].call_count == 2


def test_a_test_signal_trades_tester_accounts_only_demo_or_real():
    summary, mocks = _run([MAIN, ALEX, TESTER, TESTER_DEMO], feed="test")
    assert _names(summary) == {"Tester Tess", "Tester Demo"}
    assert summary["filled"] == 2
    assert mocks["entry"].call_count == 2


def test_an_account_without_a_feed_is_main_feed():
    """An API deployed before feeds sends no key: everyone stays on main."""
    legacy = _account("old", "Legacy", feed=None)
    summary, _ = _run([legacy])
    assert _names(summary) == {"Legacy"}
    summary, mocks = _run([legacy], feed="test")
    assert summary["details"][0]["reason"] == "no_accounts"
    mocks["test_rejected"].assert_called_once()
    mocks["rejected"].assert_not_called()


def test_target_uni_ids_on_the_main_path_cannot_pick_a_tester():
    summary, mocks = _run([ALEX, TESTER], target_uni_ids={"uni-tess"})
    assert summary["filled"] == 0
    mocks["entry"].assert_not_called()


# --- What a test signal may NOT do -------------------------------------------

def test_a_test_entry_is_never_announced_publicly():
    _, mocks = _run([MAIN, TESTER], feed="test")
    mocks["public_entry"].assert_not_called()
    mocks["max_note"].assert_not_called()
    mocks["test_note"].assert_called_once()
    rows = mocks["test_note"].call_args.args[2]
    assert [name for name, _ in rows] == ["Tester Tess"]


def test_a_test_exit_opens_no_public_exit_batch():
    with patch.object(webhook, "handle_exit", return_value={"status": "no position"}):
        _, mocks = _run([TESTER], action="EXIT_LONG", feed="test")
    mocks["exit_batch"].assert_not_called()
    mocks["test_note"].assert_called_once()


def test_the_test_feed_skips_the_main_account_rule():
    _, mocks = _run([TESTER], feed="test")
    mocks["main_full"].assert_not_called()

    _, mocks = _run([MAIN, ALEX])
    mocks["main_full"].assert_called_once()


def test_signal_log_rows_carry_the_feed():
    summary, mocks = _run([TESTER], feed="test")
    assert summary["feed"] == "test"
    row = mocks["trade_log"].call_args.args[0]
    assert row["feed"] == "test"

    summary, mocks = _run([ALEX])
    assert mocks["trade_log"].call_args.args[0]["feed"] == "main"


def test_a_rejected_test_signal_is_logged_on_the_test_feed():
    with (
        patch.object(webhook, "get_asset", return_value=None),
        patch.object(webhook, "_post_trade_log") as trade_log,
        patch.object(notify, "notify_rejected") as rejected,
        patch.object(notify, "notify_test_feed_rejected") as test_rejected,
    ):
        webhook._process_trade_job("BUY", "NOPEUSDT", None, None, None, feed="test")
    rejected.assert_not_called()
    test_rejected.assert_called_once()
    assert trade_log.call_args.args[0]["feed"] == "test"


def test_a_failed_test_entry_retries_on_the_test_feed():
    def _rate_limited(api, symbol, side, quantity, price):
        return {"result": None, "error": "429", "rate_limited": True}

    with (
        patch.object(webhook, "fetch_accounts", return_value=[TESTER]),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: ASSETS.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_rate_limited),
        patch.object(webhook.engine_client, "get_json", return_value={"success": True, "positions": []}),
        patch.object(webhook, "_post_trade_log"),
        patch.object(notify, "notify_test_feed"),
        patch("binance_abcd.retry_queue.enqueue_retry") as enqueue,
    ):
        webhook._process_trade_job("BUY", "DOGEUSDT", 2.2, None, None, feed="test")
    assert enqueue.call_args.kwargs["feed"] == "test"
    assert enqueue.call_args.kwargs["announce"] is False


def test_a_manual_close_reaches_a_tester_account():
    """The admin's close names its accounts (feed=None), so a tester's
    position is closable from Admin → Open positions like anyone's."""
    with patch.object(webhook, "handle_exit", return_value={"status": "no position"}):
        summary, mocks = _run([ALEX, TESTER], action="EXIT_LONG", targets={"binance": {"uni-tess"}},
                              announce=False, feed=None)
    assert _names(summary) == {"Tester Tess"}
    # A close of testers alone is test traffic: private note, test-tagged row.
    assert summary["feed"] == "test"
    mocks["test_note"].assert_called_once()


# --- The private notifier ------------------------------------------------------

def test_test_feed_messages_go_to_the_admin_chat_only(monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "_send", lambda text, chat_id=None: sent.append((chat_id, text)))
    monkeypatch.setattr(notify.discord_notify, "post", lambda *a, **k: sent.append(("discord", a)))
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "-100public")
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "-100admin")

    notify.notify_test_feed(
        "BUY", "DOGEUSDT",
        [("Tester Tess", {"status": "filled", "quantity": 100.0, "increment": 1, "max_increments": 3,
                          "sizing": {"streak_step": 2, "streak_run": -2}})],
        filled=1, failed=0, skipped=0, label="Binance",
    )
    notify.notify_test_feed_rejected("BUY", "NOPEUSDT", "asset_not_configured", label="Binance")
    notify.notify_retry_abandoned("EXIT_LONG", "DOGEUSDT", ["uni-tess"], 5, test_feed=True)

    assert [chat for chat, _ in sent] == ["-100admin"] * 3
    assert all("TEST FEED" in text for _, text in sent)
    assert "filled 100 · 1/3 · streak -2 step 2" in sent[0][1]


def test_with_no_admin_chat_a_test_message_is_dropped_never_made_public(monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "_send", lambda text, chat_id=None: sent.append(chat_id))
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "-100public")
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "")

    notify.notify_test_feed("BUY", "DOGEUSDT", [], filled=0, failed=0, skipped=0)
    notify.notify_retry_abandoned("BUY", "DOGEUSDT", ["uni-tess"], 5, test_feed=True)
    assert sent == []


def test_a_retry_run_on_the_test_feed_stays_silent(monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "_send_private", sent.append)
    notify.notify_test_feed("BUY", "DOGEUSDT", [], filled=1, failed=0, skipped=0, is_retry=True)
    assert sent == []


# --- /health and the paths nginx proxies --------------------------------------

def test_health_lists_every_webhook_and_the_test_feed_state(client, test_feed_on):
    body = client.get("/health").get_json()
    assert body["test_feed"] == {"enabled": True}
    by_key = {(w["exchange"], w["feed"]): w for w in body["webhooks"]}
    assert by_key[("binance", "test")] == {
        "exchange": "binance", "feed": "test", "path": "/binance_test_webhook", "enabled": True,
    }
    assert by_key[("binance", "main")]["enabled"] is True
    # MEXC is not traded by this (test) engine, so neither of its paths trades.
    assert by_key[("mexc", "main")]["enabled"] is False
    assert by_key[("mexc", "test")]["enabled"] is False
    assert TEST_SECRET not in str(body) and MAIN_SECRET not in str(body)


def test_health_reports_the_test_feed_off_without_a_secret(client, monkeypatch):
    monkeypatch.setattr(hooks, "TEST_WEBHOOK_SECRET", "")
    body = client.get("/health").get_json()
    assert body["test_feed"] == {"enabled": False}
    assert all(not w["enabled"] for w in body["webhooks"] if w["feed"] == "test")


def test_nginx_proxies_every_path_the_engine_answers():
    """A path missing from the deploy script's ENGINE_WEBHOOK_PATHS is a 404
    from nginx that never reaches the engine — identical, from TradingView or
    a signal provider, to a dead engine."""
    script = Path(__file__).resolve().parents[2] / ".claude" / "deploy_sinegualcrypto.py"
    if not script.exists():
        pytest.skip("deploy script not present in this checkout")
    match = re.search(r"^ENGINE_WEBHOOK_PATHS = \((.*?)\)", script.read_text(encoding="utf-8"), re.M | re.S)
    proxied = set(re.findall(r'"(/[a-z_]+)"', match.group(1)))
    answered = set(hooks.WEBHOOK_PATHS.values()) | set(hooks.TEST_WEBHOOK_PATHS.values())
    assert answered <= proxied
