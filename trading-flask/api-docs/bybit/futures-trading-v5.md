# Bybit V5 — Futures & perps (REST overview)

This note ties **derivatives (futures / perpetuals)** to the unified V5 API. It is **not** a full scrape of every endpoint; use the official references below.

**Prerequisites:** [V5 integration guide](v5-integration-guide.md) (auth, signing, hosts). For **demo** hosts and allowed endpoints, see [Demo trading](demo-trading-v5.md).

**Official sources:**

- [V5 Introduction](https://bybit-exchange.github.io/docs/v5/intro) — unified spot + derivatives + options
- [Place order](https://bybit-exchange.github.io/docs/v5/order/create-order) — local summary: [place-order-v5.md](place-order-v5.md)
- [Get position (list)](https://bybit-exchange.github.io/docs/v5/position)
- [Set leverage](https://bybit-exchange.github.io/docs/v5/position/leverage) — local: [set-leverage-v5.md](set-leverage-v5.md)
- [Instrument info](https://bybit-exchange.github.io/docs/v5/market/instrument) — `tickSize`, limits, `maxOrderQty`, etc.
- [Enums](https://bybit-exchange.github.io/docs/v5/enum) — `category`, `positionIdx`, `orderType`, …
- [Trade rate limits](https://bybit-exchange.github.io/docs/v5/rate-limit#trade)
- [Wallet balance](https://bybit-exchange.github.io/docs/v5/account/wallet-balance) — local: [wallet-balance-v5.md](wallet-balance-v5.md)
- [Account info](https://bybit-exchange.github.io/docs/v5/account/account-info) — local: [account-info-v5.md](account-info-v5.md)

---

## Why one API for futures

V5 uses **`category`** (and related fields) so the same paths cover **linear** (USDT/USDC margined perps & futures), **inverse** (coin-m), **spot**, and **options**. Example: `POST /v5/order/create` with `category=linear` vs `inverse`.

From the [Introduction](https://bybit-exchange.github.io/docs/v5/intro), unified accounts can share margin across products; path layout is grouped as `v5/market`, `v5/order`, `v5/position`, `v5/account`, `v5/asset`, etc.

---

## `category` for derivatives

| `category` | Typical use |
|------------|-------------|
| `linear` | USDT/USDC **perpetual** and **linear futures** (check symbol naming in instrument docs) |
| `inverse` | **Inverse** perpetual / futures (coin margin) |
| `option` | Options (separate trading rules) |

Always pass **`symbol`** in **UPPERCASE** (e.g. `BTCUSDT`, `BTCUSD`) per official specs.

---

## Core futures endpoints (starting points)

| Action | Method & path | Notes |
|--------|----------------|--------|
| Place order | `POST /v5/order/create` | Full parameter & behaviour notes: [place-order-v5.md](place-order-v5.md) |
| Open orders | `GET /v5/order/realtime` | Query string signs per integration guide |
| Positions | `GET /v5/position/list` | `category` required; `symbol` or `settleCoin` rules differ by `linear` vs `inverse` |
| Set leverage | `POST /v5/position/set-leverage` | [set-leverage-v5.md](set-leverage-v5.md) — `linear` / `inverse` only |
| Instrument rules | `GET /v5/market/instruments-info` | Price filters, lot size, max market qty, etc. |
| Server time | `GET /v5/market/time` | For timestamp alignment |
| Wallet balance | `GET /v5/account/wallet-balance` | [wallet-balance-v5.md](wallet-balance-v5.md) — `accountType=UNIFIED`, optional `coin` |
| Account info | `GET /v5/account/info` | [account-info-v5.md](account-info-v5.md) — margin mode, unified status, hedging |

---

## Place order

See **[Place order (V5)](place-order-v5.md)** for `orderType`, `timeInForce`, market IOC/slippage, conditional & TP/SL rules, full parameter table, open-order caps, and JSON examples (spot + USDT perp).

---

## Positions — `GET /v5/position/list`

[Official doc](https://bybit-exchange.github.io/docs/v5/position).

- **`category=inverse`:** can list all open positions without `symbol` in one mode; **cannot** batch multiple symbols in one request (per doc).
- **`linear`:** `symbol` **or** `settleCoin` required when querying; `symbol` wins if both set.
- High volatility: possible **latency** on this route (official note).

Response **`list`** entries include `size`, `side`, `avgPrice`, `markPrice`, `liqPrice`, `unrealisedPnl`, `leverage`, `positionIdx`, `isReduceOnly`, etc. — see full field table on the official page.

---

## Market data before trading

Use **`v5/market/*`** for order book, trades, klines, tickers, funding, open interest, etc. Path pattern: `{host}/v5/market/...` ([Introduction](https://bybit-exchange.github.io/docs/v5/intro)).

---

## WebSocket

Futures feeds (order book, executions, positions, wallet) are documented under **WebSocket Stream** in the V5 sidebar. Use REST for signing rules; WS has its own auth payload — follow [Bybit V5 WebSocket docs](https://bybit-exchange.github.io/docs/v5/ws/connect).

---

## Compliance reminder

Geographic **403** behaviour and **EEA** host limitations are described in [Integration Guidance](https://bybit-exchange.github.io/docs/v5/guide). Keep keys scoped to **Contract** (or required) permissions only.
