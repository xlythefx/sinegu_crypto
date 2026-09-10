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
    with patch.object(key_status.engine_client, "post_json") as post:
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope")
        key_status.report_ok("key-a")
        key_status.report_ok("key-a")           # deduped
        key_status.report_blocked("key-a", -2015, "IP_OR_PERMISSION", "nope")

    statuses = [call[0][1]["status"] for call in post.call_args_list]
    assert statuses == ["blocked", "ok", "blocked"]


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
