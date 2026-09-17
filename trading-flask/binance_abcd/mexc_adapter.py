"""MEXC USDT-M futures behind the ExchangeClient protocol.

Everything the core asks for is answered in its own vocabulary — tickers,
coins, LONG/SHORT, Binance-style signed sizes — and every MEXC particular is
absorbed here:

* **Contracts, not coins.** `holdVol` / `dealVol` / `vol` are multiplied by the
  contract's `contractSize` on every read and divided on every order
  (`MexcFuturesAPI.coins_to_vol`), so `position_amt`, the stack cap and
  `_closed_increments` mean the same thing on MEXC as on Binance.
* **Leverage travels ON the order.** MEXC requires `leverage` when opening and
  rejects one that differs from an existing same-side position's (7004), so
  `set_leverage` only remembers the signal's value and `place_market_entry`
  sends it — or, when stacking, reuses the position's own leverage, openType
  and positionId. Priority for a fresh position: the signal, then the
  account's own setting for the contract, then MEXC_DEFAULT_LEVERAGE; with
  none of those the entry is refused rather than guessed.
* **Hedge mode by position TYPE.** LONG is positionType 1, SHORT is 2; the
  close of a LONG is side 4, of a SHORT side 2. No `reduceOnly` (one-way only
  on MEXC) — the side code already says "close".
* **The position read is memoised per adapter** (= per account per job): the
  exit path reads positions to know what to close, and the raw row it saw is
  what the close order is built from (positionId, openType, exact holdVol), so
  a whole-position close never becomes a partial one through float dust.
"""

from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional

from binance_abcd.binance_api import (
    error_summary,
    invalidate_position_mode,
    mark_position_mode_verified,
)
from binance_abcd.exchange_api import failure, is_failure, mode_key, want_hedge
from binance_abcd.hooks import MEXC_DEFAULT_LEVERAGE, MEXC_OPEN_TYPE
from binance_abcd.mexc_api import (
    MODE_HEDGE,
    MODE_ONE_WAY,
    ORDER_STATES_DEAD,
    POSITION_LONG,
    POSITION_SHORT,
    SIDE_CLOSE_LONG,
    SIDE_CLOSE_SHORT,
    SIDE_OPEN_LONG,
    SIDE_OPEN_SHORT,
    MexcFuturesAPI,
    to_contract_symbol,
    to_ticker,
)

log = logging.getLogger(__name__)

# Whether a deal's `profit` already has its `fee` taken out. VERIFIED GROSS on
# 2026-09-17 (futures testnet, real key): a 0.01 BTC LONG opened 76,427.3 and
# closed 76,419.4 reported profit -0.079 = (exit - entry) x qty exactly, with
# fee 0.1528 on a separate field — the same basis Binance's realizedPnl has,
# which TradingFee then nets on ingest (net -0.3847 matched the account
# balance to the cent). Kept as a switch only so a venue change is one line.
DEAL_PROFIT_IS_NET = False

# Position-mode code the engine wants MEXC accounts in.
_CODE_POSITION_MODE_MISMATCH = 7002
# "Insufficient closable" / "Position nonexistent or closed" / "closing amount
# insufficient" — the position moved under us; worth one re-read, not an alert.
_CODES_NOTHING_TO_CLOSE = frozenset({2008, 2009, 7005})


def _num(value: Any) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _int(value: Any) -> Optional[int]:
    try:
        return int(str(value)) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def deal_pnl(deal: dict) -> Optional[float]:
    """A deal's realized P&L on the gross basis the API expects."""
    profit = _num(deal.get("profit"))
    if profit is None:
        return None
    if DEAL_PROFIT_IS_NET:
        profit += _num(deal.get("fee")) or 0.0
    return profit


