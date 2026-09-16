"""Binance USDⓈ-M futures behind the ExchangeClient protocol.

A thin layer over the untouched ``BinanceAPI``: it owns the Binance FIELD
NAMES (``positionAmt``, ``positionSide``, ``entryPrice``, ``avgPrice``,
``realizedPnl``, ``totalWalletBalance``, ``tranId`` …) that used to be parsed
in trading_handler, the webhook and three pollers, so those modules can be
written once for every exchange. Nothing here changes what is sent to Binance
or how a result is judged — the bodies moved, the behaviour did not.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from binance_abcd.binance_api import (
    BinanceAPI,
    invalidate_position_mode,
    mark_position_mode_verified,
)
from binance_abcd.exchange_api import mode_key, want_hedge
from binance_abcd.hooks import POSITION_MODE

log = logging.getLogger(__name__)

# positions/sync row column -> Binance positionRisk field.
_POSITION_FIELDS = {
    "entry_price": "entryPrice",
    "mark_price": "markPrice",
    "unrealized_profit": "unRealizedProfit",
    "notional": "notional",
    "initial_margin": "initialMargin",
    "maint_margin": "maintMargin",
    "isolated_margin": "isolatedMargin",
    "isolated_wallet": "isolatedWallet",
}


def position_row(position: dict) -> Optional[dict]:
    """One positionRisk entry -> positions/sync row (None when flat or unparsable)."""
    try:
        amt = float(position.get("positionAmt") or 0)
    except (TypeError, ValueError):
        return None
    if amt == 0:
        return None
    row = {
        "symbol": (position.get("symbol") or "").upper(),
        "position_side": (position.get("positionSide") or "BOTH").upper(),
        "position_amt": amt,
        "update_time": position.get("updateTime"),
    }
    for ours, theirs in _POSITION_FIELDS.items():
        value = position.get(theirs)
        try:
            row[ours] = float(value) if value is not None else None
        except (TypeError, ValueError):
            row[ours] = None
    return row if row["symbol"] else None


class BinanceAdapter:
    exchange = "binance"
    LEVERAGE_PER_ORDER = False

    def __init__(self, api: BinanceAPI) -> None:
        self.api = api

    @property
    def api_key(self) -> str:
        return self.api.api_key

    @property
    def base_url(self) -> str:
        return self.api.base_url

    def ticker_to_symbol(self, ticker: str) -> str:
        return ticker.upper()

    # --- position mode --------------------------------------------------------

    def ensure_position_mode_matches(self, want_hedge: bool) -> tuple[bool, Optional[str]]:
        return self.api.ensure_position_mode_matches(want_hedge)

    # --- positions ------------------------------------------------------------

    def position_map(self, ticker: str) -> Optional[Dict[str, tuple]]:
        """One GET /fapi/v3/positionRisk -> {positionSide: (signed_amt, entry_price)}.
        None on read failure, {} when flat."""
        sym = ticker.upper()
        try:
            risk = self.api.get_positions_v3(sym)
        except Exception as exc:  # noqa: BLE001
            log.warning("[Binance] positionRisk read failed for %s: %s", sym, exc)
            return None
        if risk is None:
            return None
        out: Dict[str, tuple] = {}
        for p in risk:
            if (p.get("symbol") or "").upper() != sym:
                continue
            try:
                amt = float(p.get("positionAmt") or 0)
            except (TypeError, ValueError):
                amt = 0.0
            if amt == 0:
                continue
            side = (p.get("positionSide") or "BOTH").upper()
            try:
                entry = float(p["entryPrice"]) if p.get("entryPrice") is not None else None
            except (TypeError, ValueError):
                entry = None
            out[side] = (amt, entry)
        return out

    def open_amount(self, ticker: str, position_side: str) -> Optional[float]:
        """The side's open size, read from Binance — the stack-cap fallback.

        None means the read FAILED, 0.0 means the side is genuinely flat. The
        stack cap is enforced off this number, so answering 0.0 for an account
        we could not read is precisely how a cap stops firing without anyone
        noticing.
        """
        try:
            positions = self.api.get_positions_v3(ticker.upper())
        except Exception:  # noqa: BLE001
            return None
        if positions is None:
            return None
        for p in positions:
            if (p.get("positionSide") or "BOTH").upper() == position_side:
                try:
                    return abs(float(p.get("positionAmt") or 0))
                except (TypeError, ValueError):
                    return None
        return 0.0

    # --- trading --------------------------------------------------------------

    def set_leverage(self, ticker: str, leverage: int) -> Optional[dict]:
        return self.api.set_leverage(ticker.upper(), leverage)

    def _place_market_order_retry(
        self, symbol: str, side: str, quantity: float, *, reduce_only: bool = False
    ) -> Optional[Dict[str, Any]]:
        """place_market_order; on -4061 re-sync hedge mode once and retry."""
        result = self.api.place_market_order(symbol, side, quantity, reduce_only=reduce_only, position_mode=POSITION_MODE)
        if isinstance(result, dict) and result.get("_error"):
            response = str(result.get("response", ""))
            if "-4061" in response and want_hedge():
                log.warning("[Binance] -4061 on order — re-syncing hedge mode and retrying once")
                invalidate_position_mode(mode_key(self))
                ok, _ = self.api.ensure_position_mode_matches(True)
                if ok:
                    mark_position_mode_verified(mode_key(self))
                    result = self.api.place_market_order(
                        symbol, side, quantity, reduce_only=reduce_only, position_mode=POSITION_MODE
                    )
        return result

    def place_market_entry(self, ticker: str, side: str, coins: float) -> dict:
        result = self._place_market_order_retry(ticker.upper(), side.upper(), coins)
        return result if result is not None else {"_error": True, "message": "No response", "response": "", "transient": True}

    def place_market_exit(self, ticker: str, position_side: str, coins: float) -> dict:
        close_side = "SELL" if position_side.upper() == "LONG" else "BUY"
        result = self._place_market_order_retry(ticker.upper(), close_side, coins, reduce_only=True)
        return result if result is not None else {"_error": True, "message": "No response", "response": "", "transient": True}

    def fill_summary_once(self, ticker: str, order_id: int) -> Optional[tuple[Optional[float], Optional[float]]]:
        """(summed realizedPnl, qty-weighted exit price) across the order's
        userTrades. None while Binance has nothing for the order yet — its index
        trails the fill by a second or two — or when the read failed."""
        trades = self.api.get_user_trades(ticker.upper(), order_id=order_id, limit=50)
        if not trades:
            return None
        pnl = 0.0
        notional = 0.0
        qty = 0.0
        saw_pnl = False
        for trade in trades:
            try:
                price = float(trade.get("price") or 0)
                fill_qty = float(trade.get("qty") or 0)
            except (TypeError, ValueError):
                continue
            notional += price * fill_qty
            qty += fill_qty
            realized = trade.get("realizedPnl")
            if realized is not None:
                try:
                    pnl += float(realized)
                    saw_pnl = True
                except (TypeError, ValueError):
                    pass
        exit_price = (notional / qty) if qty > 0 else None
        return (pnl if saw_pnl else None), exit_price

    # --- pollers --------------------------------------------------------------

    def account_balance(self) -> Optional[tuple[float, float]]:
        acc = self.api.get_account_v3()
        if not isinstance(acc, dict):
            return None
        try:
            return float(acc.get("totalWalletBalance") or 0), float(acc.get("totalUnrealizedProfit") or 0)
        except (TypeError, ValueError):
            return None

    def open_positions_rows(self) -> Optional[list[dict]]:
        positions = self.api.get_positions_v3()
        if positions is None:
            return None
        return [row for row in (position_row(p) for p in positions) if row]

    def transfers_since(self, since_ms: int) -> Optional[list[dict]]:
        """TRANSFER income rows -> transactions rows.

        get_income_history answers [] on a failed read (its callers only ever
        insert, and the (api_key, tran_id) key makes a re-send idempotent), so
        this never returns None for Binance — a failed tick is just a tick that
        synced nothing, exactly as before.
        """
        rows = []
        for income in self.api.get_income_history(income_type="TRANSFER", start_time=since_ms):
            try:
                amount = float(income.get("income") or 0)
                tran_id = int(income.get("tranId"))
            except (TypeError, ValueError):
                continue
            if amount == 0:
                continue
            rows.append({
                "type": "DEPOSIT" if amount > 0 else "WITHDRAWAL",
                "amount": abs(amount),
                "tran_id": tran_id,
                "currency": income.get("asset") or "USDT",
                "transaction_time": income.get("time"),
                "info": (income.get("info") or "")[:64] or None,
            })
        return rows
