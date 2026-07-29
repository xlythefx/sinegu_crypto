# Binance Flask — Flask Routes

## Binance webhook (POST /binance_webhook)

TradingView webhook endpoint. Fetches assets from sinegu-api (`API_BASE_URL` + `ASSETS_ENDPOINT`) for position sizing and Binance symbol mapping.

### Body (JSON)

| Field | Required | Description |
|-------|----------|-------------|
| secret | Yes | Must match WEBHOOK_SECRET |
| action | Yes | **BUY** \| **SELL** \| **EXIT_LONG** \| **EXIT_SHORT** |
| symbol / ticker | Yes | e.g. XAUUSDT, GOLD, BTCUSD (mapped via assets) |
| quantity | No | Default from asset base_size, else LIVE_QUANTITY |
| price / close | No | Optional |

### Actions

| action | Behavior |
|--------|----------|
| BUY | Market BUY (open long) |
| SELL | Market SELL (open short) |
| EXIT_LONG | Close only LONG position for symbol |
| EXIT_SHORT | Close only SHORT position for symbol |

When sinegu-api is available, ticker is resolved to Binance symbol and quantity uses the asset's `base_size` if not provided.

## Health (GET /health)

Returns `{"status": "ok", "service": "binance-flask"}`.

## Admin Refresh (POST /admin/refresh)

Reloads config from hooks and .env. Optional; returns `{"success": true}`.
