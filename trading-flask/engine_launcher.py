"""Tkinter launcher for the BINANCE_ABCD engine.

Starts/stops ``python -m binance_abcd.main`` as a child process, streams its
log output, and shows copy-paste-ready webhook values — the path, the local
and prod URLs, TradingView-ready URLs with ``?secret=`` baked in, the shared
secret itself, and a sample alert message — so the same strings can go
straight into a TradingView alert's "Webhook URL" and "Message" fields.

TradingView's servers cannot reach 127.0.0.1: use the local URL for
webhook_tester.py / curl, and the PROD URL (real trades!) for actual
TradingView alerts.

Run:  python engine_launcher.py   (from trading-flask/)
"""

from __future__ import annotations

import json
import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import messagebox, ttk

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env", override=False)

PORT = os.environ.get("BINANCE_ABCD_FLASK_PORT", "5010")
SECRET = os.environ.get("BINANCE_ABCD_WEBHOOK_SECRET", "")
WEBHOOK_PATH = "/binance_abcd_webhook"
PROD_BASE = "https://pixel-alpha.com"

LOCAL_URL = f"http://127.0.0.1:{PORT}{WEBHOOK_PATH}"
PROD_URL = f"{PROD_BASE}{WEBHOOK_PATH}"
HEALTH_URL = f"http://127.0.0.1:{PORT}/health"

# Production alert format: secret travels in the JSON body, leverage is fixed.
# "{{strategy.order.comment}}" / "{{ticker}}" are TradingView placeholders for
# strategy alerts; picking an explicit action/ticker pins the value instead.
TV_ACTIONS = ["{{strategy.order.comment}}", "BUY", "SELL", "EXIT_LONG", "EXIT_SHORT"]
TV_SYMBOLS = ["{{ticker}}", "ALGOUSDT", "BTCUSDT", "ETHUSDT", "FETUSDT", "LTCUSDT"]

BG = "#101418"
FG = "#e6edf3"
MUTED = "#8b949e"
ACCENT = "#2f81f7"
GREEN = "#3fb950"
DANGER = "#f85149"
FIELD_BG = "#1c2128"


