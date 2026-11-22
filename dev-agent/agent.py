"""Pixel Alpha developer agent — runs on Christian's PC (2026-11-22).

Polls the error bot's job queue on pixel-alpha.com (it dials OUT; nothing
reaches into the PC, so no tunnel), and for each job:

  1. makes a fresh git worktree of each repo on branch devbot/job-<id>, from main;
  2. runs Claude Code headless on the PC's Claude SUBSCRIPTION (no API key),
     with the read-only `pixel` MCP connector for live data and a tool
     allow-list: it can read, edit, run tests and commit — never push, deploy,
     SSH or curl;
  3. refuses to publish a change that mentions any private string the server
     lists (people's names, emails, customers' account names), because both
     GitHub repos are PUBLIC;
  4. pushes the branch and opens a pull request (gh), or hands back a
     pre-filled "open a pull request" link when gh is not installed;
  5. reports the private summary + links back; the bot relays them to the DM.

Nothing is merged or deployed here. Christian merges on GitHub.

Run:  python dev-agent/agent.py          (loop)
      python dev-agent/agent.py --once   (one claim, for testing)
Config: dev-agent/.env (gitignored) — see .env.example.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


ENV = {**load_env(HERE / ".env"), **{k: v for k, v in os.environ.items() if k.startswith("DEV_AGENT_")}}
API = ENV.get("DEV_AGENT_API", "https://pixel-alpha.com/api").rstrip("/")
KEY = ENV.get("DEV_AGENT_KEY", "")
MCP_KEY = ENV.get("DEV_AGENT_MCP_KEY", "")
MODEL = ENV.get("DEV_AGENT_MODEL", "opus")
POLL_SECONDS = int(ENV.get("DEV_AGENT_POLL_SECONDS", "10"))
CLAUDE_TIMEOUT = int(ENV.get("DEV_AGENT_CLAUDE_TIMEOUT", str(45 * 60)))
WORK = Path(ENV.get("DEV_AGENT_WORKDIR", str(Path.home() / ".devagent"))).expanduser()

# name -> (local repo, GitHub slug)
REPOS = {
    "web": (Path(ENV.get("DEV_AGENT_WEB_REPO", r"C:\Users\Xlythe\sinegual-crypto")), "xlythefx/sinegu_crypto"),
    "api": (Path(ENV.get("DEV_AGENT_API_REPO", r"C:\wamp64\www\sinegutrade-api")), "xlythefx/sinegu_crypto_api"),
}
# Installed packages a fresh worktree lacks: linked (a Windows junction), never copied.
LINKED_DIRS = {"web": ["node_modules"], "api": ["vendor"]}

ALLOWED_TOOLS = [
    "Read", "Edit", "Write", "Glob", "Grep", "TodoWrite", "mcp__pixel",
    "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)", "Bash(git show:*)",
    "Bash(git add:*)", "Bash(git commit:*)",
    "Bash(php vendor/bin/phpunit:*)", "Bash(php artisan test:*)",
    "Bash(npm run build:*)", "Bash(npm run lint:*)", "Bash(npx tsc:*)",
    "Bash(python -m pytest:*)", "Bash(ls:*)", "Bash(cd:*)",
]
DISALLOWED_TOOLS = [
    "Bash(git push:*)", "Bash(ssh:*)", "Bash(scp:*)", "Bash(curl:*)", "Bash(wget:*)",
    "Bash(python .claude/deploy_sinegualcrypto.py:*)", "Bash(python .claude/deploy_pixelpay.py:*)",
    "Read(**/.env)", "Read(**/*.creds.json)", "WebFetch",
]


def log(msg: str) -> None:
    print(time.strftime("%Y-%m-%d %H:%M:%S"), msg, flush=True)


# ---- the server ------------------------------------------------------------------

def api(method: str, path: str, body: dict | None = None) -> dict | None:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method, headers={
        "X-Devbot-Agent-Key": KEY, "Accept": "application/json",
        "Content-Type": "application/json", "User-Agent": "pixel-dev-agent/1",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        log(f"server answered {e.code} on {path}")
        return None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        log(f"server unreachable on {path}: {e}")
        return None


def progress(job_id: int, text: str) -> None:
    api("POST", f"/devbot/agent/jobs/{job_id}/progress", {"text": text})


def finish(job_id: int, ok: bool, summary: str, links: list[dict] | None = None) -> None:
    api("POST", f"/devbot/agent/jobs/{job_id}/finish", {"ok": ok, "summary": summary[:19000], "links": links or []})


# ---- git -------------------------------------------------------------------------

def git(cwd: Path, *args: str, check: bool = True) -> str:
    r = subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args[:3])} failed: {(r.stderr or r.stdout).strip()[:400]}")
    return r.stdout


def ahead_of_github(repo: Path) -> int:
    git(repo, "fetch", "-q", "origin", "main", check=False)
    out = git(repo, "rev-list", "--count", "origin/main..main", check=False).strip()
    return int(out) if out.isdigit() else 0


def make_worktrees(job_id: int) -> dict[str, Path]:
    WORK.mkdir(parents=True, exist_ok=True)
    branch = f"devbot/job-{job_id}"
    trees: dict[str, Path] = {}
    for name, (repo, _slug) in REPOS.items():
        path = WORK / "worktrees" / f"job-{job_id}-{name}"
        if path.exists():
            git(repo, "worktree", "remove", "--force", str(path), check=False)
            shutil.rmtree(path, ignore_errors=True)
        git(repo, "worktree", "prune", check=False)
        git(repo, "worktree", "add", "-B", branch, str(path), "main")
        for d in LINKED_DIRS.get(name, []):
            src, dst = repo / d, path / d
            if src.exists() and not dst.exists():
                subprocess.run(["cmd", "/c", "mklink", "/J", str(dst), str(src)], capture_output=True)
        if name == "api":
            # The API tests need an APP_KEY and nothing else from .env: give them the
            # local dev key alone, never the rest of the developer's .env.
            m = re.search(r"^APP_KEY=.*$", (repo / ".env").read_text(encoding="utf-8"), re.M) if (repo / ".env").exists() else None
            (path / ".env").write_text(f"APP_ENV=testing\n{m.group(0) if m else ''}\n", encoding="utf-8")
        trees[name] = path
    return trees


def remove_worktrees(trees: dict[str, Path]) -> None:
    for name, path in trees.items():
        repo = REPOS[name][0]
        for d in LINKED_DIRS.get(name, []):
            link = path / d
            if link.exists():
                os.rmdir(link)  # removes the junction only, never the target's contents
        git(repo, "worktree", "remove", "--force", str(path), check=False)
        shutil.rmtree(path, ignore_errors=True)


# ---- Claude ----------------------------------------------------------------------

def build_prompt(job: dict, trees: dict[str, Path]) -> str:
    return f"""You are the developer agent for Pixel Alpha, working headless on Christian's PC.
