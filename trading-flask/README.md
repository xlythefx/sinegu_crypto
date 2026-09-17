# trading-flask — the BINANCE_ABCD engine

The Python trading engine for Pixel Alpha. TradingView posts JSON signals to
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
TradingView ──POST──> /{venue}_abcd_webhook  (validate + enqueue, 200 in ~2ms)
                       binance_abcd_webhook → Binance accounts, mexc_abcd_webhook → MEXC
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

**A close is re-attempted twice over, at two speeds.** `handle_exit` retries in
the fan-out worker (`EXIT_RETRY_ATTEMPTS`, default 2) while the failure is
*transient*, then the retry queue takes it 60s later. Two invariants make
re-placing a close safe, and any edit to that path has to keep both:

1. **Every attempt re-reads `positionRisk` first.** A 408/`-1007` leaves the
   execution status unknown — the order may be on the book. Re-reading turns
   "unknown" into a fact: a flat side means it landed, and the exit stops.
2. **Only a transient failure is repeated.** A timeout, a 5xx or a rate-limit
   backoff says nothing about the order; a rejection (`-1111` precision,
   `-2019` margin, a position-mode mismatch) is an answer, and asking again
   just delays telling a human. `_request_post` stamps the verdict
   (`transient`) where it is actually known.

Entries are the mirror image: they retry **only** on a rate-limit backoff,
which fails fast before any order exists. An entry whose execution status is
unknown is never replayed — that is how one signal becomes two positions.

**Who may trade is decided by the backend, not here.** `GET
/api/engine/{exchange}/accounts` returns only accounts that are enabled, not
soft-deleted, not sandbox, and whose owner isn't suspended. The billing gate
is `php artisan engine:mark-overdue` (scheduled daily): past-due invoices flip
`binance_accounts.enabled=0`, payment (`InvoiceService::settle`) flips it back.
The engine caches the list for 90s, so a cutoff lands within minutes.

## Exchanges

One process trades every venue listed in `BINANCE_ABCD_EXCHANGES` (CSV;
default `binance`, add `mexc` to switch MEXC on). **One webhook path per
venue** (`hooks.WEBHOOK_PATHS`): `/binance_abcd_webhook` trades Binance
accounts, `/mexc_abcd_webhook` trades MEXC accounts, so each venue has its own
TradingView alert(s) and the path — not the payload — decides where a signal
goes. A payload `exchanges` field is accepted only when it agrees with the
path; a venue not in `EXCHANGES` answers 400 on its path (after the secret
gate). The job resolves that venue's `assets` row (by `assets.broker`:
`Binance` / `MEXC`), its accounts from `/engine/{exchange}/accounts` and its
batched `positions/check`, then fans out. Every bookkeeping write goes back to
the venue the account came from (`/engine/{exchange}/positions/upsert`,
`past-positions/sync`, `fees`, `key-status`, …) and each venue gets its own
`trade_logs` row and its own Telegram header label. nginx proxies exactly the
paths in the deploy script's `ENGINE_WEBHOOK_PATHS`.

The core (`trading_handler`, the webhook fan-out, the pollers) never sees a
venue's field names. It talks to an `ExchangeClient` (`exchange_api.py`) in one
vocabulary — tickers, **coins**, LONG/SHORT, SHORT negative, `None` for a failed
read and `[]` for an empty one — and `exchanges.client_for(account)` hands it
the right adapter: `binance_adapter.BinanceAdapter` over the untouched
`BinanceAPI`, or `mexc_adapter.MexcAdapter` over `mexc_api.MexcFuturesAPI`.
Adding a venue is one adapter plus its tests; nothing in the fan-out changes.

MEXC particulars, all absorbed in the adapter:

- **Contracts, not coins.** `assets.base_size` stays in coins on every venue;
  the adapter divides by the contract's `contractSize` on the way out
  (`coins_to_vol`: floor to `volScale`, refuse under `minVol`) and multiplies
  back on every read, so `position_amt`, the stack cap and the closed-increment
  count mean the same thing on MEXC as on Binance.
- **Leverage travels on the order** (`LEVERAGE_PER_ORDER`): MEXC requires it
  when opening and rejects a value that differs from an existing position's
  (7004), so a stacked entry reuses the position's own leverage / margin mode /
  `positionId`; a fresh one takes the signal's, then the account's own setting
  for the contract, then `MEXC_DEFAULT_LEVERAGE` — or is refused.
- **Business errors arrive as HTTP 200 with `success:false`.** The client
  judges the envelope: 500/501/513/9999 → transient, 510/2037 → rate-limited
  (no process-wide gate — MEXC limits are per key), 604/801 → maintenance (a
  rejection: 604 is also what a key not whitelisted for API trading gets),
  401/402/406/602/701–704 → credential → the same `key_status` flow as Binance
  `-2015`, on `/engine/mexc/key-status`.
