"""Streak sizing — a ladder of manual entry sizes per winning or losing run.

The rules are the owner's (2026-10-09): after N losses — or N wins — in a row
on a coin, an account's next ENTRY uses the size typed for that step; a blank
step carries the previous one; the current run decides (a win ends a losing
run and vice versa); the step still scales with the balance; an unreadable run
trades base size. Exits never change.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import binance_abcd.assets_api as assets_api
import binance_abcd.exchanges as exchanges
import binance_abcd.routes.webhook as webhook


@pytest.fixture()
def ltc():
    """LTC as the loader hands it down: base 50, max position 150 (= 3 entries),
    loss steps 1 → 40 and 3+ → 25 (2 left blank on purpose), win step 2+ → 60."""
    return {"ticker": "LTCUSDT", "base_size": 50.0, "max_size": 150.0, "max_increments": 3.0,
            "side": "ALL", "streak_sizes": {"loss": {1: 40.0, 3: 25.0}, "win": {2: 60.0}}}


def _entry_ok(api, symbol, side, quantity, price):
    return {"result": {"orderId": 1}, "symbol": symbol, "quantity": quantity, "price": price}


def _run(accounts, asset, *, runs=None, positions=(), action="BUY", exit_=None, tags=(), strategy=None, record=None):
    """Run one LTC job. `runs` is the streaks payload's map, or None for a
    failed read; `tags` the open-strategies rows the API holds. Returns
    (summary, entry mock, exit mock, GET calls made); `record`, when given,
    receives the POST and bookkeeping mocks."""
    asked: list[tuple[str, dict]] = []

    def fake_get(path, *args, **kwargs):
        asked.append((path, kwargs.get("params") or {}))
        if path == "streaks":
            return None if runs is None else {"success": True, "streaks": runs}
        if path == "open-strategies":
            key = (kwargs.get("params") or {}).get("api_key")
            return {"success": True, "open_strategies": [t for t in tags if t["api_key"] == key]}
        return {"success": True, "positions": list(positions)}

    with (
        patch.object(webhook, "fetch_accounts", return_value=accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: asset if t.upper() == "LTCUSDT" else None),
        patch.object(exchanges, "BinanceAPI", MagicMock()),
        patch.object(webhook, "handle_entry", side_effect=_entry_ok) as entry_mock,
        patch.object(
            webhook, "handle_exit",
            side_effect=exit_ or (lambda api, t, ps, p: {"result": {"orderId": 2}, "closed_quantity": 75.0, "entry_price": 60.0}),
        ) as exit_mock,
        patch.object(webhook.engine_client, "get_json", side_effect=fake_get),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}) as post_mock,
        patch.object(webhook.engine_client, "delete_json", return_value={"success": True}),
        patch.object(webhook, "_BOOKKEEPING_EXECUTOR", MagicMock()) as bookkeeping,
    ):
        summary = webhook._process_trade_job(action, "LTCUSDT", 60.0, None, strategy)
    if record is not None:
        record["post"] = post_mock
        record["bookkeeping"] = bookkeeping
    return summary, entry_mock, exit_mock, asked


def _by_account(summary):
    return {d["account"]: d for d in summary["details"]}


# --- which step applies ----------------------------------------------------------

@pytest.mark.parametrize("run, expected", [
    (0, (50.0, None, 0)),     # no history → base
    (-1, (40.0, "loss", 1)),
    (-2, (40.0, "loss", 1)),  # loss step 2 left blank → keeps step 1
    (-3, (25.0, "loss", 3)),
    (-7, (25.0, "loss", 3)),  # past the deepest step → the deepest keeps applying
    (1, (50.0, None, 0)),     # one win, first win step is at 2 → base
    (2, (60.0, "win", 2)),
    (6, (60.0, "win", 2)),
])
def test_the_deepest_step_of_the_runs_kind_applies(ltc, run, expected):
    assert webhook._streak_size(ltc, run) == expected


def test_without_win_steps_any_win_is_base(ltc):
    ltc["streak_sizes"] = {"loss": {1: 40.0}}
    assert webhook._streak_size(ltc, 4) == (50.0, None, 0)


def test_the_read_depth_is_the_deepest_step_of_either_kind(ltc):
    assert webhook._streak_depth(ltc) == 3
    ltc["streak_sizes"]["win"] = {5: 70.0}
    assert webhook._streak_depth(ltc) == 5


# --- entries ------------------------------------------------------------------------

def test_each_account_trades_its_own_step_scaled_by_its_balance(fake_accounts, ltc):
    """Live One (1,000 USDT) is 3 losses down → 25; Live Three (2,500) is 2 wins
    up → 60 × 2.5 = 150; Demo Two has no history → base 50 (300 USDT is under
    the reference balance, so unscaled)."""
    summary, entry_mock, _, _ = _run(fake_accounts, ltc, runs={"live-key-1": -3, "live-key-3": 2})

    details = _by_account(summary)
    assert details["Live One"]["quantity"] == 25.0
    assert details["Live Three"]["quantity"] == 150.0
    assert details["Demo Two"]["quantity"] == 50.0
    assert entry_mock.call_count == 3


def test_one_win_after_losses_is_base_when_no_win_step_starts_at_one(fake_accounts, ltc):
    summary, _, _, _ = _run(fake_accounts[:1], ltc, runs={"live-key-1": 1})
    assert summary["details"][0]["quantity"] == 50.0


def test_the_sizing_row_explains_the_step(fake_accounts, ltc):
    summary, _, _, _ = _run(fake_accounts[2:], ltc, runs={"live-key-3": -2})

    sizing = summary["details"][0]["sizing"]
    assert sizing["base_size"] == 50.0           # the asset's own figure
    assert sizing["streak_run"] == -2
    assert sizing["streak_known"] is True
    assert sizing["streak_kind"] == "loss"
    assert sizing["streak_step"] == 1
    assert sizing["streak_size"] == 40.0
    assert sizing["quantity"] == 100.0           # 40 × 2.5
    assert sizing["normal_quantity"] == 125.0    # what base would have been
    assert sizing["size_multiple"] == 2.5


def test_an_unreadable_run_trades_base_size(fake_accounts, ltc):
    summary, _, _, _ = _run(fake_accounts[:1], ltc, runs=None)

    detail = summary["details"][0]
    assert detail["status"] == "filled"
    assert detail["quantity"] == 50.0
    assert detail["sizing"]["streak_known"] is False
    assert detail["sizing"]["streak_kind"] is None


def test_an_asset_without_a_ladder_makes_no_streak_read(fake_accounts, ltc):
    ltc["streak_sizes"] = {}
    summary, _, _, asked = _run(fake_accounts, ltc, runs={"live-key-1": -3})

    assert "streaks" not in [path for path, _ in asked]
    assert _by_account(summary)["Live One"]["quantity"] == 50.0
    assert "streak_run" not in summary["details"][0]["sizing"]


def test_the_run_read_is_one_call_at_the_ladders_depth(fake_accounts, ltc):
    _, _, _, asked = _run(fake_accounts, ltc, runs={})

    reads = [params for path, params in asked if path == "streaks"]
    assert reads == [{"symbol": "LTCUSDT", "depth": 3}]


# --- the stack cap ------------------------------------------------------------------

def test_the_cap_counts_entries_of_the_streak_size(fake_accounts, ltc):
    """Two 25-unit entries open three losses down = 2 of 3 — the third is allowed."""
    positions = [{"api_key": "live-key-1", "position_side": "LONG", "position_amt": 50.0, "entry_price": 60}]
    summary, _, _, _ = _run(fake_accounts[:1], ltc, runs={"live-key-1": -3}, positions=positions)

    detail = summary["details"][0]
    assert detail["status"] == "filled"
    assert detail["sizing"]["stacks_now"] == 2.0
    assert detail["increment"] == 3


def test_a_full_streak_stack_is_still_maxed(fake_accounts, ltc):
    positions = [{"api_key": "live-key-1", "position_side": "LONG", "position_amt": 75.0, "entry_price": 60}]
    summary, entry_mock, _, _ = _run(fake_accounts[:1], ltc, runs={"live-key-1": -3}, positions=positions)

    assert summary["details"][0]["reason"] == "maxed sizing"
    entry_mock.assert_not_called()


def test_a_win_step_bigger_than_base_can_never_pass_the_max_position_size(fake_accounts, ltc):
    """A 60-unit win step against a 50 base: two entries (120) are 2 of 3 by
    count, but a third would make 180 against a 150 max position — refused."""
    positions = [{"api_key": "live-key-1", "position_side": "LONG", "position_amt": 120.0, "entry_price": 60}]
    summary, entry_mock, _, _ = _run(fake_accounts[:1], ltc, runs={"live-key-1": 2}, positions=positions)

    assert summary["details"][0]["reason"] == "maxed sizing"
    entry_mock.assert_not_called()


def test_a_win_step_entry_inside_the_max_position_size_goes_through(fake_accounts, ltc):
    positions = [{"api_key": "live-key-1", "position_side": "LONG", "position_amt": 60.0, "entry_price": 60}]
    summary, _, _, _ = _run(fake_accounts[:1], ltc, runs={"live-key-1": 3}, positions=positions)

    assert summary["details"][0]["status"] == "filled"
    assert summary["details"][0]["quantity"] == 60.0


# --- exits ---------------------------------------------------------------------------

def test_exits_are_never_resized(fake_accounts, ltc):
    summary, entry_mock, exit_mock, _ = _run(fake_accounts, ltc, runs={"live-key-1": -3}, action="EXIT_LONG")

    assert summary["filled"] == 3
    assert exit_mock.call_count == 3
    entry_mock.assert_not_called()


def test_increments_closed_divides_by_the_streak_size(fake_accounts, ltc):
    """Three 25-unit entries close as 75: that is 3 increments, not the 2 you get
    dividing by the 50 base — the figure the channel and the trade count read."""
    summary, _, _, _ = _run(fake_accounts[:1], ltc, runs={"live-key-1": -3}, action="EXIT_LONG")
    assert summary["details"][0]["increment"] == 3


def test_increments_closed_falls_back_to_base_without_runs(ltc):
    account = {"api_key": "k", "balance": 1000.0}
    assert webhook._closed_increments(account, ltc, "LTCUSDT", 75.0, None) == (2, 3)
    assert webhook._closed_increments(account, ltc, "LTCUSDT", 75.0, {"k": -3}) == (3, 3)
    assert webhook._closed_increments(account, ltc, "LTCUSDT", 120.0, {"k": 2}) == (2, 3)


# --- the read and the loader ------------------------------------------------------

def test_the_run_read_tells_empty_from_unavailable():
    with patch.object(webhook.engine_client, "get_json", return_value=None):
        assert webhook._fetch_streaks("LTCUSDT", "binance", 3) is None
    with patch.object(webhook.engine_client, "get_json", return_value={"success": True, "streaks": []}):
        assert webhook._fetch_streaks("LTCUSDT", "binance", 3) == {}
    with patch.object(webhook.engine_client, "get_json", return_value={"success": True, "streaks": "x"}):
        assert webhook._fetch_streaks("LTCUSDT", "binance", 3) is None
    with patch.object(webhook.engine_client, "get_json",
                      return_value={"success": True, "streaks": {"a": -2, "b": 3, "c": "bad"}}) as get:
        assert webhook._fetch_streaks("ltcusdt", "binance", 3) == {"a": -2, "b": 3}
    assert get.call_args.args[0] == "streaks"
    assert get.call_args.kwargs["params"] == {"symbol": "LTCUSDT", "depth": 3}


def test_the_loader_reads_the_ladder_only_when_switched_on():
    on = {"streak_sizing_enabled": True,
          "streak_sizes": [{"kind": "loss", "streak": 3, "size": 25}, {"kind": "loss", "streak": 1, "size": "40"},
                           {"kind": "win", "streak": 2, "size": 60}, {"kind": "draw", "streak": 1, "size": 9},
                           {"kind": "loss", "streak": 0, "size": 9}, {"kind": "win", "streak": 4, "size": 0},
                           {"bad": True}]}
    assert assets_api._streak_ladder(on) == {"loss": {1: 40.0, 3: 25.0}, "win": {2: 60.0}}
    assert list(assets_api._streak_ladder(on)["loss"]) == [1, 3]
    assert assets_api._streak_ladder({**on, "streak_sizing_enabled": False}) == {}
    assert assets_api._streak_ladder({}) == {}   # an API older than the feature


# --- the step travels from the entry to its closed trade (2026-10-14) ----------------

def _tags_posted(record) -> dict:
    """api_key -> the open-strategies payload each entry posted."""
    return {c.args[1]["api_key"]: c.args[1] for c in record["post"].call_args_list if c.args[0] == "open-strategies"}


def test_an_entry_remembers_the_step_that_sized_it(fake_accounts, ltc):
    """Live One is 3 losses down (step 3 → 25 instead of 50); Live Three is one
    win up, below the first win step, so it trades normal size and its tag
    carries no streak — but is still written, which clears a stale one."""
    record: dict = {}
    _run(fake_accounts, ltc, runs={"live-key-1": -3, "live-key-3": 1}, record=record)

    tags = _tags_posted(record)
    assert {k: tags["live-key-1"][k] for k in webhook.STREAK_TAG_FIELDS} == {
        "streak_kind": "loss", "streak_run": 3, "streak_step": 3, "streak_size": 25.0, "streak_base_size": 50.0,
    }
    assert "streak_kind" not in tags["live-key-3"]
    assert "strategy" not in tags["live-key-3"]   # no label on this signal: the API keeps the old one


def test_a_coin_without_a_ladder_writes_no_label_less_tag(fake_accounts, ltc):
    ltc["streak_sizes"] = {}
    record: dict = {}
    _run(fake_accounts, ltc, runs={}, record=record)
    assert _tags_posted(record) == {}

    _run(fake_accounts, ltc, runs={}, strategy="ABCD-v1", record=record)
    assert all(set(t) == {"api_key", "symbol", "position_side", "strategy"} for t in _tags_posted(record).values())


def test_the_close_carries_the_entrys_step(fake_accounts, ltc):
    tag = {"api_key": "live-key-1", "symbol": "LTCUSDT", "position_side": "LONG", "strategy": "ABCD-v1",
           "streak_kind": "loss", "streak_run": 3, "streak_step": 3, "streak_size": "25.000000",
           "streak_base_size": "50.000000"}
    record: dict = {}
    _run(fake_accounts[:1], ltc, runs={"live-key-1": -3}, action="EXIT_LONG", tags=[tag],
         strategy="ABCD-v1", record=record)

    (submit,) = record["bookkeeping"].submit.call_args_list
    assert submit.args[7] == "ABCD-v1"                      # the signal's own label still wins
    assert submit.args[-1] == {k: tag[k] for k in webhook.STREAK_TAG_FIELDS}


def test_an_exit_on_a_coin_without_a_ladder_makes_no_extra_read(fake_accounts, ltc):
    ltc["streak_sizes"] = {}
    record: dict = {}
    _, _, _, asked = _run(fake_accounts[:1], ltc, runs={}, action="EXIT_LONG", strategy="ABCD-v1", record=record)
    assert not [p for p, _ in asked if p == "open-strategies"]
    (submit,) = record["bookkeeping"].submit.call_args_list
    assert submit.args[-1] is None


def test_the_close_row_posts_the_streak_fields():
    account = {"api_key": "k", "uni_id": "u1", "name": "A", "balance": 1000.0, "exchange": "binance"}
    streak = {"streak_kind": "win", "streak_run": 2, "streak_step": 2, "streak_size": 60.0, "streak_base_size": 50.0}
    with (
        patch.object(webhook, "get_order_fill_summary", return_value=(12.5, 101.0)),
        patch.object(webhook, "_consume_strategy"),
        patch.object(webhook.notify, "report_exit_fill"),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}) as post,
    ):
        webhook._deferred_close_bookkeeping(
            account, MagicMock(), "LTCUSDT", "LONG", 120.0, 60.0, "s", {"orderId": 9}, streak=streak,
        )
    (sync,) = [c for c in post.call_args_list if c.args[0] == "past-positions/sync"]
    row = sync.args[1]["rows"][0]
    assert {k: row[k] for k in webhook.STREAK_TAG_FIELDS} == streak


def test_an_unreadable_run_tags_no_streak():
    """An unknown run trades base size — the tag must not claim a step."""
    assert webhook._entry_streak({"streak_step": 0, "run": 0}) is None