Job #{job['id']} came from the private error bot.

TASK
{job['prompt']}

CONTEXT (from the bot): {json.dumps(job.get('context') or {})}

WHERE
- {trees['web']}: the React frontend, the trading engine (trading-flask/binance_abcd) and pixel-telegram.
  Read its CLAUDE.md first: it is the project's rulebook.
- {trees['api']}: the Laravel API (sinegutrade-api).
Both are fresh git worktrees on branch devbot/job-{job['id']}, made from main.

DATA
The `pixel` MCP tools read LIVE production data (signal log, accounts, assets, invoices), read-only.
Use them to investigate (start with the guide tool). You cannot change production: no deploy, no SSH, no server writes.

RULES
1. Find the root cause first. If the code is right and the problem is configuration, the exchange or the
   customer (a key permission, a coin setting, a deposit), change NO code: say exactly what Christian should do.
2. If the code is wrong: make the smallest correct fix, add or update a test, run the relevant tests
   (API: php vendor/bin/phpunit tests/Feature/<File>.php; engine: cd trading-flask && python -m pytest tests -q;
   frontend: npm run build), and commit in the worktree you changed with a clear message. Do not push.
3. Both GitHub repos are PUBLIC. Code, tests, commit messages and the PR title/body must NEVER contain a
   customer's name, email, account name, balance, a dollar figure from production, an API key or a secret.
   Use made-up fixtures in tests.
