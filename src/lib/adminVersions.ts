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
  {
    id: 'home-page-redesign-live',
    date: '2026-11-27',
    kind: 'new',
    area: 'Website',
    title: 'The new home page is live; the old one stays at /classic',
    summary:
      'pixel-alpha.com now opens on the redesigned home page: Pixel on the order book, the latest closed trades, how a signal becomes a trade, and the fee example. The previous home page is still there at pixel-alpha.com/classic.',
    howItWorks: [
      'The old preview address (/preview/landing) now simply opens the home page, so links already shared still work.',
      'Search engines are told to skip /classic, so Google only lists one home page.',
      'Admin → Visitors counts both: "Home page" and "Home page (classic)".',
    ],
    technical: [
      'App.tsx: / → pages/Landing.tsx (was LandingPreview), /classic → pages/LandingClassic.tsx (the old Landing, useNoIndex), /preview/landing → <Navigate to="/" />. hooks/useNoIndex extracted. lib/visitPages + API VisitPages::PATHS gain /classic; robots.txt disallows /classic and /preview. Tag landing-classic still marks the code before the redesign.',
    ],
    links: [
      { label: 'Home page', href: '/' },
      { label: 'Classic home page', href: '/classic' },
    ],
  },
  {
    id: 'strategy-switch-pauses-entries',
    date: '2026-11-27',
    kind: 'fixed',
    area: 'Strategies',
    title: 'Pausing a strategy now really stops its new trades',
    summary:
      'The Active / Paused switch on each strategy card in Admin → Strategies was saved and shown, but the bot never read it: a "paused" strategy kept trading. Now a paused strategy\'s entry signals are refused on every exchange and for every account, from the next signal on.',
    howItWorks: [
      'Example: pause "VWMA-Reversion - QuantLab". The next QuantLab buy for LTC is refused, and the admin chat says the strategy is paused. A QuantLab exit still closes the LTC position that was already open.',
      'It works by the strategy name each alert sends, so pausing one strategy never touches another one trading the same coin.',
      'The admin chat says it once a day per coin, like a coin that is turned off. The Signal Log lists every refused signal as "Strategy paused", which does not count as a problem in the health banner.',
      'Turning the switch back on takes effect from the next signal.',
    ],
    technical: [
      'API: GET /engine/{x}/assets carries paused_strategies (strategies.enabled = 0); PUT /admin/strategies/{key} pings EngineCache::refreshAssets. SignalHealth: rejected reason strategy_paused → strategy_off (normal).',
      'Engine: assets_api.strategy_paused (trimmed, case-insensitive); _plan_exchange rejects ENTRIES with STRATEGY_PAUSED (exits untouched); notify.reject_hint line; once a day per venue + coin + strategy via daily_alerts.',
    ],
    links: [{ label: 'Strategies', href: '/admin/strategies' }],
  },
  {
    id: 'leverage-fallback-15-10',
    date: '2026-11-27',
    kind: 'improved',
    area: 'Trading',
    title: 'A refused leverage steps down to 15×, then 10×, instead of failing the trade',
    summary:
      'When an exchange no longer allows the leverage a signal asks for, the bot now tries 15×, then 10×, and places the trade at the first one the exchange accepts. Before, it kept asking for 25× and the trade often failed. That is what happened to every SANTOS entry on 9 Nov, until someone set the coin\'s leverage by hand.',
    howItWorks: [
      'Example: a SANTOS buy asks for 25×, and Binance only allows 20× on SANTOS. The bot asks for 15×, Binance accepts, and the trade goes through at 15×. If 15× were refused too, it would try 10×.',
      'It only ever goes DOWN: a coin set to 12× tries 10× next, never 15×. It also does not step down when the exchange did not answer, was busy, or refused the API key, because a lower leverage cannot fix those.',
      'The step-down is remembered for a day, so the next signals go straight to 15×. After a day the bot asks for the full leverage again, in case the exchange raised the coin\'s limit.',
      'You are told: the admin chat gets one note per coin per day ("Leverage lowered"), the sub-master and test-feed summaries name it on the account\'s line, and the Signal Log shows "15× (25× refused)" on the account.',
      'The lasting fix is still to set the coin\'s leverage in Trading Assets, so it stops asking for more than the exchange allows.',
    ],
    technical: [
      'Engine routes/webhook._maybe_set_leverage → (applied, refusal, also_refused). Fallback ladder hooks.LEVERAGE_FALLBACKS (env BINANCE_ABCD_LEVERAGE_FALLBACKS, default "15,10"; empty = off); only values below the refused one; never after a transient / rate-limited / credential refusal (key_status.CREDENTIAL_CODES).',
      '_LEVERAGE_APPLIED caches (asked, applied, ts, refusal) for LEVERAGE_CACHE_TTL; a total refusal is never cached. exchange_limit.fit uses the applied leverage. Entry detail: leverage = applied, leverage_fallback {asked, used, refused, also_refused}; a total refusal\'s error adds "15x and 10x refused too".',
      'notify.notify_leverage_fallback (main feed, daily_alerts key leverage_fallback|venue|coin|asked|used) and _test_result_line (private feeds). API AdminTradeLogController::mapDetail → leverage_fallback; TradeLogCard pill. MEXC takes leverage on the order and Bybit already caps at the coin\'s max, so in practice this is Binance.',
    ],
    links: [
      { label: 'Trading Assets', href: '/admin/assets' },
      { label: 'Signal Log', href: '/admin/trade-logs' },
    ],
  },
  {
    id: 'strategies-quantlab-submaster',
    date: '2026-11-27',
    kind: 'new',
    area: 'Strategies',
    title: 'QuantLab\'s sub-master trades have their own strategy card',
    summary:
      'Admin → Strategies now shows the sub-master\'s trades as their own card, "VWMA-Reversion - QuantLab", beside the master\'s "VWMA-Reversion". Until now they were not on the page at all.',
    howItWorks: [
      'QuantLab sends the sub-master\'s signals with the strategy name "VWMA-Reversion - QuantLab", so its results never mix into the master\'s TradingView card.',
      'The card starts on 20 Nov 2026, when QuantLab took over the sub-master\'s signals. Its trades from before that came from TradingView and are left out.',
      'The accounts filter has a "Sub-master" choice, like Master and Customers. "Master" and "Customers" still show exactly what they did before.',
      'Only the strategy name of the sub-master\'s earlier QuantLab trades was changed: no profit, fee, size or date moved.',
    ],
    technical: [
      'AdminInsights::strategyTrades(all) adds submasterAccounts() (type submaster, demo 0) from SUBMASTER_STRATEGIES_SINCE (2026-11-20 03:48 UTC); master / customers scopes unchanged. Rows carry owner_role "submaster".',
      'Migration 2026_11_27_000001_name_quantlab_submaster_trades: sub-master {venue}_pastpositions closed since then and their open_strategies tags, "VWMA-Reversion" → "VWMA-Reversion - QuantLab"; down() reverses. trade_logs untouched (the Signal Log keeps what each alert said).',
      'Frontend: OwnerFilter "submaster" (lib/strategyFilters, useStrategyFilters), StrategyFilterBar chip. QuantLab side: the seven "Pixel Alpha Sub-master" rules\' alias (= the webhook\'s `strategy`).',
    ],
    links: [{ label: 'Strategies', href: '/admin/strategies?owner=submaster' }],
  },
  {
    id: 'landing-preview-pixel-alive-white-steps',
    date: '2026-11-27',
    kind: 'improved',
    area: 'Website',
    title: 'New home page: Pixel moves, the steps strip is still and white',
    summary:
      'On the new home page (not live yet), Pixel is no longer a still picture: sitting on the order book, he kicks his feet, looks left and right, blinks, and his antenna light flashes in time with the order book\'s LIVE square. The "What happens when the strategy trades" strip no longer has a moving gold highlight: it stays still, with every step in white. In the footer, "Privacy choices" is now gold like the other links.',
    howItWorks: [
      'Every move is one pixel at a time, like an old video game. Visitors who switched on "reduce motion" on their phone or computer see him still.',
      'He is drawn by the page itself from his saved Creatives picture: no video file and nothing generated, so he costs nothing and loads fast.',
      'The strip replaces this morning\'s version, which held still while the gold moved from step to step. That version can come back if wanted.',
    ],
    technical: [
      'components/landing-next/PixelMascot: three layers in public/assets/pixel-mascot (base with the eye glints painted out, leg-left, leg-right) plus CSS eyes and an antenna cover; keyframes pxkick / pxlook / pxeyes / pxantenna in index.css, steps(1, end), motion-safe only.',
      'SignalFlow: static, tiles border-muted text-text, body text-text/85, connectors var(--muted); useScrollStep and lib/scrollStep removed (in git history). LandingPreview back to overflow-x-hidden.',
      'Footer: the "Privacy choices" button is text-accent, matching the links that take the base `a` colour.',
    ],
  },
  {
    id: 'landing-preview-pixel-readable-pinned',
    date: '2026-11-27',
    kind: 'improved',
    area: 'Website',
    title: 'New home page: Pixel sits on the order book, easier text, the steps hold still',
    summary:
      'On the new home page (not live yet), Pixel, our robot mascot, now sits on the order book box with his legs hanging over its front. The text at the top was grey on a grey photo and hard to read. It is now lighter and the photo is darker behind it. The footer\'s small grey text was also hard to read, so it is brighter on every page that has it.',
    howItWorks: [
      'Pixel is the same character as in Admin → Creatives → Character, cut out of his saved picture. Nothing new was generated and nothing was spent.',
      'In "What happens when the strategy trades", on a computer the whole strip now stays still in the middle of the screen while you scroll. The gold highlight moves from step 1 to step 5, then the page carries on. On a phone the five steps are too tall for one screen, so they stay a list and the highlight follows as you scroll.',
      'The footer change (column titles, the line under the logo, the copyright and the risk sentence) is on every public page that uses that footer, including the current home page, the FAQ and Contact.',
    ],
    technical: [
      'HeroNext: public/assets/pixel-mascot-sitting.png placed with translateY(-PIXEL_SEAT); PixelOrderBook header pt-8 so his feet never cover it. HeroPhoto left layer var(--bg) 0–25% → transparent 75% at 0.85 (worst block behind the paragraph 3.6:1 → 8.4:1); hero paragraph and nav links text-text/80.',
      'SignalFlow: section is a 280vh track (min-width 961px) with a sticky h-screen child; useScrollStep takes trackRef and lib/scrollStep.stepInPin picks the step. LandingPreview uses overflow-x-clip, because overflow-x-hidden makes a scroll box that stops sticky.',
      'components/landing/Footer: text-faint → text-muted for the headings, blurb and bottom row.',
    ],
  },
  {
    id: 'share-preview-says-exchange',
    date: '2026-11-26',
    kind: 'fixed',
    area: 'Website',
    title: 'Link previews say "your own exchange", not "Binance or MEXC"',
    summary:
      'When someone shared a pixel-alpha.com link on Telegram, X or WhatsApp, the preview text and picture said "your own Binance or MEXC account". MEXC is closed to new customers, and more exchanges are coming, so both now just say "your own exchange account".',
    howItWorks: [
      'The picture keeps its design; only the line under the headline changed, to "Trade-only API key. Funds never leave your exchange."',
      'Apps keep old previews for a while. A link shared before today may still show the old text until the app refreshes it.',
    ],
    technical: [
      'index.html description, og:description, twitter:description; public/assets/og-card.png line redrawn; og:image / twitter:image now ?v=2, because /assets/ is served immutable for a year and Cloudflare would keep the old picture.',
    ],
  },
  {
    id: 'fee-twenty-percent-flat',
    date: '2026-11-26',
    kind: 'improved',
    area: 'Billing',
    title: 'One simple fee: 20% of closed profit, nothing on trades still open',
    summary:
      'The fee used to be 20% of the month’s closed profit plus 6% of the profit on trades still open when the bill was made on the 1st. It is now just 20% of the month’s closed profit. Trades close within about a day, so the 6% part was small and hard to explain. The invoices made on 1 December (for November) are the first under the new rule.',
    howItWorks: [
      'Example: in November a customer’s closed trades make $500, and one trade is still $300 in profit on 1 December. The old rule billed $100 + $18 = $118. The new rule bills $100.',
      'The open trade is not lost: when it closes, its profit counts in the month it closes in, like every other trade.',
      'Every customer on the old standard rates moved to 20% flat, and new sign-ups start on it. A different rate an admin sets on one person still applies to that person.',
      'The Terms and Conditions (section 5), the FAQ and the new home page say the same. Invoices already issued keep their figures.',
    ],
    technical: [
      'user_credentials.unrealized_percentage default 6 → 0; migration 2026_11_26_000002 moves rows at exactly 6 to 0 (down() restores 6 where realized > 0). UserCredential::DEFAULT_REALIZED_PERCENTAGE / DEFAULT_UNREALIZED_PERCENTAGE replace the hardcoded 20 / 6 fallbacks (InvoiceService::applyHighWaterMark, EngineInvoiceController, AdminInvoiceController, AdminUserController, AdminInsights, InvoiceNotifier). GuideTools billing_rules updated. The pay sheet shows the open-P&L line only when it was billed.',
    ],
    links: [
      { label: 'Terms and Conditions', href: '/terms' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    id: 'landing-preview-scroll-and-wording',
    date: '2026-11-26',
    kind: 'improved',
    area: 'Website',
    title: 'New home page: the highlight follows the scroll, and the words say "exchange"',
    summary:
      'Four changes to the new home page (still on its preview address). In "What happens when the strategy trades", the gold highlight now moves from step to step as you scroll, and the step you are on turns gold so it is easy to follow. The API key section and "Connect your exchange" no longer say Binance only. The fee section is in plain words, without "high-water mark", and shows the one 20% fee.',
    howItWorks: [
      'On a phone, each step lights up as it reaches the middle of the screen. On a computer the five steps sit side by side, so the highlight sweeps across them as the row moves up the screen. The track behind the highlight stays gold.',
      'The fee section reads: we compare your account with its best month end so far (at first, what you deposited); if it ended the month higher, you pay 20% of the profit your closed trades made; if not, nothing.',
      'The main home page is unchanged until the new one is approved.',
    ],
    technical: [
      'landing-next/SignalFlow: hooks/useScrollStep + lib/scrollStep (stepAtLine for stacked steps, stepByTravel side by side; tested). The time-looped pixel runner on the tracks is replaced by the scroll trail. KeyPermissions: exchange-neutral copy and setting names. FeeExample: one 20% card, "best month end so far".',
    ],
    links: [{ label: 'New home page (preview)', href: '/preview/landing' }],
  },
  {
    id: 'users-filters-in-address',
    date: '2026-11-26',
    kind: 'improved',
    area: 'User Management',
    title: 'User Management remembers its filters when you go back or refresh',
    summary:
      'Opening a customer and pressing "Back to Users" used to reset the list: the search, the status, "Needs action", "Exchange" and the page were all forgotten. They are now kept in the page address, so Back, a refresh, or a link you send to a colleague opens exactly the same list.',
    howItWorks: [
      'Example: choose "Connected exchange" and search "daniel". The address becomes …/admin/users?exchange=connected&q=daniel. Open Daniel, look around his tabs, press "Back to Users": the list is still on Connected exchange, still searching "daniel".',
      'Switching between Users and Staff keeps the search and the status, and drops the customers-only rows ("Needs action", "Exchange").',
      'The search now waits until you pause typing before it filters, like the other admin lists.',
    ],
    technical: [
      'AdminUsers: useUrlFilters({group, status, action, exchange, role, q, page}) with allowed values; SearchField for q. lib/adminUsersReturn.ts remembers the list’s search in sessionStorage (router state does not survive the profile rewriting its ?tab=); AdminUserDetail’s Back and UserHeaderActions’ post-delete navigate use usersListPath(group). ?group=staff links still work.',
    ],
    links: [{ label: 'User Management', href: '/admin/users' }],
  },
  {
    id: 'users-connected-exchange-filter',
    date: '2026-11-26',
    kind: 'new',
    area: 'User Management',
    title: 'Filter customers by the exchange they have connected',
    summary:
      'Dima asked for a "Connected exchange" filter. Under "Needs action" there is now an "Exchange" row: Any, Connected exchange, Binance, Bybit and MEXC, each with how many customers it holds. Example: press "Binance" to see only the customers with a Binance account still connected.',
    howItWorks: [
      '"Connected exchange" shows every customer with at least one exchange account still connected, on any exchange. Each exchange button narrows that to customers connected on that exchange.',
      'Demo (play-money) accounts count as connected; the customer’s row still marks them as demo. Disconnected accounts and the test accounts used by the invoice scenarios do not count.',
      'It works together with the other filters, e.g. "Owes money" + "Binance", and with the search box.',
    ],
    technical: [
      'pages/admin/AdminUsers.tsx: ExchangeFilter (all | connected | ExchangeKind) over AdminUser.accounts (deleted_at null and not sandbox); the chip rows share a ChipGroup component. GET /admin/users rows now carry `sandbox` per account (AdminController::users).',
    ],
    links: [{ label: 'User Management', href: '/admin/users' }],
  },
  {
    id: 'privacy-policy-stripe-ai-assistants',
    date: '2026-11-26',
    kind: 'fixed',
    area: 'Legal',
    title: 'Privacy Policy names Stripe for card payments and says what our AI assistants read',
    summary:
      'The Privacy Policy still said card payments went through Coinsbuy. They go through Stripe, and Coinsbuy has been hidden since September. It also did not mention that our team’s AI assistants (Grok, and Claude for the developers) read customer data. Both are now written down in section 05, "Who We Share It With", and the policy is dated 26 November 2026.',
    howItWorks: [
      'Card payments: Stripe receives the customer’s name, email, the invoice amount and month, and the card typed on its page. Stripe keeps the card on file at Stripe; we never see the card number.',
      'AI assistants: they can read account names, balances, trades, profit, invoices and, where we allow it, the Telegram username. Never a password, an API key, an email, an IP address or a WhatsApp number.',
      'The owner approves the wording from Admin → To be Done.',
    ],
    technical: ['lib/privacy.ts (sharing section + updatedAt). Owner to-do privacy-policy-ai-provider.'],
    links: [{ label: 'Privacy Policy', href: '/privacy' }],
  },
  {
    id: 'ai-access-last-sign-in',
    date: '2026-11-26',
    kind: 'fixed',
    area: 'AI Access',
    title: 'Grok says "last signed in", not "last active"',
    summary:
      'Grok’s list of people called the date "last active", but that date only changes when someone signs in, so Grok could tell you a customer was active when they had only signed in. It is now "last sign-in", the same as the admin pages.',
    howItWorks: ['Ask Grok "when did Juan last sign in?" — the answer is the last time Juan signed in, nothing more.'],
    technical: ['PeopleTools users: last_active → last_sign_in (from user_credentials.last_activity).'],
    links: [{ label: 'AI Access', href: '/admin/ai-access' }],
  },
  {
    id: 'ai-access-telegram-usernames',
    date: '2026-11-26',
    kind: 'new',
    area: 'AI Access',
    title: 'Grok can find the Telegram usernames of people who register, on a key you allow',
    summary:
      'Dima asked his Grok for the Telegram usernames of new sign-ups and it could not find them: AI Access hid every way of contacting a person on purpose. Each key now has a second switch, “Allow Telegram usernames”. When it is on, Grok can tell you the Telegram username each person gave when they signed up, and find someone by it. WhatsApp numbers, emails and phone numbers stay hidden from every key.',
    howItWorks: [
      'In Admin → AI Access, each active key shows “No contact details” with an “Allow Telegram usernames” button. Pressing it asks you to confirm, then the key shows who switched it on. “Switch off” takes it away again from the next question.',
      'Example: “Who signed up this week, and what are their Telegram usernames?” Grok lists each person with their username, e.g. @juan_trades, or says they gave none.',
      'You can also ask “Who is @juan_trades?” and Grok finds the person by their username.',
      'The usernames are what people typed at sign-up. Nobody checks them, so one can be mistyped. Telegram has been required at sign-up since 16 November, so some earlier customers may have none.',
      'Keys without the switch see exactly what they saw before.',
    ],
    technical: [
      'ai_access_keys.can_see_contacts (+ _changed_by_name / _changed_at); PUT /admin/ai-access/keys/{id} now takes can_create and/or can_see_contacts (422 NOTHING_TO_CHANGE, KEY_NOT_ACTIVE to switch on a revoked/expired key).',
      'PeopleTools is a KeyScopedToolset (new interface; KeyAwareToolset extends it): the users tool adds telegram_username (“@handle” | null), with_telegram and a search that matches the handle, only for that key. AiRedactor::clean($answer, AiRedactor::allowedFor($key)) keeps telegram_username for it alone; whatsapp / discord_username / email / phone are dropped for every key. Bare `telegram` keys (sign-up source counts) are untouched.',
      'GuideTools::CONTACT_INSTRUCTIONS is added to the initialize instructions for that key; the guide explains the field.',
    ],
    links: [{ label: 'AI Access', href: '/admin/ai-access' }],
  },
  {
    id: 'landing-preview-pixel-hero',
    date: '2026-11-26',
    kind: 'improved',
    area: 'Website',
    title: 'New home page preview: the Wall Street photo is back, the price card is pixel art, and it no longer says "Binance" only',
    summary:
      'The top of the new home page (still on the hidden preview address, not live for visitors) now shows the same Wall Street photo the current home page uses, turned into a pixel mosaic to suit the name Pixel Alpha. The live Bitcoin price card is redrawn as pixel art. The headline now says "your own exchange account" instead of "your own Binance account", with badges for Binance (live), Bybit and MEXC (coming soon).',
    howItWorks: [
      'The photo is the classic page’s own, shown as large square blocks and darkened so the words stay readable, in light and dark mode. It also loads far faster: 15 KB instead of 3 MB.',
      'The price card still shows Binance’s real Bitcoin futures prices, refreshed every few seconds. Only the drawing changed: blocky corners, depth shown as rows of small squares, the chart at the bottom built from stacked blocks, and a blinking square when the prices are live.',
      'The exchange badges follow the same switch as the connect page. When Bybit or MEXC opens to customers, its badge turns to "Live" by itself, and the "coming soon" lines further down the page disappear.',
      'Two lines further down no longer name Binance only: "The order lands on your exchange" and "follow them in your exchange’s app".',
    ],
    technical: [
      'components/landing-next: HeroPhoto (public/assets/hero-wallst-pixel.png, 128×72 px, 32 colours, image-rendering: pixelated; behind nav + hero in one header), PixelOrderBook (notched clip-path frame, litCells meters, Silkscreen as font-pixel), venues.ts (VENUES from EXCHANGE_META available && !staffOnly, shared with KeyPermissions). hooks/useOrderBook shared with the classic landing/OrderBook. PixelField removed. The live home page (/) is unchanged.',
    ],
    links: [{ label: 'Open the preview', href: '/preview/landing' }],
  },
  {
    id: 'paused-accounts-get-exits',
    date: '2026-11-25',
    kind: 'fixed',
    area: 'Billing',
    title: 'An account paused for an unpaid invoice still has its positions closed',
    summary:
      'When a customer’s trading is paused because an invoice is unpaid, the bot used to stop working on that account completely. It opened nothing new, which is the point of the pause, but it also ignored the exit signal for positions already open, so a customer could be left holding a position nobody would close. Now a paused account still gets its exits: no new trades until the invoice is paid, but whatever is open is closed when the strategy exits it, like everyone else’s.',
    howItWorks: [
      'Example: a customer is in an LTC long when their invoice goes unpaid on the 4th, and trading pauses. On the 6th the strategy exits LTC: the bot closes that customer’s LTC long too. A BUY signal on the 7th is not placed on their account. As soon as they pay, new trades resume by themselves.',
      'Admin → Dashboard → Open positions now marks such a position "PAUSED · UNPAID" and lets an admin close it. Before, it was greyed out as "the engine does not trade it".',
      'The Signal Log lists a refused entry as "Paused for an unpaid invoice (exits still run)". It counts as normal, so it never turns the health banner amber.',
      'The bot also keeps reading a paused account’s balance and trades again, so its closes are recorded and its next invoice uses an up-to-date balance.',
      'Only a pause for an unpaid invoice works this way. An account an admin switches off by hand, with nothing owed, is still left alone completely.',
    ],
    technical: [
      'Invoice::pausedAccountIds($exchange) = accounts billed by an unpaid-past-due invoice (not SBXINV-).',
      'GET /engine/{x}/accounts?include_paused=1 adds them with exits_only: true. Only an engine that asks sees them, so either side may deploy first.',
      'Engine: accounts_api asks; webhook._run_account skips ENTRIES with reason "paused (unpaid invoice)"; exits, pollers and admin close-positions run as usual; size_check ignores them.',
      'AdminOpenPositionsController: closable + paused_unpaid. SignalHealth: paused_unpaid (normal).',
    ],
    links: [
      { label: 'Open positions', href: '/admin?tab=positions' },
      { label: 'Signal Log', href: '/admin/trade-logs' },
    ],
  },
  {
    id: 'faq-fees-as-invoiced',
    date: '2026-11-25',
    kind: 'fixed',
    area: 'FAQ',
    title: 'FAQ: fees and billing now describe exactly what the invoices do',
    summary:
      'The FAQ’s fee answers described a simpler rule than the invoices actually follow. They said "20% of the profit, nothing else", "billed only on profit above the high-water mark" and "you never pay twice for the same gain". They now describe the invoices as they work today: 20% of the month’s closed profit plus 6% of open profit, the whole month’s closed profit once the month ends above the mark, and the 6% on open profit never credited back. Nothing about the invoices themselves changed.',
    howItWorks: [
      '"What does it cost?" now names both rates: 20% of the month’s closed profit after exchange fees, and 6% of the profit on positions still open when the bill is made on the 1st. It also says a month with no fee still shows as a $0 invoice with nothing to pay.',
      '"What is the high-water mark?" now explains how deposits and withdrawals move the mark, and that a month above the mark is billed on its whole closed profit. Example: mark $2,300, April ends at $2,250, May closes +$250 to end at $2,500 → May’s fee is $50, not $40.',
      'A new answer, "How are positions still open at month end billed?", explains the 6% on open profit. That 6% is not credited when the trade closes later (its profit is then billed at 20% if that month ends above the mark), and it is not refunded if the trade closes at a loss.',
      '"What happens if I don’t pay?" now gives the real schedule: bill on the 1st, reminders on the 2nd and 3rd, pause on the 4th. (For a few hours it said a paused account’s open positions are not closed, which was true then; the same evening the bot was changed to close them, and the answer says so.)',
      '"Does the exchange charge fees too?" now says the 20% is worked out after exchange fees, and the 6% on open profit before the fee for closing.',
      'Whether these rules should change is still the owner’s decision, under "Decide how the public pages describe the fee" in To be Done.',
    ],
    links: [
      { label: 'FAQ: fees and billing', href: '/faq' },
      { label: 'To be Done', href: '/admin/todo' },
    ],
  },
  {
    id: 'faq-card-payments-and-flagged-keys',
    date: '2026-11-25',
    kind: 'fixed',
    area: 'FAQ',
    title: 'FAQ: card payments and flagged keys answered as they work today',
    summary:
      'Two FAQ answers were out of date. "How do I pay?" still said card payments were not available, although every invoice has a "Pay with Stripe" button and customers already pay by card. "What if my key gets flagged?" said any successful check clears the flag, which is no longer true for a key that is not allowed to trade.',
    howItWorks: [
      '"How do I pay?" now names both buttons on an invoice: "Pay with crypto" (USDT on TRON) and "Pay with Stripe" (card). It says each one marks the invoice paid by itself, and that the customer gets an email when the payment arrives.',
      '"What if my key gets flagged?" now lists the three usual causes and what to do about each: the wrong IP address on the key, futures trading not allowed on the key, or a key that no longer exists. It names the button to press after the fix, says the check also asks whether the key may trade, and keeps the rule that a key still refused 3 days after it was first flagged is disconnected.',
    ],
    links: [{ label: 'FAQ', href: '/faq' }],
  },
  {
    id: 'terms-no-manual-trading',
    date: '2026-11-25',
    kind: 'improved',
    area: 'Legal',
    title: 'Terms and Conditions: no trading by hand on a connected account',
    summary:
      'The Terms and Conditions have a new section 4.3. Customers agree not to trade by hand on the exchange account they connected to Pixel Alpha: no opening or closing positions themselves, no own take-profit or stop-loss, no changing its leverage or settings. The section explains why. We record every trade on that account, not only the bot’s, so a trade made by hand counts in their profit and loss, their high-water mark and their monthly fee, like any other trade. The "Last updated" date is now 25 November 2026.',
    howItWorks: [
      'Example: a customer opens a LTC long by hand and closes it at +$100. That +$100 shows in their results and counts towards their monthly fee exactly like a bot trade. If it had closed at −$100, the loss also counts and lowers the month’s result.',
      'The section also explains the side effects. The exchange merges a hand-made trade with the bot’s position in the same coin, so the bot’s exit closes both. And closing the bot’s position by hand puts the account out of step with everyone else’s on later signals.',
      'It says Pixel Alpha is not responsible for losses or differences caused by trading by hand, and that such trades do not reduce a fee that is due. Customers who want to trade themselves are pointed to a separate exchange account or sub-account.',
      'Deposits and withdrawals are not affected: the section says they are never counted as profit or loss.',
      'The one exception is leaving: a customer may close their own positions just before they disconnect, and that close counts like any other trade.',
      'The FAQ says the same. "Can I trade manually on the same account?" now answers no, says why and points to section 4.3. "How do I stop?" used to tell customers to close their positions themselves, which the new rule would have forbidden; it now says that closing out when you stop is allowed. The Risk Disclosure already warned against trading by hand.',
    ],
    links: [{ label: 'Terms and Conditions', href: '/terms' }],
  },
  {
    id: 'signup-email-contact-and-ip',
    date: '2026-11-25',
    kind: 'improved',
    area: 'Sign-up',
    title: 'The "new sign-up" email shows how to reach the person and where they signed up from',
    summary:
      'The email the team gets when someone new registers now also shows their Telegram, their WhatsApp number, the country they signed up from, their IP address, the device they used and where they heard about us, beside the name and email it already had. Telegram and WhatsApp are links: one tap opens a chat with them. Example: "Telegram @jonathan_meyer · WhatsApp +66812345678 · Location: Thailand (TH) · IP address 203.0.113.42 · Device: Safari 18 on iOS 18 · phone · Heard about us from: YouTube, Google search".',
    howItWorks: [
      'The country, IP and device are the ones they REGISTERED with. The email itself is sent once they enter the code from their inbox, which can happen later from another network or computer, so it never shows that second place by mistake.',
      'The location is the country only. Showing the city is an open decision on Admin → To be Done.',
      '"Heard about us from" lists the boxes they ticked on the sign-up form, with their own words when they ticked "Other". It says "Did not say" when they skipped the question.',
      'Telegram and WhatsApp are exactly as the person typed them at sign-up; nobody checks them, and the email says so.',
      'If something is not on record, the email says "Not given" or "Not known" rather than leaving a blank. The email still goes out even if these details cannot be read.',
      'The same details were already on each user’s admin page, under the Sign-up info tab. Who receives the email is unchanged and still set on Admin → Notifications.',
    ],
    technical: [
      'NewRegistrationNotice gains ip / location / telegram / whatsapp / device / heardFrom (nullable). AccountMail::registrationPending reads them via signupFacts(): the first user_access_events row with event = register (never the verify request) + ContactHandles::forUser + SignupSources::forUser, in its own try so a failed read still sends the notice. AccessLog::location() turns CF-IPCountry into "Thailand (TH)" (intl Locale; "T1" = Tor; code alone without intl); DeviceInfo::describe() and SignupSources::describe() (+ LABELS, kept in step with lib/signupSources.ts) write the other two lines. Template now uses emails.partials.facts. Sample data in EmailCatalogue (documentation IP 203.0.113.42). Tests in AccountMailTest.',
    ],
  },
  {
    id: 'landing-record-hides-retired-coins',
    date: '2026-11-25',
    kind: 'improved',
    area: 'Website',
    title: 'The home page’s results leave out coins we no longer trade',
    summary:
      'Later the same day, BTC and ALGO were taken out of the home page’s results because we no longer trade them. The page now covers LTC, RENDER and SANTOS, and says so under the chart: "Covers LTC, RENDER and SANTOS. Coins we no longer trade are left out." The return on capital it shows went from +36.38% (every coin) to +44.84%, over 334 trades.',
    howItWorks: [
      'BTC (traded May to June) and ALGO (July to August) lost −8.46% between them, so leaving them out raises the published figure. That is why the page always states that retired coins are left out; the heading also changed from "See every trade, verified" to "See our trades, verified".',
      'A coin we start trading later appears on the home page by itself. Retiring another coin means adding it to the list of coins left out.',
      'The Telegram recaps still cover every coin, as before.',
    ],
    technical: [
      'GET /public/track-record?exclude_symbols=BTCUSDT,ALGOUSDT (new API param: the TRADES of those markets are dropped, P&L included, same parsing / cap / cache-key rule as symbols, echoed as excluded_symbols). LANDING_TRACK_RECORD_EXCLUDE in lib/trackRecord.ts; recordScopeNote() writes the sentence on both home pages (pinned by trackRecord.test.ts). Rollback: empty the list.',
    ],
  },
  {
    id: 'landing-record-every-coin',
    date: '2026-11-25',
    kind: 'improved',
    area: 'Website',
    title: 'The home page’s track record now covers every coin we trade',
    summary:
      'The results on the home page used to show Litecoin (LTC) trades only. No LTC trade had closed since 24 October, so the page looked a month old. It now includes every coin our account has traded: today that is RENDER, SANTOS and LTC, plus BTC and ALGO from earlier in the year. The return on capital it shows went from +40.32% (LTC only) to +36.38% (every coin) on the day of the change.',
    howItWorks: [
      'Every coin ever traded is included, not only the ones traded today. BTC (May to June) and ALGO (July to August) are no longer traded and lost −8.46% between them. Showing only today’s coins would have printed +44.84%, a better number obtained by leaving losing coins out, which a track record must not do.',
      'A coin added in future appears on the home page by itself, with nothing to change.',
      'The home page now covers the same trades as the daily, weekly and monthly recaps on the Telegram channel, which always included every coin.',
      'Results from both of our live accounts (Binance and MEXC) are included, so the note under the figures now says "From our own live accounts" instead of "on Binance".',
      'The latest-trades list on the new home page preview now shows the most recent trades on any coin (for example RENDER on 24 Nov) instead of month-old LTC trades.',
    ],
    technical: [
      'LANDING_TRACK_RECORD_SYMBOLS = [] in lib/trackRecord.ts, so GET /public/track-record is called with no ?symbols= (the pooled, unfiltered record: same cache key as the Creatives facts). Rollback: put [\'LTCUSDT\'] back. Live figures on 2026-11-25: every coin ROC 36.38% / 389 trades; LTC only 40.32% / 228; LTC+RENDER+SANTOS 44.84% / 334; BTC+ALGO −8.46% / 55.',
    ],
  },
  {
    id: 'landing-redesign-preview',
    date: '2026-11-25',
    kind: 'new',
    area: 'Website',
    title: 'A redesigned home page, ready to review on a hidden address',
    summary:
      'A new version of the home page, written to read less like a generic template. It shows the strategy’s latest closed trades near the top, uses drawings instead of slogans to show how a trade happens and how the bill works, and says plainly what happens after someone signs up. Visitors still see the current home page until it is switched over.',
    howItWorks: [
      'Latest closed trades: the last five trades our own account closed, each as a percentage after exchange fees (for example LTC/USDT, LONG, +1.18%). Losing trades are listed exactly like winning ones. No amounts are ever shown.',
      'How a trade happens: five steps from the strategy’s signal to the monthly invoice, with the customer’s own Binance account marked as the place the money stays.',
      'The API key: a drawing of the key settings on Binance (reading on, futures on, withdrawals off), showing why we can trade but never withdraw.',
      'How the bill works: a worked example. $2,000 deposited; March +$300 → $60 bill; April −$200 → $0; May +$150 but still under the March high → $0. It states the 20% and 6% rates and the 1st / 4th invoice dates.',
      'What happens after you sign up: create the account (with Telegram and WhatsApp), we approve it, connect Binance (1,000 USDT minimum), and the next signal trades.',
      'The icons are hand-drawn pixel art, to suit the name Pixel Alpha. The page works in light and dark mode and on phones.',
      'MEXC and Bybit are shown as coming soon.',
    ],
    technical: [
      'Route /preview/landing (pages/LandingPreview.tsx, noindex meta while mounted, not in lib/visitPages.ts so it is not counted); components/landing-next/*; fee example + standard rates + MIN_DEPOSIT_USDT in lib/pricing.ts (pinned by pricing.test.ts). The latest closes are `recent_closes` on GET /public/track-record: each close’s P&L after fees over the capital ITS venue’s master account started the day with (the Telegram exit message’s basis), pooled record = merge of the per-venue slices, 5 newest, a close with no P&L yet left out. Rollback tag `landing-classic` in both repos.',
    ],
    links: [{ label: 'Open the preview', href: '/preview/landing' }],
  },
  {
    id: 'landing-mexc-coming-soon',
    date: '2026-11-25',
    kind: 'fixed',
    area: 'Website',
    title: 'The home page and FAQ no longer say MEXC is open',
    summary:
      'MEXC was closed to new customers on 23 Nov, but the home page still showed it as "Live now · Futures", the "how it works" step said "Link your Binance or MEXC account", and the FAQ listed it as a supported exchange. All three now say Binance, with MEXC and Bybit coming soon.',
    howItWorks: [
      'The exchange cards on the home page now follow the same switch the connect page uses, so the next time a venue opens or closes, the home page changes with it — nobody has to remember to edit the text.',
      'Customers who already trade on MEXC are not affected: their accounts keep trading. The FAQ says so.',
    ],
    technical: [
      'components/landing/Exchanges.tsx derives `live` from EXCHANGE_META (`available && !staffOnly`) instead of a hand-kept list; HowItWorks.tsx and lib/faq.ts copy.',
    ],
  },
  {
    id: 'admin-sidebar-groups',
    date: '2026-11-25',
    kind: 'improved',
    area: 'Admin portal',
    title: 'The admin sidebar is grouped into five folders that open on hover',
    summary:
      'The admin sidebar had grown to 24 links in one long list. They now sit in five folders — Customers, Trading, Money, Marketing and System — with only Admin Dashboard and To be Done left on top. Rest the mouse on a folder and its pages slide open; on a phone, tap it.',
    howItWorks: [
      'Customers: User Management, Customers vs Master, API Keys, Activity, Affiliate. Trading: Strategies, Trading Assets, Positions, Signal Log. Money: Invoice History, Crypto Transfers. Marketing: Visitors, Creatives. System: Bot Engine, Error Bot, Webhooks, System Resources, Notifications, AI Access, Sandbox.',
      'The folder holding the page you are on is always open, so you can always see where you are. Example: on a customer’s profile, Customers stays open with User Management highlighted.',
      'Folders you open with the mouse stay open while the mouse is in the sidebar, so nothing jumps under the pointer as you move down; they fold away when you leave it. A folder you click (or tap on a phone) stays open, and this device remembers it.',
      'Nothing was removed and every page keeps its address. Activity, System Resources and Positions got their own icons (Activity and System Resources used to share one).',
      'Read-only collaborators see only their own pages, and a folder with a single page for them shows that page directly.',
    ],
    technical: [
      'components/admin/AdminSidebar.tsx (ADMIN_NAV, groups + top items), components/admin/AdminNavGroup.tsx (header + grid-rows 0fr→1fr panel, inert when shut), hooks/useNavGroups.ts (open = holds the current page | pinned in localStorage `pixel-alpha.admin-nav.open` | mouse-hovered for 120 ms, cleared on leaving the rail), types/adminNav.ts.',
    ],
  },
  {
    id: 'rate-limiter-deadlock-retry',
    date: '2026-11-25',
    kind: 'fixed',
    area: 'Website',
    title: 'The public pages no longer show an occasional error when they load',
    summary:
      'Now and then a visitor opening the website got an error instead of the price strip (or the order book, or the track record). Nothing was wrong with the data: two of the page’s requests reached the server’s visit counter at the same instant, and the database turned one of them away. The server now simply tries that step again, so the page loads normally.',
    howItWorks: [
      'Every visitor has a small counter on the server that limits how many requests they may send per minute. The landing page asks for several things at once, so those requests all touch the same counter together.',
      'When two of them collided, the database refused one and the visitor saw an error. Now that step is retried up to 3 times, a split second apart, and the request goes through.',
      'The limit itself is unchanged: the same counter guards sign-in and password reset, so a request is never let through without being counted.',
      'Found and fixed by the error bot’s PC agent (job #3), checked and released by hand.',
    ],
    technical: [
      'App\\Support\\RetryingRateLimiter (bound with extend() in AppServiceProvider, because the cache provider is deferred) re-runs each limiter call on a deadlock only (SQLSTATE 40001 / MySQL 1213 — never a 1205 lock wait timeout, which arrives after ~50 s) up to 3 times with a 5–25 ms jittered pause; only the outermost call retries, never inside an open transaction on the cache connection, and the last failure is still thrown (never fails open). Seen as a 500 on GET /api/public/market-ticker.',
    ],
  },
  {
    id: 'admin-notifications-page',
    date: '2026-11-23',
    kind: 'new',
    area: 'Notifications',
    title: 'Notifications: choose which team emails are sent, and to whom',
    summary:
      'A new page, Admin → Notifications, lists every email the team receives (new sign-up, a customer connected an exchange, invoice paid, disputed payment, kill switch, failed trades, high-risk alerts). Each one can be switched on or off and has its own list of email addresses, which an admin edits on the page — no developer needed.',
    howItWorks: [
      'Each email shows when it is sent and who gets it. Type an address and press Add; press × on an address to remove it. Changes save at once.',
      'Example: “A customer connected an exchange” can go to Dima only, while “New sign-up” keeps going to the whole team.',
      'Switching an email off asks for confirmation first. “Back to the default list” puts it back to the list the server started with.',
      'Two alerts are “Always on”: a close that failed and the high-risk alert. They cannot be switched off or left without an address, because they report a position that may still be open or a serious fault on the bot.',
      'New: the team is now emailed when a customer connects (or reconnects) an exchange account. Staff accounts are not announced.',
      '“See the email” opens a sample of that email. Every change is recorded on Admin → Activity, with who made it.',
    ],
    technical: [
      'TeamNotices::recipients(slug) is the one answer for every team notice; no notification_settings row (or recipients NULL) = the old env lists MAIL_ADMIN_ADDRESS / TRADE_ALERT_EMAILS. GET|PUT /admin/notifications[/{slug}], full admins. Critical slugs (trade-exit-stuck, risk-alert) refuse NOTICE_CRITICAL / NOTICE_NEEDS_RECIPIENT; an unreadable table falls back to the default list.',
      'team-exchange-connected is now live: ExchangeAccountController::store, customers (type user) only, best-effort.',
    ],
    links: [{ label: 'Notifications', href: '/admin/notifications' }],
  },
  {
    id: 'admin-activity-log',
    date: '2026-11-23',
    kind: 'new',
    area: 'Activity',
    title: 'Activity log: what every user did, and the same list on each customer’s Timeline',
    summary:
      'The system now records what users do themselves — changing a password or email, updating Telegram / WhatsApp, connecting, renaming, rechecking or disconnecting an exchange account, opening a payment, sending a transaction ID, payout wallets — and shows it on a new page, Admin → Activity, together with every sign-in, sign-up and admin action, newest first. Each customer’s Timeline tab shows their own slice.',
    howItWorks: [
      'Admin → Activity: one row per event with the user’s name (click it for their profile), what happened, when, and where from (device, country, IP for sign-ins). Filter by Their own actions / Sign-ins & sign-ups / Admin actions, search a name or email, and pick dates.',
      'Example: “Lena Fischer — Connected a Binance account "Lena main" (live) — IP 198.51.100.40”, followed by “Sample Admin marked invoice #19 paid”.',
      'User Management → a customer → Timeline now also shows their own actions and sign-ins, with filter buttons: Their actions, Sign-ins, Admin & notes, Billing, Exchange & trading.',
      'Only successful actions are recorded (a wrong password is not “changed their password”). Passwords, API keys and contact details are never written — only that they changed.',
      'Users’ own actions are recorded from today (23 Nov 2026); sign-ins go back to 14 Oct 2026 and admin actions to 11 Nov 2026.',
    ],
    technical: [
      'user_activity_logs, written by the `activity:<action>` route middleware (RecordUserActivity → UserActivity) after a 2xx without success:false. ActivityFeed = UNION ALL of user_activity_logs + user_access_events + admin_audit_logs; GET /admin/activity?source=&q=&from=&to=&page=, full admins. CustomerTimeline adds kinds customer + signin.',
    ],
    links: [{ label: 'Activity', href: '/admin/activity' }],
  },
  {
    id: 'mexc-closed-to-customers',
    date: '2026-11-23',
    kind: 'improved',
    area: 'Exchange accounts',
    title: 'MEXC is closed to new customer connections again (Bybit stays closed)',
    summary:
      'Customers can no longer connect a new MEXC account; the connect page shows MEXC and Bybit as “Coming soon”. Staff can still connect both. Any MEXC account already connected keeps trading and can still be renamed or disconnected.',
    howItWorks: [
      'A customer opening Exchange Accounts → Connect sees Binance only as available.',
      'Reopening MEXC later is a setting on the server plus a website update — no code change.',
    ],
    technical: ['EXCHANGES_STAFF_ONLY=mexc,bybit on the box + EXCHANGE_META.mexc.staffOnly = true.'],
    links: [],
  },
  {
    id: 'vs-master-leaderboard-why-weekly',
    date: '2026-11-23',
    kind: 'improved',
    area: 'Customers vs Master',
    title: 'Customers vs Master: P&L leaderboard, head-to-head chart, why each customer is behind, and a weekly Telegram summary',
    summary:
      'The Customers vs Master page gained a P&L leaderboard with the master pinned on top, a head-to-head chart of one customer against the master, and a split of each customer’s gap into its causes. Every Monday the admin Telegram group gets a short summary of the week.',
    howItWorks: [
      'P&L leaderboard: the master first (gold, with a crown), then every customer best first, by dollars after fees or by return %. Hover a figure for before fees.',
      'Click a customer in the leaderboard or the table: a card opens with both running returns over the period (gold = master, blue = the customer) and “Why the gap”.',
      'Why the gap splits the difference into four parts that add up to it: the same trades doing better or worse, master trades they missed, their own extra closes, and the time before they joined. Example: Tom is −2.72 pp behind; −1.32 pp is the 11 master trades he missed, −1.00 pp is the same trades doing worse, −0.40 pp his own extra closes.',
      'The table has a “Main reason” column with the biggest of those parts.',
      'Every Monday at 09:13 (Manila time) the admin Telegram group gets last week’s master return, how many customers kept up, and everyone more than 1 percentage point behind with their main reason, plus a link to the page.',
    ],
    technical: [
      'gap_parts per row in MasterComparison: each close’s share = P&L after fees ÷ its day’s start balance (the same division as the daily %); same / missed / extra / before over the pairing. GET /admin/insights/vs-master/{uniId} = both sides’ daily %.',
      'php artisan insights:vs-master-weekly [--dry-run] [--from --to], scheduled Mondays 09:13 Asia/Manila → EngineCache::teamReport → engine POST /admin/team-report (admin chat only, 📊).',
    ],
    links: [{ label: 'Customers vs Master', href: '/admin/vs-master' }],
  },
  {
    id: 'customers-vs-master-page',
    date: '2026-11-23',
    kind: 'new',
    area: 'Customers vs Master',
    title: 'New page: every customer’s return ranked beside the master’s',
    summary:
      'Admin → Customers vs Master ranks every customer by their return over the same days as the master, shows how far ahead or behind the master each one is, and how many of the master’s trades each one actually took.',
    howItWorks: [
      'Four headline tiles: the master’s return (with its profit after fees, trades and win rate), how many customers matched or beat it, the average and median gap, and the share of the master’s trades the customers followed.',
      'A ranking chart: one bar per customer, with the master’s return drawn as a gold line through them — right of the line is ahead of the master, left of it behind.',
      'A ranking table you can sort by any column: return, “vs master” (e.g. +1.10 pp means 1.1 percentage points better than the master), profit after fees (before fees on hover), trades, win rate, master trades followed (e.g. 19/22 · 3 missed), days ahead of the master, and balance. Click a name to open that customer’s analytics.',
      'Example: the master made +2.31% this month. A customer at +2.61% reads “+0.30 pp”; one who missed 6 of the master’s 22 trades and made +1.48% reads “−0.83 pp” and “16/22 · 6 missed”.',
      'Filters: exchange, dates (this month by default, last month, last 7 / 30 days, all time or your own dates), show everyone / only those ahead / only those behind / only those who missed trades, and a name search. They stay in the page link.',
      'Return is the same figure as each customer’s P&L calendar: each day’s profit after fees over the money the account started that day with, added up — so a deposit or a withdrawal does not move it. A master trade only counts against a customer who had an account on that exchange at the time.',
    ],
    technical: [
      'GET /admin/insights/vs-master?exchange=&from=&to= (admin group, cached 60 s) → App\\Services\\Admin\\MasterComparison: UserStatsService::dailyReturns per owner (customers type = user, real money, disconnected included), pairing master ↔ customer closes on exchange + coin + side within 900 s one to one, days ahead / behind on the master’s trading days. Test: AdminVsMasterTest.',
      'Page /admin/vs-master (pages/admin/AdminVsMaster.tsx, components/admin/vs-master/, lib/vsMaster.ts). Full admins only, not in collaboratorMayOpen.',
    ],
    links: [{ label: 'Customers vs Master', href: '/admin/vs-master' }],
  },
  {
    id: 'strategy-filters-side-results-list',
    date: '2026-11-23',
    kind: 'improved',
    area: 'Strategies',
    title: 'Strategies: Long / Short filter, wins or losses only, and the filter bar on the list too',
    summary:
      'The strategy filter bar gained a Long / Short choice, the trades table can show only wins or only losses, and the Strategies list page now has the same filter bar as each strategy’s page.',
    howItWorks: [
      'Side: Both, Long or Short, each with its trade count. Example: VWMA-Reversion, SANTOS, Short shows whether the short side of that coin is making or losing money.',
      'Past Positions table: All / Wins / Losses (after fees), to review only the losing trades of a coin.',
      'Strategies list: pick coins, exchange, side, accounts and dates once and every strategy card is measured on those trades. “View in-depth details” carries the same filters into that strategy’s page.',
    ],
    technical: [
      'GET /admin/strategies trades now carry side (App\\Services\\Positions\\TradeSide::closed — position_side, else the closing order inverted). URL key side=long|short in hooks/useStrategyFilters.ts; StrategyCard takes the list’s query string.',
    ],
    links: [{ label: 'Strategies', href: '/admin/strategies' }],
  },
  {
    id: 'strategy-page-filter-bar',
    date: '2026-11-23',
    kind: 'new',
    area: 'Strategies',
    title: 'Each strategy’s page can now be filtered by coin, exchange, accounts and dates',
    summary:
      'A strategy’s page (Admin → Strategies → a strategy) has a filter bar at the top, and every card on the page follows it: the totals, win rate, equity curve, win / loss, rolling, seasonality, heatmap and the trades table. Before, only the trades table could be narrowed, and to one coin.',
    howItWorks: [
      'Coins: pick one or several. Example: VWMA-Reversion with only SANTOS picked shows SANTOS’s result alone. Pick SANTOS and LTC to see the two together. Each coin shows how many trades it has under the other filters.',
      'Exchange: All, Binance, Bybit or MEXC (only the exchanges the strategy traded on). The same coin on two exchanges counts as one coin.',
      'Accounts: all accounts, the master only (the strategy’s own result), customers only, testers only, or one person picked from a list.',
      'Dates: last 7 days, last 30 days, this month, last month, or your own From and To dates.',
      'What is picked shows as small chips under the bar, each with an ✕, plus “Clear all”. The line under the strategy’s name says what the page is measuring, for example “SANTOS/USDT · Binance · master account only · Last month”.',
      'Clicking a coin in the heatmap or the asset cards narrows the whole page to that coin.',
      'The filters are kept in the page link, so Back, a refresh or a link sent to a colleague opens the same view. Old “Master only” links still work.',
    ],
    technical: [
      'Frontend only, over the trades GET /admin/strategies already returns (uni_id, owner_name, owner_role, exchange): lib/strategyFilters.ts + hooks/useStrategyFilters.ts (URL keys coins, exchange, owner = all|master|customers|testers|u:<uni_id>, date, from, to) + strategy-detail/StrategyFilterBar.tsx on the shared filter kit.',
      'Coins are keyed by letters and digits (coinKey in lib/chart.ts), so LTCUSDT and LTC_USDT are one coin, in the filter and in computeStrategyDetail’s per-asset cards. displaySymbol no longer prints “LTC_/USDT”.',
      'lib/dateRange.ts gained “This month” / “Last month” (MONTH_DATE_PRESETS, opt-in via DateRangeFilter’s presets prop); other pages keep their list. Days are the reader’s calendar days.',
    ],
    links: [{ label: 'Strategies', href: '/admin/strategies' }],
  },
  {
    id: 'positions-cards-follow-filters',
    date: '2026-11-23',
    kind: 'fixed',
    area: 'Positions',
    title: 'The Positions page’s figures now follow the coin, exchange and strategy filters',
    summary:
      'Picking a coin (for example SANTOS) on the Positions page narrowed the trade lists but left the Realized, Unrealized and Total P&L cards — and the analytics tiles under “Show Analytics” — showing the whole account. They now describe exactly the trades the lists show.',
    howItWorks: [
      'Example: with SANTOS picked, Realized P&L is the sum of the SANTOS closed trades only, Unrealized is the open SANTOS position, and Total Trades, Win rate, Profit Factor, Average win / loss and Max Drawdown are worked out from those same trades.',
      'The percentage beside each figure is still measured against the account’s deposits, so a coin’s share of the account’s profit reads at the same scale as the whole account.',
      'With no filter picked, every figure is exactly what it was before.',
    ],
    technical: [
      'Frontend only: lib/positionFilterStats.ts recomputes the summary cards from the filtered rows with UserStatsService::summary’s rules (after fees for P&L, before fees for the ratios, drawdown on UTC day totals from equity − realized).',
    ],
    links: [{ label: 'Positions', href: '/dashboard/positions' }],
  },
  {
    id: 'dev-agent-auto-investigate-memory',
    date: '2026-11-23',
    kind: 'new',
    area: 'Bot engine',
    title: 'The AI developer investigates new errors by itself and remembers what it learns',
    summary:
      'The first time a new kind of problem appears, the AI developer on the developer’s computer starts looking into it without anyone tapping a button, and the explanation arrives in Telegram. After every job it writes down what it learned, and it reads those notes before the next job, so a problem it has seen before is answered faster. The notes are on Admin → Error Bot → Memory, where they can be corrected, added to, deleted or downloaded.',
    howItWorks: [
      'Example: a new “order refused” on a coin appears. The problem message says “Your PC agent is looking into it by itself (job #12)”, and a minute later the answer follows: Binance allows at most 20× on that coin. The note “allows at most 20× on Binance” is saved, so next time it is recognised straight away.',
      'The same kind of problem is investigated by itself at most once a week, and at most 10 a day. It only reads: it never changes a setting, the code or the live site by itself.',
      'It can be switched off on Admin → Error Bot (“Investigate new errors by itself”). Pausing the AI developer stops it too.',
    ],
    technical: [
      'API: DevBotJobs::autoInvestigate (kind key 7 days, 10/UTC day, shares the Investigate button key), source `auto`; dev_bot_memories (claim → `memories`, finish → `memory` {title, body, replaces_id}); dev_bot_settings.auto_investigate; /admin/devbot/memories CRUD. PC: dev-agent prompt carries YOUR MEMORY and asks for a memory note.',
    ],
    links: [{ label: 'Admin → Error Bot', href: '/admin/error-bot' }],
  },
  {
    id: 'dev-bot-engine-errors',
    date: '2026-11-23',
    kind: 'improved',
    area: 'Bot engine',
    title: 'The trading engine’s own failures now reach the error bot too',
    summary:
      'When the trading engine itself has a hard failure — one of its data readers crashing, Binance limiting or banning our requests, or monthly billing or the daily recaps switching off — the private error bot now says so as well, with an Investigate button. Until now these only went to the admin Telegram group.',
    howItWorks: [
      'Example: if reading closed trades from Binance keeps timing out, the bot sends “Engine error · poller ‘past-positions’ failing” with Binance’s message, once an hour at most while it lasts.',
      'It can be switched off on Admin → Error Bot (“Engine errors”) without touching the admin group, which still gets every message.',
    ],
    technical: [
      'Engine: notify.notify_error also calls forward_dev_alert → POST /api/engine/binance/dev-alert in a daemon thread (BINANCE_ABCD_DEV_ALERTS, default on, off in tests). API: EngineController::devAlert → DevBotReporter::engineAlert, kind `engine` in DevBotSetting::KINDS.',
    ],
    links: [{ label: 'Admin → Error Bot', href: '/admin/error-bot' }],
  },
  {
    id: 'admin-error-bot-page',
    date: '2026-11-23',
    kind: 'new',
    area: 'Bot engine',
    title: 'Admin → Error Bot: see every service, choose what the bot sends, pause the AI developer',
    summary:
      'A new admin page for the private error bot. It shows whether each service is up (the same answer as /status in Telegram), lets you switch off each kind of message or mute everything for 1, 8 or 24 hours, pause the AI developer on the developer’s computer, send a test message, and see every job the AI developer did with its answer.',
    howItWorks: [
      'Example: during a busy hour you tap “Mute everything → 1 hour”. The bot stays quiet until then, but still answers /status and anything you ask it.',
      'Switching off “Failed scheduled jobs” stops only those messages; trade problems, server errors and the others keep arriving.',
      'Pausing the AI developer keeps new Investigate requests and deploys waiting until you switch it back on. A job that has not started can be cancelled, and a finished one can be run again (a deploy asks first, since it updates the live site).',
    ],
    technical: [
      'GET /admin/devbot, PUT /admin/devbot/settings, POST /admin/devbot/test, POST /admin/devbot/jobs/{id}/cancel|retry (full admins). dev_bot_settings (disabled_kinds, muted_until, agent_paused) read by DevBotSetting::allows() on every first-spoken send; a paused agent’s claim returns no job.',
    ],
    links: [{ label: 'Admin → Error Bot', href: '/admin/error-bot' }],
  },
  {
    id: 'dev-bot-status-and-deploy',
    date: '2026-11-23',
    kind: 'new',
    area: 'Bot engine',
    title: 'Ask the error bot whether everything is running, and deploy a merged fix from Telegram',
    summary:
      'The error bot now answers “/status” (or “is the crypto listener up?”) in a second with every service: the trading engine, the crypto payment listener, invoicing, the scheduled jobs, background jobs, alerts and disk. It also warns by itself when one of them stops and when it comes back, and reports any server error. When a fix the AI developer prepared is approved on GitHub, the bot offers to put it live.',
    howItWorks: [
      'Example: /status shows “🟢 Crypto payment listener (USDT, mainnet) — last scan 20 s ago, 0 unmatched payments” and “🟢 Invoicing — next monthly run 1 Dec 16:00”. Anything red is named in plain words.',
      'If the crypto listener stops scanning, one message says so; when it scans again, one message says it recovered. It never repeats every few minutes while something is down.',
      'After a fix is merged on GitHub, the bot says what would change (for example “the website and the trading engine”) and asks “Deploy?”, then “Yes, deploy now?”. Only then does the developer’s computer take a backup, put it live and check the site, and the bot reports the result. Typing “deploy” offers the same for the current version.',
    ],
    technical: [
      'API: App\\Services\\DevBot\\{SystemStatus, DevBotWatch}, devbot:watch (every 5 min), scheduler heartbeat, exception + ScheduledTaskFinished hooks, POST /api/devbot/agent/merged, dd:* buttons → a deploy job. PC: dev-agent/agent.py check_merges() + run_deploy() through .claude/deploy_sinegualcrypto.py, refusing unclean or diverged repos.',
    ],
  },
  {
    id: 'dev-agent-investigates',
    date: '2026-11-22',
    kind: 'new',
    area: 'Signal Log',
    title: 'The error bot can hand a problem to an AI developer, who explains it and proposes a fix',
    summary:
      'Every problem message from the error bot now has an “Investigate on my PC” button, and anything typed to the bot becomes a task too. An AI developer running on the developer’s own computer looks into it with read-only access to the live data, replies in Telegram with what went wrong, and, when the code needs fixing, prepares the change for review on GitHub.',
    howItWorks: [
      'Example: “why did the LTC buy at 14:15 skip?” typed to the bot. The bot answers “Job #3 queued”, then “working on it”, then the explanation: for instance that the main account was already full, so nothing is broken.',
      'When code really is wrong, the AI writes the fix with a test, and the bot sends a link to the proposed change on GitHub. Nothing goes live until the developer approves it there and it is deployed.',
      'It never changes the live site or the trading bot itself, and it never publishes customer names or amounts: a change that mentions one is held back.',
    ],
    technical: [
      'API: dev_bot_jobs, App\\Services\\DevBot\\DevBotJobs, /api/devbot/agent/{claim, jobs/{id}/progress, jobs/{id}/finish, private-strings} behind X-Devbot-Agent-Key (DEV_BOT_AGENT_KEY). PC: dev-agent/agent.py polls, runs Claude Code headless in git worktrees with the read-only MCP connector, pushes devbot/job-<id> and opens the pull request.',
    ],
  },
  {
    id: 'dev-error-bot',
    date: '2026-11-22',
    kind: 'new',
    area: 'Signal Log',
    title: 'Trading problems now arrive as a private Telegram message, with one-tap fixes for missing coins',
    summary:
      'A private Telegram bot (@errorpixel_bot) messages the developer directly whenever a signal runs into a real problem: an order refused, a key blocked, a coin that is not set up. Serious alerts (kill switch, a close that failed, the bot engine not answering) arrive there too. When a signal names a coin that is not set up yet, the message offers size buttons, and tapping one adds the coin straight away.',
    howItWorks: [
      'Example: a sub-master buy on ASR is refused because ASR is not set up. The bot sends: “$5 → 79 ASR (~$50 position)”, “$10 → 159 ASR (~$100 position)”, “$15 → 238 ASR (~$149 position)” and “Skip”. The dollars are the margin one entry puts up on a $1,000 account, like Binance’s Cost line.',
      'The leverage is the one the alert sends (25×), or the coin’s Binance maximum when that is lower (ASR allows 10×, so the positions are smaller). Amounts are rounded to what Binance accepts, and a size Binance would refuse is never offered.',
      'When the alert asks for more leverage than Binance allows, the message says so and shows the fix: for ASR, change "leverage": 25 to "leverage": 10 in the alert. The same note comes with any entry Binance refuses because of its leverage, saying whether the number came from the alert or from the coin’s own setting on Trading Assets.',
      'Tapping a size adds the coin on Trading Assets for the next signal: that size per entry, three entries at most. The change history names who approved it from Telegram. A second tap, or a tap after the coin was added by hand, changes nothing.',
      'Normal outcomes (stack already full, nothing to close, a coin switched off on purpose) are never sent. The same problem on the same coin is sent once an hour, not on every signal.',
      'Only the developer’s Telegram account can press the buttons. Anyone else who finds the bot is told it is private.',
    ],
    technical: [
      'API: App\\Services\\DevBot\\{DevBotTelegram, DevBotReporter, CoinSuggestion, DevBotActions}; dev_bot_actions table; POST /api/devbot/telegram (Telegram webhook, X-Telegram-Bot-Api-Secret-Token + the owner’s Telegram id); php artisan devbot:webhook. Signals are read after the engine has its answer (terminating callback); new RiskAlerts are forwarded from RiskAlerts::raise. Coins are added through App\\Services\\Assets\\AssetCreator, now shared with Trading Assets → Add. Config DEV_BOT_TOKEN / DEV_BOT_CHAT_ID / DEV_BOT_WEBHOOK_SECRET, box-local (never mirrored).',
    ],
    links: [{ label: 'Signal Log → Issues', href: '/admin/trade-logs?view=issues' }],
  },
  {
    id: 'calendar-readable-on-phones',
    date: '2026-11-20',
    kind: 'fixed',
    area: 'Trading dashboard',
    title: 'P&L calendars: the biggest days are readable, and phones no longer overlap',
    summary:
      'On the brightest green or red days, the figures were green on green (or red on red) and hard to read. They now use plain white text (dark text in the light theme). On phones, the small trade-count badge no longer sits on top of the day number, and the figures fit inside their boxes.',
    howItWorks: [
      'Example: a +$107 day, the best of the month, used to show light green text on a bright green box. It now shows white text on that box.',
      'On a phone the trade-count badge is smaller and tucked into the corner, and the admin calendar shows only the arrows beside the month so the month name stays on one line.',
    ],
    technical: [
      'lib/pnlCalendar.ts STRONG_TINT (0.5): at or above it the cell text is text-text instead of the tone colour. Below 480px both calendars use 4px cell padding and a 4px grid gap, and the badge shrinks to 12px.',
    ],
  },
  {
    id: 'dashboard-calendar-pct-switch',
    date: '2026-11-20',
    kind: 'improved',
    area: 'Trading dashboard',
    title: 'Daily P&L Calendar can show each day in % with one click',
    summary:
      'Every Daily P&L Calendar has a new $ / % switch: on the trading dashboard, on a customer’s profile and under Overview → Platform. On %, each day’s big figure is the percentage it made or lost, with the dollar amount under it. The site remembers the choice on that device, for every calendar.',
    howItWorks: [
      'Example: a day that made +$52 on a $3,231 balance shows +1.61% in % mode, with +$52 underneath.',
      'The percentage is over the balance that day STARTED with, so a later deposit or withdrawal never changes an earlier day.',
      'In % mode the colours follow the percentage too. After a withdrawal, a small-dollar day can be a big percentage day, and it is coloured as one.',
      'On a phone the cells show one decimal (+1.6%) so the figure fits. Tapping the day still shows the exact figure.',
    ],
    technical: [
      'CalendarUnitSwitch + hooks/useCalendarUnit (localStorage pixel-alpha.calendar.show-pct, shared by DailyPnlCalendar and AdminPnlCalendar) + lib/pnlCalendar.ts (cellFigures, cellTints). Reads the existing per-day pct; no API change. Below 480px wide the cell rounds the % to 1 dp.',
    ],
    links: [{ label: 'Overview → Platform', href: '/admin' }],
  },
  {
    id: 'strategies-hide-quantlab',
    date: '2026-11-20',
    kind: 'improved',
    area: 'Strategies',
    title: 'The two QuantLab strategies are hidden from the Strategies page',
    summary:
      'The Strategies page no longer shows the “ANN Strategy (Original) - QuantLab” and “VWMA Reversion - QuantLab” cards. Both were test strategies that stopped trading on Pixel Alpha on 13 Nov and now run on the Nexa test site, so the page leads with the live strategy, VWMA-Reversion.',
    howItWorks: [
      'Nothing is deleted: their trades stay in the history, and each still has its own page if opened by its link.',
      'Bringing a card back is a one-line change.',
    ],
    technical: [
      'HIDDEN_STRATEGIES in pages/admin/AdminStrategies.tsx filters the trades before grouping; GET /admin/strategies and the detail route are unchanged.',
    ],
    links: [{ label: 'Strategies', href: '/admin/strategies' }],
  },
  {
    id: 'strategy-trades-whose-and-master-only',
    date: '2026-11-19',
    kind: 'improved',
    area: 'Strategies',
    title: 'Strategy page names whose trade each row was, and can show the master alone',
    summary:
      'The trade list on a strategy’s page now has an Account column with the owner’s name, and the master’s rows carry a gold “Master” tag. A new “Master only” switch narrows the view to the master’s own trades: the switch at the top of the page changes every figure on it, and the switch on the trade list changes that list alone.',
    howItWorks: [
      'Example: on VWMA-Reversion with 616 trades from every account, pressing “Master only” at the top shows the master’s trades alone, so the total, win rate, equity curve and per-coin cards show the strategy’s own result, without customers who joined late or were sized differently.',
      'The search box on the trade list also finds an account by name.',
      'The top switch is kept in the page link, so going back or refreshing keeps the choice.',
    ],
    technical: [
      'GET /admin/strategies rows carry owner_name + owner_role (user_credentials; AdminInsights::strategyTrades). isMasterTrade() in lib/strategyStats.ts; ?owner=master on /admin/strategies/:key filters before computeStrategyDetail; TradesTable has its own All / Master only switch, hidden when the page is already master-only.',
    ],
    links: [{ label: 'Strategies', href: '/admin/strategies' }],
  },
  {
    id: 'strategy-pages-after-fees',
    date: '2026-11-19',
    kind: 'improved',
    area: 'Strategies',
    title: 'Admin strategy pages now show profit after exchange fees first',
    summary:
      'Every figure on the admin strategy pages is now what actually landed on the accounts, after Binance’s fee, which is the same number the exchange app shows. The figure before fees is still there: hover over (or tap) a figure to see before fees, the fee and after fees. Customers’ own pages are unchanged and still lead with before fees.',
    howItWorks: [
      'Example: a SANTOS close on 18 Nov made +$0.18 on price, but the fee was $2.25. The list used to show +$0.18 in green. It now shows −$2.07 in red, and the hover shows +$0.18 before fees, −$2.25 fees.',
      'This covers the strategy list, each strategy’s page (the totals, the trade list, the equity curve, the per-coin winners and losers and the “By exchange” card), and the Strategies leaderboard. A customer’s own strategy pages and the “Strategy Analysis” card on their Performance Analytics stay as they were, before fees first.',
      'On the admin pages, win rate, profit factor, drawdown and the other ratios are worked out after fees too, so a trade that only won before fees now counts as a loss. Some win rates will read lower than before. Nothing was recalculated in the data, and invoices are unchanged.',
    ],
    technical: [
      'lib/strategyStats.ts: PnlBasis net | gross (default net, the admin pages); the trader’s StrategyDetail + StrategyAnalysisCard pass gross, and EquityCurveCard takes basis. tradePnl = realized_pnl (net), tradePnlGross adds exchange_fee back, tradePnlOn picks by basis. Twins renamed cumulativeNet → cumulativeGross, totalPnlNet → totalPnlGross; DetailTrade.pnlGross, AssetStat.totalPnlGross, ExchangeSplit.totalPnlGross. Hovers use the shared PnlBreakdown.',
    ],
    links: [{ label: 'Strategies', href: '/admin/strategies' }],
  },
  {
    id: 'submaster-role-feed',
    date: '2026-11-18',
    kind: 'new',
    area: 'Users & signals',
    title: 'A sub-master account with its own signals',
    summary:
      'There is a new account type, Sub-master: a second house account that trades its OWN signals, separately from the master’s. It has its own webhook address with its own secret. Only sub-master accounts receive those signals, and a sub-master never receives the master’s TradingView signals. It sees the normal trading dashboard, not the admin portal, and is never billed.',
    howItWorks: [
      'Example: a TradingView alert posts a LTC buy to the sub-master address. Only the sub-master’s Binance account opens it. The master and every customer are untouched. The master’s usual LTC alert still trades the master and the customers, never the sub-master.',
      'Sub-master signals are reported in the private admin Telegram group under a purple “SUB-MASTER FEED” banner. Nothing is posted in the public channel or on Discord.',
      'It uses the same coin sizes as everyone, but its own win/loss run for streak sizing. The master’s full position never holds it back.',
      'The Signal Log has a “Sub-master” filter. Admin → Webhooks lists the three new addresses, and the manual trade console can send to them.',
      'A user can be moved to or from Sub-master only while they hold no open position, because a position opened by one set of signals would never receive its close from the other.',
    ],
    technical: [
      'user_credentials.type = submaster (UserCredential::SUBMASTER; not in EnsureAdmin::ROLES or the staff group). WebhookPaths::SUBMASTER + feedForRole(); /engine/{x}/accounts → feed: submaster. Engine hooks.SUBMASTER_FEED / FEED_PATHS / PRIVATE_FEEDS, BINANCE_ABCD_SUBMASTER_WEBHOOK_SECRET (= API ENGINE_SUBMASTER_WEBHOOK_SECRET, mirrored). trade_logs.feed widened to 16 chars.',
    ],
    links: [
      { label: 'Webhooks', href: '/admin/webhooks' },
      { label: 'Signal Log', href: '/admin/trade-logs?feed=submaster' },
    ],
  },
  {
    id: 'high-risk-alerts',
    date: '2026-11-18',
    kind: 'new',
    area: 'Alerts',
    title: 'High-risk alerts by email, on the Overview, and proof when a trade reaches the wrong accounts',
    summary:
      'Serious problems are now emailed at once to the high-risk list and stay in red at the top of Admin → Overview → Needs attention until someone marks them resolved. Every trade is also checked against who it was meant for. If an account outside a signal’s group gets filled, the Signal Log row shows exactly which accounts, and the alert goes to Telegram as well.',
    howItWorks: [
      'Six problems raise an alert: (1) a trade filled accounts outside its group, for example a customer filled from the sub-master’s signal; (2) a close failed for good, so a position may still be open; (3) the kill switch switched a coin off; (4) the master’s or sub-master’s exchange key was refused; (5) the bot engine stopped answering for about 4 minutes; (6) a signal was refused because the bot could not load the coin list.',
      'One problem is one alert. If it keeps happening, the alert counts it again (“seen 5 times”) and emails at most once an hour, so the inbox is not flooded.',
      'Two alerts close themselves: a key that works again, and the engine answering again. The rest stay until an admin presses “Mark resolved”, with an optional note.',
      'The check does not trust the bot. For every filled entry it looks up each account owner’s role and compares it with the signal’s group. Closes are never judged, because an open position must always be closable.',
    ],
    technical: [
      'App\\Services\\Alerts\\RiskAlerts (risk_alerts table, emailed to TRADE_ALERT_EMAILS via RiskAlertNotice, hourly re-email, engine POST /admin/risk-alert for Telegram) and FeedAudit (on POST /engine/{x}/trade-logs, entries only → trade_logs.breach). engine:watch every 2 min (ENGINE_HEALTH_WATCH, default on in production). Overview attention.risk_alerts (full admins); POST /admin/risk-alerts/{id}/resolve. The health banner and hourly summary now include the sub-master feed.',
    ],
    links: [{ label: 'Overview → Needs attention', href: '/admin?tab=overview&view=attention' }],
  },
  {
    id: 'kill-switch-price-losses',
    date: '2026-11-17',
    kind: 'improved',
    area: 'Trading assets',
    title: 'The kill switch ignores losses caused only by the exchange fee',
    summary:
      'The kill switch now counts a loss only when the master’s trade lost money on price. A trade that went the right way but ended slightly negative because of the exchange fee no longer counts as a loss, and it ends the losing run like a win.',
    howItWorks: [
      'Example: SANTOS on 13 Nov made +$1.94 on price, and the $2.29 exchange fee turned it into −$0.35. Before, that counted as a loss toward the kill switch. Now it counts as a win, because the strategy called the direction right.',
      'A real loss still counts as before: a trade that lost $8.38 on price and $13.11 after fees is one loss.',
      'Nothing else changed: only the master’s trades count, the number you set per coin is the same, and turning the coin back on starts the count again.',
    ],
    technical: [
      'KillSwitch::masterLossRun: a close is a loss when realized_pnl + COALESCE(exchange_fee, 0) < 0; a before-fees result ≥ 0 ends the run. Rows with no fee recorded are already gross. Streak sizing is unchanged (still after fees).',
    ],
    links: [{ label: 'Trading assets', href: '/admin/assets' }],
  },
  {
    id: 'grok-creatives',
    date: '2026-11-17',
    kind: 'new',
    area: 'AI Access',
    title: 'Grok can see Creatives, and make images and clips when allowed',
    summary:
      'Grok can now answer questions about Creatives: the content plan, the video projects, what was generated and what it cost, the budget, the brief and the team’s chats. On a key switched on for it, Grok can also make images and clips on Higgsfield and save post ideas. Everything it makes is labelled “Grok”.',
    howItWorks: [
      'Reading works on every key: “What’s planned for TikTok this week?”, “Which scenes of the BTC video failed and why?”, “How much of this month’s budget is left?”.',
      'Making something takes two steps. Example: “Make a still of Pixel celebrating a green day.” Grok asks Higgsfield for the price (free) and answers “about $0.004, $73 of $100 left this month. Shall I start it?” Only after you say yes does it start, and that price can be started only once.',
      'Limits: at most $1.00 for one image or clip, $20 a day per key, and never past the team’s monthly cap. Pixel’s pictures and posts may never carry a money amount or a customer’s name, even though Grok can read them.',
      'It is OFF for every key until a full admin presses “Allow creating” on that key in Admin → AI Access (confirmed first). The key shows what its Grok spent today and this month. “Switch off” returns it to reading only.',
      'What Grok makes appears in the Gallery and the Budget as “Grok”; post ideas land in the planner at the Idea stage for the team to review. Nothing is posted by itself.',
    ],
    technical: [
      'CreativeTools (8 read tools) and CreativeMakeTools (price_generation, start_generation, save_plan_idea; a KeyAwareToolset listed and run only for ai_access_keys.can_create). Quotes in cache 15 min, pulled on start. creative_generations.ai_access_key_id; PUT /admin/ai-access/keys/{id} {can_create}. Download links: signed, 24 h. The Creatives assistant’s query_data still runs only the data tools (AiTools::dataToolNames), so its tool list did not change.',
    ],
    links: [{ label: 'AI Access', href: '/admin/ai-access' }],
  },
  {
    id: 'creatives-shared-chats',
    date: '2026-11-17',
    kind: 'improved',
    area: 'Creatives',
    title: 'Creatives chats are shared by the whole team, with names on every message',
    summary:
      'Every staff member can now see and continue every chat with the Creatives assistant. Each message shows who wrote it and when, and each video has one chat for the whole team.',
    howItWorks: [
      'The new “Chats” button (Creatives top bar, and in the video editor’s chat) lists the team’s chats from the last 7 days: who started each, who wrote in it, and the latest message. Open one to read it or carry on.',
      'Each message shows its author, for example “Dima · 14:02”.',
      'In the video editor everyone lands in the same chat for that video. “New chat” starts the next one for everyone; the old one stays in the list.',
      'While the assistant is answering someone, the chat waits for that answer to finish. A teammate who types meanwhile sees “The assistant is still answering Dima in this chat. It’s yours in a moment.” This keeps two people’s requests from getting mixed up.',
      'A teammate’s new messages appear on your screen within about 10 seconds, without refreshing.',
      'When someone is making clips, everyone sees it: the editor says “Dima is generating — 2 of 3 steps done” (“You are generating” for yourself), and the video list says “Dima is generating”. Nobody is blocked; a teammate can still add or remake other scenes.',
      'Anything the assistant makes or spends is recorded under the person it was answering.',
    ],
    technical: [
      'CreativeAgent::resolveSession: any staff member may open a chat by id; the editor chat is the newest live session of the video (any user). Person messages store display.author. answeringFor(): a cache hold per session while a turn says continue (SESSION_BUSY names the person, 180 s TTL). CreativeAgentSession::actor() = the person being answered (plans, videos, job owner). GET /admin/creatives/agent/sessions. Idle poll 10 s.',
    ],
    links: [{ label: 'Creatives', href: '/admin/creatives' }],
  },
  {
    id: 'creatives-faster-generation',
    date: '2026-11-17',
    kind: 'improved',
    area: 'Creatives',
    title: 'Videos are made faster, and each scene shows how long it is taking',
    summary:
      'A scene being made now shows a live timer and how long that usually takes, so a slow scene no longer looks stuck. More scenes are made at the same time, and a video keeps moving while nobody has the editor open.',
    howItWorks: [
      'Timer: “Making the still image (1 of 2) · 1 m 40 s · usually about 3 min” on the scene, and the elapsed time on its tile in the timeline. Past 1.5 times the usual time it says it is taking longer than usual and carries on by itself. The “usually” figure comes from our own finished generations, so it appears once each model has a few.',
      'Why a Kling scene takes two waits: Higgsfield first makes a still image, then animates it. Higgsfield’s own rendering is most of the time and is outside our control.',
      'Up to 6 steps of a video now run at once (was 4), so a 6-scene Kling video starts all six stills together.',
      'With the editor closed, the server now checks Higgsfield about every 30 seconds while something is being made (was every 2 minutes), so a still’s animation starts sooner. When nothing is being made it does no extra work.',
    ],
    technical: [
      'CreativeAgentJobs::MAX_IN_FLIGHT 4 → 6. creatives:poll --for=100 --every=30 (odd minutes, runInBackground; stops as soon as nothing runs). Steps record started_at / ended_at. CreativeTimings: median submit → done per model over 60 days, ≥ 3 runs. Scene payload: progress {started_at, step, steps, step_label, waiting, typical_seconds}.',
    ],
    links: [{ label: 'Video projects', href: '/admin/creatives?panel=videos' }],
  },
  {
    id: 'creatives-scene-history',
    date: '2026-11-17',
    kind: 'new',
    area: 'Creatives',
    title: 'Video editor: a history of every attempt, and why one failed',
    summary:
      'Every attempt at a video’s scenes is now kept: when it started, how long it took, whether it was made or failed, Higgsfield’s own reason, what it cost and who started it. Regenerating a scene no longer wipes out why it failed before.',
    howItWorks: [
      'Click a scene: under it, “Attempts” lists its latest tries. Example: “Failed · Still image · Character image · Higgsfield’s moderation blocked this result. Nothing was charged · took 45 s · $0 · by Dima”, then the retry: “Made · took 2 m 05 s · $0.07 · by Christian”.',
      'The new “History” tab lists every attempt at every scene of the video, newest first, with how many failed. Click one to jump to its scene.',
      'A step that never started (because the still before it failed) says so, and costs nothing.',
    ],
    technical: [
      'GET /admin/creatives/videos/{id}/history (CreativeVideoHistory): every step of every job of the video past Go, with its generation; started_at / ended_at on steps from now on, generation times for older ones.',
    ],
    links: [{ label: 'Video projects', href: '/admin/creatives?panel=videos' }],
  },
  {
    id: 'telegram-whatsapp-required',
    date: '2026-11-16',
    kind: 'new',
    area: 'Sign-up',
    title: 'Telegram and WhatsApp are required to sign up and to connect an exchange',
    summary:
      'Every new customer now gives their Telegram username and WhatsApp number when signing up, so the team can always reach them. Customers who signed up before are reminded on their dashboard and cannot connect a new exchange until both are filled in. Exchanges they have already connected keep trading as normal.',
    howItWorks: [
      'Sign-up: the third screen ("Where can we reach you?") asks for Telegram and WhatsApp, and both must be filled before "Continue". WhatsApp has a country picker beside the number, so a customer in the Philippines picks Philippines (+63) and types 0917 123 4567 the way they write it at home; it is saved as +63 917 123 4567. Discord is still optional. The Discord sign-up asks for the same two.',
      'Existing customers without them: a pop-up on the dashboard (once per visit, "Go to Settings" or "Later") and a caution strip that stays until both are saved. Settings → "Telegram, WhatsApp & Discord" is where they fill them in.',
      'Connecting an exchange: the page says "Add your Telegram username and WhatsApp number first" with a button to Settings, instead of the wizard. Accounts already connected keep trading, and can still be renamed or disconnected.',
      'Once saved, Telegram and WhatsApp can be changed in Settings but not emptied.',
      'Staff accounts (admin, master, tester and the rest) are never locked out.',
      'Admins see the WhatsApp number on the customer’s profile and on the Sign-up info tab; clicking it opens a WhatsApp chat.',
      'Both are typed by the customer and not checked: we check that the number looks like a phone number with a country code, not that it belongs to them.',
    ],
    technical: [
      'user_contact_handles.whatsapp (E.164) — migration 2026_11_16_000001. ContactHandles::REQUIRED = telegram + whatsapp: required on POST /auth/register and /auth/discord/complete, "sometimes|required" on PUT /user/contacts. GET|PUT /user/contacts also return missing[] and connect_locked (type = user only). ExchangeAccountController::store answers 422 CONTACTS_REQUIRED. AiRedactor now drops contacts / whatsapp / phone fields by name. Frontend: lib/whatsapp (calling codes, compose/split), components/auth/WhatsAppInput, dashboard/ContactsGate, the connect page lock. Privacy Policy updated (sections 2, 3, 9).',
    ],
    links: [
      { label: 'Settings (as a customer)', href: '/dashboard/settings#contacts' },
      { label: 'User Management', href: '/admin/users' },
    ],
  },
  {
    id: 'streak-sizing-follows-master',
    date: '2026-11-13',
    kind: 'improved',
    area: 'Trading assets',
    title: 'Smaller trades after losses follow the master, not each customer',
    summary:
      'After a run of losses on a coin, the bot trades smaller. Until now each customer counted their own wins and losses, so a customer could be cut even when the master won. Now every customer follows the master’s results on that coin: if the master wins, nobody is cut. SANTOS’s smaller sizes were also changed to 200, then 150, then 100.',
    howItWorks: [
      'Example from SANTOS on 12 Nov: the master closed +$6.82. Two customers got slightly worse prices and, after exchange fees, ended at −$0.28 and −$0.11. The bot counted that as a loss for them, so on the next trade (+1.5%, the best of the week) they traded about a third of their normal size. With this change they would have traded full size, like everyone else.',
      'If the master loses several in a row, every customer is cut together, including one whose own last trade was a win.',
      'Test accounts (the QuantLab signal line) still count their own trades, because they trade different signals.',
      'On an exchange where the master has no real-money account (Bybit today), each account still counts its own trades, as before.',
      'SANTOS: normal size 400; after 1 loss 200, after 2 losses 150, after 3 or more 100 (it was 125, 70 and 50).',
      'Admin → Trading Assets → Streak Sizing now shows the master’s current run under “Right now”.',
    ],
    technical: [
      'StreakSizing::followedRuns replaces the run of every account owned by a user or the master with StreakSizing::masterRun (the master’s real-money accounts on the venue, KillSwitch::masterKeys, read as one history). GET /engine/{x}/streaks and GET /admin/assets/{id}/streaks use it and also return master_run. No engine change. Tests in StreakSizingTest.',
    ],
    links: [{ label: 'Streak Sizing Settings', href: '/admin/assets?tab=streak-sizing' }],
  },
  {
    id: 'creatives-friendly-endings',
    date: '2026-11-12',
    kind: 'improved',
    area: 'Creatives',
    title: 'Videos end with a friendly goodbye, not a risk warning',
    summary:
      'The video assistant used to close every video that showed a figure with a "Crypto trading is risky" card, and when asked to make that card friendlier it only changed the title to something vague. Videos now end on a warm sign-off that fits the story, and the assistant reads the whole video before it changes a scene.',
    howItWorks: [
      'When the assistant plans a video, the last scene is a friendly sign-off: Pixel waving, "See you next week" and the site name. It no longer adds a risk-warning card or words like "risky" or "warning" on screen. You can still ask for the disclaimer card if you want one.',
      'The post caption still ends with "Past performance does not guarantee future results." whenever the video shows a figure. That line is added automatically, as before.',
      'When you ask it to change one scene, it first reads every scene, card and caption, so the new text continues the story. Example: asked to make the last card of the RENDER weekly recap friendlier, it should write a real goodbye such as "That\'s RENDER\'s week. See you next Friday!" instead of "A friendly note from Pixel".',
      'The playbook and the style guides on the Creatives page were updated the same way. Lines the team had already rewritten were left as they were.',
    ],
    technical: [
      'CreativeAgentPrompt::SYSTEM (videos rule, editor-chat rules, hard rule 2), CreativeAiPrompt::SYSTEM rule 2, CreativeFacts brand.risk → brand.disclaimer. Migration 2026_11_12_000006 rewrites only the exact seeded lines in creative_settings.playbook_markdown and creative_styles.markdown (reversible). The caption disclaimer stays enforced in PHP (CreativeAiOutput::ensureDisclaimer). Test: CreativesFriendlyEndingTest.',
    ],
    links: [{ label: 'Creatives', href: '/admin/creatives' }],
  },
  {
    id: 'trade-failure-emails',
    date: '2026-11-12',
    kind: 'new',
    area: 'Signal Log',
    title: 'Failed trades are emailed: an hourly summary, and at once when a close fails',
    summary:
      'Problems with trades used to reach only the private Telegram group. They now also come by email, without flooding the inbox: one summary per hour, sent only when something needs a look, and an immediate email when the bot cannot close a position.',
    howItWorks: [
      'Every hour, at two minutes past, the bot looks at the hour that just ended. If any account had an order refused, an entry shrunk or skipped at Binance’s position limit, or a signal was rejected, one email lists them per signal, with the customer’s name and the exchange’s own error. A clean hour sends nothing.',
      'A failure the bot fixed by itself on a retry is shown in green as fixed, and does not trigger an email alone. Blocked API keys and similar problems that repeat on every signal are only counted, since they have their own screens.',
      'When Binance refuses a close, or the bot gives up after all its retries, an email goes out straight away: the position may still be open, and that cannot wait an hour. It names each account and links to Open positions, where it can be closed.',
      'Example: at 09:14 SANTOS SHORT, one customer’s entry was shrunk from 10,000 to 4,250 coins to fit Binance’s $10,000 limit, and another had “Margin is insufficient”. Both appear in the 10:02 email.',
    ],
    technical: [
      'TRADE_ALERT_EMAILS (comma list, box-local, empty = off). `trade-alerts:digest` hourlyAt(2) → App\\Services\\Admin\\TradeFailureDigest over trade_logs (main feed, SignalHealth classes, retries folded within 60 min), once per hour (Cache::add). Engine stuck_exits.report → POST /api/engine/{x}/alerts/exit-stuck from the two red "EXIT FAILED — MANUAL ACTION" paths (live-run rejection, retry queue give-up), exits and main feed only. Both templates in EmailCatalogue (trade-failure-summary, trade-exit-stuck).',
    ],
    links: [{ label: 'Signal Log', href: '/admin/trade-logs?view=issues' }],
  },
  {
    id: 'engine-shrinks-to-binance-limit',
    date: '2026-11-12',
    kind: 'new',
    area: 'Trading engine',
    title: 'The bot shrinks an entry that would pass Binance’s position limit',
    summary:
      'Binance refuses any order that would make a position bigger than it allows at the coin’s leverage. Trade sizes grow with each account’s balance, so a customer who deposits enough would have had their later entries refused with nobody watching. The bot now cuts such an entry down to what fits, and skips it only when the position is already at the limit.',
    howItWorks: [
      'Before each entry on Binance, the bot checks the coin’s limit at its leverage and how much of the position is already open. If the new entry would go over, it is reduced to fit, keeping a 3% margin for price moves. If there is no room at all, the entry is skipped as “Binance position limit reached”.',
      'Example: SANTOS at 10× allows $10,000. A 25,000 USDT customer’s third entry would take the position from $8,000 to $12,000, so it is cut to about $1,700. The other accounts trade as usual.',
      'Exits are never touched: an open position can always be closed. If the limit cannot be read, the entry goes out exactly as before.',
      'Shrunk entries carry a “Shrunk to fit Binance’s limit” tag in the Signal Log and appear in the hourly trade email, so the size can be lowered on purpose.',
    ],
    technical: [
      'binance_abcd/exchange_limit.py: fit() before handle_entry in _run_account; brackets from /fapi/v1/leverageBracket cached per host+symbol 10 min (failed read 1 min), mark price 30 s; usable = cap × (1 − BINANCE_ABCD_LIMIT_SAFETY, default 0.03); shrink floored to step, skip below $6. Skip reason "exchange limit reached" → SignalHealth limit_reached (problem). Binance only; a refused leverage disables the check for that entry.',
    ],
    links: [{ label: 'Signal Log', href: '/admin/trade-logs' }],
  },
  // ── 2026-11-12 ───────────────────────────────────────────────────────────
  {
    id: 'creatives-editor-chat',
    date: '2026-11-12',
    kind: 'new',
    area: 'Creatives',
    title: 'A chat inside the video editor that works on the scenes you pick',
    summary:
      'The video editor now has the Creatives assistant on its right side. Click a clip and the chat works on that clip; pick several and it works on those; pick none and it works on the whole video. It can improve one scene with AI, or make free changes (shorter scenes, a new order, captions, music) straight from a sentence.',
    howItWorks: [
      'Open a video project. The chat sits on the right; hide it to a slim bar with the arrow button (the editor remembers this on your computer). On a smaller screen it opens from the Chat button.',
      'Click a clip on the timeline or in the scene list to target it: it gets a gold ring and the message box shows "Scene 3 · The city at night". Ctrl (Cmd on a Mac) adds more, Shift picks a run, and dragging across the scene track picks every clip the drag crosses. Esc or "All scenes" goes back to the whole video.',
      'Each scene has "Improve with AI": it targets that scene, opens the chat and starts the sentence "Improve the visuals of scene 3: " for you to finish. The assistant rewrites that scene\'s prompt and proposes a priced job; nothing is made or spent until someone presses Go.',
      'Free changes need no Go: "make scene 1 three seconds", "move the score card first", "remove the music" are applied at once and the timeline updates.',
      'Your own unsaved edits are saved before each message, so the assistant always sees, and never overwrites, what you just changed.',
    ],
    technical: [
      'GET /admin/creatives/agent/session?video_id=N (the video\'s own session per person), POST /agent/sessions {video_id}; /agent/turn takes focus_scene_ids (≤ 12, sent with that message only). The editor flushes its autosave before a message and re-reads the video after any create_video / add_scenes / edit_video activity, or when one of its jobs moves.',
      'Selection rules are pure and unit-tested (lib/videoEditor/selection.ts). New agent tool edit_video (free edits, non-strict).',
    ],
    links: [{ label: 'Creatives → Videos', href: '/admin/creatives?panel=videos' }],
  },
  {
    id: 'creatives-storyboard',
    date: '2026-11-12',
    kind: 'new',
    area: 'Creatives',
    title: 'The assistant shows a storyboard, and its reasoning, before it builds',
    summary:
      'Before the assistant builds a video of two or more scenes it now shows a storyboard: every scene with its length, which AI makes it, whether Pixel is in it, what we will see, why, and an estimated price. Its reasoning can be read too, under "How it\'s thinking". Scenes can be any length, for example 3 seconds.',
    howItWorks: [
      'Ask for a video in Generate mode. The assistant answers with a storyboard card, for example: 4 scenes, 15 seconds, about $1.92 — "Hook, 3 s, Kling (silent), made 5 s and trimmed to 3 s, about $0.27: a hook under 3 s because TikTok decides in the first seconds".',
      'Below it, it asks "Build it?" with buttons. Only after "Yes" does it build, and the clips still wait for Go on the priced job. Storyboard prices are estimates; the job card shows the exact price.',
      'Any scene length from 2 to 15 seconds: Kling makes 5 or 10 seconds and the editor trims to the length asked; Seedance makes the length asked (4 seconds at least).',
      'Above the assistant\'s answers, "How it\'s thinking" opens a short summary of its reasoning (closed by default). It costs nothing extra.',
    ],
    technical: [
      'New non-strict tool show_storyboard (no money, a display row kind "storyboard" priced from local rates without calling Higgsfield). Assistant messages carry thinking (the summarized thinking blocks, display "summarized"). TOOLS_VERSION 3: chats open before this start fresh once.',
    ],
    links: [{ label: 'Creatives', href: '/admin/creatives' }],
  },
  {
    id: 'creatives-editor-compact',
    date: '2026-11-12',
    kind: 'improved',
    area: 'Creatives',
    title: 'A compact video editor that fits the screen',
    summary:
      'The video editor took too much room. It now fits one laptop screen (1366×768) without scrolling: one header line, the preview beside the scene list, a slimmer timeline below, and the chat on the right.',
    howItWorks: [
      'Header: back, the title, the platform, shape and style, the length, "Saved", Export MP4, and "⋯" for Delete (which still asks first).',
      'The preview sizes itself to the screen\'s height; the scene list and the Captions / Sound / Look tabs scroll on their own; the timeline rows are about half as tall. "Add scenes with AI", "From the Gallery" and "Card · free" are at the top of the Scenes tab.',
      'A running or priced job is one slim line; "Review and Go" opens the full job card with its price.',
      'Between 1024 and 1279 pixels wide the chat opens as a drawer from the right; on a tablet or phone the page stacks and the chat is a sheet from the bottom. Exporting still needs a computer.',
    ],
    links: [{ label: 'Creatives → Videos', href: '/admin/creatives?panel=videos' }],
  },
  {
    id: 'assets-binance-position-limit',
    date: '2026-11-12',
    kind: 'new',
    area: 'Trading assets',
    title: 'The coin editor shows Binance’s position limit for every account',
    summary:
      'Binance only accepts a position up to a certain size at each leverage, and refuses every entry above it. SANTOS at 10× tops out at $10,000. Because trade sizes grow with each account’s balance, a size that fits today can stop fitting once a customer deposits more. The coin editor now checks the size you are typing against that limit for every real-money account before you save.',
    howItWorks: [
      'Open a Binance coin under Trading Assets. Below the Binance check, a new "Binance position limit" card shows the most Binance accepts at the coin’s leverage, the biggest account’s full position against it, and how far the price can rise before it reaches the limit.',
      'Example: SANTOS at 400 per entry, 3 entries, 10×. The master (about 17,000 USDT) builds a full position of about $7,750, which is 78% of the $10,000 limit. The card says it is safe up to an account balance of about 21,900 USDT.',
      'If any account would go over, the card names it in red and the save confirmation warns that its later entries would be refused. If Binance does not allow the leverage at all (the 9 Nov SANTOS problem), it says so and names the highest leverage allowed.',
      '"Every account" opens the full list: each account’s balance, its full position in coins and dollars, and the share of the limit it uses.',
    ],
    technical: [
      'POST /api/admin/assets/position-limit (admin, throttle 30/min) → EngineCache::sizeCheck → engine POST /admin/size-check (X-Admin-Secret). binance_abcd/size_check.py: GET /fapi/v1/leverageBracket with the master’s key (weight 1) + public premiumIndex mark price; projects each non-demo account with the engine’s own _scale_qty / _increment_cap; cap at leverage L = max notionalCap over brackets with initialLeverage ≥ L.',
      'Read-only: nothing is stored and no order is placed. Engine 5xx is answered 503 (never 502).',
    ],
    links: [{ label: 'Trading Assets', href: '/admin/assets' }],
  },
  {
    id: 'creatives-v2-assistant-502',
    date: '2026-11-12',
    kind: 'fixed',
    area: 'Creatives',
    title: 'The Creatives assistant answers again after the video-editor release',
    summary:
      'Right after the video editor went live, every message to the Creatives assistant failed with "Request failed (502)". Anthropic refused the assistant\'s new list of abilities as too complex to check strictly, so nothing was answered and nothing was charged.',
    howItWorks: [
      'The four abilities where a mistake would cost money or show the wrong buttons (proposing a job, building a video, adding scenes, asking with buttons) are still checked strictly. The others are checked by our own server instead, which tells the assistant what to fix when an answer is malformed.',
      'When the AI or Higgsfield cannot be reached, the page now shows a clear sentence instead of "Request failed (502)".',
      'Messages sent while it was failing are answered when the person tries again; no chat had to be restarted.',
    ],
    technical: [
      'Anthropic 400 "The compiled grammar is too large" with all 20 tools strict; strict is now limited to CreativeAgentPrompt::STRICT_TOOLS (ask_choices, propose_job, create_video, add_scenes), measured live. New `php artisan creatives:check-agent-tools` (one minimal live call) because count_tokens does not compile the grammar.',
      'Creatives provider-unavailable errors are 503 instead of 502: Cloudflare replaces an origin 502 with its own error page, which hid the JSON message.',
    ],
    links: [{ label: 'Creatives', href: '/admin/creatives' }],
  },
  {
    id: 'creatives-v2-editor',
    date: '2026-11-12',
    kind: 'new',
    area: 'Creatives',
    title: 'A video editor that makes the whole marketing video, as one MP4',
    summary:
      'Creatives can now finish a video instead of only making single clips. A video project holds up to 30 seconds of scenes on a timeline. The AI makes all of its clips at once, each one lands in its place as soon as it is ready, and the team adds captions, music, a voiceover and arcade sound effects, then downloads one MP4 ready for TikTok or X.',
    howItWorks: [
      'Admin → Creatives → Videos → New project: pick the platform (X or TikTok), the shape (tall 9:16, wide 16:9 or square 1:1) and a style. The editor opens. The assistant can also start a project from the chat ("make a 20-second video of this week").',
      '"Add scenes with AI": describe up to six scenes. For each one choose Kling (silent and cheaper: about $0.27 for 5 seconds) or Seedance (comes with its own sound: about $1.32 for 5 seconds), and whether Pixel appears in it (off unless you switch it on). Nothing is spent until you press Go on the priced job; then every clip is made at the same time, about 3 to 8 minutes for a whole video.',
      'Free "template cards" are drawn in the browser and cost nothing: a title card, a HIGH SCORE board, a LEVEL UP card, a stat card and the disclaimer card, in a clean look or an 8-bit pixel look. Put exact figures on these cards rather than inside an AI clip.',
      'On the timeline: drag a scene\'s edges to trim it, move scenes left or right, add captions (with "Add the disclaimer"), pick music, record or upload a voiceover (the music dips under the voice by itself), and place arcade sounds (coin, power-up, level-up and more). The built-in chiptune makes a new melody at a click and needs no licence. An optional "Pixel look" turns the clips into 8-bit blocks with scanlines.',
      'Export MP4 makes the file in your own browser (Chrome, Edge or Safari 26+), so the server that runs the bot is never slowed down. Higgsfield deletes clips after 7 days, so export within a week of making them; the editor counts down and says which clip is gone.',
      'On a phone the editor shows the video and lets you reorder scenes; exporting needs a computer.',
    ],
    technical: [
      'Route /admin/creatives/editor/:id (lazy chunk). API: /admin/creatives/videos* (CreativeVideos), scenes/propose (prices only; Go = the existing agent-job approve, by any staff member), /exported (metadata only — no video is stored). The timeline document is client-owned JSON (captions, look, music, voiceover, sfx, clip audio volume, ducking), autosaved 1.5 s after an edit; the project is re-read every 5 s while a scene is planned or generating.',
      'Export: mediabunny over WebCodecs in a Web Worker (H.264 + AAC, 30 fps, 1080×1920 / 1920×1080 / 1080×1080, fast-start MP4); @mediabunny/aac-encoder is loaded only when the browser has no AAC encoder. Clips come from the CDN, falling back to our signed download. The soundtrack is mixed in an OfflineAudioContext on the main thread. Preview and export share the drawing code (lib/videoEditor/templates.ts, look.ts).',
      'Chiptune and sound effects are procedural and deterministic (preset + seed; lib/videoEditor/chiptune.ts, sfx.ts). Audio library: /admin/creatives/audio (15 MB each, 40 files at most, signed file links).',
    ],
    links: [{ label: 'Creatives → Videos', href: '/admin/creatives?panel=videos' }],
  },
  {
    id: 'creatives-v2-styles',
    date: '2026-11-12',
    kind: 'new',
    area: 'Creatives',
    title: 'Marketing styles, buttons in the chat, and Pixel only where he is wanted',
    summary:
      'Videos can now come out in different looks. A library of marketing styles (Data recap, Pixel arcade, Pixel storytime, Cinematic b-roll, Fast cut) tells the assistant how a video should look and sound, and a video playbook says how every video is built. Before it builds a video the assistant asks the platform, the shape and the style with buttons in the chat, then shows the scene list and asks "Build it?".',
    howItWorks: [
      'Admin → Creatives → Styles: each style has a one-line summary, its rules in plain text and the defaults a new video gets (platform, shape, how much Pixel, Kling or Seedance, the caption look, the card look, the music, the Pixel look). Anyone on the team can edit one, switch it off or add a new one.',
      '"Pixel arcade" is the 8-bit style: a pixel-art world, a HIGH SCORE card for the week\'s result, a LEVEL UP card, chiptune music and coin and power-up sounds.',
      'Pixel is now OFF by default: he appears only in the scenes a style or a plan asks for (usually one scene, or none). The rest is b-roll, charts and text.',
      'For each scene the assistant picks Kling (silent and cheaper, the music carries it) or Seedance (with its own sound, for dialogue or effects).',
      'Admin → Creatives → Playbook is the base every video follows. Admin → Creatives → Context shows exactly what the assistant reads before it answers, with a Copy button for each part.',
      'Because the assistant learned new tools, open chats were closed once and a fresh chat opened. Memory, the brief and the plans are unchanged.',
    ],
    technical: [
      'creative_styles (/admin/creatives/styles; delete refused while a video uses it), creative_settings.playbook_markdown (/admin/creatives/playbook), GET /admin/creatives/agent/context (read-only). Agent tools v2: ask_choices (a "choices" chat row; a button sends its value as the next message), get_style, create_video, add_scenes, get_video, list_videos. creative_agent_sessions.tools_version: an older chat is not resumed (notice "new_tools").',
      'Seedance text-to-video is a new Studio model ("seedance-text-video"): Seedance with sound and no character pictures.',
    ],
    links: [
      { label: 'Creatives → Styles', href: '/admin/creatives?panel=styles' },
      { label: 'Creatives → Context', href: '/admin/creatives?panel=context' },
    ],
  },
  {
    id: 'creatives-v2-data',
    date: '2026-11-12',
    kind: 'new',
    area: 'Creatives',
    title: 'The assistant can look up our trading data; posts stay public figures only',
    summary:
      'In the Creatives chat the assistant can now answer questions about our own data, the same way the Grok connector does: signals, trades, coins, customers and billing. Anything meant to be POSTED still uses only the public results (the same percentages and trade counts the Telegram recaps show), and the server refuses a plan or a video that contains a dollar amount or a customer\'s name.',
    howItWorks: [
      'Ask, for example, "how did RENDER do on Binance this week?" or "which coin traded most this month?". The chat shows a quiet "Looked up" line while it reads.',
      'Results for a post can now be asked per exchange and per coin, day by day ("last 7 days on Binance, LTC only").',
      'If the assistant tries to put a dollar figure or a customer\'s name into a plan, a caption, a scene or a card, the save is refused and it is told why. What people type by hand is not checked.',
    ],
    technical: [
      'Agent tools query_data (the AI Access toolsets, redacted, answers capped at 60 KB) and get_week_results (+ days, exchange, coin, daily). Post guard PRIVATE_IN_POST on create_plan / update_plan / create_video / add_scenes: money amounts and the names of customer accounts.',
    ],
    links: [{ label: 'Creatives', href: '/admin/creatives' }],
  },
  {
    id: 'creatives-seedance-rate',
    date: '2026-11-12',
    kind: 'fixed',
    area: 'Creatives',
    title: 'Seedance videos are priced at Higgsfield\'s current rate',
    summary:
      'A Seedance video reserved more of the monthly budget than it really cost: a 5-second clip at 720p held about $2.31 while Higgsfield charges about $1.32. It is now priced at Higgsfield\'s own current rate, so the budget is no longer used up early.',
    howItWorks: [
      'Seedance now costs about $0.26 a second at 720p and about $0.12 a second at 480p, for the character video and the new text-to-video alike. The budget still checks the price before anything is spent.',
    ],
    technical: [
      'CreativeModels: seedance-reference and seedance-text-video usd_per_second 480p 0.1177, 720p 0.2647 (Higgsfield\'s own answer of 2026-11-11, "without video input"); it was 0.2056 / 0.4622.',
    ],
    links: [{ label: 'Creatives → Budget', href: '/admin/creatives?panel=budget' }],
  },
  // ── 2026-11-11 ───────────────────────────────────────────────────────────
  {
    id: 'creatives-kling-price',
    date: '2026-11-11',
    kind: 'fixed',
    area: 'Creatives',
    title: 'Animated videos can be priced and started again',
    summary:
      'Any job that turned a still of Pixel into a video stopped at "Higgsfield did not give a price", so nothing was made. Higgsfield was working fine. It had started answering the price check for this one video model with a written rate ("$0.0525 per second of video") instead of a number, and the page only knew how to read a number.',
    howItWorks: [
      'The page now prices that video model itself from Higgsfield\'s published rate. Example: a 10-second clip is about $0.53, a 5-second one about $0.26. The monthly budget still checks the price before anything is spent.',
      'Still images and the character video were never affected.',
    ],
    technical: [
      'CreativeModels: kling-animate gains usd_per_second = 0.0525 (a single rate; fallbackUsd now takes a float or a per-resolution table). Its /estimate answers {type: description} since 2026-11-11.',
    ],
    links: [{ label: 'Creatives', href: '/admin/creatives' }],
  },
  {
    id: 'daily-pct-withdrawal-after-trades',
    date: '2026-11-11',
    kind: 'fixed',
    area: 'Performance Analytics',
    title: 'A withdrawal no longer blows up that day\'s percentage',
    summary:
      'When a customer withdrew money on a day a trade closed, the day\'s percentage was measured on what was LEFT after the withdrawal. One customer emptied about $16,000 a few hours before a losing close and that day read −47%, while the strategy lost −2%. The trade had been sized on the money still in the account, so a withdrawal now counts after that day\'s trades.',
    howItWorks: [
      'Affects only days where a withdrawal and a closed trade fall on the same day: the P&L calendar cell, Period Return on Performance Analytics, and the Customer profit card. Example: that customer\'s 22 Oct goes from −47% to about −2%, and his October from −45.7% to −0.3%.',
      'Deposits are unchanged: they still count before the day\'s trades. Dollar figures, invoices and the public track record are unchanged.',
    ],
    technical: [
      'UserStatsService::capitalWalk: max(flow, 0) before the day\'s P&L, min(flow, 0) after it. daily_returns rows are rewritten by pnl:daily-returns (every 15 min) or on the next analytics read. PublicStatsController\'s walk is untouched.',
    ],
    links: [{ label: 'Customers tab', href: '/admin?tab=customers' }],
  },
  {
    id: 'visitors-click-a-day',
    date: '2026-11-11',
    kind: 'new',
    area: 'Visitors',
    title: 'Click a day on the Visitors chart to see that day\'s pages, sources and visits',
    summary:
      'Clicking a bar on the Visitors chart now narrows the whole page to that day: the numbers, where visitors came from, which pages they opened, countries, devices and the visitor log. The chart keeps showing the whole period, so the next day is one click away.',
    howItWorks: [
      'Admin → Visitors → click any bar. A gold strip says "Showing Oct 30, 2026 only", and everything below the chart follows that day. For a long period the bars are weeks, and a click shows that week.',
      'Click the same bar again, or "Back to the whole period", to go back. The period itself (Today, Last 7 days, Last 30 days, Custom dates) is still chosen at the top of the page.',
      'The clicked day is part of the page\'s link, so a copied link opens on the same day.',
    ],
    technical: [
      'Frontend only: ?day= (and ?day_to= for a week) in useVisitorFilters, kept inside the period; the cards fetch GET /admin/visitors/summary for that day, the log takes it as from/to, and the chart keeps the period\'s summary.',
    ],
    links: [{ label: 'Visitors', href: '/admin/visitors' }],
  },
  {
    id: 'customers-signups-chart',
    date: '2026-11-11',
    kind: 'improved',
    area: 'Admin Dashboard',
    title: 'The New sign-ups chart has dates, a scale and works on a phone',
    summary:
      'The counts were right, but the chart had no dates under its bars and only showed numbers on a mouse hover. It now has a scale, a date under every other week, the current week drawn lighter ("so far"), and tapping a bar shows its exact dates, for example "Week of Sep 21 – 27: 5 sign-ups".',
    howItWorks: [
      'Admin Dashboard → Customers → New sign-ups. Weeks run Monday to Sunday (UTC); the last bar is this week so far, which is why it is usually low.',
      'Under the chart: the total for the 12 weeks and the busiest week. "Per day" opens the Visitors page, which shows sign-ups day by day.',
    ],
    links: [{ label: 'Customers tab', href: '/admin?tab=customers' }],
  },
  {
    id: 'customers-profit-ranking',
    date: '2026-11-11',
    kind: 'improved',
    area: 'Admin Dashboard',
    title: 'Customer profit: ranked by return, this month or last, with the strategy beside it',
    summary:
      '"Top customers by profit" listed dollars over the last 30 days. In a losing stretch every customer was red, so it read as a broken top list, and the biggest account always looked worst. It is now "Customer profit": every customer who traded in the month, split into "Made money" and "Lost money", ranked by percentage return, with the master account\'s result on top for comparison.',
    howItWorks: [
      'Admin Dashboard → Customers → Customer profit. Pick This month or Last month (calendar months).',
      'The percentage is the same "Period Return" the customer\'s Performance Analytics shows: each day\'s profit over the balance that day started with, added up. Example: a customer who lost $911 on a $17,000 account and then withdrew $7,000 shows about −5%, not −9% of what is left.',
      'The dollar figure under it is after exchange fees; hover it for before fees. Clicking a name opens that customer\'s Performance Analytics.',
    ],
    technical: [
      'GET /admin/insights/customers: top_pnl_30d replaced by profit {this_month, last_month} = {from, to, master, customers[{uni_id, name, pnl, pnl_gross, fees, pct, trades}]}, built per user from UserStatsService::dailyReturns over real-money accounts (demo, sandbox, SBXINV- excluded; disconnected accounts included). Pinned in AdminInsightsTest.',
    ],
    links: [{ label: 'Customers tab', href: '/admin?tab=customers' }],
  },
  {
    id: 'mark-paid-how-and-who',
    date: '2026-11-11',
    kind: 'improved',
    area: 'Billing',
    title: '"Mark paid" now says how the money came, and who marked it',
    summary:
      'An invoice marked paid by hand used to say only "Marked paid by an admin", so later nobody could tell how the customer actually paid. Now "Mark paid" asks how the money came (bank transfer, crypto to another wallet, cash or other) and for a short note, and saves the admin\'s name. Every admin action on a customer is now recorded too: approved, rejected, suspended, fee changes, deleted invoices, disconnected keys.',
    howItWorks: [
      'Click "Mark paid" on Invoice History or on an invoice\'s page. Pick how the money came and write a note, for example "Wise transfer, ref 4471". The button stays grey until both are filled in.',
      'The invoice page then shows "Bank transfer (marked paid by an admin)", who marked it and the note. The customer\'s "payment received" email names the way the money came, never the admin.',
      'Card and USDT payments still settle by themselves and never need this. A USDT payment matched by hand on Crypto Transfers also records who matched it.',
      'Admin actions are recorded from 11 Nov 2026 on. They show on each customer\'s new Timeline tab.',
    ],
    technical: [
      'PUT /admin/invoices/{id} {status: paid} requires method (bank_transfer | crypto_wallet | cash | other) and note (≥ 3 chars) unless sandbox: true. InvoiceService::settle(…, record: [paid_by, manual_method, payment_note]) writes them in the same transaction; new invoices columns paid_by / manual_method / payment_note.',
      'App\\Services\\Admin\\AdminAudit → admin_audit_logs (actor, subject, action, summary, details JSON), best-effort, written from AdminUserController (status / role / fees / create / delete), AdminController accept / reject, AdminInvoiceController (marked paid / fee changed / deleted), AdminApiKeyController (switched on/off, renamed, disconnected, purged) and Crypto Transfers attribution.',
    ],
    links: [{ label: 'Invoice History', href: '/admin/invoices' }],
  },
  {
    id: 'users-list-standing',
    date: '2026-11-11',
    kind: 'new',
    area: 'User Management',
    title: 'User Management shows who is trading, who owes us, and how they last paid',
    summary:
      'The customer list used to show only whether someone could sign in and their balance. Each row now says whether the bot is trading for them and, if not, why; how much they owe; their last payment and whether it was Stripe, crypto or by hand; and their profit this month. Filters find the customers who need something.',
    howItWorks: [
      'The Trading column reads Trading, Paused (unpaid invoice), Key blocked, Below minimum (deposit under $1,000), Waiting for balance, Switched off, Demo only or No exchange. Hover it for the full sentence.',
      'Owes shows the unpaid amount, in red with "Overdue" once it is past its due date. Last payment shows the amount, a Stripe / Crypto / By hand badge and the date. This month is the closed profit after exchange fees since the 1st.',
      'The "Needs action" chips filter the list: Owes money, Key problem, Not trading (connected, but the bot is not trading for them) and Never connected (approved, but no exchange yet).',
      'Opening a row shows each exchange account with a red "Key blocked" badge when the exchange refuses its key. On a phone, the trading status and the amount owed appear under the name.',
    ],
    technical: [
      'GET /admin/users adds trading {state, label, invoice_id, since}, key_problem, owes, last_payment, pnl_month per user (full admins only; collaborators get none) and key_status / key_blocked_at per account. One service, App\\Services\\Admin\\CustomerStatus, batched (a few queries for the whole list), mirroring the engine\'s own gates: enabled, not sandbox, owner not suspended, key not blocked, deposit ≥ ENGINE_MIN_DEPOSIT.',
    ],
    links: [{ label: 'User Management', href: '/admin/users' }],
  },
  {
    id: 'profile-standing',
    date: '2026-11-11',
    kind: 'improved',
    area: 'User Management',
    title: 'A customer\'s profile says why trading is off, shows key problems and the fee building up',
    summary:
      'A customer\'s profile now answers "is the bot trading for them, and if not why" at the top and on each exchange account, shows when the exchange refuses their key, and replaces the "Commission this month" tile, which always read $0.00, with the fee building up this month.',
    howItWorks: [
      'Under the name: the trading status (for example "Paused · invoice #31 unpaid" with a link to that invoice), the amount owed, who referred them, and their Telegram and Discord. "Last active" is renamed "Last sign-in", because that is what it records.',
      'Each exchange account card shows its trading status and, when the exchange refuses the key, a red box with the reason in plain words and a link to API Keys.',
      '"Fee this month so far" is what would be billed if the month ended now: for example $8.25 = 20% of this month\'s profit after fees above the high-water mark. Under it is the last invoice, for example "Last: $34.70 Oct · paid (Stripe)".',
      'A new "Last signals" card shows the bot\'s last signals on the customer\'s accounts: filled, or skipped and why (for example "Stack already full"), with a 7-day count and a link to the Signal Log.',
      'Every invoice table on the profile shows the Stripe / Crypto / By hand badge beside "Paid".',
    ],
    technical: [
      'Bug: commissions.this_month summed invoices whose month_year is the running month, which are only created once it ends, so it was always 0. Summary now adds commissions.month_estimate (InvoiceService::computeForAccount for the running month, like the Money tab forecast; customers only, live real-money Binance accounts), month_estimate_note and last_invoice.',
      'GET /admin/users/{uniId} adds standing, referred_by, contacts and per-account key_status / key_error_reason / key_blocked_at / trading. New GET /admin/users/{uniId}/signals (SignalHealth::classify over the last 600 trade_logs of the customer\'s venues). The profile tab now lives in ?tab=.',
    ],
    links: [{ label: 'User Management', href: '/admin/users' }],
  },
  {
    id: 'customer-timeline-notes',
    date: '2026-11-11',
    kind: 'new',
    area: 'User Management',
    title: 'Each customer has a Timeline of everything that happened, and admin notes',
    summary:
      'A customer\'s story used to be spread over five tabs. The new Timeline tab lists it in one place, newest first: signed up, approved, connected an exchange, first trade, every invoice issued, overdue and paid (and how), key problems, fee changes and every other admin action. Admins can add notes, such as "paid October by bank, ref 4471" or "promised to top up on Friday".',
    howItWorks: [
      'Open a customer → Timeline. Each line has a date, a category (Billing, Payment, Exchange, Admin, Note…) and who did it. Click an invoice line to open that invoice.',
      'Type a note at the top and click "Save note". Every admin sees it, with your name. Deleting a note asks first, and the deletion is recorded.',
      'Admin actions are recorded from 11 Nov 2026. Invoices, exchange accounts and trades go back to the start.',
    ],
    technical: [
      'GET /admin/users/{uniId}/timeline (App\\Services\\Admin\\CustomerTimeline: admin_audit_logs + {x}_accounts + first closed trade + invoices via PaymentMethod + user_notes), POST /admin/users/{uniId}/notes, DELETE /admin/users/{uniId}/notes/{id}. Full admins only (admin route group); hidden from collaborators.',
    ],
    links: [{ label: 'User Management', href: '/admin/users' }],
  },
  {
    id: 'invoice-page-paid-via',
    date: '2026-11-11',
    kind: 'improved',
    area: 'Billing',
    title: 'Each invoice opens on its own page and says how it was paid',
    summary:
      'Clicking an invoice in Invoice History used to open a pop-up. It now opens its own page, which also shows how the invoice was paid: by card through Stripe, or in crypto (USDT). A customer\'s October invoice ($24.04), for example, now reads "Paid on November 10, 2026 · Stripe".',
    howItWorks: [
      'Open Invoice History and click any invoice (or its View button). The page shows the customer, the amount, the status and, beside the paid date, a Stripe or Crypto badge.',
      'A "How it was paid" card gives the details: the method, when it was paid, the amount, and the payment\'s reference with a Copy button. For a crypto payment it also shows how much USDT actually arrived (it can be a few cents short when the customer\'s exchange takes a withdrawal fee) and a link to the transaction on TronScan. For a card payment, paste the reference into Stripe\'s search to find it there.',
      '"How this bill was worked out", the billing period, the high-water mark and the fee breakdown are all on the same page, with "Printable invoice" and "Mark paid" at the top.',
      'A customer\'s profile opens the same page from its Invoices tab and from a month\'s fee on Performance Analytics. "Back" returns to where you were: the same list filter, or the same profile tab.',
      'Each invoice has its own link (pixel-alpha.com/admin/invoices/15), so it can be sent to a colleague.',
    ],
    technical: [
      'Route /admin/invoices/:id → pages/admin/AdminInvoiceDetail.tsx; AdminInvoiceDetailModal removed (its sections are components/admin/invoices/AdminInvoiceFacts.tsx; payment is InvoicePaymentCard.tsx).',
      'GET /admin/invoices/{id} adds user_name, user_email and payment {provider, kind card|crypto|manual|unknown, label, test, reference, paid_amount, paid_at, network, explorer_url, received}. App\\Services\\Billing\\PaymentMethod is the one definition, shared with PaymentNotifier (emails + Telegram).',
      'Invoice History filters are in the URL (?status=&zero=&exchange=&q=&page=, useUrlFilters); admin user detail keeps its tab in ?tab=. Callers pass { backLabel } in router state; with none, Back goes to Invoice History.',
    ],
    links: [{ label: 'Invoice History', href: '/admin/invoices' }],
  },
  {
    id: 'payment-received-notices',
    date: '2026-11-11',
    kind: 'new',
    area: 'Billing',
    title: 'Everyone hears about it when an invoice is paid',
    summary:
      'When a customer pays an invoice, the customer gets a thank-you email, the team gets an "Invoice paid" email, and the admin Telegram group gets a message. A new "Payments received" card on the Admin Overview lists the last 7 days. Built after a customer paid their October invoice ($24.04) by card on 10 Nov: it was paid correctly, but nobody was told and there was no page that showed a card payment.',
    howItWorks: [
      'Any invoice with a fee counts, however it was paid: by card, by USDT, or marked paid by an admin. Each payment is told once, the moment it lands.',
      'The customer\'s email thanks them, shows the amount, method and invoice number, and says trading is back on if it had been paused for that invoice.',
      'The team email goes to support@, Dima and Christian. The Telegram message reads, for example: "💰 Invoice paid — Sam Carter · $24.04 for October 2026 · Card (Stripe) · Invoice #15 · Binance".',
      'Admin Overview → Needs attention has a "Payments received · last 7 days" card with the total and each payment. A payment in the last 24 hours also shows as a green line on the Platform view; click it to see the list.',
      'Nothing is sent for a $0 month (no money moved) or for test runs in Admin → Sandbox. A developer\'s test payment is labelled "Test payment (not real money)" in Telegram.',
    ],
    technical: [
      'App\\Services\\Billing\\PaymentNotifier, called once by InvoiceService::settle after the commit (only when that call settled). settle() gained `notify` (false = rehearsal) and computes wasPaused (status overdue/failed and the account was disabled). Skips feeCents() = 0 and SBXINV- rows. Best-effort: nothing can throw into a settlement.',
      'EmailCatalogue: payment-received and team-invoice-paid are now live. Telegram via EngineCache::paymentReceived → engine POST /admin/payment-received → notify.notify_payment_received (_send_private, admin chat only). Needs deploy-engine before the Telegram line appears; until then the API logs the refused ping.',
      'PUT /admin/invoices/{id} takes sandbox: true (Sandbox → Invoice Testing sends it). Overview attention.recent_payments (customers only, fee > 0, 7 days, hidden from collaborators); the overview cache is forgotten on every settlement.',
    ],
    links: [
      { label: 'Admin Overview', href: '/admin?view=attention' },
      { label: 'Preview the emails', href: '/admin/sandbox/emails/payment-received' },
    ],
  },
  {
    id: 'invoice-history-outstanding-first',
    date: '2026-11-11',
    kind: 'improved',
    area: 'Billing',
    title: 'Invoice History opens on unpaid invoices and hides $0 months',
    summary:
      'Invoice History now opens on Outstanding, the invoices still waiting to be paid. Months where a customer owed nothing are labelled "No fee" instead of "Paid" and are hidden unless you ask for them. Asked by Dima: the list was mostly $0 lines.',
    howItWorks: [
      'The page opens on Outstanding. When nothing is owed it says "Nothing to collect — every invoice is paid", with a button to see the paid ones.',
      'A $0 month (a losing month, or one still under the customer\'s high point) shows a grey "No fee" badge. A "Show $0 months (4)" button brings them back into the list.',
      'The "Paid Invoices" card counts only invoices that collected money (9 today instead of 13), with "+ 4 months with no fee" under it.',
      'The $0 months are hidden, never deleted: the next month\'s bill is worked out from them. Customers still see their own $0 months on their Billing page.',
    ],
    technical: [
      'GET /admin/invoices summary: count_paid / count_pending / outstanding_amount now cover fee > 0 rows only; new count_no_fee. lib/invoiceStatus.ts (invoiceState: noFee | paid | overdue | outstanding) is shared by the page and AdminInvoiceDetailModal.',
    ],
    links: [{ label: 'Invoice History', href: '/admin/invoices' }],
  },
  {
    id: 'crypto-transfers-real-money-only',
    date: '2026-11-11',
    kind: 'improved',
    area: 'Crypto Transfers',
    title: 'Crypto Transfers shows only real payments and explains itself',
    summary:
      'Crypto Transfers no longer shows test payments made with play money, except to developer accounts. The page now says what it is for, and it opens on "Needs attention" only when something real is waiting there. Two test payments from 18 August had been sitting in "Needs attention" and looked like customer money.',
    howItWorks: [
      'Only the real wallet (TRON) and its payments are shown. The test wallet (TRON Nile testnet) and its payments are visible to developer accounts only.',
      'A short explanation at the top: every USDT payment that reaches our wallet; a payment that matches an invoice pays it by itself; "Needs attention" is money that could not be matched, so give it to the right invoice or ignore it; card payments are in Invoice History.',
      'With nothing waiting, the page opens on All instead of an empty "Needs attention" list.',
      'The Admin Overview\'s "transfers need attention" count and the "claimed by two customers" warning count real payments only.',
    ],
    technical: [
      'AdminTronTransferController::visibleNetworks: developers get every configured network; everyone else gets PaymentEnvironment::tronNetworkFor(false), the network customers pay on here (mainnet on prod, Nile on a sandbox box). Rows, counts, disputes and wallet cards all follow it. AdminInsights unmatched_transfers / disputed_payments use the same network.',
    ],
    links: [{ label: 'Crypto Transfers', href: '/admin/tron-transfers' }],
  },
  {
    id: 'visitors-chart-scale',
    date: '2026-11-11',
    kind: 'improved',
    area: 'Visitors',
    title: 'The visitors chart has a scale and shows each day\'s numbers',
    summary:
      'The "Visitors per day" chart now has a scale on the left, and tapping or hovering a bar shows that day\'s visitors, page views and sign-ups under the chart, on phones too. It starts on the day visitor counting began (28 Oct), so there are no more sign-ups floating over empty days. Asked by Dima: the bars did not make sense without numbers.',
    howItWorks: [
      'The scale on the left, for example 0 / 10 / 20 / 30 / 40, with faint lines across the chart, so a short bar beside a tall one can be read at a glance.',
      'Tap or hover a bar: "Nov 5: 14 visitors · 22 page views · 1 sign-up". With nothing selected, the line names the busiest day.',
      'A period that reaches back before 28 Oct starts the chart on 28 Oct and says so. Sign-ups from before then still count in the totals at the top of the page.',
    ],
    technical: [
      'lib/visitorChart.ts: niceScale (steps of 1/2/5 × 10^n, at most four) and fromTrackingStart (drops buckets that end before summary.since). VisitorChart bars are buttons (hover / focus / tap).',
    ],
    links: [{ label: 'Visitors', href: '/admin/visitors' }],
  },
  // ── 2026-11-10 ───────────────────────────────────────────────────────────
  {
    id: 'after-fees-first-and-invoice-workings',
    date: '2026-11-10',
    kind: 'improved',
    area: 'User Management',
    title: 'Profit after fees comes first on a user\'s profile, and every bill shows how it was worked out',
    summary:
      'On a user\'s Performance Analytics, the profit AFTER exchange fees is now the main number everywhere, with the before-fees figure when you hover or tap it. Each month also shows the bill it led to, and every invoice explains step by step how it came to its amount. Asked after Dima saw +$190 for a customer\'s October and could not see how the bill was $24.04.',
    howItWorks: [
      'Open a user → Performance Analytics. The top card leads with "Profit after fees", for example +$120.18, with before fees (+$189.70) and exchange fees (−$69.52) beside it. Total Return, Avg Daily P&L, Best and Worst Day, the monthly and weekday bars and each coin\'s P&L all show after fees; hover any of them for the before-fees figure.',
      'The month-by-month table under the chart now ends with "Our fee": what that month was billed and whether it is paid, due or overdue, for example "October · +$120.18 after fees · $24.04 · Due Nov 11". Click the fee to open the invoice.',
      'Every invoice (from this table, the Invoices tab or Invoice History) starts with "How this bill was worked out": the high point the month started from; the account value when the bill was made, with that month\'s withdrawals added back (they are not losses); whether that is above the high point; the month\'s profit before fees, minus exchange fees, after fees; our 20% of it; and the new high point.',
      'Deposits & Withdrawals now lists every transfer with a "Show all" button, not only the last five. Small BNB transfers (a customer topping up BNB to pay Binance fees at a discount) show as BNB, for example "+0.0196 BNB", and are left out of the dollar totals. Before, they printed as "+$0.02" deposits.',
      'A new "Grown by Trading" tile shows what trading added: the balance now minus the money put in, for example $2,025.45 − $1,830.93 = +$194.52.',
      'The customer\'s own Performance Analytics still leads with before fees. It gets the transfer list fix and the "Grown by Trading" tile.',
    ],
    technical: [
      'invoices.realized_pnl_gross + exchange_fees (migration 2026_11_10_000010): written by InvoiceService::computeForAccount from BinancePnlSource\'s new realizedGross (SUM(realized_pnl + COALESCE(exchange_fee,0)) for the month); fees = gross − realized_pnl, so a row always reconciles. Backfilled the same way for existing invoices (gross survives fee rebases; fees derived against the row\'s own realized_pnl). Invoice::toApiArray also returns performance_equity. NULL = not recorded.',
      'InvoiceWorkings (components/billing) restates the row; invoices made before 2026-11-08 (performance_equity = the plain balance) are told the old way, without the "added back" lines. Rendered in AdminInvoiceDetailModal.',
      'AnalyticsView showAfterFees now flips AnalyticsKpis / ReturnFlipCard / MonthlyBreakdownCard / DayOfWeekCard / PositionDistributionCard to the *_net figures (after-fees % = net ÷ the API\'s own denominator; best/worst day picked on daily_pnl_net). UserAnalyticsTab feeds it the user\'s invoices (not for collaborators, whose invoice read is 403). The equity curve, win rate, drawdown and Sharpe cards stay before fees and say so.',
      'GET /analytics flows: every transfer (≤ 200) with currency + in_totals; deposits / withdrawals / net_flow count dollar currencies only (baseline unchanged, so no other figure moves).',
    ],
    links: [{ label: 'User Management', href: '/admin/users' }],
  },
  {
    id: 'user-profile-after-fees-invoices',
    date: '2026-11-10',
    kind: 'improved',
    area: 'User Management',
    title: 'A user\'s profit after exchange fees, and their invoices, on their profile',
    summary:
      'On a user\'s profile (User Management → open a user), Performance Analytics now prints the profit AFTER exchange fees on the page instead of only when you hover a number, and a new Invoices tab lists every invoice with the profit it billed on. Asked by Dima: filtering a user to October showed $190 before Binance fees, with no visible after-fees figure.',
    howItWorks: [
      'Performance Analytics → pick the dates (for example Oct 1 to Oct 31). A new "Profit after exchange fees" card at the top shows three figures for the closed trades in those dates, for example: before fees +$190.00, exchange fees −$40.00, after fees +$150.00.',
      'Avg Daily P&L, Best Day and Worst Day each carry an "After fees" line under the before-fees figure.',
      'Monthly Performance Breakdown lists every month with trades below the chart: trades, before fees, exchange fees, after fees.',
      'The new Invoices tab: what this user has been billed, paid and still owes, then each invoice with its month, exchange, the closed profit it billed on, our fee, status, due and paid dates. "View" opens the invoice details and the printable copy. Marking paid or deleting stays on Invoice History.',
      'Admins only. The customer\'s own Performance Analytics page is unchanged (before fees stays the main number, with after fees on hover), and collaborators do not see the Invoices tab.',
    ],
    technical: [
      'No API change: AnalyticsView takes showAfterFees (set only by AdminUserDetail) and reads total_realized / total_realized_net, best_day / worst_day / avg_daily_pnl *_net and monthly[].pnl_net, all already in GET /admin/users/{uniId}/analytics and scoped by its date and chip filters. Fees are derived as before − after, so each row reconciles.',
      'Invoices tab = UserInvoicesTab over GET /admin/users/{uniId}/invoices (follows the exchange pill), reusing AdminInvoiceDetailModal and InvoiceDocumentModal. Figures are the invoice snapshot, never recomputed.',
    ],
    links: [{ label: 'User Management', href: '/admin/users' }],
  },
  {
    id: 'creatives-agent-chat',
    date: '2026-11-10',
    kind: 'new',
    area: 'Creatives',
    title: 'Talk to the Creatives agent: Ask mode and Generate mode',
    summary:
      'Creatives is now mostly a chat. The marketing team talks to an AI agent that knows the brand, the mascot Pixel, the planner and this week\'s public results. In Ask mode it discusses, brainstorms and gives feedback without spending anything. In Generate mode it writes plans and makes pictures and marketing videos, but nothing paid starts until someone presses Go on a card that shows the total price. Plans, gallery, Pixel, the brand brief, memory and budget are panels you open only when you need them.',
    howItWorks: [
      'Ask mode, for example: "What should we post this week?" or "Is this hook strong enough?". It reads everything but cannot change plans or spend money.',
      'Generate mode, for example: "Make this week\'s recap video". The agent writes the plan and then shows one card: "1 picture of Pixel and a 10-second video, about $0.67. Go?". One click runs it; the picture and then the video appear in the chat with a Download button. A video takes a few minutes, and the card fills in by itself.',
      'The Brief panel is the team\'s brand document: who we talk to, tone of voice, do\'s and don\'ts, and ready-made video recipes (Weekly recap, Meet Pixel, How the bot works in 20 seconds). The agent follows it in every message. Edit it any time.',
      'The Memory panel holds short notes the agent keeps for the whole team, such as "TikTok captions work best under 150 characters". It saves one when you ask ("remember that…"). You can edit or delete any note.',
      'Only the current chat is kept. "New chat" starts fresh, and decisions stay safe in Memory, the Brief and the plans.',
      'Each chat message costs a few cents and counts against the same $100 monthly cap as everything else in Creatives. The marketing team (collaborators) can use both modes.',
    ],
    technical: [
      'Client-stepped tool-use loop: POST /admin/creatives/agent/turn makes at most one Claude call per request (Cloudflare\'s 100 s), and the client repeats while status is "continue" (cap 8 calls per user message). claude-opus-5-5 via the Anthropic PHP SDK; append-only history with assistant blocks stored exactly; an identical tool list in both modes, with Ask enforced server-side.',
      'Paid work only via propose_job → POST /agent/jobs/{id}/approve (budget checked, 60-min expiry). Steps run through CreativeGenerator, and a from_step source lets a Kling step animate an earlier step\'s image. Jobs advance in creatives:poll.',
      'Tables creative_agent_sessions/_messages/_jobs and creative_memories, plus brief_markdown on creative_settings (migration 2026_11_10_000004). Sessions older than 7 days are pruned daily. Every model call is recorded as an AI call of kind "agent". Tests: CreativesAgentTest.',
    ],
    links: [{ label: 'Creatives', href: '/admin/creatives' }],
  },
  {
    id: 'creatives-ai-writer',
    date: '2026-11-10',
    kind: 'new',
    area: 'Creatives',
    title: 'The AI writes the post for you',
    summary:
      'Type a short idea, such as "bot recap this week", and Claude (Anthropic\'s AI) writes the whole post: the title, the hook, a scene-by-scene script, the caption, the hashtags and the description the Studio uses to make the video with Pixel. It can also suggest ideas for the week, and every Saturday it drafts a weekly recap by itself. Everything it writes is a draft for the team to check.',
    howItWorks: [
      'Planner → New plan (or open a plan) → "Write it for me": type the idea, pick X or TikTok, and press Write. It takes up to half a minute. If the plan already has text, it asks before replacing it.',
      'For results posts it uses only the bot\'s public figures: the same percentages, trade counts and coins the Telegram recaps post, for example "+3.1% this week over 12 trades, LTC the best coin". It never sees or writes dollar amounts, balances or customer names. A post that quotes a result always gets the line "Past performance does not guarantee future results."',
      'If a draft quotes a number that is not in the week\'s figures, an amber note says so, so nobody posts a wrong figure by accident.',
      'Planner → "Suggest ideas" gives a handful of post ideas, each with a hook and why it could work. "Add to planner" saves one, and "Write it" drafts it in full.',
      '"Make the video" on a drafted plan opens the Studio with the plan and the video description already filled in.',
      'Every Saturday just after midnight (Manila time), right after the weekly Telegram recap, a "Weekly recap" plan appears in the Idea column, already written. Admins can switch this off on the Planner.',
      'Each draft costs a few cents (typically $0.03 to $0.10) and counts against the same monthly cap as the videos. The Budget tab shows how much went to AI writing.',
    ],
    technical: [
      'Anthropic PHP SDK, model claude-opus-5-5 at effort medium with structured JSON output; cost from usage at $4 / $20 per million input / output tokens, recorded in creative_ai_calls and added to CreativeBudget\'s month total. Refused before the call when less than $0.50 remains.',
      'FACTS come from the public track record computation (Asia/Manila days, the week\'s daily % chained like the Telegram weekly recap). Unknown-number warnings, the platform caption limit and the disclaimer are checked in PHP after the model answers.',
      'POST /admin/creatives/ai/draft, /ai/ideas (staff group); PUT /admin/creatives/ai/settings (admin group). creatives:weekly-recap runs Saturdays 00:15 Asia/Manila. Migration 2026_11_10_000003. ANTHROPIC_API_KEY is mirrored by sync-api-env. Tests: CreativesAiTest.',
    ],
    links: [{ label: 'Creatives', href: '/admin/creatives' }],
  },
  {
    id: 'creatives-page',
    date: '2026-11-10',
    kind: 'new',
    area: 'Creatives',
    title: 'Creatives: plan marketing posts and make videos with Higgsfield',
    summary:
      'A new Admin → Creatives page for the marketing team. They can plan posts for X and TikTok, and make images and short videos with Higgsfield using one fixed pixel-art mascot, "Pixel", so the character looks the same in every post. Spending has a monthly cap of $100 that any admin can change. Higgsfield keeps each video for 7 days; download it before then, because nothing is stored on our server.',
    howItWorks: [
      'Planner: every post idea is a card that moves from Idea → Script → Generating → Review → Approved → Posted, with its platform (X or TikTok), planned date, hook, script, caption and hashtags.',
      'Character: the mascot’s description and up to 8 reference pictures. Those pictures go along with every character image and video, which is what keeps Pixel looking the same. Start by making a few candidates with "Image from text", then keep the best ones with "Use as character reference".',
      'Studio: pick a model, type what should happen, and press "Check price" first. Generate asks for confirmation and shows the cost. Rough prices: a picture costs under 10 cents, a 5-second video made from a picture about $0.30 (10 seconds about $0.60), and a 10-second character video with Seedance about $4.60 at 720p.',
      'Each result shows how long Higgsfield will keep it ("Deleted by Higgsfield in 6 d 4 h") and has a Download button. After 7 days it is gone.',
      'Budget: this month’s spend against the cap, broken down per person. A generation that would go over the cap is refused before any money is spent. Any admin can change the cap; setting it to $0 turns generating off. Failed or blocked generations cost nothing.',
      'The marketing team (collaborators) can use everything on this page except changing the cap. Everywhere else they are still read-only.',
    ],
    technical: [
      'API: /admin/creatives* in its own `staff` route group, the only admin area where a collaborator may write. PUT /admin/creatives/budget is in the `admin` group. Tables creative_settings / _characters / _character_refs / _plans / _generations (migration 2026_11_10_000002).',
      'App\\Services\\Creatives: HiggsfieldGateway (Authorization: Key id:secret; estimate / submit / status / cancel / file upload), CreativeModels (4 presets: Soul v2 image, Grok Image 2.0 with references, Kling 2.5 Turbo Pro image-to-video, Seedance 2.5 reference-to-video), CreativeBudget (UTC month; the estimate is reserved under lockForUpdate and refunded to 0 when a generation fails, is blocked or is canceled).',
      'Videos are never stored: outputs are Higgsfield URLs until expires_at (7 days). Download streams through a signed route without writing to disk. Only the reference images are stored on the API\'s private disk and re-uploaded to Higgsfield per generation. creatives:poll runs every minute.',
      'Keys HIGGSFIELD_KEY_ID / HIGGSFIELD_KEY_SECRET are mirrored by sync-api-env. Tests: CreativesTest.',
    ],
    links: [{ label: 'Creatives', href: '/admin/creatives' }],
  },
  {
    id: 'asset-leverage-per-coin',
    date: '2026-11-10',
    kind: 'new',
    area: 'Trading assets',
    title: 'Set the leverage for each coin',
    summary:
      'Each coin now has its own Leverage setting. When it is set, every entry on that coin uses it, whatever leverage the TradingView alert asks for. Left empty, nothing changes: the alert’s leverage is used (25× today). It exists because Binance stopped allowing 25× on SANTOS on 9 November, and all three SANTOS sell signals that night were refused on every account — even an order worth only $98.',
    howItWorks: [
      'Admin → Trading Assets → Edit a coin → Sizing → Leverage. Type a whole number from 1 to 125 (for example 10), or leave it empty to follow the alert.',
      'It applies from the next signal and does not wait for an open position to close. The coin’s card shows "10× leverage on every entry", and the change is listed in Change history.',
      'Each exchange’s coin has its own setting: SANTOS on Binance can use 10× while SANTOS on MEXC follows the alert.',
      'The Binance check on the edit page now works out the margin with the coin’s own leverage when it has one.',
      'When an exchange refuses the leverage and the entry then fails, the admin alert now says so — "25x leverage refused (Leverage 25 is not valid)" — and points to this setting, instead of only "Exceeded the maximum allowable position", which read like the size was too big.',
    ],
    technical: [
      'assets.leverage (unsigned tinyint, nullable; migration 2026_11_10_000001). AssetController validates `sometimes|nullable|integer|between:1,125` — absent = unchanged (the card switch sends none), \'\' = not set. Recorded by AssetHistory. Sent to the engine on GET /engine/{exchange}/assets.',
      'Engine: webhook._effective_leverage = asset.leverage → the signal\'s leverage → BINANCE_ABCD_DEFAULT_LEVERAGE (25; 0 = leave the account\'s setting alone). Each entry detail carries `leverage`; the venue\'s trade_logs row records it. A refused set_leverage is no longer swallowed: a failed entry\'s error names it (`leverage_refused`) and notify adds a fix line.',
      'Tests: AssetLeverageTest (API), tests/test_asset_leverage.py (engine).',
    ],
    links: [{ label: 'Trading Assets', href: '/admin/assets' }],
  },
  {
    id: 'ai-access-never-expiring-keys',
    date: '2026-11-10',
    kind: 'improved',
    area: 'AI Access',
    title: 'AI keys that never expire',
    summary:
      'A key for Grok can now be made to last for ever, so it never has to be replaced and re-pasted into Grok. It still stops working the moment it is revoked.',
    howItWorks: [
      'On Admin → AI Access, pick "Never (until revoked)" under "Expires after" before pressing Create key. The confirmation says plainly that this key keeps working until someone revokes it.',
      'In the list of keys it reads "Expires: Never · until revoked". The Revoke button works exactly as for any other key: the connector using it stops at once.',
      '30, 90, 180 and 365 days are still offered, and 90 days stays the default.',
    ],
    technical: [
      'POST /admin/ai-access/keys takes `never_expires: true` (an absent lifetime still means the 90-day default, never "for ever"); the key is stored with expires_at NULL, which the gate already treated as never expiring. AiAccessTest covers it, including a 5-year time jump and a revoke afterwards.',
    ],
    links: [{ label: 'AI Access', href: '/admin/ai-access' }],
  },
  // ── 2026-11-09 ───────────────────────────────────────────────────────────
  {
    id: 'ai-access-grok-connector',
    date: '2026-11-09',
    kind: 'new',
    area: 'AI Access',
    title: 'Ask Grok about trades, assets and billing',
    summary:
      'An AI assistant can now answer questions about the platform. In the Grok app, add Pixel Alpha as a custom connector with a key made on Admin → AI Access, then ask in plain words: "How many LTC signals came in this month?", "Which assets are up over the last 30 days?", "Who hasn’t paid, and who is overdue?". Grok reads the same figures the admin pages show, with customer names, and can never change anything.',
    howItWorks: [
      'Admin → AI Access shows the four fields to fill in Grok’s "Add a custom connector" form, with a copy button for each.',
      'Create a key there (it expires after 30, 90, 180 or 365 days). It is shown once: copy it into the connector’s HTTP header. Lost keys are revoked and replaced, never shown again.',
      'Grok can read: every signal and what each account did with it, signal counts per coin or day, problems, open positions, closed trades and P&L (per day, coin, person or exchange), which coins are up or down for the master and for customers, coin settings and who changed them, every exchange account’s balance and deposits, users, invoices (paid, unpaid, overdue) and the dashboard totals.',
      'It never sees exchange API keys or secrets, passwords, email addresses or IP addresses, and it has no way to trade, close a position or edit anything.',
      'Every look-up Grok makes is listed on the same page under "What it asked", with the filters it used. Revoking a key stops the connector at once.',
      'The page also has tips for asking (start with "Using Pixel Alpha", name the period, the coin or the person) and what to do when Grok says the key is not valid, the limit was reached, or it cannot connect.',
      'What Grok reads is sent to its maker (xAI). Customer names, balances and P&L are included by the owner’s decision.',
    ],
    technical: [
      'POST /api/mcp — a hand-rolled, stateless Model Context Protocol server (Streamable HTTP, tools only, JSON answers): initialize, ping, tools/list, tools/call. App\\Services\\Ai\\McpServer + AiTools; 15 read-only tools in App\\Services\\Ai\\Tools (Signal, Trade, Asset, People, Money, Guide).',
      'Auth: VerifyAiAccessKey (`ai.key`), key `pxa_…` in X-Api-Key (or Bearer); a key in the query string is refused. ai_access_keys stores the SHA-256 only; expiry, revoke, last used + IP. Limits: throttle:ai-guard 120/min per IP before the key check; 60/min + 3,000/day per key inside VerifyAiAccessKey.',
      'Search, single signal, health, open positions, assets, change history and invoices reuse the admin controllers / services, so the figures match the admin pages. AiRedactor drops credential and contact fields by name at any depth as a second wall; a test runs every tool and asserts no api_key, secret, email or password hash comes back.',
      'ai_access_logs: one row per call (method, tool, arguments, status, duration, IP). Admin: GET /admin/ai-access, GET /admin/ai-access/log, POST /admin/ai-access/keys, DELETE /admin/ai-access/keys/{id} — full admins only.',
    ],
    links: [{ label: 'AI Access', href: '/admin/ai-access' }],
  },
  // ── 2026-11-08 ───────────────────────────────────────────────────────────
  {
    id: 'vps-cpu-alert-averaged',
    date: '2026-11-09',
    kind: 'fixed',
    area: 'Server monitoring',
    title: 'Server CPU alerts only fire when the server is actually busy',
    summary:
      'The admin group sometimes got "CPU 96% — over the 95% threshold" from a server that averages 2–3% all day. Every minute, the background jobs of Pixel Alpha and Pixel Pay started together and kept the server busy for about two seconds; the alert measured a single second, and now and then that second landed on this burst (8 Nov, 6:40 PM). The alert now measures the average over the two minutes since its last check, and the two products’ jobs start half a minute apart.',
    howItWorks: [
      'The CPU figure in alerts and in the 4-hourly report is now the average since the previous check (normally 2 minutes), and the message says so: "CPU 97% (avg over 2 min)".',
      'A busy spell that lasts minutes still triggers the alert; a two-second burst no longer can.',
      'Pixel Pay’s every-minute jobs now start 30 seconds into the minute, so they no longer pile up with Pixel Alpha’s at the start of each minute. Nothing they do changes, only when in the minute they start.',
    ],
    technical: [
      'pixel-telegram: metrics.cpu_average() — psutil.cpu_times() stored in state.json (`cpu`) by each watch run, busy % = Δ(total − idle − iowait) / Δtotal (psutil’s own arithmetic, steal counts as busy). Window must be 30 s – 15 min, else a 5 s sample (first run, stopped timer, a report seconds after a watch). The report reads the snapshot and never writes it.',
      '/etc/cron.d/pixelpay: `sleep 30 &&` before schedule:run (deploy_pixelpay.py PAY_CRON_OFFSET_SECONDS; new `cron` command writes it alone). Laravel decides what is due from the clock, and :30 is the same minute.',
      'Measured on 9 Nov: both cores ~98% busy at hh:mm:02 (a third of it host steal), 2–3% average all day, load 0.00.',
    ],
  },
  {
    id: 'signal-rejected-says-why',
    date: '2026-11-09',
    kind: 'improved',
    area: 'Signal Log',
    title: 'Rejected signals now say whether the coin is turned off or was never added',
    summary:
      'When a buy or sell signal arrives for a coin the bot cannot trade, the admin Telegram group gets a "Signal rejected" message. It used to say "asset_not_configured" in every case, whether an admin had switched the coin off or nobody had ever added it, so you could not tell which one to fix. Example: with Litecoin switched off, the message now reads "LTCUSDT is turned off on Binance. Turn it back on in Admin → Trading Assets to trade it."',
    howItWorks: [
      'Coin switched off by an admin: the message says it is turned off and where to turn it back on.',
      'Coin switched off by the kill switch: the message says so and gives the reason, e.g. "the master lost 3 trades in a row".',
      'Coin never added for that exchange: the message says it is not added yet and to add it with a base size.',
      'A switched-off coin is announced once a day per exchange: the first refused signal of the day (Philippine time) sends the message, and later ones that day, buy or sell, main or test feed, are refused without another message. The message says so. Every other cause still sends a message each time, because someone has to fix it.',
      'Other refusals get their own sentence too: no base size set, coin set to long-only or short-only, no account on that exchange to receive it, or the coin list could not be loaded.',
      'In the Signal Log, a signal refused because the coin is switched off now counts as normal (the switch did its job), so it no longer turns the health banner amber. A coin that was never added still shows as a problem, labelled "Coin not added yet".',
      'Exits are unchanged: an open position always closes, whether its coin is on or off.',
    ],
    technical: [
      'GET /engine/{x}/assets adds `disabled: [{ticker, killed, killed_reason}]`; `assets` is still enabled-only. assets_api.rejection() returns asset_disabled | asset_not_added | assets_unavailable (list never loaded) | asset_not_configured (API too old to send `disabled`).',
      'notify.reject_hint() writes the sentence; notify_rejected / notify_test_feed_rejected take `hints`. The reason code stays on the message’s Reason line.',
      'Once a day: binance_abcd/daily_alerts.py, keys `asset_disabled|{exchange}|{symbol}`, REPORT_TIMEZONE days, state in out/daily_alerts.json (survives a restart). Only when every venue’s reason is asset_disabled; the trade_logs row is posted either way.',
      'SignalHealth: asset_disabled → asset_off (normal), asset_not_added → asset_missing (problem), assets_unavailable (problem). Older asset_not_configured rows stay the generic "Signal rejected", since they could have meant either.',
    ],
    links: [{ label: 'Trading Assets', href: '/admin/assets' }, { label: 'Signal Log', href: '/admin/trade-logs' }],
  },
  {
    id: 'usdt-payment-watcher-restored',
    date: '2026-11-08',
    kind: 'fixed',
    area: 'Billing',
    title: 'Crypto payments: USDT payments are confirmed automatically again',
    summary:
      'From 7 October the job that spots incoming USDT (TRC-20) payments and marks invoices paid had stopped working: a library update on 7 October rejected one of its settings, so it failed every minute without anyone seeing it. No customer was affected, because October’s invoices were all $0 and nobody had to pay. It works again, so a customer who pays an invoice in USDT is marked paid within minutes, as before.',
    howItWorks: [
      'Nothing changes for the customer: they send USDT to the address on their invoice and it is matched by the amount.',
      'When it restarted, the job first caught up on the transfers it had missed since 2 October, so anything paid in that gap is picked up.',
      'Admin → Crypto Transfers shows when each network was last scanned; it should now say a minute or two ago.',
    ],
    technical: [
      'Guzzle 8.2 (installed with the 2026-10-07 dependency sweep) throws InvalidArgumentException on a raw CURLOPT_IPRESOLVE inside the "curl" request option. TronGateway and CoinsbuyGateway now pin IPv4 with Guzzle’s own force_ip_resolve => v4. payments:watch-tron had failed with exit 1 every minute since 2026-10-07 08:44 UTC (45,632 log errors).',
      'Http::fake() never reaches Guzzle’s option check, which is why every gateway test kept passing. PaymentHttpOptionsTest now pins the option on the real PendingRequest of both gateways.',
    ],
    links: [{ label: 'Crypto Transfers', href: '/admin/tron-transfers' }],
  },
  {
    id: 'billing-transfers-not-profit',
    date: '2026-11-08',
    kind: 'fixed',
    area: 'Billing',
    title: 'Billing: money a customer adds or takes out no longer counts as profit or loss',
    summary:
      'We only charge while a customer’s account is above its previous high point (the high-water mark). That check used to look at the plain balance, so a withdrawal looked like a trading loss and a deposit looked like a gain. Example from October: a customer closed +$120.18 in trades and withdrew $254.99, ended below his September high point, and was billed $0. Now the withdrawal is put back before the check: he was above his high point, so the bill is 20% of $120.18 = $24.04. That October invoice has been re-issued.',
    howItWorks: [
      'Before deciding whether to charge, the monthly bill adds back everything the customer withdrew that month and takes away everything they deposited. Only what trading did is compared with the high point.',
      'The high point then moves with the money. Withdraw $2,000 and it drops by $2,000; deposit $5,000 and it rises by $5,000. Next month is measured against what is actually in the account, so nobody has to “earn back” cash they took out, and a top-up never pays for profit that was not made.',
      'Money moved on the morning of the 1st, before the bill runs, belongs to the new month and is set aside the same way.',
      'The fee itself is unchanged: 20% of the month’s closed profit (6% of open profit), whenever the account is above its high point.',
      'The invoice page, the printable invoice and the admin invoice view now say how much was added or taken out that month, so a high point that went down is explained.',
      'October’s invoices were re-checked with the new rule. Only one amount changed (the $24.04 above); the other customers lost money in October, so their $0 stands. Lloyd’s high point was lowered by the $5,910 he took out, so December’s bill measures him fairly.',
    ],
    technical: [
      'InvoiceService::applyHighWaterMark (pure) is the one definition: performance_equity = equity_now − flow_in_month − flow_after_month_end; chargeable when > hwm_before; hwm_after = max(hwm_before, performance_equity) + flow_in_month. First invoice: hwm_before = initial_deposit + flows before the month.',
      'BinancePnlSource adds flowBefore / flowAfter. Readers of the current mark use Invoice::latestHwmByAccount (latest month per exchange:account) instead of MAX(hwm_after), which is wrong once a mark can fall: UserStatsService summary, AdminUserController (accounts[].hwm, summary.hwm). AdminInsights forecast status uses performance_equity.',
      'toApiArray adds capital_flow; lib/billing capitalFlowNote. Three new hand-derived Invoice Scenarios (withdrawal_profit_month, withdrawal_loss_month, deposit_hides_loss); InvoiceScenariosTest runs the whole catalogue in CI; InvoiceCapitalFlowTest. Issued invoices are not regenerated; October 2026 rows were corrected once from their stored figures.',
    ],
    links: [
      { label: 'Invoice History', href: '/admin/invoices' },
      { label: 'Invoice Scenarios', href: '/admin/sandbox' },
    ],
  },
  // ── 2026-11-07 ───────────────────────────────────────────────────────────
  {
    id: 'assets-editor-page',
    date: '2026-11-07',
    kind: 'improved',
    area: 'Trading Assets',
    title: 'Trading Assets: adding or editing a coin now has its own page, with a live preview',
    summary:
      'The “Create / Edit asset” pop-up had grown too long to use comfortably (sizes, the Binance check, streak sizing, the kill switch). It is now a page of its own: the form on the left and, beside it, a preview of the coin’s card that changes as you type, plus the Binance check. The list of coins got a tidier filter bar and clearer cards. Example: typing a base size of 0.5 with “3×” picked shows straight away “1.5 LTC · up to 3 entries per position” and the card preview with three dots.',
    howItWorks: [
      'On Admin → Trading Assets, press New coin (or “Add Binance coin” on an exchange’s section, which opens the page with that exchange picked). Press Edit on a card, or click the coin’s name, to change it.',
      'The page is in four parts: Coin (ticker, image, exchange, trade direction), Sizing (base size and max position), Trading (on or off) and Streak sizing & kill switch (folded away until you need it).',
      'On a computer, the preview card and the Binance check stay in view on the right while you scroll the form. On a phone, they appear right after Sizing.',
      'The bar at the bottom says whether there is anything to save. If something is wrong (an empty ticker, a max position smaller than one entry), it says what and takes you to it. Saving still asks for confirmation, and you return to the list with a “saved” note.',
      'Leaving the page with unsaved changes asks first.',
      'On the list: filter by status (Trading, Off, Needs attention = stopped by the kill switch or a size change waiting for a close), by type, or search by ticker. The filters stay in the address, so a link keeps them. Each card shows how many entries fit as dots (or the number, for long stacks) and has a labelled Edit button.',
    ],
    technical: [
      'Routes /admin/assets/new[?broker=] and /admin/assets/:assetId/edit → pages/admin/AdminAssetEditor (loads GET /admin/assets, picks the row). Saves through the existing createAsset / updateAsset (unchanged API).',
      'components/admin/assets/editor/* (AssetEditor, Identity/Sizing/Trading/StreakSection, AssetPreview, EditorActionBar, ChoiceGroup); state in hooks/useAssetDraft + hooks/useAssetImage, pure rules in lib/assetDraft (draftFrom opens on intendedSizing, so a waiting size change is kept). Replaces AssetFormModal.',
      'List filters moved to the shared filter kit (useUrlFilters: q, status, type); lib/assetFilters. Designed with the ui-ux-pro-max guidance (44px targets, inline validation, sticky save bar, visible focus).',
    ],
    links: [
      { label: 'Trading Assets', href: '/admin/assets' },
      { label: 'New coin', href: '/admin/assets/new' },
    ],
  },
  // ── 2026-11-07 ───────────────────────────────────────────────────────────
  {
    id: 'binance-sizing-check',
    date: '2026-11-07',
    kind: 'new',
    area: 'Trading assets',
    title: 'Pick the max position as 1×, 2× or 3×, and check a coin’s size against Binance before saving',
    summary:
      'When you add or edit a Binance coin, the max position is now a choice of 1×, 2× or 3× the base size, so nobody has to multiply by hand. A new Binance check shows, in dollars, the smallest order Binance accepts for the coin, what one entry and the full position are worth, and how much of the smallest trading account’s balance the full position ties up. If that is too much, it suggests a smaller base size you can use with one click. Example: LTC at $52.49 with a base size of 14 and 3× is a full position of 42 LTC ≈ $2,205. At 25× leverage that needs about $88 of margin, 19% of a 470 USDT account, so it fits. On a 300 USDT account it would be 29%, and the check suggests a base size of 11 instead.',
    howItWorks: [
      'Admin → Trading Assets → Add coin (or Edit) on a Binance coin: choose 1×, 2× or 3× under Max position. Custom still lets you type the amount. A coin whose max is not exactly 1×, 2× or 3× its base size opens on Custom, unchanged.',
      'The Binance check fills in once the ticker is typed. Binance minimum order: the smallest order Binance takes for this coin, in coins and dollars. Base size: one entry, and how many times the minimum it is. It is flagged when it is under the minimum, or close to it.',
      'Full position: all the entries the max allows, on the smallest account, with the margin it needs at the leverage the signals use.',
      'Smallest trading account: the smallest account the bot would actually trade, so one that has deposited at least 1,000 USDT and has a working key. It is green up to 25% of its balance, amber above 25%, and red when the full position needs more than its whole balance.',
      'Amber or red comes with a suggested base size and a “Use” button that puts it in the form. Nothing is saved until you press Save.',
      'Prices move, so the check is a snapshot. Press the refresh arrow to check again. MEXC and Bybit coins keep the old fields.',
    ],
    technical: [
      'GET /api/admin/assets/binance-check?ticker= (admin, throttle 30/min) → App\\Services\\Assets\\BinanceSizingCheck: /fapi/v1/exchangeInfo cut to step size, min quantity (the stricter of LOT_SIZE / MARKET_LOT_SIZE) and MIN_NOTIONAL, cached 1 h with a 7-day last-good copy; /fapi/v1/premiumIndex mark price, cached 30 s.',
      'Smallest account: EngineController::accounts’ filter, minus blocked keys, with initial_deposit + net transfers >= services.engine.min_deposit and balance > 0. Live first, demo only when no live account qualifies (demo_only).',
      'Leverage: the latest non-null trade_logs.leverage for exchange=binance, main feed, this ticker; else main feed, any ticker; else any feed. If there is none, the client assumes 25×.',
      'Client: lib/binanceSizingCheck.ts (entries = entriesFor, entry = scalePreview, floors to the step size; the suggestion is 25% × min(balance, 1000) × leverage ÷ (entries × price), floored to 2 significant figures and the step size). UI: components/admin/assets/BinanceSizingCheck.tsx + hooks/useBinanceSizingCheck.ts.',
      'Tests: tests/Feature/AssetBinanceCheckTest.php.',
    ],
    links: [{ label: 'Trading Assets', href: '/admin/assets' }],
  },
  // ── 2026-11-06 ───────────────────────────────────────────────────────────
  {
    id: 'mexc-open-to-customers',
    date: '2026-11-06',
    kind: 'new',
    area: 'Exchange Accounts',
    title: 'Customers can now connect MEXC',
    summary:
      'MEXC was open to staff accounts only. Every customer can now connect a MEXC account, the same way as Binance. Bybit stays staff-only for now. Example: a customer who cannot use Binance in their country can connect MEXC and trade the coins switched on there (LTC and RENDER today).',
    howItWorks: [
      'Exchange Accounts → Connect exchange now offers MEXC to everyone, with the same steps as Binance: pick live or demo, paste the two keys, review, confirm.',
      'MEXC trades only the coins switched on for MEXC under Admin → Trading Assets. Today that is LTC and RENDER.',
      'Bybit still shows “Coming soon” to customers. Staff and testers can still connect it.',
      'The website now says Binance and MEXC are live in the home page, How it works, the FAQ and the Trading Bot page.',
      'Not yet: MEXC customers do not receive a monthly invoice, because billing only covers Binance so far. See Admin → To be Done.',
    ],
    technical: [
      'Server: EXCHANGES_STAFF_ONLY=bybit in api/.env + config:cache (was unset = code default mexc,bybit). Backup of the previous file: _backups/api.env.before-open-mexc.20261106.',
      'Client twin: EXCHANGE_META.mexc.staffOnly false. ExchangesV2 now marks a venue Live only when available AND not staffOnly (it had shown Bybit as Live).',
      'InvoiceService / monthly_invoices.INVOICED_EXCHANGES are still Binance-only; owner decision mexc-customer-billing.',
    ],
    links: [
      { label: 'Exchange Accounts', href: '/dashboard/exchanges' },
      { label: 'To be Done', href: '/admin/todo' },
    ],
  },
  {
    id: 'dashboard-exchange-filter-fix',
    date: '2026-11-06',
    kind: 'fixed',
    area: 'Trading Dashboard',
    title: 'Picking Binance, Bybit or MEXC now changes every figure on the dashboard',
    summary:
      'The exchange buttons at the top of the trader pages lit up when clicked, but the figures underneath stayed on all exchanges combined. Now every number follows the button. Example: a customer trading on Binance and MEXC who picks MEXC now sees only their MEXC balance, profit, trades, calendar and fees.',
    howItWorks: [
      'Open the Trading Dashboard and pick All, Binance, Bybit or MEXC at the top right.',
      'Everything on the page changes to that exchange: the balance and equity chart, the statistics row (win rate, profit factor, drawdown and so on), profit by asset and by strategy, the high-water mark, this month’s fees, the daily P&L calendar, the today / 7 days / month figures and the asset cards at the bottom.',
      'The choice is remembered, so Positions and Asset Performance open on the same exchange. They had the same problem and are fixed too.',
      'If the customer has no account on the exchange they pick, the page says so instead of showing $0.00.',
    ],
    technical: [
      'Cause: ExchangeFilterProvider was mounted inside DashboardLayout, but the PAGES (Dashboard, Positions, AssetPerformance) call useExchangeFilter() and render DashboardLayout themselves — so they read the context default (\'all\') while the TopBar pills wrote to a provider below them. Broken since the pills became the data scope (2026-09-17).',
      'Fix: the provider moved to App.tsx, above the routes; DashboardLayout no longer mounts one. The API side (?exchange= on /dashboard/*, /binance/*) was already correct.',
    ],
    links: [{ label: 'Trading Dashboard', href: '/dashboard' }],
  },
  {
    id: 'dashboard-asset-carousel',
    date: '2026-11-06',
    kind: 'improved',
    area: 'Trading Dashboard',
    title: 'Dashboard: the asset buttons under the profit chart slide in one row',
    summary:
      'The coloured asset buttons under “Equity by Asset” used to wrap onto several lines. They now sit in one row that slides along by itself, with arrows on both sides. Example: with 10 coins, the row shows as many as fit and moves one coin along every 3 seconds.',
    howItWorks: [
      'The row moves one asset along every 3 seconds and goes back to the start after the last one.',
      'Use the arrows on either side, or swipe on a phone, to move it yourself. After that it waits 8 seconds before moving again.',
      'It stops moving while the mouse is over it, so a button never slides away just as someone clicks it. Clicking a button still shows or hides that asset’s line on the chart, as before.',
      'When all the assets fit on one line there are no arrows and nothing moves. It also stays still for anyone whose device is set to reduce motion.',
      'The same applies to the strategy buttons when the chart is switched to By Strategy.',
    ],
    technical: [
      'components/ui/AutoCarousel.tsx (reusable): overflow-x row with snap, prev/next wrap around, setInterval step paused on mouse hover / focus-within / document.hidden / 8 s after user input; off under prefers-reduced-motion and when nothing overflows. Items are not duplicated (they are toggle buttons).',
      'Used by EquityByGroupCard for its asset / strategy legend.',
    ],
    links: [{ label: 'Trading Dashboard', href: '/dashboard' }],
  },
  // ── 2026-10-28 ───────────────────────────────────────────────────────────
  {
    id: 'visitor-counter',
    date: '2026-10-28',
    kind: 'new',
    area: 'Visitors',
    title: 'Visitors: who opens the website, where from, and how many sign up',
    summary:
      'A new Visitors page in the admin portal counts the people who open the public website (home page, guides, sign-in, legal pages), where they came from, their country and device, and how many of them go on to create an account. Bots, spam, refreshes and our own team are filtered out before anything is counted. Example: 120 visitors in a week, 40 of them from Google and 25 from Telegram, and 6 sign-ups, a 5% sign-up rate.',
    howItWorks: [
      'Open Admin → Visitors. It shows the last 30 days; pick another period at the top. Every admin role can open it, collaborators included.',
      'The top cards show visitors, page views, sign-ups, the sign-up rate and how many people are on the site right now. A visitor is one person per day: someone who comes back on another day counts again.',
      'The chart shows visitors per day, with each day’s sign-ups in green above the bar. Below it: the path from visit to trading (visited → opened sign-in → created an account → confirmed email → approved → connected an exchange), the sites that sent people, invite and campaign links, what new sign-ups ticked under “Where did you hear about us?”, the top pages, countries and devices.',
      'A page only counts once it has been on screen for 2 seconds. Search engines, scanners, link previews and automated browsers are thrown away. The same person refreshing a page counts once per 30 minutes. Anyone signed in with a staff account is not counted.',
      'An IP address that sends more than 30 visits a minute (or 300 a day), or opens 6 pages within 15 seconds, is marked suspicious for the rest of the day. Its visits are kept so you can look at them (Visitor log → Suspicious) but are left out of every number.',
      'The “Not counted” line shows how many visits each rule kept out in the period, so you can see the filter working.',
      'The visitor log lists every page view with its IP address. Click an address to see all its visits and any account that signed up or signed in from it.',
      'Full IP addresses are kept for 90 days, then deleted automatically. The counts stay. The privacy banner and the Privacy Policy now say that website visits are recorded, and the banner asks every visitor once more.',
      'Counting starts on Oct 28, 2026. There are no numbers for earlier days.',
    ],
    technical: [
      'Ping: components/visits/VisitTracker (2 s visible dwell) → POST /api/public/visits (always 204, throttle:visits 120/min backstop).',
      'Rules: App\\Services\\Visits\\VisitRecorder — bot / foreign origin / unknown page (VisitPages, twin of lib/visitPages.ts) / staff token / flood 30 per min or 300 per day / repeat 30 min; burst = 6 rows in 15 s. Refused pings are only tallied (site_visit_filtered); suspicious rows are kept with suspicious = 1.',
      'Visitor = HMAC(UTC day + IP + User-Agent, app key) — daily unique, no cookie. Tables site_visits + site_visit_filtered; visits:purge-ips daily 01:10 nulls ip and user_agent after 90 days.',
      'Reads: GET /admin/visitors/summary and /admin/visitors/log (staff group, App\\Services\\Visits\\VisitorStats). Accounts per IP come from user_access_events.',
      'Consent banner CONSENT_VERSION 1 → 2; Privacy Policy sections 2.3, 3, 7 and 9 updated.',
    ],
    links: [
      { label: 'Open Visitors', href: '/admin/visitors' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
  {
    id: 'exchange-accounts-card-redesign',
    date: '2026-10-28',
    kind: 'improved',
    area: 'Exchange Accounts',
    title: 'Exchange Accounts: real exchange logos and a clearer card',
    summary:
      'Each connected account now shows its exchange’s real logo (Binance, Bybit or MEXC) instead of a letter, and the card is easier to read: the balance is bigger, live or demo is spelled out under the name, and an account with nothing in it says where the money needs to go. Example: an empty MEXC account now reads “Nothing in your MEXC Futures account yet. The bot only trades the money in it.”',
    howItWorks: [
      'Open Exchange Accounts. Each card shows the exchange logo, the account name, and “Live trading” or “Demo trading” under it, then two tags: Active or Disabled, and Live or Demo.',
      'The balance is shown large with its currency beside it. If the account holds an open trade, its current profit or loss is shown under the balance.',
      'When the balance is 0, a short note names the wallet the bot trades from on that exchange: the USDⓈ-M Futures wallet on Binance, the Unified Trading account on Bybit, the Futures account on MEXC.',
      'The API key and the secret sit together in one box. The key can be shown or copied. The secret is never shown again after connecting.',
      'The exchange buttons in the top bar (All, Binance, Bybit, MEXC) are hidden on this page, since it already lists every exchange and has its own filter, which now carries the logos too. The top bar keeps only the light/dark switch and the profile picture.',
      'On a wide screen the cards sit three to a row. On a phone they stack, and every button is large enough to tap.',
    ],
    technical: [
      'ExchangeAccountCard renders ExchangeLogo (EXCHANGE_META.logo, public/*-logo.*) at 48px; ExchangeLogo uses rounded-row from 44px up.',
      'New EXCHANGE_COPY[kind].walletName for the empty-wallet note. Open P&L reads ExchangeAccount.unrealized_pnl (hidden when 0 or null).',
      'DashboardLayout takes exchangeFilter (default true) → TopBar showExchangeFilter; /dashboard/exchanges passes false.',
      'Grid: repeat(auto-fill, minmax(min(100%,420px),1fr)). Icon buttons 36px, 44px under 640px.',
    ],
    links: [{ label: 'Open Exchange Accounts', href: '/dashboard/exchanges' }],
  },
  // ── 2026-10-26 ───────────────────────────────────────────────────────────
  {
    id: 'signal-log-tradingview-vs-quantlab',
    date: '2026-10-26',
    kind: 'new',
    area: 'Signal Log',
    title: 'TradingView vs QuantLab: which signal reaches us first',
    summary:
      'TradingView and QuantLab both send signals for the same coins (LTC, RENDER and a few more). The Signal Log has a new tab that puts the same signal from both side by side: which one reached our server first, by how many seconds, and the price the master account and the test account each got. Example: an LTC buy reached us from QuantLab at 9:37:32.640 and from TradingView at 9:37:39.032, so QuantLab was first by 6.4 seconds.',
    howItWorks: [
      'Open Admin → Signal Log and pick the “TradingView vs QuantLab” tab. It shows the last 7 days unless you choose other dates.',
      'Two signals count as the same one when they are for the same coin and the same action (buy, sell, close long, close short) and reach us at most 2 minutes apart.',
      'The cards at the top count how often each one was first, and the average lead. Below them: which side got better prices, how long each signal was on the way, and the biggest gap in the period.',
      'Each signal shows both sides: when it reached us, to the thousandth of a second; when the provider fired it, if the provider sends that time; and what the master (TradingView side) or the tester (QuantLab side) did with it, with the fill price.',
      'A signal only one side sent within 2 minutes is listed too, as “Only TradingView sent it” or “Only QuantLab sent it”, so missed signals are visible.',
      'Coins only one side trades (for example TradingView’s BTC, which QuantLab does not send) are left out and only counted. Otherwise every one of them would read as a signal QuantLab missed.',
      'Prices are only compared when both accounts trade with real money. A demo account fills on Binance’s test market, where prices differ, so those fills are shown but not compared.',
      'Arrival times are exact to the thousandth of a second from Oct 26, 2026. Earlier signals were stored to the whole second.',
    ],
    technical: [
      'API: GET /admin/trade-logs/compare (AdminTradeLogController::compare → App\\Services\\Admin\\FeedComparison). Takes exchange / side / type / ticker / from / to (feed, delivery and result are ignored); no dates = last 7 days. First runs only (category ≠ retry) with a received_at, each feed reading its own newest SignalHealth::SCAN_LIMIT.',
      'Pairing: same exchange + action + ticker, |received_at gap| ≤ FeedComparison::MATCH_SECONDS (120); candidate pairs sorted by gap and taken greedily, each row used once. Only (exchange, ticker) pairs present in BOTH feeds in the window are compared; the rest are counted in summary.not_compared. Tie = under 100 ms.',
      'Sides: main = the is_master detail; test = the first filled detail (else the first). Demo flag from {x}_accounts by account name (unique per table). Better price: lower for BUY / EXIT_SHORT, higher for SELL / EXIT_LONG; summary.prices counts real-money pairs only.',
      'Milliseconds: migration 2026_10_26_000001 makes trade_logs.sent_at / received_at DATETIME(3); TradeLog casts them with App\\Casts\\MillisecondDateTime (the built-in datetime cast writes Y-m-d H:i:s and drops the fraction). SignalDelivery::iso() now serialises with milliseconds, so the Signal Log delivery block carries them too.',
      'Frontend: ?view=compare on /admin/trade-logs (fetched only while open), components/admin/tradeLogs/compare/*, wording in lib/feedCompare.ts (FEED_SOURCE names the two feeds in one place).',
    ],
    links: [{ label: 'Open the comparison', href: '/admin/trade-logs?view=compare' }],
  },
  // ── 2026-10-25 ───────────────────────────────────────────────────────────
  {
    id: 'signal-delivery-proof',
    date: '2026-10-25',
    kind: 'new',
    area: 'Signal Log',
    title: 'Proof that a signal TradingView marked “timed out” still traded',
    summary:
      'TradingView sometimes marks an alert as “Webhook delivery failed — request took too long and timed out” even though the signal reached us and traded. On Oct 24 the 10:15 PM LTC buy (Manila time) read “failed” in TradingView, but it arrived 8 seconds after it fired and five accounts bought. Each signal in the Signal Log now shows when TradingView fired it, when it reached us, how fast we answered and what traded, so a red line in TradingView can be checked in one click.',
    howItWorks: [
      'Open a signal in Admin → Signal Log. The Delivery box reads, for example: “TradingView fired Oct 24, 10:15:01 PM → Reached us 10:15:09 PM · 8.1 s later → We answered in 3 ms → 5 of 6 accounts filled”.',
      'TradingView only waits about 3 seconds for an answer. A signal that took longer to reach us and be answered gets a gold “Slow delivery · traded” tag on its row. TradingView may show that alert as failed; the row shows what really happened.',
      'The tag means “may show as failed”, not “did”: TradingView sometimes holds an alert for a few seconds before sending it and still reports it as delivered.',
      'The new Delivery filter, “Slow only”, lists every such signal, so the whole history can be checked at once.',
      'The times are shown in your own time zone with seconds, so they line up with the times in TradingView’s alert log.',
      'The “TradingView fired” time needs one line added to each TradingView alert (see Admin → To be Done). Until then a signal shows when it reached us and how fast we answered, but not how long it was on the way.',
      'If a signal never reaches us at all, there is nothing to show. Only TradingView’s own log knows about it.',
    ],
    technical: [
      'Engine: _handle_webhook stamps received_at first thing and ack_ms up to the dispatch hand-off; the payload’s optional `sent_at` ({{timenow}} ISO, or epoch s/ms) is parsed leniently (unreadable = null, never a 400). _finish_job adds sent_at / received_at / ack_ms to every trade-logs POST and the local JSONL; retries carry none.',
      'API: migration 2026_10_25_000001 adds trade_logs.sent_at / received_at / transit_ms / ack_ms. SignalDelivery::fromPayload parses outside validate() (bad timing is dropped, never a 422 that loses the row) and derives transit_ms at millisecond precision. GET /admin/trade-logs rows carry `delivery` {sent_at, received_at, transit_ms, ack_ms, slow}; `?delivery=slow` = transit + ack > 3000 ms (SignalDelivery::SLOW_MS) and hides outside-close rows.',
      'Frontend: DeliveryProof strip + “Slow delivery” chip in TradeLogCard, Delivery segment in TradeLogToolbar (?delivery=slow in the URL). The Webhooks page template and field list now include "sent_at": "{{timenow}}".',
    ],
    links: [
      { label: 'Open Signal Log', href: '/admin/trade-logs' },
      { label: 'Slow deliveries', href: '/admin/trade-logs?delivery=slow' },
    ],
  },
  // ── 2026-10-23 ───────────────────────────────────────────────────────────
  {
    id: 'closed-trades-sizing-column',
    date: '2026-10-23',
    kind: 'improved',
    area: 'Positions',
    title: 'Closed trades show a Sizing column instead of “Closed”',
    summary:
      'The closed trades list used to end with a “Closed” column that almost always read “1 Position”. That column is now “Sizing”: it shows the trade’s size and, when Streak Sizing changed it, a label saying so. Example: after a losing RENDER trade, the next RENDER trade reads “Smaller size · after a loss”.',
    howItWorks: [
      'The column shows how much of the coin the trade held, for example “127.5 LTC”. That number used to sit under the ticker.',
      'When Streak Sizing set the size, a gold label sits under the number, such as “Smaller size · after 2 losses”. A trade at normal size has no label.',
      'Admins also see the exact numbers underneath, for example “size 40 instead of 60 · loss step 1”. Customers see only the pill, never the sizes.',
      'The same change applies to the customer’s Positions page and to the Positions tab on a user’s admin page.',
      'Trades closed before Oct 14, 2026 never carry a label, because the sizing used for a trade was only recorded from that day on.',
    ],
    technical: [
      'ClosedPositionsTable: the Closed (positions count) column is replaced by Sizing = |qty| + base coin, with StreakTag under it; SideTag there no longer prints the qty. No API change.',
    ],
    links: [{ label: 'Open Positions', href: '/dashboard/positions' }],
  },
  {
    id: 'user-capital-flow-transfers',
    date: '2026-10-23',
    kind: 'improved',
    area: 'User Management',
    title: 'Capital Flow on a user’s page lists every deposit and withdrawal with its date',
    summary:
      'The Capital Flow card on a user’s page used to show only totals — for example “$16,109.51 deposited in 4 transactions”. It now also lists each deposit and withdrawal underneath: when it happened, which way the money went and how much.',
    howItWorks: [
      'Newest first. A deposit reads green with a “+”, a withdrawal red with a “−”. Example: “Withdrawal · Oct 2, 2026, 3:15 PM · −$15,622.00”.',
      'The date is when the money moved on the exchange, shown in your own time zone. Transfers recorded before Sep 25, 2026 may show the day our system first saw them instead, which can be a day or two later.',
      'The exchange pill at the top of the page narrows the list like every other figure. When the list mixes exchanges, each row names its exchange.',
      'Long lists scroll inside the card.',
    ],
    technical: [
      'UserStatsService::capitalFlow adds `transfers[]` (id, exchange, type deposit|withdrawal, amount, currency, at) to GET /admin/users/{uniId}/summary → capital_flow. `at` = transaction_time (ms) when set, else created_at, as UTC ISO with Z. No api_key in the payload. Pinned by AdminUserExchangeFilterTest.',
    ],
  },
  // ── 2026-10-21 ───────────────────────────────────────────────────────────
  {
    id: 'strategies-show-test-feed',
    date: '2026-10-21',
    kind: 'improved',
    area: 'Strategies',
    title: 'Strategies page shows test-feed strategies such as QuantLab, and two old test strategies are gone',
    summary:
      'Strategies run on the test feed, like QuantLab’s “VWMA Reversion - QuantLab”, now get their own card on the Strategies page, the same as any other strategy. They used to be left out because they trade on test accounts. The old “vwma-reversion” card (one LTC trade on Sep 4) and the “VWAP-Deviation” card (six BTC trades, Jul 24 – Aug 1) were test runs and have been removed.',
    howItWorks: [
      'A test account’s trades count from the day the test feed started (Oct 15, 2026). Example: QuantLab’s seven LTC trades since Oct 16 show as one card with their own win rate and P&L.',
      'Trades a test account made before Oct 15 are not shown, because it was still following the main signals then. They would otherwise be mixed into the real VWMA-Reversion card.',
      'Test accounts usually trade test money. A test-feed card therefore shows how the strategy behaves, not money anyone made or lost. The real VWMA-Reversion card is unchanged.',
      'The removed trades no longer appear anywhere, including the master account’s P&L history and calendar.',
    ],
    technical: [
      'AdminInsights::strategyTrades: scope `all` adds testerAccounts() (type = tester, demo included) with pastRows since AdminInsights::TEST_FEED_SINCE (2026-10-15 12:00 UTC). `master` / `customers` are unchanged. Pinned by AdminInsightsTest.',
      'Deleted from binance_pastpositions on prod: ids 489, 494, 497, 499, 505, 516 (VWAP-Deviation, master) and 552 (master) + 553 (tester) (vwma-reversion). Rows backed up on the box before the delete.',
    ],
    links: [{ label: 'Open Strategies', href: '/admin/strategies' }],
  },
  // ── 2026-10-19 ───────────────────────────────────────────────────────────
  {
    id: 'admin-size-and-balance-columns',
    date: '2026-10-19',
    kind: 'improved',
    area: 'Admin',
    title: 'Position size with a downsize marker on Trading Positions, and each user’s balance on User Management',
    summary:
      'Trading Positions now has a compact Size column showing how big each position or closed trade is. When a losing streak made the bot open it smaller than normal, a small yellow ↓ sits beside the size, and clicking it shows why. User Management now has a Balance column, so you can see how much money each user has with us without opening their row.',
    howItWorks: [
      'Size is the amount of the coin, the same figure the Signal Log shows as “Quantity”, on one line. Example: “14.2 LTC”. Hover it for the dollar value (today’s price for an open position, the closing price for a closed trade).',
      'The yellow ↓ appears only on a downsized position. Click it and a small box explains it. Example: “After 3 losing trades in a row on this coin, the bot opened this trade at a smaller size. Normal size 60, size used 40 (−33%), ladder step after 2 losses.” Those are the sizes set on Trading Assets → Streak Sizing Settings, before each account’s balance scales them.',
      'This now works for open positions too, not only closed trades, so you can see a downsized position while it is still running.',
      'In the Combined view, a line adds up the size of every position it merges. A long and a short on the same coin are both counted, because both are held.',
      'Balance adds up the user’s connected exchange accounts across Binance, MEXC and Bybit. Demo (test-money) balances are shown on their own line marked “Demo” and never added to the real total. Example: “$12,400.00” with “Demo $5,000.00” under it.',
      'A disconnected account is not counted, because that money is no longer traded. It is still listed when you expand the user’s row. A user with no connected account shows “—”.',
      'Collaborators do not see the Balance column.',
    ],
    technical: [
      'GET /admin/positions now left-joins each open position to its entry tag (open_strategies on exchange + api_key + symbol + position_side) and returns `streak` (EntryStreak::forStaff) like the closed trades already did. lib/adminPositionRows.ts adds `sizeValue` (|qty| × price, summed on a merged line), makes a merged line’s qty the sum of absolute sizes (the per-row qty keeps its stored sign for the editor), and keeps a merged open line’s streak only when every row agrees. The quantity and the StreakTag moved out from under the ticker into the Size column; DownsizeButton (positions/) shows for effect = smaller only.',
      'User Management: components/admin/UserBalanceCell.tsx sums the `accounts` the list already returns (deleted_at excluded, demo kept apart), hidden when isCollaborator.',
    ],
    links: [
      { label: 'Open Trading Positions', href: '/admin/positions' },
      { label: 'Open User Management', href: '/admin/users' },
    ],
  },
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
