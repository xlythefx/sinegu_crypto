#!/usr/bin/env python3
"""
Deploy helper for Pixel Alpha (sinegual-crypto frontend + sinegutrade-api backend)
to the project's Ubuntu VPS, over paramiko/SFTP.

Target:
  prod    2.24.139.176  ->  /var/www/sinegualerts   (Ubuntu 24.04, root)
          https://pixel-alpha.com  (Cloudflare-proxied; www 301s to the apex)

Remote layout created by `provision`:
  /var/www/sinegualerts/
  ├── dashboard/      React dist  (nginx root, SPA fallback)
  ├── api/            Laravel sinegutrade-api (nginx -> api/public via php-fpm)
  └── _backups/<timestamp>/

Usage:
  python .claude/deploy_sinegualcrypto.py <cmd> [target]
  e.g.  python .claude/deploy_sinegualcrypto.py inspect
        python .claude/deploy_sinegualcrypto.py full prod
  Target may also be given as --target <name> or via DEPLOY_TARGET env. Default = prod.

Subcommands:
  inspect       - read-only: OS/stack presence, remote layout, .env presence
  provision     - install nginx + php-fpm + mysql + composer + node, create dirs,
                  write the nginx vhost, enable ufw.  ONE-TIME, changes the server.
  provision-db  - create MySQL db + user from creds file ("db" block)
  backup        - tar dashboard/ + api/ into _backups/<timestamp>/
  backup-db     - mysqldump the whole live database -> _db_backups/<ts>.sql.gz on the
                  server, then pull it to .claude/_db_backups/ locally.
                  Pass --no-download to leave it on the server only.
  deploy-dash   - local dist/ -> remote dashboard/   (run `npm run build` first)
  deploy-api    - local sinegutrade-api -> remote api/ (preserves .env/storage/vendor)
  deploy-engine - local trading-flask/ (binance_abcd) -> remote engine/ + venv +
                  server-side .env + systemd unit + nginx webhook route (preserves .env/.venv)
  sync-api-env  - config only: mirror the Coinsbuy / TRON / Discord keys from local
                  sinegutrade-api/.env into api/.env, set the prod PAYMENTS_* URLs,
                  config:cache
  sync-engine-env - config only: mirror the engine's product keys, restart the unit
  deploy-nginx  - rewrite the vhost + Cloudflare real-IP list, test, reload
  setup-tls     - issue/renew the Let's Encrypt cert for the domain, enable :443
  verify        - index.html chunk refs exist, .env intact, HTTP probe
  verify-tls    - :80/:443 listeners, origin probes, www redirect, edge probe
  verify-engine - systemd state, /health, public webhook gate, engine->API auth
  full          - backup -> deploy-dash -> deploy-api -> verify  (one connection)

Credentials are NOT stored in this file. They load from .claude/deploy.creds.json
(gitignored). See .claude/skills/deploy/SKILL.md.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime

import paramiko

TARGETS = {
    "prod": {
        "host": "2.24.139.176",
        "parent": "/var/www/sinegualerts",
        "aliases": ["sinegualerts", "2.24"],
    },
}
_ALIAS = {a: k for k, t in TARGETS.items() for a in t.get("aliases", [])}

HERE = os.path.dirname(os.path.abspath(__file__))
CREDS_FILE = os.path.join(HERE, "deploy.creds.json")
REPO_ROOT = os.path.dirname(HERE)

LOCAL_DIST = os.path.join(REPO_ROOT, "dist")
LOCAL_API = r"C:\wamp64\www\sinegutrade-api"
LOCAL_ENGINE = os.path.join(REPO_ROOT, "trading-flask")
LOCAL_TELEGRAM = os.path.join(REPO_ROOT, "pixel-telegram")

# --- API push excludes: never overwrite production secrets / data / deps ---
API_EXCLUDE_DIRS = {
    ".git", ".github", "vendor", "node_modules", "storage", "public/storage",
    "bootstrap/cache", "tests", ".idea", ".vscode", ".claude",
}
API_EXCLUDE_FILES = {
    ".env", ".env.local", ".env.production",
    "package-lock.json", "composer.lock.bak",
}
API_EXCLUDE_EXT = {".log", ".sqlite", ".zip", ".rar", ".7z"}

# --- Engine push excludes: dev tooling and server-owned state stay out ---
ENGINE_EXCLUDE_DIRS = {".git", ".venv", "__pycache__", ".pytest_cache", "out", "tests"}
ENGINE_EXCLUDE_FILES = {
    ".env", "engine_launcher.py", "webhook_tester.py", "requirements-dev.txt",
}
ENGINE_EXCLUDE_EXT = {".pyc", ".log"}

# --- pixel-telegram push excludes ---
# `state` holds the last-seen unit fingerprints and is SERVER-owned: shipping a
# dev copy would make the box re-announce every service as restarted.
TELEGRAM_EXCLUDE_DIRS = {".git", ".venv", "__pycache__", ".pytest_cache", "state"}
TELEGRAM_EXCLUDE_FILES = {".env"}
TELEGRAM_EXCLUDE_EXT = {".pyc", ".log"}


def log(msg: str) -> None:
    print(msg, flush=True)


def _load_creds() -> dict:
    if not os.path.isfile(CREDS_FILE):
        raise SystemExit(
            f"[abort] credentials file missing: {CREDS_FILE}\n"
            f"        It is gitignored — see .claude/skills/deploy/SKILL.md for the template."
        )
    with open(CREDS_FILE, encoding="utf-8") as f:
        return json.load(f)


def _resolve_target_name() -> str:
    argv = sys.argv[1:]
    for i, a in enumerate(argv):
        if a.startswith("--target="):
            return a.split("=", 1)[1]
        if a == "--target" and i + 1 < len(argv):
            return argv[i + 1]
    positionals = [a for a in argv if not a.startswith("-")]
    if len(positionals) >= 2:
        return positionals[1]
    return os.environ.get("DEPLOY_TARGET", "prod")


_RAW_TARGET = _resolve_target_name()
_TARGET = _ALIAS.get(_RAW_TARGET, _RAW_TARGET)
if _TARGET not in TARGETS:
    raise SystemExit(
        f"unknown target={_RAW_TARGET!r}; choose {list(TARGETS)} (aliases: {list(_ALIAS)})"
    )
_T = TARGETS[_TARGET]
_CREDS = _load_creds()
_C = _CREDS.get(_TARGET) or _CREDS.get(_T["host"]) or {}

HOST = _C.get("host", _T["host"])
PORT = int(_C.get("port", 22))
USER = _C.get("user", "root")
PASSWORD = _C.get("password")
KEYFILE = _C.get("key_file")
if not PASSWORD and not KEYFILE:
    raise SystemExit(f"[abort] no password/key_file for target {_TARGET!r} ({HOST}) in {CREDS_FILE}")

REMOTE_PARENT = _T["parent"]
REMOTE_DASH = REMOTE_PARENT + "/dashboard"
REMOTE_API = REMOTE_PARENT + "/api"
REMOTE_ENGINE = REMOTE_PARENT + "/engine"
REMOTE_TELEGRAM = REMOTE_PARENT + "/telegram"
REMOTE_BACKUPS = REMOTE_PARENT + "/_backups"
# Deliberately a SIBLING of _backups, not a subdirectory: do_backup() prunes
# _backups with `ls -1t | tail -n +11 | xargs rm -rf`, which would eventually
# delete a `db/` folder sitting in there as if it were an old release.
REMOTE_DB_BACKUPS = REMOTE_PARENT + "/_db_backups"
LOCAL_DB_BACKUPS = os.path.join(HERE, "_db_backups")
DB_BACKUP_KEEP = 10
REMOTE_TMP = "/tmp/sinegu_deploy"
ENGINE_SERVICE = "sinegualerts-engine"
TELEGRAM_SERVICE = "pixel-telegram"


# ---------------------------------------------------------------- connection

_SSH: dict = {"client": None}
_NET_ERRORS = (ConnectionResetError, ConnectionAbortedError, EOFError, OSError,
               paramiko.SSHException)


def connect() -> paramiko.SSHClient:
    """Gentle connect: few attempts, long waits. Hammering trips sshd anti-flood/fail2ban."""
    last = None
    for attempt in range(1, 4):
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            kwargs = dict(hostname=HOST, port=PORT, username=USER,
                          timeout=30, banner_timeout=60, auth_timeout=30)
            if KEYFILE:
                kwargs["key_filename"] = KEYFILE
            else:
                kwargs["password"] = PASSWORD
            ssh.connect(**kwargs)
            ssh.get_transport().set_keepalive(15)
            return ssh
        except Exception as e:
            last = e
            log(f"  [connect] attempt {attempt} failed ({e}); retry in 60s")
            if attempt < 3:
                time.sleep(60)
    raise RuntimeError(f"Could not connect after retries: {last}")


def _current(ssh=None):
    return _SSH.get("client") or ssh


def _reconnect(label: str = ""):
    old = _SSH.get("client")
    try:
        if old is not None:
            old.close()
    except Exception:
        pass
    time.sleep(4)
    c = connect()
    _SSH["client"] = c
    if label:
        log(f"  [reconnected] {label}")
    return c


def run(ssh, cmd: str, check: bool = True, attempts: int = 3, timeout: int = 300):
    """Run a remote bash command, reconnecting+retrying on transport failures."""
    last = None
    for i in range(1, attempts + 1):
        client = _current(ssh)
        try:
            stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
            out = stdout.read().decode("utf-8", errors="replace")
            err = stderr.read().decode("utf-8", errors="replace")
            rc = stdout.channel.recv_exit_status()
        except _NET_ERRORS as e:
            last = e
            log(f"  [run] channel dropped ({type(e).__name__}); retry {i}/{attempts}: {cmd[:60]}")
            if i < attempts:
                time.sleep(3 * i)
                try:
                    _reconnect()
                except Exception as ce:
                    log(f"  [run] reconnect failed: {type(ce).__name__}")
            continue
        if check and rc != 0:
            raise RuntimeError(f"rc={rc} for: {cmd}\n--- stdout ---\n{out}\n--- stderr ---\n{err}")
        return rc, out, err
    raise RuntimeError(f"command failed after {attempts} attempts: {cmd}") from last


def sh(ssh, cmd: str, check: bool = True, timeout: int = 300):
    """Same as run(), but wrapped in `bash -lc` so pipes/globs/&& behave."""
    quoted = cmd.replace("'", "'\\''")
    return run(ssh, f"bash -lc '{quoted}'", check=check, timeout=timeout)


# ------------------------------------------------------------------- helpers

_MODE_EXCLUDES = {
    "api": (API_EXCLUDE_DIRS, API_EXCLUDE_FILES, API_EXCLUDE_EXT),
    "engine": (ENGINE_EXCLUDE_DIRS, ENGINE_EXCLUDE_FILES, ENGINE_EXCLUDE_EXT),
    "telegram": (TELEGRAM_EXCLUDE_DIRS, TELEGRAM_EXCLUDE_FILES, TELEGRAM_EXCLUDE_EXT),
}


def _collect(local_root: str, mode: str) -> list[tuple[str, str]]:
    """Walk local_root -> [(abs_path, posix_rel)], applying per-mode excludes."""
    excludes = _MODE_EXCLUDES.get(mode)
    out: list[tuple[str, str]] = []
    for dirpath, dirnames, filenames in os.walk(local_root):
        rel_dir = os.path.relpath(dirpath, local_root).replace("\\", "/")
        if rel_dir == ".":
            rel_dir = ""
        if excludes:
            ex_dirs, _, _ = excludes
            dirnames[:] = [
                d for d in dirnames
                if d.lower() not in ex_dirs
                and f"{rel_dir}/{d}".lstrip("/").lower() not in ex_dirs
            ]
        for fn in filenames:
            rel = f"{rel_dir}/{fn}".lstrip("/")
            if excludes:
                _, ex_files, ex_ext = excludes
                rel_l = rel.lower()
                if rel_l in ex_files or os.path.basename(rel_l) in ex_files:
                    continue
                if os.path.splitext(rel_l)[1] in ex_ext:
                    continue
            out.append((os.path.join(dirpath, fn), rel))
    out.sort(key=lambda x: x[1])
    return out


def _pack_tgz(files: list[tuple[str, str]], tgz_path: str) -> None:
    import tarfile
    with tarfile.open(tgz_path, "w:gz", compresslevel=6) as tf:
        for local_path, rel in files:
            tf.add(local_path, arcname=rel)


def _remote_size(sftp, path: str) -> int:
    try:
        return sftp.stat(path).st_size
    except Exception:
        return -1


def _upload(ssh, local_path: str, remote_path: str, attempts: int = 5) -> None:
    """SFTP upload with size verification; reconnect + retry on drop."""
    expected = os.path.getsize(local_path)
    for attempt in range(1, attempts + 1):
        try:
            with _current(ssh).open_sftp() as sftp:
                sftp.put(local_path, remote_path)
                got = _remote_size(sftp, remote_path)
            if got == expected:
                log(f"  uploaded {expected / 1024 / 1024:.2f} MB (verified)")
                return
            log(f"  size mismatch ({got} != {expected}); retry {attempt}/{attempts}")
        except Exception as e:
            log(f"  upload dropped ({type(e).__name__}); retry {attempt}/{attempts}")
        if attempt == attempts:
            raise RuntimeError(f"upload of {remote_path} failed after {attempts} attempts")
        time.sleep(3 * attempt)
        try:
            _reconnect()
        except Exception:
            pass


def _deploy_via_tgz(ssh, local_root: str, remote_dest: str, mode: str, name: str,
                    rsync_extra: list[str] | None = None, pre_sync: list[str] | None = None):
    """Pack -> upload -> extract into a clean staging dir -> rsync into dest."""
    if not os.path.isdir(local_root):
        sys.exit(f"[abort] local source not found: {local_root}")
    files = _collect(local_root, mode=mode)
    if not files:
        sys.exit(f"[abort] nothing to upload from {local_root}")
    log(f"  packing {len(files)} files -> {name}")
    local_tgz = os.path.join(os.environ.get("TEMP", "."), name)
    _pack_tgz(files, local_tgz)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    stem = name.rsplit(".tar", 1)[0]
    remote_tgz = f"{REMOTE_TMP}/{stem}_{ts}.tar.gz"
    stage = f"{REMOTE_TMP}/stage_{stem}"

    sh(ssh, f"mkdir -p {REMOTE_TMP} && rm -rf {stage} && mkdir -p {stage}")
    log(f"  packed {os.path.getsize(local_tgz) / 1024 / 1024:.2f} MB; uploading...")
    _upload(ssh, local_tgz, remote_tgz)

    log("  extracting to staging...")
    sh(ssh, f"tar -xzf {remote_tgz} -C {stage}")
    sh(ssh, f"mkdir -p {remote_dest}")
    for c in (pre_sync or []):
        sh(ssh, c, check=False)

    excl = " ".join(f"--exclude={e}" for e in (rsync_extra or []))
    log("  rsync staging -> dest")
    # No --delete: merge into dest so anything the deployer doesn't ship
    # (.env, storage/, vendor/) survives. Stale frontend chunks are handled
    # separately by the pre_sync `rm -rf assets`.
    sh(ssh, f"rsync -a {excl} {stage}/ {remote_dest}/")
    sh(ssh, f"chown -R www-data:www-data {remote_dest}", check=False)

    sh(ssh, f"rm -rf {stage} {remote_tgz}", check=False)
    try:
        os.remove(local_tgz)
    except OSError:
        pass
    log(f"  deployed into {remote_dest}")
    return ssh


# ------------------------------------------------------------------ commands

def do_inspect(ssh) -> None:
    log(f"=== INSPECT {_TARGET} ({HOST}) -> {REMOTE_PARENT} ===\n")
    log("--- stack ---")
    for label, cmd in [
        ("os", "cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2"),
        ("nginx", "nginx -v 2>&1 || echo MISSING"),
        ("php-fpm", "php -v 2>/dev/null | head -1 || echo MISSING"),
        ("composer", "composer --version 2>/dev/null || echo MISSING"),
        ("mysql", "mysql --version 2>/dev/null || echo MISSING"),
        ("node", "node -v 2>/dev/null || echo MISSING"),
        ("rsync", "rsync --version 2>/dev/null | head -1 || echo MISSING"),
    ]:
        _, out, _ = sh(ssh, cmd, check=False)
        log(f"  [{label}] {out.strip() or 'MISSING'}")

    log("\n--- layout ---")
    for label, path in [("parent", REMOTE_PARENT), ("dashboard", REMOTE_DASH),
                        ("api", REMOTE_API), ("_backups", REMOTE_BACKUPS)]:
        _, out, _ = sh(ssh, f"[ -d {path} ] && echo EXISTS || echo MISSING", check=False)
        log(f"  [{label}] {path} -> {out.strip()}")

    log("\n--- api .env (must be preserved) ---")
    _, out, _ = sh(ssh, f"[ -f {REMOTE_API}/.env ] && echo '.env PRESENT' || echo '.env MISSING'", check=False)
    log("  " + out.strip())

    log("\n--- dashboard top-level ---")
    _, out, _ = sh(ssh, f"ls -1 {REMOTE_DASH} 2>/dev/null | head -20", check=False)
    log("  " + (out.strip().replace("\n", "\n  ") or "(empty)"))

    log("\n--- api top-level ---")
    _, out, _ = sh(ssh, f"ls -1 {REMOTE_API} 2>/dev/null | head -25", check=False)
    log("  " + (out.strip().replace("\n", "\n  ") or "(empty)"))

    log("\n--- backups ---")
    _, out, _ = sh(ssh, f"ls -1 {REMOTE_BACKUPS} 2>/dev/null | tail -10", check=False)
    log("  " + (out.strip().replace("\n", "\n  ") or "(none)"))

    log("\n--- services ---")
    _, out, _ = sh(ssh, "systemctl is-active nginx php8.3-fpm mysql 2>/dev/null | tr '\\n' ' '", check=False)
    log(f"  nginx / php8.3-fpm / mysql -> {out.strip() or '(none)'}")


# ------------------------------------------------------------------ domain/TLS
#
# pixel-alpha.com is served through Cloudflare (proxied — the public A records
# are Cloudflare's, not ours). Two consequences shape everything below:
#
#   1. Every request reaches nginx from a Cloudflare address, so $remote_addr is
#      useless until it is restored from CF-Connecting-IP. That restore is only
#      safe because set_real_ip_from lists Cloudflare's ranges: a direct hit on
#      the origin IP carrying a forged CF-Connecting-IP is NOT from a trusted
#      source, so nginx ignores the header. This matters more than logging —
#      /api/engine/ is gated on `allow 127.0.0.1`, and a spoofable real-IP
#      would hand the internet the account-key endpoint.
#   2. In Full (strict) mode Cloudflare dials the origin on :443. A 522 at the
#      edge means nothing is listening there, which is exactly what the box
#      looked like before TLS: :80 fine, :443 closed.
DOMAIN = "pixel-alpha.com"
DOMAIN_WWW = f"www.{DOMAIN}"
CERT_LIVE = f"/etc/letsencrypt/live/{DOMAIN}"
CERTBOT_EMAIL = "wodnxly3@gmail.com"

NGINX_SNIPPET_PATH = "/etc/nginx/snippets/sinegualerts-app.conf"
NGINX_REALIP_PATH = "/etc/nginx/conf.d/cloudflare-realip.conf"

# The application itself, shared verbatim by every server block that serves it
# (:80 default_server for the bare IP and for the engine's 127.0.0.1 calls, and
# :443 for the domain). One copy — three near-identical copies is how a location
# gets fixed in one place and stays broken in the other two.
NGINX_APP_SNIPPET = """root /var/www/sinegualerts/dashboard;
index index.html;

