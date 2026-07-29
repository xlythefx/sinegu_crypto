# Cursor / agent context

## What this repo is

This is a **mother Flask** app: it **accepts webhooks** and **inserts / executes trades** in line with the **Capital.com**-style architecture (same pattern as the integrated strategy stack).

Reference implementation / related codebase:

- **`C:\Users\Xlythe\SineguVariants - Branches\SineguMain - stratIntegrated`**  
  Use this as the conceptual home for the “mother Flask + strategy integration” pattern.

## PHP / API backend (Sinegu)

APIs, migrations, and `conn.php` live under:

- **`C:\wamp64\www\sinegu-api`**

Work there when adding endpoints, migrations, or DB changes that this Flask service calls.

## API path for this repo

- **`C:\wamp64\www\trading-api`**

This is the API backend that serves `trading-flask`. Read `api-docs` there along with the MEXC and Bybit references before making changes.

### Flask API response contract

All endpoints consumed by the Flask bots **must** return:

```json
{ "success": true, "accounts": [ ... ] }
```

- `success` — boolean, always present. Python clients gate on `payload.get("success")`.
- `accounts` — the list key the Python client reads via `payload.get("accounts", [])`.

Do **not** return `{"data": [...]}` — the Python `mexc_accounts_api.py` (and equivalent per-broker files) will silently treat it as no accounts found.

## Per-broker src and launcher

Create **separate src and launcher per broker**. Each broker gets its own trading bot entrypoint:

- `mexc_tradingbot.py` — MEXC launcher
- `bybit_tradingbot.py` — Bybit launcher

Keep broker-specific source trees separate so MEXC and Bybit logic don't bleed into each other.

## CLI: always `cd` out of this repo

These paths are **outside** `trading-flask`. Do **not** assume the workspace root; use explicit `cd` in the terminal.

**PowerShell examples:**

```powershell
cd "C:\Users\Xlythe\SineguVariants - Branches\SineguMain - stratIntegrated"
```

```powershell
cd "C:\wamp64\www\sinegu-api"
```

```powershell
cd "C:\Users\Xlythe\binance-flask"
```

Use whichever folder the task needs; quote paths that contain spaces.
