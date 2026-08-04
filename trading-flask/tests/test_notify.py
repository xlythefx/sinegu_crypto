"""Telegram notifications: gating, formatting, and the exit-PnL batch.

No network — every test either leaves notifications disabled or captures
notify._send. Threading.Timer watchdogs are cancelled by the flush path, so
nothing leaks between tests.
"""

from __future__ import annotations

import pytest

from binance_abcd import hooks, notify


@pytest.fixture()
def sent(monkeypatch):
    """Enable notifications and capture every rendered message."""
    monkeypatch.setattr(hooks, "TELEGRAM_ENABLED", True)
    monkeypatch.setattr(hooks, "TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "-100123")
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "")
    monkeypatch.setattr(hooks, "TELEGRAM_PNL_WAIT_SECONDS", 30.0)
    messages: list[tuple[str, str]] = []
    monkeypatch.setattr(
        notify, "_send", lambda text, chat_id=None: messages.append((text, chat_id or "-100123"))
    )
    return messages


@pytest.fixture(autouse=True)
def _no_leaked_batches():
    yield
    for batch in list(notify._batches.values()):
        if batch.timer:
            batch.timer.cancel()
    notify._batches.clear()


# --- Gating -------------------------------------------------------------------

def test_disabled_without_token_or_chat(monkeypatch):
    monkeypatch.setattr(hooks, "TELEGRAM_ENABLED", True)
    monkeypatch.setattr(hooks, "TELEGRAM_BOT_TOKEN", "")
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "-100123")
    assert notify._enabled() is False
    assert notify.open_exit_batch("EXIT_LONG", "BTCUSDT") is None

    monkeypatch.setattr(hooks, "TELEGRAM_BOT_TOKEN", "t")
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "")
    assert notify._enabled() is False


def test_send_is_a_noop_when_disabled(monkeypatch):
    monkeypatch.setattr(hooks, "TELEGRAM_BOT_TOKEN", "")
    called = []
    monkeypatch.setattr(notify, "_send_sync", lambda *a: called.append(a))
    notify._send("hello")
    assert called == []


def test_admin_falls_back_to_the_main_chat(sent, monkeypatch):
    notify.notify_error("poller", "boom")
    assert sent[0][1] == "-100123"
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "-100999")
    notify.notify_error("poller", "boom")
    assert sent[1][1] == "-100999"


# --- Formatting ---------------------------------------------------------------

def test_price_formatting_keeps_sub_dollar_precision():
    assert notify._fmt_price(109250.5) == "109,250.50"
    assert notify._fmt_price(0.14231) == "0.142310"
    assert notify._fmt_price(None) == "None"


def test_pct_never_renders_negative_zero():
    assert notify._fmt_pct(-0.0001) == "+0.000%"
    assert notify._fmt_pct(1.2345) == "+1.234%" or notify._fmt_pct(1.2345) == "+1.235%"
    assert notify._fmt_pct(-2.5) == "-2.500%"
    assert notify._fmt_pct("nope") == ""


def test_entry_message_contains_price_and_counts_only(sent):
    notify.notify_entry(
        "BUY", "BTCUSDT", fill_price=109250.5, price=109000,
        filled=3, skipped=1, failed=0,
    )
    text = sent[0][0]
    assert "Opening Long Positions — BTCUSDT" in text
    assert "Entry Price: 109,250.50" in text   # executed price wins over the signal price
    assert "Accounts: 3 filled · 1 skipped" in text
    # The channel never reveals how the engine is configured.
    assert "Leverage" not in text
    assert "Strategy" not in text


def test_entry_with_no_fills_is_silent(sent):
    notify.notify_entry("BUY", "BTCUSDT", price=109000, filled=0, skipped=3)
    assert sent == []


def test_entry_omits_a_missing_price(sent):
    notify.notify_entry("SELL", "ETHUSDT", fill_price=None, price=None, filled=1)
    assert "Price" not in sent[0][0]


# --- Exit batch ---------------------------------------------------------------

