# MEXC API — Spot account & trade (signed)

Base: `https://api.mexc.com`  
Unless noted, endpoints require **`timestamp`**, **`signature`**, and header **`X-MEXC-APIKEY`**. See [General info](general-info.md) for signing.

**Related:** [ENUMs & status codes](enums.md) · [Market data (public)](market-data-endpoints.md) · [Introduction](introduction.md)

---

## Query KYC status

**`GET /api/v3/kyc/status`**

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_READ` |
| **Weight (IP)** | 1 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| timestamp | string | YES | ms timestamp |
| signature | string | YES | HMAC signature |

**Response**

```json
{ "status": "1" }
```

| Name | Type | Description |
|------|------|-------------|
| status | string | **1** — unverified; **2** — primary KYC; **3** — advanced KYC; **4** — institutional KYC |

---

## Query UID

**`GET /api/v3/uid`**

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_READ` |
| **Weight (IP)** | 1 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| timestamp | string | YES | |
| signature | string | YES | |

**Response**

```json
{ "uid": "209302839" }
```

| Name | Type | Description |
|------|------|-------------|
| uid | string | Account UID |

---

## User API default symbols

**`GET /api/v3/selfSymbols`**

Symbols allowed for this API key (per key trading-pair settings).

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_READ` (MEXC docs may abbreviate as `SPOT_ACCOUNT_R`) |
| **Weight (IP)** | 1 |
| **Parameters** | None (signed request still needs `timestamp` + `signature` per MEXC rules) |

**Response**

```json
{
  "code": 200,
  "data": ["GENE1USDT", "SNTUSDT", "SQUAWKUSDT", "HEGICUSDT", "GUMUSDT"],
  "msg": null
}
```

| Name | Type | Description |
|------|------|-------------|
| data[] | string | Tradable symbol for this key |

---

## Test new order

**`POST /api/v3/order/test`**

Validates a new order **without** sending it to the matching engine.

| | |
|--|--|
| **Permission** | `SPOT_DEAL_WRITE` |
| **Weight (IP)** | 1 |

**Parameters:** Same as **`POST /api/v3/order`** (below).

**Response**

```json
{}
```

---

## New order

**`POST /api/v3/order`**

| | |
|--|--|
| **Permission** | `SPOT_DEAL_WRITE` |
| **Rate limit** | Shared with **cancel order**; **12 requests/second** (per MEXC) |

**Example (query string)**

```http
POST /api/v3/order?symbol=MXUSDT&side=BUY&type=LIMIT&quantity=50&price=0.1&timestamp={{timestamp}}&signature={{signature}}
```

**Response**

```json
{
  "symbol": "MXUSDT",
  "orderId": "06a480e69e604477bfb48dddd5f0b750",
  "orderListId": -1,
  "price": "0.1",
  "origQty": "50",
  "type": "LIMIT",
  "side": "BUY",
  "stpMode": "",
  "transactTime": 1666676533741
}
```

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | STRING | YES | |
| side | ENUM | YES | Order side |
| type | ENUM | YES | Order type |
| quantity | DECIMAL | NO | Base quantity |
| quoteOrderQty | DECIMAL | NO | Quote notional (see MARKET rules) |
| price | DECIMAL | NO | Price |
| newClientOrderId | STRING | NO | |
| stpMode | STRING | NO | `""` default — no STP. `cancel_maker` / `cancel_taker` / `cancel_both` — self-trade prevention modes |
| recvWindow | LONG | NO | max 60000 |
| timestamp | LONG | YES | |

**Extra rules by `type`**

| type | Extra mandatory |
|------|-----------------|
| LIMIT | `quantity`, `price` |
| MARKET | **`quantity` *or* `quoteOrderQty`** (one required) |

**`stpMode`**

- Default `""` — no self-trade prevention.
- STP applies only if a **strategy group** exists, `stpMode` is non-empty, etc. (see MEXC **Introduction to Self-Trade Prevention**).

**MARKET**

- **`quantity`:** base asset amount (e.g. how much BTC to sell on `BTCUSDT`).
- **`quoteOrderQty`:** quote spent when **buying**; quantity derived from book. On **SELL**, behavior follows MEXC spec (typically selling base `quantity`).

**Response fields**

| Name | Description |
|------|-------------|
| symbol | Symbol |
| orderId | Order id |
| orderListId | Order list id |
| price | Price |
| origQty | Original quantity |
| type / side | Enums |
| stpMode | STP mode |
| transactTime | Transaction time (ms) |

---

## Batch orders

**`POST /api/v3/batchOrders`**

Up to **20** orders **per request**, **same symbol**; batch rate **2/s** (per MEXC). Order/cancel share **12 req/s** where documented.

| | |
|--|--|
| **Permission** | `SPOT_DEAL_WRITE` |
| **Rate limit** | Shared with cancel path; **12 req/s**; batch **2/s** |

**Example**

```http
POST /api/v3/batchOrders?batchOrders=[{"type":"LIMIT_ORDER","price":"40000","quantity":"0.0002","symbol":"BTCUSDT","side":"BUY","newClientOrderId":9588234},{"type":"LIMIT_ORDER","price":"4005","quantity":"0.0003","symbol":"BTCUSDT","side":"SELL"}]&...
```

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| batchOrders | LIST | YES | Max **20** orders |
| symbol | STRING | YES | |
| side | ENUM | YES | |
| type | ENUM | YES | |
| quantity | DECIMAL | NO | |
| quoteOrderQty | DECIMAL | NO | |
| price | DECIMAL | NO | |
| newClientOrderId | STRING | NO | |
| stpMode | STRING | NO | Same as single order |
| recvWindow | LONG | NO | &lt; 60000 |
| timestamp | LONG | YES | |

**Type → required fields**

| type | Mandatory |
|------|-----------|
| LIMIT | `quantity`, `price` |
| MARKET | `quantity` or `quoteOrderQty` |

**Response shape**

Returns a **list** mixing successes and errors: successful items include `symbol`, `orderId`, `orderListId`; failures may include `code`, `msg`, `newClientOrderId`, etc. (verify exact JSON in current MEXC docs — pasted examples used pseudo-JSON).

---

## Cancel order

**`DELETE /api/v3/order`**

| | |
|--|--|
| **Permission** | `SPOT_DEAL_WRITE` |
| **Rate limit** | Shared with place order; **12 req/s** |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | YES | |
| orderId | string | NO | |
| origClientOrderId | string | NO | |
| newClientOrderId | string | NO | |
| recvWindow | long | NO | |
| timestamp | long | YES | |

**Either `orderId` or `origClientOrderId` must be sent.**

**Response** (illustrative)

```json
{
  "symbol": "LTCBTC",
  "origClientOrderId": "myOrder1",
  "orderId": 4,
  "clientOrderId": "cancelMyOrder1",
  "price": "2.00000000",
  "origQty": "1.00000000",
  "executedQty": "0.00000000",
  "cummulativeQuoteQty": "0.00000000",
  "status": "CANCELED",
  "type": "LIMIT",
  "side": "BUY"
}
```

---

## Cancel all open orders on a symbol

**`DELETE /api/v3/openOrders`**

Cancels **all** pending orders for one symbol (including OCO-related pendings per MEXC).

| | |
|--|--|
| **Permission** | `SPOT_DEAL_WRITE` |
| **Rate limit** | Shared with place order; **12 req/s** |

**Parameters**

| Name | Type | Mandatory |
|------|------|-----------|
| symbol | string | YES |
| recvWindow | long | NO |
| timestamp | long | YES |

**Response:** array of canceled order objects (same general fields as cancel order).

---

## Query order

**`GET /api/v3/order`**

| | |
|--|--|
| **Permission** | `SPOT_DEAL_READ` |
| **Weight (IP)** | 2 |

**Parameters**

| Name | Type | Mandatory |
|------|------|-----------|
| symbol | String | YES |
| origClientOrderId | String | NO |
| orderId | String | NO |
| recvWindow | long | NO |
| timestamp | long | YES |

**Response** (fields include; MEXC may use `Qty` vs `origQty` in payload — confirm in live docs)

| Name | Description |
|------|-------------|
| symbol, orderId, clientOrderId, orderListId | Identifiers |
| price, Qty / origQty, executedQty, cummulativeQuoteQty | Amounts |
| status, timeInForce, type, side | Order meta |
| stopPrice | Stop price |
| time, updateTime | Created / updated (ms) |
| isWorking | On book |
| stpMode | STP mode |
| cancelReason | e.g. `stp_cancel` |
| origQuoteOrderQty | Original quote qty |

---

## Current open orders

**`GET /api/v3/openOrders`**

| | |
|--|--|
| **Permission** | `SPOT_DEAL_READ` |
| **Weight (IP)** | 3 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | NO | Omit carefully — may return many symbols |
| recvWindow | long | NO | |
| timestamp | long | YES | |

**Response:** array of open order objects (fields align with query order + `icebergQty` where applicable).

---

## All orders

**`GET /api/v3/allOrders`**

Default window **latest 24 hours**; up to **7 days** history; max **1000** rows (`limit`).

| | |
|--|--|
| **Permission** | `SPOT_DEAL_READ` |
| **Weight (IP)** | 10 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | YES | |
| startTime | long | NO | |
| endTime | long | NO | |
| limit | int | NO | Default 500; max 1000 |
| recvWindow | long | NO | |
| timestamp | long | YES | |

---

## Account information

**`GET /api/v3/account`**

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_READ` |
| **Weight (IP)** | 10 |
| **Rate limit** | **2/s** (per MEXC) |

