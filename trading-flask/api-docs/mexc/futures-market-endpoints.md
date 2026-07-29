# MEXC Futures — Market data endpoints

Base URL: `https://api.mexc.com`  
Paths below are under the **Market Data** module: **no authentication** is required.

Confirm paths, fields, and limits against [MEXC’s official API documentation](https://mexcdevelop.github.io/apidocs/).

**Related:** [Futures — integration guide](futures-integration-guide.md) · [Futures — account & trading (private)](futures-account-trading-endpoints.md) · [Futures — error codes](futures-error-codes.md) · [Spot market data](market-data-endpoints.md)

---

## Get server time

**`GET /api/v1/contract/ping`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |
| **Request parameters** | None |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/ping"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": 1761875313209
}
```

`data` is a server timestamp in milliseconds.

---

## Get contract info

**`GET /api/v1/contract/detail`**

| | |
|--|--|
| **Rate limit** | 10 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract symbol |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/detail"
```

**Response example (truncated)** — live responses include many additional fields (fees, risk tiers, index config, etc.).

```json
{
  "success": true,
  "code": 0,
  "data": {
    "symbol": "BTC_USDT",
    "displayName": "BTC_USDT永续",
    "displayNameEn": "BTC_USDT PERPETUAL",
    "positionOpenType": 3,
    "baseCoin": "BTC",
    "quoteCoin": "USDT",
    "settleCoin": "USDT",
    "contractSize": 0.0001,
    "minLeverage": 1,
    "maxLeverage": 500,
    "priceScale": 1,
    "volScale": 0,
    "amountScale": 4,
    "state": 0,
    "apiAllowed": false,
    "riskLimitType": "BY_VOLUME",
    "type": 1
  }
}
```

**Response parameters (selected)**

| Parameter | Type | Description |
|-----------|------|-------------|
| symbol | string | Contract symbol |
| displayName | string | Display name |
| displayNameEn | string | English display name |
| positionOpenType | int | Opening type: **1** Isolated, **2** Cross, **3** both supported |
| baseCoin | string | Base currency (e.g. BTC) |
| quoteCoin | string | Quote currency (e.g. USDT) |
| settleCoin | string | Settlement currency (e.g. USDT) |
| contractSize | decimal | Contract value |
| minLeverage | int | Minimum leverage |
| maxLeverage | int | Maximum leverage |
| priceScale | int | Price precision |
| volScale | int | Quantity precision |
| amountScale | int | Amount precision |
| priceUnit | int | Minimum price tick |
| volUnit | int | Minimum quantity step |
| minVol | decimal | Minimum order size (contracts) |
| maxVol | decimal | Maximum order size (contracts) |
| bidLimitPriceRate | decimal | Buy-side price limit ratio |
| askLimitPriceRate | decimal | Sell-side price limit ratio |
| takerFeeRate | decimal | Taker fee rate |
| makerFeeRate | decimal | Maker fee rate |
| maintenanceMarginRate | decimal | Maintenance margin rate |
| initialMarginRate | decimal | Initial margin rate |
| riskBaseVol | decimal | Base contracts |
| riskIncrVol | decimal | Incremental contracts |
| riskLongShortSwitch | int | Separate long/short risk limits: **0** off, **1** on |
| riskBaseVolLong | decimal | Base contracts — long |
| riskIncrVolLong | decimal | Incremental contracts — long |
| riskBaseVolShort | decimal | Base contracts — short |
| riskIncrVolShort | decimal | Incremental contracts — short |
| riskIncrMmr | decimal | Increment of maintenance margin rate |
| riskIncrImr | decimal | Increment of initial margin rate |
| riskLevelLimit | int | Number of risk limit tiers |
| priceCoefficientVariation | decimal | Coefficient for fair price deviation from index |
| indexOrigin | list of strings | Index sources |
| state | int | **0** enabled, **1** delivery, **2** delivered, **3** offline, **4** paused |
| apiAllowed | boolean | Whether API trading is allowed |
| conceptPlate | list of strings | Sector tags (entry keys) |
| riskLimitType | string | **BY_VOLUME** (by contracts) or **BY_VALUE** (by position value) |
| maxNumOrders | list of integers | Max open orders: **[hedged mode max, one-way mode max]** |
| type | int | Pair type: **1** normal, **2** suspended (default **1**) |

---

## Get transferable currencies