client_max_body_size 32M;

# ---- engine machine-to-machine API: localhost ONLY ----
# /api/engine/* hands out account api/secret keys (X-Engine-Secret header);
# the engine calls it via 127.0.0.1, so the internet never needs it.
location ^~ /api/engine/ {
    allow 127.0.0.1;
    allow ::1;
    deny all;
    root /var/www/sinegualerts/api/public;
    try_files $uri @laravel;
}

# ---- Laravel API under /api -> sinegutrade-api/public ----
# `root` (not `alias`) + a named-location fallback, so $request_uri reaches
# PHP untouched. Laravel's routes are registered WITH the /api prefix, so it
# must see REQUEST_URI=/api/user. SCRIPT_NAME is deliberately /index.php:
# if it were /api/index.php, Symfony would treat /api as the base URL and
# strip it, leaving pathInfo=/user — which matches no route (404).
location ^~ /api {
    root /var/www/sinegualerts/api/public;
    try_files $uri @laravel;
}

location @laravel {
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME /var/www/sinegualerts/api/public/index.php;
    fastcgi_param SCRIPT_NAME /index.php;
    fastcgi_param DOCUMENT_ROOT /var/www/sinegualerts/api/public;
    # Symfony reads $_SERVER['HTTPS'] directly, so Laravel builds https:// URLs
    # without trusting any client-supplied X-Forwarded-Proto. $https is "on" only
    # in the TLS server block, empty on :80 — so this one line is correct in both
    # and there is nothing to spoof.
    fastcgi_param HTTPS $https if_not_empty;
    fastcgi_read_timeout 120;
}

# ---- trading engine webhooks (waitress on 127.0.0.1:5010) ----
# ONLY the webhook paths are public — one per venue, the path decides which
# exchange's accounts a signal trades; /health and /admin/* stay local-only.
__ENGINE_WEBHOOK_LOCATIONS__

# React SPA fallback.
#
# index.html MUST NOT be cached. With no Cache-Control header browsers
# apply heuristic freshness (a fraction of Last-Modified age) and keep
# serving an old index.html, which points at the previous build's hashed
# bundle — the deploy looks like it never happened until you hard-refresh
# or open incognito. `no-cache` still allows a cheap 304 via ETag.
location / {
    add_header Cache-Control "no-cache, must-revalidate" always;
    try_files $uri $uri/ /index.html;
}

# try_files re-runs location matching, so the fallback lands here.
location = /index.html {
    add_header Cache-Control "no-cache, must-revalidate" always;
    try_files $uri =404;
}

# hashed assets are immutable — the filename changes every build.
# One explicit header rather than `expires` + add_header, which emits two
# separate Cache-Control lines that a CDN in front could read ambiguously.
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    try_files $uri =404;
}

gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_min_length 1024;
"""

# One public webhook path per venue (must match trading-flask/binance_abcd/hooks.py
# WEBHOOK_PATHS). nginx proxies exactly these to waitress; a venue added to the
# engine without a line here answers 404 from nginx, never reaching the engine.
ENGINE_WEBHOOK_PATHS = ("/binance_abcd_webhook", "/mexc_abcd_webhook")


def _engine_webhook_locations(indent: int = 0) -> str:
    """The `location = <path>` blocks proxying the engine webhooks, one per
    venue. Plain text either way it is used — interpolated into the vhost
    f-string as a VALUE, so its braces are never re-parsed."""
    pad = " " * indent
    lb, rb = "{", "}"
    lines = [
        "location = {path} {lb}",
        "    proxy_pass http://127.0.0.1:5010;",
        "    proxy_set_header Host $host;",
        "    proxy_set_header X-Real-IP $remote_addr;",
        "    proxy_read_timeout 30;",
        "{rb}",
    ]
    newline = chr(10)
    blocks = [
        newline.join(pad + line.format(path=path, lb=lb, rb=rb) for line in lines)
        for path in ENGINE_WEBHOOK_PATHS
    ]
    return (newline * 2).join(blocks)


# Served from the dashboard root on :80 for BOTH issuance and every renewal, so
# certbot never has to stop nginx or edit this vhost. Kept out of the redirect
# below on purpose: on first issuance there is no certificate yet, so a blanket
# 301 to https would send Let's Encrypt to a port that cannot answer.
NGINX_ACME_LOCATION = """    location ^~ /.well-known/acme-challenge/ {
        root /var/www/sinegualerts/dashboard;
        default_type "text/plain";
        try_files $uri =404;
    }
"""


def _nginx_vhost(tls: bool) -> str:
    """Build the vhost. `tls` adds the :443 blocks; without a certificate on disk
    they would make `nginx -t` fail, so the caller probes for one first."""
    app = f"    include {NGINX_SNIPPET_PATH};"
    parts = [f"""# Managed by .claude/deploy_sinegualcrypto.py — edits here are overwritten.
#
# :80 default_server stays a FULL app server rather than a redirect. It is what
# answers the bare IP, and — the part that bites — it is what the trading engine
# talks to: BINANCE_ABCD_ENGINE_API_BASE is http://127.0.0.1/api. A blanket
# http->https redirect here would 301 the engine's every call to the API and cut
# the loop, so only the DOMAIN's :80 block redirects.
server {{
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

{NGINX_ACME_LOCATION}
{app}
}}

server {{
    listen 80;
    listen [::]:80;
    server_name {DOMAIN} {DOMAIN_WWW};

{NGINX_ACME_LOCATION}
    # POSTs are not redirected — a 301 on a POST is allowed to drop the body, and
    # these paths are live TradingView webhooks. Serve them here instead of bouncing.
{_engine_webhook_locations(indent=4)}

    location / {{
        return 301 https://{DOMAIN}$request_uri;
    }}
}}"""]

    if tls:
        tls_common = f"""    ssl_certificate     {CERT_LIVE}/fullchain.pem;
    ssl_certificate_key {CERT_LIVE}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;"""
        parts.append(f"""
# Canonical origin. default_server so a direct https hit on the bare IP is served
# too (with a name-mismatch warning, which is correct — the IP is not the site).
#
# No http2: Cloudflare already speaks HTTP/2 and HTTP/3 to visitors and HTTP/1.1
# to the origin, so it would buy nothing here — and the directive spelling split
# at nginx 1.25 (`listen ... http2` vs `http2 on;`), which is a config test
# failure waiting for whenever this box gets upgraded.
server {{
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name {DOMAIN};

{tls_common}

{app}
}}

server {{
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name {DOMAIN_WWW};

{tls_common}

    return 301 https://{DOMAIN}$request_uri;
}}""")

    return "\n".join(parts) + "\n"


def do_provision(ssh) -> None:
    """One-time server setup. Installs packages and writes the nginx vhost."""
    log(f"=== PROVISION {_TARGET} ({HOST}) ===")
    log("  updating apt index (this takes a minute)...")
    sh(ssh, "DEBIAN_FRONTEND=noninteractive apt-get update -y", timeout=600)

    log("  installing base tooling...")
    sh(ssh, "DEBIAN_FRONTEND=noninteractive apt-get install -y "
            "curl ca-certificates gnupg rsync unzip git ufw", timeout=900)

    log("  installing nginx...")
    sh(ssh, "DEBIAN_FRONTEND=noninteractive apt-get install -y nginx", timeout=900)

    log("  installing php8.3-fpm + Laravel extensions...")
    sh(ssh, "DEBIAN_FRONTEND=noninteractive apt-get install -y "
            "php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring php8.3-xml "
            "php8.3-curl php8.3-zip php8.3-bcmath php8.3-gd php8.3-intl", timeout=1200)

    log("  installing mysql-server...")
    sh(ssh, "DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server", timeout=1200)

    log("  installing composer...")
    sh(ssh, "if ! command -v composer >/dev/null; then "
            "curl -sS https://getcomposer.org/installer -o /tmp/composer-setup.php && "
            "php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer && "
            "rm -f /tmp/composer-setup.php; fi", timeout=600)

    log("  installing node 22 (for occasional server-side builds)...")
    sh(ssh, "if ! command -v node >/dev/null; then "
            "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && "
            "DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs; fi", timeout=900)

    log("  creating layout...")
    sh(ssh, f"mkdir -p {REMOTE_DASH} {REMOTE_API} {REMOTE_BACKUPS} {REMOTE_TMP} && "
            f"chown -R www-data:www-data {REMOTE_PARENT}")

    log("  installing certbot (TLS is issued separately by `setup-tls`)...")
    sh(ssh, "DEBIAN_FRONTEND=noninteractive apt-get install -y certbot", timeout=900)

    log("  enabling services...")
    sh(ssh, "systemctl enable --now nginx php8.3-fpm mysql")

    log("  writing nginx vhost...")
    do_deploy_nginx(ssh)

    log("  firewall (OpenSSH + HTTP/HTTPS)...")
    sh(ssh, "ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable", check=False)

    log("  placeholder index so the vhost answers before the first deploy...")
    sh(ssh, f"[ -f {REMOTE_DASH}/index.html ] || "
            f"echo '<h1>Pixel Alpha — awaiting first deploy</h1>' > {REMOTE_DASH}/index.html",
       check=False)

    log("=== PROVISION DONE ===\n")
    do_inspect(ssh)


def _has_cert(ssh) -> bool:
    rc, _, _ = sh(ssh, f"test -f {CERT_LIVE}/fullchain.pem", check=False)
    return rc == 0


def _write_cloudflare_realip(ssh) -> None:
    """Refresh the trusted-proxy list from Cloudflare's published ranges.

    Written to conf.d (http context) so every server block inherits it. Best
    effort by design: if the fetch fails we keep whatever is already installed
    rather than truncating the list — an EMPTY set_real_ip_from list would not
    fail `nginx -t`, it would silently make every visitor look like Cloudflare
    again, and that is the failure you notice weeks later in the logs.
    """
    script = (
        "set -e; tmp=$(mktemp); "
        "{ curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4; echo; "
        "  curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6; echo; } "
        "| grep -E '^[0-9a-fA-F:.]+/[0-9]+$' "
        "| sed 's|^|set_real_ip_from |; s|$|;|' > $tmp; "
        f"test -s $tmp; "
        "printf '# Generated from cloudflare.com/ips-v4 + ips-v6. Refreshed by deploy-nginx.\\n' "
        f"| cat - $tmp > {NGINX_REALIP_PATH}; "
        f"printf 'real_ip_header CF-Connecting-IP;\\n' >> {NGINX_REALIP_PATH}; "
        "rm -f $tmp"
    )
    rc, _, err = sh(ssh, script, check=False, timeout=90)
    if rc != 0:
        rc2, _, _ = sh(ssh, f"test -s {NGINX_REALIP_PATH}", check=False)
        if rc2 != 0:
            raise RuntimeError(f"could not fetch Cloudflare IP ranges and none cached: {err.strip()}")
        log("  cloudflare ranges: fetch failed, keeping the cached list")
        return
    _, out, _ = sh(ssh, f"grep -c set_real_ip_from {NGINX_REALIP_PATH}", check=False)
    log(f"  cloudflare ranges: {out.strip()} prefixes trusted for CF-Connecting-IP")


def do_deploy_nginx(ssh) -> None:
    """Rewrite the nginx vhost + app snippet, test, reload. Idempotent.

    The :443 blocks are emitted only when a certificate is actually on disk —
    `ssl_certificate` pointing at a missing file is a hard `nginx -t` failure, so
    an unconditional TLS template would make this command unrunnable on a fresh
    box and turn the first deploy into a chicken-and-egg. Run `setup-tls` once;
    every later run picks the certificate up on its own.
    """
    log("=== DEPLOY nginx vhost ===")
    tls = _has_cert(ssh)
    log(f"  certificate for {DOMAIN}: {'present -> :443 enabled' if tls else 'MISSING -> http only (run setup-tls)'}")

    _write_cloudflare_realip(ssh)

    sh(ssh, "mkdir -p /etc/nginx/snippets /etc/nginx/conf.d")
    with _current(ssh).open_sftp() as sftp:
        with sftp.open(NGINX_SNIPPET_PATH, "w") as f:
            f.write(NGINX_APP_SNIPPET.replace("__ENGINE_WEBHOOK_LOCATIONS__", _engine_webhook_locations()))
        with sftp.open("/etc/nginx/sites-available/sinegualerts", "w") as f:
            f.write(_nginx_vhost(tls))
    sh(ssh, "rm -f /etc/nginx/sites-enabled/default && "
            "ln -sf /etc/nginx/sites-available/sinegualerts /etc/nginx/sites-enabled/sinegualerts")
    rc, out, err = sh(ssh, "nginx -t", check=False)
    log("  nginx -t -> " + (out + err).strip().replace("\n", " | "))
    if rc != 0:
        raise RuntimeError("nginx config test failed; not reloading")
    sh(ssh, "systemctl reload nginx")
    log("  reloaded\n")


def do_setup_tls(ssh) -> None:
    """Issue (or renew) the Let's Encrypt certificate for the domain and switch
    the vhost to serving :443. Safe to re-run — certbot no-ops when current.

    `certonly --webroot`, never `--nginx`: the nginx plugin REWRITES the vhost to
    add its own :443 block, and this deployer rewrites that file from a template
    on every deploy-nginx. Whichever ran last would win, and the loser is TLS.
    Here certbot only ever touches /etc/letsencrypt, and the vhost stays ours.
    """
    log(f"=== SETUP TLS ({DOMAIN}) ===")

    log("  installing certbot...")
    sh(ssh, "command -v certbot >/dev/null || "
            "DEBIAN_FRONTEND=noninteractive apt-get install -y certbot", timeout=900)

    # The challenge is served over :80 from the dashboard root, so the vhost has
    # to be the current one (with the ACME location) before certbot runs.
    do_deploy_nginx(ssh)

    log("  ufw: allowing HTTPS...")
    sh(ssh, "ufw allow 'Nginx Full' >/dev/null 2>&1 || true", check=False)

    if _has_cert(ssh):
        log("  certificate already present — renewing if due...")
        rc, out, err = sh(ssh, "certbot renew --quiet --deploy-hook 'systemctl reload nginx'",
                          check=False, timeout=600)
        log("  " + ((out + err).strip() or "nothing due").replace("\n", "\n  "))
    else:
        log(f"  requesting certificate for {DOMAIN} + {DOMAIN_WWW} (webroot HTTP-01)...")
        rc, out, err = sh(
            ssh,
            "certbot certonly --webroot -w /var/www/sinegualerts/dashboard "
            f"-d {DOMAIN} -d {DOMAIN_WWW} "
            f"--non-interactive --agree-tos -m {CERTBOT_EMAIL} "
            "--deploy-hook 'systemctl reload nginx'",
            check=False, timeout=600,
        )
        log("  " + (out + err).strip().replace("\n", "\n  "))
        if rc != 0:
            raise RuntimeError(
                "certbot failed. Most likely cause: Cloudflare answered the HTTP-01 "
                "challenge itself instead of forwarding it. In the Cloudflare dashboard "
                "turn OFF SSL/TLS -> Edge Certificates -> 'Always Use HTTPS' (and any "
                "http->https Page Rule) and re-run, or grey-cloud the DNS records for "
                "a minute. Re-enable after issuance."
            )

    if not _has_cert(ssh):
        raise RuntimeError(f"no certificate at {CERT_LIVE} after certbot ran")

    log("  re-writing the vhost with :443 enabled...")
    do_deploy_nginx(ssh)

    _, out, _ = sh(ssh, "systemctl is-enabled certbot.timer 2>/dev/null || echo missing", check=False)
    log(f"  auto-renew timer: {out.strip()}")
    _, out, _ = sh(ssh, f"certbot certificates 2>/dev/null | grep -A2 'Certificate Name: {DOMAIN}'",
                   check=False)
    log("  " + (out.strip() or "(certbot certificates returned nothing)").replace("\n", "\n  "))
    log("=== TLS DONE ===\n")


def do_verify_tls(ssh) -> None:
    """Probe the live domain end to end, from the server and through Cloudflare."""
    log(f"=== VERIFY TLS ({DOMAIN}) ===")

    _, out, _ = sh(ssh, "ss -lntp 2>/dev/null | grep -E ':(80|443) ' | tr -s ' '", check=False)
    log("  listeners:\n  " + (out.strip() or "(none)").replace("\n", "\n  "))

    # --resolve pins the origin so this tests OUR nginx, not Cloudflare's cache.
    # `Accept: application/json` is not decoration: without it Laravel treats an
    # unauthenticated /api/auth/me as a browser visit, tries to redirect to a
    # `login` route this API does not define, and answers 500. The 401 below is
    # the healthy result, and only the header makes it appear.
    for path, expect in (("/", "200"), ("/api/auth/me", "401"), ("/api/public/track-record", "200")):
        _, out, _ = sh(
            ssh,
            f"curl -s -o /dev/null -w '%{{http_code}}' -k -H 'Accept: application/json' "
            f"--resolve {DOMAIN}:443:127.0.0.1 https://{DOMAIN}{path} || echo ERR",
            check=False,
        )
        code = out.strip()
        log(f"  origin https://{DOMAIN}{path} -> {code} {'OK' if code == expect else f'<-- expected {expect}'}")

    _, out, _ = sh(
        ssh,
        f"curl -s -o /dev/null -w '%{{http_code}} %{{redirect_url}}' --resolve {DOMAIN_WWW}:443:127.0.0.1 "
        f"-k https://{DOMAIN_WWW}/ || echo ERR",
        check=False,
    )
    log(f"  origin https://{DOMAIN_WWW}/ -> {out.strip()}  (expect 301 to https://{DOMAIN}/)")

    # The engine reaches the API over plain http on 127.0.0.1. This is the check
    # that a domain-wide http->https redirect has not crept in and cut that loop:
    # a 301 here means the engine can no longer read its account list.
    _, out, _ = sh(ssh, "curl -s -o /dev/null -w '%{http_code}' "
                        "http://127.0.0.1/api/engine/binance/accounts || echo ERR", check=False)
    code = out.strip()
    log(f"  engine loop http://127.0.0.1/api/engine/binance/accounts -> {code} "
        f"{'OK (reached Laravel)' if code in ('401', '403') else '<-- 301 here means the engine is cut off'}")

    # real_ip only trusts CF-Connecting-IP from Cloudflare's own ranges. Forged
    # from anywhere else it must NOT unlock the localhost-only engine endpoint.
    _, out, _ = sh(ssh, "curl -s -o /dev/null -w '%{http_code}' -H 'CF-Connecting-IP: 127.0.0.1' "
                        f"http://{HOST}/api/engine/binance/accounts || echo ERR", check=False)
    code = out.strip()
    log(f"  forged CF-Connecting-IP from outside -> {code} "
        f"{'OK (denied)' if code == '403' else '<-- real_ip is spoofable, investigate'}")

    _, out, _ = sh(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' https://{DOMAIN}/ || echo ERR",
                   check=False, timeout=90)
    log(f"  through Cloudflare https://{DOMAIN}/ -> {out.strip()}  (522 = edge cannot reach origin)")
    log("")


def do_provision_db(ssh) -> None:
    """Create the MySQL database + user from the 'db' block in deploy.creds.json."""
    db = _C.get("db") or _CREDS.get("db") or {}
    name = db.get("database", "sinegu_crypto")
    user = db.get("user")
    pw = db.get("password")
    if not user or not pw:
        raise SystemExit(
            "[abort] no db credentials. Add to .claude/deploy.creds.json:\n"
            '  "prod": { ..., "db": { "database": "sinegu_crypto", "user": "sinegu", "password": "<pick-one>" } }'
        )
    log(f"=== PROVISION DB '{name}' user '{user}' ===")
    sql = (
        f"CREATE DATABASE IF NOT EXISTS \\`{name}\\` "
        f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; "
        f"CREATE USER IF NOT EXISTS '{user}'@'localhost' IDENTIFIED BY '{pw}'; "
        f"GRANT ALL PRIVILEGES ON \\`{name}\\`.* TO '{user}'@'localhost'; "
        f"FLUSH PRIVILEGES;"
    )
    sh(ssh, f'mysql -e "{sql}"')
    _, out, _ = sh(ssh, "mysql -e 'SHOW DATABASES;'", check=False)
    log("  databases: " + " ".join(out.split()))
    log("=== PROVISION DB DONE ===\n")


ENV_TEMPLATE = """APP_NAME="Pixel Alpha"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL={app_url}
APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US
APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE={db_name}
DB_USERNAME={db_user}
DB_PASSWORD={db_pass}

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

