"""Telegram notifications: gating, formatting, and the exit-PnL batch.

No network — every test either leaves notifications disabled or captures
notify._send. Threading.Timer watchdogs are cancelled by the flush path, so
nothing leaks between tests.
"""

from __future__ import annotations

import pytest

from binance_abcd import discord_notify, hooks, notify


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


def test_startup_goes_to_the_admin_chat_with_its_counts(sent, monkeypatch):
    """The restart ping is an ops event carrying account counts — it belongs in
    the admin group, never on the channel anyone can read."""
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "-100999")
    notify.notify_startup(7, 4)
    text, chat_id = sent[0]
    assert chat_id == "-100999"
    assert "restarted" in text
    assert "7 accounts" in text and "4 assets" in text


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


def test_entry_message_shows_price_and_increment_but_never_account_counts(sent):
    notify.notify_entry(
        "BUY", "BTCUSDT", fill_price=109250.5, price=109000,
        filled=3, increment=2, max_increments=3,
    )
    text = sent[0][0]
    assert "Opening Long Positions — BTCUSDT" in text
    assert "Increment (2/3)" in text
    assert "Entry Price: 109,250.50" in text   # executed price wins over the signal price
    # How many customers filled is business information — the channel is public.
    assert "Accounts" not in text
    assert "filled" not in text
    # The channel never reveals how the engine is configured either.
    assert "Leverage" not in text
    assert "Strategy" not in text


def test_entry_increment_without_a_cap_uses_the_hash_form(sent):
    notify.notify_entry("BUY", "BTCUSDT", fill_price=109250.5, filled=1,
                        increment=2, max_increments=None)
    assert "Increment (#2)" in sent[0][0]


def test_entry_omits_the_increment_when_the_depth_is_unknown(sent):
    """No batched position read and no cap configured — publish a guess, never."""
    notify.notify_entry("BUY", "BTCUSDT", fill_price=109250.5, filled=1,
                        increment=None, max_increments=3)
    assert "Increment" not in sent[0][0]


def test_entry_with_no_fills_is_silent(sent):
    notify.notify_entry("BUY", "BTCUSDT", price=109000, filled=0)
    assert sent == []


def test_entry_omits_a_missing_price(sent):
    notify.notify_entry("SELL", "ETHUSDT", fill_price=None, price=None, filled=1)
    assert "Price" not in sent[0][0]


# --- Exit batch ---------------------------------------------------------------

def test_exit_flushes_once_every_account_reports(sent):
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT", price=110000)
    notify.seal_exit_batch(batch_id, expected=2)
    assert sent == []  # nothing sent while PnL is still pending

    notify.report_exit_fill(batch_id, realized_pnl=30.0, exit_price=110100, quantity=0.02, balance=1030.0)
    assert sent == []
    notify.report_exit_fill(batch_id, realized_pnl=10.0, exit_price=110200, quantity=0.01, balance=510.0)

    text = sent[0][0]
    assert "Closing Long Positions — BTCUSDT" in text
    # qty-weighted: (110100*0.02 + 110200*0.01) / 0.03
    assert "Exit Price: 110,133.33" in text
    # AFTER the round-trip taker fee: 30 - 2.202 and 10 - 1.102 = 36.696 net,
    # over 1030 + 510 = 1540 — the balances are the pre-close wallets already.
    assert "PnL: +2.383%" in text
    assert "Realized" not in text  # percentage only — no USDT amount
    assert "Accounts" not in text  # counts are not public on exits either
    assert batch_id not in notify._batches


def test_exit_message_reports_how_deep_the_closed_stack_was(sent):
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT", price=110000)
    notify.seal_exit_batch(batch_id, expected=2)
    notify.report_exit_fill(batch_id, realized_pnl=30.0, exit_price=110100, quantity=2,
                            balance=1030.0, increments=3, max_increments=3)
    notify.report_exit_fill(batch_id, realized_pnl=10.0, exit_price=110200, quantity=1,
                            balance=510.0, increments=3, max_increments=3)
    text = sent[0][0]
    assert "Increments Closed (3/3)" in text
    assert "Accounts" not in text


