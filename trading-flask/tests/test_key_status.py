"""Credential-rejection detection and reporting.

The risk here is asymmetric: a missed -2015 leaves an account silently dead,
but a FALSE -2015 starts a 3-day clock that disconnects a working account. So
most of these tests are about what must NOT be treated as a credential fault.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from binance_abcd import key_status


@pytest.fixture(autouse=True)
def _clean():
    key_status.reset()
    yield
    key_status.reset()


# ---- classification ---------------------------------------------------------

def test_2015_is_a_credential_rejection():
    verdict = key_status.classify({"code": -2015, "msg": "Invalid API-key, IP, or permissions for action."})
    assert verdict is not None
    code, reason, message = verdict
    assert code == -2015
    assert reason == "IP_OR_PERMISSION"
    assert "Invalid API-key" in message


def test_wrong_secret_and_bad_key_are_also_credential_rejections():
    assert key_status.classify({"code": -1022, "msg": "Signature for this request is not valid."})[1] == "BAD_SIGNATURE"
    assert key_status.classify({"code": -2014, "msg": "API-key format invalid."})[1] == "BAD_KEY_FORMAT"


@pytest.mark.parametrize("body", [
    None,
    {},
    {"code": -1021, "msg": "Timestamp for this request is outside of the recvWindow."},
    {"code": -2019, "msg": "Margin is insufficient."},
    {"code": -4059, "msg": "No need to change position side."},
    {"code": "not-an-int", "msg": "weird"},
    {"msg": "no code at all"},
])
def test_everything_else_is_not_a_credential_fault(body):
    """Clock drift, insufficient margin, order rejections: none of these say
    anything about the key, and flagging on them would disconnect people who
    are simply out of margin."""
    assert key_status.classify(body) is None


# ---- reporting --------------------------------------------------------------

def test_a_block_is_reported_once_not_once_per_poll():
    with patch.object(key_status.engine_client, "post_json") as post:
        for _ in range(5):
            key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope")

    assert post.call_count == 1
    path, payload = post.call_args[0]
    assert path == "key-status"
    assert payload["api_key"] == "key-a"
    assert payload["status"] == "blocked"
    assert payload["code"] == "-2015"


def test_recovery_is_reported_once_and_re_arms_the_block():
    """The IP case: reads were refused too, so a read succeeding IS the
    recovery — that is how a user who allow-lists our IP un-flags themselves."""
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope", scope=key_status.READ)
        key_status.report_ok("key-a")
        key_status.report_ok("key-a")           # deduped
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope", scope=key_status.READ)

    statuses = [call[0][1]["status"] for call in post.call_args_list]
    assert statuses == ["blocked", "ok", "blocked"]


def test_a_read_never_clears_a_verdict_an_order_earned():
    """The read-only key (live, 2026-09-23): Reading enabled, Futures not.

    Balances and positions come back perfectly, every order is refused -2015.
    While any success cleared any block, the flag was raised by the refused
    order and erased by the poller ~90s later, so the account read "connected"
    with a live balance and silently took no trades. The customer had no way to
    find out, and neither did the pay sheet, the card or the modal.
    """
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_ok("key-a")                                    # balance poll
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope")   # refused order
        for _ in range(5):
            key_status.report_ok("key-a")                                # the pollers, all day

    statuses = [call[0][1]["status"] for call in post.call_args_list]
    assert statuses == ["ok", "blocked"]                                 # and it STAYS blocked


def test_a_refused_order_on_a_readable_key_names_the_permission():
    """-2015 covers three faults. A read having succeeded rules out two of
    them — the IP is allowed and the key exists — so what is left is the
    futures permission, which is the only one the customer can act on."""
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_ok("key-a")
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope")

    assert post.call_args_list[-1][0][1]["reason"] == "TRADE_PERMISSION"

    # Without that proof it stays the ambiguous verdict: a key whose reads are
    # refused too may well be an IP fault, and naming the wrong fix sends the
    # customer to edit a permission that was never the problem.
    key_status.reset()
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_blocked("key-b", -2015, "IP_OR_PERMISSION", "nope")

    assert post.call_args_list[-1][0][1]["reason"] == "IP_OR_PERMISSION"


def test_a_successful_order_clears_everything():
    """The recovery path for the permission case: the key traded, so whatever
    was wrong with it is not wrong any more."""
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_ok("key-a")
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope")
        key_status.report_ok("key-a", scope=key_status.TRADE)

    statuses = [call[0][1]["status"] for call in post.call_args_list]
    assert statuses == ["ok", "blocked", "ok"]


def test_reads_failing_too_downgrades_the_verdict_back_to_the_ip_reading():
    """A permission verdict must not outlive its evidence: once reads start
    being refused as well, the IP or the key is the fault again."""
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_ok("key-a")
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope")
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope", scope=key_status.READ)

    reasons = [call[0][1]["reason"] for call in post.call_args_list if call[0][1]["status"] == "blocked"]
    assert reasons == ["TRADE_PERMISSION", "IP_OR_PERMISSION"]


def test_accounts_are_tracked_independently():
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope")
        key_status.report_blocked("key-b", -2015, "IP_OR_PERMISSION", "nope")

    assert {call[0][1]["api_key"] for call in post.call_args_list} == {"key-a", "key-b"}


def test_a_backend_outage_never_propagates():
    """Reporting is bookkeeping. If Laravel is down the trade path must carry
    on regardless."""
    with patch.object(key_status.engine_client, "post_json", side_effect=RuntimeError("laravel down")):
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope")


def test_no_api_key_is_a_no_op():
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_blocked("", -2015, "IP_OR_PERMISSION", "nope")
        key_status.report_ok("")

    post.assert_not_called()
