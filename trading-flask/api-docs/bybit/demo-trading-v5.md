# Bybit V5 — Demo trading service

Condensed from [Demo Trading Service](https://bybit-exchange.github.io/docs/v5/demo). Use that page for exact request/response schemas and any new endpoints.

**Related:** [V5 integration guide](v5-integration-guide.md) · [Place order](place-order-v5.md) · [Set leverage](set-leverage-v5.md) · [Wallet balance](wallet-balance-v5.md) · [Account info](account-info-v5.md) · [Futures trading](futures-trading-v5.md) · [Introduction](introduction.md)

---

## Introduction

V5 Open API supports a **demo trading** account. **Not every API** exists on demo: it is for **experience**, not full parity with live trading.

---

## Create a demo API key (UI)

1. Log in to **[mainnet](https://www.bybit.com/)** (not testnet for this flow).
2. Switch to **Demo Trading** — separate module with its **own user ID**.
3. Avatar → **API** → generate **API key** and **secret**.

---

## Usage rules

- Core trading rules match **real** trading.
- Demo **orders are kept 7 days**.
- **Default rate limits** only — **not upgradable**.

---

## Domains

| Purpose | URL |
|---------|-----|
| **Demo REST** | `https://api-demo.bybit.com` |
| **Demo WebSocket (private only)** | `wss://stream-demo.bybit.com` |

**WebSocket notes (official):**

- Demo WS supports **private** streams on `stream-demo.bybit.com`.
- **Public** market data matches **mainnet**: use `wss://stream.bybit.com`.
- **WS Trade** is **not** supported on demo.

---

## Tips

- Demo is **isolated**. Keys created in **Demo Trading** must call **`api-demo.bybit.com`** (and demo private WS as above).
- Using demo from the **[testnet](https://testnet.bybit.com/)** site is **not meaningful** — **do not** create keys from “Testnet demo trading” for this product path.

---

## Available APIs on demo

Official table (with doc links): [Demo Trading Service — Available API List](https://bybit-exchange.github.io/docs/v5/demo#available-api-list).

| Category | Title | Endpoint |
|----------|--------|----------|
| Market | All market endpoints | all `v5/market/*` |
| Trade | Place order | `/v5/order/create` |
| Trade | Amend order | `/v5/order/amend` |
| Trade | Cancel order | `/v5/order/cancel` |
| Trade | Get open orders | `/v5/order/realtime` |
| Trade | Cancel all orders | `/v5/order/cancel-all` |
| Trade | Get order history | `/v5/order/history` |
| Trade | Get trade (execution) history | `/v5/execution/list` |
| Trade | Batch place | `/v5/order/create-batch` (**linear**, **option**) |
| Trade | Batch amend | `/v5/order/amend-batch` (**linear**, **option**) |
| Trade | Batch cancel | `/v5/order/cancel-batch` (**linear**, **option**) |
| Position | Get position info | `/v5/position/list` |
| Position | Set leverage | `/v5/position/set-leverage` |
| Position | Switch position mode | `/v5/position/switch-mode` |
| Position | Set trading stop | `/v5/position/trading-stop` |
| Position | Set auto add margin | `/v5/position/set-auto-add-margin` |
| Position | Add or reduce margin | `/v5/position/add-margin` |
| Position | Get closed PnL | `/v5/position/closed-pnl` |
| Account | Get wallet balance | `/v5/account/wallet-balance` |
| Account | Get borrow history | `/v5/account/borrow-history` |
| Account | Set collateral coin | `/v5/account/set-collateral-switch` |
| Account | Get collateral info | `/v5/account/collateral-info` |
| Account | Get coin greeks | `/v5/asset/coin-greeks` |
| Account | Get account info | `/v5/account/info` |
| Account | Get transaction log | `/v5/account/transaction-log` |
| Account | Set margin mode | `/v5/account/set-margin-mode` |
| Account | Set spot hedging | `/v5/account/set-hedging-mode` |
| Asset | Get delivery record | `/v5/asset/delivery-record` |
| Asset | Get USDC session settlement | `/v5/asset/settlement-record` |
| Spot margin | Toggle margin trade | `/v5/spot-margin-trade/switch-mode` |
| Spot margin | Set leverage | `/v5/spot-margin-trade/set-leverage` |
| Spot margin | Get status and leverage | `/v5/spot-margin-uta/status` |
| WS private | order, execution, position, wallet, greeks | topic family `/v5/private` (see WS docs) |

---

## Request demo trading funds

**`POST /v5/account/demo-apply-money`**  
**Host:** `api-demo.bybit.com`  
**Rate limit:** **1 request / minute**

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| adjustType | NO | integer | **0** (default): add demo funds; **1**: reduce demo funds |
| utaDemoApplyMoney | NO | array | List of `{ coin, amountStr }` |

**`utaDemoApplyMoney[]`**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| coin | NO | string | `BTC`, `ETH`, `USDT`, `USDC` |
| amountStr | NO | string | Per-request cap examples: BTC **15**, ETH **200**, USDT **100000**, USDC **100000** |

**Example**

```http
POST /v5/account/demo-apply-money HTTP/1.1
Host: api-demo.bybit.com
X-BAPI-SIGN: <signature>
X-BAPI-API-KEY: <demo-api-key>
X-BAPI-TIMESTAMP: 1711420489915
X-BAPI-RECV-WINDOW: 5000
Content-Type: application/json

{
  "adjustType": 0,
  "utaDemoApplyMoney": [
    { "coin": "USDT", "amountStr": "109" },
    { "coin": "ETH", "amountStr": "1" }
  ]
}
```

---

## Create demo account (API)

**`POST /v5/user/create-demo-member`**  
**Host:** **`api.bybit.com`** (production — not `api-demo`)

| | |
|--|--|
| **Rate limit** | **5 req/s** |
| **Permissions** | `AccountTransfer`, `SubMemberTransfer`, or `SubMemberTransferList` (per official doc) |

**Request body:** empty `{}`

**Response (key field)**

| Field | Type | Description |
|-------|------|-------------|
| subMemberId | string | Demo account ID |

**Behaviour (official)**

- Call with **main** or **sub** account production API key.
- If a demo account **already exists**, response returns the **existing** UID.
- Demo account is created **under** the caller (main vs sub) accordingly.

---

## Demo account API keys (create / update / delete / query)

Detailed paths and bodies live on [Demo Trading Service](https://bybit-exchange.github.io/docs/v5/demo). Summary of **which host / which key**:

| Operation | Caller | Host |
|-----------|--------|------|
| **Create** demo account API key | Production **main** account key; input **demo UID** | `api.bybit.com` |
| **Update** demo account API key | Production **main** account key | `api.bybit.com` |
| **Get** demo API key info | **Demo** account API key | `api-demo.bybit.com` |
| **Delete** demo account API key | Production **main** account key | `api.bybit.com` |

---

## Signing

Use the same rules as [V5 integration guide](v5-integration-guide.md): sign for **`api-demo.bybit.com`** when using **demo trading keys**; sign for **`api.bybit.com`** when using **production keys** to manage demo members or demo keys.
