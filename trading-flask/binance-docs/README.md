# Documentation

Reference docs for nap.ai bot (Binance) and Binance USD-M Futures APIs.

## Contents

| Document | Description |
|----------|-------------|
| [REST API General Info](rest-api-general-info.md) | Binance USD-M Futures REST: endpoints (prod + testnet), request rules, HTTP codes (4XX/5XX/503), error payload, limits, security types, SIGNED (HMAC SHA256 + RSA) short reference |
| [WebSocket API General Info](websocket-api-general-info.md) | Binance USD-M Futures WebSocket: endpoints (prod + testnet), request/response format, ping/pong, rate limits, session auth (`session.logon`, `session.status`, `session.logout`), Ed25519 signed example |
| [TRADE: New Order](trade-new-order.md) | Place order: WebSocket `order.place` vs REST `POST /fapi/v1/order`; params, types (LIMIT/MARKET/STOP/…), trigger conditions, response |
| [Account Information V3](account-information-v3.md) | USER_DATA: `GET /fapi/v3/account`; single-asset vs multi-assets response, totals, assets[], positions[] |
| [Futures Account Balance V3](balance-v3.md) | USER_DATA: `GET /fapi/v3/balance`; per-asset balance array (balance, availableBalance, maxWithdrawAmount, marginAvailable) |

## Project docs

- Main project README: [../README.md](../README.md)
- Config (symbols, interval, base URL): [../config.py](../config.py)
