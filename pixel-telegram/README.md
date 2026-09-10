# pixel-telegram

Ops alerts for the Pixel Alpha VPS, posted into the private Telegram group
**Pixel Alpha Admin Control**.

It answers one question — *is the box healthy, and did anything restart?* —
without anyone having to SSH in. Three feeds land in that group:

| Feed | Source | Cadence |
|---|---|---|
| VPS system resources | this package | every 4 hours |
| Service restarts / outages | this package | within ~2 minutes |
| Engine restarts + trading errors | the engine's `notify.py` | as they happen |

The third one needs no code here: the engine already routes its ops alerts
through `_admin_chat()`. Pointing `BINANCE_ABCD_TELEGRAM_ADMIN_CHAT_ID` at the
group is what moves them off the public "Voltrax Trades" channel.

## Deliberately standalone

This package **does not import `binance_abcd`**, does not share its venv, and
runs from its own systemd timers. The situation it exists for is the engine
being the thing that is down — a reporter living inside the engine goes quiet at
exactly the moment it is needed.

## Commands

```bash
python -m pixel_telegram.main report      # the 4-hourly snapshot
python -m pixel_telegram.main watch       # silent unless something changed
python -m pixel_telegram.main test        # one line, to prove the chat id works
python -m pixel_telegram.main chat-id     # print the chat ids the bot can see
python -m pytest tests -q                 # 28 tests, no network
```

`--dry` prints the message instead of sending it, so the whole thing is
reviewable on Windows before any credentials exist. Off Linux the services
section reads "not readable here" — there is no systemctl to ask.

## What it posts

```
🖥 Pixel Alpha VPS
Fri 04 Sep 2026 · 10:23

🟢 CPU  ░░░░░░░░░░ 4%
🟢 RAM  █████░░░░░ 52%  (20.9/39.9 GB)
🔴 Disk ██████████ 96%  (446.3/464.7 GB)
⏱ Uptime 6d 23h · load 0.42 0.31 0.28

Services
🟢 Pixel Alpha engine · up 2d 4h
🟢 Web server (nginx) · up 12d
🟢 API runtime (php-fpm) · up 12d

🤖 engine: pollers 4 · retry queue 0
```

`watch` posts nothing at all on a quiet tick. When something moves:

```
⚠️ Pixel Alpha VPS

♻️ Pixel Alpha engine restarted · running 1m
🔴 Disk 96% — over the 90% threshold on Pixel Alpha VPS
```

## Rules that make it survivable

- **The first run seeds state silently.** A unit is only announced as restarted
  once it has been *seen* before — otherwise the deploy itself would report
  every service on the box as freshly restarted. The one exception is a unit
  that is already down on the first run: that is the report, not noise.
- **A restart is `ActiveEnterTimestampMonotonic` changing**, not the human
  `ActiveEnterTimestamp` string (locale- and timezone-formatted, and it would
  have to be parsed back). Monotonic resets on reboot, so a reboot correctly
  reads as "everything restarted".
- **One alert per metric per hour**, and a metric that drops back under its
  threshold clears its cooldown — a recovery re-arms immediately rather than
  the box staying quiet for the rest of the hour.
- **A service that is down alerts once per state change, not every tick.**
  Repeating it every two minutes is how a group gets muted.
- **Nothing here raises on failure.** An unreadable unit reports as `unknown`,
  an unreachable Telegram logs and exits 1, a truncated state file is treated
  as empty. A monitoring job that crashes needs its own monitor.

## Configuration

Every key is `PIXEL_TG_*`, read from `pixel-telegram/.env` — see `.env.example`
for the annotated list. **The token lives there and nowhere else**: this repo is
public on GitHub, and `.env`, `.venv/` and `state/` are gitignored.

The bot is the same one that posts to the public channel. To reach a group it
must be **added to that group as an admin** (a non-admin bot with privacy mode
on cannot even see it). Then send any message there and run
`python -m pixel_telegram.main chat-id`. A supergroup id is negative and starts
`-100`; a plain group id is negative without that prefix and **changes** if the
group is later upgraded to a supergroup — re-run `chat-id` if messages stop.

`PIXEL_TG_UNITS` is a list of `unit=Label` pairs, and the two halves are
deliberately different things. The **unit** is an address systemctl has to
resolve: the engine's service really is called `sinegualerts-engine` on the box,
and renaming it would break the deploy script, the sudoers rule and the journal
reads. The **label** is what a person reads in Telegram, and there it says
Pixel Alpha — the same rule the rest of the product follows. Drop the `=Label`
half and the unit name is shown as-is.

State is keyed by the unit, never the label, so renaming what a service is
*called* does not make it look brand new and re-announce itself as restarted.

It is env-driven rather than hardcoded because the php-fpm unit carries the PHP
version in its name. Confirm it on the box with `systemctl list-units 'php*-fpm*'`.

## Deployment

Lives at `/var/www/sinegualerts/telegram` on the VPS, driven by two `oneshot`
units and their timers:

```
pixel-telegram.timer          OnCalendar=00/4:00, Persistent=true
pixel-telegram-watch.timer    OnBootSec=2min, OnUnitActiveSec=2min
```

`Persistent=true` fires a missed 4-hour tick after a reboot instead of silently
skipping it. Timers rather than cron because everything else on this box is
systemd-managed, so `journalctl -u pixel-telegram` works the same way it does
for the engine.

```bash
python .claude/deploy_sinegualcrypto.py deploy-telegram     # code + units + timers
python .claude/deploy_sinegualcrypto.py sync-telegram-env   # config only, no code
```

Both mirror `PIXEL_TG_BOT_TOKEN` / `PIXEL_TG_CHAT_ID` / `PIXEL_TG_UNITS` from
the local `.env` — the same rule as the engine's `MIRRORED_ENGINE_ENV_KEYS`,
for the same reason: those describe the product, so prod differing from local is
always a mistake. Only key names are ever logged.
