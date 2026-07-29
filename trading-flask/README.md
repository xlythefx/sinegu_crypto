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

## Run

```bash
# backend first (dev): cd C:\wamp64\www\sinegutrade-api && php artisan serve
python -m binance_abcd.main          # waitress on :5010, pollers per RUN_POLLERS
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
stack cap is `max_increments`. Sizing: balance < 500 → `base_size`; BTCUSDT
steps in whole `base_size` per 500 of balance; others scale in `base_size/10`
steps. Exits skip every gate and always close what exists.

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

## Deploy (TODO — deferred)

Prod (2.24.139.176) needs: nginx `location = /binance_abcd_webhook
{ proxy_pass http://127.0.0.1:5010; }`, a systemd unit running
`python -m binance_abcd.main`, and — because `/api/engine/*` serves plaintext
account secrets guarded only by ENGINE_SECRET — an nginx rule restricting
`/api/engine/` to localhost. Rotate both secrets at go-live.