def test_exit_increment_takes_the_most_common_across_accounts(sent):
    """One account out of step must not decide what the channel says."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT", price=110000)
    notify.seal_exit_batch(batch_id, expected=3)
    for depth in (2, 2, 1):
        notify.report_exit_fill(batch_id, realized_pnl=1.0, exit_price=110100, quantity=1,
                                balance=1000.0, increments=depth, max_increments=3)
    assert "Increments Closed (2/3)" in sent[0][0]


def test_exit_omits_the_increment_when_no_account_could_derive_it(sent):
    """A close for a ticker whose asset row is gone still announces — exits
    skip every asset gate, so the depth is simply unknown."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT", price=110000)
    notify.seal_exit_batch(batch_id, expected=1)
    notify.report_exit_fill(batch_id, realized_pnl=30.0, exit_price=110100, quantity=1,
                            balance=1030.0, increments=None, max_increments=None)
    text = sent[0][0]
    assert "Increments Closed" not in text
    assert "Exit Price: 110,100.00" in text


def test_exit_reports_arriving_before_the_seal_still_flush(sent):
    """The fan-out submits bookkeeping per account, so a fast close can report
    before the job has finished aggregating and sealed the batch."""
    batch_id = notify.open_exit_batch("EXIT_SHORT", "ETHUSDT")
    notify.report_exit_fill(batch_id, realized_pnl=-5.0, exit_price=3000, quantity=0.1, balance=995.0)
    assert sent == []
    notify.seal_exit_batch(batch_id, expected=1)
    assert "Closing Short Positions — ETHUSDT" in sent[0][0]
    # -5 gross, -0.3 fee: -5.3 over 995
    assert "PnL: -0.533%" in sent[0][0]


def test_exit_pnl_is_published_after_exchange_fees(sent):
    """The venue reports GROSS; every screen we own is after fees, and the
    daily recap has to add up to the closes it is built from. So the channel
    nets the round-trip taker commission at the same rate the API's
    TradingFee::estimate uses — 0.05%/side on Binance."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "LTCUSDT", price=61)
    notify.seal_exit_batch(batch_id, expected=1)
    # 100 units at 61 = 6,100 notional -> 6.10 round trip on a 100 gross profit.
    notify.report_exit_fill(batch_id, realized_pnl=100.0, exit_price=61.0,
                            quantity=100, balance=10_000.0, exchange="binance")
    # 93.90 net over 10,000; gross would have published +1.000%.
    assert "PnL: +0.939%" in sent[0][0]


def test_exit_pnl_is_the_masters_alone_when_the_flag_is_present(sent):
    """The published track record is the master's account, so the close the
    channel announces has to be the master's too — a blend across customers
    could never add up to the daily recap built from it."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "LTCUSDT", price=61)
    notify.seal_exit_batch(batch_id, expected=2)
    notify.report_exit_fill(batch_id, realized_pnl=100.0, exit_price=61.0, quantity=100,
                            balance=10_000.0, exchange="binance", is_master=True,
                            increments=2, max_increments=3)
    # A customer trading the same signal on a very different balance: pooled,
    # it would drag the published figure to +0.62%.
    notify.report_exit_fill(batch_id, realized_pnl=20.0, exit_price=61.0, quantity=20,
                            balance=20_000.0, exchange="binance", is_master=False,
                            increments=1, max_increments=3)
    text = sent[0][0]
    assert "PnL: +0.939%" in text          # the master's, exactly as if alone
    assert "Increments Closed (2/3)" in text  # the master's depth, not the mode


