"""Real-key smoke checks for the MEXC adapter — run BEFORE enabling `mexc`.

The MEXC client was written from MEXC's Open API materials plus the reference
project's live traces, and a handful of things those leave ambiguous decide
whether money moves correctly. This script asks the live API each question and
prints the answer beside the assumption the code currently makes, so the
verdict is a fact recorded in the module docstrings rather than a guess.

Credentials come from the environment ONLY (never argv, never a file in this
repo — it is public on GitHub):

    set MEXC_SMOKE_KEY=mx0...
    set MEXC_SMOKE_SECRET=...
    python mexc_smoke.py                 # read-only checks (a)–(h)
    python mexc_smoke.py --place SYMBOL  # (i): open minVol on SYMBOL, then close it. REAL MONEY.

Checks, and what each one settles:

  (a) account/asset/USDT      signature + headers accepted; equity/unrealized
                              fields present (balance = equity − unrealized)
  (b) position/position_mode  readable; 1 = hedge is what the engine wants
  (c) contract/detail (all)   count; BTC_USDT contractSize/volScale/minVol/
                              apiAllowed — coins_to_vol's inputs
  (d) position/leverage       row shape per positionType — the leverage
                              fallback reads `leverage` off the matching row
  (e) history_orders          which time param the server honours (start_time
                              vs startTime), paginated vs bare list, whether
                              `profit` is on the order row (fallback source)
  (f) order_deals/v3          `fee` sign (+ = paid) and whether `profit` is
                              GROSS of fee → mexc_adapter.DEAL_PROFIT_IS_NET
  (g) funding_records         `funding` sign vs the app's funding history →
                              fetch_mexc_history.funding_receipts_mexc negates
  (h) transfer_record         ids numeric, createTime ms, IN/OUT — transfers
  (i) order/create (--place)  NOT 604 for this key; deal_details indexed within
                              a few seconds; the close lands via side 4/2 +
                              positionId; English error messages

Nothing here touches the engine's tables, Telegram, or the engine API.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

os.environ.setdefault("BINANCE_ABCD_WEBHOOK_SECRET", "smoke")
os.environ.setdefault("BINANCE_ABCD_ENGINE_SECRET", "smoke")
os.environ.setdefault("BINANCE_ABCD_TELEGRAM_ENABLED", "false")

from binance_abcd import key_status  # noqa: E402
from binance_abcd.mexc_api import (  # noqa: E402
    HISTORY_END_PARAM,
    HISTORY_START_PARAM,
    SIDE_CLOSE_LONG,
    SIDE_OPEN_LONG,
    MexcFuturesAPI,
)

# The engine API is not running for a smoke test; a key-status report would
# just log a warning. Silence it entirely.
key_status._post = lambda payload, exchange: None  # type: ignore[assignment]


def show(title: str, value) -> None:
    print(f"\n=== {title}")
    print(json.dumps(value, indent=2, default=str)[:2500] if value is not None else "None  (read FAILED — see log above)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--place", metavar="SYMBOL", help="open minVol on SYMBOL (e.g. DOGE_USDT) then close it — REAL MONEY")
    parser.add_argument("--leverage", type=int, default=5)
    args = parser.parse_args()

    key, secret = os.environ.get("MEXC_SMOKE_KEY", ""), os.environ.get("MEXC_SMOKE_SECRET", "")
    if not key or not secret:
        print("set MEXC_SMOKE_KEY and MEXC_SMOKE_SECRET in the environment first", file=sys.stderr)
        return 2

    api = MexcFuturesAPI(key, secret)
    now = int(time.time() * 1000)
    week = now - 7 * 86400 * 1000

    show("(a) account/asset/USDT — expect equity, unrealized, cashBalance", api.asset("USDT"))
    show("(b) position/position_mode — expect 1 (hedge)", api.position_mode())

    contracts = api.contracts()
    show("(c) contract/detail — count", len(contracts) if contracts else None)
    if contracts:
        btc = contracts.get("BTC_USDT") or {}
        show("(c) BTC_USDT spec (contractSize, volScale, minVol, maxLeverage, apiAllowed)",
             {k: btc.get(k) for k in ("contractSize", "volScale", "minVol", "maxVol", "maxLeverage", "apiAllowed", "state")})
        show("(c) coins_to_vol(BTC_USDT, 0.0025) — expect '25' with contractSize 0.0001", api.coins_to_vol("BTC_USDT", 0.0025))

    show("(d) position/leverage?symbol=BTC_USDT — expect rows with positionType + leverage", api.leverage_settings("BTC_USDT"))

    show(f"(e) history_orders states=3 last 7d via {HISTORY_START_PARAM}/{HISTORY_END_PARAM} — "
         "look for `profit`, `dealAvgPrice`, `updateTime` on a row; empty list = param honoured but no orders",
         api.history_orders(start_ms=week, end_ms=now, page_size=5))
    # The alternative spelling, raw, so the two can be compared side by side.
    alt = api._request_get(  # noqa: SLF001
        "/api/v1/private/order/list/history_orders",
        {"states": "3", "startTime": week, "endTime": now, "page_num": 1, "page_size": 5},
    )
    show("(e) same call with startTime/endTime — if THIS one has rows and the other is empty, flip HISTORY_*_PARAM", alt)

    show("(f) order_deals/v3 BTC_USDT last 7d — check `fee` sign and whether `profit` = (exit−entry)×qty×size "
         "(GROSS, DEAL_PROFIT_IS_NET stays False) or that minus `fee` (NET → set it True)",
         api.order_deals("BTC_USDT", start_ms=week, end_ms=now, page_size=5))
    show("(g) funding_records position_type=1 last 7d — compare `funding` sign with the app: positive = received?",
         api.funding_records(1, start_ms=week, end_ms=now, page_size=5))
    show("(h) transfer_record SUCCESS page 1 — ids numeric, createTime ms, type IN/OUT", api.transfer_records(page_size=5))

    if not args.place:
        print("\nread-only checks done. Re-run with --place SYMBOL for (i) — it trades real money.")
        return 0

    symbol = args.place.upper()
    spec = (contracts or {}).get(symbol)
    if not spec:
        print(f"\n{symbol}: not in contract/detail — pick a listed USDT-M contract", file=sys.stderr)
        return 2
    vol = str(spec.get("minVol") or 1)
    confirm = input(f"\n(i) about to OPEN LONG {vol} contract(s) of {symbol} at {args.leverage}x with REAL money. Type the symbol to confirm: ")
    if confirm.strip().upper() != symbol:
        print("aborted")
        return 1

    opened = api.create_order(symbol, SIDE_OPEN_LONG, vol, open_type=1, leverage=args.leverage, position_mode=1)
    show("(i) order/create OPEN — expect success with data.orderId; code 604 here means the key cannot trade via API", opened)
    if opened.get("_error"):
        return 1
    order_id = (opened.get("data") or {}).get("orderId")

    for attempt in range(1, 6):
        time.sleep(2)
        deals = api.deal_details(order_id)
        if deals:
            show(f"(i) deal_details after {2 * attempt}s — fee/feeCurrency/profit on the ENTRY fill", deals)
            break
    else:
        show("(i) deal_details — nothing indexed after 10s; fill_summary_once would keep retrying", api.get_order(order_id))

    positions = api.open_positions(symbol) or []
    mine = next((p for p in positions if int(p.get("positionType") or 0) == 1), None)
    show("(i) open_positions — the row the close is built from (positionId, holdVol, openType, leverage)", mine)
    if not mine:
        print("no LONG position visible — close it by hand in the app", file=sys.stderr)
        return 1

    closed = api.create_order(symbol, SIDE_CLOSE_LONG, str(mine.get("holdVol")), open_type=int(mine.get("openType") or 1),
                              position_id=int(mine.get("positionId")), position_mode=1)
    show("(i) order/create CLOSE via side 4 + positionId — expect success", closed)
    if closed.get("_error"):
        print("CLOSE FAILED — close the position by hand in the app NOW", file=sys.stderr)
        return 1
    time.sleep(3)
    show("(i) deal_details of the CLOSE — `profit` here is what past-positions rows will carry", api.deal_details((closed.get("data") or {}).get("orderId")))
    show("(i) open_positions after close — expect []", api.open_positions(symbol))
    return 0


if __name__ == "__main__":
    sys.exit(main())