**`GET /api/v1/contract/support_currencies`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |
| **Request parameters** | None |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/support_currencies"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": ["STETH", "USDT", "BTC", "ETH"]
}
```

`data` is an array of strings; each string is a supported currency symbol.

---

## Get contract order book depth

**`GET /api/v1/contract/depth/{symbol}`**

| | |
|--|--|
| **Rate limit** | 10 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |
| limit | int | false | Number of rows |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/depth/BTC_USDT"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": {
    "asks": [[108779.2, 3240, 1], [108779.3, 3884, 1]],
    "bids": [[108779.1, 3240, 1], [108779, 3884, 1]],
    "version": 28111438870,
    "timestamp": 1761879567135
  }
}
```

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| asks | List of numeric arrays | Ask depth rows |
| bids | List of numeric arrays | Bid depth rows |
| version | long | Book version |
| timestamp | long | System timestamp |

**Depth row format** — each level is `[price, middle, quantity]` (e.g. `[411.8, 10, 1]`): **price**; the **middle** value is the **order count** at that price level; the **third** value is **order quantity** (contracts).

---

## Get the last N depth snapshots

**`GET /api/v1/contract/depth_commits/{symbol}/{limit}`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |
| limit | int | true | Number of snapshots |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/depth_commits/BTC_USDT/20"
```

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| asks | list of numeric arrays | Ask depth |
| bids | list of numeric arrays | Bid depth |
| version | long | Version |

---

## Get index price

**`GET /api/v1/contract/index_price/{symbol}`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/index_price/BTC_USDT"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": {
    "symbol": "BTC_USDT",
    "indexPrice": 31103.4,
    "timestamp": 1609829705178
  }
}
```

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| symbol | string | Trading pair |
| indexPrice | decimal | Index price |
| timestamp | long | System timestamp |

---

## Get fair price

**`GET /api/v1/contract/fair_price/{symbol}`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/fair_price/BTC_USDT"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": {
    "symbol": "BTC_USDT",
    "fairPrice": 31103.4,
    "timestamp": 1609829705178
  }
}
```

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| symbol | string | Contract |
| fairPrice | decimal | Fair price |
| timestamp | long | System timestamp |

---

## Get funding rate

**`GET /api/v1/contract/funding_rate/{symbol}`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/funding_rate/BTC_USDT"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": {
    "symbol": "BTC_USDT",
    "fundingRate": 0.000018,
    "maxFundingRate": 0.0018,
    "minFundingRate": -0.0018,
    "collectCycle": 8,
    "nextSettleTime": 1761897600000,
    "timestamp": 1761879755894
  }
}
```

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| symbol | string | Contract |
| fundingRate | decimal | Current funding rate |
| maxFundingRate | decimal | Funding rate ceiling |
| minFundingRate | decimal | Funding rate floor |
| collectCycle | int | Collection cycle |
| nextSettleTime | long | Next settlement time |
| timestamp | long | System timestamp |

---

## Get candlestick data

**`GET /api/v1/contract/kline/{symbol}`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |
| interval | string | false | **Min1**, **Min5**, **Min15**, **Min30**, **Min60**, **Hour4**, **Hour8**, **Day1**, **Week1**, **Month1**. Default **Min1** if omitted |
| start | long | false | Start time (**seconds**) |
| end | long | false | End time (**seconds**) |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/kline/BTC_USDT?interval=Min15&start=1609992674&end=1610113500"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": {
    "time": [1761876000, 1761876900],
    "open": [109573.9, 109006.4],
    "close": [109006.4, 109301.5],
    "high": [109628.1, 109426.2],
    "low": [108953.3, 109006.4],
    "vol": [5587051.0, 5739575.0],
    "amount": [6.106243567181e7, 6.270099147368e7],
    "realOpen": [109574.0, 109010.0],
    "realClose": [109006.4, 109301.5],
    "realHigh": [109628.1, 109426.2],
    "realLow": [108953.3, 109010.0]
  }
}
```

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| open | double[] | Open per bucket |
| close | double[] | Close per bucket |
| high | double[] | High per bucket |
| low | double[] | Low per bucket |
| vol | double[] | Volume per bucket |
| time | long[] | Bar open time (aligned with arrays above) |
| amount | double[] | Turnover / notional (as returned by API) |
| realOpen / realClose / realHigh / realLow | double[] | Mark-price-aligned OHLC where provided |

**Notes**

- **Maximum 2000** candles per request. If `start`/`end` and `interval` would exceed that, only **2000** points are returned. Use **multiple requests** with segmented windows for long history.
- **Only `start`:** data from `start` through **now**.
- **Only `end`:** the **2000** candles closest to `end`.
- **Neither:** the **2000** most recent candles relative to **now**.

---

## Get index price candles

**`GET /api/v1/contract/kline/index_price/{symbol}`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |
| interval | string | false | **Min1**, **Min5**, **Min15**, **Min30**, **Min60**, **Hour4**, **Hour8**, **Day1**, **Week1**, **Month1**. Default **Min1** if omitted |
| start | long | false | Start timestamp (**seconds**) |
| end | long | false | End timestamp (**seconds**) |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/kline/index_price/BTC_USDT?interval=Min15&start=1609992674&end=1610113500"
```