SANCTUM_STATEFUL_DOMAINS={host}
FRONTEND_URL={app_url}

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=database

MAIL_MAILER=log
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_FROM_ADDRESS="noreply@pixel-alpha.com"
MAIL_FROM_NAME="${{APP_NAME}}"
"""


def do_setup_env(ssh) -> None:
    """Create the production .env (if absent) and generate APP_KEY."""
    log(f"=== SETUP .env -> {REMOTE_API}/.env ===")
    _, out, _ = sh(ssh, f"[ -f {REMOTE_API}/artisan ] && echo YES || echo NO", check=False)
    if out.strip() != "YES":
        raise SystemExit("[abort] api/artisan not on the server — run deploy-api first.")

    _, out, _ = sh(ssh, f"[ -f {REMOTE_API}/.env ] && echo PRESENT || echo MISSING", check=False)
    if out.strip() == "PRESENT":
        log("  .env already exists — leaving it untouched (never overwrite prod secrets).")
    else:
        db = _C.get("db") or {}
        if not db.get("user") or not db.get("password"):
            raise SystemExit("[abort] no 'db' block in deploy.creds.json — run provision-db first.")
        # The domain, not the bare IP — APP_URL is what Laravel builds absolute
        # links from, and https is real here as of the certbot run. The IP stays
        # in SANCTUM_STATEFUL_DOMAINS so the box is still reachable by address.
        content = ENV_TEMPLATE.format(
            app_url=f"https://{DOMAIN}", host=f"{DOMAIN},{DOMAIN_WWW},{HOST}",
            db_name=db.get("database", "sinegu_crypto"),
            db_user=db["user"], db_pass=db["password"],
        )
        with _current(ssh).open_sftp() as sftp:
            with sftp.open(f"{REMOTE_API}/.env", "w") as f:
                f.write(content)
        sh(ssh, f"chown www-data:www-data {REMOTE_API}/.env && chmod 640 {REMOTE_API}/.env", check=False)
        log("  .env written (APP_ENV=production, APP_DEBUG=false, DB_* from creds)")

    log("  php artisan key:generate --force ...")
    rc, out, err = sh(ssh, f"cd {REMOTE_API} && php artisan key:generate --force", check=False)
    log("    " + (out or err).strip().replace("\n", "\n    ")[:400])

    _, out, _ = sh(ssh, f"grep -c '^APP_KEY=base64:' {REMOTE_API}/.env || true", check=False)
    log(f"  APP_KEY set: {'yes' if out.strip() == '1' else 'NO — check above'}")
    log("=== SETUP .env DONE ===\n")


def do_backup(ssh) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = f"{REMOTE_BACKUPS}/{ts}"
    log(f"=== BACKUP -> {dest} ===")
    sh(ssh, f"mkdir -p {dest}")
    for name, src in [("dashboard", REMOTE_DASH), ("api", REMOTE_API), ("engine", REMOTE_ENGINE)]:
        _, out, _ = sh(ssh, f"[ -d {src} ] && echo YES || echo NO", check=False)
        if out.strip() != "YES":
            log(f"  {name}: nothing to back up (missing)")
            continue
        log(f"  tar {name} ...")
        sh(ssh, f"tar -czf {dest}/{name}.tar.gz -C {src} "
                f"--exclude=vendor --exclude=node_modules --exclude=storage/logs "
                f"--exclude=.venv --exclude=__pycache__ .",
           timeout=900)
    # keep the .env files separately so a restore is trivial
    sh(ssh, f"[ -f {REMOTE_API}/.env ] && cp {REMOTE_API}/.env {dest}/api.env || true", check=False)
    sh(ssh, f"[ -f {REMOTE_ENGINE}/.env ] && cp {REMOTE_ENGINE}/.env {dest}/engine.env || true", check=False)
    _, out, _ = sh(ssh, f"ls -lh {dest}", check=False)
    log("  " + out.strip().replace("\n", "\n  "))
    # prune to the newest 10 backups
    sh(ssh, f"cd {REMOTE_BACKUPS} && ls -1t | tail -n +11 | xargs -r rm -rf", check=False)
    log(f"=== BACKUP DONE: {dest} ===\n")
    return dest


# ------------------------------------------------------------- database dump

def _remote_env_db(ssh) -> dict:
    """Read DB_* out of the server's own api/.env — the live credentials.

    Read over SFTP rather than `grep`, so a password containing quotes or `$`
    never has to survive a shell round trip.
    """
    try:
        with _current(ssh).open_sftp() as sftp:
            with sftp.open(f"{REMOTE_API}/.env", "r") as f:
                raw = f.read().decode("utf-8", errors="replace")
    except Exception:
        return {}
    out: dict = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line.startswith("DB_") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        out[k.strip()] = v
    return out


def _mysql_cnf(user: str, password: str, host: str, port: str) -> str:
    """A [client] option file. Values are quoted+escaped: MySQL reads a quoted
    value with backslash escapes, so a password holding `#`, a quote or a
    trailing space survives — unquoted, `#` would start a comment."""
    def q(v: str) -> str:
        return '"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return (
        "[client]\n"
        f"user={q(user)}\n"
        f"password={q(password)}\n"
        f"host={q(host or '127.0.0.1')}\n"
        f"port={port or '3306'}\n"
    )


def do_backup_db(ssh) -> str:
    """Dump the whole live database to a gzipped .sql on the server, then pull it down.

    Two things this deliberately does NOT do:
      * put the password on a command line — `ps aux` is world-readable, so the
        credentials go in a 0600 option file (or nothing at all, when root's
        unix-socket auth works, which is the normal path on this box).
      * trust the exit code alone — gzip would happily seal a half-written dump.
        The dump is only accepted once `gzip -t` passes AND the last line reads
        `-- Dump completed`, which mysqldump writes only after the final table.
    """
    log("=== BACKUP DB ===")

    rc, out, _ = sh(ssh, "command -v mysqldump || echo MISSING", check=False)
    if "MISSING" in out or not out.strip():
        raise SystemExit(
            "[abort] mysqldump not installed on the server.\n"
            "        apt-get install -y mysql-client   (or mysql-server, which bundles it)"
        )

    env = _remote_env_db(ssh)
    db_name = env.get("DB_DATABASE") or (_C.get("db") or {}).get("database") or "sinegu_crypto"

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = f"{REMOTE_DB_BACKUPS}/{db_name}_{ts}.sql.gz"
    cnf = "/root/.sinegu_dump.cnf"
    sh(ssh, f"mkdir -p {REMOTE_DB_BACKUPS} && chmod 700 {REMOTE_DB_BACKUPS}")

    # --single-transaction: a consistent snapshot without locking the tables, so
    #   the engine keeps writing positions while the dump runs.
    # --no-tablespaces: avoids needing the PROCESS privilege.
    # --routines/--triggers/--events: a "whole" backup includes the schema's logic.
    # --databases: emits CREATE DATABASE + USE, so the file restores on its own.
    flags = ("--single-transaction --quick --routines --triggers --events "
             "--hex-blob --no-tablespaces --default-character-set=utf8mb4 "
             "--skip-lock-tables")

    # Preferred path: root over the unix socket — no password exists to leak.
    # provision-db already relies on this working.
    log(f"  dumping '{db_name}' (root/socket) ...")
    rc, _, err = sh(
        ssh,
        f"set -o pipefail; mysqldump {flags} --databases {db_name} | gzip -9 > {dest}",
        check=False, timeout=1800,
    )
    used = "root/socket"

    if rc != 0:
        log(f"    root/socket failed (rc={rc}): {err.strip().splitlines()[-1][:160] if err.strip() else 'no stderr'}")
        user = env.get("DB_USERNAME") or (_C.get("db") or {}).get("user")
        pw = env.get("DB_PASSWORD") or (_C.get("db") or {}).get("password")
        if not user or not pw:
            sh(ssh, f"rm -f {dest}", check=False)
            raise SystemExit(
                "[abort] root/socket mysqldump failed and no DB_USERNAME/DB_PASSWORD found\n"
                f"        in {REMOTE_API}/.env or the 'db' block of deploy.creds.json."
            )
        log(f"    retrying as '{user}' via a 0600 option file ...")
        with _current(ssh).open_sftp() as sftp:
            with sftp.open(cnf, "w") as f:
                f.write(_mysql_cnf(user, pw, env.get("DB_HOST", ""), env.get("DB_PORT", "")))
        sh(ssh, f"chmod 600 {cnf}")
        try:
            rc, _, err = sh(
                ssh,
                f"set -o pipefail; mysqldump --defaults-extra-file={cnf} {flags} "
                f"--databases {db_name} | gzip -9 > {dest}",
                check=False, timeout=1800,
            )
        finally:
            sh(ssh, f"rm -f {cnf}", check=False)
        used = f"{user}/tcp"
        if rc != 0:
            sh(ssh, f"rm -f {dest}", check=False)
            raise SystemExit(f"[abort] mysqldump failed (rc={rc}):\n{err.strip()[:1200]}")

    # The dump must be readable only by root — it holds every secret_key and
    # password hash in the product.
    sh(ssh, f"chmod 600 {dest}", check=False)

    # --- integrity, not just exit status ---
    rc, _, _ = sh(ssh, f"gzip -t {dest}", check=False)
    if rc != 0:
        raise SystemExit(f"[abort] the gzip archive is corrupt: {dest}")
    _, tail, _ = sh(ssh, f"gunzip -c {dest} | tail -c 200", check=False, timeout=600)
    if "Dump completed" not in tail:
        raise SystemExit(
            f"[abort] {dest} is TRUNCATED — no '-- Dump completed' trailer.\n"
            "        Treat it as unusable; do not rely on it as a backup."
        )

    _, out, _ = sh(ssh, f"gunzip -c {dest} | grep -c '^CREATE TABLE' || true", check=False, timeout=600)
    tables = out.strip() or "?"
    _, out, _ = sh(ssh, f"stat -c '%s' {dest}", check=False)
    size = int(out.strip() or 0)
    log(f"  ok via {used}: {tables} tables, {size / 1048576:.2f} MB compressed")

    # prune, newest N kept
    sh(ssh, f"cd {REMOTE_DB_BACKUPS} && ls -1t *.sql.gz 2>/dev/null | tail -n +{DB_BACKUP_KEEP + 1} "
            f"| xargs -r rm -f", check=False)
    _, out, _ = sh(ssh, f"ls -lh {REMOTE_DB_BACKUPS}", check=False)
    log("  " + out.strip().replace("\n", "\n  "))

    if "--no-download" in sys.argv:
        log(f"=== BACKUP DB DONE (server-side only): {dest} ===\n")
        return dest

    # A backup that lives only on the machine it backs up is not a backup.
    os.makedirs(LOCAL_DB_BACKUPS, exist_ok=True)
    local_path = os.path.join(LOCAL_DB_BACKUPS, os.path.basename(dest))
    log(f"  downloading -> {local_path}")
    with _current(ssh).open_sftp() as sftp:
        sftp.get(dest, local_path)
    got = os.path.getsize(local_path)
    if got != size:
        os.remove(local_path)
        raise SystemExit(f"[abort] short download: got {got} bytes, expected {size}. Local copy removed.")
    log(f"  local copy verified: {got / 1048576:.2f} MB")
    log("  NOTE: this file contains every API secret_key and password hash — keep it off shared drives.")
    log(f"=== BACKUP DB DONE: {local_path} ===\n")
    return local_path


def do_deploy_dash(ssh):
    if not os.path.isdir(LOCAL_DIST):
        sys.exit(f"[abort] local dist not found: {LOCAL_DIST} (run `npm run build` first)")
    if not os.path.isfile(os.path.join(LOCAL_DIST, "index.html")):
        sys.exit(f"[abort] {LOCAL_DIST}\\index.html missing — build looks incomplete")
    log(f"=== DEPLOY dashboard -> {REMOTE_DASH} ===")
    ssh = _deploy_via_tgz(
        ssh, LOCAL_DIST, REMOTE_DASH, mode="dash", name="sinegu_dash.tar.gz",
        # drop stale hashed chunks so old assets don't linger
        pre_sync=[f"rm -rf {REMOTE_DASH}/assets"],
    )
    do_verify_dash(ssh)
    log("=== DEPLOY dashboard DONE ===\n")
    return ssh


def do_deploy_api(ssh):
    if not os.path.isdir(LOCAL_API):
        sys.exit(f"[abort] local api not found: {LOCAL_API}")
    log(f"=== DEPLOY api -> {REMOTE_API} (.env/storage/vendor preserved) ===")
    ssh = _deploy_via_tgz(
        ssh, LOCAL_API, REMOTE_API, mode="api", name="sinegu_api.tar.gz",
        rsync_extra=[".env", "storage", "vendor", "bootstrap/cache", "public/storage"],
    )

    # --no-scripts: composer's post-autoload-dump runs `artisan package:discover`,
    # which boots Laravel and therefore needs a .env + APP_KEY. On a first deploy
    # that doesn't exist yet, and `key:generate` in turn needs vendor/ — circular.
    # Install dependencies without scripts, then run discovery once .env is in place.
    log("  composer install --no-dev --no-scripts ...")
    sh(ssh, f"cd {REMOTE_API} && COMPOSER_ALLOW_SUPERUSER=1 composer install "
            f"--no-dev --optimize-autoloader --no-interaction --no-scripts", timeout=1200)

    log("  ensuring storage/bootstrap dirs + permissions ...")
    sh(ssh, f"mkdir -p {REMOTE_API}/storage/framework/{{cache,sessions,views}} "
            f"{REMOTE_API}/storage/logs {REMOTE_API}/bootstrap/cache && "
            f"chown -R www-data:www-data {REMOTE_API}/storage {REMOTE_API}/bootstrap/cache && "
            f"chmod -R 775 {REMOTE_API}/storage {REMOTE_API}/bootstrap/cache", check=False)

    rc, out, _ = sh(ssh, f"[ -f {REMOTE_API}/.env ] && echo PRESENT || echo MISSING", check=False)
    if out.strip() != "PRESENT":
        log("  ! .env MISSING on server — skipping discovery/migrate/config:cache.")
        log("    Run:  python .claude/deploy_sinegualcrypto.py setup-env")
        log("    then re-run deploy-api.")
        log("=== DEPLOY api DONE (incomplete: no .env) ===\n")
        return ssh

    log("  php artisan package:discover ...")
    sh(ssh, f"cd {REMOTE_API} && php artisan package:discover --ansi", check=False)

    log("  php artisan migrate --force ...")
    rc, out, err = sh(ssh, f"cd {REMOTE_API} && php artisan migrate --force", check=False, timeout=600)
    log("    " + (out or err).strip().replace("\n", "\n    ")[:800])

    log("  php artisan config:cache / route:cache ...")
    sh(ssh, f"cd {REMOTE_API} && php artisan config:cache && php artisan route:cache && "
            f"php artisan storage:link", check=False)
    # artisan ran as root, so the cache files are root-owned; hand them back or
    # the admin "Clear caches" button (running as www-data) cannot rewrite them.
    sh(ssh, f"chown -R www-data:www-data {REMOTE_API}/bootstrap/cache", check=False)
    sh(ssh, "systemctl reload php8.3-fpm nginx", check=False)

    log("  post-deploy .env -> PRESENT")
    log("=== DEPLOY api DONE ===\n")
    return ssh


ENGINE_SYSTEMD_UNIT = f"""[Unit]
Description=Pixel Alpha BINANCE_ABCD trading engine (waitress :5010)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory={REMOTE_ENGINE}
EnvironmentFile=-{REMOTE_ENGINE}/.env
Environment=PYTHONUNBUFFERED=1
ExecStart={REMOTE_ENGINE}/.venv/bin/python -m binance_abcd.main
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""


