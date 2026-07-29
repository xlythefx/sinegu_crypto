# TRADE: New Order (WebSocket vs REST)

Reference for placing a new order on Binance USD-M Futures: **WebSocket** `order.place` vs **REST** `POST /fapi/v1/order`.

## WebSocket vs REST

| Aspect | WebSocket | REST |
|--------|-----------|------|
| **Endpoint** | `order.place` (after connect + optional `session.logon`) | `POST /fapi/v1/order` |
| **Connection** | One persistent connection; send JSON frames | One HTTP request per order |
| **Auth** | `apiKey` + `signature` in `params`, or after `session.logon` | Header `X-MBX-APIKEY` + `signature` in query/body |
| **Request weight** | 0 (order.place) | 1 on 10s/1min order limits; 0 on IP weight |
| **Best for** | Many orders, low latency, same connection for streams | Simple scripts, few orders, no WebSocket setup |
| **Rate limits** | Shared with REST (ORDER + REQUEST_WEIGHT) | Same; headers `X-MBX-ORDER-COUNT-10S`, `X-MBX-ORDER-COUNT-1M` |

Both require **TRADE** security (API key + signature). Parameters and response shape are aligned; WebSocket wraps them in `id`, `method`, `params` and returns `id`, `status`, `result` / `error`, `rateLimits`.

---

## WebSocket: New Order

**Method:** `order.place`  
**Request weight:** 0 (counts on ORDER rate limiters).

### Request example

```json
{
  "id": "3f7df6e3-2df4-44b9-9919-d2f38f90a99a",
  "method": "order.place",
  "params": {
    "apiKey": "YOUR_API_KEY",
    "positionSide": "BOTH",
    "price": "43187.00",
    "quantity": "0.1",
    "side": "BUY",
    "symbol": "BTCUSDT",
    "timeInForce": "GTC",
    "timestamp": 1702555533821,
    "type": "LIMIT",
    "signature": "YOUR_SIGNATURE"
  }
}
```

### Request parameters (main)

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | STRING | YES | e.g. BTCUSDT, XAUUSDT |
| side | ENUM | YES | BUY, SELL |
| type | ENUM | YES | LIMIT, MARKET, STOP, STOP_MARKET, TAKE_PROFIT, TAKE_PROFIT_MARKET, TRAILING_STOP_MARKET |
| positionSide | ENUM | NO | BOTH (One-way), or LONG/SHORT (Hedge) |
| timeInForce | ENUM | NO | GTC, IOC, FOK, GTD |
| quantity | DECIMAL | NO* | *Not with closePosition=true |
| price | DECIMAL | NO | For LIMIT / STOP / TAKE_PROFIT |
| reduceOnly | STRING | NO | "true" / "false"; default "false". Not in Hedge Mode; not with closePosition |
| newClientOrderId | STRING | NO | Unique among open orders; auto-generated if omitted |
| stopPrice | DECIMAL | NO | For STOP / STOP_MARKET / TAKE_PROFIT / TAKE_PROFIT_MARKET |
| closePosition | STRING | NO | "true"/"false"; Close-All with STOP_MARKET/TAKE_PROFIT_MARKET |
| activationPrice | DECIMAL | NO | TRAILING_STOP_MARKET |
| callbackRate | DECIMAL | NO | TRAILING_STOP_MARKET; 0.1–10 (1 = 1%) |
| workingType | ENUM | NO | MARK_PRICE, CONTRACT_PRICE (default) |
| priceProtect | STRING | NO | "TRUE"/"FALSE"; for conditional orders |
| newOrderRespType | ENUM | NO | ACK (default), RESULT |
| priceMatch | ENUM | NO | OPPONENT, QUEUE, etc.; not with price |
| selfTradePreventionMode | ENUM | NO | NONE, EXPIRE_TAKER, EXPIRE_MAKER, EXPIRE_BOTH |
| goodTillDate | LONG | NO | For GTD; cancel time (ms, second precision) |
| recvWindow | LONG | NO | Optional |
| timestamp | LONG | YES | ms |
| signature | STRING | YES | HMAC SHA256 or Ed25519 (WebSocket supports Ed25519) |

### Additional mandatory params by type

| Type | Additional mandatory |
|------|----------------------|
| LIMIT | timeInForce, quantity, price or priceMatch |
| MARKET | quantity |
| STOP / TAKE_PROFIT | quantity, stopPrice, price or priceMatch |
| STOP_MARKET / TAKE_PROFIT_MARKET | stopPrice |
| TRAILING_STOP_MARKET | callbackRate |

STOP/TAKE_PROFIT can send timeInForce (default GTC).

### Trigger conditions (conditional orders)

- **STOP / STOP_MARKET:** BUY → latest price ≥ stopPrice; SELL → latest price ≤ stopPrice  
- **TAKE_PROFIT / TAKE_PROFIT_MARKET:** BUY → latest price ≤ stopPrice; SELL → latest price ≥ stopPrice  
- **TRAILING_STOP_MARKET:** BUY → lowest price ≤ activationPrice and latest ≥ lowest × (1 + callbackRate); SELL → highest ≥ activationPrice and latest ≤ highest × (1 - callbackRate)  
- **priceProtect=true:** trigger also checks symbol `triggerProtect` (from `GET /fapi/v1/exchangeInfo`).

TRAILING_STOP_MARKET: BUY → activationPrice &lt; latest price; SELL → activationPrice &gt; latest price; else -2021 "Order would immediately trigger."

### closePosition=true (Close-All)

