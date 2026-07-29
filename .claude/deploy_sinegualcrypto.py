#!/usr/bin/env python3
"""
Deploy helper for SineguAlerts (sinegual-crypto frontend + sinegutrade-api backend)
to the project's Ubuntu VPS, over paramiko/SFTP.

Target:
  prod    2.24.139.176  ->  /var/www/sinegualerts   (Ubuntu 24.04, root)

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
  deploy-dash   - local dist/ -> remote dashboard/   (run `npm run build` first)
  deploy-api    - local sinegutrade-api -> remote api/ (preserves .env/storage/vendor)
  verify        - index.html chunk refs exist, .env intact, HTTP probe
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
REMOTE_BACKUPS = REMOTE_PARENT + "/_backups"
REMOTE_TMP = "/tmp/sinegu_deploy"


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

def _collect(local_root: str, mode: str) -> list[tuple[str, str]]:
    """Walk local_root -> [(abs_path, posix_rel)], applying per-mode excludes."""
    out: list[tuple[str, str]] = []
    for dirpath, dirnames, filenames in os.walk(local_root):
        rel_dir = os.path.relpath(dirpath, local_root).replace("\\", "/")
        if rel_dir == ".":
            rel_dir = ""
        if mode == "api":
            dirnames[:] = [
                d for d in dirnames
                if d.lower() not in API_EXCLUDE_DIRS
                and f"{rel_dir}/{d}".lstrip("/").lower() not in API_EXCLUDE_DIRS
            ]
        for fn in filenames:
            rel = f"{rel_dir}/{fn}".lstrip("/")
            if mode == "api":
                rel_l = rel.lower()
                if rel_l in API_EXCLUDE_FILES or os.path.basename(rel_l) in API_EXCLUDE_FILES:
                    continue
                if os.path.splitext(rel_l)[1] in API_EXCLUDE_EXT:
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


NGINX_VHOST = """server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/sinegualerts/dashboard;
    index index.html;

    client_max_body_size 32M;

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
        fastcgi_read_timeout 120;
    }

    # React SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # hashed assets are immutable
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
"""


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

    log("  writing nginx vhost...")
    with _current(ssh).open_sftp() as sftp:
        with sftp.open("/etc/nginx/sites-available/sinegualerts", "w") as f:
            f.write(NGINX_VHOST)
    sh(ssh, "rm -f /etc/nginx/sites-enabled/default && "
            "ln -sf /etc/nginx/sites-available/sinegualerts /etc/nginx/sites-enabled/sinegualerts")
    rc, out, err = sh(ssh, "nginx -t", check=False)
    log("  nginx -t -> " + (out + err).strip().replace("\n", " | "))
    if rc != 0:
        raise RuntimeError("nginx config test failed; vhost not activated")
    sh(ssh, "systemctl enable --now nginx php8.3-fpm mysql && systemctl reload nginx")

    log("  firewall (OpenSSH + HTTP/HTTPS)...")
    sh(ssh, "ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable", check=False)

    log("  placeholder index so the vhost answers before the first deploy...")
    sh(ssh, f"[ -f {REMOTE_DASH}/index.html ] || "
            f"echo '<h1>SineguAlerts — awaiting first deploy</h1>' > {REMOTE_DASH}/index.html",
       check=False)

    log("=== PROVISION DONE ===\n")
    do_inspect(ssh)


def do_deploy_nginx(ssh) -> None:
    """Rewrite the nginx vhost from NGINX_VHOST, test it, reload. Idempotent."""
    log("=== DEPLOY nginx vhost ===")
    with _current(ssh).open_sftp() as sftp:
        with sftp.open("/etc/nginx/sites-available/sinegualerts", "w") as f:
            f.write(NGINX_VHOST)
    sh(ssh, "rm -f /etc/nginx/sites-enabled/default && "
            "ln -sf /etc/nginx/sites-available/sinegualerts /etc/nginx/sites-enabled/sinegualerts")
    rc, out, err = sh(ssh, "nginx -t", check=False)
    log("  nginx -t -> " + (out + err).strip().replace("\n", " | "))
    if rc != 0:
        raise RuntimeError("nginx config test failed; not reloading")
    sh(ssh, "systemctl reload nginx")
    log("  reloaded\n")


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


ENV_TEMPLATE = """APP_NAME=SineguAlerts
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
MAIL_FROM_ADDRESS="noreply@sinegualerts.com"
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
        content = ENV_TEMPLATE.format(
            app_url=f"http://{HOST}", host=HOST,
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
    for name, src in [("dashboard", REMOTE_DASH), ("api", REMOTE_API)]:
        _, out, _ = sh(ssh, f"[ -d {src} ] && echo YES || echo NO", check=False)
        if out.strip() != "YES":
            log(f"  {name}: nothing to back up (missing)")
            continue
        log(f"  tar {name} ...")
        sh(ssh, f"tar -czf {dest}/{name}.tar.gz -C {src} "
                f"--exclude=vendor --exclude=node_modules --exclude=storage/logs .",
           timeout=900)
    # keep the api .env separately so a restore is trivial
    sh(ssh, f"[ -f {REMOTE_API}/.env ] && cp {REMOTE_API}/.env {dest}/api.env || true", check=False)
    _, out, _ = sh(ssh, f"ls -lh {dest}", check=False)
    log("  " + out.strip().replace("\n", "\n  "))
    # prune to the newest 10 backups
    sh(ssh, f"cd {REMOTE_BACKUPS} && ls -1t | tail -n +11 | xargs -r rm -rf", check=False)
    log(f"=== BACKUP DONE: {dest} ===\n")
    return dest


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
    sh(ssh, "systemctl reload php8.3-fpm nginx", check=False)

    log("  post-deploy .env -> PRESENT")
    log("=== DEPLOY api DONE ===\n")
    return ssh


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
            "backup": do_backup,
            "deploy-dash": do_deploy_dash,
            "deploy-api": do_deploy_api,
            "verify": do_verify,
            "verify-dash": do_verify_dash,
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
