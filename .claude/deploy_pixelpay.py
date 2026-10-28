#!/usr/bin/env python3
"""
Deploy helper for Pixel Pay (`C:\\Users\\Xlythe\\tomyam - Copy`) onto the Pixel
Alpha box, at https://pay.pixel-alpha.com.

It is a GUEST on that box, and everything below is shaped by that:

  * Its own Linux user (`pixelpay`), its own php-fpm pool and socket, its own
    nginx vhost file, its own cert, its own cron file. Nothing Pixel Alpha's
    deploy script writes is touched, and Pixel Alpha's `deploy-nginx` (which
    rewrites `sites-available/sinegualerts` from a template) never sees it.
  * Its own MySQL database (`pixel_pay`) and MySQL user (`pixelpay`), granted on
    that database ONLY. `sinegu_crypto` is never altered: the grant is what makes
    that structural — a wrong Pay .env cannot even open Pixel Alpha's data.
  * File isolation both ways: Pixel Alpha's api/.env is www-data 640 and the
    engine's root:pixelalpha 640, so the pool user cannot read either; Pay's
    .env is root:pixelpay 640, so Pixel Alpha's PHP (www-data) cannot read it.

The SSH / upload / secret-scrubbing helpers are imported from
deploy_sinegualcrypto.py (same directory, same creds file) rather than copied:
one way of talking to the box.

Remote layout:
  /var/www/pixelpay/          root:root 755
  ├── web/                    React dist — nginx root (root-owned, read-only)
  ├── api/                    Laravel 8 pixel-pay-api — code root-owned, read-only;
  │                           storage/ + bootstrap/cache pixelpay's; .env root:pixelpay 640
  ├── acme/                   Let's Encrypt webroot (outside web/, so a web deploy
  │                           can never remove a challenge mid-renewal)
  └── _backups/<ts>/          root-only 700

Usage:
  python .claude/deploy_pixelpay.py <cmd>
    inspect       read-only: what exists of Pixel Pay on the box
    provision     Linux user, directories, php-fpm pool (idempotent)
    provision-db  CREATE DATABASE / USER IF NOT EXISTS + grant on pixel_pay only
    nginx         write the pay vhost + headers snippet, test, reload
    tls           issue/renew the pay.pixel-alpha.com cert, enable :443
    backup        tar web/ + api/ + .env into _backups/<ts>
    deploy-web    build the frontend against https://pay.pixel-alpha.com/api, upload
    deploy-api    upload the API, composer, .env (first run), migrate, cron
    create-admin  one admin with a random password (saved to .claude/pixelpay.creds.json)
    verify        Pay end to end + isolation + Pixel Alpha still healthy
    full          backup -> deploy-web -> deploy-api -> verify

Credentials: SSH from .claude/deploy.creds.json (via the Pixel Alpha script);
Pay's DB + admin passwords in .claude/pixelpay.creds.json. Both gitignored.
"""
from __future__ import annotations

import base64
import json
import os
import re
import secrets
import subprocess
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import deploy_sinegualcrypto as d  # noqa: E402  (reads sys.argv for the target; default prod)

LOCAL_PAY_ROOT = r"C:\Users\Xlythe\tomyam - Copy"
LOCAL_PAY_API = os.path.join(LOCAL_PAY_ROOT, "pixel-pay-api")
LOCAL_PAY_CREDS = os.path.join(HERE, "pixelpay.creds.json")

PAY_DOMAIN = "pay.pixel-alpha.com"
PAY_URL = f"https://{PAY_DOMAIN}"
PAY_USER = "pixelpay"
PAY_PARENT = "/var/www/pixelpay"
PAY_WEB = f"{PAY_PARENT}/web"
PAY_API = f"{PAY_PARENT}/api"
PAY_ACME = f"{PAY_PARENT}/acme"
PAY_BACKUPS = f"{PAY_PARENT}/_backups"
PAY_ENV = f"{PAY_API}/.env"

PAY_DB = "pixel_pay"
PAY_DB_USER = "pixelpay"
# The one database and the one user this script must never address. Checked
# before any SQL is sent, so a typo in the constants above fails here first.
PIXEL_ALPHA_DB, PIXEL_ALPHA_DB_USER = "sinegu_crypto", "sinegu"
assert PAY_DB != PIXEL_ALPHA_DB and PAY_DB_USER != PIXEL_ALPHA_DB_USER

PAY_POOL = "/etc/php/8.3/fpm/pool.d/pixelpay.conf"
PAY_SOCK = "/run/php/php8.3-fpm-pixelpay.sock"
PAY_VHOST = "/etc/nginx/sites-available/pixelpay"
PAY_HEADERS = "/etc/nginx/snippets/pixelpay-headers.conf"
PAY_CERT = f"/etc/letsencrypt/live/{PAY_DOMAIN}"
PAY_CRON = "/etc/cron.d/pixelpay"
PAY_CRON_LOG = "/var/log/pixelpay-schedule.log"

ADMIN_EMAIL = "christian@feature-digital.com"
ADMIN_NAME = "Christian Napay"

