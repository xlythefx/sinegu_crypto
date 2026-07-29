# MEXC Futures — Integration Guide

Condensed from MEXC’s futures Open API materials. For live paths, hosts, and parameter lists, confirm against [MEXC’s official API documentation](https://mexcdevelop.github.io/apidocs/).

## Access URL

Base host (as provided in the integration materials):

`https://api.mexc.com`

> **Note (2026-01-19):** MEXC’s [futures update log](https://www.mexc.com/api-docs/futures/update-log) states the futures API domain is **`https://api.mexc.com`**. Older **`contract.mexc.com`** requests may return **403** HTML (“Access Denied”) from the edge network, not a JSON API error.

## Common response structure

### Success example

```json
{
  "success": true,
  "code": 0,
  "data": {
    "symbol": "BTC_USD",
    "fairPrice": 8000,
    "timestamp": 1587442022003
  }
}
```

### Error example

```json
{
  "success": false,
  "code": 500,
  "message": "系统内部错误!"
}
```

## Request format

The Open API supports three request sources: **APP**, **WEB**, and **OPEN-API**. Endpoints accept **GET**, **POST**, or **DELETE**.

| Aspect | Rule |
|--------|------|
| **POST** | `Content-Type: application/json`. Business parameters are sent as JSON (**camelCase** property names). |
| **GET** | Parameters are sent as query parameters (**snake_case** with `_` between words, per platform rules). |

Each request source uses a different authentication model.

### Public endpoints

No authorization or signatures.

### Private endpoints

- **WEB / APP:** Send `Authorization` in the header with the corresponding token.
- **OPEN-API:** Send headers **`ApiKey`**, **`Request-Time`**, **`Signature`**, and optionally **`Recv-Window`**.

### OPEN-API signing (Signature)

1. **Build the parameter string to sign**
   - If there are **no** parameters, use `""`.
   - **GET / DELETE:** Sort business parameters in dictionary order, join with `&`, and use that string. For batch APIs, if values contain commas or other special characters, **URL-encode** them when signing.
   - **POST:** The string to sign is the **JSON body** as sent (no dictionary sorting of keys for signing).

2. **String to sign**

   `accessKey + timestamp + parameterString`

   - `timestamp` here is the same value you will send as **`Request-Time`** (milliseconds, as a string).

3. **Compute signature**

   Sign the target string with **HMAC-SHA256** using your **Secret key**. Put the result in the **`Signature`** header.

4. **Exclusions**

   - Business parameters that are **null** are **not** included in the signature.
   - **Path parameters** are excluded from the signature.

5. **GET and null parameters**

   If a GET parameter is null, the backend may treat it as `""`. For GET requests, **omit** null parameters, or align empty-string handling when signing; otherwise verification can fail.

6. **Sending the request**

   - **`Request-Time`:** the `req_time` value used when signing (milliseconds, string).
   - **`Signature`:** the HMAC-SHA256 output.
   - **`ApiKey`:** your API key’s **Access Key**.
   - Other business parameters: as usual (query for GET, JSON body for POST).

## Time security

Signed endpoints require **`Request-Time`**: server time in **milliseconds**, as a **string**.

The server checks a time window around its own clock. If **`Request-Time`** is more than **10 seconds** behind or ahead (default), the request is rejected.

You may widen the window with the optional **`Recv-Window`** header (max **60**; values above **30** seconds are not recommended).

## Create API key

Users create API keys in the MEXC user center. Each key has:

- **Access key** — sent as `ApiKey` (OPEN-API).
- **Secret key** — used only for signing; never expose it.

[Create an API key](https://www.mexc.com/user/openapi) (user center / Open API).

### Futures permissions and KYC

To create or enable permissions related to **futures order placement**, the account must complete **KYC**. Accounts without KYC may still create keys but may be unable to enable or use futures trading permissions.

### IP binding

You can bind **IP addresses** to the key. Keys **without** IP binding are valid for **90 days**. Binding IPs is **strongly recommended**.

### Renewal

**5 days** before expiry, extend validity by **90 days** in **My API Key → Action → Renew**.

### Security

The Access key and Secret key control account access. **Never disclose them.** If compromised, revoke the key and create a new one.

## Internationalization support

Pass a **Language** value in the **request header** to receive localized API messages where supported.

| Behavior | Detail |
|----------|--------|
| **Omitted** | Default language is **Chinese**. |
| **Unsupported value** | Falls back to **English**. |
| **Supported languages** | Chinese, English, Japanese, Korean, French |

Confirm the exact **header name** and **allowed values** (for example locale codes) in the published futures Open API reference; naming may vary by product version.

## Error codes

Responses include a numeric **`code`** on failure. The full table (English descriptions as in MEXC materials) is maintained here:

**[MEXC Futures — error codes](futures-error-codes.md)**

**[MEXC Futures — market data (public)](futures-market-endpoints.md)**

**[MEXC Futures — account & trading (private)](futures-account-trading-endpoints.md)**

---

**Related (spot in this repo):** [Introduction](introduction.md) · [General info](general-info.md) · [Spot account & trade](spot-account-trade.md)
