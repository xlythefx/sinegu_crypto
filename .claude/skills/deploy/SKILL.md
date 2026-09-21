---
name: deploy
description: Deploy sinegual-crypto (React frontend) and sinegutrade-api (Laravel backend) to the project's Ubuntu VPS over SSH. Use when the user says "deploy", "push to prod", "deploy frontend/backend", or similar.
---

# Deploy — Pixel Alpha crypto (sinegual-crypto + sinegutrade-api)

## Target

| Env | Host | OS | Remote parent |
|-----|------|----|---------------|
| **prod** | **https://pixel-alpha.com** — origin `2.24.139.176` (Contabo KVM 2, `srv1860230`) | Ubuntu 24.04 LTS | `/var/www/sinegualerts` |

Aliases for the target arg: `sinegualerts`, `2.24`. SSH user is `root`.

**Do NOT use the mother project's servers or credentials** — `sinequal-dash-fusion-main`
deploys to its own Windows VPS fleet (`167.86.109.159` / `156.67.30.81`). That
infrastructure belongs to the mother project and must never be targeted from this repo.

## Server state — provisioned 2026-07-28

The box arrived bare (only sshd + Contabo's `monarx-agent`). `provision` has since been
run and the stack is live:

| Component | Version | Status |
|---|---|---|
| Ubuntu | 24.04.4 LTS | — |
| nginx | 1.24.0 | active, serving `:80`, public HTTP 200 |
| php-fpm | 8.3.6 | active, socket `/run/php/php8.3-fpm.sock` |
| MySQL | 8.0.46 | active, db `sinegu_crypto` + user `sinegu` created and login-verified |
| composer | 2.10.2 | — |
| node | 22.23.1 | — |
| ufw | active | OpenSSH + Nginx Full only |

`dashboard/` currently holds the provisioning placeholder page. `api/` is empty and has
**no `.env`** — the first `deploy-api` will stop before `migrate` until that exists.

Run `inspect` any time to re-check; if the stack ever shows MISSING, the box was rebuilt
and needs `provision` again.

## Credentials policy

- Credentials are **never** written in this file, the deploy script, `settings.json`, or
  any other committed file.
- They live in `.claude/deploy.creds.json` (gitignored — verified by `git check-ignore`):

```json
{
  "prod": {
    "host": "2.24.139.176", "port": 22, "user": "root", "password": "<password>",
    "db": { "database": "sinegu_crypto", "user": "sinegu", "password": "<pick-one>" }
  }
}
```

The `db` block is only read by `provision-db`. `key_file` may replace `password` once
key auth is set up (recommended — then disable password auth in sshd).

## Remote layout

```
/var/www/sinegualerts/
├── dashboard/            React dist — nginx root, SPA fallback
├── api/                  Laravel sinegutrade-api — nginx /api -> api/public via php8.3-fpm
├── engine/               trading-flask binance_abcd — systemd `sinegualerts-engine`,
│                         waitress on 127.0.0.1:5010; nginx proxies ONLY
│                         /binance_abcd_webhook + /mexc_abcd_webhook — one path per
│                         venue (health/admin stay local-only)
└── _backups/<ts>/        dashboard/api/engine tar.gz + api.env + engine.env (newest 10 kept)
```

nginx vhost: `/etc/nginx/sites-available/sinegualerts` (written by `deploy-nginx`,
`default` removed). Serves the SPA at `/`, Laravel at `/api`, immutable caching on
`/assets/`, gzip on. Two generated files back it:
`/etc/nginx/snippets/sinegualerts-app.conf` (the app's locations, included by every
server block that serves it) and `/etc/nginx/conf.d/cloudflare-realip.conf`
(refreshed from Cloudflare's published ranges on every `deploy-nginx`).

## Domain & TLS — pixel-alpha.com (live 2026-08-11)

DNS is Cloudflare's, **proxied** (public A records are Cloudflare's, not ours).
`setup-tls` issued a Let's Encrypt cert (ECDSA, auto-renewing via `certbot.timer`).

Four things about this setup are load-bearing:

- **`:80 default_server` must NOT redirect to https.** It answers the bare IP and,
  critically, it is what the trading engine talks to — `BINANCE_ABCD_ENGINE_API_BASE`
  is `http://127.0.0.1/api`. A blanket http→https redirect would 301 every engine
  call and cut the loop. Only the **domain's** `:80` block redirects, and even it
  exempts the engine webhook paths (a 301 on a POST may drop the body) and
  `/.well-known/acme-challenge/` (renewals arrive over :80).
- **`certonly --webroot`, never `--nginx`.** The nginx plugin rewrites the vhost to
  insert its own `:443` block, and `deploy-nginx` rewrites that file from a template
  every run. Whichever ran last would win and the loser would be TLS. Certbot only
  ever touches `/etc/letsencrypt`.
- **`deploy-nginx` emits the `:443` blocks only when a cert is on disk** — an
  `ssl_certificate` pointing at a missing file is a hard `nginx -t` failure, which
  would make the command unrunnable on a rebuilt box.
- **Real visitor IPs** come from `CF-Connecting-IP`, trusted **only** from
  Cloudflare's ranges. That is not just for logs: `/api/engine/*` is gated on
  `allow 127.0.0.1`, so a spoofable real-IP would hand the internet the endpoint
  that hands out account API keys. `verify-tls` asserts a forged header from
  outside still gets 403.

**Cloudflare dashboard settings that must match:** SSL/TLS mode **Full (strict)**
(the origin now has a real cert, so nothing weaker is warranted). If issuance ever
fails, the usual cause is *Always Use HTTPS* answering the HTTP-01 challenge at the
edge — turn it off, re-run `setup-tls`, turn it back on.

**Not done deliberately:** HSTS (easy to enable at the Cloudflare edge, hard to
undo), and restricting ufw 80/443 to Cloudflare ranges — the origin IP still serves
the app directly.

## Commands

```bash
python .claude/deploy_sinegualcrypto.py inspect          # read-only: stack + layout + .env
python .claude/deploy_sinegualcrypto.py provision        # ONE-TIME server setup (changes the box)
python .claude/deploy_sinegualcrypto.py provision-db     # create MySQL db + user from creds
python .claude/deploy_sinegualcrypto.py setup-env        # write api/.env + php artisan key:generate
python .claude/deploy_sinegualcrypto.py deploy-nginx     # rewrite + test + reload the vhost
python .claude/deploy_sinegualcrypto.py setup-tls        # issue/renew the LE cert, enable :443
python .claude/deploy_sinegualcrypto.py verify-tls        # listeners, origin probes, www 301,
                                                         #   engine loop, real-IP spoof check
npm run build                                            # ALWAYS before deploying frontend
python .claude/deploy_sinegualcrypto.py deploy-dash      # frontend only
python .claude/deploy_sinegualcrypto.py deploy-api       # backend only
python .claude/deploy_sinegualcrypto.py deploy-engine    # bot engine (tests-gated; venv +
                                                         #   .env + systemd + nginx route)
python .claude/deploy_sinegualcrypto.py sync-engine-env  # config only: re-mirror engine/.env
                                                         #   from local + restart (no code)
python .claude/deploy_sinegualcrypto.py sync-api-env     # config only: Coinsbuy / TRON / Discord
                                                         #   keys from local sinegutrade-api/.env
                                                         #   + PAYMENTS_* URLs + config:cache (no code)
python .claude/deploy_sinegualcrypto.py deploy-telegram  # pixel-telegram ops alerts (tests-gated;
                                                         #   venv + .env + 2 systemd timers)
python .claude/deploy_sinegualcrypto.py sync-telegram-env # config only: bot token / group chat id
python .claude/deploy_sinegualcrypto.py full             # backup -> dash -> api -> verify
python .claude/deploy_sinegualcrypto.py verify           # asset refs + .env + services + HTTP probe
python .claude/deploy_sinegualcrypto.py verify-engine    # systemd + /health + webhook gate + engine auth
python .claude/deploy_sinegualcrypto.py verify-telegram  # timers armed + credentials present + log tail
python .claude/deploy_sinegualcrypto.py backup           # timestamped backup only
```

**pixel-telegram specifics** (`/var/www/sinegualerts/telegram`, first deployed 2026-09-04):
its own venv and `.env`, no nginx route (it only makes outbound calls), and **two oneshot
timers** — `pixel-telegram.timer` (4-hourly resource report, `Persistent=true` so a tick
missed while the box was down fires on boot) and `pixel-telegram-watch.timer` (every 2 min,
silent unless a service restarted or a resource crossed a threshold). `deploy-telegram`
gates on the local `pixel-telegram` pytest suite, then starts one watch run so the state
file is SEEDED before anything can alert — without that the deploy itself announces every
service on the box as freshly restarted. `state/` is server-owned and never synced.

**Bot Engine admin page** (`/admin/engine`) drives `GET /api/admin/engine/status|logs` and
`POST /api/admin/engine/restart` (`AdminEngineController`). Those run `systemctl`/`journalctl`
locally as `www-data`, which `deploy-engine` enables idempotently: a sudoers rule limited to
`systemctl restart sinegualerts-engine` (`/etc/sudoers.d/`, validated with `visudo -c`) plus
`www-data` in the `systemd-journal` group. Off Linux the endpoints report
`available: false` and the page degrades to a read-only "LOCAL DEV" state.

**Engine specifics** (first deployed 2026-07-30): `deploy-engine` refuses to ship if the
local `trading-flask` pytest suite fails. The server-side `engine/.env` is generated once
and never overwritten wholesale, but `MIRRORED_ENGINE_ENV_KEYS` are **upserted from the
local `trading-flask/.env` on every engine deploy** — the webhook secret (so TradingView
URLs keep working) and the whole `BINANCE_ABCD_TELEGRAM_*` block. Those keys describe the
product, so prod drifting from local is always a bug: prod posted nothing to Telegram
until 2026-08-10 purely because the generated file had no token or chat id.
Host-specific keys (`ENGINE_API_BASE`, `ENGINE_SECRET`, `FLASK_PORT`, `RUN_POLLERS`,
`SYNC_POSITION_MODE_ON_STARTUP`) are never mirrored — a dev value there breaks prod.
Only key NAMES are logged, never values. `ENGINE_SECRET` is shared with `api/.env`
(appended + `config:cache` if missing). First-boot defaults: `RUN_POLLERS=true`,
`SYNC_POSITION_MODE_ON_STARTUP=false` — flip the latter on the server when you want
per-account position-mode sync at startup. Prod TradingView webhook URL:
`https://pixel-alpha.com/binance_abcd_webhook` (secret in JSON body or `?secret=`).
The old `http://2.24.139.176/binance_abcd_webhook` still works — the bare IP is not
redirected, and the domain's :80 block exempts this path rather than 301-ing a POST.

**First-deploy order** (already done once — needed again only on a rebuilt box):
`provision` → `provision-db` → `deploy-api` (stops, no .env) → `setup-env` → `deploy-api`.
The two-pass API deploy is unavoidable: `composer`'s post-install hook boots Laravel and
needs `.env`, but `key:generate` needs `vendor/`. The deployer breaks the cycle by
installing with `--no-scripts` on the first pass.

## Frontend API URL — no manual switching

`src/services/api.ts` resolves the API base **at runtime from the host**, so one build
works everywhere and nothing needs changing per deployment:

| Host | API base |
|---|---|
| `localhost` / `127.0.0.1` / `*.local` | `VITE_API_URL` or `http://127.0.0.1:8000/api` |
| any deployed host (IP or domain, http or https) | `<same origin>/api` |

Same-origin works because the vhost serves the SPA and Laravel from one host, so TLS is
free once certbot runs. `VITE_API_URL` is **dev-only** and deliberately ignored on
deployed hosts — a stale `.env` at build time must never repoint production. (The mother
project learned this the hard way: a baked-in override made staging authenticate against
the prod API.)

Target is the 2nd positional arg (`... full prod`), or `--target prod`, or `DEPLOY_TARGET`.
Default is `prod` — there is only one target today.

## What each step does

- **`provision`** (one-time) — apt install nginx, php8.3-fpm + Laravel extensions
  (mysql, mbstring, xml, curl, zip, bcmath, gd, intl), mysql-server, composer, node 22,
  rsync/git/unzip/ufw. Creates the layout, writes + tests the nginx vhost, enables
  nginx/php-fpm/mysql, opens ufw for OpenSSH + Nginx Full, drops a placeholder index.
- **`backup`** — tars live `dashboard/` and `api/` into `_backups/<timestamp>/`
  (excluding `vendor`, `node_modules`, `storage/logs`), copies `api/.env` alongside as
  `api.env`, prunes to the newest 10.
- **`deploy-dash`** — packs local `dist/` → gzip tar → SFTP upload with size verification
  → extract to a clean staging dir → `rm -rf dashboard/assets` (so stale hashed chunks
  don't linger) → rsync staging into `dashboard/` → chown www-data → verify.
- **`deploy-api`** — packs `C:\wamp64\www\sinegutrade-api` excluding `.git`, `vendor`,
  `node_modules`, `storage`, `bootstrap/cache`, `tests`, `.env`, logs/archives → upload →
  staging → rsync into `api/` **with `.env`/`storage`/`vendor`/`bootstrap/cache` excluded
  again at the rsync layer** (belt and braces) → `composer install --no-dev
  --optimize-autoloader` → fix storage perms → `migrate --force` → `config:cache`,
  `route:cache`, `storage:link` → reload php-fpm + nginx.
  If the server has no `.env` it stops before migrate and says so rather than guessing.
- **`verify`** — regexes the live `index.html` for `/assets/*.js`, confirms each exists on
  disk and that the set matches local `dist/index.html`; checks `.env` present, services
  active, and curls `/` and `/api/` for status codes.

## Rules

- Always `backup` before a deploy (or use `full`, which does it).
- Always `npm run build` locally before `deploy-dash`; abort if the build fails.
- Verify after deploying — never report success without the verify step passing.
- **Never overwrite** the server's `.env`, `storage/`, `vendor/`, or `bootstrap/cache`.
- Gentle SSH: 3 connect attempts with 60s waits (hammering trips fail2ban). Every remote
  command reconnects and retries up to 3× on transport errors.
- If a deploy goes bad, restore from the newest `_backups/<timestamp>/`.

## Still to do on the server

1. ~~Run `provision`~~ — done 2026-07-28.
2. ~~Create the MySQL db + user~~ — done (`provision-db`); credentials in the gitignored
   creds file under `prod.db`.
3. ~~Create `api/.env` + `APP_KEY`~~ — done via `setup-env`. The file lives **only** on the
   server and is excluded at both the pack and rsync layers, so no deploy can overwrite it.
4. ~~Repoint the frontend API URL~~ — solved properly: resolution is now runtime/host-based
   (see above), so there is nothing to switch per deployment.
5. ~~Migrate the schema~~ — done; `deploy-api` runs `migrate --force` every deploy.
6. ~~Point a domain at `2.24.139.176` + TLS~~ — done 2026-08-11:
   **https://pixel-alpha.com** via Cloudflare + Let's Encrypt (`setup-tls`). The
   frontend needed no rebuild — same-origin resolution picked up https on its own.
   ~~**Still open:** the payment callback URLs are the last thing on the bare IP.~~
   Done 2026-08-14 via **`sync-api-env`**: `PAYMENTS_FRONTEND_URL` /
   `PAYMENTS_API_URL` / `PAYMENTS_LIVE_HOSTS` now name the domain, so
   `callbacksAreSecure()` is true and **Coinsbuy runs on its PRODUCTION key set —
   real crypto, real money.** The credentials themselves were already on the
   server; the URLs were the entire gate, because
   `payments.stripe.require_https_in_live` holds **both** providers on test keys
   while the callback base is plaintext.
   There is **no webhook URL to set in the Coinsbuy dashboard** —
   `CoinsbuyGateway` sends `callback_url` with every deposit, so the URL travels
   with the request. What the dashboard still has to carry is the **outbound IP
   allow-list**: `2.24.139.176` must be listed, or deposits come back 403 /
   code 2016 (`COINSBUY_ERROR`).
   Verified from outside the network: `POST /api/payments/coinsbuy/webhook`
   answers `401 COINSBUY_SIGNATURE_INVALID` (Cloudflare → nginx → Laravel →
   signature middleware all reachable), and a `developer` account still pays with
   SANDBOX keys on this same box — `PaymentController::applyRoleOverrides` forces
   them, and `VerifyCoinsbuySignature` accepts the sandbox-signed callback for a
   developer's invoice only.
   **Stripe is NOT live**: no `STRIPE_*` keys anywhere, and the UI hides cards
   behind `CARD_PAYMENTS_ENABLED = false`.
7. **Switch SSH to key auth and disable password login** — the root password is currently
   the only thing guarding the box, and it has been shared in plaintext. Rotate it, add
   `"key_file"` to the creds file in place of `"password"`, then set
   `PasswordAuthentication no` in sshd.
8. Consider `fail2ban`, and unattended-upgrades for security patches.
9. Seed real data — the DB has schema but no rows yet; no user exists to log in with.
