"""Fee receipts — what the exchange actually charged, one row per charge.

Binance's ``realizedPnl`` on a fill is GROSS: price move × quantity, before
the commission on that fill and before any funding paid while the position
was held. The API nets an ESTIMATE out of every close on ingest
(``TradingFee`` in sinegutrade-api); this module ships the REAL figures so the
API can replace the estimate with them: every userTrades fill with its
``commission``/``commissionAsset``, and every ``FUNDING_FEE`` income row.

Nothing here talks to Binance or the backend. The past-positions poller owns
the one weight-30 income call per account and already fetches userTrades per
symbol; it hands both responses to the pure builders below and POSTs what they
return to ``/engine/binance/fees``. Two things are deliberate:

* **Every fill is a receipt, entry fills included, at ENTRY time.** The API
  attributes a close's fee by replaying the symbol's fills in order, so it
  needs the entry fills — and it needs them before the close, because the
  poller's closes flow only fetches fills since the last close on that symbol
  and would never see an entry that happened earlier. A COMMISSION income row
  appears the moment an entry fills, which is what puts the symbol on the fee
  flow's fetch list. Fills that cost nothing are shipped too: their QUANTITY
  is what tells the replay how much of a later close belongs to which entry.
* **A separate watermark**, ``out/last_fees_sync.json``. The closes watermark
  advances to the newest CLOSE; the fee watermark advances to the newest
  RECEIPT (an entry with no close yet), and only when the backend accepted the
  batch. A failed userTrades read for any symbol holds it, because a receipt
  skipped once is skipped forever — the next tick starts past it.

Sign convention (matches the ``exchange_fee_receipts`` table): ``amount > 0``
is money OUT. A fill's commission arrives positive and is passed through;
funding arrives signed (negative = paid) and is negated, so a funding CREDIT
is a negative receipt and a trade's total fee is a plain sum.

``asset`` is shipped exactly as reported. An account paying fees in BNB
produces BNB receipts; the API refuses to sum those with USDT and leaves that
trade on the estimate — deciding that here would hide it.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Iterable, NamedTuple

from binance_abcd.hooks import OUT_DIR

log = logging.getLogger(__name__)

FEES_WATERMARK_FILE = OUT_DIR / "last_fees_sync.json"

# Binance rejects a userTrades startTime older than 7 days ("startTime and
# endTime must be within 7 days" / -1127); the seed lookback is clamped to it.
USER_TRADES_MAX_AGE_MS = 7 * 86400 * 1000 - 5 * 60 * 1000
# Re-send the last few minutes before the fee watermark every tick: the
# backend's insertOrIgnore absorbs the duplicates, and it covers a receipt whose
# timestamp Binance indexed a moment after the mark was taken.
FEE_OVERLAP_MS = 5 * 60 * 1000

INCOME_REALIZED_PNL = "REALIZED_PNL"
INCOME_COMMISSION = "COMMISSION"
INCOME_FUNDING_FEE = "FUNDING_FEE"


class IncomeParts(NamedTuple):
    """One unfiltered /fapi/v1/income response, split by what each flow needs."""

    close_symbols: set[str]  # REALIZED_PNL since the closes watermark
    fee_symbols: set[str]  # COMMISSION since the fee watermark
    funding: list[dict]  # FUNDING_FEE rows since the fee watermark


# --- watermarks ---------------------------------------------------------------


def load_marks(path: Path) -> dict[str, int]:
    """``{api_key: epoch_ms}``; empty on a missing or unreadable file."""
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return {k: int(v) for k, v in data.items()} if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_marks(path: Path, marks: dict[str, int]) -> None:
    """Atomic replace, so a crash mid-write leaves the previous file intact."""
    tmp = path.with_suffix(".json.tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(marks, fh)
        os.replace(tmp, path)
    except OSError:
        log.exception("could not persist watermarks to %s", path)


# --- builders (pure) ------------------------------------------------------------


def partition_income(rows: Iterable[dict], close_since_ms: int, fee_since_ms: int) -> IncomeParts:
    """Split income rows by type, each against ITS flow's watermark.

    The two flows watch different instants: a close is dated by its REALIZED_PNL
    row, a receipt by its own charge time. Everything else on the statement
    (TRANSFER, INSURANCE_CLEAR, ...) is somebody else's poller.
    """
    close_symbols: set[str] = set()
    fee_symbols: set[str] = set()
    funding: list[dict] = []

    for row in rows:
        if not isinstance(row, dict):
            continue
        kind = (row.get("incomeType") or "").upper()
        try:
            at = int(row.get("time") or 0)
        except (TypeError, ValueError):
            continue
        symbol = (row.get("symbol") or "").upper()

        if kind == INCOME_REALIZED_PNL:
            if symbol and at > close_since_ms:
                close_symbols.add(symbol)
        elif kind == INCOME_COMMISSION:
            if symbol and at > fee_since_ms:
                fee_symbols.add(symbol)
        elif kind == INCOME_FUNDING_FEE:
            if at > fee_since_ms:
                funding.append(row)

    return IncomeParts(close_symbols, fee_symbols, funding)


def fill_receipts(
    trades: Iterable[dict], symbol: str, account: dict, since_ms: int, cutoff_ms: int
) -> list[dict]:
    """userTrades fills → receipt rows, one per fill.

    ``since_ms`` is the fee watermark; fills older than it minus the overlap are
    already on the ledger. Fills younger than ``cutoff_ms`` are deferred (same
    indexing lag as closes — Binance may still be adding fills to the order)
    and the caller's watermark must not pass them.
    """
    receipts: list[dict] = []
    floor = since_ms - FEE_OVERLAP_MS
    for fill in trades:
        if not isinstance(fill, dict):
            continue
        try:
            at = int(fill["time"])
            ref = int(fill["id"])
            order_id = int(fill["orderId"])
            qty = float(fill.get("qty") or 0)
            price = float(fill.get("price") or 0)
            commission = float(fill.get("commission") or 0)
            realized = float(fill.get("realizedPnl") or 0)
        except (KeyError, TypeError, ValueError):
            log.warning("[fees] skipping malformed fill on %s: %r", symbol, fill)
            continue
        if at <= floor or at > cutoff_ms:
            continue
        receipts.append({
            "api_key": account["api_key"],
            "uni_id": account.get("uni_id"),
            "symbol": symbol.upper(),
            "kind": "fill",
            "ref": ref,
            "order_id": order_id,
            "side": (fill.get("side") or "").upper(),
            "position_side": (fill.get("positionSide") or "BOTH").upper(),
            "qty": qty,
            "price": price,
            "realized_pnl": realized,
            "amount": commission,
            "asset": (fill.get("commissionAsset") or "USDT").upper(),
            "charged_at": at,
        })
    return receipts


def funding_receipts(
    income_rows: Iterable[dict], account: dict, since_ms: int, cutoff_ms: int
) -> list[dict]:
    """FUNDING_FEE income rows → receipt rows. Sign flipped: Binance reports what
    the account received (negative = paid); the ledger records cost."""
    receipts: list[dict] = []
    floor = since_ms - FEE_OVERLAP_MS
    for row in income_rows:
        if not isinstance(row, dict):
            continue
        try:
            at = int(row["time"])
            ref = int(row["tranId"])
            income = float(row.get("income") or 0)
        except (KeyError, TypeError, ValueError):
            log.warning("[fees] skipping malformed funding row: %r", row)
            continue
        if at <= floor or at > cutoff_ms:
            continue
        symbol = (row.get("symbol") or "").upper()
        if not symbol:
            continue
        receipts.append({
            "api_key": account["api_key"],
            "uni_id": account.get("uni_id"),
            "symbol": symbol,
            "kind": "funding",
            "ref": ref,
            "order_id": None,
            "side": None,
            "position_side": None,
            "qty": None,
            "price": None,
            "realized_pnl": None,
            "amount": -income,
            "asset": (row.get("asset") or "USDT").upper(),
            "charged_at": at,
        })
    return receipts


def newest_charge(receipts: Iterable[dict], floor: int) -> int:
    """The watermark a batch of accepted receipts earns: its newest charge time."""
    mark = floor
    for r in receipts:
        try:
            mark = max(mark, int(r["charged_at"]))
        except (KeyError, TypeError, ValueError):
            continue
    return mark


def user_trades_start(close_since_ms: int, fee_since_ms: int, now_ms: int) -> int:
    """Where one userTrades fetch must start to serve BOTH flows, clamped to
    what Binance will answer. The fee flow reaches back an overlap past its
    mark; the closes flow starts exactly at its own."""
    wanted = min(close_since_ms, fee_since_ms - FEE_OVERLAP_MS)
    return max(wanted, now_ms - USER_TRADES_MAX_AGE_MS)
