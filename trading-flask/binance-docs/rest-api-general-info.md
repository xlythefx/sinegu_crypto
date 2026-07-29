# REST API General Info

Short reference for Binance USD-M Futures REST API. Full docs: [Binance USD-M Futures General Info](https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info).

## Endpoints

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://fapi.binance.com` |
| **Testnet** | `https://demo-fapi.binance.com` |

- Responses: JSON object or array.
- Data order: ascending (oldest first).
- Timestamps: milliseconds (UTC).
- Data types: JAVA definitions.

## Request rules

| Method | Parameters |
|--------|------------|
| **GET** | Query string only |
| **POST / PUT / DELETE** | Query string **or** body (`application/x-www-form-urlencoded`), or both |
| Conflict | Query string wins if same param in both |

Parameters may be sent in any order.

## HTTP return codes

| Code | Meaning |
|------|---------|
| **4XX** | Malformed request (sender) |
| **403** | WAF limit violated |
| **408** | Timeout waiting for backend |
| **429** | Rate limit exceeded; back off |
| **418** | IP auto-banned (after repeated 429) |
| **5XX** | Internal error (Binance); retry later if "Request occur unknown error." |

### 503 variants

| Message | Meaning | Action |
|---------|--------|--------|
| "Unknown error, please check your request or try again later." | Execution status **unknown** (timeout) | Do not treat as failure; verify via WebSocket or orderId to avoid duplicates. Prefer single orders in peaks. |
| "Service Unavailable." | **Failure** | Retry with exponential backoff (e.g. 200ms → 400ms → 800ms, max 3–5). |
| "Internal error; unable to process your request. Please try again." | **Failure** | Resend if needed. |
| "Request throttled by system-level protection... (-1008)" | **Failure** (overload) | Retry with backoff, reduce concurrency. **Exempt:** reduce-only / close-position orders. |

## Error payload

```json
{
  "code": -1121,
  "msg": "Invalid symbol."
}
```

See Binance **Error Codes** for full list.

## SDKs (unofficial)

- **Python:** [binance-connector-python](https://github.com/binance/binance-connector-python) — `pip install binance-sdk-derivatives-trading-usds-futures`
- **Java:** [binance-connector-java](https://github.com/binance/binance-connector-java)

Disclaimer: SDKs are from partners/users; use with caution.

## Limits

- **Source:** `/fapi/v1/exchangeInfo` → `rateLimits` (RAW_REQUEST, REQUEST_WEIGHT, ORDER).
- **429** when any limit violated.
- **IP limits:** Per-IP; response header `X-MBX-USED-WEIGHT-(intervalNum)(intervalLetter)`. Heavier routes = higher weight. Back off on 429; repeated violations → IP ban (418, 2 min to 3 days).
- **Order limits:** Per account; header `X-MBX-ORDER-COUNT-(intervalNum)(intervalLetter)`. Rejected orders may not include this header.
- Prefer **WebSocket** for data to reduce REST pressure.

## Security types

| Type | Description |
|------|-------------|
| **NONE** | No auth |
| **TRADE** | API-Key + signature |
| **USER_DATA** | API-Key + signature |
| **USER_STREAM** | API-Key only |
| **MARKET_DATA** | API-Key only |

- API-Key in header: `X-MBX-APIKEY`.
- API-keys and secret-keys are **case sensitive**.
- **TRADE** and **USER_DATA** are **SIGNED** (signature required).

## SIGNED endpoints (TRADE / USER_DATA)

- **signature** in query string or body (end of string).
- **totalParams** = query string concatenated with request body (used for HMAC).
- **timestamp** (ms) required; **recvWindow** (ms) optional, default 5000.

Validation:

```text
timestamp < serverTime + 1000  &&  serverTime - timestamp <= recvWindow  →  process
else  →  reject
```

Recommendation: use small `recvWindow` (e.g. 5000 or less).

### HMAC SHA256 (secret key)

- Sign: `HMAC-SHA256(secretKey, totalParams)`.
- **totalParams**: params sorted and joined with `&` (e.g. `symbol=BTCUSDT&side=BUY&...&timestamp=...`).
- Signature is not case sensitive.

**Example (query string):**

```bash
# Payload (params sorted, no signature)
queryString="symbol=BTCUSDT&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=9000&recvWindow=5000&timestamp=1591702613943"

# Signature
echo -n "$queryString" | openssl dgst -sha256 -hmac "YOUR_SECRET_KEY"

# Request
curl -H "X-MBX-APIKEY: YOUR_API_KEY" -X POST "https://fapi.binance.com/fapi/v1/order?${queryString}&signature=SIGNATURE"
```

**Mixed query + body:** Signature uses **both** concatenated (queryString + requestBody); order of params in each part does not change the sort for the payload. Note: no `&` between last query param and first body param when concatenating literally (see Binance example 3).

### RSA (PKCS#8)

- Supported: RSASSA-PKCS1-v1_5 with SHA-256; upload public key to get API key.
- Payload: same (params sorted, `&`-joined).
- Sign with private key; encode output as base64; remove newlines; URL-encode if needed for query/body.
- Private key file: e.g. `test-prv-key.pem` — **do not share**.

---

## Quick reference (this project)

- **Klines (no auth):** `GET https://fapi.binance.com/fapi/v1/klines?symbol=XAUUSDT&interval=1h&limit=500`
- **Testnet klines:** `GET https://demo-fapi.binance.com/fapi/v1/klines?symbol=XAUUSDT&interval=1h&limit=500`
- Config: [../config.py](../config.py) — `BASE_URL`, `SYMBOLS`, etc.