# The API folder carries live keys beside its .env (env-prod.txt holds the
# PRODUCTION Coinsbuy set), so the excludes are by name, not just `.env`.
d._MODE_EXCLUDES["payapi"] = (
    {".git", ".github", ".cursor", ".idea", ".vscode", "vendor", "node_modules",
     "storage", "public/storage", "bootstrap/cache", "tests"},
    {".env", ".env.local", ".env.production", "env.txt", "env-prod.txt",
     "env-hostinger.txt", "test_admin_rbac.php", "package-lock.json"},
    {".log", ".sqlite", ".zip", ".rar", ".7z"},
)

log, sh = d.log, d.sh


# ------------------------------------------------------------------ local creds

def _load_pay_creds() -> dict:
    if not os.path.isfile(LOCAL_PAY_CREDS):
        return {}
    with open(LOCAL_PAY_CREDS, encoding="utf-8") as f:
        creds = json.load(f)
    for section in creds.values():
        if isinstance(section, dict):
            d._register_secret(section.get("password"))
    return creds


def _save_pay_creds(creds: dict) -> None:
    with open(LOCAL_PAY_CREDS, "w", encoding="utf-8") as f:
        json.dump(creds, f, indent=2)
        f.write("\n")


def _mint(n: int = 24) -> str:
    # token_urlsafe: [A-Za-z0-9_-] only — safe unquoted in dotenv, in a MySQL
    # string literal and in a PHP single-quoted string.
    value = secrets.token_urlsafe(n)
    d._register_secret(value)
    return value


def _parse_env(raw: str) -> dict:
    out = {}
    for line in raw.splitlines():
        m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$", line)
        if not m:
            continue
        k, v = m.group(1), m.group(2).strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        out[k] = v
        if d._is_secret_key(k):
            d._register_secret(v)
    return out


def _as_pay(cmd: str) -> str:
    """Run a command in api/ as the pool user, so everything Laravel writes
    (logs, caches) has the owner php-fpm expects."""
    return f"cd {PAY_API} && runuser -u {PAY_USER} -- {cmd}"


def _exists(ssh, path: str, flag: str = "-e") -> bool:
    rc, _, _ = sh(ssh, f"test {flag} {path}", check=False)
    return rc == 0


# ----------------------------------------------------------------- read-only

def do_inspect(ssh) -> None:
    log(f"=== INSPECT Pixel Pay on {d.HOST} ===")
    for label, cmd in [
        ("linux user", f"id {PAY_USER} 2>&1"),
        ("layout", f"ls -la {PAY_PARENT} 2>&1"),
        ("api .env", f"stat -c '%A %U:%G' {PAY_ENV} 2>&1"),
        ("fpm pool", f"test -f {PAY_POOL} && echo present || echo MISSING; test -S {PAY_SOCK} && echo 'socket up' || echo 'no socket'"),
        ("vhost", f"ls -la /etc/nginx/sites-enabled/ | grep -E 'pixelpay|sinegualerts'"),
        ("cert", f"certbot certificates 2>/dev/null | grep -A2 'Certificate Name: {PAY_DOMAIN}' || echo 'no cert'"),
        ("databases", "mysql -N -e 'SHOW DATABASES;' | tr '\\n' ' '"),
        ("grants", f"mysql -N -e \"SHOW GRANTS FOR '{PAY_DB_USER}'@'localhost';\" 2>&1"),
        ("cron", f"cat {PAY_CRON} 2>&1 | tail -1"),
    ]:
        _, out, _ = sh(ssh, cmd, check=False)
        log(f"  [{label}]\n    " + (out.strip() or "(none)").replace("\n", "\n    "))
    log("")


def _pixel_alpha_db_fingerprint(ssh) -> str:
    """Table count + row-estimate sum of sinegu_crypto — printed before and after
    every database step, so 'nothing changed there' is shown, not asserted."""
    _, out, _ = sh(ssh, "mysql -N -e \"SELECT COUNT(*), COALESCE(SUM(table_rows),0) FROM "
                        f"information_schema.tables WHERE table_schema='{PIXEL_ALPHA_DB}';\"",
                   check=False)
    tables, rows = (out.split() + ["?", "?"])[:2]
    return f"{PIXEL_ALPHA_DB}: {tables} tables, ~{rows} rows (estimate)"


# ------------------------------------------------------------------ provision

PAY_POOL_CONF = f"""; Managed by sinegual-crypto/.claude/deploy_pixelpay.py — edits here are overwritten.
;
; Pixel Pay's own pool: its own user, so a PHP bug in Pay can read neither Pixel
; Alpha's api/.env (www-data 640) nor the engine's (root:pixelalpha 640), and
; Pixel Alpha's www-data pool cannot read Pay's .env (root:pixelpay 640).
; ondemand: no idle workers held while nobody is paying.
[pixelpay]
user = {PAY_USER}
group = {PAY_USER}
listen = {PAY_SOCK}
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = ondemand
pm.max_children = 8
pm.process_idle_timeout = 30s
pm.max_requests = 500
php_admin_value[upload_max_filesize] = 16M
php_admin_value[post_max_size] = 16M
php_admin_flag[expose_php] = off
"""


