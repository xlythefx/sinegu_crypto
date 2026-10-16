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
  // ── 2026-10-16 ───────────────────────────────────────────────────────────
  {
    id: 'tester-admin-access-fetch',
    date: '2026-10-16',
    kind: 'improved',
    area: 'Signals',
    title: 'Testers now have the admin portal, and a Fetch button on their Positions page',
    summary:
      'A Tester account now opens the admin portal like an Admin does, so the person running the tests can send test signals, read the Signal Log and copy webhook addresses from the same account. On their own Positions page, testers also get a Fetch button that reads their positions and balance from the exchange right away.',
    howItWorks: [
      'Tester = the Admin role’s access + the test feed. The two developer-only tools (the Database console and test-mode payments) stay with the Developer role.',
      'A developer or admin can now switch their own role to Tester — before, that was refused as “demoting yourself out of the admin roles”. It is still refused while that person holds an open position, because the position would never get its exit from the other feed.',
      'Fetch: after a test signal opens a position, press Fetch on Dashboard → Positions and the position appears within seconds, instead of up to 5 minutes later when the next automatic check runs. It also refreshes the balance. One press every 15 seconds; the button counts down.',
      'Only tester accounts see the button. Everything else about a tester stays the same: test signals only, never billed, not counted as a customer.',
    ],
    technical: [
      'EnsureAdmin::ROLES (and lib/roles.ts ADMIN_ROLES) gain `tester`, so the staff-only exchange gate, the calendar edit gesture and every admin route admit it; developer-only checks are unchanged. POST /user/positions/refresh (PositionRefreshController, testers only, 15 s per-user cooldown → 429 REFRESH_COOLDOWN, 503 when the engine does not answer) runs App\\Services\\Exchanges\\AccountRefresh — the same balances + positions sync the admin’s user-page Refresh uses, scoped to the caller’s keys.',
    ],
    links: [{ label: 'Open Positions', href: '/dashboard/positions' }],
  },
  // ── 2026-10-15 ───────────────────────────────────────────────────────────
  {
    id: 'tester-role-test-feed',
    date: '2026-10-15',
    kind: 'new',
    area: 'Signals',
    title: 'Test accounts with their own signal feed, and a Webhooks page with every signal address',
    summary:
      'There is a new account role, Tester, for our own test accounts. A tester account does not receive the normal TradingView signals. It only receives signals sent to a separate test address, so we can send test signals to the live system, or plug in a different signal provider, without touching any customer. Nothing a test signal does is posted in the Telegram or Discord channels, and tester accounts are never billed. A new Webhooks page lists every signal address with copy buttons.',
    howItWorks: [
      'Each exchange now has two addresses. The main one (for example …/binance_abcd_webhook) is the TradingView one: it trades every customer, the master account and staff. The test one (for example …/binance_test_webhook) trades tester accounts ONLY.',
      'The test address has its own password (secret). A test server or another signal provider holding it can only ever move tester accounts — never a customer’s money. The TradingView password does not work on the test address, and the test password does not work on the main one.',
      'Any signal provider works, not only TradingView: it just has to send the same short message (action, coin, price) to the test address. Admin → Sandbox → Manual trade also has a “Test feed” switch to send one by hand.',
      'Tester accounts can be demo or real money. Everything else works exactly like for customers — position sizes, the minimum deposit, the 3-entry limit, streak sizing, and a coin switched off (including by the kill switch) — so a test shows what a customer would get. The one rule skipped is “when the master is full, nobody adds”, because testers follow different signals than the master.',
      'Example: send BUY LTC to the Binance test address. Two tester accounts open an LTC long; customers and the master do nothing; the channel stays silent; the admin chat gets one “🧪 TEST FEED” message listing what each tester account did, and the Signal Log shows the signal with a “Test feed” tag (there is a Feed filter).',
      'To make an account a tester: User Management → change the role to Tester (or create a new user with role Tester). The change is refused while that person still has an open position, because a position opened by one feed would never get its exit from the other.',
      'Testers sign in like a normal trader and see the trader dashboard only. They are not counted as customers on the Admin Dashboard, are not invoiced, and do not get the Discord “Trader” role. They may connect MEXC and Bybit, which customers cannot yet.',
      'Admin → Webhooks shows, per exchange and per feed: the production and local address with a copy button, whether that exchange is on, whether the test feed is ready, how many real-money and demo accounts would receive a signal there, and a ready-to-paste alert message (with a placeholder where the password goes — passwords are never shown on the page).',
    ],
    technical: [
      'user_credentials.type gains `tester`. GET /engine/{x}/accounts carries feed: main|test (test = tester owner). Engine: hooks.TEST_WEBHOOK_PATHS (/{venue}_test_webhook), BINANCE_ABCD_TEST_WEBHOOK_SECRET (empty or equal to the main secret = test feed off, 403); _process_trade_job(feed=…) filters accounts, sets announce=False, skips _main_account_full, reports via notify.notify_test_feed (_send_private only); retries carry the feed; the admin manual close uses feed=None (every feed). /health adds test_feed + webhooks.',
      'trade_logs.feed (main default); Signal Log ?feed= filter; SignalHealth counts main only. Role change to/from tester → 409 OPEN_POSITIONS while any position is open; it pings the engine to drop its account cache. GET /admin/webhooks (full admins): paths, prod/local bases, venue_live/enabled from the engine’s /health, receivers per feed + demo, secrets as presence booleans only. Manual trade console takes feed (API key ENGINE_TEST_WEBHOOK_SECRET = the engine’s test secret). nginx proxies the three test paths (deploy-nginx).',
    ],
    links: [
      { label: 'Open Webhooks', href: '/admin/webhooks' },
      { label: 'Open the Signal Log', href: '/admin/trade-logs' },
      { label: 'Open User Management', href: '/admin/users' },
    ],
  },
  // ── 2026-10-14 ───────────────────────────────────────────────────────────
  {
    id: 'signup-wizard',
    date: '2026-10-14',
    kind: 'improved',
    area: 'Sign-up',
    title: 'Sign-up is now four short steps instead of one long form',
    summary:
      'Creating an account now asks one thing per screen, with a progress bar at the top: 1. your name, 2. email and password, 3. Telegram and Discord (optional — “Skip for now”), 4. how you heard about us, the Terms, and “Create free account”. Signing up with Discord gets the same screens without the password step.',
    howItWorks: [
      'Each step checks itself before moving on. For example, a password shorter than 8 characters or two passwords that do not match keep you on step 2, and two ticks under the fields turn green as the rules are met.',
      'Back keeps everything already typed. The finished steps in the progress bar can be clicked to jump back to them.',
      'If the server refuses something at the end — for example an email that already has an account — the form jumps back to the step with that field and shows the message there.',
      'The panel beside the form changes with each step: what Pixel Alpha is, why your money stays on your exchange, who answers your questions, and what happens after you sign up.',
      'The numbers under that panel (“48.2K traders · $128M profit”) were placeholder numbers from the original design, never real ones, and have been removed.',
      'Password fields now have a show / hide eye, on sign-in too.',
    ],
    technical: [
      'components/auth/wizard/* (RegisterWizard, WizardProgress, WizardNav, LoginStep, SocialsStep, SourceStep), hooks/useSignupWizard, lib/registerWizard (steps, checks, field → step map). Auth.tsx split into SignInForm + AuthBrandPanel; DiscordTerms uses the same pieces. No API change.',
    ],
    links: [{ label: 'Open the sign-up page', href: '/auth?mode=register' }],
  },
  {
    id: 'signup-details',
    date: '2026-10-14',
    kind: 'new',
    area: 'Sign-up & user details',
    title: 'Sign-up asks where people heard about us, and records where they signed up from',
    summary:
      'The sign-up form now has an optional “Where did you hear about us?” question — nine tick boxes in a 3 × 3 grid, the last one “Other” with a text box — and optional Telegram and Discord username fields. Every sign-up and sign-in also records the visitor’s IP address, country and device. All of it shows on a new “Sign-up info” tab on each user’s page in User Management.',
    howItWorks: [
      'The nine choices: Discord server, Telegram, AI chatbot (ChatGPT, Claude…), Friend / referral, YouTube, X (Twitter), Google search, TikTok / Instagram, Other. People can tick as many as apply, or none. Someone who arrives through an invite link starts with “Friend / referral” already ticked.',
      'Telegram and Discord usernames are optional at sign-up and can be added or changed later in Settings → Telegram & Discord. If someone signs in with Discord, the Discord username Discord itself confirmed is shown instead (marked “Linked”).',
      'Recorded automatically on every sign-up and sign-in: date and time, IP address, country (for example “TH · Thailand”), and the device — phone, tablet or computer, with the browser and system, for example “Phone · Safari 18 · iOS 18”.',
      'A privacy banner now greets every first-time visitor with two buttons: “Essentials only” and “Accept all”. With Accept all we also record the device’s time zone, language and screen size. Anyone can change their answer from “Privacy choices” at the bottom of the home page.',
      'User Management → open a user → Sign-up info: how they found us, their Telegram / Discord, the sign-up itself, and their last 25 sign-ins. Every admin role sees it, read-only staff included. Accounts created before today show “not recorded” for the sign-up, and their sign-ins appear from today on.',
      'The Privacy Policy was updated (14 Oct 2026) to say exactly what is collected and why.',
    ],
    technical: [
      'API tables: user_access_events (register/login fingerprint; client timezone/language/screen stored only with consent = all), user_signup_sources (one row per ticked option, slugs in SignupSources::SLUGS), user_contact_handles (typed telegram/discord). App\\Services\\Auth\\AccessLog + DeviceInfo (hand-written user-agent parser); country from the CF-IPCountry header.',
      'Endpoints: register / login / discord callback, link-with-password and complete accept heard_from, heard_from_other, telegram, discord, client, consent; GET|PUT /user/contacts; GET /admin/users/{uniId}/signup-info (staff group).',
      'Frontend: lib/consent.ts + components/ui/CookieConsent.tsx, lib/signupSources.ts, components/auth/HeardAboutGrid.tsx, settings/ContactHandlesCard.tsx, admin/user-detail/UserSignupTab.tsx.',
    ],
    links: [{ label: 'Open User Management', href: '/admin/users' }],
  },
  {
    id: 'equity-card-gold-silver',
    date: '2026-10-14',
    kind: 'improved',
    area: 'Trading dashboard',
    title: 'The Account Equity card is gold for real money and silver for a demo account',
    summary:
      'The big Account Equity card on the trading dashboard now has a light gold shade and a soft shine that passes over it every 5 seconds. When the account in view trades test funds (a demo / testnet account), the card is silver instead and says DEMO ACCOUNT, so nobody mistakes play money for real money.',
    howItWorks: [
      'Real money: gold shade, gold chart line, and the green LIVE badge as before.',
      'Demo only: silver shade and chart line, a silver DEMO ACCOUNT badge in place of LIVE, and the line “Test funds on the exchange’s demo network — not real money.” under the balance.',
      'Both at once: a customer with a real Binance account and a demo account sees them pooled under “All”. The card stays gold and adds a silver INCLUDES DEMO badge. Picking the demo exchange at the top shows that one alone, in silver.',
      'The shine is one gentle sweep every 5 seconds. It is switched off for people whose device asks for reduced motion.',
    ],
    technical: [
      'GET /dashboard/summary carries demo_accounts (accounts in scope with demo = 1). EquityHeroCard mode: live | demo | mixed; --silver token (both themes); @keyframes cardshine.',
    ],
    links: [{ label: 'Open the dashboard', href: '/dashboard' }],
  },
  {
    id: 'closed-trades-show-streak-size',
    date: '2026-10-14',
    kind: 'new',
    area: 'Trading positions',
    title: 'Past positions say when streak sizing set the size',
    summary:
      'When streak sizing changed a trade’s size, its Past Positions row now says so: for example “Smaller size · after 3 losses” under the coin. Customers see only that sentence. Admins also see the sizes, for example “size 25 instead of 50 · loss step 3”.',
    howItWorks: [
      'Example: LTC’s normal size is 50, and after 3 losses in a row the Streak Sizing Settings use 25. A customer’s next LTC trade after 3 losses opens at 25 (scaled to their balance as usual). When it closes, their Past Positions shows a gold “Smaller size · after 3 losses” tag. A size raised after wins reads “Larger size · after 2 wins”.',
      'The bot records this when the trade OPENS, the only moment it is known, and carries it to the closed trade. All entries of one position share one step, so each closed trade has one answer.',
      'Customers never see the sizes themselves (normal size and the step sizes stay admin-only, like before). Admins see them on Trading Positions and on a user’s Positions tab.',
      'It starts with trades opened from today. Older trades show nothing: the step sizes may have changed since, so working it out afterwards could show the wrong answer.',
    ],
    technical: [
      'Engine: entries on a coin with a ladder POST open-strategies with streak_kind / streak_run / streak_step / streak_size / streak_base_size; the exit recovers the tag (only when the signal has no label or the coin has a ladder) and posts the five fields on past-positions/sync.',
      'API: migration 2026_10_14_000003 adds the five columns to open_strategies and every {x}_pastpositions (open_strategies.strategy now nullable); App\\Services\\Positions\\EntryStreak; ingest null-fills them as one unit. Customer payload: streak {kind, run, effect}; staff: + step, size, base_size.',
    ],
    links: [
      { label: 'Open Trading Positions', href: '/admin/positions' },
      { label: 'Open My Positions', href: '/dashboard/positions' },
    ],
  },
  {
    id: 'signal-log-timeline',
    date: '2026-10-14',
    kind: 'improved',
    area: 'Signal Log',
    title: 'Signal Log: long/short, entry/exit, results, retries folded, and closes made on the exchange',
    summary:
      'The Signal Log now reads as one timeline of what happened to positions: every row says LONG or SHORT and Entry or Exit, an exit shows what each account paid in, got out and made, retries sit inside the signal they repeat, and positions a customer closed themselves on the exchange appear as their own amber rows. The filters were rebuilt.',
    howItWorks: [
      'Each row starts with a green LONG or red SHORT tag and the word Entry or Exit — instead of the bot’s BUY / SELL / EXIT_LONG / EXIT_SHORT.',
      'Entries show the price TradingView sent and the average price the accounts actually filled at; each account shows its coins and how deep its stack now is (for example “stack 2/3”).',
      'Exits show the main account’s result on the row (for example “main −$460.91”), and inside, every account’s “In 2.0506 → Out 2.1209”, its P&L after fees and the fee.',
      'Retries: when the bot re-ran a signal for accounts that failed it, those re-runs are now inside the original row (“retried 5×”) instead of five extra rows.',
      'Closed outside the bot: when a customer closes a position on Binance themselves (or their own take-profit / stop-loss fires, or it is liquidated), it appears in the timeline as an amber row with the account, coin, side, prices and P&L. Example: BOT ALEX G’s RENDER short closed by hand on 12 Oct 14:56 sits right before the 13 Oct signal that gave him a fresh entry. These rows never count in the signal totals.',
      'Closes an admin makes from the portal are shown as ordinary exits.',
      'Filters: exchange, Long/Short, Entry/Exit, source (bot signals or closes outside the bot), coin, account outcome, reason, account search and quick date ranges (today, 24 h, 7 days, 30 days, custom). They are kept in the page address, so a reload or a shared link shows the same view, and active filters show as chips you can remove one by one.',
    ],
    technical: [
      'GET /admin/trade-logs: side=long|short, type=entry|exit, source=all|signals|outside; items carry kind signal|outside_close, side, type, retries[] and details[].close; summary.outside_closes; filters.exchanges.',
      'Retries fold under the latest earlier non-retry row with the same exchange+action+ticker within 60 min (AdminTradeLogController::foldRetries). Closed trades matched within ±15 min, never close_source=outside.',
      'Frontend: shared filter kit in components/ui/filters + hooks/useUrlFilters (the convention every admin list should follow).',
    ],
    links: [{ label: 'Open the Signal Log', href: '/admin/trade-logs' }],
  },
  {
    id: 'positions-show-long-short',
    date: '2026-10-14',
    kind: 'fixed',
    area: 'Trading positions',
    title: 'Every position says LONG or SHORT, and shows where it went in and out',
    summary:
      'Closed trades on the admin Positions page showed “BUY” for a short. That was the order that closed the trade, not its direction. Every positions list now says LONG or SHORT, and the customer’s own Positions page now shows the entry and exit prices as well.',
    howItWorks: [
      'Example: on 13 Oct the RENDER trades went in at $2.05 and out at $2.12, at a loss. They were shorts, closed by buying the coins back, so the page printed “BUY”. They now read SHORT, in red. A long reads LONG, in green.',
      'Under each coin you see its direction and size, for example “SHORT 2,340.000”. The price column shows “In” (the entry) above “Out” (the exit) for a closed trade, or above “Now” (the current price) for an open one.',
      'Same on the customer’s Positions page (Active and Past Positions), on a user’s Positions tab in User Management, and on the admin Positions page.',
      'Editing a closed trade now picks LONG or SHORT. The closing order is filled in to match automatically, so the two can never disagree.',
    ],
    technical: [
      'GET /admin/positions and GET /admin/users/{uniId}/positions: closed trades now carry position_side (and entry_price on the per-user one). `side` stays the closing order (BUY closes a short).',
      'PUT /admin/past-positions/{id} accepts position_side LONG|SHORT and derives side from it (and position_side from side when only side is sent).',
      'lib/tradeSide.ts is the one place that resolves a direction: position_side first, else the closing order for a trade, else the sign of the size for an open BOTH row.',
    ],
    links: [
      { label: 'Open Trading Positions', href: '/admin/positions' },
      { label: 'Open My Positions', href: '/dashboard/positions' },
    ],
  },
  {
    id: 'main-account-full-holds-everyone',
    date: '2026-10-14',
    kind: 'improved',
    area: 'Bot',
    title: 'When the main account is full on a coin, nobody else adds',
    summary:
      'If the main account already holds its maximum on a coin (for example 3 of 3 entries on a RENDER short), the bot now opens no new entry on that coin and side for anyone — even a customer whose own stack still has room.',
    howItWorks: [
      'Example: on 13 Oct a 4th RENDER SELL arrived while the main account was at 3 of 3. The bot refused it for the main account and five customers, but one customer had closed his position by hand the day before, so his stack read 0 — and he got a fresh first entry, which the channel announced as a new trade. Now he is held back too, and nothing is announced.',
      'Every account still has its own limit as well: a customer at 3 of 3 is refused even when the main account is at 2 of 3.',
      'Closes are never held back — every account can always exit.',
      'It applies to signals from TradingView. A manual trade an admin places for chosen users, and the automatic re-try of an entry that failed, are not held back. On an exchange with no main account (MEXC today), each account keeps only its own limit.',
      'In the Signal Log these accounts show “Main account already full”, a normal outcome, not a problem. The admin Telegram group lists them under “Held back — the main account is already full”.',
    ],
    technical: [
      'trading-flask routes/webhook.py: _main_account_full() per venue in _plan_exchange (live, untargeted entries only), using the same _stack_verdict() as every account’s own cap; skip reason "main account at max" (+ main_increment), checked after the account’s own cap. Unknown main open size = not full.',
      'SignalHealth: main_full (normal). notify_max_increments(held_back=…).',
    ],
  },
  {
    id: 'open-position-entry-price',
    date: '2026-10-14',
    kind: 'improved',
    area: 'Trading positions',
    title: 'Open positions show their entry price',
    summary:
      'The Active Positions list now shows each position’s entry price above its current price. Before, it showed only the current price, so you could not see that one account was holding a different position from everyone else.',
    howItWorks: [
      'The price column is now “Entry / Now”: the top line (“In”) is the average price the account entered at, the bottom line (“Now”) is the current market price.',
      'The entry is the exchange’s own average over everything still open in that position. Example: on 13 Oct every customer’s RENDER short read “In 2.0505” (three entries), while one customer’s read “In 2.212” — he had closed his position by hand the day before, so the bot opened a fresh one for him at the next signal.',
      'A user’s page in User Management shows the same entry price in its Avg Price column, which until now was showing the current price by mistake.',
    ],
    technical: [
      'GET /admin/positions and GET /admin/users/{uniId}/positions: open rows carry entry_price ({x}_positions.entry_price, from the exchange’s positionRisk); price stays the mark. Merged lines average the entries that carry one.',
    ],
    links: [{ label: 'Open Trading Positions', href: '/admin/positions' }],
  },
  {
    id: 'asset-size-waits-for-close',
    date: '2026-10-14',
    kind: 'improved',
    area: 'Trading assets',
    title: 'A new coin size waits for the open position to close',
    summary:
      'If you change a coin’s size while the main account has that coin open, the new size now waits and goes live by itself when that position closes. Changing size in the middle of a stack used to make the bot miscount how full the stack was.',
    howItWorks: [
      'Example: LTC trades at base 60 with a max of 180 (3 entries). The main account holds 2 entries. You change the base to 120 and the max to 360. Before, the bot would have measured the open 120 as “1 entry of 120” and allowed two more — a position of 360, twice what you meant. Now the 60 / 180 sizes stay until the LTC position closes, and the next position starts at 120 / 360.',
      'While it waits, the coin card shows a yellow “New size waiting” strip: what changes, what it is waiting for (for example “the main account’s LTC short”), and who saved it. The size shown in the card’s tiles is what the bot trades right now.',
      'Two buttons on the strip: “Apply now” puts the new size live straight away (for emergencies — it asks first), and “Cancel change” drops it and keeps the current size.',
      'If nothing is open when you save, the new size applies straight away, as before. On an exchange where there is no main account (MEXC today), it waits until no account there holds the coin.',
      'Switching a coin on or off, Long/Short only, and the kill switch are never delayed — turning a coin off is a safety action.',
      'New check: the max position size can no longer be smaller than the base size (one entry would already be over the limit). The edit form also shows what one entry means for the main account, for example “one entry ≈ 2,136 RENDER ≈ $4,600”.',
    ],
    technical: [
      'assets.pending_sizing (JSON: base_size, max_increments, streak_sizing_enabled, streak_sizes) + pending_since / pending_by / pending_by_name. App\\Services\\Assets\\PendingSizing: save() → applied | waiting | cancelled | unchanged; holder() reads {x}_positions for the master’s real-money keys (any account when the venue has no master).',
      'Goes live from EngineSyncController (positions/upsert delete, positions/sync, past-positions/sync) and `assets:apply-pending` every minute. The engine only ever reads the live columns.',
      'PUT /admin/assets/{id}: base_size / max_increments optional on update (absent = unchanged — the on/off switch no longer re-posts sizes). POST /admin/assets/{id}/pending-sizing/apply, DELETE /admin/assets/{id}/pending-sizing. Streak ladder edits (streak tab and form) go through the same rule; the kill switch does not.',
      'GET /admin/assets carries pending_sizing (+ waits_for) and main_account {balance, price} for the one-entry preview (lib/assetSizing.ts, scalePreview).',
    ],
    links: [{ label: 'Open Trading Assets', href: '/admin/assets' }],
  },
  {
    id: 'asset-change-history',
    date: '2026-10-14',
    kind: 'new',
    area: 'Trading assets',
    title: 'Change history for every coin’s settings',
    summary:
      'Every change to a coin’s settings is now recorded: what changed, from what to what, who did it and when — including the automatic ones, like a waiting size going live or the kill switch switching a coin off.',
    howItWorks: [
      'Example line: “Changed · RENDER/USDT · Binance — Base size 60 → 120 · Max position size 180 → 360 — by Ops Admin, 12 Oct 06:02”.',
      'Each coin card has a new History button (the clock icon) that opens that coin’s list. Trading Assets also has a new “Change history” tab with every coin, filtered by the exchange switcher at the top.',
      'Recorded: base size, max position size, streak sizing on/off and its steps, the kill switch, on/off, Long/Short, name, exchange and logo — plus coins being added and deleted.',
      'The history starts on 14 Oct 2026. Earlier changes were not recorded anywhere.',
    ],
    technical: [
      'asset_changes (asset_id, ticker, broker, event created|updated|waiting|applied|cancelled|deleted|kill_switch, actor_uni_id/actor_name, changes JSON {field: {from, to}}, note). App\\Services\\Assets\\AssetHistory (best-effort writes). GET /admin/assets/history?asset_id=&broker=&before_id=&limit=.',
    ],
    links: [{ label: 'Open the change history', href: '/admin/assets?tab=history' }],
  },
  {
    id: 'closed-outside-the-bot',
    date: '2026-10-14',
    kind: 'new',
    area: 'Positions',
    title: 'Trades closed outside the bot are marked',
    summary:
      'A trade the customer closed themselves on the exchange — by hand, with their own take-profit or stop-loss, or by a liquidation — is now marked “Closed outside the bot” on the admin screens. It also no longer counts toward that account’s streak sizing.',
    howItWorks: [
      'Example: on 12 Oct a customer closed their RENDER short by hand on Binance. At the next signal the bot saw that account as empty and opened a fresh first entry while every other account was full — which looked like “the bot reopened it”. That close is now marked, so the reason is visible.',
      'Where you see it: Trading Positions → Past Positions (a chip on the row, and a “Closed by” filter), a user’s Positions tab, and Overview → Needs attention (“Closed outside the bot · last 7 days”). It is information, not an error.',
      'How it is decided: every close the bot makes is in the Signal Log. A close with no bot exit for that account and coin at that time is marked outside the bot, a few minutes after it happens.',
      'Streak sizing: an outside close is not a strategy trade, so it no longer moves that account’s winning or losing run.',
      'Closes made by an admin from the Open positions page go through the bot, so they count as closed by the bot.',
    ],
    technical: [
      '{x}_pastpositions.close_source (bot | outside | NULL). App\\Services\\Positions\\CloseSource: bot when increments_closed is set or an EXIT_* trade_logs row within ±15 min lists the owner as filled; judged 3+ min after the close, only from the first trade log on; sandbox / SBXINV- rows never. `positions:classify-closes` every 5 min (--days, --dry-run).',
      'StreakSizing::runs skips close_source = outside. Admin /positions, /admin/users/{id}/positions and insights overview attention.outside_closes carry it.',
    ],
    links: [
      { label: 'Open Trading Positions', href: '/admin/positions' },
      { label: 'Open Needs attention', href: '/admin?view=attention' },
    ],
  },
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