def test_exit_publishes_no_pnl_when_the_master_did_not_fill(sent):
    """Key blocked, disabled, or joined later — whatever the reason, a customer
    blend is not the record this channel publishes. The close is still
    announced with its price; only the percentage is withheld."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "LTCUSDT", price=61)
    notify.seal_exit_batch(batch_id, expected=1)
    notify.report_exit_fill(batch_id, realized_pnl=20.0, exit_price=61.0, quantity=20,
                            balance=20_000.0, exchange="binance", is_master=False)
    text = sent[0][0]
    assert "Exit Price: 61.00" in text
    assert "PnL" not in text


def test_exit_pools_when_the_api_cannot_say_who_the_master_is(sent):
    """An engine deployed ahead of the API sends no flag at all. That must keep
    the old pooled figure rather than silently dropping the percentage from
    every message in the channel."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "LTCUSDT", price=61)
    notify.seal_exit_batch(batch_id, expected=2)
    notify.report_exit_fill(batch_id, realized_pnl=100.0, exit_price=61.0, quantity=100,
                            balance=10_000.0, exchange="binance")
    notify.report_exit_fill(batch_id, realized_pnl=20.0, exit_price=61.0, quantity=20,
                            balance=20_000.0, exchange="binance")
    # 112.68 net over 10,000 + 20,000
    assert "PnL: +0.376%" in sent[0][0]