def do_provision(ssh) -> None:
    log("=== PROVISION Pixel Pay (idempotent) ===")
    sh(ssh, f"id -u {PAY_USER} >/dev/null 2>&1 || useradd --system --home-dir {PAY_API} "
            f"--no-create-home --shell /usr/sbin/nologin {PAY_USER}")
    sh(ssh, f"mkdir -p {PAY_WEB} {PAY_API} {PAY_ACME}/.well-known/acme-challenge {PAY_BACKUPS} && "
            f"chown root:root {PAY_PARENT} {PAY_WEB} {PAY_API} && chmod 755 {PAY_PARENT} && "
            f"chown -R root:root {PAY_ACME} && chmod -R u=rwX,go=rX {PAY_ACME} && "
            f"chown root:root {PAY_BACKUPS} && chmod 700 {PAY_BACKUPS}")
    sh(ssh, f"[ -f {PAY_WEB}/index.html ] || echo '<h1>Pixel Pay — awaiting first deploy</h1>' "
            f"> {PAY_WEB}/index.html", check=False)
    log(f"  user {PAY_USER} + {PAY_PARENT}/{{web,api,acme,_backups}} ready")

    d._write_remote_text(ssh, PAY_POOL, PAY_POOL_CONF, mode_if_new=0o644)
    rc, out, err = sh(ssh, "php-fpm8.3 -t", check=False)
    log("  php-fpm8.3 -t -> " + (out + err).strip().replace("\n", " | "))
    if rc != 0:
        sh(ssh, f"rm -f {PAY_POOL}", check=False)
        raise RuntimeError("php-fpm config test failed; pool file removed, nothing reloaded")
    # reload = graceful: Pixel Alpha's www pool finishes its in-flight requests
    # (its own deploy-api reloads the same way on every deploy).
    sh(ssh, "systemctl reload php8.3-fpm")
    sh(ssh, f"for i in 1 2 3 4 5; do test -S {PAY_SOCK} && break; sleep 1; done; test -S {PAY_SOCK}")
    log(f"  php-fpm pool [pixelpay] up on {PAY_SOCK}")
    log("=== PROVISION DONE ===\n")


def do_provision_db(ssh) -> None:
    """A second database beside sinegu_crypto. Additive only: IF NOT EXISTS on
    both, and the grant names pixel_pay alone. Never DROP, never sinegu_crypto."""
    log(f"=== PROVISION DB `{PAY_DB}` + user '{PAY_DB_USER}' ===")
    log("  before: " + _pixel_alpha_db_fingerprint(ssh))

    creds = _load_pay_creds()
    server_env = _parse_env(d._read_remote_text(ssh, PAY_ENV) or "")
    # The server .env wins: it is what the running app uses. Then the local
    # copy, then a fresh one. ALTER USER keeps MySQL equal to whichever it is.
    pw = server_env.get("DB_PASSWORD") or (creds.get("db") or {}).get("password") or _mint()
    creds["db"] = {"database": PAY_DB, "user": PAY_DB_USER, "password": pw}
    _save_pay_creds(creds)

    sql = (
        f"CREATE DATABASE IF NOT EXISTS `{PAY_DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
        f"CREATE USER IF NOT EXISTS '{PAY_DB_USER}'@'localhost' IDENTIFIED BY '{pw}';\n"
        f"ALTER USER '{PAY_DB_USER}'@'localhost' IDENTIFIED BY '{pw}';\n"
        f"GRANT ALL PRIVILEGES ON `{PAY_DB}`.* TO '{PAY_DB_USER}'@'localhost';\n"
    )
    # Same rule as provision-db: the password rides a 0600 file, never `mysql -e`.
    sql_file = "/root/.pixelpay_provision.sql"
    d._write_remote_text(ssh, sql_file, sql, mode_if_new=0o600)
    try:
        sh(ssh, f"mysql < {sql_file}")
    finally:
        sh(ssh, f"rm -f {sql_file}", check=False)

    _, out, _ = sh(ssh, "mysql -N -e 'SHOW DATABASES;' | tr '\\n' ' '", check=False)
    log("  databases: " + out.strip())
    _, out, _ = sh(ssh, f"mysql -N -e \"SHOW GRANTS FOR '{PAY_DB_USER}'@'localhost';\"", check=False)
    log("  grants for pixelpay:\n    " + out.strip().replace("\n", "\n    "))
    if PIXEL_ALPHA_DB in out:
        raise RuntimeError(f"{PAY_DB_USER} can reach {PIXEL_ALPHA_DB} — stop and investigate")
    log("  after:  " + _pixel_alpha_db_fingerprint(ssh))
    log(f"  password saved to {LOCAL_PAY_CREDS} (gitignored)")
    log("=== PROVISION DB DONE ===\n")


# ---------------------------------------------------------------------- nginx