def test_exit_flushes_once_every_account_reports(sent):
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT", price=110000)
    notify.seal_exit_batch(batch_id, expected=2)
    assert sent == []  # nothing sent while PnL is still pending

    notify.report_exit_fill(batch_id, realized_pnl=30.0, exit_price=110100, quantity=2, balance=1030.0)
    assert sent == []
    notify.report_exit_fill(batch_id, realized_pnl=10.0, exit_price=110200, quantity=1, balance=510.0)

    text = sent[0][0]
    assert "Closing Long Positions — BTCUSDT" in text
    # qty-weighted: (110100*2 + 110200*1) / 3
    assert "Exit Price: 110,133.33" in text
    # 40 profit on (1030-30)+(510-10) = 1500 pre-trade capital
    assert "PnL: +2.667%" in text
    assert "Realized" not in text  # percentage only — no USDT amount
    assert "Accounts: 2 closed" in text
    assert batch_id not in notify._batches


def test_exit_reports_arriving_before_the_seal_still_flush(sent):
    """The fan-out submits bookkeeping per account, so a fast close can report
    before the job has finished aggregating and sealed the batch."""
    batch_id = notify.open_exit_batch("EXIT_SHORT", "ETHUSDT")
    notify.report_exit_fill(batch_id, realized_pnl=-5.0, exit_price=3000, quantity=1, balance=995.0)
    assert sent == []
    notify.seal_exit_batch(batch_id, expected=1)
    assert "Closing Short Positions — ETHUSDT" in sent[0][0]
    assert "PnL: -0.500%" in sent[0][0]


def test_exit_with_nothing_closed_sends_nothing(sent):
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT")
    notify.seal_exit_batch(batch_id, expected=0, skipped=3)
    assert sent == []
    assert batch_id not in notify._batches


def test_exit_falls_back_to_the_signal_price_without_pnl(sent):
    """A close whose userTrades read failed still announces — price only."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "DOGEUSDT", price=0.14231)
    notify.seal_exit_batch(batch_id, expected=1)
    notify.report_exit_fill(batch_id, realized_pnl=None, exit_price=None, balance=500.0)
    text = sent[0][0]
    assert "Exit Price: 0.142310" in text
    assert "PnL" not in text
    assert "Realized" not in text


def test_exit_omits_pnl_when_no_balance_to_divide_by(sent):
    """Without a balance there is no percentage — and an amount is never a
    fallback, so the message carries the price and counts only."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT")
    notify.seal_exit_batch(batch_id, expected=1)
    notify.report_exit_fill(batch_id, realized_pnl=30.0, exit_price=110100, quantity=1, balance=None)
    text = sent[0][0]
    assert "Exit Price: 110,100.00" in text
    assert "PnL" not in text
    assert "Realized" not in text  # (can't assert on "USDT" — the ticker contains it)


def test_watchdog_flushes_a_batch_whose_report_never_arrives(sent, monkeypatch):
    monkeypatch.setattr(hooks, "TELEGRAM_PNL_WAIT_SECONDS", 0.05)
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT", price=110000)
    notify.seal_exit_batch(batch_id, expected=2)
    notify.report_exit_fill(batch_id, realized_pnl=30.0, exit_price=110100, quantity=1, balance=1030.0)

    batch = notify._batches[batch_id]
    batch.timer.join(2.0)
    assert batch_id not in notify._batches
    assert "Exit Price: 110,100.00" in sent[0][0]
    # A late report after the flush must not send a second message.
    notify.report_exit_fill(batch_id, realized_pnl=10.0, exit_price=110200, quantity=1, balance=510.0)
    assert len(sent) == 1


def test_discard_cancels_a_batch_silently(sent):
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT")
    notify.discard_exit_batch(batch_id)
    assert sent == []
    assert batch_id not in notify._batches


# --- Admin --------------------------------------------------------------------

def test_account_failures_flag_exits_as_manual_action(sent):
    notify.notify_account_failures("EXIT_LONG", "BTCUSDT", [("Live One", "-2015 invalid key")])
    text = sent[0][0]
    assert "MANUAL ACTION REQUIRED" in text
    assert "Live One — -2015 invalid key" in text


def test_account_failures_truncate_long_lists(sent):
    notify.notify_account_failures("BUY", "BTCUSDT", [(f"acc{i}", "err") for i in range(25)])
    text = sent[0][0]
    assert "… +5 more" in text
    assert "(25 account(s) affected)" in text


def test_rejected_signal_names_the_reason(sent):
    notify.notify_rejected("BUY", "PEPEUSDT", "asset_not_configured")
    assert "asset_not_configured" in sent[0][0]