def test_exit_pnl_stays_gross_when_the_fee_cannot_be_computed(sent):
    """No exit price means the fill is not indexed yet — an UNKNOWN fee, not a
    free trade. The percentage stays gross rather than being reduced by a zero
    nobody measured (the same null-is-not-zero rule the API's ingest follows)."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "LTCUSDT", price=61)
    notify.seal_exit_batch(batch_id, expected=1)
    notify.report_exit_fill(batch_id, realized_pnl=100.0, exit_price=None,
                            quantity=100, balance=10_000.0, exchange="binance")
    assert "PnL: +1.000%" in sent[0][0]


def test_mexc_nets_at_its_own_taker_rate(sent):
    """0.02%/side on MEXC against Binance's 0.05% — the rate is per venue, the
    same split `services.{exchange}.taker_fee_rate` carries on the API."""
    batch_id = notify.open_exit_batch("EXIT_LONG", "LTC_USDT", price=61)
    notify.seal_exit_batch(batch_id, expected=1)
    notify.report_exit_fill(batch_id, realized_pnl=100.0, exit_price=61.0,
                            quantity=100, balance=10_000.0, exchange="mexc")
    # 2.44 of fee, not 6.10: 97.56 net over 10,000
    assert "PnL: +0.976%" in sent[0][0]


def test_exit_with_nothing_closed_sends_nothing(sent):
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT")
    notify.seal_exit_batch(batch_id, expected=0)
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


def test_a_retrying_exit_is_amber_not_red(sent):
    """Red is reserved for what nobody is going to fix. An exchange timeout the
    queue clears 60s later is not that, and dressing it as one is how the real
    alert stops being read."""
    notify.notify_account_failures(
        "EXIT_LONG", "LTCUSDT", [("Demo Two", "-1007 execution status unknown")], retrying=True,
    )
    text = sent[0][0]
    assert "RETRYING" in text
    assert "MANUAL ACTION REQUIRED" not in text
    assert "a red alert follows only if they all fail" in text


def test_retry_abandoned_is_the_red_alert(sent):
    notify.notify_retry_abandoned("EXIT_LONG", "LTCUSDT", ["uni-demo-2"], 5)
    text = sent[0][0]
    assert "MANUAL ACTION REQUIRED" in text
    assert "gave up after 5 attempt(s)" in text
    assert "uni-demo-2" in text


def test_account_failures_truncate_long_lists(sent):
    notify.notify_account_failures("BUY", "BTCUSDT", [(f"acc{i}", "err") for i in range(25)])
    text = sent[0][0]
    assert "… +5 more" in text
    assert "(25 account(s) affected)" in text


def test_rejected_signal_names_the_reason(sent):
    notify.notify_rejected("BUY", "PEPEUSDT", "asset_not_configured")
    assert "asset_not_configured" in sent[0][0]


def test_a_refused_key_alert_carries_the_fix_not_just_the_complaint(sent):
    """Binance's own sentence names three possible faults and no remedy. The
    person reading this alert has to answer a customer, so the alert says what
    the customer must change."""
    notify.notify_account_failures(
        "BUY", "LTCUSDT",
        [("Binance guyomard", "Invalid API-key, IP, or permissions for action", "binance")],
    )
    text = sent[0][0]
    assert "The CREDENTIALS were refused, not the order." in text
    assert "Enable Futures" in text
    assert "Restrict access to trusted IPs" in text
    assert "skipped on entries until it is fixed" in text


def test_each_distinct_fix_is_stated_once(sent):
    notify.notify_account_failures(
        "BUY", "LTCUSDT",
        [("One", "Invalid API-key, IP, or permissions for action", "binance"),
         ("Two", "Invalid API-key, IP, or permissions for action", "binance"),
         ("Three (MEXC)", "Accessing IP is not in the whitelist", "mexc")],
    )
    text = sent[0][0]
    assert text.count("Restrict access to trusted IPs") == 1
    assert "Link IP address" in text


def test_an_ordinary_rejection_gets_no_key_advice(sent):
    """Nothing is wrong with the key when the venue rejects the ORDER — telling
    someone to go edit their API key over a balance shortfall is worse than
    saying nothing."""
    notify.notify_account_failures("BUY", "LTCUSDT", [("One", "2005 Balance insufficient", "mexc")])
    assert "CREDENTIALS" not in sent[0][0]


# --- Increments ---------------------------------------------------------------

def test_increment_bar_fills_then_pads():
    assert notify._increment_bar(2, 3) == "🟢🟢⚪"
    assert notify._increment_bar(3, 3) == "🟢🟢🟢"
    assert notify._increment_bar(5, 3) == "🟢🟢🟢"   # never overflows the cap
    assert notify._increment_bar(1, 0) == ""


def test_max_increments_note_is_admin_only_with_a_bar(sent):
    notify.notify_max_increments("BUY", "BTCUSDT", [("Live One", 3, 3), ("Live Two", 3, 3)])
    text = sent[0][0]
    assert "Max increments reached — BTCUSDT (BUY)" in text
    assert "Live One — 3/3 🟢🟢🟢 · no add placed" in text
    assert "(2 account(s) affected)" in text


def test_max_increments_survives_an_underivable_depth(sent):
    notify.notify_max_increments("BUY", "BTCUSDT", [("Live One", None, None)])
    assert "Live One — already at max · no add placed" in sent[0][0]


def test_max_increments_sends_nothing_when_no_account_was_capped(sent):
    notify.notify_max_increments("BUY", "BTCUSDT", [])
    assert sent == []


# --- Discord mirror -----------------------------------------------------------

@pytest.fixture()
def mirrored(monkeypatch):
    """Discord ON, its post captured as (text, color). Telegram is left as the
    test sets it — the mirror must not depend on it."""
    monkeypatch.setattr(hooks, "DISCORD_ENABLED", True)
    monkeypatch.setattr(hooks, "DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/1/t")
    posts: list[tuple[str, int]] = []
    monkeypatch.setattr(discord_notify, "post", lambda text, *, color: posts.append((text, color)))
    return posts


def test_discord_alone_is_a_public_destination(mirrored, monkeypatch):
    """With Telegram off entirely, an exit batch still opens and its message
    lands on Discord — the mirror is independent, not a Telegram add-on."""
    monkeypatch.setattr(hooks, "TELEGRAM_BOT_TOKEN", "")
    monkeypatch.setattr(hooks, "TELEGRAM_CHAT_ID", "")
    telegram = []
    monkeypatch.setattr(notify, "_send_sync", lambda *a: telegram.append(a))
    assert notify._enabled() is False

    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT", price=110000)
    assert batch_id is not None
    notify.seal_exit_batch(batch_id, expected=1)
    notify.report_exit_fill(batch_id, realized_pnl=30.0, exit_price=110100, quantity=0.02, balance=1030.0)

    assert telegram == []
    (text, color) = mirrored[0]
    assert "Closing Long Positions — BTCUSDT" in text
    assert "PnL: +2.699%" in text  # 27.798 net over 1030
    assert color == discord_notify.GREEN


def test_discord_gets_the_exact_public_text_telegram_gets(sent, mirrored):
    notify.notify_entry("BUY", "BTCUSDT", fill_price=109250.5, filled=3, increment=2, max_increments=3)
    assert mirrored[0][0] == sent[0][0]


def test_entry_colour_follows_the_side(mirrored):
    notify.notify_entry("BUY", "BTCUSDT", fill_price=1, filled=1)
    notify.notify_entry("SELL", "BTCUSDT", fill_price=1, filled=1)
    assert [c for _, c in mirrored] == [discord_notify.GREEN, discord_notify.RED]


def test_exit_colour_follows_the_sign_of_the_printed_pnl(sent, mirrored):
    def close(pnl, balance, *, exit_price=100, quantity=1):
        batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT", price=100)
        notify.seal_exit_batch(batch_id, expected=1)
        notify.report_exit_fill(batch_id, realized_pnl=pnl, exit_price=exit_price,
                                quantity=quantity, balance=balance)

    close(10.0, 1010.0)      # +0.990% after the 0.1 round-trip fee
    close(-5.0, 995.0)       # -0.510%
    # A dust loss on a dust notional, so the fee cannot drag it off zero: still
    # prints "+0.000%" — the case that proves a flat close is not a red card.
    close(-0.000001, 1000.0, exit_price=0.01, quantity=0.01)
    assert "+0.000%" in sent[2][0]
    assert [c for _, c in mirrored] == [discord_notify.GREEN, discord_notify.RED, discord_notify.GREEN]


def test_exit_without_a_pnl_is_grey(mirrored):
    batch_id = notify.open_exit_batch("EXIT_LONG", "BTCUSDT", price=100)
    notify.seal_exit_batch(batch_id, expected=1)
    notify.report_exit_fill(batch_id, exit_price=100, quantity=1)
    assert mirrored[0][1] == discord_notify.GREY
    assert "PnL:" not in mirrored[0][0]


def test_reports_are_blue(mirrored):
    notify.notify_report("daily", {"start": "2026-09-16", "end": "2026-09-16", "trading_days": 1,
                                   "return_pct": 1.0, "trades": 2, "assets": []}, exchange="Binance")
    assert mirrored[0][1] == discord_notify.BLUE
    assert "Daily Report" in mirrored[0][0]


def test_no_admin_message_is_ever_mirrored(sent, mirrored, monkeypatch):
    """Ops alerts carry account names and counts. Discord has no admin webhook
    and no fallback — every admin builder must leave the mirror untouched."""
    monkeypatch.setattr(hooks, "TELEGRAM_ADMIN_CHAT_ID", "")  # the fallback-to-public case
    notify.notify_startup(7, 4)
    notify.notify_rejected("BUY", "BTCUSDT", "asset not configured")
    notify.notify_account_failures("EXIT_LONG", "BTCUSDT", [("Live One", "-2019")])
    notify.notify_account_failures("BUY", "BTCUSDT", [("Live One", "408")], retrying=True)
    notify.notify_retry_abandoned("EXIT_LONG", "BTCUSDT", ["uni-1"], attempts=5)
    notify.notify_max_increments("BUY", "BTCUSDT", [("Live One", 3, 3)])
    notify.notify_error("poller", "boom")
    assert len(sent) == 7
    assert mirrored == []
