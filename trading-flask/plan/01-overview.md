# Binance Flask — Overview

## Project Goal

Build a Binance Futures trading bot with Flask, inspired by the Capital.com SineguMain structure. Receive TradingView webhooks, execute orders on Binance USD-M Futures, and manage background services via a Tkinter launcher.

## Repo Layout

```
binance-flask/
├── plan/                    # Plan docs (this folder)
│   ├── 01-overview.md
│   ├── 02-architecture.md
│   ├── 03-binance-api.md
│   ├── 04-flask-routes.md
│   ├── 05-tkinter-launcher.md
│   └── 06-run-instructions.md
├── docs/                    # Binance API reference
├── src/                     # Flask app + trading logic
│   ├── main.py
│   ├── hooks.py
│   ├── binance_api.py
│   ├── trading_handler.py
│   └── routes/
├── binance_tradingbot.py     # Tkinter launcher (run this to start services)
├── headless/                # Logs + tail util
├── out/                     # Trade logs, exports
├── .env.example
├── requirements.txt
└── README.md
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| flask | >=2.0.0 | HTTP server |
| flask-cors | >=3.0.0 | CORS |
| requests | >=2.28.0 | Binance REST calls |
| certifi | >=2023.0.0 | SSL |
| python-dotenv | >=1.0.0 | Load .env |

Tkinter is stdlib; no extra install.
