---
name: deploy
description: Deploy sinegual-crypto (React frontend) and sinegutrade-api (Laravel backend) to the project's Ubuntu VPS over SSH. Use when the user says "deploy", "push to prod", "deploy frontend/backend", or similar.
---

# Deploy — SineguAlerts crypto (sinegual-crypto + sinegutrade-api)

## Target

| Env | Host | OS | Remote parent |
|-----|------|----|---------------|
| **prod** | `2.24.139.176` (Contabo KVM 2, `srv1860230`) | Ubuntu 24.04 LTS | `/var/www/sinegualerts` |

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
└── _backups/<ts>/        dashboard.tar.gz + api.tar.gz + api.env  (newest 10 kept)
```

nginx vhost: `/etc/nginx/sites-available/sinegualerts` (written by `provision`,
`default` removed). Serves the SPA at `/`, Laravel at `/api`, immutable caching on
`/assets/`, gzip on.

## Commands

```bash
python .claude/deploy_sinegualcrypto.py inspect          # read-only: stack + layout + .env
python .claude/deploy_sinegualcrypto.py provision        # ONE-TIME server setup (changes the box)
python .claude/deploy_sinegualcrypto.py provision-db     # create MySQL db + user from creds
python .claude/deploy_sinegualcrypto.py setup-env        # write api/.env + php artisan key:generate
python .claude/deploy_sinegualcrypto.py deploy-nginx     # rewrite + test + reload the vhost
npm run build                                            # ALWAYS before deploying frontend
python .claude/deploy_sinegualcrypto.py deploy-dash      # frontend only
python .claude/deploy_sinegualcrypto.py deploy-api       # backend only
python .claude/deploy_sinegualcrypto.py full             # backup -> dash -> api -> verify
python .claude/deploy_sinegualcrypto.py verify           # asset refs + .env + services + HTTP probe
python .claude/deploy_sinegualcrypto.py backup           # timestamped backup only
```

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
6. **Point a domain at `2.24.139.176`**, then `certbot --nginx` for TLS, and set
   `server_name` in `NGINX_VHOST` (currently `_`, so it answers on the bare IP).
   The frontend needs no rebuild — same-origin resolution picks up https automatically.
7. **Switch SSH to key auth and disable password login** — the root password is currently
   the only thing guarding the box, and it has been shared in plaintext. Rotate it, add
   `"key_file"` to the creds file in place of `"password"`, then set
   `PasswordAuthentication no` in sshd.
8. Consider `fail2ban`, and unattended-upgrades for security patches.
9. Seed real data — the DB has schema but no rows yet; no user exists to log in with.
