"""The main-account rule (owner, 2026-10-14): when the MAIN account's stack on
a coin and side is already full, nobody adds — not even an account with room
of its own.

On 13 Oct a 4th RENDER signal found the main account at 3/3 and refused it,
but one customer who had closed by hand on Binance read 0/3 and got a fresh
first entry; the public channel then announced it as a reopen.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import binance_abcd.exchanges as exchanges
import binance_abcd.notify as notify
import binance_abcd.routes.webhook as webhook

# DOGEUSDT: base 100, max position 300 = 3 entries; balances under 1,000, so
# every entry is exactly 100 and the arithmetic stays visible.
ASSETS = {
    "DOGEUSDT": {"ticker": "DOGEUSDT", "base_size": 100.0, "max_size": 300.0,
                 "max_increments": 3.0, "side": "ALL"},
}


def _account(key: str, name: str, *, master: bool | None = False) -> dict:
    account = {
        "api_key": key, "secret_key": f"{key}-secret", "name": name, "uni_id": f"uni-{key}",
        "balance": 900.0, "initial_deposit": 1000.0, "total_deposit": 1000.0,
        "currency_type": "USDT", "demo": False, "enabled": True,
    }
    if master is not None:
        account["is_master"] = master
    return account


MAIN = _account("main", "master", master=True)
ALEX = _account("alex", "BOT ALEX G")
LLOYD = _account("lloyd", "Binance LLOYD")


def _entry_ok(api, symbol, side, quantity, price):
    return {"result": {"orderId": 1}, "symbol": symbol, "quantity": quantity, "price": price}


def _run(accounts, open_sizes, *, action="SELL", **kwargs):
    """One job; `open_sizes` = api_key -> open amount on the signal's side, or
    None for an unreadable positions/check. Returns (summary, entry mock, notify mocks)."""
    side = "LONG" if action == "BUY" else "SHORT"
    check = None if open_sizes is None else {"success": True, "positions": [
        {"api_key": k, "position_side": side, "position_amt": v, "entry_price": 1.0}
        for k, v in open_sizes.items()
    ]}
    with (
        patch.object(webhook, "fetch_accounts", return_value=accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: ASSETS.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok) as entry_mock,
        patch.object(webhook.engine_client, "get_json", return_value=check),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
        patch.object(notify, "notify_entry") as entry_note,
        patch.object(notify, "notify_max_increments") as max_note,
    ):
        summary = webhook._process_trade_job(action, "DOGEUSDT", 2.2, None, "ABCD", **kwargs)
    return summary, entry_mock, entry_note, max_note


def _by_name(summary: dict) -> dict:
    return {r["account"]: r for r in summary["details"]}


def test_a_full_main_account_holds_back_an_account_with_room():
    summary, entry_mock, _, _ = _run([MAIN, ALEX, LLOYD], {"main": 300, "lloyd": 300})

    rows = _by_name(summary)
    assert rows["master"]["reason"] == "maxed sizing"
    assert rows["Binance LLOYD"]["reason"] == "maxed sizing"
    alex = rows["BOT ALEX G"]
    assert alex["status"] == "skipped"
    assert alex["reason"] == webhook.MAIN_ACCOUNT_FULL
    assert alex["increment"] == 0
    assert alex["max_increments"] == 3
    assert alex["main_increment"] == 3
    entry_mock.assert_not_called()
    assert summary["filled"] == 0


def test_nothing_is_announced_and_the_admin_note_names_who_was_held_back():
    _, _, entry_note, max_note = _run([MAIN, ALEX, LLOYD], {"main": 300, "lloyd": 300})

    assert entry_note.call_args.kwargs["filled"] == 0  # notify_entry posts nothing at 0
    held = max_note.call_args.kwargs["held_back"]
    assert held == [("BOT ALEX G", 0, 3, 3)]
    capped = {name for name, *_ in max_note.call_args.args[2]}
    assert capped == {"master", "Binance LLOYD"}


def test_a_main_account_with_room_lets_everyone_add():
    summary, entry_mock, _, _ = _run([MAIN, ALEX, LLOYD], {"main": 200, "lloyd": 200})

    assert summary["filled"] == 3
    assert entry_mock.call_count == 3
    assert _by_name(summary)["BOT ALEX G"]["increment"] == 1


def test_an_account_that_is_itself_full_still_reads_maxed_sizing():
    summary, _, _, _ = _run([MAIN, ALEX], {"main": 300, "alex": 300})

    assert _by_name(summary)["BOT ALEX G"]["reason"] == "maxed sizing"


def test_a_targeted_manual_trade_is_not_held_back():
    summary, entry_mock, _, _ = _run([MAIN, ALEX], {"main": 300}, target_uni_ids={"uni-alex"})

    assert summary["filled"] == 1
    assert entry_mock.call_count == 1


def test_a_retry_is_not_held_back():
    # The retry re-places what one account missed of THIS signal; the main
    # account may well have filled it meanwhile.
    summary, entry_mock, _, _ = _run(
        [MAIN, ALEX], {"main": 300}, is_retry=True, targets={"binance": {"uni-alex"}},
    )

    assert summary["filled"] == 1
    assert entry_mock.call_count == 1


def test_with_no_main_account_each_account_keeps_its_own_cap():
    customer_a = _account("a", "Customer A", master=None)
    customer_b = _account("b", "Customer B", master=None)

    summary, _, _, _ = _run([customer_a, customer_b], {"a": 300})

    rows = _by_name(summary)
    assert rows["Customer A"]["reason"] == "maxed sizing"
    assert rows["Customer B"]["status"] == "filled"


def test_exits_are_never_held_back():
    summary, _, _, _ = _run([MAIN, ALEX], {"main": 300}, action="EXIT_SHORT")

    assert all(r.get("reason") != webhook.MAIN_ACCOUNT_FULL for r in summary["details"])


def test_an_unreadable_main_open_size_holds_nobody_back():
    fake = MagicMock()
    fake.open_amount.return_value = None
    fake.not_listed.return_value = None
    with patch.object(webhook, "client_for", return_value=fake):
        summary, _, _, _ = _run([MAIN, ALEX], None)

    assert all(r.get("reason") != webhook.MAIN_ACCOUNT_FULL for r in summary["details"])


def test_the_main_account_verdict_uses_the_same_rule_as_its_own_cap():
    # 2.6 entries open reads "3 of 3" for the main account's own cap (whole
    # entries, rounded) — and therefore as full for everyone else.
    assert webhook._main_account_full(
        "DOGEUSDT", "SHORT", ASSETS["DOGEUSDT"], [MAIN, ALEX], {"main": 260.0}, None,
    ) == {"account": "master", "increment": 3, "max_increments": 3}
    assert webhook._main_account_full(
        "DOGEUSDT", "SHORT", ASSETS["DOGEUSDT"], [MAIN, ALEX], {"main": 200.0}, None,
    ) is None


def test_the_admin_note_lists_held_back_accounts():
    sent = []
    with patch.object(notify, "_send_admin", side_effect=sent.append):
        notify.notify_max_increments(
            "SELL", "RENDERUSDT",
            [("master", 3, 3), ("Binance LLOYD", 3, 3)],
            held_back=[("BOT ALEX G", 0, 3, 3)],
        )

    text = sent[0]
    assert "Held back — the main account is already full (3/3):" in text
    assert "BOT ALEX G — 0/3 · no entry placed" in text
    assert "(3 account(s) affected)" in text


def test_the_admin_note_is_sent_for_held_back_accounts_alone():
    sent = []
    with patch.object(notify, "_send_admin", side_effect=sent.append):
        notify.notify_max_increments("SELL", "RENDERUSDT", [], held_back=[("BOT ALEX G", 0, 3, 3)])

    assert len(sent) == 1
