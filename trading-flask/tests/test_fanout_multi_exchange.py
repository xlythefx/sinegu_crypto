"""One signal, two exchanges: each venue plans on its own asset row and its own
accounts, every bookkeeping write lands on that venue's /engine/{exchange}/,
retries stay on the venue that failed, and Telegram sees one merged message."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import binance_abcd.exchanges as exchanges
import binance_abcd.hooks as hooks
import binance_abcd.retry_queue as retry_queue
import binance_abcd.routes.webhook as webhook

BINANCE_ACCOUNTS = [
    {"api_key": "b-1", "secret_key": "s", "name": "Live One", "uni_id": "uni-1", "balance": 1000.0,
     "total_deposit": 1000.0, "demo": False, "exchange": "binance"},
    {"api_key": "b-2", "secret_key": "s", "name": "Live Two", "uni_id": "uni-2", "balance": 1000.0,
     "total_deposit": 1000.0, "demo": False, "exchange": "binance"},
]
MEXC_ACCOUNTS = [
    # uni-1 has an account on BOTH venues — the case retries must keep apart.
    {"api_key": "m-1", "secret_key": "s", "name": "Live One", "uni_id": "uni-1", "balance": 1000.0,
     "total_deposit": 1000.0, "demo": False, "exchange": "mexc"},
    {"api_key": "m-3", "secret_key": "s", "name": "MEXC Three", "uni_id": "uni-3", "balance": 1000.0,
     "total_deposit": 1000.0, "demo": False, "exchange": "mexc"},
]
ASSETS = {
    ("BTCUSDT", "binance"): {"ticker": "BTCUSDT", "base_size": 0.005, "max_size": 0.05, "max_increments": 10.0, "side": "ALL"},
    ("BTCUSDT", "mexc"): {"ticker": "BTCUSDT", "base_size": 0.005, "max_size": 0.015, "max_increments": 3.0, "side": "ALL"},
    ("ETHUSDT", "binance"): {"ticker": "ETHUSDT", "base_size": 0.1, "max_size": 0.5, "max_increments": 5.0, "side": "ALL"},
}


@pytest.fixture(autouse=True)
def _two_exchanges(monkeypatch):
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance", "mexc"))
    with retry_queue._LOCK:
        retry_queue._QUEUE.clear()
        retry_queue._ACTIVE_KEYS.clear()
    yield
    with retry_queue._LOCK:
        retry_queue._QUEUE.clear()
        retry_queue._ACTIVE_KEYS.clear()


def _entry_ok(api, symbol, side, quantity, price):
    return {"result": {"orderId": 1, "avgPrice": "100.5" if api.exchange == "binance" else None},
            "symbol": symbol, "quantity": quantity, "price": price}


def _exit_ok(api, t, ps, p):
    return {"result": {"orderId": 2}, "closed_quantity": 0.005, "entry_price": 100.0}


def _run(action="BUY", ticker="BTCUSDT", *, accounts=None, entry=None, exit_=None, **kwargs):
    accounts = accounts if accounts is not None else {"binance": BINANCE_ACCOUNTS, "mexc": MEXC_ACCOUNTS}
    calls = {"get": [], "post": [], "delete": []}

    def get_json(path, params=None, *, exchange=None):
        calls["get"].append((path, exchange, params))
        return {"success": True, "positions": [], "open_strategies": []}

    def post_json(path, payload, *, exchange=None):
        calls["post"].append((path, exchange, payload))
        return {"success": True}

    def delete_json(path, payload, *, exchange=None):
        calls["delete"].append((path, exchange, payload))
        return {"success": True}

    def raw(api_key, secret_key, base_url=None):
        instance = MagicMock(name=api_key)
        instance.api_key, instance.base_url = api_key, base_url
        return instance

    with (
        patch.object(webhook, "fetch_accounts", side_effect=lambda force=False, exchange=None: list(accounts.get(exchange, []))),
        patch.object(webhook, "get_asset", side_effect=lambda t, ex="binance": ASSETS.get((t.upper(), ex))),
        patch.object(exchanges, "BinanceAPI", side_effect=raw),
        patch.object(exchanges, "MexcFuturesAPI", side_effect=raw),
        patch.object(webhook, "handle_entry", side_effect=entry or _entry_ok) as entry_mock,
        patch.object(webhook, "handle_exit", side_effect=exit_ or _exit_ok) as exit_mock,
        patch.object(webhook.engine_client, "get_json", side_effect=get_json),
        patch.object(webhook.engine_client, "post_json", side_effect=post_json),
        patch.object(webhook.engine_client, "delete_json", side_effect=delete_json),
        patch.object(webhook.notify, "notify_rejected") as rejected,
        patch.object(webhook.notify, "notify_entry") as notify_entry,
        patch.object(webhook.notify, "open_exit_batch", return_value="batch-1") as open_batch,
        patch.object(webhook.notify, "seal_exit_batch") as seal,
        patch.object(webhook.notify, "notify_account_failures") as failures,
    ):
        summary = webhook._process_trade_job(action, ticker, 100.0, 10, "strat", **kwargs)
        # trade-logs are posted from the account pool; wait for them.
        webhook._ACCOUNT_EXECUTOR.submit(lambda: None).result()
    return summary, {
        "calls": calls, "entry": entry_mock, "exit": exit_mock, "rejected": rejected,
        "notify_entry": notify_entry, "open_batch": open_batch, "seal": seal, "failures": failures,
    }


def _trade_logs(mocks):
    return [(ex, payload) for path, ex, payload in mocks["calls"]["post"] if path == "trade-logs"]


# --- Every venue runs the signal on its own accounts --------------------------------

def test_both_venues_fill_and_each_gets_its_own_trade_log():
    summary, m = _run()
    assert summary["filled"] == 4 and summary["target_count"] == 4 and summary["success"] is True
    assert summary["exchanges"] == ["binance", "mexc"]
    assert {r["exchange"] for r in summary["details"]} == {"binance", "mexc"}
    assert {api.exchange for api in (c.args[0] for c in m["entry"].call_args_list)} == {"binance", "mexc"}

    logs = dict(_trade_logs(m))
    assert set(logs) == {"binance", "mexc"}
    assert logs["binance"]["filled"] == 2 and logs["binance"]["target_count"] == 2
    assert logs["mexc"]["filled"] == 2 and all(r["exchange"] == "mexc" for r in logs["mexc"]["details"])
    assert "exchange" not in logs["mexc"]  # the API stamps it from the route


def test_bookkeeping_writes_follow_the_accounts_exchange():
    _, m = _run()
    checks = [(ex, p["symbol"]) for path, ex, p in m["calls"]["get"] if path == "positions/check"]
    assert sorted(checks) == [("binance", "BTCUSDT"), ("mexc", "BTCUSDT")]  # one batched read per venue
    upserts = {(ex, p["api_key"]) for path, ex, p in m["calls"]["post"] if path == "positions/upsert"}
    assert upserts == {("binance", "b-1"), ("binance", "b-2"), ("mexc", "m-1"), ("mexc", "m-3")}
    strategies = {(ex, p["api_key"]) for path, ex, p in m["calls"]["post"] if path == "open-strategies"}
    assert strategies == upserts


def test_exits_close_on_every_venue_and_seal_one_batch_with_the_total():
    summary, m = _run("EXIT_LONG")
    webhook._BOOKKEEPING_EXECUTOR.submit(lambda: None).result()
    assert summary["filled"] == 4
    m["open_batch"].assert_called_once()
    m["seal"].assert_called_once()
    assert m["seal"].call_args.kwargs == {"expected": 4, "label": "Binance + MEXC"}
    syncs = {(ex, p["rows"][0]["api_key"]) for path, ex, p in m["calls"]["post"] if path == "past-positions/sync"}
    assert syncs == {("binance", "b-1"), ("binance", "b-2"), ("mexc", "m-1"), ("mexc", "m-3")}
    consumed = {ex for path, ex, _ in m["calls"]["delete"]}
    assert consumed == {"binance", "mexc"}


# --- Per-venue asset gate -----------------------------------------------------------

def test_a_ticker_not_configured_on_one_venue_only_rejects_that_venue():
    summary, m = _run(ticker="ETHUSDT")  # ETH is a Binance asset only
    assert summary["category"] == "signal" and summary["filled"] == 2
    assert {api.exchange for api in (c.args[0] for c in m["entry"].call_args_list)} == {"binance"}
    logs = dict(_trade_logs(m))
    assert logs["binance"]["category"] == "signal"
    assert logs["mexc"]["category"] == "rejected"
    assert logs["mexc"]["details"] == [{"reason": "asset_not_configured", "exchange": "mexc"}]
    m["rejected"].assert_not_called()  # the signal traded; nobody is paged
    assert m["notify_entry"].call_args.kwargs["label"] == "Binance"


def test_rejected_everywhere_is_one_alert_and_one_row_per_venue():
    summary, m = _run(ticker="XRPUSDT")
    assert summary["category"] == "rejected" and summary["target_count"] == 0
    assert summary["details"][0]["reason"] == "asset_not_configured"
    m["rejected"].assert_called_once()
    assert m["rejected"].call_args.args[2] == "asset_not_configured"
    assert m["rejected"].call_args.kwargs["label"] == "Binance + MEXC"
    assert sorted(ex for ex, _ in _trade_logs(m)) == ["binance", "mexc"]
    m["entry"].assert_not_called()


def test_different_reasons_per_venue_are_named_in_the_one_alert():
    # Binance rejects on side, MEXC has no row at all.
    with patch.dict(ASSETS, {("DOGEUSDT", "binance"): {"ticker": "DOGEUSDT", "base_size": 100.0, "max_size": 300.0, "max_increments": 3.0, "side": "LONG"}}):
        _, m = _run("SELL", "DOGEUSDT")
    reason = m["rejected"].call_args.args[2]
    assert "Binance: side_LONG_blocks_SELL" in reason and "MEXC: asset_not_configured" in reason


def test_a_venue_with_no_accounts_is_skipped_silently_while_another_runs():
    summary, m = _run(accounts={"binance": BINANCE_ACCOUNTS, "mexc": []})
    assert summary["filled"] == 2 and summary["exchanges"] == ["binance"]
    assert [ex for ex, _ in _trade_logs(m)] == ["binance"]
    m["rejected"].assert_not_called()


def test_no_accounts_anywhere_is_no_accounts_on_every_venue():
    summary, m = _run(accounts={"binance": [], "mexc": []})
    assert summary["category"] == "rejected"
    assert [p["details"][0]["reason"] for _, p in _trade_logs(m)] == ["no_accounts", "no_accounts"]
    m["rejected"].assert_called_once()
    assert m["rejected"].call_args.args[2] == "no_accounts"


# --- Restricting a signal to some venues ------------------------------------------------

def test_the_exchanges_argument_restricts_the_fan_out():
    summary, m = _run(exchanges=["mexc"])
    assert summary["exchanges"] == ["mexc"] and summary["filled"] == 2
    assert {api.exchange for api in (c.args[0] for c in m["entry"].call_args_list)} == {"mexc"}
    assert [ex for ex, _ in _trade_logs(m)] == ["mexc"]


def test_target_uni_ids_applies_on_every_venue():
    summary, _ = _run(target_uni_ids={"uni-1"})
    assert summary["filled"] == 2
    assert {(r["exchange"], r["uni_id"]) for r in summary["details"]} == {("binance", "uni-1"), ("mexc", "uni-1")}


# --- Retries stay on the venue that failed -----------------------------------------------

def _mexc_only_failure(api, symbol, side, quantity, price):
    if api.exchange == "mexc":
        return {"result": None, "error": "510 Requests are too frequent", "rate_limited": True}
    return _entry_ok(api, symbol, side, quantity, price)


def test_a_failure_on_one_venue_is_retried_on_that_venue_only():
    summary, m = _run(entry=_mexc_only_failure)
    assert summary["filled"] == 2 and summary["failed"] == 2
    assert retry_queue.queue_depth() == 1
    job = retry_queue._QUEUE[0]
    # uni-1 filled on Binance and failed on MEXC: replayed on MEXC alone.
    assert job.targets == {"mexc": ["uni-1", "uni-3"]}
    assert job.announce is False  # Binance already published the signal
    amber = [c for c in m["failures"].call_args_list if c.kwargs.get("retrying")][0]
    assert sorted(f[0] for f in amber.args[2]) == ["Live One (MEXC)", "MEXC Three (MEXC)"]


def test_a_retry_run_only_touches_its_targets():
    summary, m = _run(targets={"mexc": {"uni-1"}}, is_retry=True, announce=False)
    assert summary["exchanges"] == ["mexc"] and summary["target_count"] == 1
    assert [(r["exchange"], r["uni_id"]) for r in summary["details"]] == [("mexc", "uni-1")]
    assert summary["category"] == "retry"
    assert dict(_trade_logs(m))["mexc"]["category"] == "retry"


def test_the_queue_requeues_per_venue_from_the_merged_details():
    retry_queue.enqueue_retry("BUY", "BTCUSDT", 100.0, 10, "strat", {"binance": ["uni-1"], "mexc": ["uni-1"]})
    job = retry_queue._QUEUE.pop(0)
    summary = {"details": [
        {"uni_id": "uni-1", "exchange": "binance", "status": "filled"},
        {"uni_id": "uni-1", "exchange": "mexc", "status": "failed", "retryable": True},
    ]}
    with patch("binance_abcd.routes.webhook._process_trade_job", return_value=summary) as process:
        retry_queue._run_due_job(job)
    process.assert_called_once_with(
        "BUY", "BTCUSDT", 100.0, 10, "strat",
        targets={"binance": {"uni-1"}, "mexc": {"uni-1"}}, is_retry=True, announce=False,
    )
    assert retry_queue._QUEUE[0].targets == {"mexc": ["uni-1"]}


def test_abandon_alerts_name_the_venue_when_several_are_enabled():
    retry_queue.enqueue_retry("EXIT_LONG", "BTCUSDT", None, None, None, {"mexc": ["uni-3"]})
    job = retry_queue._QUEUE.pop(0)
    job.attempts = retry_queue.RETRY_MAX_ATTEMPTS - 1
    with (
        patch("binance_abcd.routes.webhook._process_trade_job",
              return_value={"details": [{"uni_id": "uni-3", "exchange": "mexc", "status": "failed", "retryable": True}]}),
        patch.object(retry_queue.notify, "notify_retry_abandoned") as abandoned,
    ):
        retry_queue._run_due_job(job)
    assert abandoned.call_args.args[2] == ["uni-3 (MEXC)"]


# --- What the channel says -------------------------------------------------------------

def test_the_public_message_names_the_venues_that_filled_and_averages_their_prices():
    def entry(api, symbol, side, quantity, price):
        avg = "100" if api.exchange == "binance" else "102"
        return {"result": {"orderId": 1, "avgPrice": avg}, "quantity": quantity}

    _, m = _run(entry=entry)
    kwargs = m["notify_entry"].call_args.kwargs
    assert kwargs["label"] == "Binance + MEXC"
    assert kwargs["fill_price"] == pytest.approx(101.0)
    assert kwargs["filled"] == 4


def test_the_label_only_names_venues_that_actually_filled():
    def entry(api, symbol, side, quantity, price):
        if api.exchange == "mexc":
            return {"result": None, "error": "2005 Balance insufficient"}
        return _entry_ok(api, symbol, side, quantity, price)

    _, m = _run(entry=entry)
    assert m["notify_entry"].call_args.kwargs["label"] == "Binance"
    red = [c for c in m["failures"].call_args_list if not c.kwargs.get("retrying")][0]
    assert sorted(f[0] for f in red.args[2]) == ["Live One (MEXC)", "MEXC Three (MEXC)"]


# --- Locks are per venue -----------------------------------------------------------------

def test_symbol_locks_do_not_collide_across_venues():
    import binance_abcd.symbol_locks as symbol_locks

    assert symbol_locks.lock_for("k", "BTCUSDT", "binance") is not symbol_locks.lock_for("k", "BTCUSDT", "mexc")
    assert symbol_locks.lock_for("k", "BTCUSDT") is symbol_locks.lock_for("k", "btcusdt", "binance")


# --- The route -----------------------------------------------------------------------------

def test_each_venue_has_its_own_webhook_path(client):
    payload = {"secret": "test-webhook-secret", "action": "BUY", "symbol": "MEXC:btcusdt"}
    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post("/mexc_abcd_webhook", json=payload)
    assert response.status_code == 200
    body = response.get_json()
    assert body["ticker"] == "BTCUSDT" and body["exchange"] == "mexc" and body["exchanges"] == ["mexc"]
    assert submit.call_args.kwargs == {"exchanges": ["mexc"]}

    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post("/binance_abcd_webhook", json=payload)
    assert response.get_json()["exchanges"] == ["binance"]
    assert submit.call_args.kwargs == {"exchanges": ["binance"]}


def test_a_payload_naming_another_venue_than_its_path_is_refused(client):
    payload = {"secret": "test-webhook-secret", "action": "BUY", "symbol": "BTCUSDT", "exchanges": "mexc"}
    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post("/binance_abcd_webhook", json=payload)
    assert response.status_code == 400 and "binance only" in response.get_json()["error"]
    submit.assert_not_called()

    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post("/mexc_abcd_webhook", json=payload)   # agrees with the path
    assert response.status_code == 200
    submit.assert_called_once()

    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post("/mexc_abcd_webhook", json=payload | {"exchanges": ["bybit"]})
    assert response.status_code == 400 and "bybit" in response.get_json()["error"]
    submit.assert_not_called()


def test_a_disabled_venues_webhook_answers_400_after_the_secret_gate(client, monkeypatch):
    monkeypatch.setattr(hooks, "EXCHANGES", ("binance",))
    payload = {"secret": "test-webhook-secret", "action": "BUY", "symbol": "BTCUSDT"}
    with patch.object(webhook._DISPATCH_EXECUTOR, "submit") as submit:
        response = client.post("/mexc_abcd_webhook", json=payload)
    assert response.status_code == 400 and "not enabled" in response.get_json()["error"]
    submit.assert_not_called()
    # Without the secret the answer is the same 403 as anywhere else — no venue leak.
    assert client.post("/mexc_abcd_webhook", json={"action": "BUY", "symbol": "BTCUSDT"}).status_code == 403