class LauncherApp:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("BINANCE_ABCD — engine launcher")
        self.root.configure(bg=BG)
        self.root.geometry("760x720")
        self.root.minsize(640, 600)

        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("TLabel", background=BG, foreground=FG)
        style.configure("TFrame", background=BG)
        style.configure("TCombobox", fieldbackground=FIELD_BG, background=FIELD_BG, foreground=FG)

        self.proc: subprocess.Popen[str] | None = None
        self.log_queue: "queue.Queue[str]" = queue.Queue()
        self.secret_shown = False

        body = ttk.Frame(self.root, padding=16)
        body.pack(fill="both", expand=True)
        body.columnconfigure(1, weight=1)

        # Engine controls ----------------------------------------------------
        self.status_label = tk.Label(
            body, text="● STOPPED", bg=BG, fg=DANGER, font=("Segoe UI", 12, "bold")
        )
        self.status_label.grid(row=0, column=0, sticky="w", pady=(0, 8))

        controls = ttk.Frame(body)
        controls.grid(row=0, column=1, columnspan=2, sticky="e", pady=(0, 8))
        self.start_button = self._button(controls, "START ENGINE", self.start, ACCENT)
        self.start_button.pack(side="left", padx=(0, 8))
        self.stop_button = self._button(controls, "STOP", self.stop, DANGER)
        self.stop_button.pack(side="left", padx=(0, 8))
        self.stop_button.configure(state="disabled")
        self._button(controls, "Open trade tester", self.open_tester, FIELD_BG).pack(side="left")

        # Copyable webhook values -------------------------------------------
        self.copy_values: dict[str, str] = {
            "Webhook path": WEBHOOK_PATH,
            "Local URL (tester / curl)": LOCAL_URL,
            "Local URL + secret": f"{LOCAL_URL}?secret={SECRET}",
            "PROD URL + secret (TradingView)": f"{PROD_URL}?secret={SECRET}",
            "Secret": SECRET,
        }
        row = 1
        for label, value in self.copy_values.items():
            masked = label == "Secret"
            danger = label.startswith("PROD")
            ttk.Label(body, text=label).grid(row=row, column=0, sticky="w", pady=3, padx=(0, 12))
            shown = self._display_text(label, value)
            entry = tk.Entry(
                body,
                bg=FIELD_BG,
                fg=DANGER if danger else FG,
                insertbackground=FG,
                relief="flat",
                font=("Consolas", 9),
            )
            entry.insert(0, shown)
            entry.configure(state="readonly", readonlybackground=FIELD_BG)
            entry.grid(row=row, column=1, sticky="ew", pady=3)
            if masked:
                self.secret_entry = entry
                self._button(body, "👁", self.toggle_secret, FIELD_BG).grid(
                    row=row, column=2, sticky="ew", padx=(6, 0)
                )
                self._copy_button(body, label).grid(row=row, column=3, sticky="ew", padx=(6, 0))
            else:
                self._copy_button(body, label).grid(row=row, column=2, sticky="ew", padx=(6, 0))
            row += 1

        # TradingView alert message — the JSON regenerates from these controls;
        # Copy pastes exactly what's in the box (still hand-editable after).
        ttk.Label(body, text="TradingView alert message").grid(
            row=row, column=0, sticky="nw", pady=(8, 3), padx=(0, 12)
        )
        controls = ttk.Frame(body)
        controls.grid(row=row, column=1, sticky="ew", pady=(8, 3))
        controls.columnconfigure(1, weight=1)
        controls.columnconfigure(3, weight=1)

        self.tv_action_var = tk.StringVar(value=TV_ACTIONS[0])
        self.tv_symbol_var = tk.StringVar(value=TV_SYMBOLS[0])
        self.tv_strategy_var = tk.StringVar(value="VWAP-Deviation")
        self.tv_leverage_var = tk.StringVar(value="25")

        tv_fields = [
            ("Action", ttk.Combobox(controls, textvariable=self.tv_action_var, values=TV_ACTIONS, state="readonly")),
            ("Symbol", ttk.Combobox(controls, textvariable=self.tv_symbol_var, values=TV_SYMBOLS)),
            ("Strategy", tk.Entry(controls, textvariable=self.tv_strategy_var, bg=FIELD_BG, fg=FG, insertbackground=FG, relief="flat")),
            ("Leverage", tk.Entry(controls, textvariable=self.tv_leverage_var, bg=FIELD_BG, fg=FG, insertbackground=FG, relief="flat")),
        ]
        for index, (label, widget) in enumerate(tv_fields):
            grid_row, grid_col = divmod(index, 2)
            ttk.Label(controls, text=label).grid(
                row=grid_row, column=grid_col * 2, sticky="w", padx=(0 if grid_col == 0 else 12, 6), pady=2
            )
            widget.grid(row=grid_row, column=grid_col * 2 + 1, sticky="ew", pady=2)
        for var in (self.tv_action_var, self.tv_symbol_var, self.tv_strategy_var, self.tv_leverage_var):
            var.trace_add("write", self._rebuild_tv_message)
        row += 1

        self.tv_message = tk.Text(
            body,
            height=8,
            bg=FIELD_BG,
            fg=FG,
            insertbackground=FG,
            relief="flat",
            font=("Consolas", 9),
            wrap="none",
        )
        self.tv_message.grid(row=row, column=1, sticky="ew", pady=3)
        tv_copy = self._button(body, "Copy", lambda: None, FIELD_BG)
        tv_copy.configure(
            command=lambda: self.copy_text(self.tv_message.get("1.0", "end-1c"), tv_copy)
        )
        tv_copy.grid(row=row, column=2, sticky="new", padx=(6, 0))
        self._rebuild_tv_message()
        row += 1

        hint = (
            "TradingView can't reach 127.0.0.1 — paste the PROD URL there (⚠ fires REAL trades "
            "on live accounts). Secret can live in the URL (?secret=) or in the message body."
        )
        tk.Label(
            body, text=hint, bg=BG, fg=MUTED, font=("Segoe UI", 9), wraplength=680, justify="left"
        ).grid(row=row, column=0, columnspan=4, sticky="w", pady=(6, 10))
        row += 1

        if not SECRET:
            tk.Label(
                body,
                text="⚠ BINANCE_ABCD_WEBHOOK_SECRET is not set in trading-flask/.env",
                bg=BG,
                fg=DANGER,
                font=("Segoe UI", 10, "bold"),
            ).grid(row=row, column=0, columnspan=4, sticky="w", pady=(0, 8))
            row += 1

        # Engine log ---------------------------------------------------------
        ttk.Label(body, text="Engine log").grid(row=row, column=0, sticky="w", pady=(4, 2))
        row += 1
        self.output = tk.Text(
            body,
            height=16,
            bg=FIELD_BG,
            fg=FG,
            insertbackground=FG,
            relief="flat",
            font=("Consolas", 9),
            state="disabled",
            wrap="word",
        )
        self.output.grid(row=row, column=0, columnspan=4, sticky="nsew")
        body.rowconfigure(row, weight=1)

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.root.after(150, self._drain_log_queue)
        self._poll_health()

    # -- widgets -------------------------------------------------------------

    def _button(self, parent: tk.Misc, text: str, command, bg: str) -> tk.Button:
        return tk.Button(
            parent,
            text=text,
            command=command,
            bg=bg,
            fg="white",
            activebackground=bg,
            activeforeground="white",
            relief="flat",
            font=("Segoe UI", 9, "bold"),
            padx=10,
            pady=4,
        )

    def _copy_button(self, parent: tk.Misc, key: str) -> tk.Button:
        button = self._button(parent, "Copy", lambda: self.copy(key, button), FIELD_BG)
        return button

    def _display_text(self, label: str, value: str) -> str:
        if label == "Secret":
            return "•" * min(len(value), 24) if value else "(not set)"
        return value

    # -- copy / secret -------------------------------------------------------

    def copy(self, key: str, button: tk.Button) -> None:
        self.copy_text(self.copy_values[key], button)

    def copy_text(self, value: str, button: tk.Button) -> None:
        self.root.clipboard_clear()
        self.root.clipboard_append(value)
        button.configure(text="Copied ✓", bg=GREEN)
        self.root.after(1200, lambda: button.configure(text="Copy", bg=FIELD_BG))

    def _rebuild_tv_message(self, *_args) -> None:
        payload = {
            "secret": SECRET,
            "strategy": self.tv_strategy_var.get().strip(),
            "leverage": self.tv_leverage_var.get().strip(),
            "action": self.tv_action_var.get().strip(),
            "symbol": self.tv_symbol_var.get().strip().upper()
            if not self.tv_symbol_var.get().strip().startswith("{{")
            else self.tv_symbol_var.get().strip(),
        }
        self.tv_message.delete("1.0", "end")
        self.tv_message.insert("1.0", json.dumps(payload, indent=2))

    def toggle_secret(self) -> None:
        self.secret_shown = not self.secret_shown
        shown = SECRET if self.secret_shown else self._display_text("Secret", SECRET)
        self.secret_entry.configure(state="normal")
        self.secret_entry.delete(0, "end")
        self.secret_entry.insert(0, shown)
        self.secret_entry.configure(state="readonly")

    # -- engine process ------------------------------------------------------

    def start(self) -> None:
        if self.proc and self.proc.poll() is None:
            return
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        self.proc = subprocess.Popen(
            [sys.executable, "-u", "-m", "binance_abcd.main"],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=flags,
        )
        threading.Thread(target=self._pump_output, args=(self.proc,), daemon=True).start()
        self._log(f"engine starting (pid {self.proc.pid}) on port {PORT}...")
        self.start_button.configure(state="disabled")
        self.stop_button.configure(state="normal")

    def stop(self) -> None:
        if not self.proc or self.proc.poll() is not None:
            return
        self._log("stopping engine...")
        self.proc.terminate()
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self._log("engine stopped.")
        self.start_button.configure(state="normal")
        self.stop_button.configure(state="disabled")

    def open_tester(self) -> None:
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        subprocess.Popen([sys.executable, str(ROOT / "webhook_tester.py")], cwd=ROOT, creationflags=flags)

    def on_close(self) -> None:
        if self.proc and self.proc.poll() is None:
            if not messagebox.askyesno("Engine running", "The engine is running. Stop it and exit?"):
                return
            self.stop()
        self.root.destroy()

    # -- log + health --------------------------------------------------------

    def _pump_output(self, proc: subprocess.Popen[str]) -> None:
        assert proc.stdout is not None
        for line in proc.stdout:
            self.log_queue.put(line.rstrip())
        self.log_queue.put(f"[engine exited with code {proc.wait()}]")

    def _drain_log_queue(self) -> None:
        try:
            while True:
                self._log(self.log_queue.get_nowait())
        except queue.Empty:
            pass
        if self.proc and self.proc.poll() is not None and str(self.stop_button["state"]) == "normal":
            self.start_button.configure(state="normal")
            self.stop_button.configure(state="disabled")
        self.root.after(150, self._drain_log_queue)

    def _log(self, text: str) -> None:
        stamp = datetime.now().strftime("%H:%M:%S")
        self.output.configure(state="normal")
        self.output.insert("end", f"[{stamp}] {text}\n")
        self.output.see("end")
        self.output.configure(state="disabled")

    def _poll_health(self) -> None:
        def worker() -> None:
            alive = False
            if self.proc and self.proc.poll() is None:
                try:
                    alive = requests.get(HEALTH_URL, timeout=2).ok
                except requests.RequestException:
                    alive = False
            text, color = ("● RUNNING", GREEN) if alive else ("● STOPPED", DANGER)
            if self.proc and self.proc.poll() is None and not alive:
                text, color = "● STARTING…", "#d29922"
            self.root.after(0, self.status_label.configure, {"text": text, "fg": color})

        threading.Thread(target=worker, daemon=True).start()
        self.root.after(3000, self._poll_health)

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    LauncherApp().run()
