# WebSocket API General Info

Binance USD-M Futures WebSocket API reference (production and testnet).

## Endpoints

| Environment | Base endpoint |
|-------------|---------------|
| **Production** | `wss://ws-fapi.binance.com/ws-fapi/v1` |
| **Testnet** | `wss://testnet.binancefuture.com/ws-fapi/v1` |

## Connection lifetime and ping/pong

- A single connection is valid for **24 hours**; expect disconnection after that.
- The server sends a **ping frame every 3 minutes**.
- If the server does not receive a **pong** within **10 minutes**, the connection is disconnected.
- When you receive a ping, send a **pong** with a **copy of the ping’s payload** as soon as possible.
- Unsolicited pong frames are allowed; payload can be empty (and does not prevent disconnection).

## Conventions

- **Signature payload**: Generate by taking all request params except `signature`, sorted by name (alphabetical).
- **Lists**: Returned in chronological order unless noted.
- **Timestamps**: Milliseconds, UTC.
- **Case**: Field names and values are case-sensitive unless noted.
- **Types**: `INT` (e.g. `timestamp`) as JSON integers; `DECIMAL` (e.g. `price`) as JSON strings, not floats.
- **User Data Streams**: Require a **separate** WebSocket connection.

---

## Request format

Send requests as **JSON in text frames**, one request per frame.

### Request fields

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| `id` | INT / STRING / null | YES | Arbitrary ID to match responses to requests |
| `method` | STRING | YES | Request method name |
| `params` | OBJECT | NO | Request parameters (omit if none) |

- `id` is arbitrary (UUIDs, sequential IDs, timestamp, etc.); server echoes it back.
- Method names may be versioned, e.g. `"v3/order.place"`.
- Order of `params` is not significant.

### Example request

```json
{
  "id": "9ca10e58-7452-467e-9454-f669bb9c764e",
  "method": "order.place",
  "params": {
    "apiKey": "yeqKcXjtA9Eu4Tr3nJk61UJAGzXsEmFqqfVterxpMpR4peNfqE7Zl7oans8Qj089",
    "price": "42088.0",
    "quantity": "0.1",
    "recvWindow": 5000,
    "side": "BUY",
    "signature": "996962a19802b5a09d7bc6ab1524227894533322a2f8a1f8934991689cabf8fe",
    "symbol": "BTCUSDT",
    "timeInForce": "GTC",
    "timestamp": 1705311512994,
    "type": "LIMIT"
  }
}
```

---

## Response format

Responses are **JSON in text frames**, one per frame.

### Response fields

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| `id` | INT / STRING / null | YES | Same as in the request |
| `status` | INT | YES | Response status (see status codes) |
| `result` | OBJECT / ARRAY | YES | Response body when request succeeded |
| `error` | OBJECT | YES | Error details when request failed |
| `rateLimits` | ARRAY | NO | Rate limit info (see Rate limits) |

### Example: successful response

```json
{
  "id": "43a3843a-2321-4e45-8f79-351e5c354563",
  "status": 200,
  "result": {
    "orderId": 336829446,
    "symbol": "BTCUSDT",
    "status": "NEW",
    "clientOrderId": "FqEw6cn0vDhrkmfiwLYPeo",
    "price": "42088.00",
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
    "updateTime": 1705385954229
  },
  "rateLimits": [
    {
      "rateLimitType": "REQUEST_WEIGHT",
      "interval": "MINUTE",
      "intervalNum": 1,
      "limit": 2400,
      "count": 1
    },
    {
      "rateLimitType": "ORDERS",
      "interval": "SECOND",
      "intervalNum": 10,
      "limit": 300,
      "count": 1
    },
    {
      "rateLimitType": "ORDERS",
      "interval": "MINUTE",
      "intervalNum": 1,
      "limit": 1200,
      "count": 0
    }
  ]
}
```

### Example: failed response

```json
{
  "id": "5761b939-27b1-4948-ab87-4a372a3f6b72",
  "status": 400,
  "error": {
    "code": -1102,
    "msg": "Mandatory parameter 'quantity' was not sent, was empty/null, or malformed."
  },
  "rateLimits": [
    {
      "rateLimitType": "REQUEST_WEIGHT",
      "interval": "MINUTE",
      "intervalNum": 1,
      "limit": 2400,
      "count": 1
    },
    {
      "rateLimitType": "ORDERS",
      "interval": "SECOND",
      "intervalNum": 10,
      "limit": 300,
      "count": 1
    },
    {
      "rateLimitType": "ORDERS",
      "interval": "MINUTE",
      "intervalNum": 1,
      "limit": 1200,
      "count": 1
    }
  ]
}
```

---

## Rate limits

- Same as REST API and **shared** with REST API.
- **WebSocket handshake**: 5 weight.
- **Ping/pong**: max 5 per second.
- `rateLimits` is included in responses by default.
- Control visibility: `returnRateLimits` in connection string or per request.
  - Hide by default: `wss://ws-fapi.binance.com/ws-fapi/v1?returnRateLimits=false`
  - Show in a single request: pass `"returnRateLimits": true` in that request.

---

## Authenticate after connection

Use **session** methods on an already open connection:

| Method | Description |
|--------|-------------|
| `session.logon` | Authenticate (or change the API key for the connection) |
| `session.status` | Check connection status and current API key |
| `session.logout` | Clear the API key for the connection |

### session.logon (SIGNED)

Authenticate the WebSocket with an API key. After `session.logon`, you can omit `apiKey` and `signature` for later requests that need them. Only **one** API key per connection; calling `session.logon` again **replaces** it.

**Weight:** 2  
**Method:** `"session.logon"`

| Parameter | Type | Mandatory | Description |
|-----------|------|-----------|-------------|
| apiKey | STRING | YES | API key |
| signature | STRING | YES | Signature |
| timestamp | INT | YES | Timestamp (ms) |
| recvWindow | INT | NO | Optional |

**Request example:**

```json
{
  "id": "c174a2b1-3f51-4580-b200-8528bd237cb7",
  "method": "session.logon",
  "params": {
    "apiKey": "vmPUZE6mv9SD5VNHk4HlWFsOr6aKE2zvsw0MuIgwCIPy6utIco14y7Ju91duEh8A",
    "signature": "1cf54395b336b0a9727ef27d5d98987962bc47aca6e13fe978612d0adee066ed",
    "timestamp": 1649729878532
  }
}
```

**Response example:**

```json
{
  "id": "c174a2b1-3f51-4580-b200-8528bd237cb7",
  "status": 200,
  "result": {
    "apiKey": "vmPUZE6mv9SD5VNHk4HlWFsOr6aKE2zvsw0MuIgwCIPy6utIco14y7Ju91duEh8A",
    "authorizedSince": 1649729878532,
    "connectedSince": 1649729873021,
    "returnRateLimits": false,
    "serverTime": 1649729878630
  }
}
```

### session.status

Check which API key (if any) is authenticated.

**Weight:** 2  
**Method:** `"session.status"`  
**Parameters:** None

**Request:**

```json
{
  "id": "b50c16cd-62c9-4e29-89e4-37f10111f5bf",
  "method": "session.status"
}
```

**Response:** Same shape as `session.logon` result; `apiKey` and `authorizedSince` are `null` if not authenticated.

### session.logout

Clear the authenticated API key. Connection stays open; later requests that need auth must send `apiKey` and `signature` explicitly.

**Weight:** 2  
**Method:** `"session.logout"`  
**Parameters:** None

**Request:**

```json
{
  "id": "c174a2b1-3f51-4580-b200-8528bd237cb7",
  "method": "session.logout"
}
```

**Response example:**

```json
{
  "id": "c174a2b1-3f51-4580-b200-8528bd237cb7",
  "status": 200,
  "result": {
    "apiKey": null,
    "authorizedSince": null,
    "connectedSince": 1649729873021,
    "returnRateLimits": false,
    "serverTime": 1649730611671
  }
}
```

---

## API key revocation

If the API key becomes invalid (e.g. IP not whitelisted, key deleted, wrong permissions), the **next request** will revoke the session with:

```json
{
  "id": null,
  "status": 401,
  "error": {
    "code": -2015,
    "msg": "Invalid API-key, IP, or permissions for action."
  }
}
```

---

## Authorize ad hoc requests

Only one API key can be authenticated per connection. You can still send **another** API key (and signature) on individual requests to authorize that request with a different key (e.g. default USER_DATA key, TRADE key only for orders).

---

## SIGNED requests (Ed25519)

**Note:** Only **Ed25519** keys are supported for WebSocket SIGNED authentication.

### Parameter example

| Parameter | Value |
|-----------|--------|
| symbol | BTCUSDT |
| side | SELL |
| type | LIMIT |
| timeInForce | GTC |
| quantity | 1 |
| price | 0.2 |
| timestamp | 1668481559918 |

### Python example (Ed25519)

```python
#!/usr/bin/env python3

import base64
import time
import json
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from websocket import create_connection

# Set up authentication
API_KEY = 'put your own API Key here'
PRIVATE_KEY_PATH = 'test-prv-key.pem'

with open(PRIVATE_KEY_PATH, 'rb') as f:
    private_key = load_pem_private_key(data=f.read(), password=None)

params = {
    'apiKey': API_KEY,
    'symbol': 'BTCUSDT',
    'side': 'SELL',
    'type': 'LIMIT',
    'timeInForce': 'GTC',
    'quantity': '1.0000000',
    'price': '0.20'
}

timestamp = int(time.time() * 1000)
params['timestamp'] = timestamp

# Sign: payload = params sorted by name, joined with &
payload = '&'.join([f'{k}={v}' for k, v in sorted(params.items())])
signature = base64.b64encode(private_key.sign(payload.encode('ASCII')))
params['signature'] = signature.decode('ASCII')

request = {
    'id': 'my_new_order',
    'method': 'order.place',
    'params': params
}

ws = create_connection("wss://ws-fapi.binance.com/ws-fapi/v1")
ws.send(json.dumps(request))
result = ws.recv()
ws.close()

print(result)
```

---

## See also

- [Binance USD-M Futures WebSocket API](https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-api-general-info)
- REST klines (this project): [config.py](../config.py), [binance_client.py](../binance_client.py)