# --- pixel-telegram: two oneshot jobs + their timers --------------------------
# Oneshot rather than a daemon: each run collects, posts if there is anything to
# say, and exits — there is no long-lived process to babysit, and a failure is
# one unit in `failed` state instead of a silent hang.
def _telegram_unit(mode: str, description: str) -> str:
    return f"""[Unit]
Description={description}
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory={REMOTE_TELEGRAM}
Environment=PYTHONUNBUFFERED=1
ExecStart={REMOTE_TELEGRAM}/.venv/bin/python -m pixel_telegram.main {mode}
"""


# Persistent=true so a 4-hour tick missed while the box was down fires on boot
# instead of being skipped — the report after an outage is the one that matters.
TELEGRAM_TIMER = f"""[Unit]
Description=Pixel Alpha VPS resource report every 4 hours

[Timer]
OnCalendar=00/4:00
Persistent=true
Unit={TELEGRAM_SERVICE}.service

[Install]
WantedBy=timers.target
"""

TELEGRAM_WATCH_TIMER = f"""[Unit]
Description=Pixel Alpha service restart / threshold watch

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
Unit={TELEGRAM_SERVICE}-watch.service

[Install]
WantedBy=timers.target
"""

# pixel-telegram .env keys mirrored from the local pixel-telegram/.env, for the
# same reason as MIRRORED_ENGINE_ENV_KEYS: they name the PRODUCT's bot and the
# group it reports to, so prod differing from local is always a mistake.
MIRRORED_TELEGRAM_ENV_KEYS = (
    "PIXEL_TG_ENABLED",
    "PIXEL_TG_BOT_TOKEN",
    "PIXEL_TG_CHAT_ID",
    "PIXEL_TG_UNITS",
    "PIXEL_TG_VPS_NAME",
)


def _local_env_value(path: str, key: str) -> str:
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return ""


