#!/usr/bin/env python3
"""
Binance Trading Bot — Tkinter launcher for:
  - Flask App (webhook server :5000)
  - Fetch Balances
  - Fetch Positions
  - Fetch Transfers

Strict rules:
  - Only one launcher instance (lock file). Second launch exits.
  - Closing the launcher terminates ALL services started by it (no orphans).
  - One process per service; Open disabled while running.
  - Status shows "Running (PID x)" or "Stopped" so you see real state.

Run from project root: python binance_tradingbot.py. Open = headless. Show Terminal = tail log.
"""

import atexit
import os
import subprocess
import sys
from pathlib import Path

# Hide console on Windows so only the tkinter window is visible
if sys.platform == "win32":
    try:
        import ctypes
        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 0)
    except Exception:
        pass

import tkinter as tk
from tkinter import ttk, messagebox

PROJECT_ROOT = Path(__file__).resolve().parent
HEADLESS_DIR = PROJECT_ROOT / "headless"
LOCK_FILE = HEADLESS_DIR / "launcher.lock"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
from src.hooks import API_BASE_URL

# (label, module to run with python -m, headless_log)
SCRIPTS = [
    ("Flask App", "src.main", "main"),
    ("Flask Lite App", "binance_lite_src.main", "main_lite"),
    ("Fetch Balances", "src.fetch_balances", "fetch_balances"),
    ("Fetch Positions", "src.fetch_positions", "fetch_positions"),
    ("Fetch Transfers", "src.fetch_transfers", "fetch_transfers"),
    ("Fetch Past Positions", "src.fetch_past_positions", "fetch_past_positions"),
]

TERMINATE_TIMEOUT = 3
KILL_AFTER = 2
LOG_MAX_BYTES = 20 * 1024 * 1024  # roll a headless log once it grows past ~20 MB


def _rotate_if_large(logpath: Path) -> None:
    """Roll <name>.log to <name>.log.1 when it exceeds LOG_MAX_BYTES so long-running
    services don't fill the disk. Best-effort; errors are ignored."""
    try:
        if logpath.exists() and logpath.stat().st_size > LOG_MAX_BYTES:
            backup = logpath.with_suffix(logpath.suffix + ".1")
            try:
                if backup.exists():
                    backup.unlink()
            except OSError:
                pass
            logpath.replace(backup)
    except OSError:
        pass


def _kill_process(proc: subprocess.Popen) -> None:
    """Terminate then kill; ensure process and tree die (this repo's services only)."""
    if proc is None:
        return
    try:
        proc.terminate()
        proc.wait(timeout=TERMINATE_TIMEOUT)
    except (subprocess.TimeoutExpired, ProcessLookupError):
        try:
            proc.kill()
            proc.wait(timeout=KILL_AFTER)
        except Exception:
            pass
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def _is_pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False
    except Exception:
        return False


def _take_launcher_lock() -> bool:
    """Return True if we took the lock; False if another launcher is running."""
    HEADLESS_DIR.mkdir(parents=True, exist_ok=True)
    if LOCK_FILE.exists():
        try:
            pid = int(LOCK_FILE.read_text().strip())
            if _is_pid_alive(pid):
                return False
        except (ValueError, OSError):
            pass
        try:
            LOCK_FILE.unlink()
        except OSError:
            pass
    try:
        LOCK_FILE.write_text(str(os.getpid()))
        return True
    except OSError:
        return False


def _release_launcher_lock() -> None:
    try:
        if LOCK_FILE.exists():
            LOCK_FILE.unlink()
    except OSError:
        pass


