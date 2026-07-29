# Account Information V3 (USER_DATA)

Get current account information for Binance USD-M Futures. Single-asset vs multi-assets mode returns different semantics (see response section).

**HTTP Request:** `GET /fapi/v3/account`  
**Request Weight:** 5  
**Security:** USER_DATA (API key + signature)

## Request parameters

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| recvWindow | LONG | NO | Optional |
| timestamp | LONG | YES | ms |

Send as **query string**. Header: **X-MBX-APIKEY**. Add **signature** (end of query). See [REST API General Info](rest-api-general-info.md) for SIGNED requests.

---

## Response: single-asset mode

Top-level totals are **only for USDT asset**.

| Field | Description |
|-------|-------------|
| totalInitialMargin | Total initial margin required with current mark price (only USDT) |
| totalMaintMargin | Total maintenance margin required (only USDT) |
| totalWalletBalance | Total wallet balance (only USDT) |
| totalUnrealizedProfit | Total unrealized profit (only USDT) |
| totalMarginBalance | Total margin balance (only USDT) |
| totalPositionInitialMargin | Initial margin for positions (only USDT) |
| totalOpenOrderInitialMargin | Initial margin for open orders (only USDT) |
| totalCrossWalletBalance | Crossed wallet balance (only USDT) |
| totalCrossUnPnl | Unrealized profit of crossed positions (only USDT) |
| availableBalance | Available balance (only USDT) |
| maxWithdrawAmount | Maximum amount for transfer out (only USDT) |
| assets | Array of per-asset balances (e.g. USDT, USDC, BTC) |
| positions | All symbols with position or open orders; One-way → BOTH only; Hedge → LONG and SHORT |

### Example (single-asset)

```json
{
  "totalInitialMargin": "0.00000000",
  "totalMaintMargin": "0.00000000",
  "totalWalletBalance": "103.12345678",
  "totalUnrealizedProfit": "0.00000000",
  "totalMarginBalance": "103.12345678",
  "totalPositionInitialMargin": "0.00000000",
  "totalOpenOrderInitialMargin": "0.00000000",
  "totalCrossWalletBalance": "103.12345678",
  "totalCrossUnPnl": "0.00000000",
  "availableBalance": "103.12345678",
  "maxWithdrawAmount": "103.12345678",
  "assets": [
    {
      "asset": "USDT",
      "walletBalance": "23.72469206",
      "unrealizedProfit": "0.00000000",
      "marginBalance": "23.72469206",
      "maintMargin": "0.00000000",
      "initialMargin": "0.00000000",
      "positionInitialMargin": "0.00000000",
      "openOrderInitialMargin": "0.00000000",
      "crossWalletBalance": "23.72469206",
      "crossUnPnl": "0.00000000",
      "availableBalance": "23.72469206",
      "maxWithdrawAmount": "23.72469206",
      "updateTime": 1625474304765
    },
    {
      "asset": "USDC",
      "walletBalance": "103.12345678",
      "unrealizedProfit": "0.00000000",
      "marginBalance": "103.12345678",
      "maintMargin": "0.00000000",
      "initialMargin": "0.00000000",
      "positionInitialMargin": "0.00000000",
      "openOrderInitialMargin": "0.00000000",
      "crossWalletBalance": "103.12345678",
      "crossUnPnl": "0.00000000",
      "availableBalance": "126.72469206",
      "maxWithdrawAmount": "103.12345678",
      "updateTime": 1625474304765
    }
  ],
  "positions": [
    {
      "symbol": "BTCUSDT",
      "positionSide": "BOTH",
      "positionAmt": "1.000",
      "unrealizedProfit": "0.00000000",
      "isolatedMargin": "0.00000000",
      "notional": "0",
      "isolatedWallet": "0",
      "initialMargin": "0",
      "maintMargin": "0",
      "updateTime": 0
    }
  ]
}
```

### assets[] fields

| Field | Description |
|-------|-------------|
| asset | Asset name (USDT, USDC, BTC, etc.) |
| walletBalance | Wallet balance |
| unrealizedProfit | Unrealized profit |
| marginBalance | Margin balance |
| maintMargin | Maintenance margin required |
| initialMargin | Total initial margin with current mark price |
| positionInitialMargin | Initial margin for positions |
| openOrderInitialMargin | Initial margin for open orders |
| crossWalletBalance | Crossed wallet balance |
| crossUnPnl | Unrealized profit of crossed positions |
| availableBalance | Available balance |
| maxWithdrawAmount | Maximum amount for transfer out |
| updateTime | Last update time (ms) |

### positions[] fields

| Field | Description |
|-------|-------------|
| symbol | e.g. BTCUSDT |
| positionSide | BOTH (One-way), or LONG / SHORT (Hedge) |
| positionAmt | Position size |
| unrealizedProfit | Unrealized profit |
| isolatedMargin | Isolated margin |
| notional | Notional |
| isolatedWallet | Isolated wallet |
| initialMargin | Initial margin with current mark price |
| maintMargin | Maintenance margin required |
| updateTime | Last update time (ms) |

---

## Response: multi-assets mode

Top-level totals are **in USD** (sum / converted).

| Field | Description |
|-------|-------------|
| totalInitialMargin | Sum of USD value of all cross positions/open order initial margin |
| totalMaintMargin | Sum of USD value of all cross positions maintenance margin |
| totalWalletBalance | Total wallet balance in USD |
| totalUnrealizedProfit | Total unrealized profit in USD |
| totalMarginBalance | Total margin balance in USD |
| totalPositionInitialMargin | Sum of USD value of all cross positions initial margin |
| totalOpenOrderInitialMargin | Open orders initial margin in USD |
| totalCrossWalletBalance | Crossed wallet balance in USD |
| totalCrossUnPnl | Unrealized profit of crossed positions in USD |
| availableBalance | Available balance in USD |
| maxWithdrawAmount | Maximum virtual amount for transfer out in USD |
| assets | Per-asset breakdown (availableBalance / maxWithdrawAmount may be in USD in multi-assets) |
| positions | Same as single-asset: BOTH only (One-way), LONG/SHORT (Hedge) |

Structure of `assets[]` and `positions[]` is the same as single-asset; only the meaning of top-level and some asset fields (e.g. availableBalance in USD) differs in multi-assets mode.

---

## Quick reference

- **Endpoint:** `GET https://fapi.binance.com/fapi/v3/account` (testnet: `https://demo-fapi.binance.com/fapi/v3/account`)
- **Weight:** 5
- **Auth:** Query: `timestamp`, `signature`; Header: `X-MBX-APIKEY`