4. Never edit .env files, deploy scripts or credentials.

FINISH with exactly one fenced json block, nothing after it:
```json
{{"summary": "...", "changed": true, "pr_title": "...", "pr_body": "..."}}
```
summary: plain words for Christian (private Telegram, names allowed): what was wrong, what you changed or what he
should do, and how sure you are. pr_title / pr_body: public and technical, no private data; empty when changed is false.
"""


def run_claude(prompt: str, trees: dict[str, Path]) -> str:
    exe = shutil.which("claude")
    if not exe:
        raise RuntimeError("Claude Code (claude) is not installed on this PC.")
    cmd = [exe, "-p", "--output-format", "json", "--permission-mode", "acceptEdits", "--model", MODEL,
           "--add-dir", str(trees["api"])]
    if MCP_KEY:
        mcp = WORK / "mcp.json"  # outside every repo: it holds the connector key
        mcp.write_text(json.dumps({"mcpServers": {"pixel": {
            "type": "http", "url": f"{API}/mcp", "headers": {"X-Api-Key": MCP_KEY}}}}), encoding="utf-8")
        cmd += ["--mcp-config", str(mcp)]
    cmd += ["--allowedTools", *ALLOWED_TOOLS, "--disallowedTools", *DISALLOWED_TOOLS]
    # Subscription, not an API key: a key in the environment would bill per token.
    env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
    r = subprocess.run(cmd, input=prompt, cwd=str(trees["web"]), env=env, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=CLAUDE_TIMEOUT)
    try:
        payload = json.loads(r.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"Claude Code did not answer properly: {(r.stderr or r.stdout).strip()[:500]}")
    if payload.get("is_error"):
        raise RuntimeError(f"Claude Code stopped: {str(payload.get('result') or payload.get('subtype'))[:500]}")
    return str(payload.get("result") or "")


def parse_verdict(text: str) -> dict:
    """The last ```json block of the answer; the raw text as the summary if there is none."""
    blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text, re.S)
    for raw in reversed(blocks):
        try:
            v = json.loads(raw)
            if isinstance(v, dict) and "summary" in v:
                return {"summary": str(v.get("summary") or ""), "changed": bool(v.get("changed")),
                        "pr_title": str(v.get("pr_title") or "").strip(), "pr_body": str(v.get("pr_body") or "").strip()}
        except json.JSONDecodeError:
            continue
    return {"summary": text.strip()[:3000] or "The agent gave no summary.", "changed": False, "pr_title": "", "pr_body": ""}


def find_private(text: str, strings: list[str]) -> list[str]:
    low = text.lower()
    return sorted({s for s in strings if s and s.lower() in low})


# ---- publishing ------------------------------------------------------------------

def open_pull_request(name: str, path: Path, branch: str, title: str, body: str) -> dict:
    slug = REPOS[name][1]
    git(path, "push", "-u", "origin", branch)
    gh = shutil.which("gh")
    if gh:
        body_file = WORK / f"pr-body-{name}.md"
        body_file.write_text(body, encoding="utf-8")
        r = subprocess.run([gh, "pr", "create", "--repo", slug, "--base", "main", "--head", branch,
                            "--title", title, "--body-file", str(body_file)],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        url = (r.stdout or "").strip().splitlines()[-1:] or [""]
        if r.returncode == 0 and url[0].startswith("https://github.com/"):
            return {"label": f"Pull request ({name})", "url": url[0]}
        log(f"gh pr create failed: {(r.stderr or '').strip()[:300]}")
    q = urllib.parse.urlencode({"quick_pull": "1", "title": title, "body": body[:1500]})
    return {"label": f"Open the pull request ({name})", "url": f"https://github.com/{slug}/compare/main...{branch}?{q}"}


def handle(job: dict) -> None:
    job_id = int(job["id"])
    branch = f"devbot/job-{job_id}"
    log(f"job #{job_id}: {job['prompt'][:120]}")
    trees: dict[str, Path] = {}
    try:
        trees = make_worktrees(job_id)
        progress(job_id, "Investigating (fresh copies of both repos, live data read-only)…")
        verdict = parse_verdict(run_claude(build_prompt(job, trees), trees))

        private = (api("GET", "/devbot/agent/private-strings") or {}).get("strings")
        links: list[dict] = []
        notes: list[str] = []
        for name, path in trees.items():
            if git(path, "status", "--porcelain").strip():
                git(path, "add", "-A")
                git(path, "commit", "-q", "-m", verdict["pr_title"] or f"Developer agent job #{job_id}")
            if int(git(path, "rev-list", "--count", f"main..{branch}").strip() or 0) == 0:
                continue
            if private is None:
                notes.append(f"{name}: change kept on branch {branch} on the PC, NOT pushed: the private-data check could not run.")
                continue
            text = git(path, "log", "-p", f"main..{branch}") + verdict["pr_title"] + verdict["pr_body"]
            hits = find_private(text, private)
            if hits:
                notes.append(f"{name}: NOT pushed: the change mentions private data ({', '.join(hits[:5])}). "
                             f"It is on branch {branch} on the PC.")
                continue
            behind = ahead_of_github(REPOS[name][0])
            if behind:
                notes.append(f"{name}: NOT pushed: your local main is {behind} commit(s) ahead of GitHub, so the pull "
                             f"request would include them. Push main first; the fix is on branch {branch} on the PC.")
                continue
            links.append(open_pull_request(name, path, branch, verdict["pr_title"] or f"Developer agent job #{job_id}",
                                           (verdict["pr_body"] or "") + f"\n\n_Prepared by the Pixel Alpha developer agent (job #{job_id})._"))

        summary = verdict["summary"] + ("\n\n" + "\n".join(notes) if notes else "")
        if not links and not notes:
            summary += "\n\nNo code change was needed."
        finish(job_id, True, summary, links)
        log(f"job #{job_id} done ({len(links)} link(s))")
    except subprocess.TimeoutExpired:
        finish(job_id, False, f"The agent ran out of time ({CLAUDE_TIMEOUT // 60} min) and stopped.")
    except Exception as e:  # noqa: BLE001 — every failure must reach the DM
        log(traceback.format_exc())
        finish(job_id, False, f"The agent hit an error: {str(e)[:800]}")
    finally:
        if trees:
            remove_worktrees(trees)


def main() -> int:
    if len(KEY) < 24:
        print("DEV_AGENT_KEY is missing: put it in dev-agent/.env (see .env.example).", file=sys.stderr)
        return 2
    once = "--once" in sys.argv
    WORK.mkdir(parents=True, exist_ok=True)
    lock = WORK / "agent.lock"
    try:
        fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
    except FileExistsError:
        pid = lock.read_text().strip()
        if pid.isdigit() and _alive(int(pid)):
            print(f"Another agent is already running (pid {pid}).", file=sys.stderr)
            return 1
        lock.write_text(str(os.getpid()))
    log(f"developer agent up — polling {API} every {POLL_SECONDS}s")
    try:
        while True:
            answer = api("POST", "/devbot/agent/claim")
            job = (answer or {}).get("job")
            if job:
                handle(job)
                continue
            if once:
                return 0
            time.sleep(POLL_SECONDS if answer is not None else 30)
    except KeyboardInterrupt:
        return 0
    finally:
        lock.unlink(missing_ok=True)


def _alive(pid: int) -> bool:
    r = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"], capture_output=True, text=True)
    return str(pid) in r.stdout


if __name__ == "__main__":
    sys.exit(main())
