"""The one surface the trade path and the pollers need from an exchange.

Every exchange-specific thing — signing, endpoint paths, field names, units
(MEXC sizes in contracts, Binance in coins), error codes — lives behind a
class implementing this protocol (``binance_adapter.BinanceAdapter``,
``mexc_adapter.MexcAdapter``). The core (``trading_handler``, the webhook
fan-out, the pollers) talks to it in ONE vocabulary:

* symbols are TICKERS (``BTCUSDT``); the adapter maps to the venue's own form
* sizes are COINS, signed the Binance way (SHORT negative) where a sign exists
* a failed READ is ``None`` and an empty answer is ``[]`` / ``{}`` — never the
  same value, because a full-replace sync fed "flat" for "unreadable" deletes
  live positions (see fetch_positions)
* an order result is a dict; failure is ``{_error: True, ...}`` with the
  ``transient`` / ``rate_limited`` verdicts the retry logic acts on, success
  carries ``orderId`` and (when the venue reports one) ``avgPrice``

The exit retry loop, the stack cap, the deposit gate and the Telegram
publishing therefore exist exactly once, and adding an exchange is one
adapter plus its tests.
"""

from __future__ import annotations

from typing import Any, Optional, Protocol

from binance_abcd.hooks import POSITION_MODE


def want_hedge() -> bool:
    """The engine's position mode — hedge (dual-side) unless configured one-way.
    Verified per account at startup and cached (see trading_handler)."""
    return POSITION_MODE in ("hedge", "dual", "long_short")


def mode_key(api: "ExchangeClient") -> str:
    """Key for the position-mode verified cache: api keys are distinct strings
    across exchanges in practice, but namespacing costs nothing and makes a
    collision impossible."""
    return f"{api.exchange}:{api.api_key}"


def failure(
    message: str,
    *,
    code: Optional[int] = None,
    response: str = "",
    http_status: Optional[int] = None,
    rate_limited: bool = False,
    transient: bool = False,
    **extra: Any,
) -> dict:
    """The failure dict every adapter returns from an order call.

    ``transient`` marks a request that failed ON THE WAY (timeout, 5xx, the
    venue's "execution status unknown") — the only kind worth re-attempting.
    ``rate_limited`` sends an entry to the retry queue (it failed fast, before
    any order). ``code`` is the venue's own business code when it sent one.
    """
    result: dict = {
        "_error": True,
        "message": message,
        "response": response,
        "http_status": http_status,
        "rate_limited": bool(rate_limited),
        "transient": bool(transient),
    }
    if code is not None:
        result["code"] = code
    result.update(extra)
    return result


def is_failure(result: Any) -> bool:
    return result is None or (isinstance(result, dict) and bool(result.get("_error")))


class ExchangeClient(Protocol):
    """One account's signed client, in the core's vocabulary (see module docs)."""

    exchange: str
    # False: set_leverage() POSTs to the venue (Binance). True: it only
    # remembers the value and place_market_entry sends it on the order (MEXC).
    LEVERAGE_PER_ORDER: bool

    @property
    def api_key(self) -> str: ...

    @property
    def base_url(self) -> str: ...

    def ticker_to_symbol(self, ticker: str) -> str:
        """``BTCUSDT`` -> the venue's own symbol (``BTCUSDT`` / ``BTC_USDT``)."""
        ...

    def ensure_position_mode_matches(self, want_hedge: bool) -> tuple[bool, Optional[str]]:
        """(True, None) when the account is in the engine's mode; (False, why) otherwise."""
        ...

    def position_map(self, ticker: str) -> Optional[dict[str, tuple[float, Optional[float]]]]:
        """{"LONG"|"SHORT"|"BOTH": (signed_coins, entry_price)} for one ticker.
        None = the read FAILED; {} = genuinely flat."""
        ...

    def open_amount(self, ticker: str, position_side: str) -> Optional[float]:
        """abs(open coins) on that side — the stack-cap fallback when the
        engine API is down. None = read failed; 0.0 = flat."""
        ...

    def set_leverage(self, ticker: str, leverage: int) -> Optional[dict]:
        """Failure dict on error; anything else is success."""
        ...

    def place_market_entry(self, ticker: str, side: str, coins: float) -> dict:
        """Market BUY/SELL opening or stacking a position."""
        ...

    def place_market_exit(self, ticker: str, position_side: str, coins: float) -> dict:
        """Market close of `coins` on one side (reduce-only in effect)."""
        ...

    def fill_summary_once(self, ticker: str, order_id: int) -> Optional[tuple[Optional[float], Optional[float]]]:
        """(realized_pnl, exit_price) across the order's fills, ONE attempt.
        None when the venue has not indexed the fills yet or the read failed —
        trading_handler.get_order_fill_summary owns the retrying."""
        ...

    def account_balance(self) -> Optional[tuple[float, float]]:
        """(wallet_balance, unrealized_pnl) in USDT; None on a failed read."""
        ...

    def trade_permission(self) -> Optional[bool]:
        """Does the venue say these credentials may TRADE futures?

        True / False when the venue answers, None when it cannot be determined
        — and None must leave whatever verdict is standing alone. Exists
        because reading and trading are separate permissions: a key with
        Reading only returns a live balance and refuses every order, which
        looks like a healthy account that never trades.
        """
        ...

    def open_positions_rows(self) -> Optional[list[dict]]:
        """Every open position as a positions/sync row (see fetch_positions);
        None on a failed read, [] when flat."""
        ...

    def transfers_since(self, since_ms: int) -> Optional[list[dict]]:
        """Deposits/withdrawals since `since_ms` as transactions rows (without
        api_key/uni_id — the poller adds those); None on a failed read."""
        ...