- Allowed with STOP_MARKET, TAKE_PROFIT_MARKET. Same trigger rules as above.
- Triggered: close all long (SELL) or short (BUY). No quantity/reduceOnly.
- Hedge: no BUY for LONG side, no SELL for SHORT side.

### newOrderRespType=RESULT

- MARKET: final FILLED result in response.
- LIMIT with special timeInForce: final FILLED or EXPIRED in response.

### Response example (success)

```json
{
  "id": "3f7df6e3-2df4-44b9-9919-d2f38f90a99a",
  "status": 200,
  "result": {
    "orderId": 325078477,
    "symbol": "BTCUSDT",
    "status": "NEW",
    "clientOrderId": "iCXL1BywlBaf2sesNUrVl3",
    "price": "43187.00",
    "avgPrice": "0.00",
    "origQty": "0.100",
    "executedQty": "0.000",
    "cumQty": "0.000",
    "cumQuote": "0.00000",
    "timeInForce": "GTC",
    "type": "LIMIT",
    "reduceOnly": false,
    "closePosition": false,
    "side": "BUY",
    "positionSide": "BOTH",
    "stopPrice": "0.00",
    "workingType": "CONTRACT_PRICE",
    "priceProtect": false,
    "origType": "LIMIT",
    "priceMatch": "NONE",
    "selfTradePreventionMode": "NONE",
    "goodTillDate": 0,
    "updateTime": 1702555534435
  },
  "rateLimits": [
    { "rateLimitType": "ORDERS", "interval": "SECOND", "intervalNum": 10, "limit": 300, "count": 1 },
    { "rateLimitType": "ORDERS", "interval": "MINUTE", "intervalNum": 1, "limit": 1200, "count": 1 },
    { "rateLimitType": "REQUEST_WEIGHT", "interval": "MINUTE", "intervalNum": 1, "limit": 2400, "count": 1 }
  ]
}
```

---

## REST: New Order

**HTTP:** `POST /fapi/v1/order`  
**Request weight:** 1 on 10s order limit (`X-MBX-ORDER-COUNT-10S`), 1 on 1min order limit (`X-MBX-ORDER-COUNT-1M`), 0 on IP weight (`x-mbx-used-weight-1m`).

### Request parameters (main)

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | STRING | YES | e.g. BTCUSDT, XAUUSDT |
| side | ENUM | YES | BUY, SELL |
| type | ENUM | YES | LIMIT, MARKET, STOP, STOP_MARKET, TAKE_PROFIT, TAKE_PROFIT_MARKET, TRAILING_STOP_MARKET |
| positionSide | ENUM | NO | BOTH (default One-way), LONG/SHORT (Hedge) |
| timeInForce | ENUM | NO | GTC, IOC, FOK, GTD |
| quantity | DECIMAL | NO | Not with closePosition=true |
| price | DECIMAL | NO | For LIMIT etc. |
| reduceOnly | STRING | NO | "true"/"false"; not in Hedge Mode |
| newClientOrderId | STRING | NO | Unique; auto if omitted |
| newOrderRespType | ENUM | NO | ACK (default), RESULT |
| priceMatch | ENUM | NO | Not with price |
| selfTradePreventionMode | ENUM | NO | EXPIRE_TAKER, EXPIRE_MAKER, EXPIRE_BOTH; default EXPIRE_MAKER |
| goodTillDate | LONG | NO | For GTD |
| recvWindow | LONG | NO | Optional |
| timestamp | LONG | YES | ms |

Send as **query string** or **body** (`application/x-www-form-urlencoded`). Add **signature** (end of query or body). Header: **X-MBX-APIKEY**.

### Additional mandatory params by type (REST)

| Type | Additional mandatory |
|------|----------------------|
| LIMIT | timeInForce, quantity, price |
| MARKET | quantity |

(REST doc subset; other types follow same logic as WebSocket.)

### newOrderRespType=RESULT (REST)

- MARKET: final FILLED in response.
- LIMIT with special timeInForce: final FILLED or EXPIRED.

selfTradePreventionMode applies when timeInForce is IOC, GTC, or GTD. GTD cancel may be delayed in extreme conditions.

### Response example (REST)

Same shape as WebSocket `result` (order object). Example:

```json
{
  "clientOrderId": "testOrder",
  "cumQty": "0",
  "cumQuote": "0",
  "executedQty": "0",
  "orderId": 22542179,
  "avgPrice": "0.00000",
  "origQty": "10",
  "price": "0",
  "reduceOnly": false,
  "side": "BUY",
  "positionSide": "SHORT",
  "status": "NEW",
  "stopPrice": "9300",
  "closePosition": false,
  "symbol": "BTCUSDT",
  "timeInForce": "GTD",
  "type": "TRAILING_STOP_MARKET",
  "origType": "TRAILING_STOP_MARKET",
  "updateTime": 1566818724722,
  "workingType": "CONTRACT_PRICE",
  "priceProtect": false,
  "priceMatch": "NONE",
  "selfTradePreventionMode": "NONE",
  "goodTillDate": 1693207680000
}
```

---

## Quick comparison

| | WebSocket | REST |
|---|-----------|------|
| **Place order** | `order.place` with params in JSON frame | `POST /fapi/v1/order` with query or body |
| **Auth** | params: apiKey, timestamp, signature (or session.logon) | Header X-MBX-APIKEY; query/body: timestamp, signature |
| **Order types** | Full set (incl. STOP_MARKET, TRAILING_STOP_MARKET, closePosition) | Same |
| **Response** | Wrapped in id, status, result, rateLimits | Raw order JSON |

See [REST API General Info](rest-api-general-info.md) for SIGNED (HMAC/RSA) and [WebSocket API General Info](websocket-api-general-info.md) for connection and session auth.