- **No testnet.** A MEXC row flagged `demo` is refused for entries **and**
  exits (`no testnet on mexc`) and never polled — nothing was ever opened
  through us on it, and its only host is the real one.
- **Closes and fee receipts** come from `fetch_mexc_history` (own poller,
  `MEXC_HISTORY_FETCH_INTERVAL`, own watermarks
  `out/last_mexc_{closes,fees}_sync.json`): `history_orders` (filled, all
  contracts) → per-contract `order_deals` → `funding_records` (both position
  types). Closing sides 2/4 become past-position rows; every deal, entries
  included, becomes a fill receipt.

Rolling MEXC out: deploy with `EXCHANGES=binance` (the deploy script does not
mirror that key — see `MIRRORED_ENGINE_ENV_KEYS`), run the real-key smoke
checks (`python mexc_smoke.py`, credentials from the environment only), then set `BINANCE_ABCD_EXCHANGES=binance,mexc` on
the box once the first `mexc_accounts` row exists.

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
| `BINANCE_ABCD_FILL_SUMMARY_ATTEMPTS` | userTrades reads per close (default 3) |
| `BINANCE_ABCD_FILL_SUMMARY_RETRY_SECONDS` | Backoff base between them (default 2) |

Everything is off unless **both** a token and a chat id are set, so a fresh
clone (and the test suite — `conftest.py` forces it off) never posts.

What gets sent, one message per signal — never one per account:

- **Entry** (`BUY`/`SELL`) — executed price (mean avgPrice across fills, falling
  back to the signal price) and `filled · skipped · failed`. Suppressed when
  nothing filled. Leverage and strategy are never published.
- **Exit** (`EXIT_LONG`/`EXIT_SHORT`) — quantity-weighted exit price, realized
  PnL **as a percentage only** (no USDT amounts), accounts closed.
- **Admin** — rejected signals (asset not configured, side gate, no accounts),
  consolidated per-account rejections, poller crashes, Binance rate limits.
  Plus a startup ping.
- Retry-queue re-runs stay silent *while they run*; the queue announces the
  ending.

**Red means nobody is coming.** A failed fan-out produces up to two admin
messages, split by whether the engine is going to fix it itself:

- ⏳ **RETRYING** — the failure was transient (a timeout, a 5xx, Binance's
  408/`-1007` "execution status unknown") and the accounts are in the retry
  queue. The enqueue happens *before* the alert precisely so the alert can say
  this.
- 🔴 **MANUAL ACTION REQUIRED** — either the exchange rejected the order
  outright (`-1111`, `-2019`, a position-mode mismatch: asking again in 60s
  gets the same answer), or the queue has run out of attempts and raises it
  from `_requeue`. Until 2026-08-28 the red one fired on the *first* transient
  timeout and the give-up was a log line nobody reads — exactly backwards, and
  an alert that cries wolf on every exchange hiccup is one that gets ignored
  when it matters.

Alert lines quote **Binance's own code and message** (`error_summary`), not
`str(exc)` — "408 Client Error" does not tell you the order may have executed;
`-1007 ... execution status unknown` does.

**A retried exit still reaches the public channel.** The live run only publishes
if something filled, so a signal where every account failed used to close on the
retry and be announced nowhere. `_process_trade_job(..., announce=)` carries the
right to publish: the live run always has it, a retry inherits it only when the
live run filled nothing, and the queue clears the flag the moment any run fills.
One close, one message, never two.

**How exit PnL is collected.** Realized PnL is only known once
`get_order_fill_summary` reads userTrades, which runs deferred per account. So
`_process_trade_job` opens an *exit batch* before the fan-out, each account's
bookkeeping reports into it (in a `finally`, so a bookkeeping failure still
releases the message), and `notify._flush_exit_batch` sends when every closed
account has reported — or after `TELEGRAM_PNL_WAIT_SECONDS`, whichever is
first. Percentages use `balance - pnl` summed across accounts as the
denominator: the capital the trade was actually sized against.

`get_order_fill_summary` **retries** (`FILL_SUMMARY_ATTEMPTS` ×
`FILL_SUMMARY_RETRY_SECONDS`, worst case well under the watchdog). Binance's
userTrades index trails the fill by a second or two, and a single attempt is
why closes used to reach the channel with neither an `Exit Price:` nor a `PnL:`
line — an empty answer is not an error, so both lines were omitted rather than
guessed. The retry runs on its own `BOOKKEEPING_WORKERS` pool: it sleeps, and a
sleeping bookkeeping task must never sit in a fan-out worker that the next
signal's orders are queued behind. When it still comes back empty the row is
written with NULLs and the past-positions poller backfills it — the DB
self-heals, but the Telegram message is sent once and never edited.

