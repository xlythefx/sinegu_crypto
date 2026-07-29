# MEXC API — Market data endpoints (Spot v3)

Base URL: `https://api.mexc.com`  
See also: [General info](general-info.md) · [ENUMs](enums.md) · [Spot account & trade](spot-account-trade.md) · [Introduction](introduction.md) · [Official MEXC API docs](https://mexcdevelop.github.io/apidocs/)

---

## Download historical market data

MEXC provides **bulk kline and trading data** for **all spot pairs** from **2023-01-01** onward. Use MEXC’s official **Historical Market Data** / data-distribution documentation for download locations, formats, and update cadence (not covered by these REST paths).

---

## Test connectivity

**`GET /api/v3/ping`**

Tests REST reachability.

| | |
|--|--|
| **Weight (IP)** | 1 |
| **Parameters** | None |

**Response**

```json
{}
```

---

## Check server time

**`GET /api/v3/time`**

| | |
|--|--|
| **Weight (IP)** | 1 |
| **Parameters** | None |

**Response**

```json
{
  "serverTime": 1645539742000
}
```

---

## API default symbols

**`GET /api/v3/defaultSymbols`**

| | |
|--|--|
| **Weight (IP)** | 1 |
| **Parameters** | None |

**Response**

```json
{
  "code": 200,
  "data": [
    "GENE1USDT",
    "SNTUSDT",
    "SQUAWKUSDT",
    "HEGICUSDT",
    "GUMUSDT"
  ],
  "msg": null
}
```

| Name | Type | Description |
|------|------|-------------|
| (items in `data`) | string | Symbol |

---

## Query offline symbols

Suspended or delisted pairs.

**`GET /api/v3/symbol/offline`**

| | |
|--|--|
| **Weight (IP)** | 10 |
| **Parameters** | None |

**Response**

```json
{
  "data": [
    {
      "symbol": "LVNUSDT",
      "state": 3
    },
    {
      "symbol": "LOKAUSDT",
      "state": 3,
      "offlineTime": 1724125694000
    }
  ]
}
```

| Name | Type | Description |
|------|------|-------------|
| symbol | string | Symbol |
| state | int | **2** — suspended; **3** — delisted |
| offlineTime | long | Delisting time (ms); may be absent |

---

## Exchange information

**`GET /api/v3/exchangeInfo`**

Current trading rules and symbol metadata.

| | |
|--|--|
| **Weight (IP)** | 25 |

**Parameters (optional)**

| Method | Example |
|--------|---------|
| None | `curl -X GET "https://api.mexc.com/api/v3/exchangeInfo"` |
| `symbol` | `curl -X GET "https://api.mexc.com/api/v3/exchangeInfo?symbol=MXUSDT"` |
| `symbols` | `curl -X GET "https://api.mexc.com/api/v3/exchangeInfo?symbols=MXUSDT,BTCUSDT"` |

**Sample response** (truncated)

```json
{
  "timezone": "CST",
  "serverTime": 1765342336768,
  "rateLimits": [],
  "exchangeFilters": [],
  "symbols": [
    {
      "symbol": "BTCUSDT",
      "status": "1",
      "baseAsset": "BTC",
      "baseAssetPrecision": 8,
      "quoteAsset": "USDT",
      "quotePrecision": 2,
      "quoteAssetPrecision": 2,
      "baseCommissionPrecision": 8,
      "quoteCommissionPrecision": 2,
      "orderTypes": ["LIMIT", "MARKET", "LIMIT_MAKER"],
      "isSpotTradingAllowed": false,
      "isMarginTradingAllowed": false,
      "quoteAmountPrecision": "1",
      "baseSizePrecision": "0.000001",
      "permissions": ["SPOT"],
      "filters": [
        {
          "filterType": "PERCENT_PRICE_BY_SIDE",
          "bidMultiplierUp": "0.005",
          "askMultiplierDown": "0.005"
        }
      ],
      "maxQuoteAmount": "4000000",
      "makerCommission": "0",
      "takerCommission": "0.0005",
      "quoteAmountPrecisionMarket": "1",
      "maxQuoteAmountMarket": "4000000",
      "fullName": "Bitcoin",
      "tradeSideType": 1,
      "contractAddress": "",
      "conceptPlateIds": [50, 5, 39, 12],
      "st": false
    }
  ]
}
```

**Top-level / symbol fields**

| Name | Type | Description |
|------|------|-------------|
| timezone | string | Timezone |
| serverTime | long | Server time (ms) |
| rateLimits | array | Rate limits |
| exchangeFilters | array | Exchange filters |
| symbol | string | Symbol |
| status | string | **1** — online; **2** — pause; **3** — offline |
| baseAsset | string | Base asset |
| baseAssetPrecision | int | Base precision |
| quoteAsset | string | Quote asset |
| quotePrecision | int | Quote precision |
| quoteAssetPrecision | int | Quote asset precision |
| baseCommissionPrecision | int | Base commission precision |
| quoteCommissionPrecision | int | Quote commission precision |
| orderTypes | array | Order type enum values |
| isSpotTradingAllowed | boolean | API spot trading allowed |
| isMarginTradingAllowed | boolean | API margin trading allowed |
| permissions | array | Permissions (e.g. `SPOT`) |
| filterType | string | e.g. `PERCENT_PRICE_BY_SIDE` |
| bidMultiplierUp | string | Bid-side multiplier cap |
| askMultiplierDown | string | Ask-side multiplier floor |
| maxQuoteAmount | string | Max quote amount |
| makerCommission | string | Maker commission |
| takerCommission | string | Taker commission |
| quoteAmountPrecision | string | Min order amount (notional) |
| baseSizePrecision | string | Min order quantity |
| quoteAmountPrecisionMarket | string | Min notional for market orders |
| maxQuoteAmountMarket | string | Max notional for market orders |
| tradeSideType | string (numeric enum) | **1** — all; **2** — buy only; **3** — sell only; **4** — close |
| contractAddress | string | Contract address (if applicable) |
| st | string / boolean | ST status (`true` / `false` in JSON; field semantics per MEXC) |

**`PERCENT_PRICE_BY_SIDE` (conceptual)**

- **lastPrice** — reference is latest trade price.  
- **orderPrice** — reference is the price you place.

Rules (per MEXC):

- **Buy** (LIMIT, IOC, FOK): `orderPrice <= lastPrice * bidMultiplierUp`
- **Sell**: `orderPrice >= lastPrice * askMultiplierDown`

---

## Order book (depth)

**`GET /api/v3/depth`**

| | |
|--|--|
| **Weight (IP)** | 3 |

**Parameters**

| Name | Type | Mandatory | Description | Scope |
|------|------|-----------|-------------|--------|
| symbol | string | YES | Symbol | |
| limit | integer | NO | Number of levels | Default **100**; max **5000** |

**Response**

```json
{
  "lastUpdateId": 1112416,
  "bids": [["15.00000", "49999.00000"]],
  "asks": [["14.0000", "1.0000"]]
}
```

| Name | Type | Description |
|------|------|-------------|
| lastUpdateId | long | Last update id |
| bids | list | `[price, quantity]` |
| asks | list | `[price, quantity]` |

---

## Recent trades

**`GET /api/v3/trades`**

| | |
|--|--|
| **Weight (IP)** | 5 |

**Parameters**

| Name | Type | Mandatory | Description | Scope |
|------|------|-----------|-------------|--------|
| symbol | string | YES | | |
| limit | integer | NO | | Default **500**; max **1000** |

**Response**

```json
[
  {
    "id": null,
    "price": "23",
    "qty": "0.478468",
    "quoteQty": "11.004764",
    "time": 1640830579240,
    "isBuyerMaker": true,
    "isBestMatch": true
  }
]
```

| Name | Description |
|------|-------------|
| id | Trade id |
| price | Price |
| qty | Quantity |
| quoteQty | Quote volume |
| time | Trade time (ms) |
| isBuyerMaker | Buyer was maker |
| isBestMatch | Best price match |

---

## Compressed / aggregate trades

**`GET /api/v3/aggTrades`**

Trades that fill at the same time, from the same order, at the same price may be **aggregated** in quantity.

| | |
|--|--|
| **Weight (IP)** | 1 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | YES | |
| startTime | long | NO | Start (ms), **inclusive** |
| endTime | long | NO | End (ms), **inclusive** |
| limit | integer | NO | Default **500**; max **1000** |

`startTime` and `endTime` must be used **together**.

**Response**

```json
[
  {
    "a": null,
    "f": null,
    "l": null,
    "p": "46782.67",
    "q": "0.0038",
    "T": 1641380483000,
    "m": false,
    "M": true
  }
]
```

| Name | Description |
|------|-------------|
| a | Aggregate trade id |
| f | First trade id |
| l | Last trade id |
| p | Price |
| q | Quantity |
| T | Timestamp (ms) |
| m | Buyer was maker |
| M | Best price match |

---

## Klines (candlesticks)

**`GET /api/v3/klines`**

Bars identified by **open time**.

| | |
|--|--|
| **Weight (IP)** | 1 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | YES | |
| interval | ENUM | YES | Kline interval (see official enum list) |
| startTime | long | NO | Start (ms) |
| endTime | long | NO | End (ms) |
| limit | integer | NO | Default **500**; max **500** |

**Response** (array of arrays)

```json
[
  [
    1640804880000,
    "47482.36",
    "47482.36",
    "47416.57",
    "47436.1",
    "3.550717",
    1640804940000,
    "168387.3"
  ]
]
```

| Index | Description |
|-------|-------------|
| 0 | Open time |
| 1 | Open |
| 2 | High |
| 3 | Low |
| 4 | Close |
| 5 | Volume |
| 6 | Close time |
| 7 | Quote asset volume |

---

## Current average price

**`GET /api/v3/avgPrice`**

| | |
|--|--|
| **Weight (IP)** | 1 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | YES | |

**Response**

```json
{
  "mins": 5,
  "price": "9.35751834"
}
```

| Name | Description |
|------|-------------|
| mins | Averaging window (minutes) |
| price | Average price |

---

## 24h ticker (price change statistics)

**`GET /api/v3/ticker/24hr`**

| | |
|--|--|
| **Weight (IP)** | 25 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | NO | Omit → array of tickers for **all** symbols |

**Response** — single symbol object **or** array of objects.

```json
{
  "symbol": "BTCUSDT",
  "priceChange": "184.34",
  "priceChangePercent": "0.00400048",
  "prevClosePrice": "46079.37",
  "lastPrice": "46263.71",
  "bidPrice": "46260.38",
  "bidQty": "",
  "askPrice": "46260.41",
  "askQty": "",
  "openPrice": "46079.37",
  "highPrice": "47550.01",
  "lowPrice": "45555.5",
  "volume": "1732.461487",
  "quoteVolume": null,
  "openTime": 1641349500000,
  "closeTime": 1641349582808,
  "count": null
}
```

| Name | Description |
|------|-------------|
| symbol | Symbol |
| priceChange | Price change |
| priceChangePercent | Change % |
| prevClosePrice | Previous close |
| lastPrice | Last price |
| lastQty | Last quantity (when present) |
| bidPrice / bidQty | Best bid |
| askPrice / askQty | Best ask |
| openPrice / highPrice / lowPrice | OH session stats |
| volume | Base volume |
| quoteVolume | Quote volume |
| openTime / closeTime | Window (ms) |
| count | Trade count (when present) |

---

## Symbol price ticker

**`GET /api/v3/ticker/price`**

| | |
|--|--|
| **Weight (IP)** | 10 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | NO | Omit → all symbols as array |

**Response**

```json
{ "symbol": "BTCUSDT", "price": "184.34" }
```

or

```json
[
  { "symbol": "BTCUSDT", "price": "6.65" },
  { "symbol": "ETHUSDT", "price": "5.65" }
]
```

| Name | Description |
|------|-------------|
| symbol | Symbol |
| price | Last price |

---

## Symbol order book ticker (book ticker)

**`GET /api/v3/ticker/bookTicker`**

Best bid/ask price and quantity for one or many symbols.

| | |
|--|--|
| **Weight (IP)** | 10 |

**Parameters**

| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| symbol | string | NO | Omit → all symbols |

**Response**

```json
{
  "symbol": "AEUSDT",
  "bidPrice": "0.11001",
  "bidQty": "115.59",
  "askPrice": "0.11127",
  "askQty": "215.48"
}
```

or an array of the same shape.

| Name | Description |
|------|-------------|
| symbol | Symbol |
| bidPrice / bidQty | Best bid |
| askPrice / askQty | Best ask |