class MexcAdapter:
    exchange = "mexc"
    LEVERAGE_PER_ORDER = True

    def __init__(self, api: MexcFuturesAPI) -> None:
        self.api = api
        self._leverage: Dict[str, int] = {}                 # symbol -> leverage memo (from the signal)
        self._seen: Dict[tuple[str, int], dict] = {}        # (symbol, positionType) -> raw row

    @property
    def api_key(self) -> str:
        return self.api.api_key

    @property
    def base_url(self) -> str:
        return self.api.base_url

    def ticker_to_symbol(self, ticker: str) -> str:
        symbol = to_contract_symbol(ticker)
        if symbol is None:
            raise ValueError(f"{ticker!r} is not a USDT-quoted ticker — no MEXC contract to map it to")
        return symbol

    # --- position mode --------------------------------------------------------

    def ensure_position_mode_matches(self, want_hedge: bool) -> tuple[bool, Optional[str]]:
        """Same contract as BinanceAPI.ensure_position_mode_matches: align the
        account's positionMode with the engine's, which MEXC only allows while
        the account is flat."""
        wanted = MODE_HEDGE if want_hedge else MODE_ONE_WAY
        current = self.api.position_mode()
        if current == wanted:
            return True, None

        positions = self.api.open_positions()
        has_open = None if positions is None else bool(positions)

        if current is not None and has_open:
            return (
                False,
                "Cannot switch position mode: MEXC requires a flat account. "
                "Close every MEXC position and order, then retry.",
            )
        if current is None and has_open:
            # Unreadable mode but positions exist: cannot POST a change; proceed
            # (exits must never require a flat account).
            log.warning("[MEXC] positionMode unreadable with open positions — proceeding")
            return True, None

        result = self.api.change_position_mode(wanted)
        if is_failure(result):
            return False, error_summary(result)
        after = self.api.position_mode()
        if after != wanted:
            return False, "Position mode still does not match after API set (check the MEXC app)."
        return True, None

    # --- positions ------------------------------------------------------------

    def _read_positions(self, symbol: str) -> Optional[list]:
        rows = self.api.open_positions(symbol)
        if rows is None:
            return None
        for row in rows:
            position_type = _int(row.get("positionType"))
            if position_type in (POSITION_LONG, POSITION_SHORT):
                self._seen[(symbol, position_type)] = row
        return rows

    def position_map(self, ticker: str) -> Optional[Dict[str, tuple]]:
        """{LONG|SHORT: (signed_coins, entry_price)}; None on a failed read (or a
        contract whose size we cannot learn — a size we cannot convert is a
        size we do not know), {} when flat."""
        try:
            symbol = self.ticker_to_symbol(ticker)
        except ValueError:
            return {}  # no contract, so no position — honest, and "nothing to close"
        size = self.api.contract_size(symbol)
        if size is None:
            return None
        rows = self._read_positions(symbol)
        if rows is None:
            return None
        out: Dict[str, tuple] = {}
        for row in rows:
            position_type = _int(row.get("positionType"))
            vol = _num(row.get("holdVol")) or 0.0
            if position_type not in (POSITION_LONG, POSITION_SHORT) or vol <= 0:
                continue
            coins = vol * size
            entry = _num(row.get("holdAvgPrice"))
            if entry is None:
                entry = _num(row.get("openAvgPrice"))
            if position_type == POSITION_LONG:
                out["LONG"] = (coins, entry)
            else:
                out["SHORT"] = (-coins, entry)
        return out

    def open_amount(self, ticker: str, position_side: str) -> Optional[float]:
        positions = self.position_map(ticker)
        if positions is None:
            return None
        amt, _ = positions.get(position_side.upper(), (0.0, None))
        return abs(amt)

    # --- trading --------------------------------------------------------------

    def set_leverage(self, ticker: str, leverage: int) -> Optional[dict]:
        """No HTTP: MEXC takes leverage on the order itself. Remembered for the
        entry about to be placed."""
        try:
            self._leverage[self.ticker_to_symbol(ticker)] = max(1, int(leverage))
        except (ValueError, TypeError):
            pass
        return None

    def _resolve_leverage(self, symbol: str, position_type: int, contract: dict) -> Optional[int]:
        """Signal -> account's own setting for the contract -> env default -> None."""
        leverage = self._leverage.get(symbol)
        if leverage is None:
            settings = self.api.leverage_settings(symbol)
            for setting in settings or []:
                if isinstance(setting, dict) and _int(setting.get("positionType")) == position_type:
                    leverage = _int(setting.get("leverage"))
                    break
        if leverage is None and MEXC_DEFAULT_LEVERAGE > 0:
            leverage = MEXC_DEFAULT_LEVERAGE
        if leverage is None:
            return None
        max_leverage = _int(contract.get("maxLeverage")) or 0
        if max_leverage > 0:
            leverage = min(leverage, max_leverage)
        return max(1, leverage)

    def _success(self, result: dict, vol: str, **extra: Any) -> dict:
        data = result.get("data") if isinstance(result.get("data"), dict) else {}
        return {"orderId": _int(data.get("orderId")), "avgPrice": None, "vol": vol, "raw": data, **extra}

    def place_market_entry(self, ticker: str, side: str, coins: float) -> dict:
        try:
            symbol = self.ticker_to_symbol(ticker)
        except ValueError as exc:
            return failure(str(exc), transient=False)
        contract = self.api.contract(symbol)
        if not contract:
            return failure(f"contract {symbol} unknown (contract/detail unavailable or not listed)", transient=True)
        vol = self.api.coins_to_vol(symbol, coins)
        if vol is None:
            return failure(
                f"size too small (< minVol) or contract not API-tradable: {coins} {ticker}", transient=False
            )

        position_type = POSITION_LONG if side.upper() == "BUY" else POSITION_SHORT
        rows = self._read_positions(symbol)
        if rows is None:
            # Fail closed, like the stack cap: an entry placed without knowing
            # the existing position's leverage/openType is one MEXC may refuse
            # (7004) or, worse, open under a different margin mode.
            return failure("could not read positions before entry", transient=True)
        existing = next((r for r in rows if _int(r.get("positionType")) == position_type), None)
        if existing is not None:
            leverage = _int(existing.get("leverage"))
            open_type = _int(existing.get("openType")) or MEXC_OPEN_TYPE
            position_id = _int(existing.get("positionId"))
        else:
            leverage = self._resolve_leverage(symbol, position_type, contract)
            open_type = MEXC_OPEN_TYPE
            position_id = None
        if leverage is None:
            return failure(
                "leverage unknown: none on the signal, no account setting for the contract, "
                "and MEXC_DEFAULT_LEVERAGE is 0", transient=False,
            )

        mode = MODE_HEDGE if want_hedge() else MODE_ONE_WAY
        order_side = SIDE_OPEN_LONG if position_type == POSITION_LONG else SIDE_OPEN_SHORT
        result = self.api.create_order(
            symbol, order_side, vol, open_type=open_type, leverage=leverage,
            position_id=position_id, position_mode=mode,
        )
        if is_failure(result) and result.get("code") == _CODE_POSITION_MODE_MISMATCH and want_hedge():
            # Mirror of Binance's -4061 path: re-sync the mode once and retry.
            log.warning("[MEXC] 7002 on order — re-syncing hedge mode and retrying once")
            invalidate_position_mode(mode_key(self))
            ok, _ = self.ensure_position_mode_matches(True)
            if ok:
                mark_position_mode_verified(mode_key(self))
                result = self.api.create_order(
                    symbol, order_side, vol, open_type=open_type, leverage=leverage,
                    position_id=position_id, position_mode=mode,
                )
        if is_failure(result):
            return result
        return self._success(result, vol, leverage=leverage)

    def place_market_exit(self, ticker: str, position_side: str, coins: float) -> dict:
        try:
            symbol = self.ticker_to_symbol(ticker)
        except ValueError as exc:
            return failure(str(exc), transient=False)
        position_type = POSITION_LONG if position_side.upper() == "LONG" else POSITION_SHORT
        row = self._seen.get((symbol, position_type))
        if row is None:
            rows = self._read_positions(symbol)
            if rows is None:
                return failure("could not read positions before close", transient=True)
            row = self._seen.get((symbol, position_type))
            if row is None:
                return failure(f"no open {position_side.lower()} position on {symbol}", code=2009, transient=False)

        size = self.api.contract_size(symbol)
        vol: Optional[str] = None
        try:
            hold_vol = Decimal(str(row.get("holdVol")))
        except (InvalidOperation, TypeError, ValueError):
            hold_vol = Decimal(0)
        if size and hold_vol > 0 and abs(coins - float(hold_vol) * size) < 1e-9:
            vol = format(hold_vol.normalize(), "f")  # the whole position, exactly as MEXC holds it
        else:
            vol = self.api.coins_to_vol(symbol, coins, closing=True)
        if vol is None:
            return failure(f"close size {coins} {ticker} does not map to a contract quantity", transient=False)

        result = self.api.create_order(
            symbol,
            SIDE_CLOSE_LONG if position_type == POSITION_LONG else SIDE_CLOSE_SHORT,
            vol,
            open_type=_int(row.get("openType")) or MEXC_OPEN_TYPE,
            position_id=_int(row.get("positionId")),
            position_mode=MODE_HEDGE if want_hedge() else MODE_ONE_WAY,
        )
        if is_failure(result):
            if result.get("code") in _CODES_NOTHING_TO_CLOSE:
                # The position we just read is not (fully) there any more — a
                # manual close, or an earlier unconfirmed close that landed.
                # Marked transient so handle_exit RE-READS before deciding:
                # a flat re-read becomes "no position to close", not a red
                # MANUAL ACTION alert for a position that is already closed.
                result["transient"] = True
            return result
        return self._success(result, vol)

    def fill_summary_once(self, ticker: str, order_id: int) -> Optional[tuple[Optional[float], Optional[float]]]:
        """(Σ profit, vol-weighted price) over the order's deals — contract size
        cancels out of the weighted price, so the fills alone are enough. None
        while MEXC has not indexed the deals (retried by the caller); (None,
        None) once the order is known dead (cancelled/invalid), which stops
        the retrying."""
        deals = self.api.deal_details(order_id)
        if deals is None:
            return None
        if not deals:
            order = self.api.get_order(order_id)
            if order and _int(order.get("state")) in ORDER_STATES_DEAD:
                return None, None
            return None
        pnl = 0.0
        notional = 0.0
        qty = 0.0
        saw_pnl = False
        for deal in deals:
            if not isinstance(deal, dict):
                continue
            price = _num(deal.get("price")) or 0.0
            vol = _num(deal.get("vol")) or 0.0
            notional += price * vol
            qty += vol
            profit = deal_pnl(deal)
            if profit is not None:
                pnl += profit
                saw_pnl = True
        exit_price = (notional / qty) if qty > 0 else None
        return (pnl if saw_pnl else None), exit_price

    # --- pollers --------------------------------------------------------------

    def account_balance(self) -> Optional[tuple[float, float]]:
        """(equity − unrealized, unrealized): the wallet-balance analog of
        Binance's totalWalletBalance, so `balance` means the same thing in
        mexc_accounts as in binance_accounts."""
        row = self.api.asset("USDT")
        if not row:
            return None
        equity = _num(row.get("equity"))
        unrealized = _num(row.get("unrealized")) or 0.0
        if equity is None:
            return None
        return equity - unrealized, unrealized

    def open_positions_rows(self) -> Optional[list[dict]]:
        rows = self.api.open_positions()
        if rows is None:
            return None
        contracts = self.api.contracts()
        if contracts is None:
            return None  # sizes unknown: a row in contracts is not a row in coins
        out = []
        for row in rows:
            symbol = str(row.get("symbol") or "").upper()
            spec = contracts.get(symbol) or {}
            size = _num(spec.get("contractSize")) or 0.0
            position_type = _int(row.get("positionType"))
            vol = _num(row.get("holdVol")) or 0.0
            if size <= 0 or position_type not in (POSITION_LONG, POSITION_SHORT) or vol <= 0:
                log.warning("[MEXC] skipping position row with unknown size/type: %.200s", row)
                continue
            coins = vol * size
            entry = _num(row.get("holdAvgPrice"))
            if entry is None:
                entry = _num(row.get("openAvgPrice"))
            fair = self.api.fair_price(symbol)
            unrealized = notional = None
            if fair is not None and entry is not None:
                unrealized = (fair - entry) * coins if position_type == POSITION_LONG else (entry - fair) * coins
                notional = coins * fair
            margin = _num(row.get("im"))
            out.append({
                "symbol": to_ticker(symbol),
                "position_side": "LONG" if position_type == POSITION_LONG else "SHORT",
                "position_amt": coins if position_type == POSITION_LONG else -coins,
                "update_time": _int(row.get("updateTime")),
                "entry_price": entry,
                "mark_price": fair,
                "unrealized_profit": unrealized,
                "notional": notional,
                "initial_margin": margin,
                "maint_margin": None,
                "isolated_margin": margin if _int(row.get("openType")) == 1 else None,
                "isolated_wallet": None,
            })
        return out

    def transfers_since(self, since_ms: int) -> Optional[list[dict]]:
        """SUCCESS transfer records newer than `since_ms`. Pages are read until a
        short page (max 5) rather than stopping at the first old record, because
        the endpoint's ordering is not documented — the backend's unique key
        absorbs anything re-sent. None only when the FIRST page fails."""
        rows: list[dict] = []
        for page in range(1, 6):
            batch = self.api.transfer_records(state="SUCCESS", page_num=page, page_size=100)
            if batch is None:
                return None if page == 1 else rows
            for transfer in batch:
                if not isinstance(transfer, dict):
                    continue
                created = _int(transfer.get("createTime")) or 0
                amount = _num(transfer.get("amount")) or 0.0
                tran_id = _int(transfer.get("id"))
                if created < since_ms or amount == 0 or tran_id is None:
                    continue
                kind = str(transfer.get("type") or "").upper()
                if kind not in ("IN", "OUT"):
                    continue
                rows.append({
                    "type": "DEPOSIT" if kind == "IN" else "WITHDRAWAL",
                    "amount": abs(amount),
                    "tran_id": tran_id,
                    "currency": (transfer.get("currency") or "USDT").upper(),
                    "transaction_time": created or None,
                    "info": (str(transfer.get("txid") or "")[:64]) or None,
                })
            if len(batch) < 100:
                break
        return rows
