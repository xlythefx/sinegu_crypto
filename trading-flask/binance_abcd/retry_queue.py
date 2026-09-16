"""In-process retry queue for failed account fan-outs.

A job that fails retryably on some accounts enqueues a RetryJob carrying only
those accounts, as {exchange: [uni_ids]}; a single timekeeper thread
re-dispatches it through _process_trade_job(..., targets=..., is_retry=True)
after RETRY_INTERVAL_SECONDS, up to RETRY_MAX_ATTEMPTS. Deduped per
(action, ticker, targets) so a burst of identical failures queues once.
State is in-memory only — a restart drops pending retries (accepted; the
past-positions poller reconciles the books either way).

Targets are keyed by EXCHANGE, not by user alone: a user with an account on
Binance and one on MEXC whose MEXC entry timed out must be replayed on MEXC
only — replaying by uni_id would place a second Binance entry for a signal
that already filled there.

The queue OWNS the ending: whichever way a job stops — attempts exhausted, or a
run that comes back rejected rather than retryable — it raises the red
MANUAL ACTION alert. Nothing else can, because nothing else knows the retries
are over, and a job that quietly dropped out of the queue used to leave a
position open with only a log line to show for it.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Iterable, Optional

from binance_abcd import notify
from binance_abcd.exchanges import enabled as enabled_exchanges
from binance_abcd.exchanges import label
from binance_abcd.hooks import RETRY_ENABLED, RETRY_INTERVAL_SECONDS, RETRY_MAX_ATTEMPTS

log = logging.getLogger(__name__)


def _normalize_targets(targets: dict[str, Iterable[str]] | None) -> dict[str, list[str]]:
    """{exchange: sorted unique uni_ids}, empty lists dropped."""
    out: dict[str, list[str]] = {}
    for exchange, ids in (targets or {}).items():
        clean = sorted({str(i) for i in ids if i})
        if clean:
            out[str(exchange)] = clean
    return out


def _describe(targets: dict[str, list[str]]) -> list[str]:
    """uni_ids for the abandon alert — venue-suffixed only when more than one
    venue is enabled, so a Binance-only box reads exactly as before."""
    if len(enabled_exchanges()) <= 1:
        return [uni_id for ids in targets.values() for uni_id in ids]
    return [f"{uni_id} ({label(exchange)})" for exchange, ids in targets.items() for uni_id in ids]


@dataclass
class RetryJob:
    action: str
    ticker: str
    price: Optional[float]
    leverage: Optional[int]
    strategy: Optional[str]
    targets: dict[str, list[str]]  # exchange -> uni_ids still owed a retry
    attempts: int = 0
    # True when the live run published nothing (every account failed), so a
    # retry that closes the position still owes the channel its exit message.
    # Cleared the moment any run fills, so one signal is never announced twice.
    announce: bool = False
    due_at: float = field(default_factory=lambda: time.time() + RETRY_INTERVAL_SECONDS)

    @property
    def key(self) -> tuple:
        return (
            self.action,
            self.ticker,
            tuple(sorted((exchange, tuple(ids)) for exchange, ids in self.targets.items())),
        )

    @property
    def uni_ids(self) -> list[str]:
        """Every user in the job, across venues (logging / counts)."""
        return [uni_id for ids in self.targets.values() for uni_id in ids]


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
    targets: dict[str, Iterable[str]],
    announce: bool = False,
) -> bool:
    """Queue a retry for the given {exchange: uni_ids}. False when disabled,
    empty, or a duplicate of an active job."""
    clean = _normalize_targets(targets)
    if not RETRY_ENABLED or not clean:
        return False
    job = RetryJob(action, ticker, price, leverage, strategy, clean, announce=announce)
    with _LOCK:
        if job.key in _ACTIVE_KEYS:
            return False
        _ACTIVE_KEYS.add(job.key)
        _QUEUE.append(job)
    log.info("retry queued: %s %s for %d account(s) on %s",
             action, ticker, len(job.uni_ids), ",".join(clean))
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
        # The engine is done trying: NOW it is manual action, and the alert has
        # to say so out loud rather than in the journal.
        notify.notify_retry_abandoned(job.action, job.ticker, _describe(job.targets), job.attempts)
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
            targets={exchange: set(ids) for exchange, ids in job.targets.items()},
            is_retry=True, announce=job.announce,
        )
    except Exception:  # noqa: BLE001
        log.exception("retry job crashed: %s %s", job.action, job.ticker)
        _requeue(job)
        return

    details = [r for r in summary.get("details", []) if isinstance(r, dict)]
    still_failing: dict[str, set[str]] = {}
    rejected: dict[str, set[str]] = {}
    for r in details:
        if r.get("status") != "failed" or not r.get("uni_id"):
            continue
        bucket = still_failing if r.get("retryable") else rejected
        bucket.setdefault(r.get("exchange", "binance"), set()).add(r["uni_id"])

    # Failed and no longer worth repeating (the exchange rejected it outright).
    # The live run said nothing about these — it saw a retryable failure — so
    # this is the only chance to report them.
    if rejected:
        notify.notify_retry_abandoned(
            job.action, job.ticker, _describe(_normalize_targets(rejected)), job.attempts + 1,
        )

    # Something filled: this run published the signal, so a later attempt must
    # not publish it again.
    if job.announce and any(r.get("status") == "filled" for r in details):
        job.announce = False

    if still_failing:
        # The job's key follows its targets: swap the active key so the
        # narrowed job is what dedupes (and what gets released at the end).
        with _LOCK:
            _ACTIVE_KEYS.discard(job.key)
            job.targets = _normalize_targets(still_failing)
            _ACTIVE_KEYS.add(job.key)
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
