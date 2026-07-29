#!/usr/bin/env python3
import json
import threading
import tkinter as tk
from pathlib import Path
from tkinter import ttk, messagebox

import requests
from dotenv import load_dotenv
import os

if os.name == "nt":
    try:
        import ctypes

        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 0)
    except Exception:
        pass


PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env", override=False)

# Preset targets for the Target URL dropdown (local defaults + production).
# The field stays editable, so any URL can still be typed in.
TARGET_URL_PRESETS = [
    "http://127.0.0.1:5000/binance_webhook",
    "http://127.0.0.1:5001/mexc_webhook",
    "https://python.flowehn.com/binance_webhook",
    "https://python.flowehn.com/mexc_webhook",
]


class TestTradeSenderApp:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Flask Test Trade Sender")
        self.root.minsize(620, 500)

        self.broker_var = tk.StringVar(value="binance")
        self.symbol_var = tk.StringVar(value="BTCUSDT")
        self.action_var = tk.StringVar(value="BUY")
        self.strategy_var = tk.StringVar(value="VWMA-Reversion")
        self.leverage_var = tk.StringVar(value="25")
        self.price_var = tk.StringVar(value="")

        self.url_var = tk.StringVar()
        self.secret_preview_var = tk.StringVar()

        self._build_ui()
        self._refresh_broker_dependent_fields()

    def _build_ui(self) -> None:
        main = ttk.Frame(self.root, padding=12)
        main.pack(fill=tk.BOTH, expand=True)

        ttk.Label(main, text="Send test webhook trades to local Flask", font=("", 11, "bold")).pack(anchor=tk.W)

        broker_row = ttk.Frame(main)
        broker_row.pack(fill=tk.X, pady=(10, 4))
        ttk.Label(broker_row, text="Broker", width=12).pack(side=tk.LEFT)
        ttk.Radiobutton(
            broker_row, text="Binance", value="binance", variable=self.broker_var, command=self._refresh_broker_dependent_fields
        ).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Radiobutton(
            broker_row, text="MEXC", value="mexc", variable=self.broker_var, command=self._refresh_broker_dependent_fields
        ).pack(side=tk.LEFT)

        symbol_row = ttk.Frame(main)
        symbol_row.pack(fill=tk.X, pady=4)
        ttk.Label(symbol_row, text="Symbol", width=12).pack(side=tk.LEFT)
        ttk.Combobox(
            symbol_row,
            textvariable=self.symbol_var,
            state="readonly",
            values=["BTCUSDT", "FETUSDT", "ETHUSDT"],
            width=18,
        ).pack(side=tk.LEFT)

        action_row = ttk.Frame(main)
        action_row.pack(fill=tk.X, pady=4)
        ttk.Label(action_row, text="Action", width=12).pack(side=tk.LEFT)
        ttk.Combobox(
            action_row,
            textvariable=self.action_var,
            state="readonly",
            values=["BUY", "SELL", "EXIT_LONG", "EXIT_SHORT"],
            width=18,
        ).pack(side=tk.LEFT)

        strategy_row = ttk.Frame(main)
        strategy_row.pack(fill=tk.X, pady=4)
        ttk.Label(strategy_row, text="Strategy", width=12).pack(side=tk.LEFT)
        ttk.Entry(strategy_row, textvariable=self.strategy_var, width=30).pack(side=tk.LEFT, fill=tk.X, expand=True)

        lev_row = ttk.Frame(main)
        lev_row.pack(fill=tk.X, pady=4)
        ttk.Label(lev_row, text="Leverage", width=12).pack(side=tk.LEFT)
        ttk.Entry(lev_row, textvariable=self.leverage_var, width=12).pack(side=tk.LEFT)

        price_row = ttk.Frame(main)
        price_row.pack(fill=tk.X, pady=4)
        ttk.Label(price_row, text="Price (opt)", width=12).pack(side=tk.LEFT)
        ttk.Entry(price_row, textvariable=self.price_var, width=20).pack(side=tk.LEFT)

        url_row = ttk.Frame(main)
        url_row.pack(fill=tk.X, pady=(10, 4))
        ttk.Label(url_row, text="Target URL", width=12).pack(side=tk.LEFT)
        ttk.Combobox(
            url_row,
            textvariable=self.url_var,
            values=TARGET_URL_PRESETS,
        ).pack(side=tk.LEFT, fill=tk.X, expand=True)

        secret_row = ttk.Frame(main)
        secret_row.pack(fill=tk.X, pady=4)
        ttk.Label(secret_row, text="Secret", width=12).pack(side=tk.LEFT)
        ttk.Entry(secret_row, textvariable=self.secret_preview_var, state="readonly").pack(side=tk.LEFT, fill=tk.X, expand=True)

        button_row = ttk.Frame(main)
        button_row.pack(fill=tk.X, pady=(12, 8))
        ttk.Button(button_row, text="Send Trade", command=self._send_trade).pack(side=tk.LEFT)
        ttk.Button(button_row, text="Clear Log", command=self._clear_log).pack(side=tk.LEFT, padx=(8, 0))

        ttk.Label(main, text="Response log").pack(anchor=tk.W)
        self.log_text = tk.Text(main, height=14, wrap=tk.WORD)
        self.log_text.pack(fill=tk.BOTH, expand=True, pady=(4, 0))

    def _env_for_broker(self) -> tuple[str, str]:
        if self.broker_var.get() == "mexc":
            port = os.getenv("MEXC_FLASK_PORT", "5001")
            secret = os.getenv("MEXC_WEBHOOK_SECRET", "")
            return f"http://127.0.0.1:{port}/mexc_webhook", secret
        port = os.getenv("BINANCE_FLASK_PORT", "5000")
        secret = os.getenv("BINANCE_WEBHOOK_SECRET", "")
        return f"http://127.0.0.1:{port}/binance_webhook", secret

    def _refresh_broker_dependent_fields(self) -> None:
        url, secret = self._env_for_broker()
        self.url_var.set(url)
        self.secret_preview_var.set(secret)

    def _build_payload(self) -> dict:
        payload = {
            "secret": self.secret_preview_var.get().strip(),
            "strategy": self.strategy_var.get().strip(),
            "leverage": self.leverage_var.get().strip(),
            "action": self.action_var.get().strip(),
            "symbol": self.symbol_var.get().strip(),
        }
        price = self.price_var.get().strip()
        if price:
            payload["price"] = price
        return payload

    def _append_log(self, text: str) -> None:
        self.log_text.insert(tk.END, text + "\n")
        self.log_text.see(tk.END)

    def _clear_log(self) -> None:
        self.log_text.delete("1.0", tk.END)

    def _send_trade(self) -> None:
        url = self.url_var.get().strip()
        payload = self._build_payload()

        if not payload["secret"]:
            messagebox.showerror("Missing secret", "Webhook secret is empty. Set it in .env first.")
            return

        self._append_log("=" * 70)
        self._append_log(f"POST {url}")
        self._append_log(json.dumps({**payload, "secret": "***"}, indent=2))

        def _worker() -> None:
            try:
                res = requests.post(url, json=payload, timeout=15)
                body = res.text
                if len(body) > 3000:
                    body = body[:3000] + "...<truncated>"
                self.root.after(0, lambda: self._append_log(f"HTTP {res.status_code}\n{body}"))
            except Exception as exc:
                self.root.after(0, lambda: self._append_log(f"ERROR: {exc}"))

        threading.Thread(target=_worker, daemon=True).start()

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    TestTradeSenderApp().run()
