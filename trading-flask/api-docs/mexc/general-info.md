# MEXC API — General info

> Condensed from MEXC spot API documentation. For live parameter lists and changes, use [MEXC API docs](https://mexcdevelop.github.io/apidocs/).  
> **REST market data:** [Market data endpoints](market-data-endpoints.md) · **Signed spot:** [Spot account & trade](spot-account-trade.md) · **ENUMs:** [Public definitions](enums.md)

## Base endpoint

```
https://api.mexc.com
```

## HTTP return codes

| Code | Meaning |
|------|---------|
| **4xx** | Malformed or client-side issue (sender). |
| **403** | WAF (Web Application Firewall) limit violated. |
| **429** | Request rate limit exceeded. |
| **5xx** | Internal error on MEXC’s side. **Do not treat as definite failure** — execution may still have succeeded; status is **unknown** until reconciled. |

## General rules for endpoints

The API accepts **GET**, **POST**, or **DELETE** (and **PUT** where documented).

- **GET:** Send parameters as a **query string** only.
- **POST / PUT / DELETE:** Parameters may be sent as:
  - query string with `Content-Type: application/x-www-form-urlencoded`, **or**
  - JSON body with `Content-Type: application/json`,  
  or **mixed** (some in query, some in body).
- Parameter **order does not matter**.
- If the same parameter appears in **both** query string and body, the **query string value wins**.

## Headers

| Header | Description |
|--------|-------------|
| `X-MEXC-APIKEY` | Access (API) key |
| `Content-Type` | e.g. `application/json` when using JSON body |

## Signed (`SIGNED`) requests

- Extra parameter: **`signature`**, in query string or body.
- **Batch / special characters:** If values contain characters such as commas, **URL-encode** those values **when signing**; encoding uses **uppercase** hex where applicable (per MEXC spec).
- Algorithm: **HMAC SHA256** with **secretKey** as key and **`totalParams`** as message.
- **`totalParams`:** query string **concatenated with** request body (see mixed example — **no** extra `&` between tail of query and head of body when they abut).
- Signature hex is **lowercase** only.

### Timing security (`timestamp`, `recvWindow`)

A signed request must include **`timestamp`** (milliseconds when the request was built/sent).

Optional **`recvWindow`:** request is valid for that many ms after `timestamp`. If omitted, defaults to **5000**. Maximum **60,000**.

Server-side check (conceptually):

```text
if (timestamp < (serverTime + 1000) && (serverTime - timestamp) <= recvWindow) {
  // accept
} else {
  // reject
}
```

Use a **small** `recvWindow` (e.g. ≤ 5000) for trading; large windows tolerate clock skew and slow networks but widen replay risk.

> **Info**  
> Prefer `recvWindow` **5000 or less**. It **must not** exceed **60,000**.

### Demo credentials (MEXC examples only — replace in production)

| Key | Example value |
|-----|----------------|
| apiKey | `mx0aBYs33eIilxBWC5` |
| secretKey | `45d0b3c26f2644f19bfb98b07741b2f5` |

| Parameter | Example value |
|-----------|----------------|
| symbol | `BTCUSDT` |
| side | `BUY` |
| type | `LIMIT` |
| quantity | `1` |
| price | `11` |
| recvWindow | `5000` |
| timestamp | `1644489390087` |

### `POST /api/v3/order` — signing examples

**Example 1 — all parameters in request body**

`requestBody` (before `signature`):

```text
symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=11&recvWindow=5000&timestamp=1644489390087
```

```bash
echo -n "symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=11&recvWindow=5000&timestamp=1644489390087" | openssl dgst -sha256 -hmac "45d0b3c26f2644f19bfb98b07741b2f5"
# (stdin)= 323c96ab85a745712e95e63cad28903dd8292e4a905e99c4ee3932023843a117
```

```bash
curl -H "X-MEXC-APIKEY: mx0aBYs33eIilxBWC5" -X POST 'https://api.mexc.com/api/v3/order' \
  -d 'symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=11&recvWindow=5000&timestamp=1644489390087&signature=323c96ab85a745712e95e63cad28903dd8292e4a905e99c4ee3932023843a117'
```

**Example 2 — same parameters as query string**

`queryString`:

```text
symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=11&recvWindow=5000&timestamp=1644489390087
```

Same `openssl` input string as Example 1; signature:

```text
fd3e4e8543c5188531eb7279d68ae7d26a573d0fc5ab0d18eb692451654d837a
```

```bash
curl -H "X-MEXC-APIKEY: mx0aBYs33eIilxBWC5" -X POST 'https://api.mexc.com/api/v3/order' \
  -d 'symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=11&recvWindow=5000&timestamp=1644489390087&signature=fd3e4e8543c5188531eb7279d68ae7d26a573d0fc5ab0d18eb692451654d837a'
```

> **Note:** Example 1 and Example 2 use the **same** `totalParams` string for signing, so a correct HMAC SHA256 output should match Example 1’s signature. MEXC’s public docs have shown a second sample signature for the same payload; **trust the digest your own signer produces** for the exact bytes you send.

**Example 3 — mixed query string + body**

- `queryString`: `symbol=BTCUSDT&side=BUY&type=LIMIT`
- `requestBody`: `quantity=1&price=11&recvWindow=5000&timestamp=1644489390087`

`totalParams` is the **concatenation** of query + body. There is **no `&`** between `LIMIT` and `quantity`:

```text
symbol=BTCUSDT&side=BUY&type=LIMITquantity=1&price=11&recvWindow=5000&timestamp=1644489390087
```

```bash
echo -n "symbol=BTCUSDT&side=BUY&type=LIMITquantity=1&price=11&recvWindow=5000&timestamp=1644489390087" | openssl dgst -sha256 -hmac "45d0b3c26f2644f19bfb98b07741b2f5"
# (stdin)= d1a676610ceb39174c8039b3f548357994b2a34139a8addd33baadba65684592
```

```bash
curl -H "X-MEXC-APIKEY: mx0aBYs33eIilxBWC5" -X POST \
  'https://api.mexc.com/api/v3/order?symbol=BTCUSDT&side=BUY&type=LIMIT' \
  -d 'quantity=1&price=11&recvWindow=5000&timestamp=1644489390087&signature=d1a676610ceb39174c8039b3f548357994b2a34139a8addd33baadba65684592'
```

---

## Limits

Rate limits apply; exceeding them yields **429 Too Many Requests**.

- **Keyed endpoints:** limit unit is typically **account (UID)**.
- **Public / no-key endpoints:** limit unit is typically **IP**.
- IP and UID limits are **independent** where both apply.
- Endpoints document **weight**; IP-based routes often cite **300 per 10 seconds**; UID-based routes often cite **500 per 10 seconds** (per MEXC’s published tables — confirm in official docs).

### When you receive 429

- **Back off**; do not retry in a tight loop.
- Repeated abuse can trigger **automatic IP ban** (duration scales with repeats, from minutes to days).
- Responses may include **`Retry-After`** (seconds to wait) on **429** or **418** (ban active).

### WebSocket limits

- About **100 messages/second** per connection (per MEXC documentation).
- Over-limit connections may be **dropped**; repeated drops may lead to **IP ban**.
- One connection may subscribe to up to **30** streams.

---

## Error codes

| Code | Description |
|------|-------------|
| -2011 | Unknown order sent |
| 26 | operation not allowed |
| 400 | api key required |
| 401 | No authority |
| 403 | Access Denied |
| 429 | Too Many Requests |
| 500 | Internal error |
| 503 | service not available, please try again |
| 504 | Gateway Time-out |
| 602 | Signature verification failed |
| 10001 | user does not exist |
| 10007 | bad symbol |
| 10015 | user id cannot be null |
| 10072 | invalid access key |
| 10073 | invalid Request-Time |
| 10095 | amount cannot be null |
| 10096 | amount decimal places is too long |
| 10097 | amount is error |
| 10098 | risk control system detected abnormal |
| 10099 | user sub account does not open |
| 10100 | this currency transfer is not supported |
| 10101 | Insufficient balance |
| 10102 | amount cannot be zero or negative |
| 10103 | this account transfer is not supported |
| 10200 | transfer operation processing |
| 10201 | transfer in failed |
| 10202 | transfer out failed |
| 10206 | transfer is disabled |
| 10211 | transfer is forbidden |
| 10212 | This withdrawal address is not on the commonly used address list or has been invalidated |
| 10216 | no address available. Please try again later |
| 10219 | asset flow writing failed please try again |
| 10222 | currency cannot be null |
| 10232 | currency does not exist |
| 10259 | Intermediate account does not configured in redisredis |
| 10265 | Due to risk control, withdrawal is unavailable, please try again later |
| 10268 | remark length is too long |
| 11444 | This feature is temporarily unavailable. For details, please refer to our official announcement. Thank you for your understanding and cooperation |
| 20001 | subsystem is not supported |
| 20002 | Internal system error please contact support |
| 22222 | record does not exist |
| 30000 | suspended transaction for the symbol |
| 30001 | The current transaction direction is not allowed to place an order |
| 30002 | The minimum transaction volume cannot be less than : |
| 30003 | The maximum transaction volume cannot be greater than : |
| 30004 | Insufficient position |
| 30005 | Oversold |
| 30010 | no valid trade price |
| 30014 | invalid symbol |
| 30016 | trading disabled |
| 30018 | market order is disabled |
| 30019 | api market order is disabled |
| 30020 | no permission for the symbol |
| 30021 | invalid symbol |
| 30025 | no exist opponent order |
| 30026 | invalid order ids |
| 30027 | The currency has reached the maximum position limit, the buying is suspended |
| 30028 | The currency triggered the platform risk control, the selling is suspended |
| 30029 | Cannot exceed the maximum order limit |
| 30032 | Cannot exceed the maximum position |
| 30041 | current order type can not place order |
| 33333 | param is error |
| 44444 | param cannot be null |
| 60005 | your account is abnormal |
| 70011 | Pair user ban trade apikey |
| 700001 | API-key format invalid |
| 700002 | Signature for this request is not valid |
| 700003 | Timestamp for this request is outside of the recvWindow |
| 700004 | Param 'origClientOrderId' or 'orderId' must be sent, but both were empty/null |
| 700005 | recvWindow must less than 60000 |
| 700006 | IP non white list |
| 700007 | No permission to access the endpoint |
| 700008 | Illegal characters found in parameter |
| 730001 | Pair not found |
| 730002 | Your input param is invalid |
| 730000 | Request failed, please contact the customer service |
| 730001 | User information error |
| 730002 | Parameter error |
| 730003 | Unsupported operation, please contact the customer service |
| 730100 | Unusual user status |
| 730600 | Sub-account Name cannot be null |
| 730601 | Sub-account Name must be a combination of 8-32 letters and numbers |
| 730602 | Sub-account remarks cannot be null |
| 730700 | API KEY remarks cannot be null |
| 730701 | API KEY permission cannot be null |
| 730702 | API KEY permission does not exist |
| 730703 | The IP information is incorrect, and a maximum of 10 IPs are allowed to be bound only |
| 730704 | The bound IP format is incorrect, please refill |
| 730705 | At most 30 groups of Api Keys are allowed to be created only |
| 730706 | API KEY information does not exist |
| 730707 | accessKey cannot be null |
| 730101 | The user Name already exists |
| 140001 | sub account does not exist |
| 140002 | sub account is forbidden |
