# MEXC API — Public definitions (ENUMs & codes)

Reference for spot REST/WebSocket enums and status codes. Confirm against [official MEXC API docs](https://mexcdevelop.github.io/apidocs/) for changes.

**Related:** [Market data](market-data-endpoints.md) · [Spot account & trade](spot-account-trade.md) · [General info](general-info.md)

---

## Order side

| Value | Description |
|-------|-------------|
| `BUY` | Buy |
| `SELL` | Sell |

---

## Order type

| Value | Description |
|-------|-------------|
| `LIMIT` | Limit |
| `MARKET` | Market |
| `LIMIT_MAKER` | Limit maker |
| `IMMEDIATE_OR_CANCEL` | IOC |
| `FILL_OR_KILL` | FOK |
| `STOP_MARKET_ORDER` | Stop market (**query only** — not for placement per MEXC) |

---

## Order status

| Value | Meaning |
|-------|---------|
| `NEW` | Uncompleted (open) |
| `FILLED` | Fully filled |
| `PARTIALLY_FILLED` | Partially filled |
| `CANCELED` | Canceled |
| `PARTIALLY_CANCELED` | Partially canceled |

---

## Deposit status

| Code | Meaning |
|------|---------|
| 1 | `SMALL` |
| 2 | `TIME_DELAY` |
| 3 | `LARGE_DELAY` |
| 4 | `PENDING` |
| 5 | `SUCCESS` |
| 6 | `AUDITING` |
| 7 | `REJECTED` |
| 8 | `REFUND` |
| 9 | `PRE_SUCCESS` |
| 10 | `INVALID` |
| 11 | `RESTRICTED` |
| 12 | `COMPLETED` |

---

## Withdraw status

| Code | Meaning |
|------|---------|
| 1 | `APPLY` |
| 2 | `AUDITING` |
| 3 | `WAIT` |
| 4 | `PROCESSING` |
| 5 | `WAIT_PACKAGING` |
| 6 | `WAIT_CONFIRM` |
| 7 | `SUCCESS` |
| 8 | `FAILED` |
| 9 | `CANCEL` |
| 10 | `MANUAL` |

---

## Kline interval

| Value | Period |
|-------|--------|
| `1m` | 1 minute |
| `5m` | 5 minutes |
| `15m` | 15 minutes |
| `30m` | 30 minutes |
| `60m` | 60 minutes |
| `4h` | 4 hours |
| `1d` | 1 day |
| `1W` | 1 week |
| `1M` | 1 month |

---

## Changed type (asset / ledger flow)

Used in wallet / history contexts (wording per MEXC).

| Value | Meaning |
|-------|---------|
| `WITHDRAW` | Withdraw |
| `WITHDRAW_FEE` | Withdraw fee |
| `DEPOSIT` | Deposit |
| `DEPOSIT_FEE` | Deposit fee |
| `ENTRUST` | Deal (trade) |
| `ENTRUST_PLACE` | Place order |
| `ENTRUST_CANCEL` | Cancel order |
| `TRADE_FEE` | Trade fee |
| `ENTRUST_UNFROZEN` | Return frozen order funds |
| `SUGAR` | Airdrop |
| `ETF_INDEX` | ETF place order |
