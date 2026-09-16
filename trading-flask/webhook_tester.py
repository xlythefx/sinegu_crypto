"""Tkinter trade sender for the BINANCE_ABCD engine.

Builds the exact JSON TradingView would post and fires it at the webhook —
local by default, or prod (the URL field is an editable combobox). A red
banner appears whenever the target is not localhost: with live accounts on
the other end, every send is a real trade.

Run:  python webhook_tester.py   (from trading-flask/)
"""

from __future__ import annotations

import json
import os
import threading
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import ttk

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env", override=False)

DEFAULT_PORT = os.environ.get("BINANCE_ABCD_FLASK_PORT", "5010")
URL_PRESETS = [
    f"http://127.0.0.1:{DEFAULT_PORT}/binance_abcd_webhook",
    "https://pixel-alpha.com/binance_abcd_webhook",
    # The origin by address still answers (nginx does not redirect the bare IP),
    # kept as the fallback for when DNS or Cloudflare is the thing being debugged.
    "http://2.24.139.176/binance_abcd_webhook",
]
DEFAULT_SECRET = os.environ.get("BINANCE_ABCD_WEBHOOK_SECRET", "")

ACTIONS = ["BUY", "SELL", "EXIT_LONG", "EXIT_SHORT"]
SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "DOGEUSDT", "SOLUSDT"]

BG = "#101418"
FG = "#e6edf3"
ACCENT = "#2f81f7"
DANGER = "#f85149"
FIELD_BG = "#1c2128"


