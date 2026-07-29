# Bybit V5 — Get wallet balance (`GET /v5/account/wallet-balance`)

Returns **per-coin** wallet / margin fields for the requested account. By default, coins with **zero** asset and **zero** liability are omitted.

Official reference: [Get wallet balance](https://bybit-exchange.github.io/docs/v5/account/wallet-balance).

**Related:** [V5 integration guide](v5-integration-guide.md) · [Account info](account-info-v5.md) · [Futures overview](futures-trading-v5.md) · [Demo trading](demo-trading-v5.md)

---

## Notes

- **UTA manual borrow / `spotBorrow`:** spot-liability semantics for **`spotBorrow`** are described in Bybit’s **announcement** (linked from the [official wallet-balance doc](https://bybit-exchange.github.io/docs/v5/account/wallet-balance)).  
  **Legacy relation:** `old walletBalance ≈ new walletBalance - spotBorrow` (per official wording).
- **Funding wallet:** not this route — use the **Funding** balance endpoint listed in the official docs for funding balances.
- **Volatility:** under stress, this API may show **higher latency** or short **delivery delays** (official notice).

---

## HTTP request

```http
GET /v5/account/wallet-balance?accountType=UNIFIED&coin=BTC HTTP/1.1
Host: api.bybit.com
X-BAPI-SIGN: <signature>
X-BAPI-API-KEY: <key>
X-BAPI-TIMESTAMP: <ms>
X-BAPI-RECV-WINDOW: 5000
```

Query string is part of the **sign payload** (see [integration guide](v5-integration-guide.md)).

---

## Request parameters

| Parameter | Required | Type | Comments |
|-----------|----------|------|----------|
| accountType | YES | string | e.g. **`UNIFIED`** |
| coin | NO | string | Symbol **uppercase**. Omit → non-zero assets only. **Multiple:** comma-separated, e.g. `USDT,USDC` |

---

## Response — `result.list[]` (account-level)

| Field | Type | Comments |
|-------|------|----------|
| accountType | string | e.g. `UNIFIED` |
| accountIMRate | string | Account initial-margin rate |
| accountMMRate | string | Account maintenance-margin rate |
| totalEquity | string | Total equity **(USD)** — sum of asset equity by USD |
| totalWalletBalance | string | Wallet balance **(USD)** — sum by USD |
| totalMarginBalance | string | `totalWalletBalance + totalPerpUPL` (USD) |
| totalAvailableBalance | string | USD available: **Cross** — `totalMarginBalance - Haircut - totalInitialMargin`; **Portfolio** — `totalEquity - Haircut - totalInitialMargin` |
| totalPerpUPL | string | Unrealised P&amp;L from perps + USDC futures **(USD)** |
| totalInitialMargin | string | Sum of initial margin **(USD)** |
| totalMaintenanceMargin | string | Sum of maintenance margin **(USD)** |
| accountIMRateByMp | string | May ignore; same idea as `accountIMRate` |
| accountMMRateByMp | string | May ignore; same idea as `accountMMRate` |
| totalInitialMarginByMp | string | May ignore; same idea as `totalInitialMargin` |
| totalMaintenanceMarginByMp | string | May ignore; same idea as `totalMaintenanceMargin` |
| accountLTV | string | **Deprecated** |
| coin | array | Per-coin rows (below) |

Account-wide rates / totals **do not apply** the same way in **isolated** margin (per official doc). Use the glossary linked from the official page for IM/MM definitions.

---

## Response — `result.list[].coin[]` (per coin)

| Field | Type | Comments |
|-------|------|----------|
| coin | string | `BTC`, `ETH`, `USDT`, … |
| equity | string | `walletBalance - spotBorrow + unrealisedPnl +` option value (see official formula) |
| usdValue | string | USD value |
| walletBalance | string | Wallet balance of coin |
| locked | string | Locked by **spot** open orders |
| spotHedgingQty | string | Spot qty used for portfolio-margin hedge; default `0` |
| borrowAmount | string | Spot + derivatives liabilities |
| accruedInterest | string | Accrued interest |
| totalOrderIM | string | Margin pre-occupied by orders; PM mode: `""` |
| totalPositionIM | string | Positions IM + liq fee reserve; PM: `""` |
| totalPositionMM | string | Positions MM; PM: `""` |
| unrealisedPnl | string | Unrealised P&amp;L |
| cumRealisedPnl | string | Cumulative realised P&amp;L |
| bonus | string | Bonus |
| marginCollateral | boolean | Platform: coin **can** be used as collateral |
| collateralSwitch | boolean | User collateral on/off; meaningful when `marginCollateral=true` |
| spotBorrow | string | Spot margin + **manual** borrow (excludes some order paths); see announcement |
| free | string | **Deprecated** (no separate spot wallet) |
| availableToWithdraw | string | **Deprecated** for `UNIFIED` from **9 Jan 2025** — use **Get transferable amount (unified)** / **Get all coins balance** per official doc |
| availableToBorrow | string | **Deprecated**; often `""` — use **Get collateral info** |

**Available balance (summary from official doc):**

- **Derivatives isolated:** `walletBalance - totalPositionIM - totalOrderIM - locked - bonus`
- **Cross / portfolio (USD):** use account-level **`totalAvailableBalance`** and convert by **index** price to coin
- **Spot (margin):** use **Get borrow quota (spot)**

---

## Response example

```json
{
  "retCode": 0,
  "retMsg": "OK",
  "result": {
    "list": [
      {
        "totalEquity": "3.31216591",
        "accountIMRate": "0",
        "accountIMRateByMp": "0",
        "totalMarginBalance": "3.00326056",
        "totalInitialMargin": "0",
        "totalInitialMarginByMp": "0",
        "accountType": "UNIFIED",
        "totalAvailableBalance": "3.00326056",
        "accountMMRate": "0",
        "accountMMRateByMp": "0",
        "totalPerpUPL": "0",
        "totalWalletBalance": "3.00326056",
        "accountLTV": "0",
        "totalMaintenanceMargin": "0",
        "totalMaintenanceMarginByMp": "0",
        "coin": [
          {
            "availableToBorrow": "3",
            "bonus": "0",
            "accruedInterest": "0",
            "availableToWithdraw": "0",
            "totalOrderIM": "0",
            "equity": "0",
            "totalPositionMM": "0",
            "usdValue": "0",
            "spotHedgingQty": "0.01592413",
            "unrealisedPnl": "0",
            "collateralSwitch": true,
            "borrowAmount": "0.0",
            "totalPositionIM": "0",
            "walletBalance": "0",
            "cumRealisedPnl": "0",
            "locked": "0",
            "marginCollateral": true,
            "coin": "BTC",
            "spotBorrow": "0"
          }
        ]
      }
    ]
  },
  "retExtInfo": {},
  "time": 1690872862481
}
```
