# Binance Flask — Run Instructions

## Install

```bash
cd c:\Users\Xlythe\binance-flask
pip install -r requirements.txt
```

## .env Setup

Copy `.env.example` to `.env` and set:

```
API_BASE_URL=http://localhost/sinegu-api
WEBHOOK_SECRET=your_webhook_secret
```

Binance API keys are loaded from the `binance_accounts` table via the API (no .env keys required).

Optional: `LIVE_QUANTITY=0.01` (default quantity per order).

## Run Flask Directly

```bash
cd c:\Users\Xlythe\binance-flask
python -m src.main
```

Server runs on `0.0.0.0:5001`.

## Run Tkinter Launcher

```bash
cd c:\Users\Xlythe\binance-flask
python binance_tradingbot.py
```

Or on Windows (no console):

```bash
pythonw binance_tradingbot.py
```

## Trade Logs

Webhook trades logged to `out/webhook_trades.log` (one JSON line per webhook).