# Pay's own set, NOT Pixel Alpha's snippet: Scan to Pay opens the camera, which
# Pixel Alpha's Permissions-Policy forbids, and Pixel Alpha's report-only CSP is
# measured against Pixel Alpha's bundle — the day it is enforced, sharing it
# would blank this app. No CSP here until one is measured against Pay's build.
PAY_HEADERS_CONF = """# Managed by sinegual-crypto/.claude/deploy_pixelpay.py — edits here are overwritten.
# Included at server level AND inside every location with its own add_header
# (nginx drops the inherited set there). No HSTS, same decision as Pixel Alpha.
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options DENY always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;
"""


def _pay_vhost(tls: bool) -> str:
    http = f"""# Managed by sinegual-crypto/.claude/deploy_pixelpay.py — edits here are overwritten.
# Pixel Pay at {PAY_DOMAIN}. A separate file from Pixel Alpha's `sinegualerts`
# vhost, which that product's deploy-nginx rewrites from a template.
server {{
    listen 80;
    listen [::]:80;
    server_name {PAY_DOMAIN};

    # Issuance + every renewal arrive over :80, from a webroot outside web/.
    location ^~ /.well-known/acme-challenge/ {{
        root {PAY_ACME};
        default_type "text/plain";
        try_files $uri =404;
    }}

    location / {{
        return 301 https://{PAY_DOMAIN}$request_uri;
    }}
}}
"""
    if not tls:
        return http
    return http + f"""
server {{
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name {PAY_DOMAIN};

    ssl_certificate     {PAY_CERT}/fullchain.pem;
    ssl_certificate_key {PAY_CERT}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    root {PAY_WEB};
    index index.html;
    client_max_body_size 16M;

    include {PAY_HEADERS};

    # Dotfiles are never served: the build ships an .htaccess, and nothing that
    # starts with a dot belongs on the wire.
    location ~ /\\. {{
        deny all;
    }}

    # Laravel under /api. Same shape as Pixel Alpha's: `root` + a named
    # fallback so REQUEST_URI reaches PHP untouched (routes carry the /api
    # prefix), SCRIPT_NAME /index.php so Symfony does not strip it. Only /api
    # and /storage reach Laravel — its /dev/* playground routes stay unreachable.
    location ^~ /api {{
        root {PAY_API}/public;
        try_files $uri @pixelpay_api;
    }}

    location @pixelpay_api {{
        fastcgi_pass unix:{PAY_SOCK};
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME {PAY_API}/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param DOCUMENT_ROOT {PAY_API}/public;
        fastcgi_param HTTPS $https if_not_empty;
        fastcgi_read_timeout 120;
    }}

    # Profile images (`php artisan storage:link`), served as files.
    location ^~ /storage/ {{
        root {PAY_API}/public;
        try_files $uri =404;
    }}

    # SPA. index.html is never cached (a cached one points at the previous
    # build's chunks); hashed assets are immutable.
    location / {{
        include {PAY_HEADERS};
        add_header Cache-Control "no-cache, must-revalidate" always;
        try_files $uri $uri/ /index.html;
    }}

    location = /index.html {{
        include {PAY_HEADERS};
        add_header Cache-Control "no-cache, must-revalidate" always;
        try_files $uri =404;
    }}

    location /assets/ {{
        include {PAY_HEADERS};
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }}

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}}
"""


def _has_pay_cert(ssh) -> bool:
    return _exists(ssh, f"{PAY_CERT}/fullchain.pem", "-f")


def do_nginx(ssh) -> None:
    log(f"=== NGINX vhost for {PAY_DOMAIN} ===")
    tls = _has_pay_cert(ssh)
    log(f"  certificate: {'present -> :443 enabled' if tls else 'MISSING -> :80 only (run tls)'}")
    d._write_remote_text(ssh, PAY_HEADERS, PAY_HEADERS_CONF, mode_if_new=0o644)
    d._write_remote_text(ssh, PAY_VHOST, _pay_vhost(tls), mode_if_new=0o644)
    sh(ssh, f"ln -sf {PAY_VHOST} /etc/nginx/sites-enabled/pixelpay")
    rc, out, err = sh(ssh, "nginx -t", check=False)
    log("  nginx -t -> " + (out + err).strip().replace("\n", " | "))
    if rc != 0:
        # Leave the box exactly as it was serving: unlink ours, keep Pixel Alpha's.
        sh(ssh, "rm -f /etc/nginx/sites-enabled/pixelpay", check=False)
        raise RuntimeError("nginx config test failed; Pixel Pay vhost unlinked, nothing reloaded")
    sh(ssh, "systemctl reload nginx")
    log("  reloaded\n")


