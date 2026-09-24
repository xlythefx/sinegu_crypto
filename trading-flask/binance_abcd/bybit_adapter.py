"""Bybit USDT perpetuals behind the ExchangeClient protocol.

Everything the core asks for is answered in its own vocabulary — tickers,
coins, LONG/SHORT, Binance-style signed sizes — and every Bybit particular is
absorbed here:

* **Coins already, but a grid to land on.** Linear perps are quoted in base
  coins, so there is no MEXC-style contract conversion; what there IS is
  ``qtyStep`` / ``minOrderQty`` (``BybitFuturesAPI.round_qty``), floored on an
  entry and rounded half-even on an exit.
* **Leverage is POSTed**, Binance-style (``LEVERAGE_PER_ORDER = False``), with
  "leverage not modified" treated as success by the client. No signal ->
  account -> env ladder, no reuse of an existing position's leverage: that is
  MEXC's problem, not Bybit's.
* **Direction is `side` + `positionIdx`, and the idx is READ, never assumed.**
  Bybit rows carry an unsigned ``size`` plus Title-case ``Buy``/``Sell``, so
  the sign is derived here. ``positionIdx`` (0 one-way, 1 hedge long, 2 hedge
  short) is remembered from whatever the account's own rows show, because a
  positionIdx that disagrees with the account's mode is rejected on every
  order — and we cannot know that mode from config.
* **position_map keys on LONG/SHORT even in one-way mode.** A one-way
  ``side: "Buy"`` row is unambiguously a long, so the core's hedge branch
  (``risk.get("LONG")``) keeps working whether or not this account trades
  hedged. Keying on "BOTH" instead would make every exit read "no position to
  close" on a one-way account — positions would open and never close.
* **The position read is memoised per adapter** (= per account per job): the
  exit path reads positions to know what to close, and the raw row it saw is
  what the close order is built from (exact ``size``, matching
  ``positionIdx``), so a whole-position close never becomes a partial one
  through float dust.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from binance_abcd.bybit_api import (
    MODE_HEDGE,
    MODE_ONE_WAY,
    ORDER_STATUSES_DEAD,
    POSITION_IDX_HEDGE_LONG,
    POSITION_IDX_HEDGE_SHORT,
    POSITION_IDX_ONE_WAY,
    SIDE_BUY,
    SIDE_SELL,
    BybitFuturesAPI,
    num,
    to_symbol,
)
from binance_abcd.exchange_api import failure, is_failure
from binance_abcd.hooks import BYBIT_DEMO_API_BASE

log = logging.getLogger(__name__)

# Whether Bybit's `closedPnl` already has the trading fees taken out.
#
# This repo posts realized_pnl on the GROSS basis — the API's TradingFee nets
# it exactly once on ingest, and the fee receipts later rebase it — so posting
# a netted figure nets it TWICE and every downstream figure (dashboard,
# analytics, track record, the Telegram exit percentage) is wrong by a
# commission.
#
# BEST READING OF THE DOCS, NOT YET VERIFIED LIVE: Bybit's Closed P&L is net of
# openFee + closeFee. Three things point that way — the field carries the UI's
# name and the UI shows P&L after fees; the closed-pnl row reports `openFee`
# and `closeFee` beside it (no venue reports a fee next to a P&L that excludes
# it); and the docs' own example has a price move worth +0.125 against a
# `closedPnl` of -0.00049995, a sign only fees can flip.
#
# SETTLED BY the demo round trip in bybit_smoke.py — see closed_gross_pnl,
# which is built so that a wrong value here degrades to a fallback rather than
# to wrong money.
CLOSED_PNL_IS_NET = True

# ...and whether it ALSO nets funding accrued while the position was held.
# Confidence here is LOW and the consequence is real: if this turns out True,
# the one-line switch is not enough, because a closed-pnl row carries no
# funding figure to add back. The repair would live in fetch_bybit_history
# (sum the symbol's execType=Funding executions between open and close), which
# is why the smoke test measures it before any of that is written.
CLOSED_PNL_NETS_FUNDING = False

# "Reduce-only rule not satisfied" — the position moved under us (a manual
# close, or an earlier unconfirmed close that landed). Marked transient so
# handle_exit RE-READS before deciding: a flat re-read becomes "no position to
# close", not a red MANUAL ACTION alert for a position that is already closed.
_CODES_NOTHING_TO_CLOSE = frozenset({110017})

# Sentinel for `self._idx`: this symbol's legs came back hedge-numbered, so an
# order must carry 1 or 2 depending on its side. Not a real positionIdx.
_IDX_HEDGE = -1


def _side_to_position_side(side: Any) -> Optional[str]:
    """Bybit's Title-case Buy/Sell -> the core's LONG/SHORT."""
    text = str(side or "")
    if text == SIDE_BUY:
        return "LONG"
    if text == SIDE_SELL:
        return "SHORT"
    return None


def closed_gross_pnl(row: dict) -> Optional[float]:
    """A closed-pnl row's realized P&L on the GROSS basis the API expects.

    PREFERS the value fields: ``cumExitValue - cumEntryValue`` is gross BY
    DEFINITION (they are traded values, not P&L), so it needs neither the
    switch above nor a fee field, and a wrong CLOSED_PNL_IS_NET cannot corrupt
    it. ``closedPnl`` adjusted by the switch is the fallback for a row where
    the values are missing or zero.
    """
    entry_value = num(row.get("cumEntryValue"))
    exit_value = num(row.get("cumExitValue"))
    pnl = num(row.get("closedPnl"))
    fees = (num(row.get("openFee")) or 0.0) + (num(row.get("closeFee")) or 0.0)

    if entry_value and exit_value and entry_value > 0 and exit_value > 0:
        # `side` on a closed-pnl row is the CLOSING order's side: a Sell closed
        # a long. That reading is not settled by the docs, so it is guarded.
        gross = (exit_value - entry_value) if str(row.get("side")) == SIDE_SELL else (entry_value - exit_value)
        if pnl is not None and abs(pnl) > fees and (gross > 0) != (pnl > 0):
            # They disagree on DIRECTION and the fees are too small to have
            # flipped the sign, so our reading of `side` is wrong. Do not
            # publish a sign we cannot justify — fall through to closedPnl.
            log.error(
                "[Bybit] closed-pnl direction disagreement on %s order %s: gross=%s closedPnl=%s fees=%s "
                "— check the `side` convention, falling back to closedPnl",
                row.get("symbol"), row.get("orderId"), gross, pnl, fees,
            )
        else:
            return gross
    if pnl is None:
        return None
    return pnl + fees if CLOSED_PNL_IS_NET else pnl


def execution_gross_pnl(row: dict) -> Optional[float]:
    """An execution row's realized P&L, gross. Per-fill `closedPnl` has no value
    pair to derive from, so this one IS the switch."""
    pnl = num(row.get("closedPnl"))
    if pnl is None:
        return None
    return pnl + (num(row.get("execFee")) or 0.0) if CLOSED_PNL_IS_NET else pnl


class BybitAdapter:
    exchange = "bybit"
    LEVERAGE_PER_ORDER = False

    def __init__(self, api: BybitFuturesAPI) -> None:
        self.api = api
        self._seen: Dict[tuple[str, str], dict] = {}  # (symbol, LONG|SHORT) -> raw row
        self._idx: Dict[str, int] = {}                # symbol -> observed positionIdx base

    @property
    def api_key(self) -> str:
        return self.api.api_key

    @property
    def base_url(self) -> str:
        return self.api.base_url

    def ticker_to_symbol(self, ticker: str) -> str:
        symbol = to_symbol(ticker)
        if symbol is None:
            raise ValueError(
                f"{ticker!r} is not a USDT-quoted ticker — Bybit's linear category also lists "
                "USDC symbols, and BTCUSD is an INVERSE contract, so a guess lands on the wrong one"
            )
        return symbol

    # --- position mode --------------------------------------------------------

    def _observed_mode(self, symbol: str) -> Optional[bool]:
        """True = hedge, False = one-way, None = unreadable.

        Read off the position rows' own `positionIdx`, NOT /v5/account/info:
        that endpoint's `spotHedgingStatus` is about UTA *spot* hedging and says
        nothing about derivatives position mode. (The read-only reference
        project reads a `hedgingMode` field there that the endpoint does not
        return, so its check silently never fires.)
        """
        rows = self.api.positions(symbol)
        if rows is None:
            return None
        idxs = {int(r.get("positionIdx") or 0) for r in rows if isinstance(r, dict)}
        if not idxs:
            return None
        if idxs <= {POSITION_IDX_ONE_WAY}:
            return False
        return bool(idxs & {POSITION_IDX_HEDGE_LONG, POSITION_IDX_HEDGE_SHORT})

    def ensure_position_mode_matches(self, want_hedge: bool) -> tuple[bool, Optional[str]]:
        """Same contract as the other adapters — but Bybit gets one extra
        branch, and it is deliberate.

        A Bybit UNIFIED account may not support hedge mode on `category=linear`
        at all (switch-mode documents linear hedging for classic accounts).
        Returning (False, ...) on that refusal would make trading_handler fail
        every entry AND every exit on the venue, which is strictly worse than
        trading one-way: the adapter's LONG/SHORT mapping works in either mode,
        so a one-way account trades correctly. So an unexpected refusal is
        logged loudly and accepted.
        """
        probe = "BTCUSDT"
        current = self._observed_mode(probe)
        if current is not None and current == want_hedge:
            return True, None

        rows = self.api.positions()
        has_open = None if rows is None else any(
            (num(r.get("size")) or 0.0) > 0 for r in rows if isinstance(r, dict)
        )

        if current is not None and has_open:
            return (
                False,
                "Cannot switch position mode: Bybit requires a flat account. "
                "Close every Bybit position and order, then retry.",
            )
        if current is None and has_open:
            # Unreadable mode but positions exist: cannot POST a change; proceed
            # (exits must never require a flat account).
            log.warning("[Bybit] position mode unreadable with open positions — proceeding")
            return True, None

        result = self.api.switch_mode(MODE_HEDGE if want_hedge else MODE_ONE_WAY)
        if is_failure(result):
            log.warning(
                "[Bybit] could not set %s mode (%s %s) — trading this account in whatever mode "
                "it is already in; positionIdx is read from its own rows, so both work",
                "hedge" if want_hedge else "one-way", result.get("code"), result.get("message"),
            )
            return True, None
        return True, None

    # --- positions ------------------------------------------------------------

    def _read_positions(self, symbol: str) -> Optional[list]:
        rows = self.api.positions(symbol)
        if rows is None:
            return None
        seen_idx: set[int] = set()
        for row in rows:
            if not isinstance(row, dict):
                continue
            idx = row.get("positionIdx")
            if idx is not None and str(idx).lstrip("-").isdigit():
                seen_idx.add(int(idx))
            side = _side_to_position_side(row.get("side"))
            if side and (num(row.get("size")) or 0.0) > 0:
                self._seen[(symbol, side)] = row
        if seen_idx:
            # Order-independent: the account is one-way only when EVERY leg it
            # returned is idx 0. Any hedge leg means hedge numbering.
            self._idx[symbol] = (
                POSITION_IDX_ONE_WAY if seen_idx <= {POSITION_IDX_ONE_WAY} else _IDX_HEDGE
            )
        return rows

    def position_map(self, ticker: str) -> Optional[Dict[str, tuple]]:
        """{LONG|SHORT: (signed_coins, entry_price)}; None on a failed read,
        {} when flat or when the ticker maps to no USDT symbol."""
        try:
            symbol = self.ticker_to_symbol(ticker)
        except ValueError:
            return {}  # no symbol, so no position — honest, and "nothing to close"
        rows = self._read_positions(symbol)
        if rows is None:
            return None
        out: Dict[str, tuple] = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            size = num(row.get("size")) or 0.0
            side = _side_to_position_side(row.get("side"))
            if side is None or size <= 0:
                continue
            entry = num(row.get("avgPrice"))
            out[side] = (size if side == "LONG" else -size, entry)
        return out

    def open_amount(self, ticker: str, position_side: str) -> Optional[float]:
        positions = self.position_map(ticker)
        if positions is None:
            return None
        amt, _ = positions.get(position_side.upper(), (0.0, None))
        return abs(amt)

    # --- trading --------------------------------------------------------------

    def _position_idx(self, symbol: str, position_side: str) -> int:
        """The idx an order on this side must carry.

        `self._idx[symbol]` is set from the account's own rows: 0 when every
        leg came back one-way, -1 (sentinel) when a hedge leg was seen. Unknown
        falls back to hedge numbering, which is what the engine asks for.
        """
        if self._idx.get(symbol) == POSITION_IDX_ONE_WAY:
            return POSITION_IDX_ONE_WAY
        return POSITION_IDX_HEDGE_LONG if position_side == "LONG" else POSITION_IDX_HEDGE_SHORT

    def set_leverage(self, ticker: str, leverage: int) -> Optional[dict]:
        try:
            symbol = self.ticker_to_symbol(ticker)
        except ValueError as exc:
            return failure(str(exc), transient=False)
        try:
            wanted = max(1, int(leverage))
        except (TypeError, ValueError):
            return None
        cap = self.api.max_leverage(symbol)
        if cap:
            wanted = min(wanted, cap)
        result = self.api.set_leverage(symbol, wanted)
        return result if is_failure(result) else None

    def _success(self, result: dict, qty: str, **extra: Any) -> dict:
        data = result.get("result") if isinstance(result.get("result"), dict) else {}
        order_id = data.get("orderId")
        return {
            # A numeric orderId is what joins a close to its fee receipts, and
            # the DB column is a bigint — so a non-numeric one is surfaced as
            # None rather than mangled into a wrong join.
            "orderId": int(order_id) if str(order_id or "").isdigit() else None,
            "orderIdRaw": order_id,
            "avgPrice": None,  # /v5/order/create returns only ids; the fills say the price
            "qty": qty,
            "raw": data,
            **extra,
        }

    def place_market_entry(self, ticker: str, side: str, coins: float) -> dict:
        try:
            symbol = self.ticker_to_symbol(ticker)
        except ValueError as exc:
            return failure(str(exc), transient=False)
        qty = self.api.round_qty(symbol, coins)
        if qty is None:
            return failure(
                f"size too small (< minOrderQty/qtyStep) or symbol not trading: {coins} {ticker}",
                transient=False,
            )
        position_side = "LONG" if side.upper() == "BUY" else "SHORT"
        # Fail closed, like MEXC's entry: an order placed without knowing the
        # account's real position mode carries a positionIdx Bybit may reject.
        if self._read_positions(symbol) is None:
            return failure("could not read positions before entry", transient=True)
        result = self.api.create_order(
            symbol,
            SIDE_BUY if position_side == "LONG" else SIDE_SELL,
            qty,
            position_idx=self._position_idx(symbol, position_side),
        )
        if is_failure(result):
            return result
        return self._success(result, qty)

    def place_market_exit(self, ticker: str, position_side: str, coins: float) -> dict:
        try:
            symbol = self.ticker_to_symbol(ticker)
        except ValueError as exc:
            return failure(str(exc), transient=False)
        side = position_side.upper()
        row = self._seen.get((symbol, side))
        if row is None:
            if self._read_positions(symbol) is None:
                return failure("could not read positions before close", transient=True)
            row = self._seen.get((symbol, side))
            if row is None:
                return failure(
                    f"no open {side.lower()} position on {symbol}", code=110017, transient=False
                )

        held = num(row.get("size")) or 0.0
        if held > 0 and abs(coins - held) < 1e-9:
            # The whole position, exactly as Bybit holds it — never a coin
            # figure that float arithmetic has shaved a step off.
            qty: Optional[str] = str(row.get("size"))
        else:
            qty = self.api.round_qty(symbol, coins, closing=True)
        if qty is None:
            return failure(
                f"close size {coins} {ticker} does not map to a tradable quantity", transient=False
            )

        idx = row.get("positionIdx")
        result = self.api.create_order(
            symbol,
            SIDE_SELL if side == "LONG" else SIDE_BUY,
            qty,
            position_idx=int(idx) if idx is not None else self._position_idx(symbol, side),
            reduce_only=True,
        )
        if is_failure(result):
            if result.get("code") in _CODES_NOTHING_TO_CLOSE:
                result["transient"] = True
            return result
        return self._success(result, qty)

    def fill_summary_once(self, ticker: str, order_id: int) -> Optional[tuple[Optional[float], Optional[float]]]:
        """(Σ realized, qty-weighted price) over the order's executions, ONE
        attempt. None while Bybit has not indexed them (the caller retries);
        (None, None) once the order is known dead, which STOPS the retrying.

        That dead-order branch matters more here than on the other venues: a
        Bybit market order is converted to an IOC limit inside a slippage band,
        so it can legitimately end Cancelled having filled nothing. Without
        this it would burn the whole retry budget and then publish a close with
        no PnL line.
        """
        try:
            symbol = self.ticker_to_symbol(ticker)
        except ValueError:
            return None, None
        rows, _complete = self.api.executions(symbol=symbol, order_id=str(order_id), max_pages=2)
        if rows is None:
            return None
        if not rows:
            order = self.api.order(str(order_id), symbol)
            if order and str(order.get("orderStatus")) in ORDER_STATUSES_DEAD:
                return None, None
            return None
        pnl = 0.0
        notional = 0.0
        qty = 0.0
        saw_pnl = False
        for row in rows:
            if not isinstance(row, dict):
                continue
            price = num(row.get("execPrice")) or 0.0
            filled = num(row.get("execQty")) or 0.0
            notional += price * filled
            qty += filled
            realized = execution_gross_pnl(row)
            if realized is not None:
                pnl += realized
                saw_pnl = True
        exit_price = (notional / qty) if qty > 0 else None
        return (pnl if saw_pnl else None), exit_price

    # --- pollers --------------------------------------------------------------

    def account_balance(self) -> Optional[tuple[float, float]]:
        """(wallet_balance, unrealized_pnl) in USDT.

        Bybit reports both directly, so this needs no arithmetic — unlike MEXC,
        which reports equity and has to subtract. Falls back to the USDT coin
        row when the account-level totals come back as empty strings (which
        they do under portfolio margin).
        """
        row = self.api.wallet_balance()
        if not row:
            return None
        wallet = num(row.get("totalWalletBalance"))
        unrealized = num(row.get("totalPerpUPL"))
        if wallet is None or unrealized is None:
            for coin in row.get("coin") or []:
                if isinstance(coin, dict) and str(coin.get("coin")).upper() == "USDT":
                    wallet = num(coin.get("walletBalance")) if wallet is None else wallet
                    unrealized = num(coin.get("unrealisedPnl")) if unrealized is None else unrealized
                    break
        if wallet is None:
            return None
        return wallet, (unrealized or 0.0)

    def trade_permission(self) -> Optional[bool]:
        """Bybit states it outright, like Binance and unlike MEXC: the key's own
        permissions block. None on the demo host, which does not serve
        /v5/user/query-api — and None always leaves the standing verdict alone.
        """
        if self.base_url == BYBIT_DEMO_API_BASE or "demo" in self.base_url or "testnet" in self.base_url:
            return None
        flags = self.api.query_api()
        if not isinstance(flags, dict):
            return None

        # Free diagnostics off a response already in hand. Neither ever flags
        # the key — this is the one venue that warns BEFORE a key dies.
        deadline = num(flags.get("deadlineDay"))
        if deadline is not None and deadline <= 7:
            log.warning("[Bybit] key %s… expires in %s days", self.api_key[:6], int(deadline))
        if flags.get("ips") in ([], ["*"]):
            log.warning("[Bybit] key %s… has no IP bound — it will expire 90 days after creation",
                        self.api_key[:6])

        if flags.get("readOnly") in (1, "1", True):
            return False
        perms = flags.get("permissions")
        if not isinstance(perms, dict):
            return None
        contract = set(perms.get("ContractTrade") or [])
        derivatives = set(perms.get("Derivatives") or [])
        if contract & {"Order", "Position"} or "DerivativesTrade" in derivatives:
            return True
        # A permissions block we understood, carrying no trade grant, is a real
        # False. An empty one is a shape we do not recognise — never guess.
        return False if perms else None

    def open_positions_rows(self) -> Optional[list[dict]]:
        rows = self.api.positions()
        if rows is None:
            return None
        out = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            size = num(row.get("size")) or 0.0
            side = _side_to_position_side(row.get("side"))
            if side is None or size <= 0:
                continue
            # Everything below is a field ON the row — no second call, unlike
            # MEXC where mark price and notional have to be fetched and derived.
            margin = num(row.get("positionIM"))
            out.append({
                "symbol": str(row.get("symbol") or "").upper(),
                "position_side": side,
                "position_amt": size if side == "LONG" else -size,
                "update_time": int(row["updatedTime"]) if str(row.get("updatedTime") or "").isdigit() else None,
                "entry_price": num(row.get("avgPrice")),
                "mark_price": num(row.get("markPrice")),
                "unrealized_profit": num(row.get("unrealisedPnl")),
                "notional": num(row.get("positionValue")),
                "initial_margin": margin,
                "maint_margin": num(row.get("positionMM")),
                "isolated_margin": margin if str(row.get("tradeMode")) == "1" else None,
                "isolated_wallet": None,
            })
        return out

    def transfers_since(self, since_ms: int) -> Optional[list[dict]]:
        """Capital in and out of the UNIFIED wallet the engine trades from.

        Read from the account's own ledger (`/v5/account/transaction-log`,
        types TRANSFER_IN / TRANSFER_OUT) rather than from `/v5/asset/*`:
          - deposit/withdraw records are movements into the Bybit ACCOUNT, not
            into the traded wallet, so a customer whose funds sit in the Funding
            wallet would count as funded and trade against a zero balance;
          - the inter-transfer list misses a deposit credited straight to
            UNIFIED, infers direction from account-type pairs, and is not
            available on the demo host at all.

        None (never []) when the first read fails: `fetch_transfers` retries an
        unknown, but an empty list ASSERTS that no money moved — and a missed
        deposit reads as profit, which invoices the customer 20% of their own
        capital.
        """
        rows: list[dict] = []
        first = True
        # Bybit wants startTime and endTime together on this endpoint; sending a
        # bare start is refused, which would look like "no transfers".
        now_ms = int(time.time() * 1000)
        for kind, direction in (("TRANSFER_IN", "DEPOSIT"), ("TRANSFER_OUT", "WITHDRAWAL")):
            batch, _complete = self.api.transaction_log(kind=kind, start_ms=since_ms, end_ms=now_ms)
            if batch is None:
                return None if first else rows
            first = False
            for entry in batch:
                if not isinstance(entry, dict):
                    continue
                amount = num(entry.get("change"))
                if amount is None:
                    amount = num(entry.get("cashFlow"))
                tran_id = entry.get("id")
                if not amount or tran_id in (None, ""):
                    continue
                rows.append({
                    "type": direction,
                    "amount": abs(amount),
                    "tran_id": str(tran_id)[:64],
                    # Reported as-is, never filtered to USDT and never converted:
                    # dropping a non-USDT transfer would make Bybit the only
                    # venue that silently loses one, and converting would make
                    # the engine a price oracle.
                    "currency": str(entry.get("currency") or "USDT").upper(),
                    "transaction_time": int(entry["transactionTime"])
                        if str(entry.get("transactionTime") or "").isdigit() else None,
                    "balance_after": num(entry.get("cashBalance")),
                    "info": None,
                })
        return rows