**Parameters:** `recvWindow` (optional), `timestamp` (required).

**Response** (illustrative)

```json
{
  "makerCommission": null,
  "takerCommission": null,
  "buyerCommission": null,
  "sellerCommission": null,
  "canTrade": true,
  "canWithdraw": true,
  "canDeposit": true,
  "updateTime": null,
  "accountType": "SPOT",
  "balances": [
    { "asset": "NBNTEST", "free": "1111078", "locked": "33", "available": "1" }
  ],
  "permissions": ["SPOT"]
}
```

| Name | Description |
|------|-------------|
| canTrade / canWithdraw / canDeposit | Flags |
| accountType | e.g. `SPOT` |
| balances | Per-asset `asset`, `free`, `locked`, `available` |
| permissions | Account permissions |

---

## Account trade list

**`GET /api/v3/myTrades`**

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_READ` |
| **Weight (IP)** | 10 |

Only about **last 1 month** via API; longer history via **web export** (up to **~540 days** per MEXC).

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | YES | |
| orderId | string | NO | |
| startTime | long | NO | |
| endTime | long | NO | |
| limit | int | NO | Default 100; max 100 |
| recvWindow | long | NO | |
| timestamp | long | YES | |

**Response fields (per fill)**

| Name | Description |
|------|-------------|
| symbol | Symbol |
| id | Deal id |
| orderId | Order id |
| price, qty, quoteQty | Fill economics |
| commission, commissionAsset | Fee |
| time | Trade time (ms) |
| isBuyer, isMaker, isBestMatch | Flags |
| isSelfTrade | Self-trade flag |
| clientOrderId | Client order id |

---

## Enable MX deduct (fee in MX)

**`POST /api/v3/mxDeduct/enable`**

| | |
|--|--|
| **Permission** | `SPOT_DEAL_WRITE` |
| **Weight (IP)** | 1 |

**Parameters**

| Name | Type | Mandatory |
|------|------|-----------|
| mxDeductEnable | boolean | YES — `true` enable / `false` disable |
| recvWindow | long | NO |
| timestamp | long | YES |
| signature | string | YES |

**Response**

```json
{
  "data": { "mxDeductEnable": true },
  "code": 0,
  "msg": "success",
  "timestamp": 1669109672280
}
```

---

## Query MX deduct status

**`GET /api/v3/mxDeduct/enable`**

| | |
|--|--|
| **Permission** | `SPOT_DEAL_READ` |
| **Weight (IP)** | 1 |

**Parameters:** `recvWindow` (optional), `timestamp`, `signature` (required).

---

## Query symbol commission (trade fee)

**`GET /api/v3/tradeFee`**

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_READ` |
| **Weight (IP)** | 20 |