def do_tls(ssh) -> None:
    """certonly --webroot, never --nginx — same reason as Pixel Alpha's setup-tls:
    the plugin would rewrite a vhost this script owns."""
    log(f"=== TLS {PAY_DOMAIN} ===")
    do_nginx(ssh)
    if _has_pay_cert(ssh):
        log("  certificate present — certbot.timer renews it; nothing to issue")
    else:
        rc, out, err = sh(
            ssh,
            f"certbot certonly --webroot -w {PAY_ACME} -d {PAY_DOMAIN} --cert-name {PAY_DOMAIN} "
            f"--non-interactive --agree-tos -m {d.CERTBOT_EMAIL} --deploy-hook 'systemctl reload nginx'",
            check=False, timeout=600,
        )
        log("  " + (out + err).strip().replace("\n", "\n  "))
        if rc != 0:
            raise RuntimeError("certbot failed — check that Cloudflare forwards "
                               f"http://{PAY_DOMAIN}/.well-known/ to the origin (no edge redirect)")
    do_nginx(ssh)
    _, out, _ = sh(ssh, f"certbot certificates 2>/dev/null | grep -A2 'Certificate Name: {PAY_DOMAIN}'",
                   check=False)
    log("  " + out.strip().replace("\n", "\n  "))
    log("=== TLS DONE ===\n")


# --------------------------------------------------------------------- backup

def do_backup(ssh) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = f"{PAY_BACKUPS}/{ts}"
    log(f"=== BACKUP Pixel Pay -> {dest} ===")
    sh(ssh, f"mkdir -p {dest} && chmod 700 {PAY_BACKUPS} {dest}")
    for name, src in (("web", PAY_WEB), ("api", PAY_API)):
        if _exists(ssh, src, "-d"):
            sh(ssh, f"tar -czf {dest}/{name}.tar.gz -C {src} --exclude=vendor "
                    f"--exclude=storage/logs .", timeout=900)
    sh(ssh, f"[ -f {PAY_ENV} ] && cp -p {PAY_ENV} {dest}/api.env || true", check=False)
    sh(ssh, f"cd {PAY_BACKUPS} && ls -1t | tail -n +11 | xargs -r rm -rf", check=False)
    _, out, _ = sh(ssh, f"ls -lh {dest}", check=False)
    log("  " + out.strip().replace("\n", "\n  "))
    log("=== BACKUP DONE ===\n")
    return dest


# ----------------------------------------------------------------- deploy-web

