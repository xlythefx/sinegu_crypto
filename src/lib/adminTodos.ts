import type { AdminTodo } from '../types/adminTodos'

/**
 * Admin → To be Done — the owner's list.
 *
 * Every item here is something a feature left for the OWNER: a registration
 * at a third party, a key to paste, a command to run on prod by hand, or a
 * product decision nobody else can make. Whoever builds the feature appends
 * the item in the same change (see CLAUDE.md, "Owner to-do list"), with a
 * stable slug, the date, why it matters and the exact steps.
 *
 * Rules:
 *  - NEVER a secret. This repo is public on GitHub; steps say WHERE a value
 *    comes from and WHICH env key it goes in, never the value.
 *  - Items are never marked done in code. The owner ticks them off on the
 *    page, and the note beside a decision is where the outcome is recorded.
 *  - Remove an item only when its feature is removed; a done item stays so
 *    the note and the date it was settled stay readable.
 */
export const ADMIN_TODOS: AdminTodo[] = [
  // ── Sign in with Discord + server roles (2026-09-21) ────────────────────
  {
    id: 'discord-register-app',
    feature: 'Discord login',
    kind: 'action',
    title: 'Register the Pixel Alpha app in the Discord Developer Portal',
    added: '2026-09-21',
    why: 'Without a client id and secret the "Continue with Discord" flow cannot run at all. The code is deployed and dormant until these two values exist.',
    steps: [
      'Open the Discord Developer Portal → Applications → New Application, name it "Pixel Alpha".',
      'OAuth2 → General: copy the Client ID into DISCORD_CLIENT_ID and Reset Secret → copy it into DISCORD_CLIENT_SECRET (local sinegutrade-api/.env).',
      'OAuth2 → Redirects: add BOTH https://pixel-alpha.com/auth/discord/callback and http://localhost:5173/auth/discord/callback (they must match DISCORD_REDIRECT_URIS exactly).',
      'Leave DISCORD_LOGIN_PUBLIC=false for now — the flow works at /auth/discord/start while the button stays hidden.',
    ],
    envKeys: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URIS', 'DISCORD_LOGIN_PUBLIC'],
    links: [{ label: 'Discord Developer Portal', href: 'https://discord.com/developers/applications' }],
  },
  {
    id: 'discord-create-bot',
    feature: 'Discord login',
    kind: 'action',
    title: 'Create the bot, invite it to the server, put its role above the ones it assigns',
    added: '2026-09-21',
    why: 'The bot is what joins a user to the server and grants their roles. Login works without it; nobody gets a role until it exists.',
    steps: [
      'In the same application: Bot → Reset Token → copy it into DISCORD_BOT_TOKEN. Under Privileged Gateway Intents nothing needs enabling.',
      'OAuth2 → URL Generator: scope "bot", permissions "Create Instant Invite" + "Manage Roles" (integer 268435457). Open the generated URL and add the bot to the Pixel Alpha server.',
      'Server Settings → Roles: create the roles you decided on (e.g. Member, Trader). Drag the bot\'s own role ABOVE them in the list — a bot can only assign roles beneath its own.',
      'User Settings → Advanced → Developer Mode on. Right-click the server icon → Copy Server ID into DISCORD_GUILD_ID; right-click each role → Copy Role ID into DISCORD_ROLE_MEMBER_ID / DISCORD_ROLE_TRADER_ID.',
      'Server Settings → Safety Setup: keep Membership Screening OFF, or users the bot joins sit as "pending" and never see the channels.',
    ],
    envKeys: ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID', 'DISCORD_ROLE_MEMBER_ID', 'DISCORD_ROLE_TRADER_ID'],
    links: [{ label: 'Discord Developer Portal', href: 'https://discord.com/developers/applications' }],
  },
  {
    id: 'discord-decide-roles',
    feature: 'Discord login',
    kind: 'decision',
    title: 'Which server roles are granted automatically, and what they are called',
    added: '2026-09-21',
    why: 'The code grants one role while an account is approved ("Member") and another while a live exchange account is connected ("Trader"), and removes both on suspension. The names, and whether you want both, are yours to choose — leave a role id empty to switch that rule off.',
    steps: [
      'Decide: one role (approved members only) or two (members + live traders)?',
      'Decide the role names and colours in the server; the app only knows their ids.',
      'Decide whether a demo/testnet account should count for Trader (today it does not — live keys only).',
      'Write the outcome in the note below, then fill the role ids in the bot item.',
    ],
  },
  {
    id: 'discord-rollout',
    feature: 'Discord login',
    kind: 'action',
    title: 'Push the keys to prod, rehearse with a developer account, then make the button public',
    added: '2026-09-21',
    why: 'The button on /auth is hidden until DISCORD_LOGIN_PUBLIC=true on prod. Rehearsing first means the first customer to see it is not the first person to try it.',
    steps: [
      'With the keys in the local sinegutrade-api/.env, run: python .claude/deploy_sinegualcrypto.py sync-api-env (mirrors the DISCORD_* identity keys and re-caches config).',
      'Open https://pixel-alpha.com/auth/discord/start with a developer\'s Discord: you should land in the server; approve the account in Admin → User Management and the Member role should appear; connect a live key → Trader; disconnect → gone.',
      'On the box: php artisan discord:sync-roles --dry-run, then without --dry-run once.',
      'Set DISCORD_LOGIN_PUBLIC=true in the prod api/.env by hand, then php artisan config:cache and reload php-fpm. The button appears on /auth.',
    ],
    envKeys: ['DISCORD_LOGIN_PUBLIC'],
  },

  // ── Direct USDT-TRC20 payments (built 2026-08-16, still dark) ─────────────
  {
    id: 'tron-nile-wallet',
    feature: 'TRON payments',
    kind: 'action',
    title: 'Create a Nile testnet wallet and look up the Nile USDT contract',
    added: '2026-08-16',
    why: 'Developer accounts pay on Nile, on every box including prod. Without a Nile address the rehearsal below cannot happen.',
    steps: [
      'Create a TRON wallet (TronLink) and switch it to the Nile testnet; copy its address into TRON_NILE_ADDRESS.',
      'Find the Nile test-USDT contract on nile.tronscan.org and put it in TRON_NILE_USDT_CONTRACT — there is deliberately no default.',
      'Optionally create a TronGrid API key for TRON_NILE_API_KEY (rate limits only).',
    ],
    envKeys: ['TRON_NILE_ADDRESS', 'TRON_NILE_USDT_CONTRACT', 'TRON_NILE_API_KEY'],
    links: [{ label: 'Nile Tronscan', href: 'https://nile.tronscan.org' }],
  },
  {
    id: 'tron-rehearse-and-mainnet-address',
    feature: 'TRON payments',
    kind: 'action',
    title: 'Switch the TRON rail on for prod, then pay one real invoice yourself',
    added: '2026-08-16',
    why: 'Coinsbuy is hidden, so TRON is now the ONLY way a customer can pay an invoice. The receiving wallet is set locally and validated (base58check), but until the two rollout switches are set on the server a customer opening the pay sheet reads "Crypto payments are not configured on this server yet" — and cannot pay at all.',
    steps: [
      'Deploy, then run sync-api-env to push TRON_MAINNET_ADDRESS to prod (the address is mirrored; the switches below are not).',
      'On the server set TRON_PUBLIC=true and PAYMENTS_DEFAULT_PROVIDER=tron in /var/www/sinegualerts/api/.env, then php artisan config:cache. Nothing is visible to customers until TRON_PUBLIC is true.',
      'Confirm the scheduler is alive: Admin → Crypto Transfers shows last_scan_at per network. A dead cron silently stops every invoice settling — the watcher is the only thing that notices a payment.',
      'Rehearse on MAINNET, not Nile: a developer account is pinned to Nile on purpose, so temporarily set TRON_DEVELOPER_NETWORK=mainnet, create a small invoice, send ~2 USDT from the TronLink wallet, watch it settle, then set it back to nile.',
      'Keep the wallet seed backed up (lose it and customer money is unrecoverable) and keep some TRX in it — receiving costs nothing, moving funds out needs gas.',
    ],
    envKeys: ['TRON_MAINNET_ADDRESS', 'TRON_PUBLIC', 'PAYMENTS_DEFAULT_PROVIDER', 'TRON_DEVELOPER_NETWORK'],
  },
  {
    id: 'tron-measure-withdrawal-fees',
    feature: 'TRON payments',
    kind: 'decision',
    title: 'Measure a real withdrawal from each exchange — the rail is now live without it',
    added: '2026-08-16',
    why: 'Exchanges deduct their withdrawal fee from the amount the customer typed, so a payment sent from an exchange ARRIVES SHORT. We settle automatically only within max($1.00, 1%) of the invoice; anything shorter than that waits for you in Admin → Crypto Transfers. Since TRON is now the only payment method, this is what decides how many invoices you settle by hand — a 1 USDT fee sits exactly on the $1.00 floor and still settles, but a 2 USDT fee only clears on invoices of $200 or more, where 1% has overtaken the floor.',
    steps: [
      'Withdraw a small USDT amount over TRC-20 from Binance, Bybit and MEXC to a wallet you control; note the fee deducted and the decimals that arrived for each.',
      'Decide whether the shortfall band max($1.00, 1%) should be widened, and whether the decimals fingerprint (fingerprint_units) can ever be turned on — you get one or the other, never both.',
      'Until then, watch Admin → Crypto Transfers: an unmatched payment is not lost, it just needs attributing by hand.',
    ],
    envKeys: ['TRON_PUBLIC', 'PAYMENTS_DEFAULT_PROVIDER'],
  },

  // ── Account emails (2026-09-23) ──────────────────────────────────────────
  {
    id: 'mail-sender',
    feature: 'Account emails',
    kind: 'action',
    title: 'Paste the support@pixel-alpha.com mailbox password — the only missing piece',
    added: '2026-09-23',
    why: 'Everything else is configured. MAIL_MAILER is `log`, so every email the API produces is written to storage/logs and never sent — the password reset code included. The mailbox already exists (pixel-alpha.com\'s MX points at Hostinger and SPF already authorises it), so no third-party signup is needed: only its password, which nobody but you has.',
    steps: [
      'hPanel → Emails → pixel-alpha.com → support@pixel-alpha.com. Take the mailbox password (reset it there if it is not to hand) and confirm the SMTP settings under "Configuration settings" — expected smtp.hostinger.com, port 465, SSL.',
      'Put it in MAIL_PASSWORD in the LOCAL sinegutrade-api/.env (host, port, scheme, username and from-address are already filled in). Then run: python .claude/deploy_sinegualcrypto.py sync-api-env — it mirrors them to prod and re-runs config:cache, without which a new key stays invisible to every request.',
      'On the server only, set MAIL_MAILER=smtp in /var/www/sinegualerts/api/.env and re-run php artisan config:cache. The transport is deliberately never mirrored, so a developer testing locally with `log` cannot switch prod off.',
      'Verify end to end: register a throwaway account (the notice lands in the support mailbox), approve it from Admin → Users, and check the approval email arrives — in the inbox, not in spam.',
      'If it lands in spam: the domain publishes SPF but DKIM was not found on the usual selectors. Turn DKIM on in hPanel and add the record it gives you to Cloudflare DNS, then add a DMARC record (_dmarc TXT, v=DMARC1; p=none; rua=mailto:support@pixel-alpha.com). Hostinger mailboxes also carry a daily send limit by plan — fine for approvals, worth checking before any bulk reminder run.',
      'Not ready? Leave MAIL_MAILER=log. Everything keeps working; the messages just sit in storage/logs/laravel.log. Preview the designs any time without sending: php artisan mail:preview.',
    ],
    envKeys: [
      'MAIL_MAILER',
      'MAIL_HOST',
      'MAIL_PORT',
      'MAIL_SCHEME',
      'MAIL_USERNAME',
      'MAIL_PASSWORD',
      'MAIL_FROM_ADDRESS',
      'MAIL_ADMIN_ADDRESS',
    ],
    links: [
      { label: 'Hostinger hPanel — Emails', href: 'https://hpanel.hostinger.com/' },
      { label: 'Cloudflare DNS', href: 'https://dash.cloudflare.com/' },
    ],
  },

  // ── MEXC (live on prod since 2026-09-17) ─────────────────────────────────
  {
    id: 'mexc-open-to-customers',
    feature: 'MEXC',
    kind: 'decision',
    title: 'When MEXC opens to customers',
    added: '2026-09-23',
    why: 'MEXC trades, bills and syncs like Binance, but only admin / master / developer accounts may connect one — customers see "Coming soon". Nothing opens it by itself: until you decide, every MEXC signal only ever reaches staff accounts.',
    steps: [
      'Prove it on a real (non-testnet) staff account first: a full round trip, the fee receipts landing, and the funding sign confirmed (see the funding item below).',
      'To open MEXC ALONE: on the server set EXCHANGES_STAFF_ONLY=bybit in /var/www/sinegualerts/api/.env and run php artisan config:cache. Nothing else — no deploy, no code change. Note the CSV: since Bybit landed on 2026-09-24 the key lists BOTH closed venues, so clearing it entirely would open Bybit at the same time. Setting it back to `mexc,bybit` closes both again, and accounts already connected keep trading either way.',
      'Connecting the MASTER account to MEXC is a separate switch with its own consequence: it is what turns on MEXC Telegram recaps and the PnL line on MEXC close messages, which stay silent while the master has no account there.',
    ],
    envKeys: ['EXCHANGES_STAFF_ONLY'],
  },
  {
    id: 'mexc-verify-funding-sign',
    feature: 'MEXC',
    kind: 'action',
    title: 'Check the sign of MEXC funding fees on the first position held across a funding time',
    added: '2026-09-17',
    why: 'Every other MEXC figure was verified on the testnet, but no funding settlement fell inside the test position\'s lifetime. Until one is seen live, a funded row\'s fee could be attributed with the wrong sign.',
    steps: [
      'Wait for a MEXC position that is open across 00:00, 08:00 or 16:00 UTC.',
      'Compare the funding line on that close (Admin → Trading Positions, Fee column) with the MEXC app\'s own funding history for the same position.',
      'If the sign is inverted, fix it in the engine\'s MEXC adapter (fetch_mexc_history) and re-run fees:reconcile.',
    ],
  },

  // ── Bybit (2026-09-24) ──────────────────────────────────────────────────
  {
    id: 'bybit-demo-round-trip',
    feature: 'Bybit',
    kind: 'action',
    title: 'Run the Bybit demo round trip and settle whether closed P&L is net of fees',
    added: '2026-09-24',
    why: 'Bybit is built but has never placed a real order. One number is still unverified and it decides whether customers are billed correctly: the engine posts realized P&L GROSS and the API nets the fee once on ingest, so if Bybit\'s closed P&L already has fees taken out, every Bybit trade is netted twice. The code is written so a wrong answer degrades rather than corrupting (it prefers exit value minus entry value, which is gross by definition), but it must be measured before real money.',
    steps: [
      'Sign in to bybit.com, switch to Demo Trading from the account menu, and create an API key INSIDE Demo Trading with Unified Trading → Trade. Demo keys are not the live ones.',
      'Fund the demo balance from that screen, then run trading-flask/bybit_smoke.py with the key in the environment (never in a file).',
      'Start at least 20 minutes clear of 00:00 / 08:00 / 16:00 UTC so no funding settlement lands inside the position — it would contaminate the comparison.',
      'The run opens and closes one small BTCUSDT position and prints the four figures. If the netted P&L matches the demo wallet\'s change to the cent, the reading is right; if not, do not enable Bybit and report what it printed.',
      'Then hold a second position ACROSS a funding time to check the funding sign, exactly as the MEXC item below describes. Bybit reports funding as a fee (positive = paid), which is the opposite basis from Binance and MEXC — the code assumes that and it needs one live confirmation.',
    ],
  },
  {
    id: 'bybit-seed-assets',
    feature: 'Bybit',
    kind: 'action',
    title: 'Seed the Bybit asset rows before the first signal',
    added: '2026-09-24',
    why: 'Entries fail CLOSED on an unconfigured asset, so without these rows every Bybit signal is rejected — silently, as a skip rather than an error.',
    steps: [
      'Open Admin → Assets and add a row per ticker Bybit should trade, with Broker set to Bybit.',
      'Copy the base size and max size from the matching Binance row unless you want Bybit sized differently.',
      'Bybit symbols are the same form as Binance (BTCUSDT, no separator), so the ticker is entered exactly as it is there.',
    ],
  },
  {
    id: 'bybit-enable-on-the-box',
    feature: 'Bybit',
    kind: 'action',
    title: 'Switch Bybit on in the engine (config only, no deploy)',
    added: '2026-09-24',
    why: 'Bybit ships DARK: the tables, the adapter and the UI are deployed, but the engine does not trade it and the webhook path answers 400 until this is set. That is deliberate — enabling a venue is a decision made on the box, which is why the key is not mirrored by the deploy script.',
    steps: [
      'Do the demo round trip first (see the item above). Do not skip it.',
      'On the server, set BINANCE_ABCD_EXCHANGES=binance,mexc,bybit in /var/www/sinegualerts/engine/.env and restart the engine service.',
      'Check the engine log line at startup: it prints the enabled venues and their webhook paths. Bybit should be listed.',
      'Confirm nginx proxies /bybit_abcd_webhook — the deploy script already includes it, so this only needs checking if the vhost was edited by hand.',
    ],
    envKeys: ['BINANCE_ABCD_EXCHANGES'],
  },
  {
    id: 'bybit-tradingview-alerts',
    feature: 'Bybit',
    kind: 'action',
    title: 'Point a TradingView alert at the Bybit webhook',
    added: '2026-09-24',
    why: 'The URL an alert posts to is what decides which venue trades — there is no field in the payload for it. A strategy that should run on Bybit as well as Binance needs its own alert with the same message body.',
    steps: [
      'Create the alert as usual and set the webhook URL to https://pixel-alpha.com/bybit_abcd_webhook.',
      'Use the same message block as the Binance alerts, with the same secret (one engine serves every venue). The ready-to-paste copy is in the gitignored .claude/tradingview.creds.md.',
      'A chart on Bybit sends {{ticker}} as BYBIT:BTCUSDT.P; the engine strips the prefix and the .P, so the message needs no change.',
    ],
  },
  {
    id: 'bybit-master-account',
    feature: 'Bybit',
    kind: 'decision',
    title: 'Whether to connect the master account on Bybit',
    added: '2026-09-24',
    why: 'The public channel publishes the MASTER account\'s figures alone. Until the master has a Bybit account, Bybit closes are announced with NO P&L percentage and Bybit gets no daily/weekly/monthly recap at all — the same state MEXC is in. That is correct behaviour, not a bug, but it is a choice worth making deliberately rather than discovering in the channel.',
    steps: [
      'Decide whether Bybit should appear in the public track record and the recaps at all.',
      'If yes: connect the master account on Bybit the same way as any other, and both turn on by themselves.',
      'If no: nothing to do — record the decision in the note here so the silence is not read later as a fault.',
    ],
  },
  {
    id: 'bybit-open-to-customers',
    feature: 'Bybit',
    kind: 'decision',
    title: 'When Bybit opens to customers',
    added: '2026-09-24',
    why: 'Bybit trades and syncs like the others, but only admin / master / developer accounts may connect one — customers see "Coming soon". Nothing opens it by itself.',
    steps: [
      'Prove it on a real (non-demo) staff account first: a full round trip, the fee receipts landing, and the funding sign confirmed.',
      'To open it: on the server set EXCHANGES_STAFF_ONLY=mexc in /var/www/sinegualerts/api/.env and run php artisan config:cache. That leaves MEXC closed and opens Bybit; clearing the key entirely would open both.',
      'The landing-page and FAQ copy still says Bybit is coming soon — that is deliberate while it is staff-only, and it is a frontend change to make when it opens.',
    ],
    envKeys: ['EXCHANGES_STAFF_ONLY'],
  },
]

/** Every distinct feature name, in first-seen order — the page's filter pills. */
export function adminTodoFeatures(items: AdminTodo[] = ADMIN_TODOS): string[] {
  const seen: string[] = []
  for (const item of items) {
    if (!seen.includes(item.feature)) seen.push(item.feature)
  }
  return seen
}
