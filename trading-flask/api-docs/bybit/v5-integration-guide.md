# Bybit V5 — Integration guidance

Synthesized from [Integration Guidance](https://bybit-exchange.github.io/docs/v5/guide) and related V5 pages. For authoritative text and updates, use the official site.

**Related:** [Demo trading](demo-trading-v5.md) · [Place order](place-order-v5.md) · [Set leverage](set-leverage-v5.md) · [Wallet balance](wallet-balance-v5.md) · [Account info](account-info-v5.md) · [Futures trading (V5)](futures-trading-v5.md) · [Introduction](introduction.md)

---

## Regional restriction

> Requests from IP addresses in the **United States** or **Mainland China** receive **403 Forbidden**. Plan hosting and VPN policy accordingly.

---

## API resources & support

| Resource | Link |
|----------|------|
| Help Center | [Bybit Help Center](https://www.bybit.com/help-center) |
| V5 Introduction | [Introduction](https://bybit-exchange.github.io/docs/v5/intro) |
| Official Python SDK (pybit) | [GitHub](https://github.com/bybit-exchange/pybit) |
| Official Go SDK | [GitHub](https://github.com/bybit-exchange/bybit-go-api) |
| Official Java SDK | [GitHub](https://github.com/bybit-exchange/bybit-java-api) |
| Official .NET SDK | [GitHub](https://github.com/bybit-exchange/bybit.net.api) |
| Community Node.js SDK | Listed on [Integration Guidance](https://bybit-exchange.github.io/docs/v5/guide) |
| API usage examples (HMAC/RSA) | [api-usage-examples](https://github.com/bybit-exchange/api-usage-examples) |
| Telegram — API discussion | [BybitAPI](https://t.me/BybitAPI) |
| Discord | Linked from Bybit’s developer hub |
| Postman | Linked from [Integration Guidance](https://bybit-exchange.github.io/docs/v5/guide) |

---

## REST base URLs

| Environment | Base URL |
|-------------|-----------|
| **Testnet** | `https://api-testnet.bybit.com` |
| **Mainnet** | `https://api.bybit.com` or `https://api.bytick.com` |
| **Mainnet demo trading** | `https://api-demo.bybit.com` (keys from **Demo Trading** UI only — see [Demo trading](demo-trading-v5.md)) |

**Jurisdiction-specific mainnet hosts** (per official docs):

| Region | Host |
|--------|------|
| Netherlands | `https://api.bybit.nl` |
| Turkey | `https://api.bybit.tr` |
| Kazakhstan | `https://api.bybit.kz` |
| Georgia | `https://api.bybitgeorgia.ge` |
| United Arab Emirates | `https://api.bybit.ae` |
| EEA | `https://api.bybit.eu` |
| Indonesia | `https://api.bybit.id` |

Create API keys: [testnet API management](https://testnet.bybit.com/app/user/api-management) · [mainnet API management](https://www.bybit.com/app/user/api-management)

---

## API key types

### System-generated (HMAC)

Bybit issues an API key and **secret**. Treat like passwords. Sign requests with **HMAC_SHA256**; signature is **lowercase hex**. Follow [HMAC samples](https://github.com/bybit-exchange/api-usage-examples).

### Auto-generated (RSA)

You generate an RSA key pair; only the **public** key is registered at Bybit (Bybit never holds your private key). Use **RSA_SHA256**; signature is **base64**. Steps:

1. [api-rsa-generator](https://github.com/bybit-exchange/api-rsa-generator)
2. [RSA samples](https://github.com/bybit-exchange/api-usage-examples)

---

## HTTP headers (authenticated requests)

| Header | Purpose |
|--------|---------|
| `X-BAPI-API-KEY` | API key |
| `X-BAPI-TIMESTAMP` | UTC time **milliseconds** |
| `X-BAPI-SIGN` | Request signature |
| `X-BAPI-RECV-WINDOW` | Optional; default **5000** ms; validity window & replay protection |
| `X-Referer` or `Referer` | **Broker users only** |

Smaller `X-BAPI-RECV-WINDOW` is stricter; if network latency exceeds the window, requests fail.

### Timestamp rule

Must satisfy:

```text
server_time - recv_window <= timestamp < server_time + 1000
```

Use [Server time](https://bybit-exchange.github.io/docs/v5/market/time) when reconciling clock skew. **NTP-sync** local time is strongly recommended.

---

## Building the sign payload

1. **Concatenate** (no separators between segments):
   - **GET:** `timestamp` + `api_key` + `recv_window` + `queryString`
   - **POST:** `timestamp` + `api_key` + `recv_window` + `jsonBodyString` (raw JSON body string)
2. Sign with **HMAC_SHA256** (hex lowercase) or **RSA_SHA256** (base64).
3. Send signature in **`X-BAPI-SIGN`**.

### GET example (plain text to sign)

```text
# rule: timestamp + api_key + recv_window + queryString

timestamp = "1658384314791"
api_key = "XXXXXXXXXX"
recv_window = "5000"
queryString = "category=option&symbol=BTC-29JUL22-25000-C"

# string to sign:
"1658384314791XXXXXXXXXX5000category=option&symbol=BTC-29JUL22-25000-C"
```

### POST example (plain text to sign)

```text
timestamp = 1658385579423
api_key = XXXXXXXXXX
recv_window = 5000
jsonBodyString = {"category": "option"}

# string to sign (concatenated):
1658385579423XXXXXXXXXX5000{"category": "option"}
```

### HTTP examples

```http
GET /v5/order/realtime?category=option&symbol=BTC-29JUL22-25000-C HTTP/1.1
Host: api-testnet.bybit.com
X-BAPI-SIGN: <signature>
X-BAPI-API-KEY: <key>
X-BAPI-TIMESTAMP: 1658384431891
X-BAPI-RECV-WINDOW: 5000
```

```http
POST /v5/order/create HTTP/1.1
Host: api-testnet.bybit.com
X-BAPI-SIGN: <signature>
X-BAPI-API-KEY: <key>
X-BAPI-TIMESTAMP: 1658385589135
X-BAPI-RECV-WINDOW: 5000
Content-Type: application/json

{"category": "option"}
```

**Broker:** add `X-Referer` / `Referer` when required.

**Debugging:** optional unique `cdn-request-id` per request (per official tip).

---

## Common response envelope

| Field | Type | Meaning |
|-------|------|---------|
| `retCode` | number | 0 = success; non-zero = error |
| `retMsg` | string | `OK`, `success`, `SUCCESS`, or `""` often mean success |
| `result` | object | Payload |
| `retExtInfo` | object | Extra info (often `{}`) |
| `time` | number | Server time (ms) |

```json
{
  "retCode": 0,
  "retMsg": "OK",
  "result": {},
  "retExtInfo": {},
  "time": 1671017382656
}
```

---

## Next steps

- **Futures REST flows:** [Futures trading (V5)](futures-trading-v5.md)
- **Enums (`category`, `positionIdx`, etc.):** [Enums definitions](https://bybit-exchange.github.io/docs/v5/enum)
- **Rate limits:** [Rate limit](https://bybit-exchange.github.io/docs/v5/rate-limit)
