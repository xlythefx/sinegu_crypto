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
    title: 'Run the end-to-end rehearsal, then set the mainnet receiving address',
    added: '2026-08-16',
    why: 'TRON_MAINNET_ADDRESS is where real customer money lands. It stays empty — every entry point answers "not configured" — until the flow has been proven on Nile.',
    steps: [
      'As a developer account, open an invoice → Pay → USDT (TRC-20), send the exact amount from a Nile wallet, and watch it settle within a few minutes (Admin → Crypto Transfers shows the scan).',
      'Create the real mainnet wallet (hardware-backed if possible) and put its address in TRON_MAINNET_ADDRESS. Double-check it: a mistyped receiving address loses money silently.',
      'Run sync-api-env to mirror the TRON_* addresses to prod.',
    ],
    envKeys: ['TRON_MAINNET_ADDRESS'],
  },
  {
    id: 'tron-measure-withdrawal-fees',
    feature: 'TRON payments',
    kind: 'decision',
    title: 'Measure a real withdrawal from each exchange before opening the rail to customers',
    added: '2026-08-16',
    why: 'Exchanges deduct their withdrawal fee from the amount the customer typed, so payments arrive short. The tolerance band and the (currently off) decimals fingerprint depend on how much is deducted and how many decimals survive — that has to be measured, not assumed.',
    steps: [
      'Withdraw a small USDT amount over TRC-20 from Binance, Bybit and MEXC to a wallet you control; note the fee deducted and the decimals that arrived for each.',
      'Decide whether the fingerprint (fingerprint_units) can ever be turned on, and whether the shortfall band max($1.00, 1%) is right.',
      'Only then set TRON_PUBLIC=true on prod (and later PAYMENTS_DEFAULT_PROVIDER=tron). Both are set on the box by hand — the deploy script never mirrors rollout switches.',
    ],
    envKeys: ['TRON_PUBLIC', 'PAYMENTS_DEFAULT_PROVIDER'],
  },

  // ── Account emails (2026-09-23) ──────────────────────────────────────────
  {
    id: 'mail-sender',
    feature: 'Account emails',
    kind: 'action',
    title: 'Configure a real mail sender — nothing is delivered until you do',
    added: '2026-09-23',
    why: 'MAIL_MAILER is `log` on prod, so every email the API produces is written to storage/logs and never sent — the password reset code included. The registration notice and the approval email are built and wired; they stay in the log file until a transport exists.',
    steps: [
      'Pick the sender. Fastest: a Gmail account with 2FA on → Google Account → Security → App passwords → generate one for "Mail" (MAIL_HOST=smtp.gmail.com, MAIL_PORT=587, MAIL_SCHEME=tls, MAIL_USERNAME = that address, MAIL_PASSWORD = the 16-character app password). Better for deliverability: Resend or Postmark with pixel-alpha.com verified (SPF + DKIM), which stops approval emails landing in spam.',
      'Put MAIL_HOST / MAIL_PORT / MAIL_SCHEME / MAIL_USERNAME / MAIL_PASSWORD / MAIL_FROM_ADDRESS in the LOCAL sinegutrade-api/.env, then run: python .claude/deploy_sinegualcrypto.py sync-api-env (it mirrors them and re-runs config:cache — without that a new key stays invisible to every request).',
      'On the server only, set MAIL_MAILER=smtp in /var/www/sinegualerts/api/.env and re-run php artisan config:cache. The transport is deliberately never mirrored, so a developer testing locally with `log` cannot switch prod off.',
      'Verify end to end: register a throwaway account and check the notice arrives, then approve it from Admin → Users and check the approval email arrives. Preview the designs any time without sending: php artisan mail:preview.',
      'If a real sender is not wanted yet, keep MAIL_MAILER=log — everything still works, the messages just sit in storage/logs/laravel.log.',
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
      { label: 'Google app passwords', href: 'https://myaccount.google.com/apppasswords' },
      { label: 'Resend', href: 'https://resend.com' },
    ],
  },
  {
    id: 'mail-admin-address',
    feature: 'Account emails',
    kind: 'decision',
    title: 'Which inbox works the approval queue',
    added: '2026-09-23',
    why: 'Every "someone registered and is waiting" notice goes to exactly one address (MAIL_ADMIN_ADDRESS). A personal inbox works today; it becomes a single point of failure the moment more than one person approves users, and an address nobody reads means registrations sit pending.',
    steps: [
      'Today it is set to the owner\'s personal address (set in .env, deliberately never committed — both repos are public).',
      'Decide whether it should move to a shared desk (e.g. the support mailbox, or an alias that fans out) before sign-ups pick up.',
      'Changing it is one env key plus sync-api-env — no code, no deploy of the app itself.',
    ],
    envKeys: ['MAIL_ADMIN_ADDRESS'],
  },

  // ── MEXC (live on prod since 2026-09-17) ─────────────────────────────────
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
]

/** Every distinct feature name, in first-seen order — the page's filter pills. */
export function adminTodoFeatures(items: AdminTodo[] = ADMIN_TODOS): string[] {
  const seen: string[] = []
  for (const item of items) {
    if (!seen.includes(item.feature)) seen.push(item.feature)
  }
  return seen
}