def _remote_env_value(ssh, path: str, key: str) -> str:
    _, out, _ = sh(ssh, f"grep -E '^{key}=' {path} 2>/dev/null | tail -1", check=False)
    line = out.strip()
    return line.split("=", 1)[1].strip().strip('"').strip("'") if "=" in line else ""


# Engine .env keys whose value is the SAME everywhere and is therefore copied
# from the local trading-flask/.env on every engine deploy. These describe the
# PRODUCT (which TradingView token, which Telegram channel), so prod drifting
# from local is always a mistake — that drift is why prod posted nothing to
# Telegram while local did.
MIRRORED_ENGINE_ENV_KEYS = (
    "BINANCE_ABCD_WEBHOOK_SECRET",
    "BINANCE_ABCD_TELEGRAM_ENABLED",
    "BINANCE_ABCD_TELEGRAM_BOT_TOKEN",
    "BINANCE_ABCD_TELEGRAM_CHAT_ID",
    "BINANCE_ABCD_TELEGRAM_ADMIN_CHAT_ID",
    # The Discord mirror of the PUBLIC messages. Same category as the Telegram
    # keys — WHICH channel the trades are announced in is the product — and the
    # URL is a credential (its last segment is the webhook token), which is why
    # it lives in the gitignored .env and reaches prod only through this upsert.
    "BINANCE_ABCD_DISCORD_ENABLED",
    "BINANCE_ABCD_DISCORD_WEBHOOK_URL",
    # The scheduled recap timetable. Same category: WHEN the public channel gets
    # its daily/weekly/monthly report is a product decision, not a property of
    # the box, so prod running a different schedule from local is a mistake.
    "BINANCE_ABCD_REPORT_ENABLED",
    "BINANCE_ABCD_REPORT_TIMEZONE",
    "BINANCE_ABCD_REPORT_DAILY_AT",
    "BINANCE_ABCD_REPORT_WEEKLY_AT",
    "BINANCE_ABCD_REPORT_MONTHLY_AT",
    # MEXC trading rules — how a NEW position is margined and what leverage an
    # entry falls back to. Product decisions like the recap timetable: prod
    # opening cross-margin positions while local opens isolated is a mistake.
    "BINANCE_ABCD_MEXC_OPEN_TYPE",
    "BINANCE_ABCD_MEXC_DEFAULT_LEVERAGE",
)

# Deliberately NOT mirrored — these describe the BOX, not the product, and
# copying them from a dev machine would break prod:
#   BINANCE_ABCD_ENGINE_API_BASE   local points at WAMP, prod at nginx :80
#   BINANCE_ABCD_ENGINE_SECRET     must match prod api/.env, not the dev one
#   BINANCE_ABCD_FLASK_PORT / _RUN_POLLERS / _SYNC_POSITION_MODE_ON_STARTUP
#   BINANCE_ABCD_EXCHANGES         which venues prod TRADES. Turning MEXC on for
#                                  real customers is a decision someone makes on
#                                  the box (after the real-key smoke checks), not
#                                  a side effect of a local .env that has it on
#                                  for development.
#   BINANCE_ABCD_MEXC_RECV_WINDOW  clock tolerance — a property of the box's NTP
#   BINANCE_ABCD_MEXC_API_BASE     the default is right everywhere


def _sync_mirrored_engine_env(ssh) -> None:
    """Copy MIRRORED_ENGINE_ENV_KEYS from local trading-flask/.env into prod.

    Upsert per key (delete the line, append the new one) rather than sed
    substitution: a bot token is arbitrary text and would otherwise have to be
    escaped against the delimiter. Only key NAMES are ever logged — a deploy
    transcript must not become a place secrets are written down.
    """
    import shlex

    local_env = os.path.join(LOCAL_ENGINE, ".env")
    changed, missing = [], []

    for key in MIRRORED_ENGINE_ENV_KEYS:
        value = _local_env_value(local_env, key)
        if not value:
            missing.append(key)
            continue
        if _remote_env_value(ssh, f"{REMOTE_ENGINE}/.env", key) == value:
            continue
        line = shlex.quote(f"{key}={value}")
        sh(ssh, f"sed -i '/^{key}=/d' {REMOTE_ENGINE}/.env && "
                f"printf '%s\\n' {line} >> {REMOTE_ENGINE}/.env")
        changed.append(key)

    if changed:
        log("  engine/.env: mirrored from local -> " + ", ".join(changed))
    if missing:
        # Not fatal: Telegram and Discord are optional, and a missing token or
        # webhook URL simply means that channel stays quiet (notify.py is off
        # unless token AND chat id exist; discord_notify.py unless the URL is).
        # The flip side: local .env is the source of truth, so a local
        # *_ENABLED=false is mirrored too and silences prod.
        log("  engine/.env: not set locally, skipped -> " + ", ".join(missing))
    if not changed and not missing:
        log("  engine/.env: mirrored keys already match local")


# api/.env keys whose value is the SAME on every machine: they identify the
# PRODUCT's Coinsbuy merchant account, not the box it runs on. Mirrored from the
# local sinegutrade-api/.env for the same reason as MIRRORED_ENGINE_ENV_KEYS —
# except here prod did not merely DRIFT, it had nothing at all: ENV_TEMPLATE
# never wrote a payment key and setup-env refuses to touch an existing .env, so
# every trader's pay button answered COINSBUY_NOT_CONFIGURED.
MIRRORED_API_ENV_KEYS = (
    "COINSBUY_API_KEY",
    "COINSBUY_API_SECRET",
    "COINSBUY_WEBHOOK_SECRET",
    "COINSBUY_BASE_URL",
    "COINSBUY_USD_WALLET_ID",
    "COINSBUY_API_KEY_SANDBOX",
    "COINSBUY_API_SECRET_SANDBOX",
    "COINSBUY_WEBHOOK_SECRET_SANDBOX",
    "COINSBUY_BASE_URL_SANDBOX",
    "COINSBUY_USD_WALLET_ID_SANDBOX",
    # The TRON receiving wallets and token contracts. Same category: they say
    # WHICH WALLET IS OURS, not which machine is asking, so prod differing from
    # local is always a mistake — and a prod address that drifted from local is
    # money landing somewhere we are not watching.
    #
    # Deliberately NOT mirrored, for two different reasons:
    #   TRON_PUBLIC / PAYMENTS_DEFAULT_PROVIDER — rollout state, not identity.
    #     Mirroring them would mean a local experiment flips the live default on
    #     the next deploy. Set those ON PROD, deliberately, when you mean it.
    #   TRON_CACERT — describes the BOX. It exists because WAMP ships no CA
    #     bundle; Ubuntu has one, and copying a C:\ path here would break TLS
    #     rather than fix it.
    "TRON_MAINNET_ADDRESS",
    "TRON_MAINNET_USDT_CONTRACT",
    "TRON_NILE_ADDRESS",
    "TRON_NILE_USDT_CONTRACT",
    # "Sign in with Discord" + the server-roles bot. The OAuth app, the bot,
    # the server and its role ids identify the PRODUCT's Discord presence —
    # the same app is registered once for every origin, which is why the
    # redirect allow-list is mirrored too (it lists prod AND localhost).
    #
    # Deliberately NOT mirrored:
    #   DISCORD_LOGIN_PUBLIC — rollout state (whether /auth SHOWS the button).
    #     Same rule as TRON_PUBLIC: set it on the box when you mean it.
    #   DISCORD_CACERT — describes the BOX, like TRON_CACERT.
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_REDIRECT_URIS",
    "DISCORD_BOT_TOKEN",
    "DISCORD_GUILD_ID",
    "DISCORD_ROLE_MEMBER_ID",
    "DISCORD_ROLE_TRADER_ID",
)

# Written with PROD values, never mirrored — these describe the BOX. Locally
# they resolve to localhost:5173 / 127.0.0.1:8000, and copying that here would
# send every success redirect and every provider callback to a machine that does
# not exist on the internet.
#
# PAYMENTS_API_URL is also the live-key gate: PaymentEnvironment holds BOTH
# providers on test credentials while the callback base is plaintext, so making
# this https is exactly what promotes Coinsbuy to its production key set. It is
# the last step of going live, not a URL tidy-up.
PROD_PAYMENT_ENV = {
    "PAYMENTS_FRONTEND_URL": f"https://{DOMAIN}",
    "PAYMENTS_API_URL": f"https://{DOMAIN}/api",
    "PAYMENTS_LIVE_HOSTS": f"{DOMAIN},{DOMAIN_WWW},{HOST}",
}


def _upsert_remote_env(ssh, path: str, key: str, value: str) -> None:
    """Replace (or append) one KEY=value line, passing the value as one shell word.

    Delete-then-append rather than `sed s|old|new|`: a Coinsbuy webhook secret is
    base64 and contains '/' and '=', which collides with any sed delimiter.
    """
    import shlex

    line = shlex.quote(f"{key}={value}")
    sh(ssh, f"sed -i '/^{key}=/d' {path} && printf '%s\\n' {line} >> {path}")


def _sync_payment_env(ssh) -> None:
    """Give prod the product credentials (Coinsbuy, TRON, Discord) and its own payment URLs.

    Only key NAMES are logged for the mirrored secrets — a deploy transcript must
    not become a place secrets are written down. The URL keys log their value,
    because that value IS the thing being verified.
    """
    local_env = os.path.join(LOCAL_API, ".env")
    if not os.path.isfile(local_env):
        sys.exit(f"[abort] no local .env at {local_env} to mirror payment keys from")

    changed, missing = [], []

    for key in MIRRORED_API_ENV_KEYS:
        value = _local_env_value(local_env, key)
        if not value:
            missing.append(key)
            continue
        if _remote_env_value(ssh, f"{REMOTE_API}/.env", key) == value:
            continue
        _upsert_remote_env(ssh, f"{REMOTE_API}/.env", key, value)
        changed.append(key)

    if changed:
        log("  api/.env: mirrored from local -> " + ", ".join(changed))
    if missing:
        log("  api/.env: not set locally, skipped -> " + ", ".join(missing))
    if not changed and not missing:
        log("  api/.env: mirrored keys (Coinsbuy, TRON, Discord) already match local")

    for key, value in PROD_PAYMENT_ENV.items():
        if _remote_env_value(ssh, f"{REMOTE_API}/.env", key) == value:
            log(f"  api/.env: {key} already {value}")
            continue
        _upsert_remote_env(ssh, f"{REMOTE_API}/.env", key, value)
        log(f"  api/.env: {key} -> {value}")


