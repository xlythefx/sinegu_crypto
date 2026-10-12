import type { AdminChange } from '../types/adminVersions'

/**
 * Admin → Dashboard → Versions — what changed, newest first.
 *
 * Every feature or behaviour change that ships adds an entry here IN THE SAME
 * CHANGE (see CLAUDE.md, "Versions page"). Rules:
 *  - `summary` and `howItWorks` are for the owner and their employer: plain
 *    words, real examples, no endpoint or table names. Put those in
 *    `technical`, which the page folds away.
 *  - NEVER a secret — this repo is public on GitHub.
 *  - Newest first. Old entries are not rewritten except to correct them; a
 *    later change to the same feature gets its own entry.
 */
export const ADMIN_CHANGES: AdminChange[] = [
  // ── 2026-10-13 ───────────────────────────────────────────────────────────
  {
    id: 'binance-offer-page-and-guide-part-1',
    date: '2026-10-13',
    kind: 'new',
    area: 'Website',
    title: 'Binance offer page, and a guide that starts from “I have no Binance account”',
    summary:
      'A new public page explains the Binance offer: open your Binance account through our link and pay 15% of your profit instead of 20%. The Binance setup guide now starts one step earlier — creating the Binance account itself — so someone new to Binance can get from nothing to connected on one page.',
    howItWorks: [
      'The offer page (pixel-alpha.com/binance-offer) shows the rate, a worked month — $1,000 profit is a $200 fee normally and $150 with the offer, so the customer keeps $850 instead of $800 — who qualifies, how we confirm it, and a short list of questions, including what we earn from Binance.',
      'The Binance guide is now in two parts. Part 1 is for people with no Binance account: sign up through our link (checking the Referral ID HPU7VNUZ is in the box), turn on two-factor security, verify identity, and put USDT in. Part 2 is the existing connect steps, unchanged.',
      'Someone who already has Binance presses “I already have Binance” and Part 1 folds away. The page remembers that choice and every ticked step on their device. Readers who had already ticked Part 2 steps before today see Part 1 folded automatically.',
      'Only the guide links to the offer for now. The landing-page “Learn more” and the links in the connect screen come once billing applies the 15% by itself; until then an admin confirms each customer and sets their rate by hand (see To be Done).',
    ],
    technical: [
      'lib/binanceOffer.ts holds the referral code, the URL, both rates (20 / 15) and the page copy — the one spelling for every surface. The rate applies to realized profit only.',
      'lib/binanceGuide.ts: ACCOUNT_STEPS (Part 1), CONNECT_STEPS (renamed from GUIDE_STEPS), GUIDE_PARTS. Each part numbers its own steps, so "Part 2, step 6" references stay valid.',
      'Guide page split into components/binance-guide/* and hooks/useGuideProgress.ts; the "has account" choice is stored under pa-binance-guide-has-account.',
    ],
    links: [
      { label: 'Open the offer page', href: '/binance-offer' },
      { label: 'Open the Binance guide', href: '/docs/binance' },
    ],
  },
  // ── 2026-10-12 ───────────────────────────────────────────────────────────
  {
    id: 'coin-not-listed-skip',
    date: '2026-10-12',
    kind: 'fixed',
    area: 'Signal Log',
    title: 'A coin the exchange does not list is now a clear skip, not a false alarm',
    summary:
      'When an exchange does not offer a coin, the bot now says so plainly — “not listed on MEXC Demo” or “not listed on MEXC Production” — instead of raising a red “manual action required” alert for a trade that could never exist.',
    howItWorks: [
      'Example: on 11 Oct the MEXC test account received the LTC signals, but MEXC’s demo exchange does not offer LTC at all. The buys failed, and the close was reported as “could not read positions”, retried for five minutes and escalated to a red alert, although nothing was open.',
      'Now the same signals show in the Signal Log as skipped with the reason “not listed on MEXC Demo”, and no alert is sent. On a real-money account the reason says “Production”, and the Signal Log marks it as a problem to fix.',
      'Demo and production exchanges offer different coins: MEXC’s demo lists about 155, and LTC is not one of them.',
      'Other read failures now say what actually went wrong (for example “timed out” or the exchange’s own error message) instead of only “could not read positions”.',
      'Safety rule: a close is only skipped when the exchange’s coin list was read successfully and the coin is missing from it. If the list cannot be read, the bot keeps retrying exactly as before.',
    ],
    technical: [
      'ExchangeClient.not_listed(ticker) — asked only after a read or an order failed; per-host symbol lists (MEXC contract/detail, Binance exchangeInfo with a 10-min TTL, Bybit instruments-info only when every page was read).',
      'Skip reason "not listed on {Venue} {Demo|Production}", the network read off the client’s base URL. SignalHealth: not_listed_demo (normal), not_listed (problem), positions_unreadable (problem).',
      'Each venue client records last_read_error (endpoint + HTTP status + the venue’s code and message, never the signed URL), carried into "could not read positions (…)".',
    ],
    links: [{ label: 'Open the Signal Log', href: '/admin/trade-logs' }],
  },
  // ── 2026-10-10 ───────────────────────────────────────────────────────────
  {
    id: 'assets-by-exchange',
    date: '2026-10-10',
    kind: 'improved',
    area: 'Trading assets',
    title: 'Trading Assets grouped by exchange, with logos',
    summary:
      'Trading Assets now shows Binance, MEXC and Bybit coins in their own sections, with each exchange’s logo and each coin’s logo, so the same coin on two exchanges is never confused.',
    howItWorks: [
      'Pick an exchange at the top (or All) to see only its coins. Each section shows how many coins it has and how many are switched on.',
      '“Add coin” inside a section opens the form with that exchange already chosen.',
      'Every card carries its exchange’s logo, and Litecoin and Render show their own coin logos.',
      'Each exchange’s copy of a coin keeps its own settings: size, streak steps and kill switch are set separately on Binance and on MEXC.',
      'The Streak Sizing Settings tab is grouped the same way.',
    ],
    technical: [
      'Coin logos ship in the frontend public/ folder; assets.asset_image stores the site path (/litecoin-logo.jpg), which Asset::EXTERNAL_IMAGE passes through untouched.',
      'Exchange logos live in components/exchanges/meta.ts.',
    ],
    links: [{ label: 'Trading Assets', href: '/admin/assets' }],
  },
  // ── 2026-10-09 ───────────────────────────────────────────────────────────
  {
    id: 'signal-log-health',
    date: '2026-10-09',
    kind: 'improved',
    area: 'Signal Log',
    title: 'Signal Log health check',
    summary:
      'The Signal Log now tells you at a glance whether trading is working, and separates harmless skips from real problems that need someone to act.',
    howItWorks: [
      'A banner at the top sums up the last 24 hours: green when every account traded, grey when only harmless skips happened, red when something needs attention — with a button that takes you straight to the fix.',
      'Harmless skips (nothing open to close, stack already full) show in grey. Real problems (a customer’s API key refused, an order rejected) show in red.',
      'The Issues view groups problems by cause and customer — for example “API key refused · 13 times” — so one broken key no longer fills the whole page.',
      'Filter by what happened to each account (filled, skipped, failed, problems only), by reason, or search for a customer to see only their part of each signal.',
    ],
    technical: [
      'App\\Services\\Admin\\SignalHealth::classify sorts every account outcome into a reason key + label + severity (normal | problem).',
      'GET /admin/trade-logs/health (24 h: healthy | normal | attention | quiet) and /admin/trade-logs/issues (grouped per reason + account, default last 7 days).',
      'The list takes outcome / reason / account filters (PHP over ≤3,000 signals). A master absent from the fan-out is not a missed signal.',
    ],
    links: [{ label: 'Open the Signal Log', href: '/admin/trade-logs' }],
  },
  {
    id: 'kill-switch',
    date: '2026-10-09',
    kind: 'new',
    area: 'Trading assets',
    title: 'Kill switch per coin',
    summary:
      'Each coin can switch itself off for everyone if the master account loses a set number of trades in a row.',
    howItWorks: [
      'On a coin’s Streak Sizing Settings card, set for example “switch this coin off if the master loses 3 trades in a row”.',
      'When that happens, the coin stops opening new trades for everyone. Trades that are already open still close normally on the exit signal.',
      'The team gets an email, the admin Telegram group gets a message, and a red strip appears on the Admin Overview.',
      'It stays off until someone turns it back on. From that moment it starts counting the master’s losses again from zero.',
    ],
    technical: [
      'assets.kill_switch_losses / kill_switch_armed_at / killed_at / killed_reason; App\\Services\\Assets\\KillSwitch.',
      'Checked after every past-positions sync that touched a master row; only closes after kill_switch_armed_at count. The trip is a conditional update, so it announces once.',
      'Telegram goes through the engine (POST /admin/kill-switch, admin chat only); email template team-kill-switch.',
    ],
    links: [{ label: 'Streak Sizing Settings', href: '/admin/assets?tab=streak-sizing' }],
  },
  {
    id: 'streak-step-helpers',
    date: '2026-10-09',
    kind: 'new',
    area: 'Trading assets',
    title: 'Step helpers: calculator and “Build steps for me”',
    summary:
      'Two helpers work out streak step sizes for you, so you can think in “decrease by 0.25” or “25% less” instead of final numbers.',
    howItWorks: [
      'The calculator next to each step: decrease or increase by an amount or a percentage, starting from the normal size or from the previous step.',
      '“Build steps for me” makes a whole pattern at once — for example “every 2 losses, decrease by 0.25 until 0.5” gives 0.75 after 2 losses and 0.5 after 4.',
      'The results are saved as plain numbers. If you change the normal (Base) size later, rebuild the steps.',
    ],
    technical: ['Pure math in src/lib/streakSizing.ts (applySizeChange, buildStreakSteps); calculated once, not stored as rules.'],
    links: [{ label: 'Streak Sizing Settings', href: '/admin/assets?tab=streak-sizing' }],
  },
  {
    id: 'streak-sizing',
    date: '2026-10-09',
    kind: 'new',
    area: 'Trading assets',
    title: 'Streak Sizing Settings',
    summary:
      'The bot can trade a different size after a run of losses or wins on a coin — for example a smaller size after 2 losses in a row — and goes back to the normal size when the run ends.',
    howItWorks: [
      'Per coin, add steps: pick Loss or Win, type how many in a row, and the size to use from then on.',
      'Each account follows its own trades. A win ends a losing run and a loss ends a winning run. When there is no step for the current run, the normal size is used.',
      'Sizes still grow with each account’s balance, exactly like the normal size. Only new trades change; closing a position is never affected.',
      'The “Right now” line shows how many accounts are on each step today, and “Get to know more” opens a guide with a worked example.',
    ],
    technical: [
      'asset_streak_sizes (kind loss|win, streak 1–10, size) + assets.streak_sizing_enabled; App\\Services\\Assets\\StreakSizing.',
      'GET /engine/{x}/streaks returns a signed run per account; webhook._streak_size picks the deepest step of that kind ≤ the run. An unreadable run trades base size.',
      'A size ceiling keeps any position within the asset’s max position size, even with a win size above base.',
    ],
    links: [{ label: 'Streak Sizing Settings', href: '/admin/assets?tab=streak-sizing' }],
  },
  // ── 2026-10-08 ───────────────────────────────────────────────────────────
  {
    id: 'tron-same-amount-hold',
    date: '2026-10-08',
    kind: 'improved',
    area: 'Billing',
    title: 'Crypto payments with the same amount are no longer guessed',
    summary:
      'When two customers owe the same amount and a payment arrives, the system now asks for the transaction ID instead of guessing whose it is.',
    howItWorks: [
      'If a payment could belong to more than one invoice, it is held, and each of those customers’ invoice pages asks them to paste the transaction ID from their exchange.',
      'A payment that arrives late (after the payment timer ran out) is matched the same way, instead of settling whoever else happened to be waiting.',
      'If a second customer pastes an ID that is already paying another invoice, the team gets an email and a red strip on the Overview, and the dispute is settled on Crypto Transfers.',
    ],
    technical: [
      'TronIntentService::matchCandidates (open intents + intents expired within 24 h on unpaid invoices); tron_transfers.candidate_invoice_ids.',
      'POST /payments/tron/intent/{id}/claim; tron_payment_claims.outcome = disputed → team-payment-disputed email.',
    ],
    links: [{ label: 'Crypto Transfers', href: '/admin/tron-transfers' }],
  },
  // ── 2026-10-07 ───────────────────────────────────────────────────────────
  {
    id: 'security-hardening-2026-10-07',
    date: '2026-10-07',
    kind: 'improved',
    area: 'Security',
    title: 'Security improvements across the site, the API and the bot',
    summary: 'A round of safety fixes that makes accounts and the trading bot harder to misuse.',
    howItWorks: [
      'Suspending a user now signs them out everywhere, and every sign-in expires after 30 days.',
      'Changing your email needs your password and a code sent to the new address; the old address keeps working until the code is entered.',
      'Too many wrong passwords on one account are slowed down, whichever network they come from.',
      'An account paused for an unpaid invoice cannot be reconnected on another exchange until the invoice is paid.',
      'The bot only listens on the server itself, and its admin commands have their own secret.',
    ],
    technical: ['See CLAUDE.md, “Security hardening (2026-10-07 audit)”, for the full list and the items deliberately left as they are.'],
  },
  {
    id: 'manual-close-announces',
    date: '2026-10-07',
    kind: 'fixed',
    area: 'Open positions',
    title: 'Closing the master’s position by hand now posts the exit',
    summary:
      'A manual close of the master account from the admin now posts the normal exit message to the public channel.',
    howItWorks: [
      'Before, a manual close left the channel with an entry and no exit, and the daily recap was one trade short.',
      'Closing only customers’ positions stays silent, as before.',
    ],
    links: [{ label: 'Open positions', href: '/admin?tab=positions' }],
  },
  // ── 2026-10-05 ───────────────────────────────────────────────────────────
  {
    id: 'period-return-added',
    date: '2026-10-05',
    kind: 'improved',
    area: 'Analytics',
    title: 'Period Return adds up each day’s percentage',
    summary:
      'Performance Analytics’ Period Return now adds the daily percentages together, so “yesterday 4%, the day before 1%” shows 5%.',
    howItWorks: [
      'Each day’s percentage is the one on the P&L calendar.',
      'Click the tile to see both ways side by side: added up, and compounded. The landing page and the channel recaps still compound.',
    ],
  },
  // ── 2026-10-03 ───────────────────────────────────────────────────────────
  {
    id: 'open-positions-one-step-close',
    date: '2026-10-03',
    kind: 'improved',
    area: 'Open positions',
    title: 'Closing positions is one step',
    summary:
      'On Admin → Open positions, choose Everyone, Master only or one user, then Close all.',
    howItWorks: [
      'The master’s positions are shown first; a Users view compares every account with the master.',
      'Big closes are sent in batches automatically, and positions on a venue the bot is not trading are left out so one of them cannot block the rest.',
    ],
    links: [{ label: 'Open positions', href: '/admin?tab=positions' }],
  },
  // ── 2026-10-02 ───────────────────────────────────────────────────────────
  {
    id: 'separate-pay-buttons',
    date: '2026-10-02',
    kind: 'improved',
    area: 'Billing',
    title: 'Pay with crypto and Pay with card are separate buttons',
    summary: 'Invoices now show two buttons: Pay with crypto, and Pay with Stripe (card).',
    howItWorks: [
      'Crypto opens the USDT wallet window, with an optional QR code for the address (the amount is always typed by hand).',
      'Card goes straight to Stripe’s checkout page.',
      'Every invoice is due on the 4th of the month after the month it bills.',
    ],
  },
  // ── 2026-10-01 ───────────────────────────────────────────────────────────
  {
    id: 'monthly-auto-billing',
    date: '2026-10-01',
    kind: 'new',
    area: 'Billing',
    title: 'Monthly invoices are created and chased automatically',
    summary: 'Every month the system invoices customers for the month that ended and follows up by itself.',
    howItWorks: [
      '1st: invoices for last month are created and emailed.',
      '2nd and 3rd: reminders go to everyone still unpaid.',
      '4th (the due date): unpaid accounts are paused and told why.',
      'Everything runs at 16:00 Thailand time. The master and staff accounts are never invoiced.',
    ],
    links: [{ label: 'Invoice History', href: '/admin/invoices' }],
  },
  {
    id: 'email-verification',
    date: '2026-10-01',
    kind: 'new',
    area: 'Accounts',
    title: 'New users confirm their email',
    summary: 'A new sign-up confirms their email address with a 6-digit code before they can use the app.',
    howItWorks: [
      'The code is emailed right after sign-up and works for 15 minutes; a new one can be requested after a minute.',
      'The team’s “someone registered” email and the approval queue wait until the address is confirmed.',
      'People who sign up with a verified Discord email skip the code.',
    ],
  },
]

/** Every distinct area, in first-seen order — the page's filter pills. */
export function adminChangeAreas(items: AdminChange[] = ADMIN_CHANGES): string[] {
  const seen: string[] = []
  for (const item of items) {
    if (!seen.includes(item.area)) seen.push(item.area)
  }
  return seen
}

/** "2026-10-09" → "v2026.10.09" — one version per day. */
export function versionLabel(date: string): string {
  return `v${date.replaceAll('-', '.')}`
}
