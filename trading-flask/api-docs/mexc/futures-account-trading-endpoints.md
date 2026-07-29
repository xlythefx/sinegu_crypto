# MEXC Futures — Account & trading (private) endpoints

Base URL: `https://api.mexc.com`  
Endpoints under **`/api/v1/private/...`** require **authentication** (OPEN-API headers: `ApiKey`, `Request-Time`, `Signature`, optional `Recv-Window`, etc.). See [Futures — integration guide](futures-integration-guide.md).

Confirm paths, permissions, and fields against [MEXC’s official API documentation](https://mexcdevelop.github.io/apidocs/).

**Related:** [Futures — market data (public)](futures-market-endpoints.md) · [Futures — error codes](futures-error-codes.md)

---

## Permissions (as in materials)

| Label in docs | Typical key permission |
|----------------|-------------------------|
| View Account Details | Read account / balances / analysis |
| View Order Details | Read orders, positions, fees |

Each section notes the **required permission** from the source materials.

---

## Get all account assets

**`GET /api/v1/private/account/assets`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |
| **Request parameters** | None |

**Response example**

```json
{
  "success": true,
  "code": 0,
  "data": [
    {
      "currency": "USDT",
      "positionMargin": 0,
      "availableBalance": 32.80984793658,
      "cashBalance": 32.80984793,
      "frozenBalance": 0,
      "equity": 32.80984793,
      "unrealized": 0,
      "bonus": 0,
      "availableCash": 32.80984793658,
      "availableOpen": 32.80984793658,
      "debtAmount": 0,
      "contributeMarginAmount": 0,
      "vcoinId": "128f589271cb4951b03e71e6323eb7be"
    }
  ]
}
```

**`data[]` fields**

| Parameter | Type | Description |
|-----------|------|-------------|
| currency | string | Currency |
| positionMargin | decimal | Position margin |
| frozenBalance | decimal | Frozen balance |
| availableBalance | decimal | Currently available balance |
| cashBalance | decimal | Withdrawable balance |
| equity | decimal | Total equity |
| unrealized | decimal | Unrealized PnL |
| bonus | decimal | Trial bonus |
| bonusExpireTime | long | Trial bonus expiration (ms), when present |
| availableCash | decimal | Transferable amount |
| availableOpen | decimal | Usable amount |
| debtAmount | decimal | Debt amount |
| contributeMarginAmount | decimal | Contributed effective margin |
| vcoinId | string | Currency ID |

---

## Get single-currency asset

**`GET /api/v1/private/account/asset/{currency}`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**Path / query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| currency | string | true | Currency (path) |

**`data` object** — same fields as one element of [Get all account assets](#get-all-account-assets).

---

## Get asset transfer records

**`GET /api/v1/private/account/transfer_record`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| currency | string | false | Currency filter |
| state | string | false | **WAIT**, **SUCCESS**, **FAILED** |
| type | string | false | **IN**, **OUT** |
| page_num | int | true | Page (default **1**) |
| page_size | int | true | Page size (default **20**, max **100**) |

**`data` pagination + `resultList[]`**

| Field | Type | Description |
|-------|------|-------------|
| pageSize, totalCount, totalPage, currentPage | int | Pagination |
| resultList[].id | long | Record id |
| resultList[].txid | string | Transaction ID |
| resultList[].currency | string | Currency |
| resultList[].amount | decimal | Amount |
| resultList[].type | string | **IN** / **OUT** |
| resultList[].state | string | **WAIT** / **SUCCESS** / **FAILED** |
| resultList[].createTime | long | Created (ms) |
| resultList[].updateTime | long | Updated (ms) |

---

## View personal profit rate

**`GET /api/v1/private/account/profit_rate/{type}`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | int | true | **1** day; **2** week (path) |

**`data`**

| Parameter | Type | Description |
|-----------|------|-------------|
| ranking | int | Rank (example shows `0`) |
| profitRate | decimal | Profit rate |
| statisticTime | long | Statistic time (ms) |

---

## Asset analysis

**`GET /api/v1/private/account/asset/analysis/{type}`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | int | true | **1** this week; **2** this month; **3** all; **4** custom range (path) |
| startTime | long | false | Start (ms); used with custom range |
| endTime | long | false | End (ms) |
| currency | string | true | Currency |

**`data` (selected)**

| Parameter | Type | Description |
|-----------|------|-------------|
| todayPnl | decimal | Today’s PnL |
| todayPnlRate | decimal | Today’s PnL rate |
| totalPnl | decimal | Total PnL |
| totalEquity | decimal | Total equity |
| winRate | decimal | Win rate |
| historyDailyData | object | `timeList`, `accumPnlList`, `accumPnlRateList`, `dailyPnlList`, `dailyPnlRateList`, `dailyEquityList`, `dailyIndexPriceRiseFallRateList`, etc. |

---

## Deduction configuration

**`GET /api/v1/private/account/feeDeductConfigs`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |
| **Request parameters** | None |

**`data[]`**

| Parameter | Type | Description |
|-----------|------|-------------|
| deductCoin | string | Deduction coin |
| settleCoin | string | Settlement coin |
| discountRatio | decimal | Discount ratio |

---

## Yesterday’s PnL

**`GET /api/v1/private/account/asset/analysis/yesterday_pnl`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |
| **Request parameters** | None |

On success, `data` is a **decimal PnL amount (USDT)**. On failure, `data` may be `null`.

---

## User asset analysis (v3)

**`POST /api/v1/private/account/asset/analysis/v3`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**JSON body parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startTime | long | true | Start (ms) |
| endTime | long | true | End (ms) |
| reverse | int | false | Contract type: **0** all; **1** USDT-M; **2** coin-M; **3** USDC-M |
| includeUnrealisedPnl | int | false | **0** no; **1** yes |
| symbol | string | false | Trading pair |

**`data` (selected)**

| Parameter | Type | Description |
|-----------|------|-------------|
| todayPnl, todayPnlRate | decimal | Today |
| totalPnl | decimal | Total PnL |
| recentPnl, recentPnlRate | decimal | ~7d cumulative |
| recentPnl30, recentPnlRate30 | decimal | ~30d cumulative |
| totalEquity | decimal | Equity |
| accurate | boolean | Accuracy flag |
| timestamp | long | Snapshot (ms) |
| todayPnlFinished | boolean | Today’s PnL finalized |
| historyDailyData | object | Daily series |

---

## User asset calendar analysis (daily v3)

**`POST /api/v1/private/account/asset/analysis/calendar/daily/v3`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startTime | long | true | Start (ms) |
| endTime | long | true | End (ms) |
| reverse | int | false | **0** / **1** / **2** / **3** (same as v3 analysis) |
| includeUnrealisedPnl | int | false | **0** / **1** |

**`data`:** `dailyTimeList`, `dailyPnlList`, `todayPnlFinished`.

---

## User asset calendar analysis (monthly v3)

**`POST /api/v1/private/account/asset/analysis/calendar/monthly/v3`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reverse | int | false | Contract type filter |
| includeUnrealisedPnl | int | false | **0** / **1** |

**`data`:** `monthlyTimeList`, `monthlyPnlList`, `todayPnlFinished`.

---

## Recent user asset analysis (v3)

**`POST /api/v1/private/account/asset/analysis/recent/v3`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reverse | int | false | Contract type |
| includeUnrealisedPnl | int | false | **0** / **1** |
| symbol | string | false | Pair |

**`data`:** `recentPnl60` / `recentPnlRate60`, **90**, **120**, **150**, **180**, **360** pairs, plus `todayPnlFinished`.

---

## Today’s user asset analysis

**`GET /api/v1/private/account/asset/analysis/today_pnl`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reverse | int | false | Contract type **0–3** |
| includeUnrealisedPnl | int | false | **0** / **1** |

**`data`:** `todayPnl`, `todayPnlRate`, `todayPnlFinished`.

---

## Spot discount configuration (contract fee)

**`GET /api/v1/private/account/config/contractFeeDiscountConfig`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |
| **Request parameters** | None |

Example response may use `"code": 200` with `"message": "success"` in addition to `success` / `data`.

**`data[]` (selected)**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | int | Row id |
| currency | string | Deduction currency |
| state | string | **ENABLED** / **DISABLED** |
| discountConfig | string | JSON string of tier rules |
| ineffectiveDiscountConfig | string | Inactive config |
| enabled | boolean | Enabled |
| createTime, updateTime | long | Audit times |

Also: **`blackContractIdSet`** — list of contract IDs excluded from discounts (per materials).

---

## Query contract fee deduction details

**`GET /api/v1/private/order/fee_details`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Request parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract |
| ids | long | false | Deal id(s); batch up to **20** |
| start_time | long | false | Start; default ≈ now − **7** days; max span **90** days with `end_time` |
| end_time | long | false | End |
| page_num | int | false | Page (default **1**) |
| page_size | int | false | Size (default **20**, max **100**) |

**`data[]` rows**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | long | Deal id |
| orderId | long | Order id |
| feeCurrency | string | Fee currency |
| fee | decimal | Fee |
| deductType | int / string | **0** none; **1** MXPOINT; **2** trial bonus (materials use integer in examples) |
| deductFeeCurrency | string | Deducted fee currency (when applicable) |
| deductFee | decimal | Deducted fee (when applicable) |
| timestamp | long | Deal time |

---

## Query user discount usage

**`GET /api/v1/private/account/discountType`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |
| **Request parameters** | None |

If spot fee discount exists, spot discount applies; if MX holding applies for contracts, MX deduction may apply (per platform copy).

**`data`**

| Parameter | Type | Description |
|-----------|------|-------------|
| useFeeDiscount | boolean | Use spot-discount fee rate |
| useFeeDeduct | boolean | Use contract deduction fee rate |

---

## Export PnL analysis

**`GET /api/v1/private/account/asset/analysis/export`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**Headers**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| timezone-login | string | true | e.g. `UTC+08:00` |

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| startTime | long | Export start (ms) |
| endTime | long | Export end (ms) |
| reverse | int | **0** all; **1** USDT-M; **2** coin-M |
| includeUnrealisedPnl | int | **0** no; **1** yes |
| symbol | string | Pair |
| fileType | int | **1** Excel; **2** PDF |
| language | string | e.g. `zh-CN` |

Response body: per materials, **no JSON field table** (file download / async job — confirm in official docs).

---

## 30-day fee statistics

**`GET /api/v1/private/account/asset_book/order_deal_fee/total`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |
| **Request parameters** | None |

**`data`**

| Parameter | Type | Description |
|-----------|------|-------------|
| totalFee | decimal | Total fees (4 dp), default **0** |
| saveFee | decimal | Saved fees (4 dp), default **0** |

---

## Fee details under a specific contract

**`GET /api/v1/private/account/contract/fee_rate`**

| | |
|--|--|
| **Permission** | View Account Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Filter by pair |

**`data[]` (selected)**

| Parameter | Type | Description |
|-----------|------|-------------|
| contractId | int | Contract id |
| symbol | string | Pair |
| isMaxLeverage | boolean | Max leverage flag |
| isZeroFeeRate | boolean | Zero-fee |
| maxLeverage | int | Max leverage |
| countryConfigContractMaxLeverage | int | Regional cap |
| takerFeeRate, makerFeeRate | decimal | Fees |
| feeRateMode | string | **LEVERAGE** / **NORMAL** / **TIERED** |
| leverageFeeRates | list | When mode = **LEVERAGE** |
| tieredFeeRates | list | When mode = **TIERED** |
| tieredDealAmount | decimal | Volume toward tiers |
| tieredEffectiveDay | int | Effective days |
| tieredAppointContract | boolean | Contract allowlist semantics |
| tieredExcludeContractId | boolean | Exclude/include id list |
| tieredContractIds | list / string | Id list (shape varies by version) |
| tieredExcludeZeroFee | boolean | Exclude zero-fee volume |
| statisticType | string | **ROLLING** / **FIXED** |
| fixedStartTime, fixedEndTime | long | **FIXED** window |
| agentFee | boolean | Agent fee flag |

---

## Get fee details (tiered / effective rates v2)

**`GET /api/v1/private/account/tiered_fee_rate/v2`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract; when set, returns fee info in context of that contract |

**`data` (selected)** — single object with discount/deduction flags and tier configuration.

| Parameter | Type | Description |
|-----------|------|-------------|
| symbol | string | Contract (when scoped) |
| joinDiscount, enjoyDiscount | boolean | Participate in / receive discount |
| joinDeduct, enjoyDeduct | boolean | Participate in / receive deduction |
| discountRate, deductRate | decimal | Rates applied |
| originalMakerFee, originalTakerFee | decimal | Base maker/taker |
| realMakerFee, realTakerFee | decimal | Effective maker/taker after discounts |
| dealAmount | decimal | ~30d trading volume (per materials) |
| walletBalance | decimal | Yesterday wallet balance (per materials) |
| inviterKyc | string | Fee-group / inviter KYC constraint text |
| level | int | Fee tier / level (e.g. **9999** in sample) |
| feeType | int | Fee type code |
| agentFee | boolean | Agent fee |
| feeRateMode | string | **NORMAL** · **LEVERAGE** · **TIERED** |
| tieredFeeRates | list | Tiers when mode = **TIERED** (entries may include `realTakerFee` / `realMakerFee`) |
| leverageFeeRates | list | When mode = **LEVERAGE** |
| tieredDealAmount | decimal | Volume counted toward tiers |
| tieredEffectiveDay | int | Tier effective days |
| tieredAppointContract, tieredExcludeContractId, tieredExcludeZeroFee | boolean | Tier contract filters |
| tieredContractIds | list / string | Contract id allowlist (shape varies) |
| statisticType | string | **ROLLING** · **FIXED** |
| fixedStartTime, fixedEndTime | long | **FIXED** window (ms) |

---

## Zero-fee trading pairs

**`GET /api/v1/private/account/contract/zero_fee_rate`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Filter |

**`data`**

| Parameter | Type | Description |
|-----------|------|-------------|
| contracts | list | e.g. `{ "contractId", "ifHotTag" }` |
| hotRecs | list | Hot recommendations |

---

## Get historical positions

**`GET /api/v1/private/position/list/history_positions`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract |
| type | int | false | **1** long **2** short |
| position_type | int | false | **1** long **2** short (duplicate naming in source) |
| start_time | long | false | Start |
| end_time | long | false | End |
| page_num | int | true | Page (default **1**) |
| page_size | int | true | Size (default **20**, max **100**) |

**Response shape**

Materials list pagination fields (`pageSize`, `totalCount`, `totalPage`, `currentPage`, `resultList`). Some examples show `data` as a **bare array** of positions; live API may wrap rows in **`data.resultList`**. Prefer the paginated shape when integrating.

**Position object (selected)**

| Parameter | Type | Description |
|-----------|------|-------------|
| positionId | long | Position id |
| symbol | string | Contract |
| holdVol | decimal | Size |
| positionType | int | **1** long **2** short |
| openType | int | **1** isolated **2** cross |
| state | int | **1** holding **2** system-held **3** closed |
| frozenVol, closeVol | decimal | Volumes |
| holdAvgPrice, openAvgPrice, closeAvgPrice | decimal | Averages |
| holdAvgPriceFullyScale, openAvgPriceFullyScale | string / decimal | Full-precision prices |
| liquidatePrice | decimal | Isolated liq price |
| oim, im | decimal | Original / current initial margin |
| holdFee | decimal | Funding: positive received, negative paid |
| realised | decimal | Realized PnL |
| leverage | int | Leverage |
| marginRatio | decimal | Margin ratio |
| autoAddIm | boolean | Auto-add margin |
| profitRatio | decimal | Realized PnL / initial margin |
| newOpenAvgPrice, newCloseAvgPrice | decimal | Adjusted averages |
| closeProfitLoss | decimal | Close PnL (ex fees) |
| fee, totalFee | decimal | Fees |
| positionShowStatus | string | e.g. **CLOSED** |
| deductFeeList | list | Deduction rows |
| createTime, updateTime | long / string | Times |

---

## Get open positions

**`GET /api/v1/private/position/open_positions`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract |
| positionId | long | false | Position id |

**`data`:** array of position objects (same core fields as historical, plus **`adlLevel`** (int **1–5**, or null if pending refresh) on open positions per materials).

> **Unrealized PnL:** The [contract v1 open_positions response table](https://mexcdevelop.github.io/apidocs/contract_v1_en/) lists **`realised`** but does **not** document **`unrealized`** on each position row. The web UI still shows per-position unrealized PnL. In **trading-flask**, open-position payloads sent to `mexc-positions` are enriched with a computed **`unrealized`** (USDT) using **fair price**, **`contractSize`**, **`holdVol`**, **`holdAvgPrice`**, and **`positionType`** (linear USDT-margined approximation aligned with the UI).

---

## Get funding fee / funding records

**`GET /api/v1/private/position/funding_records`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract |
| position_id | int | false | Position id |
| page_num | int | true | Page |
| page_size | int | true | Size (max **100**) |
| position_type | int | true | **1** long **2** short |
| start_time | long | true | Start |
| end_time | long | true | End |

**Response**

Materials specify paginated **`resultList`** with rows such as **`id`**, **`symbol`**, **`positionType`**, **`positionValue`**, **`funding`**, **`rate`**, **`settleTime`**. Some published samples show a single **current funding-rate** object instead; treat that as illustrative and align with the official **funding history** schema.

---

## Get risk limits

**`GET /api/v1/private/account/risk_limit`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract; omit for all |

**`data`:** map of **symbol → list** of tier rows.

**Each tier row**

| Parameter | Type | Description |
|-----------|------|-------------|
| symbol | string | Contract |
| positionType | int | **1** long **2** short |
| level | int | Risk tier |
| maxVol | decimal | Max position (contracts; may be value-derived per contract config) |
| maxLeverage | int | Max leverage at tier |
| mmr | decimal | Maintenance margin rate |
| imr | decimal | Initial margin rate |
| openType | int | Margin mode context |
| leverage | int | User leverage context |
| limitBySys | boolean | System-limited |
| currentMmr | decimal | Current MMR when returned |

---

## Modify position margin

**`POST /api/v1/private/position/change_margin`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| positionId | long | true | Position id |
| amount | decimal | true | Amount |
| type | string | true | **ADD** increase margin; **SUB** decrease |

**Response:** envelope only (`success`, `code`).

---

## Enable or disable auto-add margin

**`POST /api/v1/private/position/change_auto_add_im`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| positionId | long | true | Position id |
| isEnabled | boolean | true | Enable auto-add |

---

## Get position leverage multipliers

**`GET /api/v1/private/position/leverage`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract |

**`data`:** array of rows (often one per **positionType** / side context) with `level`, `maxVol`, `mmr`, `imr`, `positionType`, `openType`, `leverage`, `limitBySys`, `currentMmr`, **`maxLeverageView`**, etc.

---

## Modify leverage

**`POST /api/v1/private/position/change_leverage`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | **10** requests / **10** seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| positionId | long | false | When a position exists |
| leverage | int | true | Target leverage |
| openType | int | false | **1** isolated **2** cross — required when **no** position |
| symbol | string | false | Contract — required when **no** position |
| positionType | int | false | **1** long **2** short — when **no** position |
| leverageMode | int | false | **1** advanced **2** simple |
| marginSelected | boolean | false | Bulk margin-mode adjustment selection flag |
| leverageSelected | boolean | false | Bulk leverage adjustment selection flag |

---

## Get user position mode

**`GET /api/v1/private/position/position_mode`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |
| **Request parameters** | None |

**`data`:** per field table, **`positionMode`** — **1** dual-side (hedged), **2** one-way.

> Some circulated samples show the same **leverage-tier array** as `/position/leverage`; that does not match the **`positionMode`** response description. Prefer **`positionMode`** from live responses or official docs.

---

## Modify user position mode

**`POST /api/v1/private/position/change_position_mode`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| positionMode | int | true | **1** dual-side; **2** one-way. No active orders, plan orders, or open positions. Switching dual → one-way **resets risk limit to level 1** (per platform copy). |

---

## Change risk level

**`POST /api/v1/private/account/change_risk_level`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**Disabled.** Returns error **8817** (risk limit upgrade — use web / new flow). See [Futures — error codes](futures-error-codes.md).

---

## Place order

**`POST /api/v1/private/order/create`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | **4** / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract |
| price | decimal | true | Price |
| vol | decimal | true | Quantity |
| leverage | int | false | Required when **opening** |
| side | int | true | **1** open long **2** close short **3** open short **4** close long |
| type | int | true | **1** limit **2** Post-Only **3** IOC **4** FOK **5** market |
| openType | int | true | **1** isolated **2** cross |
| externalOid | string | false | Client order id |
| positionId | int | false | Position id |
| stopLossPrice, takeProfitPrice | decimal | false | TP/SL |
| lossTrend, profitTrend | int | false | **1** last (default) **2** fair **3** index |
| priceProtect | int | false | **1** / **0** conditional trigger protection (plan / TP-SL) |
| positionMode | int | false | **1** dual **2** one-way |
| reduceOnly | boolean | false | One-way only |
| marketCeiling | boolean | false | 100% market open |
| flashClose | boolean | false | Flash close |
| bboTypeNum | int | false | BBO: **0** off **1** opp-1 **2** opp-5 **3** same-1 **4** same-5 |
| stpMode | number | false | Self-trade prevention: **0** none **1** cancel both **2** maker only **3** taker only |

**Response:** `success` and `data`: `{ "orderId", "ts" }` on success; `data` null on failure.

---

## Batch place order

**`POST /api/v1/private/order/submit_batch`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**Market-maker accounts only**; **max 50** orders per request.

**Body:** JSON **array** of order objects (same core fields as place order: `symbol`, `price`, `vol`, `side`, `type`, `openType`, …). **`stpMode`**: materials mark **required** for batch.

**Response `data`:** array of `{ "orderId", "errorCode" }`.

---

## Chase limit order

**`POST /api/v1/private/order/chase_limit_order`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| orderId | long | true | Order to chase (reprice toward one-tick BBO) |

---

## Modify limit order (price & quantity)

**`POST /api/v1/private/order/change_limit_order`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body:** `orderId`, `price`, `vol` (all required).

**Response:** `data` may be order id string on success.

---

## Cancel orders

**`POST /api/v1/private/order/cancel`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**Body:** JSON array of order ids **`List<Long>`**, **max 50** (materials label the parameter name awkwardly; the payload is the id list).

**Response `data`:** array of `{ "orderId", "errorCode", "errorMsg" }` per order.

---

## Batch cancel by external order id

**`POST /api/v1/private/order/batch_cancel_with_external`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**Body:** JSON array of `{ "symbol", "externalOid" }`.

**`data[]`:** `orderId`, `errorCode`, `errorMsg`.

---

## Cancel by external order id

**`POST /api/v1/private/order/cancel_with_external`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

Same body shape as batch external cancel (list of `{ symbol, externalOid }`); response shape matches batch per-row results.

---

## Cancel all orders under a contract

**`POST /api/v1/private/order/cancel_all`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract symbol, or **`""`** empty string to cancel **all** contracts |

---

## Reverse open position

**`POST /api/v1/private/position/reverse`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body:** `symbol`, `positionId`, `vol` (all required).

---

## Close all positions

**`POST /api/v1/private/position/close_all`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |
| **Request body** | None (confirm in official docs) |

**Response:** `data` may be an empty array `[]` in samples.

---

## Query in-flight order counts

**`POST /api/v1/private/order/open_order_total_count`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**`data`**

| Field | Type | Description |
|-------|------|-------------|
| sumCount | int | Total in-flight |
| limitOrderCount | int | Limit orders |
| stopOrderCount | int | Stop orders |
| planOrderCount | int | Plan orders |
| trackOrderCount | int | Track / chase-type bucket (per naming) |

> Published parameter tables that list **`orderId` / `price` / `vol`** for this route **do not match** the count response above; treat those rows as a **copy-paste error** and confirm the real **request body** (often empty `{}` or symbol scope) in MEXC’s live reference.

---

## Get order by external id

**`GET /api/v1/private/order/external/{symbol}/{external_oid}`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

Path: **`symbol`**, **`external_oid`**.

**`data`:** full order object (`orderId`, `symbol`, `positionId`, `price` / `priceStr`, `vol`, `leverage`, `side`, `category`, `orderType`, `dealAvgPrice`, `dealVol`, `state`, `openType`, `externalOid`, fees, `positionMode`, `bboTypeNum`, `totalFee`, zero-fee comparison fields, timestamps, …).

**`state`:** **1** pending **2** unfilled **3** filled **4** canceled **5** invalid.  
**`category`:** **1** limit **2** liquidation custody **3** custody close **4** ADL.

---

## Get order by order id

**`GET /api/v1/private/order/get/{orderId}`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

Path **`orderId`** (materials type **string**; numeric string in examples).

Same order object fields as external lookup, plus when present: **`lossTrend`**, **`profitTrend`**, **`takeProfitPrice`**, **`stopLossPrice`**, **`priceProtect`**, **`positionMode`**, **`bboTypeNum`**.

---

## Batch query orders by order id

**`GET /api/v1/private/order/batch_query`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | **5** / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| order_ids | string | true | Comma-separated ids, **max 50** (e.g. `order_ids=1,2,3`) |

> Path typo **`//api`** in some PDFs should be **`/api`**.

**`data`:** array of order objects (same core fields as single get).

---

## Batch query orders by external id

**`POST /api/v1/private/order/batch_query_with_external`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Body:** array of `{ "symbol", "externalOid" }`.

**`data`:** array of order objects.

---

## Get current (open) orders

**`GET /api/v1/private/order/list/open_orders`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page_num | int | true | Page (default **1**) |
| page_size | int | true | Size (default **20**, max **100**) |

**`data`:** array of open orders. Key fields (types vary number/string in JSON):

| Field | Description |
|-------|-------------|
| orderId | Order id |
| symbol, positionId, price, priceStr, vol, leverage | Core order |
| side | **1** open long **2** close short **3** open short **4** close long |
| category | **1**–**4** (limit / liquidation custody / custody close / ADL) |
| orderType | **1** limit **2** Post-Only **3** IOC **4** FOK (**5** market where applicable) |
| dealAvgPrice, dealVol, orderMargin, state | Fill / margin / **state** (1–5) |
| externalOid | If prefixed like chase-limit, indicates chase-limit (per materials) |
| errorCode | **0** normal; other codes per platform table (params, balance, position, liq vs price, risk limit, …) |
| positionMode | **1** dual **2** one-way |
| reduceOnly, bboTypeNum, totalFee, pnlRate, openAvgPrice | When present |
| zeroSaveTotalFeeBinance, zeroTradeTotalFeeBinance | Zero-fee comparison stats |

---

## Get all historical orders

**`GET /api/v1/private/order/list/history_orders`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract |
| states | string | false | Status filter: **1**–**5**; multiple values comma-separated |
| category | int | false | **1** limit **2** liq custody **3** custody close **4** ADL |
| startTime | long | false | Start (ms) |
| endTime | long | false | End (ms) |
| page_num | int | true | Page (default **1**) |
| page_size | int | true | Size (default **20**, max **100**) |
| orderId | long | false | Filter by order id |

**Response shape**

Materials describe **`data`** with pagination (`pageSize`, `totalCount`, `totalPage`, `currentPage`, **`resultList`**). Some examples show **`data`** as a **bare array** of orders; integrate against the paginated form when the API returns it.

**`resultList[]` / order row (selected)**

Same core fields as [Get order by order id](#get-order-by-order-id): `orderId`, `symbol`, `positionId`, `price` / `priceStr`, `vol`, `leverage`, `side`, `category`, `orderType`, `dealAvgPrice`, `dealVol`, `state`, `openType`, `externalOid`, `errorCode`, fees, `positionMode`, `bboTypeNum`, TP/SL fields when present, timestamps.

**Note (liquidation / takeover price)**  
For **forced-liquidation** orders, **`price`** here is the **platform takeover** price, not necessarily the position liquidation price. Use [Get open positions](#get-open-positions) for liquidation reference; see platform docs on forced liquidation and risk limits.

---

## Get historical order deal details (fills)

**`GET /api/v1/private/order/list/order_deals/v3`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract |
| start_time | long | false | Start |
| end_time | long | false | End |
| page_num | int | true | Page (default **1**) |
| page_size | int | true | Size (default **20**, max **1000**) |

**`data`:** paginated (`pageSize`, `totalCount`, `totalPage`, `currentPage`, **`resultList`**).

**`resultList[]`**

| Field | Type | Description |
|-------|------|-------------|
| id | long / string | Deal id |
| symbol | string | Contract |
| side | int | **1**–**4** (same as orders) |
| vol | decimal | Filled qty |
| price | decimal | Deal price |
| fee | decimal | Fee |
| feeCurrency | string | Fee asset |
| profit | decimal | PnL component |
| category | int | Order category |
| orderId | string / long | Parent order |
| timestamp | long | Time (ms) |
| positionMode | int | **1** dual **2** one-way |
| taker | boolean | Taker flag (example field name **`taker`**) |

---

## Get trade records by order id

**`GET /api/v1/private/order/deal_details/{orderId}`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Path:** `orderId` (required).

**`data`:** array of fills.

| Field | Type | Description |
|-------|------|-------------|
| id | long | Trade / deal id |
| symbol | string | Pair |
| side | int | **1**–**4** |
| vol, price | decimal | Fill qty / price |
| fee | decimal | Fee (**positive** = user pays; **negative** = user receives) |
| feeCurrency | string | Fee currency |
| profit | decimal | PnL |
| isTaker / taker | boolean | Taker flag (materials use **`isTaker`**; examples may use **`taker`**) |
| category | int | Category **1**–**4** |
| orderId | long | Order id |
| timestamp | long | Deal time |

---

## Query historical close orders

**`GET /api/v1/private/order/list/close_orders`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract |
| start_time | long | false | Start |
| end_time | long | false | End |
| page_num | int | false | Page (default **1**) |
| page_size | int | false | Size (default **20**, max **1000**) |

**`data`:** paginated wrapper **or** array in some responses — same fields as historical orders; **`category`** may include **5** delivery **6** liquidation hedge (per materials).

---

## Get plan order list

**`GET /api/v1/private/planorder/list/orders`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract |
| states | string | false | **1** untriggered **2** canceled **3** executed **4** invalidated **5** failed; comma-separated |
| side | int | false | **1**–**4** |
| start_time | long | true | Start (**13-digit** ms) |
| end_time | long | true | End (**13-digit** ms) |
| page_num | int | true | Page |
| page_size | int | true | Size (max **100**) |

**`data[]` (plan row)**

| Field | Description |
|-------|-------------|
| id | Plan order id |
| symbol, leverage, side, vol | Core |
| triggerPrice, price | Trigger vs execution price |
| openType | **1** isolated **2** cross |
| triggerType | **1** ≥ trigger **2** ≤ trigger |
| state | **1**–**5** (see `states` query) |
| executeCycle | Hours (e.g. **87600** in samples) |
| trend | Trigger ref: **1** last **2** fair **3** index |
| orderType | **1**–**5** (limit … market) |
| orderId | Filled child order id when executed |
| positionMode, reduceOnly, priceProtect | Modes |
| lossTrend, profitTrend, stopLossPrice, takeProfitPrice | TP/SL linkage |

---

## Place plan order (v2)

**`POST /api/v1/private/planorder/place/v2`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract |
| price | decimal | false | Execution price; omit for **market** plan |
| vol | decimal | true | Quantity |
| leverage | int | true | Required when **opening** |
| side | int | true | **1**–**4** |
| openType | int | true | **1** isolated **2** cross (some PDFs mislabel this as side values — match `/order/create`) |
| triggerPrice | decimal | true | Trigger price |
| triggerType | int | true | **1** ≥ **2** ≤ |
| executeCycle | int | true | Cycle code (materials: **1** = 24h, **2** = 7d; large hour counts also appear in samples) |
| orderType | int | true | **1**–**5** |
| trend | int | true | **1** last **2** fair **3** index |
| priceProtect | int | false | **1** / **0** |
| positionMode | int | false | **0** / **1** dual **2** one-way |
| lossTrend, profitTrend | int | false | TP/SL ref types |
| stopLossPrice, takeProfitPrice | decimal | false | Attached TP/SL |
| reduceOnly | boolean | false | Reduce-only |

**Response:** `data` = plan / order id string on success.

---

## Modify plan order

**`POST /api/v1/private/planorder/change_price`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract |
| orderId | long | true | Plan order id |
| triggerPrice, price | decimal | true | Trigger and execution price |
| orderType | int | true | **1**–**5** |
| triggerType | int | true | **1** / **2** |
| trend | int | true | **1**–**3** |
| from | int | true | **1** edit from trade list **2** from list; empty if edited via chart drag |

---

## Cancel plan orders

**`POST /api/v1/private/planorder/cancel`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**Body:** JSON array (**max 50**): `[{ "symbol", "orderId" }, …]` (`orderId` type string or long per environment).

---

## Cancel all plan orders

**`POST /api/v1/private/planorder/cancel_all`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Scope to contract; omit for **all** contracts |

---

## Place TP/SL by position

**`POST /api/v1/private/stoporder/place`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | **5** / 2 seconds |

**JSON body** (condensed; confirm required flags for market vs limit TP/SL in live API)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lossTrend, profitTrend | int | true | **1** last **2** fair **3** index |
| positionId | long | true | Position |
| vol | decimal | true | Qty within contract rules; with existing TP/SL must stay within closable qty |
| stopLossPrice, takeProfitPrice | decimal | false | At least one **> 0** |
| priceProtect | int | false | **1** / **0** |
| profitLossVolType | string | false | **SAME** / **SEPARATE** |
| takeProfitVol, stopLossVol | decimal | false | If **SEPARATE** |
| volType | int | false | **1** partial **2** full position |
| takeProfitReverse, stopLossReverse | int | false | **1** yes **2** no |
| mtoken | string | false | Web device id |
| takeProfitType | int | false | **0** market TP **1** limit TP |
| takeProfitOrderPrice | decimal | | Limit TP price when `takeProfitType == 1` |
| stopLossType | long | | **0** market SL **1** limit SL |
| stopLossOrderPrice | decimal | | Limit SL price when `stopLossType == 1` |

**Response:** `data` may be id or structured rows; duplicate-price TP/SL may update existing order async (per materials).

---

## Cancel TP/SL orders

**`POST /api/v1/private/stoporder/cancel`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**Body:** array (**max 50**): `[{ "stopPlanOrderId": … }, …]`.

---

## Cancel all TP/SL orders

**`POST /api/v1/private/stoporder/cancel_all`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| positionId | long | false | Cancel for one position |
| symbol | string | false | Else filter by contract; omit for **all** |

---

## Modify TP/SL on a limit order

**`POST /api/v1/private/stoporder/change_price`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body:** `orderId` (limit order), optional `lossTrend`, `profitTrend`, `stopLossPrice`, `takeProfitPrice`, `takeProfitReverse`, `stopLossReverse`. If both TP and SL are empty or **0**, TP/SL on that order is **removed**.

---

## Modify TP/SL on a TP/SL planned order

**`POST /api/v1/private/stoporder/change_plan_price`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body:** `stopPlanOrderId` (required); at least one of TP/SL **> 0**; same reverse fields as above.

---

## Modify TP/SL on plan order (unified)

**`POST /api/v1/private/planorder/change_stop_order`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract |
| orderId | long | true | Order id |
| lossTrend | int | false | **1**–**3** when `stopLossPrice > 0` |
| profitTrend | int | false | **1**–**3** when `takeProfitPrice > 0` |
| stopLossPrice | decimal | false | **0** / omit = clear SL |
| takeProfitPrice | decimal | false | **0** / omit = clear TP |

**Rules (abridged)**

- If `stopLossPrice > 0`, **`lossTrend`** must be **1**, **2**, or **3** — else **3001** (price type error).
- If `takeProfitPrice > 0`, **`profitTrend`** must be **1**, **2**, or **3** — else **3001**.
- Omitting or zeroing one side **clears** that side; both absent or both **0** clears **both**.
- If `lossTrend` / `profitTrend` omitted, default **1** (last price); if provided, must be **1–3**.

---

## Get TP/SL order list

**`GET /api/v1/private/stoporder/list/orders`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract |
| is_finished | int | false | **0** open **1** terminal |
| state | int | false | **1**–**5** |
| type | int | false | Position **1** long **2** short |
| start_time, end_time | long | false | **13-digit** ms window |
| page_num | int | true | Page |
| page_size | int | true | Size (max **100**) |

**`data[]`:** TP/SL rows: `id`, `orderId`, `positionId`, `stopLossPrice`, `takeProfitPrice`, `state`, `triggerSide` (**0** none **1** TP **2** SL), `vol`, `realityVol`, `placeOrderId`, `profitLossVolType`, `volType`, reverses, limit TP/SL types and prices, `priceProtect`, timestamps, etc.

---

## Get current TP/SL order list (open only)

**`GET /api/v1/private/stoporder/open_orders`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract filter |

**`data[]`:** same TP/SL shape as [Get TP/SL order list](#get-tpsl-order-list), for **non-finished** working orders. Examples may include:

| Field | Description |
|-------|-------------|
| closeTryTimes, reverseTryTimes | Retry counters (when present) |
| reverseErrorCode | Error from reverse attempt (**0** if none) |
| profit_LOSS_VOL_TYPE_SAME, profit_LOSS_VOL_TYPE_DIFFERENT | Constants echoing **SAME** / **SEPARATE** (example noise; optional in live API) |

`orderId`, `positionId`, `placeOrderId` may be **string or long** in JSON.

---

## Trailing (track) orders

### Place trailing order

**`POST /api/v1/private/trackorder/place`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | true | Contract |
| leverage | int | true | Leverage |
| side | int | true | **1** open long **2** close short **3** open short **4** close long |
| vol | decimal | true | Quantity |
| openType | int | true | **1** isolated **2** cross |
| trend | int | true | Ref price: **1** last **2** fair **3** index |
| activePrice | decimal | false | Activation price |
| backType | int | true | **1** percentage callback **2** absolute callback |
| backValue | decimal | true | Callback magnitude |
| positionMode | int | true | **0** default / historical **1** dual **2** one-way |
| reduceOnly | boolean | false | Reduce-only |

**Response:** `data` = trailing order id string on success.

### Cancel trailing order

**`POST /api/v1/private/trackorder/cancel`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract |
| trackOrderId | int | false | Trailing order id |

### Modify trailing order

**`POST /api/v1/private/trackorder/change_order`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 4 / 2 seconds |

**JSON body:** `symbol`, `trackOrderId`, `trend`, `backType`, `backValue`, `vol` (required); `activePrice` optional.

### Query trailing orders

**`GET /api/v1/private/trackorder/list/orders`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | false | Contract |
| states | list of int | true | **0** not activated **1** activated **2** triggered ok **3** trigger failed **4** canceled (encoding: comma list or repeated param — confirm official doc) |
| side | int | false | **1**–**4** |
| start_time, end_time | long | false | Time window |
| pageIndex | int | false | Page index |
| pageSize | int | false | Page size |

**`data[]` (selected)**

| Field | Description |
|-------|-------------|
| id | Trailing order id (string or long in JSON) |
| markPrice | Reference extreme after activation |
| triggerPrice | Current trigger (moves with reference) |
| triggerType | **1** ≥ **2** ≤ |
| orderId | Child order after successful trigger (**0** if none) |
| state | **0**–**4** (see `states` query) |
| errorCode | On trigger failure |

Numeric types in samples may appear as **int** or **decimal**; parse flexibly.

---

## Market maker — STP blacklist (self-trade groups)

**Market-maker accounts only** (per platform copy).

### Query STP groups and members

**`GET /api/v1/private/market_maker/self_trade/blacklist`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| configName | string | false | Filter by blacklist **group id** / name |

**`data[]`**

| Field | Type | Description |
|-------|------|-------------|
| groupName | string | Group name |
| blackList | list of string | Sub-account **UID** strings |
| createTime, updateTime | long | Audit times |

### Get current user STP group

**`GET /api/v1/private/market_maker/self_trade/blacklist/search`**

| | |
|--|--|
| **Permission** | View Order Details |
| **Rate limit** | 20 / 2 seconds |
| **Request parameters** | None |

**Response:** envelope only in short samples (`success` / `code`); confirm payload in official docs.

### Create STP group

**`POST /api/v1/private/market_maker/self_trade/blacklist/create`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| configName | string | true | Group id / name |
| blacklist | array of number / string | true | Sub-account UIDs |

**Response:** `data` may be a numeric status (e.g. **1**) in samples.

### Update STP group

**`POST /api/v1/private/market_maker/self_trade/blacklist/update`**

Same body as **create** (`configName`, `blacklist`).

### Delete STP group

**`POST /api/v1/private/market_maker/self_trade/blacklist/delete`**

| | |
|--|--|
| **Permission** | Order Placing |
| **Rate limit** | 20 / 2 seconds |

**JSON body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| configName | string | true | Group id / name to remove |

---

**Related (spot in this repo):** [Introduction](introduction.md) · [Spot account & trade](spot-account-trade.md)
