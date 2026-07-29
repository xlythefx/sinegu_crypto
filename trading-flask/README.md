# Binance Flask

Binance Futures trading bot with Flask webhook and Tkinter launcher.

## Install

```bash
pip install -r requirements.txt
```

## Config

Copy `.env.example` to `.env` and set:

- `API_BASE_URL` — Sinegu API base (assets, binance_accounts, etc.). Binance API keys come from the `binance_accounts` table via this API.
- `WEBHOOK_SECRET` — Must match TradingView webhook secret
- `LIVE_QUANTITY` — Default quantity per order (e.g. 0.01)

## Flask ports

| Service | Env var | Default | Webhook path |
|---|---|---|---|
| Binance (Normal — balance >= 500 USDT) | `BINANCE_FLASK_PORT` | 5000 | `/binance_webhook` |
| Binance Lite (100 <= balance < 500 USDT) | `BINANCE_LITE_FLASK_PORT` | 5003 | `/binance_lite_webhook` |
| MEXC | `MEXC_FLASK_PORT` | 5001 | `/mexc_webhook` |
| Bybit | `BYBIT_FLASK_PORT` | 5002 | `/bybit_webhook` |

Account listeners: `BINANCE_ACCOUNT_LISTENER_PORT=6000`, `MEXC_ACCOUNT_LISTENER_PORT=6001`, `BYBIT_ACCOUNT_LISTENER_PORT=6002`.

Lite secret falls back to `BINANCE_WEBHOOK_SECRET` if `BINANCE_LITE_WEBHOOK_SECRET` is unset. Point TradingView at both Binance webhooks — each flask self-filters by account balance.

## Run Flask

```bash
python -m src.main
```

Server runs on `0.0.0.0:5001`.

## Run Launcher

```bash
python binance_tradingbot.py
```

Or on Windows (no console):

```bash
pythonw binance_tradingbot.py
```

## Webhook

POST `/binance_webhook` with JSON:

```json
{
  "secret": "your_webhook_secret",
  "action": "add",
  "symbol": "XAUUSDT",
  "quantity": 0.01
}
```

Actions: `add` / `buy`, `exit`, `sell`, `order`.

## Plan

See [plan/](plan/) for architecture and run instructions.