def _build_web() -> str:
    """Build with the API base pinned to the deployed origin.

    Pay's axios clients read VITE_API_BASE_URL at BUILD time and fall back to
    http://127.0.0.1:8000/api — so a build that forgot it would ship a site that
    talks to the visitor's own machine. It is set in the process environment
    (Vite's highest priority, above every .env file) and the bundle is checked
    for it afterwards. Built outside the repo's dist/, which stays untouched.
    """
    out_dir = os.path.join(os.environ.get("TEMP", "."), "pixelpay_web_dist")
    env = dict(os.environ, VITE_API_BASE_URL=f"{PAY_URL}/api")
    log(f"  vite build (VITE_API_BASE_URL={PAY_URL}/api) -> {out_dir}")
    proc = subprocess.run(
        ["npm.cmd", "run", "build", "--", "--outDir", out_dir, "--emptyOutDir"],
        cwd=LOCAL_PAY_ROOT, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode != 0:
        raise SystemExit("[abort] frontend build failed:\n" + (proc.stdout + proc.stderr)[-3000:])
    bundle = ""
    for root, _, files in os.walk(os.path.join(out_dir, "assets")):
        for fn in files:
            if fn.endswith(".js"):
                with open(os.path.join(root, fn), encoding="utf-8", errors="replace") as f:
                    bundle += f.read()
    if f"{PAY_URL}/api" not in bundle:
        raise SystemExit(f"[abort] built bundle does not contain {PAY_URL}/api — not deploying it")
    with open(os.path.join(out_dir, "index.html"), encoding="utf-8") as f:
        title = re.search(r"<title>(.*?)</title>", f.read(), re.S)
    log(f"  build ok — API base baked in, <title> = {title.group(1).strip() if title else '?'}")
    return out_dir


def do_deploy_web(ssh):
    log(f"=== DEPLOY web -> {PAY_WEB} ===")
    out_dir = _build_web()
    ssh = d._deploy_via_tgz(ssh, out_dir, PAY_WEB, mode="dash", name="pixelpay_web.tar.gz",
                            pre_sync=[f"rm -rf {PAY_WEB}/assets"], owner=None)
    # Packed on Windows, where os.stat says 0666: without this every file lands
    # world-writable. nginx only reads.
    sh(ssh, f"chown -R root:root {PAY_WEB} && chmod -R u=rwX,go=rX {PAY_WEB}")
    log("=== DEPLOY web DONE ===\n")
    return ssh


# ----------------------------------------------------------------- deploy-api

def _first_env(ssh) -> None:
    """Write api/.env once, from the local pixel-pay-api/.env plus the prod
    overrides. Never rewritten afterwards — later changes are made on the box.

    Sandbox-only by decision (2026-10-28): the local file carries the Coinsbuy
    SANDBOX set (env-prod.txt holds the live one and is never read here), and
    this refuses to proceed if that ever stops being true.
    """
    local_raw = open(os.path.join(LOCAL_PAY_API, ".env"), encoding="utf-8").read()
    local = _parse_env(local_raw)
    if local.get("COINSBUY_ENVIRONMENT") != "sandbox" or "sandbox" not in local.get("COINSBUY_BASE_URL", ""):
        raise SystemExit("[abort] local pixel-pay-api/.env is not on Coinsbuy SANDBOX — prod Pay is "
                         "sandbox-only until the owner decides otherwise.")

    db_pw = (_load_pay_creds().get("db") or {}).get("password")
    if not db_pw:
        raise SystemExit("[abort] no Pay DB password — run provision-db first")

    overrides = {
        "APP_NAME": '"Pixel Pay"',
        "APP_ENV": "production",
        "APP_KEY": "base64:" + base64.b64encode(secrets.token_bytes(32)).decode(),
        "APP_DEBUG": "false",
        "APP_URL": PAY_URL,
        "LOG_LEVEL": "error",
        "DB_CONNECTION": "mysql",
        "DB_HOST": "127.0.0.1",
        "DB_PORT": "3306",
        "DB_DATABASE": PAY_DB,
        "DB_USERNAME": PAY_DB_USER,
        "DB_PASSWORD": db_pw,
        "MAIL_FROM_NAME": '"Pixel Pay"',
        # WAMP needs these off for want of a CA bundle; the box has one.
        "COINSBUY_VERIFY_SSL": "true",
        "FX_VERIFY_SSL": "true",
        "SANDBOX5X_POST_BACK_URL": f"{PAY_URL}/api/sandbox5x/webhook",
    }
    d._register_secret(overrides["APP_KEY"])
    lines, seen = [], set()
    for line in local_raw.splitlines():
        m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=", line)
        if m and m.group(1) in overrides:
            if m.group(1) in seen:
                continue
            seen.add(m.group(1))
            line = f"{m.group(1)}={overrides[m.group(1)]}"
        lines.append(line)
    lines += [f"{k}={v}" for k, v in overrides.items() if k not in seen]
    d._write_remote_text(ssh, PAY_ENV, "\n".join(lines) + "\n", mode_if_new=0o640)
    log(f"  wrote {PAY_ENV} (sandbox payments, {PAY_DB} database, debug off)")


def _lock_down_api(ssh) -> None:
    """Code root-owned and read-only; only storage/ and bootstrap/cache are the
    pool user's; .env root:pixelpay 640. nginx (www-data, "other") needs to
    traverse into storage/app/public for /storage/* and nothing else in storage."""
    sh(ssh, f"mkdir -p {PAY_API}/storage/framework/cache {PAY_API}/storage/framework/sessions "
            f"{PAY_API}/storage/framework/views {PAY_API}/storage/logs {PAY_API}/storage/app/public "
            f"{PAY_API}/bootstrap/cache")
    # storage/ and bootstrap/cache are pruned rather than chowned and handed
    # back: on a redeploy the live pool writes sessions and logs there, and a
    # root-owned window would fail those requests. `! -type l`: chown/chmod on
    # the public/storage symlink would act on its TARGET, storage/app/public.
    sh(ssh, f"find {PAY_API} \\( -path {PAY_API}/storage -o -path {PAY_API}/bootstrap/cache \\) -prune "
            f"-o ! -type l -exec chown root:root {{}} + -exec chmod u=rwX,go=rX {{}} +", timeout=900)
    sh(ssh, f"chown -R {PAY_USER}:{PAY_USER} {PAY_API}/storage {PAY_API}/bootstrap/cache && "
            f"chmod -R u=rwX,g=rX,o= {PAY_API}/storage {PAY_API}/bootstrap/cache && "
            f"chmod o+x {PAY_API}/storage {PAY_API}/storage/app && "
            f"chmod -R o+rX {PAY_API}/storage/app/public")
    sh(ssh, f"[ -f {PAY_ENV} ] && chown root:{PAY_USER} {PAY_ENV} && chmod 640 {PAY_ENV} || true")


PAY_CRON_CONF = f"""# Managed by sinegual-crypto/.claude/deploy_pixelpay.py — edits here are overwritten.
# Laravel scheduler for Pixel Pay (sandbox5x:check-pending every minute), as the
# pool user so storage/ keeps the owner php-fpm expects.
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

* * * * * {PAY_USER} cd {PAY_API} && /usr/bin/php artisan schedule:run >> {PAY_CRON_LOG} 2>&1
"""

# Bootstraps Laravel and prints which database and MySQL user it is really on —
# the gate in front of `migrate`.
_DB_PROBE = (
    "php -r 'require \"vendor/autoload.php\"; $app = require \"bootstrap/app.php\"; "
    "$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); "
    "echo Illuminate\\Support\\Facades\\DB::connection()->getDatabaseName(), \"|\", "
    "Illuminate\\Support\\Facades\\DB::select(\"select current_user() u\")[0]->u;'"
)


def do_deploy_api(ssh):
    log(f"=== DEPLOY api -> {PAY_API} (.env/storage/vendor preserved) ===")
    ssh = d._deploy_via_tgz(ssh, LOCAL_PAY_API, PAY_API, mode="payapi", name="pixelpay_api.tar.gz",
                            rsync_extra=[".env", "storage", "vendor", "bootstrap/cache", "public/storage"],
                            owner=None)

    log("  composer install --no-dev --no-scripts ...")
    sh(ssh, f"cd {PAY_API} && COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev "
            f"--optimize-autoloader --no-interaction --no-scripts", timeout=1800)

    if not _exists(ssh, PAY_ENV, "-f"):
        _first_env(ssh)
    else:
        _parse_env(d._read_remote_text(ssh, PAY_ENV) or "")  # register its secrets for scrubbing
        log("  .env present — left untouched")
    _lock_down_api(ssh)

    sh(ssh, _as_pay("php artisan config:clear"), check=False)
    sh(ssh, _as_pay("php artisan package:discover --ansi"))

    _, out, _ = sh(ssh, _as_pay(_DB_PROBE))
    db_name, _, db_user = out.strip().partition("|")
    log(f"  Laravel is connected to database '{db_name}' as {db_user}")
    if db_name != PAY_DB or not db_user.startswith(f"{PAY_DB_USER}@"):
        raise RuntimeError(f"refusing to migrate: expected {PAY_DB} as {PAY_DB_USER}, got {out.strip()}")

    log("  before: " + _pixel_alpha_db_fingerprint(ssh))
    _, out, err = sh(ssh, _as_pay("php artisan migrate --force"), timeout=600)
    log("  migrate:\n    " + (out or err).strip().replace("\n", "\n    ")[:3000])

    # DatabaseSeeder minus AdminSeeder (known passwords). Once only: it is
    # updateOrCreate, so a re-run would reset values an admin has since edited.
    # No backticks around the name: inside bash double quotes they are command substitution.
    _, out, _ = sh(ssh, f"mysql -N -e \"SELECT COUNT(*) FROM {PAY_DB}.configurations;\"", check=False)
    if out.strip() == "0":
        sh(ssh, _as_pay("php artisan db:seed --class=ConfigurationSeeder --force"))
        log("  seeded configurations (first deploy)")
    log("  after:  " + _pixel_alpha_db_fingerprint(ssh))

    # route:cache is skipped on purpose: Laravel 8 cannot cache closure routes,
    # and routes/api.php has five.
    sh(ssh, _as_pay("php artisan config:cache"))
    sh(ssh, f"cd {PAY_API} && [ -L public/storage ] || php artisan storage:link", check=False)

    d._write_remote_text(ssh, PAY_CRON, PAY_CRON_CONF, mode_if_new=0o644)
    sh(ssh, f"chown root:root {PAY_CRON} && chmod 644 {PAY_CRON} && touch {PAY_CRON_LOG} && "
            f"chown {PAY_USER}:{PAY_USER} {PAY_CRON_LOG}")
    log(f"  scheduler cron: {PAY_CRON}")

    sh(ssh, "systemctl reload php8.3-fpm")
    log("=== DEPLOY api DONE ===\n")
    return ssh


# --------------------------------------------------------------- create-admin

def do_create_admin(ssh) -> None:
    """One admin with a random password, instead of AdminSeeder's known ones.
    The password goes through a 0600 file owned by the pool user, never a
    command line, and is saved locally BEFORE the account is created."""
    log(f"=== CREATE ADMIN {ADMIN_EMAIL} ===")
    creds = _load_pay_creds()
    admin = creds.get("admin") or {}
    pw = admin.get("password") or _mint(18)
    creds["admin"] = {"email": ADMIN_EMAIL, "password": pw, "url": f"{PAY_URL}/admin"}
    _save_pay_creds(creds)

    script = f"""<?php
require '{PAY_API}/vendor/autoload.php';
$app = require '{PAY_API}/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
if (App\\Models\\Admin::where('email', '{ADMIN_EMAIL}')->exists()) {{ echo "EXISTS"; exit(0); }}
App\\Models\\Admin::create(['email' => '{ADMIN_EMAIL}', 'password' => '{pw}',
    'name' => '{ADMIN_NAME}', 'role' => 'admin', 'status' => 'active']);
echo "CREATED";
"""
    path = "/tmp/pixelpay_admin.php"
    d._write_remote_text(ssh, path, script, mode_if_new=0o600)
    try:
        sh(ssh, f"chown {PAY_USER} {path} && chmod 600 {path}")
        _, out, _ = sh(ssh, _as_pay(f"php {path}"))
    finally:
        sh(ssh, f"rm -f {path}", check=False)
    log(f"  {out.strip()} — password in {LOCAL_PAY_CREDS}")
    if out.strip() == "EXISTS":
        log("  (an admin with that email already existed; the saved password may not be its password)")
    log("=== CREATE ADMIN DONE ===\n")


# --------------------------------------------------------------------- verify

def _code(ssh, url: str, extra: str = "") -> str:
    _, out, _ = sh(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' -k {extra} {url} || echo ERR",
                   check=False, timeout=90)
    return out.strip()


def do_verify(ssh) -> None:
    log(f"=== VERIFY {PAY_DOMAIN} ===")
    pin = f"--resolve {PAY_DOMAIN}:443:127.0.0.1"
    fails = []

    def check(label: str, got: str, want: str) -> None:
        ok = got == want
        log(f"  {label} -> {got} {'OK' if ok else f'<-- expected {want}'}")
        if not ok:
            fails.append(label)

    check("origin /", _code(ssh, f"https://{PAY_DOMAIN}/", pin), "200")
    _, out, _ = sh(ssh, f"curl -sk {pin} https://{PAY_DOMAIN}/ | grep -o '<title>[^<]*' | head -1",
                   check=False)
    log(f"  origin / title: {out.strip().replace('<title>', '')}")
    check("origin /api/maintenance-status (public, reads the DB)",
          _code(ssh, f"https://{PAY_DOMAIN}/api/maintenance-status", f"{pin} -H 'Accept: application/json'"), "200")
    check("origin /api/profile without a token",
          _code(ssh, f"https://{PAY_DOMAIN}/api/profile", f"{pin} -H 'Accept: application/json'"), "401")
    check("origin /.htaccess (dotfiles denied)", _code(ssh, f"https://{PAY_DOMAIN}/.htaccess", pin), "403")
    _, out, _ = sh(ssh, f"curl -sk {pin} https://{PAY_DOMAIN}/dev/api-playground | grep -c 'id=\"root\"'",
                   check=False)
    log(f"  /dev/api-playground is the SPA, not Laravel's dev page -> "
        f"{'OK' if out.strip() not in ('', '0') else '<-- Laravel dev route reachable'}")
    _, out, _ = sh(ssh, f"curl -skI {pin} https://{PAY_DOMAIN}/ | grep -i '^permissions-policy'", check=False)
    log(f"  {out.strip() or 'Permissions-Policy MISSING'}")
    _, out, _ = sh(ssh, f"curl -s -o /dev/null -w '%{{http_code}} %{{redirect_url}}' "
                        f"--resolve {PAY_DOMAIN}:80:127.0.0.1 http://{PAY_DOMAIN}/", check=False)
    log(f"  http -> {out.strip()}  (expect 301 to https)")
    check("through Cloudflare /", _code(ssh, f"https://{PAY_DOMAIN}/"), "200")
    _, out, _ = sh(ssh, f"curl -s https://{PAY_DOMAIN}/ | grep -o '<title>[^<]*' | head -1", check=False)
    log(f"  through Cloudflare title: {out.strip().replace('<title>', '')}")

    log("  -- isolation --")
    rc, _, _ = sh(ssh, f"runuser -u {PAY_USER} -- cat /var/www/sinegualerts/api/.env >/dev/null 2>&1", check=False)
    check("pixelpay reading Pixel Alpha api/.env", "denied" if rc != 0 else "READABLE", "denied")
    rc, _, _ = sh(ssh, f"runuser -u {PAY_USER} -- cat /var/www/sinegualerts/engine/.env >/dev/null 2>&1", check=False)
    check("pixelpay reading the engine .env", "denied" if rc != 0 else "READABLE", "denied")
    rc, _, _ = sh(ssh, f"runuser -u www-data -- cat {PAY_ENV} >/dev/null 2>&1", check=False)
    check("www-data reading Pixel Pay .env", "denied" if rc != 0 else "READABLE", "denied")
    _, out, _ = sh(ssh, f"mysql -N -e \"SHOW GRANTS FOR '{PAY_DB_USER}'@'localhost';\"", check=False)
    check("pixelpay MySQL grants mention sinegu_crypto", "yes" if PIXEL_ALPHA_DB in out else "no", "no")
    _, out, _ = sh(ssh, "ps -o user= -C php-fpm8.3 | sort | uniq -c | tr -s ' ' | tr '\\n' ';'", check=False)
    log(f"  php-fpm processes by user: {out.strip()}")
    log("  " + _pixel_alpha_db_fingerprint(ssh))

    log("\n  -- Pixel Alpha must be unaffected --")
    d.do_verify_tls(ssh)
    if fails:
        raise RuntimeError("verify failed: " + ", ".join(fails))
    log("=== VERIFY OK ===\n")


def do_full(ssh):
    do_backup(ssh)
    ssh = do_deploy_web(ssh)
    ssh = do_deploy_api(ssh)
    do_verify(ssh)
    return ssh


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "inspect"
    dispatch = {
        "inspect": do_inspect, "provision": do_provision, "provision-db": do_provision_db,
        "nginx": do_nginx, "tls": do_tls, "backup": do_backup, "deploy-web": do_deploy_web,
        "deploy-api": do_deploy_api, "create-admin": do_create_admin, "verify": do_verify,
        "full": do_full,
    }
    fn = dispatch.get(cmd)
    if fn is None:
        sys.exit(f"unknown command: {cmd} (choose {sorted(dispatch)})")
    log(f"### Pixel Pay -> {d.HOST} {PAY_PARENT} | cmd={cmd}\n")
    ssh = d.connect()
    d._SSH["client"] = ssh
    try:
        fn(d._current(ssh))
    finally:
        try:
            d._current(ssh).close()
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
