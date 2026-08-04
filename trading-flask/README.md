# trading-flask — the BINANCE_ABCD engine

The Python trading engine for SineguAlerts. TradingView posts JSON signals to
`POST /binance_abcd_webhook`; the engine fans each signal out to **every
tradeable Binance account** in `sinegu_crypto` and keeps the DB in sync through
`sinegutrade-api`'s machine-to-machine `/api/engine/*` surface. Designed for a
1000-user fan-out: the webhook fast-ACKs in milliseconds and a bounded worker
pool executes the trades in the background.

> **Naming:** the package is `binance_abcd/` — root `src/` in this repo is the
> React app and has nothing to do with this folder. The read-only reference
> projects `C:\Users\Xlythe\trading-flask` and `C:\Users\Xlythe\binance-flask`
> are NOT this code.

## Architecture

```
TradingView ──POST──> /binance_abcd_webhook  (validate + enqueue, 200 in ~2ms)
                            │ dispatch pool (8)
                            ▼
                     _process_trade_job ── one batched positions/check call
                            │ account pool (32 = global in-flight ceiling)
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼            per-(api_key,symbol) locks
             account A  account B  account C   ...  demo=1 → Binance testnet
                 │          │          │
                 └── write-through positions/upsert · open-strategies tags
                     deferred past-position insert · aggregate → trade-logs

pollers (daemon threads, RUN_POLLERS): balances · positions · transfers ·
past-positions (the reconciliation safety net, watermarked)
retry queue: re-runs retryable per-account failures via target_uni_ids
```

**Who may trade is decided by the backend, not here.** `GET
/api/engine/binance/accounts` returns only accounts that are enabled, not
soft-deleted, not sandbox, and whose owner isn't suspended. The billing gate
is `php artisan engine:mark-overdue` (scheduled daily): past-due invoices flip
`binance_accounts.enabled=0`, payment (`InvoiceService::settle`) flips it back.
The engine caches the list for 90s, so a cutoff lands within minutes.

## Setup

```bash
cd trading-flask
pip install -r requirements-dev.txt
cp .env.example .env       # fill BINANCE_ABCD_WEBHOOK_SECRET + BINANCE_ABCD_ENGINE_SECRET
```

`BINANCE_ABCD_ENGINE_SECRET` must equal `ENGINE_SECRET` in
`sinegutrade-api/.env`.

## Telegram notifications

Every signal is announced to a Telegram channel — entries, exits, and the
realized PnL of each close. Live channel: **Voltrax Trades**
(`t.me/voltraxtrades`, id `-1003995568293`). The bot token and chat id live in
the gitignored `.env` only.

| Key | Meaning |
|---|---|
| `BINANCE_ABCD_TELEGRAM_ENABLED` | Master switch (default true) |
| `BINANCE_ABCD_TELEGRAM_BOT_TOKEN` | BotFather token — **secret** |
| `BINANCE_ABCD_TELEGRAM_CHAT_ID` | Public channel: entries, exits, PnL |
| `BINANCE_ABCD_TELEGRAM_ADMIN_CHAT_ID` | Ops alerts; falls back to the main chat |
| `BINANCE_ABCD_TELEGRAM_PNL_WAIT_SECONDS` | Exit-message PnL wait (default 25) |

Everything is off unless **both** a token and a chat id are set, so a fresh
clone (and the test suite — `conftest.py` forces it off) never posts.

What gets sent, one message per signal — never one per account:

- **Entry** (`BUY`/`SELL`) — executed price (mean avgPrice across fills, falling
  back to the signal price) and `filled · skipped · failed`. Suppressed when
  nothing filled. Leverage and strategy are never published.
- **Exit** (`EXIT_LONG`/`EXIT_SHORT`) — quantity-weighted exit price, realized
  PnL **as a percentage only** (no USDT amounts), accounts closed.
- **Admin** — rejected signals (asset not configured, side gate, no accounts),
  consolidated per-account rejections (exits flagged MANUAL ACTION), poller
  crashes, Binance rate limits. Plus a startup ping.
- Retry-queue re-runs stay silent — the live run already posted.

**How exit PnL is collected.** Realized PnL is only known once
`get_order_fill_summary` reads userTrades, which runs deferred per account. So
`_process_trade_job` opens an *exit batch* before the fan-out, each account's
bookkeeping reports into it (in a `finally`, so a bookkeeping failure still
releases the message), and `notify._flush_exit_batch` sends when every closed
account has reported — or after `TELEGRAM_PNL_WAIT_SECONDS`, whichever is
first. Percentages use `balance - pnl` summed across accounts as the
denominator: the capital the trade was actually sized against.

Sends are fire-and-forget on a 2-thread pool over the shared pooled session —
a slow or down Telegram never adds latency to the trade path.