class BinanceLauncherApp:
    def __init__(self):
        if not _take_launcher_lock():
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror(
                "Binance Trading Bot",
                "Another launcher is already running.\nClose it first to avoid duplicate services.",
            )
            root.destroy()
            sys.exit(1)

        self.root = tk.Tk()
        self.root.title("Binance Trading Bot")
        self.root.minsize(420, 380)
        self.root.resizable(True, True)

        self.processes = {}
        self.status_labels = {}
        self.open_btns = {}
        self.log_handles = {}
        self.headless_log_names = {}
        self.show_terminal_btns = {}
        self._poll_id = None
        self._quitting = False

        atexit.register(self._cleanup)
        self._build_ui()

    def _cleanup(self) -> None:
        """Ensure all child processes and lock are released (atexit or crash)."""
        for key in list(self.processes.keys()):
            proc = self.processes.get(key)
            if proc is not None:
                _kill_process(proc)
                self.processes[key] = None
            if key in self.log_handles:
                try:
                    self.log_handles[key].close()
                except Exception:
                    pass
                try:
                    del self.log_handles[key]
                except KeyError:
                    pass
        _release_launcher_lock()

    def _build_ui(self):
        main = ttk.Frame(self.root, padding=12)
        main.pack(fill=tk.BOTH, expand=True)

        ttk.Label(main, text="Binance Flask services", font=("", 11, "bold")).pack(anchor=tk.W)
        ttk.Label(main, text=f"API base: {API_BASE_URL}", font=("", 9), foreground="gray").pack(anchor=tk.W)
        ttk.Label(
            main,
            text="One launcher only. Close launcher = all services stop. Open = headless; Show Terminal = tail log.",
            font=("", 9),
            foreground="gray",
        ).pack(anchor=tk.W)

        ttk.Separator(main, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=(8, 12))

        row_all = ttk.Frame(main)
        row_all.pack(fill=tk.X, pady=(0, 12))
        ttk.Button(row_all, text="Open all", command=self._open_all).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(row_all, text="Close all", command=self._close_all).pack(side=tk.LEFT)

        ttk.Separator(main, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=(0, 12))

        for item in SCRIPTS:
            label, module, headless_log = item
            key = module
            self.processes[key] = None
            self.headless_log_names[key] = headless_log
            row = ttk.Frame(main)
            row.pack(fill=tk.X, pady=4)
            ttk.Label(row, text=label, width=18, anchor=tk.W).pack(side=tk.LEFT, padx=(0, 8))
            open_btn = ttk.Button(row, text="Open", command=lambda k=key: self._run_headless(k))
            open_btn.pack(side=tk.LEFT, padx=(0, 4))
            self.open_btns[key] = open_btn
            show_btn = ttk.Button(
                row, text="Show Terminal", command=lambda k=key: self._show_terminal(k), state=tk.DISABLED
            )
            show_btn.pack(side=tk.LEFT, padx=(0, 4))
            self.show_terminal_btns[key] = show_btn
            ttk.Button(row, text="Close", command=lambda k=key: self._close(k)).pack(side=tk.LEFT, padx=(0, 8))
            status = ttk.Label(row, text="Stopped", foreground="gray")
            status.pack(side=tk.LEFT)
            self.status_labels[key] = status

        ttk.Separator(main, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=12)
        ttk.Button(main, text="Quit (stops all services)", command=self._on_quit).pack(anchor=tk.W, pady=(8, 0))

        self.root.protocol("WM_DELETE_WINDOW", self._on_quit)

    def _run_headless(self, key: str) -> None:
        proc = self.processes.get(key)
        if proc is not None and proc.poll() is None:
            return
        if proc is not None:
            self.processes[key] = None
            if key in self.log_handles:
                try:
                    self.log_handles[key].close()
                except Exception:
                    pass
                del self.log_handles[key]
        module = key
        headless_log = self.headless_log_names.get(key)
        if not headless_log:
            return
        logpath = HEADLESS_DIR / (headless_log + ".log")
        logpath.parent.mkdir(parents=True, exist_ok=True)
        _rotate_if_large(logpath)
        try:
            logfile = open(logpath, "a", encoding="utf-8", errors="replace")
            self.log_handles[key] = logfile
            cmd = [sys.executable, "-m", module]
            kwargs = {
                "stdout": logfile,
                "stderr": subprocess.STDOUT,
                "cwd": str(PROJECT_ROOT),
                "bufsize": 1,
            }
            if sys.platform == "win32":
                kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
            proc = subprocess.Popen(cmd, **kwargs)
            self.processes[key] = proc
            pid = proc.pid
            self.status_labels[key].config(text=f"Running (PID {pid})", foreground="green")
            self.open_btns[key].config(state=tk.DISABLED)
            self.show_terminal_btns[key].config(state=tk.NORMAL)
        except Exception as e:
            if key in self.log_handles:
                try:
                    self.log_handles[key].close()
                except Exception:
                    pass
                del self.log_handles[key]
            messagebox.showerror("Error", str(e))
            self.status_labels[key].config(text="Error", foreground="red")

    def _show_terminal(self, key: str) -> None:
        headless_log = self.headless_log_names.get(key)
        if not headless_log:
            return
        logpath = (HEADLESS_DIR / (headless_log + ".log")).resolve()
        label = next(s[0] for s in SCRIPTS if s[1] == key)
        show_log_py = PROJECT_ROOT / "headless" / "show_log.py"
        if not show_log_py.is_file():
            messagebox.showerror("Error", f"Not found: {show_log_py}")
            return
        try:
            if sys.platform == "win32":
                subprocess.Popen(
                    ["cmd", "/k", sys.executable, str(show_log_py), str(logpath), label],
                    cwd=str(PROJECT_ROOT),
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                )
            else:
                cmd = [sys.executable, str(show_log_py), str(logpath), label]
                if sys.platform == "darwin":
                    subprocess.Popen(["open", "-a", "Terminal", "--args"] + cmd, cwd=str(PROJECT_ROOT))
                else:
                    subprocess.Popen(["xterm", "-e", " ".join(cmd)], cwd=str(PROJECT_ROOT))
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _close(self, key: str) -> None:
        proc = self.processes.get(key)
        if proc is None:
            return
        _kill_process(proc)
        self.processes[key] = None
        if key in self.log_handles:
            try:
                self.log_handles[key].close()
            except Exception:
                pass
            del self.log_handles[key]
        self.status_labels[key].config(text="Stopped", foreground="gray")
        self.open_btns[key].config(state=tk.NORMAL)
        self.show_terminal_btns[key].config(state=tk.DISABLED)

    def _open_all(self) -> None:
        for key in self.processes:
            self._run_headless(key)

    def _close_all(self) -> None:
        for key in list(self.processes.keys()):
            self._close(key)

    def _poll_processes(self) -> None:
        if self._quitting:
            return
        for key, proc in list(self.processes.items()):
            if proc is not None and proc.poll() is not None:
                self.processes[key] = None
                if key in self.log_handles:
                    try:
                        self.log_handles[key].close()
                    except Exception:
                        pass
                    del self.log_handles[key]
                self.status_labels[key].config(text="Stopped", foreground="gray")
                self.open_btns[key].config(state=tk.NORMAL)
                self.show_terminal_btns[key].config(state=tk.DISABLED)
        if not self._quitting:
            self._poll_id = self.root.after(1000, self._poll_processes)

    def _on_quit(self) -> None:
        self._quitting = True
        if self._poll_id is not None:
            try:
                self.root.after_cancel(self._poll_id)
            except Exception:
                pass
            self._poll_id = None
        self._close_all()
        _release_launcher_lock()
        try:
            self.root.destroy()
        except Exception:
            pass
        sys.exit(0)

    def run(self) -> None:
        self._poll_id = self.root.after(1000, self._poll_processes)
        self.root.mainloop()


if __name__ == "__main__":
    app = BinanceLauncherApp()
    app.run()