Sends are fire-and-forget on a 2-thread pool over the shared pooled session —
a slow or down Telegram never adds latency to the trade path.

## Scheduled performance reports

Everything above is event-driven — a message exists because a signal did.
`binance_abcd/reports.py` is the one thing that posts because a **clock ticked**:
a daily, weekly and monthly recap to the **public** channel.

| Report | Default | Covers |
|---|---|---|
| Daily | `23:55` Asia/Manila | today (the local day it fires in) |
| Weekly | `fri 23:55` | the 7 days ending today |
| Monthly | `last 23:55` | the 1st of the month through today — the whole month |

**One message per exchange.** Each firing fetches `track-record/{exchange}` for
every exchange in `BINANCE_ABCD_EXCHANGES` and posts a recap headed
`Daily Report — 16 Sep 2026 · Binance` / `· MEXC`, the same venue label every
entry and exit carries. An exchange the master has no real account on answers
`available: false` and posts nothing. State (`out/report_state.json`) is per
(kind, exchange), so one venue's failed fetch retries alone; a pre-per-exchange
state file is read as covering every venue.

"Day" means a calendar day in the timezone the API buckets the track record in
(`TRACK_RECORD_TIMEZONE`, Asia/Manila on prod), which the payload publishes as
`timezone`; the window is cut in that same calendar. Before 2026-09-16 the
series was UTC days and each recap covered the *previous* one, so the "daily"
posted at 23:30 Manila described a day that had ended at 08:00 that morning.

Config is `BINANCE_ABCD_REPORT_*` (see `.env.example`); an empty `*_AT` disables
that one report, and a malformed one is logged + alerted to the admin chat and
skipped — a typo in a recap time must never stop the engine trading.

**The numbers come from `GET /api/public/track-record`, not from a fresh query,**
and that is the whole design:

- **It cannot leak.** The channel is world-readable, so a recap may carry
  percentages, counts of *trades* and tickers only (a ticker is already public
  on every entry the channel announces). Building it from an endpoint that is
  already public makes that structural instead of something a future edit has to
  remember — there is no balance or account count in the payload to print by
  mistake. A test asserts none of those words appears in any rendered report.
- **It cannot disagree with the website.** The landing page renders the same
  series. A second P&L walk would drift, and then the channel and the site would
  publish two different track records for the same month.

Consequently `reports.py` never calls Binance and never reads the DB. It slices
the daily series to a window and chains it; `notify.notify_report` owns every
decision about what the channel is allowed to say.

Rules worth keeping:

- **Windows end on the day they fire in, and the fire time decides how much of
  it is in.** A close after the firing time reaches the site and the
  weekly/monthly, but no daily ever names it — so fire as late as the
  past-positions backfill (~3 min) and the endpoint's 5-minute cache allow;
  `23:55` is about the latest that is still honest. A published percentage is
  never reposted or revised.
- **The period return is chained, not summed**, identical to how the endpoint
  computes its own total — so it is time-weighted and a mid-week deposit cannot
  inflate it.