## Run

```bash
# backend first (dev): cd C:\wamp64\www\sinegutrade-api && php artisan serve
python -m binance_abcd.main          # waitress on :5010, pollers per RUN_POLLERS
python engine_launcher.py            # or: Tkinter start/stop GUI with live log +
                                     # copy-paste webhook URLs/secret for TradingView
```

- `GET /health` — cache ages, job/account metrics, retry depth, rate-limit state
- `POST /admin/refresh-accounts|refresh-assets|refresh-balances`, `GET /admin/stats`
  (header `X-Admin-Secret` = the webhook secret; refresh-balances is synchronous
  so a future invoice generator can block on fresh balances)
- Dev tip: `BINANCE_ABCD_RUN_POLLERS=false` runs the webhook alone.

## Test trades

```bash
python -m pytest tests/ -q     # 42 tests, no network
python webhook_tester.py       # Tkinter GUI — local or prod target
```

The GUI builds the exact TradingView payload (`secret, action, symbol, price,
leverage, strategy, target_uni_ids`) and shows the raw response. A red banner
warns when the target isn't localhost — **live accounts mean real trades**.
Safe path: connect an account with `demo=1` (Binance futures *testnet* keys
from https://testnet.binancefuture.com) — the engine routes it to
`demo-fapi.binance.com` automatically.

## Payload contract

```json
{"secret": "...", "action": "BUY|SELL|EXIT_LONG|EXIT_SHORT",
 "symbol": "BTCUSDT", "price": "60000", "leverage": "25",
 "strategy": "VWMA-Reversion", "target_uni_ids": "uuid1,uuid2"}
```

Entries **fail closed**: the ticker must be an enabled `assets` row with a
`base_size`; the asset's `side` column (ALL|LONG|SHORT) gates direction; the
stack cap is `max_increments`. **Exits skip every gate and always close what
exists** — a position must stay closable whatever an account's state.

**Deposit gate.** An account may only OPEN a position once its `total_deposit`
(deposited capital net of withdrawals, from the accounts endpoint) reaches
`MIN_DEPOSIT` (1000). The gate reads **deposit, not balance**: fund $1,500 and
draw down to $300 and you still trade — at one `base_size`. An unknown deposit
fails closed. `MIN_DEPOSIT=0` disables it.

**Sizing.** `REFERENCE_BALANCE` (1000) is the balance that earns one
`base_size`. Below it every account still gets exactly one `base_size`. Above
it, BTCUSDT (`COARSE_STEP_TICKERS`) steps in whole `base_size` multiples per
1000 of balance; every other ticker scales in `base_size/10` steps, floored.

| Balance | BTCUSDT @ base 0.01 | ETHUSDT @ base 0.1 |
|---:|---:|---:|
| $800 | 0.01 | 0.10 |
| $1,000 | 0.01 | 0.10 |
| $2,000 | 0.02 | 0.20 |
| $5,000 | 0.05 | 0.50 |
| $10,000 | 0.10 | 1.00 |

Both decisions are recorded per account in the signal's `trade_logs` row
(`details[].sizing`) and shown at **Admin → Signal Log** (`/admin/trade-logs`).

## Scaling notes (1000 accounts)

- Entry ≈ 1 Binance weight/account (order only): stack check is one batched DB
  call, position mode is verified at startup + 6h cache, leverage only set on
  change. ~1000 weight vs ~2400/min IP budget — fits.
- Exits cost ~6 weight/account; the 32-worker ceiling spreads a mass exit over
  a few minutes and 429/418 trips a process-wide fail-fast backoff; the retry
  queue re-runs what got clipped.
- **Pollers are the real weight consumers** — at hundreds of accounts raise
  `*_FETCH_INTERVAL` (they're all env-tunable) before anything else.
- Reserved for horizontal sharding: `BINANCE_ABCD_SHARD_INDEX/SHARD_COUNT`
  (hash(uni_id) % count per process) — documented, not implemented.

## Deploy (LIVE — 2026-07-30)

`python .claude/deploy_sinegualcrypto.py deploy-engine` (from the repo root; see
`.claude/skills/deploy/SKILL.md`). It gates on this test suite, uploads to
`/var/www/sinegualerts/engine`, builds the venv, generates the server-side `.env`
once (webhook secret shared with the local `.env`, `ENGINE_SECRET` shared with
`api/.env`), installs the `sinegualerts-engine` systemd unit, and rewrites the
nginx vhost: `location = /binance_abcd_webhook` proxied to `127.0.0.1:5010`,
`/api/engine/` restricted to localhost (it serves plaintext account secrets).
TradingView posts to `http://2.24.139.176/binance_abcd_webhook`.
First-boot defaults: pollers ON, startup position-mode sync OFF.
