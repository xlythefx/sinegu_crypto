# Bybit V5 — Set leverage (`POST /v5/position/set-leverage`)

Official reference: [Set leverage](https://bybit-exchange.github.io/docs/v5/position/leverage).

**Related:** [Futures overview](futures-trading-v5.md) · [Wallet balance](wallet-balance-v5.md) · [Account info](account-info-v5.md) · [V5 integration guide](v5-integration-guide.md)

---

## Behaviour

Leverage interacts with the symbol’s **risk limit**: higher leverage implies a **smaller** maximum position value (and the converse). See Bybit’s risk-limit / leverage documentation from the [official set-leverage page](https://bybit-exchange.github.io/docs/v5/position/leverage) and [Help Center](https://www.bybit.com/help-center).

---

## HTTP request

```http
POST /v5/position/set-leverage HTTP/1.1
Host: api.bybit.com
X-BAPI-SIGN: <signature>
X-BAPI-API-KEY: <key>
X-BAPI-TIMESTAMP: <ms>
X-BAPI-RECV-WINDOW: 5000
Content-Type: application/json
```

Use **`api-testnet.bybit.com`**, **`api-demo.bybit.com`**, or regional mainnet hosts per [integration guide](v5-integration-guide.md).

---

## Request parameters

| Parameter | Required | Type | Comments |
|-----------|----------|------|----------|
| category | YES | string | **`linear`** or **`inverse`** |
| symbol | YES | string | e.g. `BTCUSDT`; **uppercase** |
| buyLeverage | YES | string | Integer range **[1, max leverage]** for the symbol |
| sellLeverage | YES | string | Same range |

### `buyLeverage` / `sellLeverage` rules

| Mode | Margin | Rule |
|------|--------|------|
| **One-way** | any | `buyLeverage` **must equal** `sellLeverage` |
| **Hedge** | **Isolated** | `buyLeverage` and `sellLeverage` **may differ** |
| **Hedge** | **Cross** | `buyLeverage` **must equal** `sellLeverage` |

Max leverage per symbol comes from contract / risk-tier settings (see instruments and account docs).

---

## Response

No business fields in **`result`** — typically an empty object on success.

```json
{
  "retCode": 0,
  "retMsg": "OK",
  "result": {},
  "retExtInfo": {},
  "time": 1672281607343
}
```

---

## Request example

```json
{
  "category": "linear",
  "symbol": "BTCUSDT",
  "buyLeverage": "6",
  "sellLeverage": "6"
}
```
