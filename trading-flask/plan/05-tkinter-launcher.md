# Binance Flask — Tkinter Launcher

## Scripts Managed

| Script | Label | Purpose |
|--------|-------|---------|
| src/main.py | Flask App | Webhook server :5001 |
| src/fetch_balances.py | Fetch Balances | Sync balances (optional) |
| src/fetch_positions.py | Fetch Positions | Sync positions (optional) |

## UI Elements

- **Open all** — Start all scripts headless
- **Close all** — Stop all scripts
- Per script:
  - **Open** — Run headless (no console)
  - **Show Terminal** — Tail log file (enabled when running)
  - **Close** — Stop script
  - Status label: Running / Stopped

## Headless Log Paths

Logs written to `headless/<script>.log`, e.g.:

- `headless/main.log` — Flask app
- `headless/fetch_balances.log`
- `headless/fetch_positions.log`

## Run from Project Root

Subprocess uses `cwd=PROJECT_ROOT` so scripts run correctly regardless of current directory.