class TesterApp:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("BINANCE_ABCD — webhook tester")
        self.root.configure(bg=BG)
        self.root.geometry("640x680")
        self.root.minsize(560, 560)

        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("TLabel", background=BG, foreground=FG)
        style.configure("TFrame", background=BG)
        style.configure("TCombobox", fieldbackground=FIELD_BG, background=FIELD_BG, foreground=FG)

        body = ttk.Frame(self.root, padding=16)
        body.pack(fill="both", expand=True)
        body.columnconfigure(1, weight=1)

        # Target URL + PROD banner ------------------------------------------
        ttk.Label(body, text="Webhook URL").grid(row=0, column=0, sticky="w", pady=4)
        self.url_var = tk.StringVar(value=URL_PRESETS[0])
        url_box = ttk.Combobox(body, textvariable=self.url_var, values=URL_PRESETS)
        url_box.grid(row=0, column=1, sticky="ew", pady=4)
        self.url_var.trace_add("write", lambda *_: self._update_prod_banner())

        self.prod_banner = tk.Label(
            body,
            text="",
            bg=BG,
            fg=DANGER,
            font=("Segoe UI", 10, "bold"),
        )
        self.prod_banner.grid(row=1, column=0, columnspan=2, sticky="ew")

        # Fields -------------------------------------------------------------
        self.action_var = tk.StringVar(value=ACTIONS[0])
        self.symbol_var = tk.StringVar(value=SYMBOLS[0])
        self.price_var = tk.StringVar()
        self.leverage_var = tk.StringVar()
        self.strategy_var = tk.StringVar(value="Manual-Test")
        self.targets_var = tk.StringVar()
        # Restricts the fan-out to some venues (CSV: binance, mexc). Empty =
        # every venue the engine has enabled — what a TradingView alert does.
        self.exchanges_var = tk.StringVar()
        self.secret_var = tk.StringVar(value=DEFAULT_SECRET)

        rows = [
            ("Action", ttk.Combobox(body, textvariable=self.action_var, values=ACTIONS, state="readonly")),
            ("Symbol", ttk.Combobox(body, textvariable=self.symbol_var, values=SYMBOLS)),
            ("Price (optional)", tk.Entry(body, textvariable=self.price_var, bg=FIELD_BG, fg=FG, insertbackground=FG)),
            ("Leverage (optional)", tk.Entry(body, textvariable=self.leverage_var, bg=FIELD_BG, fg=FG, insertbackground=FG)),
            ("Strategy (optional)", tk.Entry(body, textvariable=self.strategy_var, bg=FIELD_BG, fg=FG, insertbackground=FG)),
            ("target_uni_ids CSV (optional)", tk.Entry(body, textvariable=self.targets_var, bg=FIELD_BG, fg=FG, insertbackground=FG)),
            ("exchanges CSV (optional)", tk.Entry(body, textvariable=self.exchanges_var, bg=FIELD_BG, fg=FG, insertbackground=FG)),
            ("Secret", tk.Entry(body, textvariable=self.secret_var, show="*", bg=FIELD_BG, fg=FG, insertbackground=FG)),
        ]
        for offset, (label, widget) in enumerate(rows, start=2):
            ttk.Label(body, text=label).grid(row=offset, column=0, sticky="w", pady=4, padx=(0, 12))
            widget.grid(row=offset, column=1, sticky="ew", pady=4)

        # Send ---------------------------------------------------------------
        self.send_button = tk.Button(
            body,
            text="SEND SIGNAL",
            command=self.send,
            bg=ACCENT,
            fg="white",
            activebackground="#1f6feb",
            activeforeground="white",
            relief="flat",
            font=("Segoe UI", 11, "bold"),
            pady=8,
        )
        self.send_button.grid(row=10, column=0, columnspan=2, sticky="ew", pady=(12, 8))

        # Response pane ------------------------------------------------------
        self.output = tk.Text(
            body,
            height=14,
            bg=FIELD_BG,
            fg=FG,
            insertbackground=FG,
            relief="flat",
            font=("Consolas", 9),
            state="disabled",
            wrap="word",
        )
        self.output.grid(row=11, column=0, columnspan=2, sticky="nsew")
        body.rowconfigure(11, weight=1)

        self._update_prod_banner()

    # ------------------------------------------------------------------------

    def _is_local(self) -> bool:
        url = self.url_var.get().lower()
        return "127.0.0.1" in url or "localhost" in url

    def _update_prod_banner(self) -> None:
        if self._is_local():
            self.prod_banner.configure(text="")
        else:
            self.prod_banner.configure(text="⚠ PROD TARGET — this fires REAL trades on every live account")

    def _log(self, text: str) -> None:
        stamp = datetime.now().strftime("%H:%M:%S")
        self.output.configure(state="normal")
        self.output.insert("end", f"[{stamp}] {text}\n")
        self.output.see("end")
        self.output.configure(state="disabled")

    def _build_payload(self) -> dict:
        payload = {
            "secret": self.secret_var.get().strip(),
            "action": self.action_var.get().strip().upper(),
            "symbol": self.symbol_var.get().strip().upper(),
        }
        if self.price_var.get().strip():
            payload["price"] = self.price_var.get().strip()
        if self.leverage_var.get().strip():
            payload["leverage"] = self.leverage_var.get().strip()
        if self.strategy_var.get().strip():
            payload["strategy"] = self.strategy_var.get().strip()
        if self.targets_var.get().strip():
            payload["target_uni_ids"] = self.targets_var.get().strip()
        if self.exchanges_var.get().strip():
            payload["exchanges"] = self.exchanges_var.get().strip().lower()
        return payload

    def send(self) -> None:
        payload = self._build_payload()
        url = self.url_var.get().strip()
        if not payload["secret"]:
            self._log("refusing to send: secret is empty")
            return

        echo = dict(payload, secret="***")
        self._log(f"POST {url}\n          {json.dumps(echo)}")
        self.send_button.configure(state="disabled", text="SENDING...")

        def worker() -> None:
            try:
                response = requests.post(url, json=payload, timeout=15)
                body = response.text[:3000]
                self.root.after(0, self._log, f"HTTP {response.status_code}: {body}")
            except requests.RequestException as exc:
                self.root.after(0, self._log, f"request failed: {exc}")
            finally:
                self.root.after(0, self.send_button.configure, {"state": "normal", "text": "SEND SIGNAL"})

        threading.Thread(target=worker, daemon=True).start()

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    TesterApp().run()
