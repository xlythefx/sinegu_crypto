"""A close nobody is coming to fix is emailed NOW (stuck_exits.py, 2026-11-12).

The failed-trade email is hourly; an exit refused outright or abandoned by the
retry queue may leave a real position open, so the engine tells the API at
once. Exits only, main feed only, never on the trading path.
"""

from __future__ import annotations

import threading
from unittest.mock import patch

import binance_abcd.notify as notify
import binance_abcd.retry_queue as rq
import binance_abcd.stuck_exits as stuck_exits
from binance_abcd.hooks import MAIN_FEED, RETRY_MAX_ATTEMPTS, TEST_FEED


def _capture():
    calls = []
    done = threading.Event()

    def _post(path, payload, *, exchange=None):
        calls.append((path, payload, exchange))
        done.set()
        return {"success": True}

    return calls, done, _post


def test_an_exit_is_posted_per_venue_with_its_accounts():
    calls, done, post = _capture()
    with patch.object(stuck_exits.engine_client, "post_json", side_effect=post):
        stuck_exits.report("EXIT_SHORT", "santosusdt", [
            {"exchange": "binance", "uni_id": "u1", "name": "Big customer", "error": "-2022 ReduceOnly Order is rejected"},
        ], why="rejected")
        assert done.wait(2)
    path, payload, exchange = calls[0]
    assert path == "alerts/exit-stuck" and exchange == "binance"
    assert payload["ticker"] == "SANTOSUSDT" and payload["why"] == "rejected" and payload["total"] == 1
    assert payload["accounts"] == [{"uni_id": "u1", "name": "Big customer", "error": "-2022 ReduceOnly Order is rejected"}]


def test_an_entry_is_never_posted():
    with patch.object(stuck_exits.engine_client, "post_json") as post:
        stuck_exits.report("SELL", "SANTOSUSDT", [{"exchange": "binance", "uni_id": "u1"}], why="rejected")
    post.assert_not_called()


def _abandon(feed):
    job = rq.RetryJob("EXIT_LONG", "LTCUSDT", None, None, None, {"binance": ["u1"]},
                      attempts=RETRY_MAX_ATTEMPTS - 1, feed=feed)
    with patch.object(notify, "notify_retry_abandoned"), patch.object(stuck_exits, "report") as report:
        rq._requeue(job)
    return report


def test_an_abandoned_main_feed_exit_is_reported():
    report = _abandon(MAIN_FEED)
    report.assert_called_once()
    args, kwargs = report.call_args
    assert args[:2] == ("EXIT_LONG", "LTCUSDT") and kwargs["why"] == "abandoned"
    assert args[2] == [{"exchange": "binance", "uni_id": "u1"}]


def test_an_abandoned_test_feed_exit_is_not_emailed():
    _abandon(TEST_FEED).assert_not_called()