- **The daily recap ranks every asset traded**, from the `assets` list each
  series point carries (per symbol: its share of the day's return, measured on
  the same capital as the day's `pct`, so the shares add up to it). 🥇🥈🥉 for
  the top three *by rank, profit or not* — the signed percent beside the medal
  says how it went — and everything below the podium numbered. Daily only: across several days the
  shares are summed while the return is chained, and a leaderboard that does
  not add up to the line above it is a question in the channel. There is no
  all-time line; a recap is the period it names and nothing else.
- **A failed fetch is not "no trades".** `fetch_track_record()` returns `None`
  on failure and the period stays unmarked, so the next tick retries it — the
  same empty-vs-unavailable rule the pollers follow. `available: false` (nothing
  published yet) *is* an answer and is marked done.
- **First run seeds silently.** A missing `out/report_state.json` marks every
  past period as sent without posting, so a deploy doesn't fire all three recaps
  at once. That file is server-owned; don't ship it.
- **A missed recap catches up, but only for `REPORT_CATCHUP_HOURS` (12).** Past
  that it is dropped and marked done — a Tuesday recap arriving Thursday is
  worse than none.
- **`monthly last` is the whole calendar month** (`1 - 30 Sep 2026`); a
  `monthly <1-28>` schedule is month-to-date on that day, not the previous month.
- `zoneinfo` has no tz database on Windows, hence `tzdata` in `requirements.txt`.
  An unusable timezone disables reports and alerts the admin chat; it never
  stops the engine.

`/health` reports the schedule and each report's next firing under `reports`.
The `REPORT_*` keys are mirrored to prod by `sync-engine-env` — they describe the
product, not the box. (Mirroring skips a key that is *empty* locally, so disable
a report on prod by editing prod's `.env`, not by blanking it here.)

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
python -m pytest tests/ -q     # 305 tests, no network
python webhook_tester.py       # Tkinter GUI — local or prod target
```

The GUI builds the exact TradingView payload (`secret, action, symbol, price,
leverage, strategy, target_uni_ids, exchanges`) and shows the raw response. A red banner
warns when the target isn't localhost — **live accounts mean real trades**.
Safe path: connect an account with `demo=1` (Binance futures *testnet* keys
from https://testnet.binancefuture.com) — the engine routes it to
`demo-fapi.binance.com` automatically.

## Payload contract

```json
{"secret": "...", "action": "BUY|SELL|EXIT_LONG|EXIT_SHORT",
 "symbol": "BTCUSDT", "price": "60000", "leverage": "25",
 "strategy": "VWMA-Reversion", "target_uni_ids": "uuid1,uuid2",
 "exchanges": "mexc"}
```

`symbol` may carry a `BINANCE:` or `MEXC:` chart prefix (stripped).
The URL path decides the venue (`/binance_abcd_webhook`, `/mexc_abcd_webhook`).
`exchanges` (CSV or list) is optional and must agree with the path — the admin
manual-trade console sends it as a guard; a mismatch, an unknown venue or one
not enabled on the box is a 400, not a silent no-op. The ACK echoes the venue.

Entries **fail closed**: the ticker must be an enabled `assets` row (for that
venue's `broker`) with a `base_size`; the asset's `side` column
(ALL|LONG|SHORT) gates direction; the stack cap is `max_increments`. **Exits
skip every gate and always close what exists** — a position must stay closable
whatever an account's state.

**A failed read is never "nothing there."** `get_positions_v3` and
`get_user_trades` return `None` when the request fails and `[]` only when the
account is genuinely flat / the order genuinely has no fills yet. Collapsing
the two is the single root cause behind three prod symptoms on 2026-08-18:
`positions/sync` is a **full replace per api_key**, so a failed read reported as
"flat" deleted live positions from the DB, and the stack cap — which counts open
size from exactly those rows — then read 0 open and stopped firing (LTCUSDT took
three entries with the engine believing each was the first, and the channel said
`Increment (1/3)` every time). The poller now **skips** an account it could not
read, leaving its rows merely stale for one cycle; a real close still syncs `[]`
and clears them. Where the depth cannot be read from either source and the asset
*has* a cap, the entry is skipped (`stack depth unknown`) rather than placed
blind — entry-only, so an unreadable account can still close what it holds.

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
- **Pollers are the real weight consumers**, and they are not equal. Per account
  per tick: balances/positions/transfers cost **weight 5**, past-positions
  (`/fapi/v1/income`) costs **weight 30**. At the shipped intervals that one
  loop is ~95% of the engine's whole budget and is what caps how many accounts
  fit — it is the interval to raise first, and the reason its default is 180s
  rather than 60s. Balances at 300s are ~3% and not worth touching.
  Per-account balances cannot be cached or shared: each call is signed with
  that account's own key. What accounts share is the IP's weight budget, so the
  levers are interval and spread (`POLLER_START_STAGGER_SECONDS`), not caching.
- Reserved for horizontal sharding: `BINANCE_ABCD_SHARD_INDEX/SHARD_COUNT`
  (hash(uni_id) % count per process) — documented, not implemented.

## Deploy (LIVE — 2026-07-30)

`python .claude/deploy_sinegualcrypto.py deploy-engine` (from the repo root; see
`.claude/skills/deploy/SKILL.md`). It gates on this test suite, uploads to
`/var/www/sinegualerts/engine`, builds the venv, generates the server-side `.env`
once (webhook secret shared with the local `.env`, `ENGINE_SECRET` shared with
`api/.env`), installs the `sinegualerts-engine` systemd unit, and rewrites the
nginx vhost: `location = /binance_abcd_webhook` and `location = /mexc_abcd_webhook` proxied to `127.0.0.1:5010`,
`/api/engine/` restricted to localhost (it serves plaintext account secrets).
TradingView posts to `https://pixel-alpha.com/binance_abcd_webhook` (the old
`http://2.24.139.176/...` still answers — the bare IP is not redirected, and the
domain's :80 block exempts this path rather than 301-ing a POST body away).
First-boot defaults: pollers ON, startup position-mode sync OFF.
