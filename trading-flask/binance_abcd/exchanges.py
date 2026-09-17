"""The exchange registry: which venues this process trades, and how to build a
signed client for an account on each.

One place answers every "which exchange" question the core asks —
``client_for(account)`` hands back an ExchangeClient, ``tradeable(account)``
says whether the row may be traded at all, ``label()`` names the venue on a
Telegram line, ``spec().assets_broker`` is the ``assets.broker`` value its asset
rows carry. The raw client classes are module attributes on purpose: tests
patch ``exchanges.BinanceAPI`` / ``exchanges.MexcFuturesAPI`` once instead of
every module that used to construct one.

An account dict carries ``exchange`` (stamped by accounts_api from the route
it was loaded from). A dict without it is a Binance account — every fixture
and every payload from before MEXC existed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from binance_abcd import hooks
from binance_abcd.binance_adapter import BinanceAdapter
from binance_abcd.binance_api import BinanceAPI
from binance_abcd.exchange_api import ExchangeClient
from binance_abcd.mexc_adapter import MexcAdapter
from binance_abcd.mexc_api import MexcFuturesAPI


@dataclass(frozen=True)
class ExchangeSpec:
    name: str           # route segment: /engine/{name}/...
    label: str          # what a person reads (Telegram, logs)
    assets_broker: str  # `assets.broker` value for this venue's asset rows


SPECS: dict[str, ExchangeSpec] = {
    "binance": ExchangeSpec("binance", "Binance", "Binance"),
    "mexc": ExchangeSpec("mexc", "MEXC", "MEXC"),
}


def enabled() -> tuple[str, ...]:
    """Exchanges this process trades and polls, in config order. Read at call
    time (not import time) so a test can flip hooks.EXCHANGES."""
    return tuple(hooks.EXCHANGES)


def spec(name: str) -> ExchangeSpec:
    try:
        return SPECS[name.lower()]
    except KeyError:
        raise ValueError(f"unknown exchange '{name}'") from None


def label(name: str) -> str:
    return spec(name).label


def labels(names) -> str:
    """'Binance + MEXC' — the header label when several venues filled."""
    return " + ".join(label(n) for n in names) or label(hooks.ENGINE_EXCHANGE)


def exchange_of(account: dict) -> str:
    return str(account.get("exchange") or hooks.ENGINE_EXCHANGE).lower()


def base_url_for(account: dict) -> str:
    """Mainnet, or the venue's futures testnet for demo accounts. Both venues
    have one: demo=1 is the ONLY thing that picks the host, so the flag is
    never a display preference (see the connect wizard's mode step)."""
    demo = bool(account.get("demo"))
    if exchange_of(account) == "mexc":
        return hooks.MEXC_TESTNET_API_BASE if demo else hooks.MEXC_API_BASE
    return hooks.BINANCE_TESTNET_API_BASE if demo else hooks.BINANCE_API_BASE


def tradeable(account: dict) -> Optional[str]:
    """None when the account may be traded and polled; else the skip reason.

    A gate that applies to EXITS too (unlike every other gate, which is
    entry-only) — reserved for a row that can never be traded on its venue at
    all, where there is no position the always-closable rule protects. No
    venue needs it today: MEXC's demo rows route to its testnet since
    2026-09-17. Kept as the one place such a rule would live.
    """
    return None


def client_for(account: dict) -> ExchangeClient:
    """A signed client for one account, on that account's exchange."""
    exchange = exchange_of(account)
    if exchange == "binance":
        return BinanceAdapter(BinanceAPI(account["api_key"], account["secret_key"], base_url=base_url_for(account)))
    if exchange == "mexc":
        return MexcAdapter(MexcFuturesAPI(account["api_key"], account["secret_key"], base_url=base_url_for(account)))
    raise ValueError(f"unknown exchange '{exchange}' on account {account.get('name') or account.get('api_key', '')[:8]}")