def _ensure_engine_secrets(ssh) -> None:
    """Make api/.env ENGINE_SECRET and engine/.env agree; create engine/.env if absent.

    The webhook secret is copied from the LOCAL trading-flask/.env so URLs the
    user already pasted into TradingView keep working. The engine<->API secret
    prefers whatever prod api/.env already has, else generates a fresh one.
    Existing server files are edited line-wise, never rewritten.
    """
    import secrets as pysecrets

    webhook_secret = _local_env_value(os.path.join(LOCAL_ENGINE, ".env"), "BINANCE_ABCD_WEBHOOK_SECRET")
    if not webhook_secret:
        sys.exit("[abort] BINANCE_ABCD_WEBHOOK_SECRET missing in local trading-flask/.env")

    api_secret = _remote_env_value(ssh, f"{REMOTE_API}/.env", "ENGINE_SECRET")
    engine_env_secret = _remote_env_value(ssh, f"{REMOTE_ENGINE}/.env", "BINANCE_ABCD_ENGINE_SECRET")
    engine_secret = api_secret or engine_env_secret or pysecrets.token_urlsafe(32)

    if not api_secret:
        log("  api/.env: appending ENGINE_SECRET ...")
        sh(ssh, f"printf '\\nENGINE_SECRET={engine_secret}\\n' >> {REMOTE_API}/.env", timeout=120)

    # The API also needs the engine's WEBHOOK secret: the manual-trade console
    # signs proxied webhooks with it, and the admin cache flush uses it as
    # X-Admin-Secret to refresh the engine's account/asset caches.
    api_hook = _remote_env_value(ssh, f"{REMOTE_API}/.env", "BINANCE_ENGINE_WEBHOOK_SECRET")
    if api_hook != webhook_secret:
        log("  api/.env: syncing BINANCE_ENGINE_WEBHOOK_SECRET with the engine ...")
        sh(ssh, f"grep -q '^BINANCE_ENGINE_WEBHOOK_SECRET=' {REMOTE_API}/.env && "
                f"sed -i 's|^BINANCE_ENGINE_WEBHOOK_SECRET=.*|BINANCE_ENGINE_WEBHOOK_SECRET={webhook_secret}|' "
                f"{REMOTE_API}/.env || "
                f"printf 'BINANCE_ENGINE_WEBHOOK_SECRET={webhook_secret}\\n' >> {REMOTE_API}/.env")

    log("  api/.env: config:cache ...")
    sh(ssh, f"cd {REMOTE_API} && php artisan config:cache && "
            f"chown -R www-data:www-data {REMOTE_API}/bootstrap/cache", timeout=120)

    rc, out, _ = sh(ssh, f"[ -f {REMOTE_ENGINE}/.env ] && echo PRESENT || echo MISSING", check=False)
    if out.strip() != "PRESENT":
        log("  engine/.env: creating (prod defaults; pollers ON, startup sync OFF) ...")
        env_body = (
            "# Pixel Alpha BINANCE_ABCD engine — PROD\n"
            "# Generated by deploy-engine; lives only on the server, never overwritten by deploys.\n"
            f"BINANCE_ABCD_WEBHOOK_SECRET={webhook_secret}\n"
            f"BINANCE_ABCD_ENGINE_SECRET={engine_secret}\n"
            "BINANCE_ABCD_ENGINE_API_BASE=http://127.0.0.1/api\n"
            "BINANCE_ABCD_FLASK_PORT=5010\n"
            "BINANCE_ABCD_RUN_POLLERS=true\n"
            "BINANCE_ABCD_SYNC_POSITION_MODE_ON_STARTUP=false\n"
        )
        with _current(ssh).open_sftp() as sftp:
            with sftp.open(f"{REMOTE_ENGINE}/.env", "w") as f:
                f.write(env_body)
        sh(ssh, f"chmod 600 {REMOTE_ENGINE}/.env", check=False)
    elif engine_env_secret != engine_secret:
        log("  engine/.env: aligning BINANCE_ABCD_ENGINE_SECRET with api/.env ...")
        sh(ssh, f"grep -q '^BINANCE_ABCD_ENGINE_SECRET=' {REMOTE_ENGINE}/.env && "
                f"sed -i 's|^BINANCE_ABCD_ENGINE_SECRET=.*|BINANCE_ABCD_ENGINE_SECRET={engine_secret}|' "
                f"{REMOTE_ENGINE}/.env || "
                f"printf 'BINANCE_ABCD_ENGINE_SECRET={engine_secret}\\n' >> {REMOTE_ENGINE}/.env")

    # Runs whether the file was just created or already existed: the point is
    # that prod ends up carrying the local values for these keys, every time.
    _sync_mirrored_engine_env(ssh)


def do_deploy_engine(ssh):
    if not os.path.isfile(os.path.join(LOCAL_ENGINE, "binance_abcd", "main.py")):
        sys.exit(f"[abort] engine source not found: {LOCAL_ENGINE}\\binance_abcd\\main.py")

    log("  running engine tests locally (gate) ...")
    import subprocess
    r = subprocess.run([sys.executable, "-m", "pytest", "tests", "-q"],
                       cwd=LOCAL_ENGINE, capture_output=True, text=True)
    if r.returncode != 0:
        tail = (r.stdout or r.stderr or "").strip().splitlines()[-15:]
        sys.exit("[abort] engine tests FAILED — not deploying:\n  " + "\n  ".join(tail))
    log("  tests green: " + (r.stdout.strip().splitlines()[-1] if r.stdout.strip() else "ok"))

    log(f"=== DEPLOY engine -> {REMOTE_ENGINE} (.env/.venv preserved) ===")
    ssh = _deploy_via_tgz(
        ssh, LOCAL_ENGINE, REMOTE_ENGINE, mode="engine", name="sinegu_engine.tar.gz",
        rsync_extra=[".env", ".venv", "out"],
    )

    log("  python venv + deps ...")
    sh(ssh, "dpkg -s python3-venv >/dev/null 2>&1 || "
            "DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv", timeout=600)
    sh(ssh, f"cd {REMOTE_ENGINE} && [ -d .venv ] || python3 -m venv .venv", timeout=300)
    sh(ssh, f"cd {REMOTE_ENGINE} && .venv/bin/pip install -q --disable-pip-version-check "
            f"-r requirements.txt", timeout=900)
    sh(ssh, f"mkdir -p {REMOTE_ENGINE}/out", check=False)

    _ensure_engine_secrets(ssh)

    log("  systemd unit + nginx route ...")
    with _current(ssh).open_sftp() as sftp:
        with sftp.open(f"/etc/systemd/system/{ENGINE_SERVICE}.service", "w") as f:
            f.write(ENGINE_SYSTEMD_UNIT)
    sh(ssh, f"systemctl daemon-reload && systemctl enable {ENGINE_SERVICE}")

    # Admin "Bot Engine" page: php-fpm (www-data) may restart THIS unit only,
    # and may read the journal. Both idempotent; visudo -c validates the rule.
    log("  www-data ops privileges (sudoers restart rule + journal group) ...")
    sh(ssh, f"printf 'www-data ALL=(root) NOPASSWD: /usr/bin/systemctl restart {ENGINE_SERVICE}\\n' "
            f"> /etc/sudoers.d/{ENGINE_SERVICE} && chmod 440 /etc/sudoers.d/{ENGINE_SERVICE} && visudo -c -q")
    sh(ssh, "id -nG www-data | grep -qw systemd-journal || "
            "(usermod -aG systemd-journal www-data && systemctl restart php8.3-fpm)")
    do_deploy_nginx(ssh)
    sh(ssh, f"systemctl restart {ENGINE_SERVICE}")

    do_verify_engine(ssh)
    log("=== DEPLOY engine DONE ===\n")
    return ssh


def _sync_telegram_env(ssh) -> None:
    """Copy MIRRORED_TELEGRAM_ENV_KEYS from local pixel-telegram/.env into prod.

    Same upsert-per-key shape as _sync_mirrored_engine_env, and the same rule:
    only key NAMES are logged, never values — a deploy transcript must not
    become a place the bot token is written down.
    """
    import shlex

    local_env = os.path.join(LOCAL_TELEGRAM, ".env")
    if not os.path.isfile(local_env):
        log(f"  ! {local_env} not found — create it from .env.example "
            f"(the group will stay silent until PIXEL_TG_CHAT_ID is set)")
        return

    sh(ssh, f"touch {REMOTE_TELEGRAM}/.env")
    changed, missing = [], []
    for key in MIRRORED_TELEGRAM_ENV_KEYS:
        value = _local_env_value(local_env, key)
        if not value:
            missing.append(key)
            continue
        if _remote_env_value(ssh, f"{REMOTE_TELEGRAM}/.env", key) == value:
            continue
        line = shlex.quote(f"{key}={value}")
        sh(ssh, f"sed -i '/^{key}=/d' {REMOTE_TELEGRAM}/.env && "
                f"printf '%s\\n' {line} >> {REMOTE_TELEGRAM}/.env")
        changed.append(key)

    if changed:
        log("  telegram/.env: mirrored from local -> " + ", ".join(changed))
    if missing:
        # Not fatal — pixel_telegram.telegram.send() is a no-op without a token
        # and chat id, so an unconfigured box logs a warning instead of failing.
        log("  telegram/.env: not set locally, skipped -> " + ", ".join(missing))
    if not changed and not missing:
        log("  telegram/.env: mirrored keys already match local")


def do_deploy_telegram(ssh):
    """Deploy pixel-telegram (VPS ops alerts) + its two systemd timers."""
    if not os.path.isfile(os.path.join(LOCAL_TELEGRAM, "pixel_telegram", "main.py")):
        sys.exit(f"[abort] pixel-telegram source not found: {LOCAL_TELEGRAM}")

    log("  running pixel-telegram tests locally (gate) ...")
    import subprocess
    r = subprocess.run([sys.executable, "-m", "pytest", "tests", "-q"],
                       cwd=LOCAL_TELEGRAM, capture_output=True, text=True)
    if r.returncode != 0:
        tail = (r.stdout or r.stderr or "").strip().splitlines()[-15:]
        sys.exit("[abort] pixel-telegram tests FAILED — not deploying:\n  " + "\n  ".join(tail))
    log("  tests green: " + (r.stdout.strip().splitlines()[-1] if r.stdout.strip() else "ok"))

    log(f"=== DEPLOY pixel-telegram -> {REMOTE_TELEGRAM} (.env/.venv/state preserved) ===")
    ssh = _deploy_via_tgz(
        ssh, LOCAL_TELEGRAM, REMOTE_TELEGRAM, mode="telegram", name="pixel_telegram.tar.gz",
        rsync_extra=[".env", ".venv", "state"],
    )

    log("  python venv + deps ...")
    sh(ssh, f"cd {REMOTE_TELEGRAM} && [ -d .venv ] || python3 -m venv .venv", timeout=300)
    sh(ssh, f"cd {REMOTE_TELEGRAM} && .venv/bin/pip install -q --disable-pip-version-check "
            f"-r requirements.txt", timeout=900)
    sh(ssh, f"mkdir -p {REMOTE_TELEGRAM}/state", check=False)

    _sync_telegram_env(ssh)

    # The php-fpm unit carries the PHP version in its name, so report what is
    # actually installed rather than letting a stale default watch a unit that
    # does not exist (which reads as "not readable" forever, not as an error).
    _, out, _ = sh(ssh, "systemctl list-units --type=service --all --no-legend 'php*-fpm*' "
                        "| awk '{print $1}' | head -3", check=False)
    if out.strip():
        log("  php-fpm unit(s) on this box: " + out.strip().replace("\n", ", "))

    log("  systemd units + timers ...")
    with _current(ssh).open_sftp() as sftp:
        units = {
            f"{TELEGRAM_SERVICE}.service":
                _telegram_unit("report", "Pixel Alpha VPS resource report"),
            f"{TELEGRAM_SERVICE}-watch.service":
                _telegram_unit("watch", "Pixel Alpha service restart / threshold watch"),
            f"{TELEGRAM_SERVICE}.timer": TELEGRAM_TIMER,
            f"{TELEGRAM_SERVICE}-watch.timer": TELEGRAM_WATCH_TIMER,
        }
        for filename, body in units.items():
            with sftp.open(f"/etc/systemd/system/{filename}", "w") as f:
                f.write(body)
    sh(ssh, f"systemctl daemon-reload && "
            f"systemctl enable --now {TELEGRAM_SERVICE}.timer {TELEGRAM_SERVICE}-watch.timer")

    # Seed the state file before anything can alert: the first watch run records
    # every unit as seen and stays silent, so the deploy does not announce the
    # whole box as freshly restarted.
    log("  seeding watch state (first run is silent by design) ...")
    sh(ssh, f"systemctl start {TELEGRAM_SERVICE}-watch.service", check=False, timeout=120)

    do_verify_telegram(ssh)
    log("=== DEPLOY pixel-telegram DONE ===\n")
    return ssh


