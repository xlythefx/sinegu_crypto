---
name: deploy
description: Deploy sinegual-crypto (React frontend) and sinegutrade-api (Laravel backend) to the project's Ubuntu VPS over SSH. Use when the user says "deploy", "push to prod", "deploy frontend/backend", or similar.
---

# Deploy — SineguAlerts crypto (sinegual-crypto + sinegutrade-api)

## ⚠️ Current status

**The VPS for this project has NOT been provided yet.** Until the user supplies the
server details, this skill documents the intended flow only. If invoked before the VPS
exists, tell the user deployment isn't configured yet and ask for:
host/IP, SSH user, auth (password or key), and the web root paths.

**Do NOT use the mother project's servers or credentials**
(`sinequal-dash-fusion-main` deploys to its own VPS fleet — that infrastructure belongs
to the mother project and must never be targeted from this repo).

## Credentials policy

- Credentials are **never** written in this file, the deploy script, settings.json, or
  any committed file.
- They live in `.claude/deploy.creds.json` (gitignored). Template:

```json
{
  "prod": { "host": "<VPS_IP>", "port": 22, "user": "<ssh-user>", "password": "<password>" }
}
```

- When the VPS is provided, create that file, confirm `.gitignore` covers it, and fill
  in the placeholders in the deploy script.

## Deployment model (adapted from the mother project's proven flow)

The mother project uses a single Python script (`.claude/deploy_*.py`, paramiko over
SSH) with subcommands. Recreate the same shape here as
`.claude/deploy_sinegualcrypto.py`, adapted for an **Ubuntu** target (the mother's VPS
is Windows; this one is Linux — so bash/tar/rsync semantics, not robocopy):

1. **Target selection** — `python .claude/deploy_sinegualcrypto.py <cmd> [target]`,
   default `prod`. Host/user/password read from `.claude/deploy.creds.json`.
2. **`inspect`** — read-only: show remote layout, confirm secrets file presence.
3. **`backup`** — before touching anything, copy current live `frontend/` and `api/`
   into a timestamped `_backups/<YYYYmmdd_HHMMSS>/` dir on the server (exclude
   `vendor/`, `node_modules/`, `storage/`).
4. **`deploy-dash`** (frontend) — run `npm run build` locally → zip `dist/` → single
   SFTP upload → extract to a staging dir → sync into the web root, clearing stale
   hashed `assets/` first so old chunks don't linger.
5. **`deploy-api`** (backend) — pack `C:\wamp64\www\sinegutrade-api` excluding
   `.git`, `vendor/`, `node_modules/`, `storage/`, `.env` → upload → extract → sync
   into the server's api dir. **Never overwrite** the server's `.env`, `storage/`,
   `vendor/`, or `uploads/`. Then run remotely: `composer install --no-dev`,
   `php artisan migrate --force`, `php artisan config:cache`.
6. **`full`** — backup → deploy-dash → deploy-api → verify, on one connection.
7. **`verify`** — check `index.html` references match the uploaded asset chunks,
   confirm `.env` intact, curl 1–2 API endpoints and read the body.

## Commands (once configured)

```bash
npm run build                                        # always build before deploying frontend
python .claude/deploy_sinegualcrypto.py inspect      # read-only sanity check
python .claude/deploy_sinegualcrypto.py full prod    # backup + frontend + api + verify
python .claude/deploy_sinegualcrypto.py deploy-dash  # frontend only
python .claude/deploy_sinegualcrypto.py deploy-api   # backend only
```

## Rules

- Always `backup` before a deploy (or use `full`, which does it).
- Always `npm run build` locally before `deploy-dash`; abort if the build fails.
- Verify after deploying — never report success without the verify step passing.
- Gentle SSH: few connect attempts with long waits (hammering trips fail2ban).
- If a deploy goes bad, restore from the newest `_backups/<timestamp>/`.
