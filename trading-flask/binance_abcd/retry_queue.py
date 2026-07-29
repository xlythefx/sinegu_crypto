"""In-process retry queue for failed account fan-outs.

A job that fails retryably on some accounts enqueues a RetryJob carrying only
those uni_ids; a single timekeeper thread re-dispatches it through
_process_trade_job(..., target_uni_ids=..., is_retry=True) after
RETRY_INTERVAL_SECONDS, up to RETRY_MAX_ATTEMPTS. Deduped per
(action, ticker, uni_ids) so a burst of identical failures queues once.
State is in-memory only — a restart drops pending retries (accepted; the
past-positions poller reconciles the books either way).
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Optional

from binance_abcd.hooks import RETRY_ENABLED, RETRY_INTERVAL_SECONDS, RETRY_MAX_ATTEMPTS

log = logging.getLogger(__name__)


@dataclass
class RetryJob:
    action: str
    ticker: str
    price: Optional[float]
    leverage: Optional[int]
    strategy: Optional[str]
    uni_ids: list[str]
    attempts: int = 0
    due_at: float = field(default_factory=lambda: time.time() + RETRY_INTERVAL_SECONDS)

    @property
    def key(self) -> tuple:
        return (self.action, self.ticker, tuple(sorted(self.uni_ids)))


_LOCK = threading.Lock()
_QUEUE: list[RetryJob] = []
_ACTIVE_KEYS: set[tuple] = set()
_started = False


def enqueue_retry(
    action: str,
    ticker: str,
    price: Optional[float],
    leverage: Optional[int],
    strategy: Optional[str],
    uni_ids: list[str],
) -> bool:
    """Queue a retry for the given accounts. False when disabled or duplicate."""
    if not RETRY_ENABLED or not uni_ids:
        return False
    job = RetryJob(action, ticker, price, leverage, strategy, sorted(set(uni_ids)))
    with _LOCK:
        if job.key in _ACTIVE_KEYS:
            return False
        _ACTIVE_KEYS.add(job.key)
        _QUEUE.append(job)
    log.info("retry queued: %s %s for %d account(s)", action, ticker, len(job.uni_ids))
    return True


def queue_depth() -> int:
    with _LOCK:
        return len(_QUEUE)


def _requeue(job: RetryJob) -> None:
    job.attempts += 1
    if job.attempts >= RETRY_MAX_ATTEMPTS:
        log.warning(
            "retry abandoned after %d attempts: %s %s (%s)",
            job.attempts, job.action, job.ticker, ",".join(job.uni_ids),
        )
        with _LOCK:
            _ACTIVE_KEYS.discard(job.key)
        return
    job.due_at = time.time() + RETRY_INTERVAL_SECONDS
    with _LOCK:
        _QUEUE.append(job)


def _run_due_job(job: RetryJob) -> None:
    from binance_abcd.routes.webhook import _process_trade_job  # local import: avoid cycle

    try:
        summary = _process_trade_job(
            job.action, job.ticker, job.price, job.leverage, job.strategy,
            target_uni_ids=set(job.uni_ids), is_retry=True,
        )
    except Exception:  # noqa: BLE001
        log.exception("retry job crashed: %s %s", job.action, job.ticker)
        _requeue(job)
        return

    still_failing = [
        r["uni_id"]
        for r in summary.get("details", [])
        if isinstance(r, dict) and r.get("status") == "failed" and r.get("retryable") and r.get("uni_id")
    ]
    if still_failing:
        job.uni_ids = sorted(set(still_failing))
        _requeue(job)
    else:
        with _LOCK:
            _ACTIVE_KEYS.discard(job.key)


def _timekeeper(stop_event: threading.Event) -> None:
    while not stop_event.wait(1.0):
        now = time.time()
        due: list[RetryJob] = []
        with _LOCK:
            remaining = []
            for job in _QUEUE:
                (due if job.due_at <= now else remaining).append(job)
            _QUEUE[:] = remaining
        for job in due:
            _run_due_job(job)


def start_retry_queue(stop_event: threading.Event | None = None) -> None:
    global _started
    if _started or not RETRY_ENABLED:
        return
    _started = True
    event = stop_event or threading.Event()
    thread = threading.Thread(target=_timekeeper, args=(event,), name="retry-queue", daemon=True)
    thread.start()
    log.info("retry queue started (interval %ss, max %s attempts)", RETRY_INTERVAL_SECONDS, RETRY_MAX_ATTEMPTS)
