# Binance Flask — Architecture

## Component Diagram

```
+------------------+
| Tkinter Launcher |
| binance_tradingbot |
+--------+---------+
         | Start/Stop
         v
+------------------+     +------------------+
| Flask App :5001  |---->| binance_api.py   |
| main.py          |     | (REST client)    |
| routes: binance_webhook, |     +--------+---------+
| health, admin    |              |
+------------------+              v
         ^                +------------------+
         |                | Binance Futures  |
    hooks.py + .env       | fapi.binance.com |
                          +------------------+
```

## Data Flow

1. TradingView sends POST `/binance_webhook` with `secret`, `action`, `symbol`.
2. `main.py` validates secret, calls `trading_handler` by action.
3. `trading_handler` uses `binance_api` to place orders or close positions.
4. Result logged to `out/webhook_trades.log`.
5. Response JSON returned to TradingView.

## Config Sources

| Source | Content |
|--------|---------|
| `hooks.py` | BINANCE_API_BASE, WEBHOOK_SECRET, OUT_DIR, intervals |
| `.env` | API_BASE_URL, WEBHOOK_SECRET, LIVE_QUANTITY (Binance keys from binance_accounts via API) |