**Parameters**

| Name | Type | Mandatory |
|------|------|-----------|
| symbol | string | YES |
| recvWindow | long | NO |
| timestamp | long | YES |
| signature | string | YES |

**Response**

```json
{
  "data": {
    "makerCommission": 0.003000000000000000,
    "takerCommission": 0.003000000000000000
  },
  "code": 0,
  "msg": "success",
  "timestamp": 1669109672717
}
```

---

## STP strategy groups

Self-trade prevention (STP) uses **strategy groups** on the **master** account. Sub-accounts cannot create/delete groups or add/remove UIDs per MEXC. Max **10** groups per master; group name **unique** per master.

### Create strategy group

**`POST /api/v3/strategy/group`**

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_WRITE` |
| **Weight (IP)** | 20 |

**Parameters:** `tradeGroupName` (YES), `timestamp`, `signature`.

**Response:** `data.tradeGroupName`, `tradeGroupId`, `createTime`, `updateTime`; wrapper `code`, `msg`, `timestamp`.

### Query strategy group

**`GET /api/v3/strategy/group`**

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_READ` |
| **Weight (IP)** | 20 |

**Parameters:** `tradeGroupName` (YES), `timestamp`, `signature`.

**Response:** `data` array of groups; entries may include `tradeGroupUid` (UID list, comma-separated).

### Delete strategy group

**`DELETE /api/v3/strategy/group`**

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_WRITE` (docs may show `SPOT_ACCOUNT_W`) |
| **Weight (IP)** | 20 |

**Parameters:** `tradeGroupId` (YES), `timestamp`, `signature`.

**Response:** `data: true`, `code`, `msg`, `timestamp`.

### Add UID to group

**`POST /api/v3/strategy/group/uid`** *(signed)*

Some MEXC pages mislabel this as GET; the operation is a **create/add** — use **POST**.

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_WRITE` |
| **Weight (IP)** | 20 |

**Parameters**

| Name | Mandatory | Description |
|------|-----------|-------------|
| uid | YES | UID(s), comma-separated if multiple |
| tradeGroupId | YES | Group id (**note:** examples sometimes typo `ttradeGroupId` in query strings) |
| timestamp, signature | YES | |

**Response:** updated group metadata (`tradeGroupName`, `tradeGroupId`, `tradeGroupUid`, times).

### Delete UID from group

**`DELETE /api/v3/strategy/group/uid`**

| | |
|--|--|
| **Permission** | `SPOT_ACCOUNT_WRITE` |
| **Weight (IP)** | 20 |

**Parameters:** `uid` (YES, comma-separated), `tradeGroupId` (YES), `timestamp`, `signature`.

**Response:** `data: true`, `code`, `msg`, `timestamp`.

---

Always confirm paths, permissions, and field names against [MEXC official API documentation](https://mexcdevelop.github.io/apidocs/).
