"""Will a coin's sizing fit under the exchange's position limit? (2026-11-12)

On 9 Nov 2026 Binance lowered SANTOSUSDT to 10x; at that leverage it accepts
at most $10,000 of position, and anything above is refused -2027 ("Exceeded
the maximum allowable position at current leverage"). Sizes scale with each
account's balance, so a size that fits the master today can stop fitting a
customer who deposits more tomorrow. This answers, for a PROPOSED base / max
size and leverage, how big each tradeable account's FULL stack would be and
whether it fits — the admin asset form calls it before saving.

It uses the engine's own sizing (`_scale_qty`, `_increment_cap`), so the form
cannot disagree with what the next signal would trade. Read-only at the
exchange: one leverageBracket read (weight 1) and one public mark price.
"""

from __future__ import annotations

import math
from typing import Optional

from binance_abcd import hooks


def cap_at(brackets: list, leverage: Optional[int]) -> dict:
    """{max_leverage, cap_usd, leverage_allowed} for `leverage` against
    Binance's brackets. cap_usd = the largest notionalCap among brackets that
    still allow that leverage; None when the leverage is above every bracket
    (the -4028 case) or unknown."""
    rows = []
    for b in brackets or []:
        try:
            rows.append((int(b.get("initialLeverage")), float(b.get("notionalCap"))))
        except (TypeError, ValueError, AttributeError):
            continue
    if not rows:
        return {"max_leverage": None, "cap_usd": None, "leverage_allowed": None}
    max_leverage = max(lev for lev, _ in rows)
    if leverage is None:
        return {"max_leverage": max_leverage, "cap_usd": None, "leverage_allowed": None}
    fits = [cap for lev, cap in rows if lev >= leverage]
    return {
        "max_leverage": max_leverage,
        "cap_usd": max(fits) if fits else None,
        "leverage_allowed": bool(fits),
    }


def project(accounts: list[dict], ticker: str, base_size: float, max_size: float,
            mark_price: Optional[float], cap_usd: Optional[float]) -> dict:
    """Each account's full-stack size under the proposed sizing.

    The full stack is the stack cap's ceiling: `entries x one entry`, where one
    entry is `_scale_qty(base)` for that balance. A streak step can never pass
    it (the engine's size ceiling), so this is the largest position the bot can
    build on the coin for that account."""
    from binance_abcd.assets_api import _increment_cap
    from binance_abcd.routes.webhook import _scale_qty

    entries = int(_increment_cap(max_size, base_size)) if max_size > 0 else 0
    rows = []
    for account in accounts:
        try:
            balance = float(account.get("balance") or 0)
        except (TypeError, ValueError):
            balance = 0.0
        entry_qty = _scale_qty(ticker, base_size, balance)
        full_qty = entry_qty * entries if entries else entry_qty
        full_usd = full_qty * mark_price if mark_price else None
        rows.append({
            "name": account.get("name"),
            "is_master": bool(account.get("is_master")),
            "balance": round(balance, 2),
            "entry_qty": entry_qty,
            "entry_usd": round(entry_qty * mark_price, 2) if mark_price else None,
            "full_qty": full_qty,
            "full_usd": round(full_usd, 2) if full_usd is not None else None,
            "over": bool(cap_usd is not None and full_usd is not None and full_usd > cap_usd),
            "used_pct": round(full_usd / cap_usd * 100, 1) if cap_usd and full_usd is not None else None,
        })
    rows.sort(key=lambda r: r["balance"], reverse=True)

    # The balance at which a full stack reaches the cap at today's price. For
    # tenth-stepped coins one entry ~= base x balance / REFERENCE (floored, so
    # the real size is a hair smaller: the answer errs on the safe side).
    # 0 = even the smallest account (one unscaled base) is over the cap.
    safe_balance = None
    if cap_usd and mark_price and base_size > 0:
        per_ref = max(entries, 1) * base_size * mark_price  # full-stack $ per REFERENCE_BALANCE of balance
        if per_ref > cap_usd:
            safe_balance = 0.0
        elif ticker.upper() in hooks.COARSE_STEP_TICKERS:
            safe_balance = (math.floor(cap_usd / per_ref) + 1) * hooks.REFERENCE_BALANCE - 0.01
        else:
            safe_balance = cap_usd / per_ref * hooks.REFERENCE_BALANCE

    biggest = rows[0] if rows else None
    # How far the price can rise before the biggest account's full stack hits the cap.
    price_headroom_pct = None
    if biggest and biggest["full_usd"] and cap_usd:
        price_headroom_pct = round((cap_usd / biggest["full_usd"] - 1) * 100, 1)

    return {
        "entries": entries,
        "accounts": rows,
        "over_count": sum(1 for r in rows if r["over"]),
        "safe_balance": round(safe_balance, 2) if safe_balance is not None else None,
        "price_headroom_pct": price_headroom_pct,
    }


def check(exchange: str, ticker: str, base_size: float, max_size: float, leverage: Optional[int]) -> tuple[dict, int]:
    """(payload, http status). Real-money accounts only: a demo account trades
    the testnet, whose limits are not the ones that refuse real orders."""
    from binance_abcd.accounts_api import fetch_accounts
    from binance_abcd.exchanges import client_for

    accounts = [a for a in fetch_accounts(exchange=exchange) if not a.get("demo")]
    leverage_assumed = leverage is None
    if leverage is None:
        leverage = hooks.DEFAULT_LEVERAGE if hooks.DEFAULT_LEVERAGE > 0 else None

    if not accounts:
        return {"error": "NO_ACCOUNTS", "message": "No real-money account trades on this exchange yet."}, 404
    # The master's key reads the limits; anyone's would do (Binance's brackets
    # are the same for every ordinary account), the master is simply always there.
    reader = next((a for a in accounts if a.get("is_master")), accounts[0])
    client = client_for(reader)
    if not hasattr(client, "leverage_brackets"):
        return {"error": "NOT_SUPPORTED", "message": f"The position limit can only be read on Binance for now."}, 400

    brackets = client.leverage_brackets(ticker)
    mark = client.mark_price(ticker)
    if brackets is None:
        return {"error": "LIMITS_UNAVAILABLE", "message": "Binance did not answer with this coin's limits. Try again in a minute."}, 503

    cap = cap_at(brackets, leverage)
    projection = project(accounts, ticker, base_size, max_size, mark, cap["cap_usd"])
    return {
        "success": True,
        "exchange": exchange,
        "ticker": ticker.upper(),
        "mark_price": mark,
        "leverage": leverage,
        "leverage_assumed": leverage_assumed,
        **cap,
        "brackets": [
            {"leverage": int(b.get("initialLeverage")), "floor_usd": float(b.get("notionalFloor")),
             "cap_usd": float(b.get("notionalCap"))}
            for b in brackets if isinstance(b, dict) and b.get("initialLeverage") is not None
        ],
        **projection,
    }, 200