**Response shape** — same columnar layout as contract klines (`time`, `open`, `close`, `high`, `low`, `vol`, `amount`, `realOpen`, `realClose`, `realHigh`, `realLow` arrays). Index klines often return **zero** `vol` / `amount`; `real*` series may mirror OHLC.

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| open | double[] | Open |
| close | double[] | Close |
| high | double[] | High |
| low | double[] | Low |
| vol | double[] | Volume (often 0 for index series) |
| time | long[] | Bar time |
| amount | double[] | Amount (often 0) |
| realOpen / realClose / realHigh / realLow | double[] | As returned by API |

**Notes** — same **2000**-bar cap and `start` / `end` / neither behavior as [Get candlestick data](#get-candlestick-data).

---

## Get fair price candles

**`GET /api/v1/contract/kline/fair_price/{symbol}`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |
| interval | string | false | **Min1** … **Month1** (same set as contract klines). Default **Min1** |
| start | long | false | Start timestamp (**seconds**) |
| end | long | false | End timestamp (**seconds**) |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/kline/fair_price/BTC_USDT?interval=Min15&start=1609992674&end=1610113500"
```

**Response shape** — same as index price candles (columnar OHLC + `vol` / `amount` / `real*` arrays; `vol` / `amount` may be zero).

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| open | double[] | Open |
| close | double[] | Close |
| high | double[] | High |
| low | double[] | Low |
| vol | double[] | Volume |
| time | long[] | Bar time |
| amount | double[] | Amount |
| realOpen / realClose / realHigh / realLow | double[] | As returned by API |

**Notes** — same **2000**-bar cap and time-range rules as [Get candlestick data](#get-candlestick-data).

---

## Get recent trades

**`GET /api/v1/contract/deals/{symbol}`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |
| limit | int | false | Number of trades; **max 100**; default **100** if omitted |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/deals/BTC_USDT"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": [
    {
      "p": 109177.4,
      "v": 14,
      "T": 1,
      "O": 1,
      "M": 2,
      "t": 1761883066648
    }
  ]
}
```

**Response parameters (each element in `data`)**

| Field | Type | Description |
|-------|------|-------------|
| p | decimal | Trade price |
| v | decimal | Quantity |
| T | int | Side: **1** buy, **2** sell |
| O | int | Open/close flag: **1** both taker and maker open; **2** both not open; **3** other; if **1**, `v` adds to position |
| M | int | Self-trade: **1** yes, **2** no |
| t | long | Trade time (ms) |

---

## Get ticker (contract market data)

**`GET /api/v1/contract/ticker`**

| | |
|--|--|
| **Rate limit** | 10 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract symbol (query); omit behavior depends on API version — confirm in official docs |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/ticker"
```

**Response example (truncated)**

```json
{
  "success": true,
  "code": 0,
  "data": {
    "contractId": 10,
    "symbol": "BTC_USDT",
    "lastPrice": 109167.1,
    "bid1": 109167,
    "ask1": 109167.1,
    "volume24": 954830625,
    "amount24": 10374579341.00211,
    "holdVol": 381485808,
    "lower24Price": 106226,
    "high24Price": 111553.8,
    "riseFallRate": 0.014,
    "riseFallValue": 1510.6,
    "indexPrice": 109235,
    "fairPrice": 109168.9,
    "fundingRate": 0,
    "maxBidPrice": 120158.5,
    "minAskPrice": 98311.5,
    "timestamp": 1761883095759,
    "riseFallRates": {
      "zone": "UTC+8",
      "r": 0.014,
      "v": 1510.6,
      "r7": -0.0061,
      "r30": -0.0343,
      "r90": -0.0532,
      "r180": 0.1329,
      "r365": 0.5149
    },
    "riseFallRatesOfTimezone": [-0.0157, 0.0083, 0.014]
  }
}
```

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| symbol | string | Contract |
| contractId | int | Contract id |
| lastPrice | decimal | Last traded price |
| bid1 | decimal | Best bid |
| ask1 | decimal | Best ask |
| volume24 | decimal | 24h volume (**contracts**) |
| amount24 | decimal | 24h turnover |
| holdVol | decimal | Open interest (**contracts**) |
| lower24Price | decimal | 24h low |
| high24Price | decimal | 24h high |
| riseFallRate | decimal | Change rate |
| riseFallValue | decimal | Change amount |
| indexPrice | decimal | Index price |
| fairPrice | decimal | Fair price |
| fundingRate | decimal | Funding rate |
| maxBidPrice | decimal | Max bid band (risk / limit context) |
| minAskPrice | decimal | Min ask band |
| timestamp | long | Snapshot time |
| riseFallRates | object | Multi-horizon stats (e.g. `r`, `v`, `r7`, `r30`, `zone`, …) |
| riseFallRatesOfTimezone | array | Additional timezone bucket rates when present |

---

## Get insurance fund balance

**`GET /api/v1/contract/risk_reverse/{symbol}`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol (path) |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/risk_reverse/BTC_USDT"
```

> Some published examples call `GET /api/v1/contract/risk_reverse` without a path symbol; prefer the **`{symbol}`** path form above unless your environment matches the alternate route.

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": [
    {
      "symbol": "BTC_USDT",
      "currency": "USDT",
      "available": 97284530.44863408,
      "timestamp": 1761883124789
    }
  ]
}
```

**Response parameters (each element in `data`)**

| Parameter | Type | Description |
|-----------|------|-------------|
| symbol | string | Contract |
| currency | string | Settlement coin |
| available | decimal | Balance |
| timestamp | long | System timestamp |

---

## Get insurance fund balance history

**`GET /api/v1/contract/risk_reverse/history`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol |
| page_num | int | true | Page number (default **1**) |
| page_size | int | true | Page size (default **20**, **max 100**) |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/risk_reverse/history?symbol=BTC_USDT&page_num=1&page_size=20"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": {
    "pageSize": 3,
    "totalCount": 42,
    "totalPage": 14,
    "currentPage": 1,
    "resultList": [
      {
        "symbol": "BTC_USDT",
        "currency": "USDT",
        "available": 97284530.44863408,
        "snapshotTime": 1761883200000
      }
    ]
  }
}
```

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| pageSize | int | Page size |
| totalCount | int | Total rows |
| totalPage | int | Total pages |
| currentPage | int | Current page |
| resultList | list | Rows |
| resultList[].symbol | string | Contract |
| resultList[].currency | string | Settlement coin |
| resultList[].available | decimal | Balance at snapshot |
| resultList[].snapshotTime | long | Snapshot time |

---

## Get funding rate history

**`GET /api/v1/contract/funding_rate/history`**

| | |
|--|--|
| **Rate limit** | 20 requests / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol |
| page_num | int | true | Page number (default **1**) |
| page_size | int | true | Page size (default **20**, **max 1000**) |

**Example**

```bash
curl "https://api.mexc.com/api/v1/contract/funding_rate/history?symbol=BTC_USDT&page_num=1&page_size=20"
```

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": {
    "pageSize": 3,
    "totalCount": 1619,
    "totalPage": 540,
    "currentPage": 1,
    "resultList": [
      {
        "symbol": "BTC_USDT",
        "fundingRate": 0.000021,
        "settleTime": 1761868800000,
        "collectCycle": 8
      }
    ]
  }
}
```

**Response parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| pageSize | int | Page size |
| totalCount | int | Total rows |
| totalPage | int | Total pages |
| currentPage | int | Current page |
| resultList | list | Rows |
| resultList[].symbol | string | Contract |
| resultList[].fundingRate | decimal | Funding rate |
| resultList[].settleTime | long | Settlement time |
| resultList[].collectCycle | int | Funding cycle (**hours**) |
