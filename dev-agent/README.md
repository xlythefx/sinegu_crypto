# dev-agent — the developer agent on Christian's PC

Works the error bot's jobs (@errorpixel_bot): a tap on **Investigate on my PC**
under a problem, or anything typed to the bot. For each job it makes fresh git
worktrees of both repos, runs Claude Code headless on this PC's Claude
subscription with the read-only `pixel` data connector, and, when code must
change, pushes a `devbot/job-<id>` branch and opens a pull request. The bot
sends the summary and the link. **Nothing is merged or deployed here.**

- It **dials out** (polls `https://pixel-alpha.com/api/devbot/agent/claim`
  every 10 s), so no tunnel and no open port.
- Tools: read, edit, run tests, commit. Never push (the agent script pushes after
  its checks), deploy, SSH, curl, or read `.env` / creds files.
- Both repos are public: a change mentioning any private string the server lists
  (people's names, emails, customers' account names) is NOT pushed.
- A pull request is only opened when local `main` is not ahead of GitHub,
  otherwise it would carry unrelated commits.

## Setup

1. `dev-agent/.env` from `.env.example` (gitignored): `DEV_AGENT_KEY` = the
   server's `DEV_BOT_AGENT_KEY`; `DEV_AGENT_MCP_KEY` = a read-only `pxa_` key.
2. `claude` logged in (subscription). Optional: `gh auth login` so pull requests
   open themselves; without it the bot sends a pre-filled "open a pull request" link.
3. `powershell -File dev-agent/run.ps1` (or `install-task.ps1` to start at logon).
   Log: `~/.devagent/agent.log`.

Tests: `cd dev-agent && python -m pytest test_agent.py -q`.
