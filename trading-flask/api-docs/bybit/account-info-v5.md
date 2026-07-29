# Bybit V5 — Get account info (`GET /v5/account/info`)

Returns **account-level** settings: margin mode, unified status, spot hedging, copy-trading leader flag, etc.

Official reference: [Get account info](https://bybit-exchange.github.io/docs/v5/account/account-info).

**Related:** [Wallet balance](wallet-balance-v5.md) · [V5 integration guide](v5-integration-guide.md) · [Futures overview](futures-trading-v5.md)

---

## HTTP request

```http
GET /v5/account/info HTTP/1.1
Host: api.bybit.com
X-BAPI-SIGN: <signature>
X-BAPI-API-KEY: <key>
X-BAPI-TIMESTAMP: <ms>
X-BAPI-RECV-WINDOW: 5000
```

No **query** parameters. Signing string is `timestamp + api_key + recv_window +` empty query string (see [integration guide](v5-integration-guide.md)).

---

## Request parameters

**None.**

---

## Response — `result`

| Parameter | Type | Comments |
|-----------|------|----------|
| unifiedMarginStatus | integer | Unified account / margin **status** code (see official enum / glossary) |
| marginMode | string | `ISOLATED_MARGIN`, `REGULAR_MARGIN`, `PORTFOLIO_MARGIN` |
| isMasterTrader | boolean | Copy-trading **leader** account |
| spotHedgingStatus | string | Spot hedging in unified account: `ON` / `OFF` |
| updatedTime | string | Last update time **(ms)** |
| dcpStatus | string | **Deprecated** — reported as always `OFF`; use **Get DCP info** on official docs |
| timeWindow | integer | **Deprecated** — use **Get DCP info** |
| smpGroup | integer | **Deprecated** — use **Get SMP group ID** endpoint |

---

## Response example

```json
{
  "retCode": 0,
  "retMsg": "OK",
  "result": {
    "marginMode": "REGULAR_MARGIN",
    "updatedTime": "1697078946000",
    "unifiedMarginStatus": 4,
    "dcpStatus": "OFF",
    "timeWindow": 10,
    "smpGroup": 0,
    "isMasterTrader": false,
    "spotHedgingStatus": "OFF"
  },
  "retExtInfo": {},
  "time": 1672129307221
}
```