def do_sync_telegram_env(ssh):
    """Re-sync telegram/.env from local — config only, no code, no test gate.

    This is the command that goes with pasting the group's chat id in.
    """
    log(f"=== SYNC pixel-telegram env -> {REMOTE_TELEGRAM}/.env ===")
    _sync_telegram_env(ssh)
    do_verify_telegram(ssh)
    return ssh


def do_verify_telegram(ssh) -> None:
    log("=== VERIFY pixel-telegram ===")
    _, out, _ = sh(ssh, f"systemctl list-timers --no-legend --all '{TELEGRAM_SERVICE}*' "
                        f"| awk '{{print $NF, \"next:\", $1, $2, $3}}'", check=False)
    log("  timers:\n    " + (out.strip().replace("\n", "\n    ") or "(none — not enabled)"))

    for key in ("PIXEL_TG_BOT_TOKEN", "PIXEL_TG_CHAT_ID"):
        present = "SET" if _remote_env_value(ssh, f"{REMOTE_TELEGRAM}/.env", key) else "MISSING"
        log(f"  {key}: {present}")

    _, out, _ = sh(ssh, f"journalctl -u {TELEGRAM_SERVICE} -u {TELEGRAM_SERVICE}-watch "
                        f"-n 8 --no-pager -o cat", check=False)
    log("  --- recent log ---\n  " + (out.strip().replace("\n", "\n  ") or "(no entries yet)") + "\n")


def do_verify_engine(ssh) -> None:
    log("=== VERIFY engine ===")
    _, out, _ = sh(ssh, f"systemctl is-active {ENGINE_SERVICE}", check=False)
    state = out.strip()
    log(f"  systemd: {state}")
    if state != "active":
        _, jout, _ = sh(ssh, f"journalctl -u {ENGINE_SERVICE} -n 25 --no-pager", check=False)
        log("  --- journal tail ---\n  " + jout.strip().replace("\n", "\n  "))
        return

    _, out, _ = sh(ssh, "sleep 3; curl -s -m 8 http://127.0.0.1:5010/health | head -c 300", check=False)
    log(f"  /health: {out.strip()[:300] or '(no response yet)'}")

    log("  public webhook gates (empty POST should be rejected, not 404) ...")
    for path in ENGINE_WEBHOOK_PATHS:
        _, out, _ = sh(ssh, "curl -s -m 8 -o /dev/null -w '%{http_code}' -X POST "
                            "-H 'Content-Type: application/json' -d '{}' "
                            f"http://127.0.0.1{path}", check=False)
        code = out.strip()
        log(f"    {path} -> {code} {'OK (secret gate)' if code == '403' else '<-- expected 403'}")

    log("  engine -> Laravel auth (accounts endpoint with engine secret) ...")
    _, out, _ = sh(ssh, f"S=$(grep -E '^BINANCE_ABCD_ENGINE_SECRET=' {REMOTE_ENGINE}/.env | cut -d= -f2-); "
                        f"curl -s -m 8 -o /dev/null -w '%{{http_code}}' "
                        f"-H \"X-Engine-Secret: $S\" -H 'Accept: application/json' "
                        f"http://127.0.0.1/api/engine/binance/accounts", check=False)
    code = out.strip()
    log(f"    -> {code} {'OK' if code == '200' else '<-- expected 200'}")

    _, out, _ = sh(ssh, f"journalctl -u {ENGINE_SERVICE} -n 8 --no-pager -o cat", check=False)
    log("  --- recent log ---\n  " + out.strip().replace("\n", "\n  ") + "\n")


def do_verify_dash(ssh) -> bool:
    """Confirm the live index.html references JS chunks that exist on disk."""
    import re
    log("=== VERIFY dashboard ===")
    _, out, _ = sh(ssh, f"cat {REMOTE_DASH}/index.html 2>/dev/null", check=False)
    refs = set(re.findall(r'/assets/([A-Za-z0-9_.\-]+\.js)', out))
    log(f"  index.html references {len(refs)} asset chunk(s)")
    ok = bool(refs)
    if not refs:
        log("  ! no /assets/*.js references found (placeholder page or failed deploy)")
    for js in sorted(refs):
        _, o, _ = sh(ssh, f"[ -f {REMOTE_DASH}/assets/{js} ] && echo OK || echo MISSING", check=False)
        if "OK" not in o:
            ok = False
            log(f"  MISSING asset: {js}")
    try:
        with open(os.path.join(LOCAL_DIST, "index.html"), encoding="utf-8") as f:
            local_refs = set(re.findall(r'/assets/([A-Za-z0-9_.\-]+\.js)', f.read()))
        match = local_refs == refs
        log(f"  matches local dist index.html: {match}")
        ok = ok and match
    except OSError:
        pass
    log(f"  RESULT: {'HEALTHY' if ok else 'NEEDS RE-DEPLOY'}\n")
    return ok


def do_verify(ssh) -> None:
    do_verify_dash(ssh)
    log("=== VERIFY api ===")
    _, out, _ = sh(ssh, f"[ -f {REMOTE_API}/.env ] && echo '.env PRESENT' || echo '.env MISSING'", check=False)
    log("  " + out.strip())
    _, out, _ = sh(ssh, "systemctl is-active nginx php8.3-fpm mysql 2>/dev/null | tr '\\n' ' '", check=False)
    log(f"  services (nginx/php-fpm/mysql): {out.strip() or '(none)'}")
    log("  HTTP probe / (SPA) ...")
    _, out, _ = sh(ssh, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/ || echo ERR", check=False)
    log(f"    -> {out.strip()} {'OK' if out.strip() == '200' else '<-- expected 200'}")

    # Probe a route that actually exists. A 401 is the healthy answer: it proves
    # nginx -> php-fpm -> Laravel -> Sanctum is wired end to end. Bare /api has no
    # route registered, so probing it would report a misleading 404.
    log("  HTTP probe /api/auth/me (unauthenticated) ...")
    _, out, _ = sh(ssh, "curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/json' "
                        "http://127.0.0.1/api/auth/me || echo ERR", check=False)
    code = out.strip()
    log(f"    -> {code} {'OK (Laravel + Sanctum alive)' if code == '401' else '<-- expected 401'}")

    log("  DB connectivity (artisan) ...")
    _, out, _ = sh(ssh, f"cd {REMOTE_API} && php artisan db:show --json 2>/dev/null "
                        f"| head -c 200 || echo 'ERR'", check=False)
    log(f"    {out.strip()[:200] or '(no output)'}\n")


def do_sync_engine_env(ssh):
    """Re-sync engine/.env from local and restart — no code, no test gate.

    Exists so a config-only fix (a new Telegram channel, a rotated webhook
    token) does not have to ride along with an engine code deploy.
    """
    log(f"=== SYNC engine env -> {REMOTE_ENGINE}/.env ===")
    _ensure_engine_secrets(ssh)

    log(f"  restarting {ENGINE_SERVICE} ...")
    sh(ssh, f"systemctl restart {ENGINE_SERVICE}", timeout=120)
    _, out, _ = sh(ssh, f"systemctl is-active {ENGINE_SERVICE}", check=False)
    log(f"  service: {out.strip()}")

    _, out, _ = sh(ssh, f"journalctl -u {ENGINE_SERVICE} -n 6 --no-pager -o cat", check=False)
    log("  --- recent log ---\n  " + out.strip().replace("\n", "\n  ") + "\n")


def do_sync_api_env(ssh):
    """Push the mirrored product keys (Coinsbuy, TRON, Discord) + prod payment URLs into api/.env, re-cache.

    Config-only: no code, no build, no migration — the twin of sync-engine-env.
    It has to be its own command because `php artisan config:cache` bakes .env
    into bootstrap/cache/config.php, so a newly added key stays invisible to
    every HTTP request until that runs again.
    """
    log(f"=== SYNC api payment env -> {REMOTE_API}/.env ===")

    _, out, _ = sh(ssh, f"[ -f {REMOTE_API}/.env ] && echo PRESENT || echo MISSING", check=False)
    if out.strip() != "PRESENT":
        sys.exit("[abort] api/.env missing on the server — run setup-env first.")

    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    sh(ssh, f"cp -a {REMOTE_API}/.env {REMOTE_API}/.env.bak.{stamp}", check=False)
    log(f"  backed up -> api/.env.bak.{stamp}")

    _sync_payment_env(ssh)

    log("  php artisan config:cache ...")
    sh(ssh, f"cd {REMOTE_API} && php artisan config:clear >/dev/null && php artisan config:cache && "
            f"chown -R www-data:www-data {REMOTE_API}/bootstrap/cache", timeout=180)
    sh(ssh, "systemctl reload php8.3-fpm", check=False)

    # Read the verdict back out of the cached config the app will actually use.
    # Presence booleans only — the same rule PaymentController::debugEnvelope
    # follows, for the same reason: a diagnostic must never become a key leak.
    log("  resolved payment environment:")
    probe = (
        r'$e = new App\Services\Payments\PaymentEnvironment('
        r'["server_addr" => "' + HOST + r'", "host" => "' + DOMAIN + r'"]);'
        r'$c = $e->coinsbuy();'
        r'echo json_encode(["environment" => $e->name(), "reason" => $e->reason(),'
        r' "coinsbuy_mode" => $c["mode"], "downgraded_to_sandbox" => $c["downgraded"],'
        r' "client_id_set" => $c["client_id"] !== "", "client_secret_set" => $c["client_secret"] !== "",'
        r' "webhook_secret_set" => $c["webhook_secret"] !== "", "wallet_id" => $c["wallet_id"],'
        r' "callback_url" => $e->coinsbuyCallbackUrl(), "callbacks_secure" => $e->callbacksAreSecure(),'
        r' "frontend_base" => $e->frontendBaseUrl()], JSON_PRETTY_PRINT);'
    )
    _, out, err = sh(ssh, f"cd {REMOTE_API} && php artisan tinker --execute='{probe}'", check=False)
    body = (out.strip() or err.strip() or "(no output)")
    log("  " + body.replace("\n", "\n  ") + "\n")


def do_full(ssh):
    do_backup(ssh)
    ssh = do_deploy_dash(ssh)
    ssh = do_deploy_api(ssh)
    do_verify(ssh)
    return ssh


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "inspect"
    log(f"### TARGET: {_TARGET} ({HOST}) -> {REMOTE_PARENT} | cmd={cmd}\n")
    ssh = connect()
    _SSH["client"] = ssh
    try:
        dispatch = {
            "inspect": do_inspect,
            "provision": do_provision,
            "provision-db": do_provision_db,
            "setup-env": do_setup_env,
            "deploy-nginx": do_deploy_nginx,
            "setup-tls": do_setup_tls,
            "verify-tls": do_verify_tls,
            "backup": do_backup,
            "backup-db": do_backup_db,
            "deploy-dash": do_deploy_dash,
            "deploy-api": do_deploy_api,
            "deploy-engine": do_deploy_engine,
            "deploy-telegram": do_deploy_telegram,
            "sync-engine-env": do_sync_engine_env,
            "sync-telegram-env": do_sync_telegram_env,
            "sync-api-env": do_sync_api_env,
            "verify": do_verify,
            "verify-dash": do_verify_dash,
            "verify-engine": do_verify_engine,
            "verify-telegram": do_verify_telegram,
            "full": do_full,
        }
        fn = dispatch.get(cmd)
        if fn is None:
            sys.exit(f"unknown command: {cmd} (choose {sorted(dispatch)})")
        result = fn(_current(ssh))
        if isinstance(result, paramiko.SSHClient):
            ssh = result
    finally:
        try:
            _current(ssh).close()
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
