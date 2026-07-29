# Binance Flask — Binance API Reference

## Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/fapi/v3/account` | GET | Account info (positions, assets) |
| `/fapi/v3/balance` | GET | Balances |
| `/fapi/v1/order` | POST | Place order (market/limit) |

## Base URLs

- **Production:** `https://fapi.binance.com`
- **Testnet:** `https://testnet.binance.vision` (Spot testnet) or `https://testnet.binancefuture.com` (Futures testnet)

## Auth (SIGNED)

- Header: `X-MBX-APIKEY: <api_key>`
- Query/body: `timestamp` (ms), `signature` = HMAC-SHA256(secretKey, queryString)

See [docs/rest-api-general-info.md](../docs/rest-api-general-info.md) for full signing rules.

## Rate Limits

- REQUEST_WEIGHT, RAW_REQUESTS, ORDERS per interval
- 429 = rate limited; 418 = IP banned
- See [docs/rest-api-general-info.md](../docs/rest-api-general-info.md) for limits.
