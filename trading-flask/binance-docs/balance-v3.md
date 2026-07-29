# Futures Account Balance V3 (USER_DATA)

Query account balance info for Binance USD-M Futures.

**HTTP Request:** `GET /fapi/v3/balance`  
**Request Weight:** 5  
**Security:** USER_DATA (API key + signature)

## Request parameters

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| recvWindow | LONG | NO | Optional |
| timestamp | LONG | YES | ms |

Send as **query string**. Header: **X-MBX-APIKEY**. Add **signature** (end of query). See [REST API General Info](rest-api-general-info.md) for SIGNED requests.

---

## Response

Returns an **array** of balance objects, one per asset.

| Field | Description |
|-------|-------------|
| accountAlias | Unique account code |
| asset | Asset name (e.g. USDT) |
| balance | Wallet balance |
| crossWalletBalance | Crossed wallet balance |
| crossUnPnl | Unrealized profit of crossed positions |
| availableBalance | Available balance |
| maxWithdrawAmount | Maximum amount for transfer out |
| marginAvailable | Whether the asset can be used as margin in Multi-Assets mode |
| updateTime | Last update time (ms) |

### Example

```json
[
  {
    "accountAlias": "SgsR",
    "asset": "USDT",
    "balance": "122607.35137903",
    "crossWalletBalance": "23.72469206",
    "crossUnPnl": "0.00000000",
    "availableBalance": "23.72469206",
    "maxWithdrawAmount": "23.72469206",
    "marginAvailable": true,
    "updateTime": 1617939110373
  }
]
```

---

## Quick reference

- **Endpoint:** `GET https://fapi.binance.com/fapi/v3/balance` (testnet: `https://demo-fapi.binance.com/fapi/v3/balance`)
- **Weight:** 5
- **Auth:** Query: `timestamp`, `signature`; Header: `X-MBX-APIKEY`
- **Difference vs Account V3:** [Account Information V3](account-information-v3.md) returns full account (totals, assets, positions); Balance V3 returns only the balance array per asset (no positions, no top-level totals).
