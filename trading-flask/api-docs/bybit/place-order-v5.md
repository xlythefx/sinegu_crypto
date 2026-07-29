# Bybit V5 — Place order (`POST /v5/order/create`)

Reference for **`POST /v5/order/create`**. Authoritative spec: [Place order](https://bybit-exchange.github.io/docs/v5/order/create-order).

**Related:** [V5 integration guide](v5-integration-guide.md) · [Futures overview](futures-trading-v5.md) · [Set leverage](set-leverage-v5.md) · [Wallet balance](wallet-balance-v5.md) · [Account info](account-info-v5.md) · [Demo trading](demo-trading-v5.md)

---

## Supported products

Spot, margin, **USDT perpetual**, **USDT futures**, **USDC perpetual**, **USDC futures**, **inverse futures**, and **options** — all via this endpoint, controlled by **`category`** and other fields.

---

## `orderType`

| Type | Notes |
|------|--------|
| **Limit** | Requires **qty** and **price**. |
| **Market** | Executes at best available prices until done. **`price`** may be empty. The engine converts market orders to an **IOC-style limit** within a **slippage band** vs **mark price**; if nothing matches within tolerance or liquidity is insufficient, the order may **not fill** or may **cancel**. See [derivative price limit / slippage mechanism](https://announcements.bybit.com/en/article/adjustments-to-bybit-s-derivative-trading-limit-order-mechanism-blt469228de1902fff6/) and [market order slippage tolerance](https://www.bybit.com/en/help-center/article/Market-Order-with-Slippage-Tolerance). |

---

## `timeInForce`

| Value | Role |
|-------|------|
| **GTC** | Good till cancelled (default when not passed; **market** always uses **IOC**) |
| **IOC** | Immediate or cancel |
| **FOK** | Fill or kill |
| **PostOnly** | If it would take immediately, it **cancels**; protects maker intent |
| **RPI** | Retail price improvement; designated MM; post-only vs **Web/APP** flow only |

---

## Conditional orders

If **`triggerPrice`** is set, the order becomes a **conditional** order. Conditional orders **do not reserve margin** until triggered; if margin is insufficient after trigger, the order **cancels**.

**`triggerDirection`** (`linear` / `inverse`):

| Value | Meaning |
|-------|---------|
| **1** | Trigger when price **rises to** `triggerPrice` |
| **2** | Trigger when price **falls to** `triggerPrice` |

For perps/futures: rising scenario needs **`triggerPrice` > market price**; falling scenario needs **`triggerPrice` < market price**.

**`triggerBy`:** `LastPrice`, `IndexPrice`, `MarkPrice` (`linear` / `inverse`).

---

## Take profit / stop loss

TP/SL can be set on placement; you can also adjust TP/SL on the **position** later (see official position/trading-stop docs).

**`tpslMode`** (`linear` / `inverse`):

- **Full** — whole position; then **`tpOrderType`** / **`slOrderType`** must be **Market**.
- **Partial** — partial TP/SL from filled size; **Limit** TP/SL supported; when using limit TP/SL, **`tpslMode`** is required and must be **Partial**.

**`tpTriggerBy` / `slTriggerBy`:** `MarkPrice`, `IndexPrice`, default **`LastPrice`**.

**`reduceOnly`:** when **`true`**, you cannot combine with **take profit / stop loss** on the same request per official rules.

---

## Quantity & price

- **Qty:** string; **positive** only. Perps / futures / options: always **base contract qty**.
- **Spot market buy:** often by **quote** value by default; use **`marketUnit`** (`baseCoin` / `quoteCoin`) to control units.
- **Close with qty `"0"`:** on perps/futures, with **`reduceOnly=true`** and **`closeOnTrigger=true`**, you can close up to **`maxMktOrderQty`** / **`maxOrderQty`** from [instruments-info](https://bybit-exchange.github.io/docs/v5/market/instrument).
- **Limit price:** required for limit. With an open position, price must remain **better than liquidation** where applicable. Min tick from **`priceFilter` → `tickSize`** on [instruments-info](https://bybit-exchange.github.io/docs/v5/market/instrument).

---

## Slippage tolerance (market)

**`slippageToleranceType`:** `TickSize` or `Percent` (not for TP/SL/conditional per official doc).

| Type | Buy cap / sell floor (conceptual) |
|------|-----------------------------------|
| **TickSize** | Buy ≤ ask1 + `slippageTolerance`×tickSize; sell ≥ bid1 − same |
| **Percent** | Buy ≤ ask1×(1 + `slippageTolerance`×0.01); sell ≥ bid1×(1 − …) |

**`slippageTolerance`:** TickSize **integer** in **[1, 10000]**; Percent **[0.01, 10]** with up to **2** decimals.

---

## `orderLinkId`

Optional client id (**≤ 36** chars; letters, digits, `-`, `_`). **Unique** per rules. If both **`orderId`** and **`orderLinkId`** are sent later (e.g. cancel), **`orderId`** wins.

**Options:** `orderLinkId` is **required** and must be unique.

---

## Open-order caps (summary)

| Product | Limit |
|---------|--------|
| **Perps & futures** | **500** active orders **per symbol**; **10** active **conditional** orders per symbol |
| **Spot** | **500** total; max **30** open TP/SL; max **30** open conditional orders **per symbol** |
| **Option** | **50** open orders per **coin** dimension (default) |

---

## Rate limits & risk monitoring

- Trade bucket: [rate limit table](https://bybit-exchange.github.io/docs/v5/rate-limit#trade); higher limits via account manager / institutional flow (linked from official page).
- Bybit may **warn or throttle** if **daily** order count (UTC day, **main + subs** aggregated) exceeds internal thresholds — API use implies acceptance per official notice.

---

## `reduceOnly` splitting

If **`reduceOnly=true`** and **order qty > max single order qty**, the platform may **split** into multiple orders automatically.

---

## HTTP request

```http
POST /v5/order/create HTTP/1.1
Host: api.bybit.com
X-BAPI-SIGN: <signature>
X-BAPI-API-KEY: <key>
X-BAPI-TIMESTAMP: <ms>
X-BAPI-RECV-WINDOW: 5000
Content-Type: application/json

{ ... JSON body ... }
```

Use **`api-testnet.bybit.com`**, **`api-demo.bybit.com`**, or regional hosts per [integration guide](v5-integration-guide.md).

---

## Request parameters

| Parameter | Required | Type | Comments |
|-----------|----------|------|----------|
| category | YES | string | `linear`, `inverse`, `spot`, `option` |
| symbol | YES | string | e.g. `BTCUSDT`; **uppercase** |
| isLeverage | NO | integer | **0** (default) spot; **1** margin (enable margin + collateral first) |
| side | YES | string | `Buy`, `Sell` |
| orderType | YES | string | `Market`, `Limit`, … |
| qty | YES | string | See [Quantity & price](#quantity--price) |
| marketUnit | NO | string | Spot market only: `baseCoin` / `quoteCoin` |
| slippageToleranceType | NO | string | `TickSize`, `Percent` |
| slippageTolerance | NO | string | See [Slippage tolerance](#slippage-tolerance-market) |
| price | NO | string | Required for limit; ignored for market |
| triggerDirection | NO | integer | `1` / `2`; `linear` & `inverse` |
| orderFilter | NO | string | **Spot:** `Order` (default), `tpslOrder`, `StopOrder` |
| triggerPrice | NO | string | Conditional / spot TP-SL trigger |
| triggerBy | NO | string | `LastPrice`, `IndexPrice`, `MarkPrice` (`linear` / `inverse`) |
| orderIv | NO | string | **Options** IV; e.g. 10% → `0.1`; beats `price` if both set |
| timeInForce | NO | string | Market forces **IOC** |
| positionIdx | NO | integer | **0** one-way; **1** hedge buy; **2** hedge sell — **required in hedge mode** |
| orderLinkId | NO | string | Client order id (required + unique for **options**) |
| takeProfit | NO | string | TP price |
| stopLoss | NO | string | SL price |
| tpTriggerBy | NO | string | `linear` / `inverse` |
| slTriggerBy | NO | string | `linear` / `inverse` |
| reduceOnly | NO | boolean | `linear`, `inverse`, `option` |
| closeOnTrigger | NO | boolean | `linear`, `inverse` |
| smpType | NO | string | Self-match prevention type |
| mmp | NO | boolean | **Options** MMP flag |
| tpslMode | NO | string | `Full` / `Partial` (`linear` / `inverse`) |
| tpLimitPrice | NO | string | Limit TP when triggered |
| slLimitPrice | NO | string | Limit SL when triggered |
| tpOrderType | NO | string | `Market` (default) / `Limit` |
| slOrderType | NO | string | `Market` (default) / `Limit` |
| bboSideType | NO | string | `Queue`, `Counterparty` (`linear` / `inverse`) |
| bboLevel | NO | string | `1`–`5` (`linear` / `inverse`) |

---

## Response

| Field | Type | Description |
|-------|------|-------------|
| orderId | string | Exchange order id |
| orderLinkId | string | Echo of client id |

> **Info**  
> HTTP success only means the request was **accepted**. Matching is **asynchronous** — confirm fills / status via **WebSocket** or order queries.

---

## Request body examples

**Spot — limit with market TP/SL**

```json
{
  "category": "spot",
  "symbol": "BTCUSDT",
  "side": "Buy",
  "orderType": "Limit",
  "qty": "0.01",
  "price": "28000",
  "timeInForce": "PostOnly",
  "takeProfit": "35000",
  "stopLoss": "27000",
  "tpOrderType": "Market",
  "slOrderType": "Market"
}
```

**Spot — limit with limit TP/SL**

```json
{
  "category": "spot",
  "symbol": "BTCUSDT",
  "side": "Buy",
  "orderType": "Limit",
  "qty": "0.01",
  "price": "28000",
  "timeInForce": "PostOnly",
  "takeProfit": "35000",
  "stopLoss": "27000",
  "tpLimitPrice": "36000",
  "slLimitPrice": "27500",
  "tpOrderType": "Limit",
  "slOrderType": "Limit"
}
```

**Spot — PostOnly**

```json
{
  "category": "spot",
  "symbol": "BTCUSDT",
  "side": "Buy",
  "orderType": "Limit",
  "qty": "0.1",
  "price": "15600",
  "timeInForce": "PostOnly",
  "orderLinkId": "spot-test-01",
  "isLeverage": 0,
  "orderFilter": "Order"
}
```

**Spot — TP/SL order filter**

```json
{
  "category": "spot",
  "symbol": "BTCUSDT",
  "side": "Buy",
  "orderType": "Limit",
  "qty": "0.1",
  "price": "15600",
  "triggerPrice": "15000",
  "timeInForce": "Limit",
  "orderLinkId": "spot-test-02",
  "isLeverage": 0,
  "orderFilter": "tpslOrder"
}
```

**Spot — margin (UTA)**

```json
{
  "category": "spot",
  "symbol": "BTCUSDT",
  "side": "Buy",
  "orderType": "Limit",
  "qty": "0.1",
  "price": "15600",
  "timeInForce": "GTC",
  "orderLinkId": "spot-test-limit",
  "isLeverage": 1,
  "orderFilter": "Order"
}
```

**Spot — market buy (qty in quote)**

```json
{
  "category": "spot",
  "symbol": "BTCUSDT",
  "side": "Buy",
  "orderType": "Market",
  "qty": "200",
  "timeInForce": "IOC",
  "orderLinkId": "spot-test-04",
  "isLeverage": 0,
  "orderFilter": "Order"
}
```

**USDT perp — open long (one-way)**

```json
{
  "category": "linear",
  "symbol": "BTCUSDT",
  "side": "Buy",
  "orderType": "Limit",
  "qty": "1",
  "price": "25000",
  "timeInForce": "GTC",
  "positionIdx": 0,
  "orderLinkId": "usdt-test-01",
  "reduceOnly": false,
  "takeProfit": "28000",
  "stopLoss": "20000",
  "tpslMode": "Partial",
  "tpOrderType": "Limit",
  "slOrderType": "Limit",
  "tpLimitPrice": "27500",
  "slLimitPrice": "20500"
}
```

**USDT perp — close long (one-way)**

```json
{
  "category": "linear",
  "symbol": "BTCUSDT",
  "side": "Sell",
  "orderType": "Limit",
  "qty": "1",
  "price": "30000",
  "timeInForce": "GTC",
  "positionIdx": 0,
  "orderLinkId": "usdt-test-02",
  "reduceOnly": true
}
```

---

## Response example

```json
{
  "retCode": 0,
  "retMsg": "OK",
  "result": {
    "orderId": "1321003749386327552",
    "orderLinkId": "spot-test-postonly"
  },
  "retExtInfo": {},
  "time": 1672211918471
}
```
