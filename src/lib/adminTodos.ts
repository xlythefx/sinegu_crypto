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
  // ── AI Access: Telegram usernames (2026-11-26) ──────────────────────────
  {
    id: 'privacy-policy-ai-provider',
    feature: 'AI Access',
    kind: 'decision',
    title: 'Check the Privacy Policy’s new lines about our AI assistants and card payments',
    added: '2026-11-26',
    why: 'Through AI Access, Grok (and Claude, for the developers’ error investigations) reads customer names, balances, profit and invoices, and now, on a key you allow, the Telegram username each person gave at sign-up. What it reads goes to its provider. On 26 Nov the Privacy Policy’s “Who we share it with” section gained a line saying so, and its card-payment line now names Stripe (it still said Coinsbuy). The wording is yours to approve.',
    steps: [
      'Open the Privacy Policy (link below), section 05 “Who We Share It With”, and read the “Payment processors” and “AI assistants our team uses” lines.',
      'Write any change in the note below, or "approved". Then tick this item.',
      'Decide whether customers should be told the policy changed. On 16 Nov the dashboard reminder counted as the notice and no email was sent. Write the choice in the note.',
    ],
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'AI Access', href: '/admin/ai-access' },
    ],
  },
  // ── Sign-up email (2026-11-25) ──────────────────────────────────────────
  {
    id: 'signup-email-city',
    feature: 'Sign-up',
    kind: 'decision',
    title: 'Decide whether the "new sign-up" email should show the city, not just the country',
    added: '2026-11-25',
    why: 'The team’s email about a new sign-up shows the country they signed up from (for example "Thailand (TH)"), because that is all Cloudflare tells us today. Cloudflare can also tell us the city (for example "Bangkok"), but only once a setting is switched on in its dashboard. The Privacy Policy also says we record the country only, so it would have to say "country and city" before we start keeping the city.',
    steps: [
      'Decide whether the city is wanted. If not, write "no" in the note below and tick this item.',
      'If yes: in the Cloudflare dashboard for pixel-alpha.com, open the Managed Transforms (Rules → Transform Rules → Managed Transforms; in the newer dashboard, Rules → Settings) and switch on "Add visitor location headers".',
      'Write "yes, setting is on" in the note below. The developer then records the city with each sign-up, shows it in the email as "Bangkok, Thailand (TH)", and updates the Privacy Policy to say "country and city" in the same change.',
    ],
    links: [
      { label: 'Cloudflare dashboard', href: 'https://dash.cloudflare.com/' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
  // ── New home page (2026-11-25) ──────────────────────────────────────────
  {
    id: 'landing-redesign-review',
    feature: 'Website',
    kind: 'decision',
    title: 'Review the new home page and decide when it replaces the current one',
    added: '2026-11-25',
    why: 'A redesigned home page is ready on a hidden address that search engines are told to skip. Visitors still see the current page until it is switched over. The old one is kept, so switching back is one step.',
    steps: [
      'Open the preview (link below) on a computer and on a phone, in both light and dark mode.',
      'Write any wording or design changes in the note below.',
      'When it is ready, ask the developer to put it live. Write the date it went live in the note.',
    ],
    links: [
      { label: 'The new home page (live since 2026-11-27)', href: '/' },
      { label: 'The previous home page, kept at /classic', href: '/classic' },
    ],
  },
  {
    id: 'fee-wording-public-pages',
    feature: 'Website',
    kind: 'decision',
    title: 'Decide how the public pages describe the fee',
    added: '2026-11-25',
    why: 'The current home page says "20% of the profit, nothing else" and "billed only on profit ABOVE the high-water mark". The invoices work differently. First, trades still open at month end are billed at 6% of their open profit. Second, once a month ends above the mark, that month\'s WHOLE closed profit is billed at 20%, not only the part above the mark. Example: the account ends April at $2,250 under a $2,300 mark, then makes $250 in May and ends at $2,500. May is billed 20% of $250 = $50, where "only profit above the mark" suggests 20% of $200 = $40. Third, the 6% on open profit is never credited back: when that trade closes, its profit is billed again at 20% if that month ends above the mark, and if it closes at a loss the 6% is not refunded. The FAQ was rewritten on 2026-11-25 to describe exactly what the invoices do today, all three points included. The new home page states the 20% and 6% rates and uses an example where both readings agree, so it is accurate either way. Update 2026-11-26: the owner made the fee 20% flat, so the 6% on open profit (the first and third points) is gone from the invoices, the Terms, the FAQ and the new home page. Only the second point is still open.',
    steps: [
      'Decide whether the 6% on open profit stays, and whether it should be shown on the public pages (the new home page shows it).',
      'Decide which rule is meant for a month that crosses back above the mark: bill its whole profit (what the invoices do today, and what the FAQ now says), or only the part above the mark (what the current home page says).',
      'Decide whether profit already billed at 6% while open should be credited when the same trade closes, and whether a 6% charge on a trade that later closes at a loss should stay paid. Today neither is credited, and the FAQ says so.',
      'Write the decision in the note below. The developer then aligns every page that describes the fee: the FAQ (if the rule changes), the current home page, the billing help text, the Risk Disclosure ("Fees Do Not Refund Losses" says the fee is "charged on profit above your account’s previous high-water mark"), the Terms and Conditions (section 5 says the fee "applies only to incremental positive outcomes compared to the previous reference period") and, if the rule changes, the invoice calculation.',
    ],
    links: [
      { label: 'FAQ: fees and billing', href: '/faq' },
      { label: 'Risk Disclosure: Fees Do Not Refund Losses', href: '/risk' },
      { label: 'Terms and Conditions: section 5, Fees and Payment', href: '/terms' },
      { label: 'Home page: "You pay when your account reaches a new high"', href: '/' },
    ],
  },
  // ── Sub-master account + high-risk alerts (2026-11-18)───────────────────
  {
    id: 'submaster-tradingview-alerts',
    feature: 'Sub-master',
    kind: 'action',
    title: 'Point the sub-master’s TradingView alerts at its own webhook',
    added: '2026-11-18',
    why: 'The sub-master account trades ONLY signals sent to its own webhook address, with its own secret. Until an alert posts there, it opens no trades at all. The master’s alerts never reach it.',
    steps: [
      'Open Admin → Webhooks and find the Sub-master section. Copy the Binance address (https://pixel-alpha.com/binance_submaster_webhook) and the alert template.',
      'Get the sub-master secret from the developer: it is BINANCE_ABCD_SUBMASTER_WEBHOOK_SECRET in the engine’s .env. It is a different value from the main and test secrets.',
      'In TradingView, create each sub-master alert with that address as the Webhook URL and the template as the message, with the secret filled in.',
      'Fire one test (or use Admin → Manual trade → Sub-master feed) and check the Signal Log under the Sub-master filter: the sub-master’s account should be the only one listed.',
    ],
    envKeys: ['BINANCE_ABCD_SUBMASTER_WEBHOOK_SECRET'],
    links: [
      { label: 'Admin → Webhooks', href: '/admin/webhooks' },
      { label: 'Signal Log (sub-master)', href: '/admin/trade-logs?feed=submaster' },
    ],
  },
  {
    id: 'submaster-binance-key',
    feature: 'Sub-master',
    kind: 'action',
    title: 'Make sure the sub-master’s Binance key can trade futures from our server',
    added: '2026-11-18',
    why: 'The sub-master’s live Binance account is connected, but Binance refuses every order unless the API key allows futures trading and our server’s IP. It also opens no trade until at least $1,000 has been deposited on that futures account.',
    steps: [
      'Sign in to the sub-master’s Binance account → API Management → the key used for Pixel Alpha → Edit restrictions.',
      'Tick “Enable Futures”. Under IP access, choose “Restrict access to trusted IPs only” and add 2.24.139.176.',
      'Make sure at least 1,000 USDT has been deposited to the USDⓈ-M Futures wallet.',
      'In Admin → API Keys, press Recheck on the sub-master’s account. It should read Connected with no red strip.',
    ],
    links: [{ label: 'Admin → API Keys', href: '/admin/api-keys' }],
  },
  // ── Creatives v2: the video editor (2026-11-12) ──────────────────────────
  {
    id: 'creatives-cdn-cors',
    feature: 'Creatives',
    kind: 'action',
    title: 'Check that a video clip downloads straight from Higgsfield on the live site',
    added: '2026-11-12',
    why: 'The video editor fetches each clip straight from Higgsfield\'s file server when it exports. That server is expected to allow it, but it has not been seen on a real clip yet. If it does not, the export still works through our own server, which then carries every clip file and is slower.',
    steps: [
      'On https://pixel-alpha.com open Admin → Creatives → Videos, open a project with at least one finished clip and press Export MP4 in Chrome.',
      'While it runs, open the browser\'s developer tools (F12) → Network and look at the clip requests. A request to Higgsfield\'s file address answering 200 means the direct route works; requests to /api/creatives/generations/…/download mean it fell back to our server.',
      'Write which one you saw in the note below.',
    ],
    links: [{ label: 'Admin → Creatives → Videos', href: '/admin/creatives?panel=videos' }],
  },
  {
    id: 'creatives-editor-browser',
    feature: 'Creatives',
    kind: 'decision',
    title: 'Know that video export needs Chrome, Edge or Safari 26+',
    added: '2026-11-12',
    why: 'The MP4 is made inside the browser so the server that runs the trading bot is never slowed down. Firefox and older Safari cannot encode it reliably, so they show a message instead of exporting; phones can view and reorder but not export.',
    steps: [
      'Tell the marketing team to export from Chrome, Edge or Safari 26 or newer, on a computer.',
      'If the team must export from another browser, say so in the note below: making the video on the server instead would be a separate project and would need a stronger server.',
    ],
    links: [{ label: 'Admin → Creatives → Videos', href: '/admin/creatives?panel=videos' }],
  },
  {
    id: 'creatives-tts-provider',
    feature: 'Creatives',
    kind: 'decision',
    title: 'Decide whether videos should get an AI voiceover',
    added: '2026-11-12',
    why: 'Today a voiceover is recorded in the editor or uploaded. An AI voice service could read the script aloud instead. It has its own monthly cost (roughly $6 to $22 a month for the common services) and its own key.',
    steps: [
      'Decide whether the team wants AI voiceovers, or prefers recording their own.',
      'If yes: say which service to use and how much it may spend each month. Its key then goes into the API settings on the server, never into a chat or a task.',
      'Write the choice in the note below.',
    ],
    links: [{ label: 'Admin → Creatives → Videos', href: '/admin/creatives?panel=videos' }],
  },
  {
    id: 'creatives-music-source',
    feature: 'Creatives',
    kind: 'decision',
    title: 'Agree that only music we hold the rights to is uploaded',
    added: '2026-11-12',
    why: 'The editor\'s audio library takes any music file the team uploads, and a posted video with music we have no licence for can be muted or taken down by TikTok or X. The built-in chiptune is made by the editor itself and needs no licence.',
    steps: [
      'Decide where the team\'s music comes from: the built-in chiptune, a paid music library the company subscribes to, or tracks made for us.',
      'Tell the team to upload only that music, and write the source in the note below.',
    ],
    links: [{ label: 'Admin → Creatives → Videos', href: '/admin/creatives?panel=videos' }],
  },
  {
    id: 'creatives-parallel-limit',
    feature: 'Creatives',
    kind: 'action',
    title: 'Raise the number of clips made at once, once Higgsfield\'s limit is known',
    added: '2026-11-12',
    why: 'A video\'s clips are made 6 at a time (raised from 4 on 17 Nov 2026). That is still a guess, because Higgsfield has not published how many requests one account may run together. If it allows more, a full video is ready sooner; if it allows fewer, the extra clips wait in Higgsfield\'s own queue.',
    steps: [
      'After the first few full videos, check in Higgsfield\'s dashboard (or ask their support) how many generations one account may run at the same time.',
      'Write that number in the note below; a developer then raises the limit to match.',
    ],
    links: [{ label: 'Higgsfield', href: 'https://higgsfield.ai' }],
  },
  {
    id: 'creatives-seedance-text-price',
    feature: 'Creatives',
    kind: 'action',
    title: 'Confirm the price of Seedance text-to-video on the first real run',
    added: '2026-11-12',
    why: 'Seedance text-to-video (Seedance with sound, no Pixel) is priced at the same per-second rate as the Seedance character video until Higgsfield shows its own figure. If it differs, the monthly budget reserves the wrong amount for those scenes.',
    steps: [
      'Make one Seedance scene without Pixel (Add scenes with AI → Seedance, Pixel off) and press Go.',
      'Compare the price the job card showed with what Higgsfield\'s usage page charged for it.',
      'Write both figures in the note below; a developer corrects the rate if they differ.',
    ],
    links: [{ label: 'Admin → Creatives → Budget', href: '/admin/creatives?panel=budget' }],
  },
  // ── Creatives (2026-11-10) ──────────────────────────────────────────────
  {
    id: 'creatives-caption-writer',
    feature: 'Creatives',
    kind: 'decision',
    title: 'Decide whether Creatives should write captions and hashtags with AI',
    added: '2026-11-10',
    why: 'The Creatives page plans posts and makes images and videos, but the marketing team types every caption and hashtag by hand. An AI writer could draft them from the plan’s hook and script. It needs an AI text service (for example Claude), which has its own monthly cost and its own key.',
    steps: [
      'Decide whether the team wants AI-drafted captions and hashtags for X and TikTok, or prefers to keep writing them by hand.',
      'If yes: say which service to use and how much it may spend each month. Its key then goes into the API settings on the server, never into a chat or a task.',
      'Write the choice in the note below.',
    ],
    links: [{ label: 'Admin → Creatives', href: '/admin/creatives' }],
  },
  // ── AI Access (2026-11-09) ──────────────────────────────────────────────
  {
    id: 'ai-access-connect-grok',
    feature: 'AI Access',
    kind: 'action',
    title: 'Connect your Grok app to Pixel Alpha',
    added: '2026-11-09',
    why: 'Grok can answer questions about signals, trades, assets and billing only once it has a connector with a key. Until then nothing can read the platform through it.',
    steps: [
      'Open Admin → AI Access and create a key named for the person who will use it (e.g. "Boss’s Grok"). Copy it right away — it is shown only once.',
      'In the Grok app (paid plan), go to Connectors → New connector → Custom.',
      'Fill the form exactly as the "Connect Grok" card shows: Name, Type "Remote HTTPS", the Server URL, and under HTTP headers the Key "X-Api-Key" with the key you copied as the Value. Leave Client ID empty. Click Add plugin.',
      'Ask Grok a first question, e.g. "Using Pixel Alpha, how many LTC signals came in this month?". The question should appear under "What it asked" on the AI Access page within a few seconds.',
      'Send the key only to the person who will use it, never in a group chat. If it is ever shared by mistake, revoke it on the same page and make a new one.',
    ],
    links: [{ label: 'Admin → AI Access', href: '/admin/ai-access' }],
  },
  // ── Visitor counter (2026-10-28) ────────────────────────────────────────
  {
    id: 'privacy-policy-visits-notice',
    feature: 'Visitors',
    kind: 'decision',
    title: 'Decide whether to email customers about the 28 Oct Privacy Policy update',
    added: '2026-10-28',
    why: 'The Privacy Policy now says every visit to the public website is recorded, with the IP address (deleted after 90 days), country and device. The privacy banner shows the new wording to every visitor once, which is a notice in the platform. Section 12 of the policy also mentions email for a new kind of data; customers who never open the public website again would only see the banner if they do.',
    steps: [
      'Read the updated policy at /privacy (sections 2.3, 3, 7 and 9 changed).',
      'Decide whether the banner is enough, or whether customers also get a short email. If an email, write the wording you want (or ask for a draft). It can go together with the 14 Oct update if that one has not been sent yet.',
      'Write the choice in the note below.',
    ],
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Admin → Visitors', href: '/admin/visitors' },
    ],
  },
  // ── Signal delivery proof (2026-10-25) ──────────────────────────────────
  {
    id: 'tradingview-alerts-sent-at',
    feature: 'Signal Log',
    kind: 'action',
    title: 'Add "sent_at" to every TradingView alert message',
    added: '2026-10-25',
    why: 'The Signal Log now shows when each signal reached us and how fast we answered, but it can only show how long the signal took to arrive (and flag the ones TradingView may mark "failed — timed out") when the alert says when it fired. Alerts without the field keep trading exactly as before; they just show no travel time.',
    steps: [
      'In TradingView, open each alert that posts to a Pixel Alpha webhook (Binance, MEXC, Bybit and the test feed) and click Edit.',
      'In the Message box, add one line inside the braces, after the "strategy" line: "sent_at": "{{timenow}}" — with a comma at the end of the line before it. Type {{timenow}} exactly; TradingView replaces it with the time the alert fires.',
      'Save the alert. Leave the secret and every other field as they are.',
      'After the next signal, open Admin → Signal Log and expand that signal: the Delivery box should show a "TradingView fired" time that matches the time in TradingView\'s alert log.',
    ],
    links: [
      { label: 'Signal Log', href: '/admin/trade-logs' },
      { label: 'Webhooks (message template)', href: '/admin/webhooks' },
    ],
  },
  // ── Test feed (2026-10-15) ──────────────────────────────────────────────
  {
    id: 'test-feed-first-provider',
    feature: 'Test feed',
    kind: 'action',
    title: 'Point a test signal source at the test feed',
    added: '2026-10-15',
    why: 'The test feed is built but nothing receives it until at least one account has the Tester role, and nothing sends to it until a signal source is pointed at its address. Until then the Webhooks page shows the test addresses with "No accounts receive this yet".',
    steps: [
      'Create the test account: Admin → User Management → New user, role Tester (or change an existing internal account to Tester — it must have no open positions).',
      'Sign in as that account and connect an exchange key. Start with a DEMO key (Binance testnet / MEXC demo) so the first test moves no real money.',
      'Admin → Webhooks → Test feed: check the card says "Ready" and "Sends to 1 demo account".',
      'Send a first signal by hand: Admin → Sandbox → Manual trade → switch to "Test feed" → BUY on a coin that is switched on. Check the Signal Log (Feed: Test) and the admin Telegram chat.',
      'To try another signal provider: give it the test address from the Webhooks page and the test secret (ask the developer — it lives in BINANCE_ABCD_TEST_WEBHOOK_SECRET on the engine). Never give a provider the main TradingView secret.',
      'Write in the note below which providers were tried and how they did.',
    ],
    envKeys: ['BINANCE_ABCD_TEST_WEBHOOK_SECRET', 'ENGINE_TEST_WEBHOOK_SECRET'],
    links: [
      { label: 'Admin → Webhooks', href: '/admin/webhooks' },
      { label: 'Admin → User Management', href: '/admin/users' },
      { label: 'Manual trade', href: '/admin/sandbox/manual-trade' },
    ],
  },
  // ── Sign-up details (2026-10-14) ────────────────────────────────────────
  {
    id: 'privacy-policy-oct-2026-notice',
    feature: 'Sign-up details',
    kind: 'decision',
    title: 'Decide how to tell existing customers about the 14 Oct Privacy Policy update',
    added: '2026-10-14',
    why: 'The Privacy Policy now says we record IP address, country and device at every sign-in, and asks new visitors through a privacy banner. Our own policy (section 12) promises that for a new category of data we tell existing users by email or by a notice in the platform before it takes effect. New sign-ups agree to the new text; customers who signed up before 14 Oct have not been told yet.',
    steps: [
      'Read the updated policy at /privacy (sections 2, 3, 7 and 9 changed).',
      'Choose how existing customers are told: a short email, a one-time notice on the dashboard, or both — and write the wording you want (or ask for a draft).',
      'Write the choice in the note below so it can be built.',
    ],
    links: [{ label: 'Privacy Policy', href: '/privacy' }],
  },
  // ── Binance offer (2026-10-13) ──────────────────────────────────────────
  {
    id: 'binance-offer-confirm-by-hand',
    feature: 'Binance offer',
    kind: 'action',
    title: 'Confirm Binance-offer customers by hand and set their fee to 15%',
    added: '2026-10-13',
    why: 'The new offer page and Part 1 of the Binance guide promise 15% instead of 20% on realized profit to anyone who opens a Binance account through our link. Billing does not apply that by itself yet — until it does, a customer who qualifies is still invoiced 20% unless their rate is changed by hand.',
    steps: [
      'Open the referral link once yourself and check that Binance’s sign-up screen shows Referral ID HPU7VNUZ.',
      'When a customer says they signed up through the link (or a new Binance customer connects), open Binance → Referral Pro → Referrals → My Referrals and search for their Binance account ID (UID). If you cannot tell which one is theirs, ask the customer for their UID — it is under their profile on Binance.',
      'If it is on the list: Admin → User Management → open the customer → the fee settings card → set “Realized fee %” to 15 and save. Leave the unrealized fee as it is.',
      'Do it before the 1st of next month: the invoice for a month is made on the 1st of the month after, at the rate set at that moment — so a customer confirmed any day in October is billed 15% for October.',
      'Write the customer and the date in the note here until billing tracks it on its own.',
    ],
    links: [
      { label: 'Admin → User Management', href: '/admin/users' },
      { label: 'The offer page', href: '/binance-offer' },
    ],
  },
  {
    id: 'binance-offer-kickback-share',
    feature: 'Binance offer',
    kind: 'decision',
    title: 'Share part of Binance’s referral payment with the customer, or keep it all?',
    added: '2026-10-13',
    why: 'Binance lets a referrer hand part of its referral payment straight back to the customer as cheaper Binance futures fees — a slider per referral code, up to 20% of what Binance pays. That would be on top of our own 15%. The offer page currently says “you pay Binance exactly what anyone else pays”, which stays true only while we keep it all. Worth knowing too: Binance’s FAQ says the entry tier pays referrals for 12 months from the customer opening Futures, while our 15% lasts as long as they trade with us.',
    steps: [
      'Decide: keep the whole Binance payment, or give the customer a share of it on Binance’s side.',
      'Check in Binance → Referral Pro what the “5%” on this link actually is — the FAQ’s entry tier pays 10% on futures, so 5% may already mean half is being shared.',
      'If you share it: move the slider for this referral code in Binance → Referral Pro, and ask for the offer page wording to be updated in the same go.',
      'Write the decision in the note here.',
    ],
  },
  {
    id: 'binance-offer-terms',
    feature: 'Binance offer',
    kind: 'decision',
    title: 'Add the 15% Binance-offer rate to the Terms & Conditions',
    added: '2026-10-13',
    why: 'Section 05 of the Terms (Fees and Payment) lists 20% of realized earnings as the fee, with no mention of the lower rate the offer promises. A customer on the offer is billed less than the Terms say, which is in their favour but should still be written down.',
    steps: [
      'Decide the wording (for example: “15% of realized net positive earnings for accounts opened through Pixel Alpha’s Binance referral link and confirmed by us”), and whether a lawyer should see it.',
      'Send the wording to be added to the Terms — the Terms page is text in the website, so it is a small website change.',
    ],
    links: [{ label: 'Terms & Conditions', href: '/terms' }],
  },
  {
    id: 'binance-link-program',
    feature: 'Binance offer',
    kind: 'decision',
    title: 'Look at Binance Link (now “OMS Toolkit”) — it pays more, but not on referral-link customers',
    added: '2026-10-13',
    why: 'Binance runs a separate programme for platforms that trade through their customers’ own API keys — exactly what the bot does. It reportedly pays 30–50% of the trading fees (the referral link’s entry tier pays 10%), on every order the bot tags. The catch: it only pays on customers who opened Binance after we join it AND signed up with NO referral code — so a customer who used our referral link never counts for it. The two cannot both pay on the same customer, which decides how the offer page should tell people to sign up.',
    steps: [
      'Decide whether to apply. It needs a business verification with Binance’s VIP / Institutional team; no published minimum was found.',
      'If yes: the offer would change from “sign up with our referral code” to “sign up with no referral code at all” — the website copy and the guide’s first step change with it, and the bot starts tagging its Binance orders with the partner ID (a developer change).',
      'If no: nothing changes; record the decision in the note here.',
    ],
    links: [
      { label: 'Binance Link — Link and Trade docs', href: 'https://developers.binance.com/docs/binance_link/link-and-trade/futures' },
    ],
  },
  // ── Streak sizing (2026-10-09; win steps added the same day) ───────────
  {
    // The id predates win steps — it is the API's key, so it stays.
    id: 'loss-sizing-configure',
    feature: 'Streak sizing',
    kind: 'action',
    title: 'Set the losing- and winning-streak sizes for LTC and RENDER, then switch them on',
    added: '2026-10-09',
    why: 'The bot can now trade a different size after losses in a row AND after wins in a row (for example smaller after a losing run, bigger after a winning one), and goes back to base size as soon as the run breaks. Every asset starts with the feature OFF and no steps, so until the steps are typed in and the switch is on, LTC and RENDER keep trading their normal base size whatever the run.',
    steps: [
      'Admin → Trading Assets → "Streak Sizing Settings" tab. LTCUSDT (base 5) and RENDERUSDT (base 60) are both already set up for Binance.',
      'On the LTCUSDT card, press "Add step" for each step you want. Pick Loss or Win on the row, type how many in a row it starts at, then the size: for example Loss, after 2 in a row → 3, and Win, after 3 in a row → 7. A step keeps applying until the next step of its kind, and the deepest one keeps applying however long the run lasts. Sizes are per 1,000 USDT of balance, exactly like Base size.',
      'A win size bigger than base still stops at the max position size, so the stack reaches it in fewer entries (base 5 with max 15: two entries of 7 make 14, a third is refused). Raise the max position size on the Assets tab if that is not what you want.',
      'Switch the card ON and Save, then confirm. Do the same for RENDERUSDT.',
      'Check the "Right now" line on each card: it shows how many accounts are at normal size and how many sit on each losing or winning step today.',
      'After the next entry signal, open Admin → Signal Log, expand the signal and look at an account on a streak: it says which step was used and why.',
    ],
    envKeys: [],
    links: [{ label: 'Admin → Trading Assets', href: '/admin/assets?tab=streak-sizing' }],
  },
  // ── Card payments via Stripe (2026-09-30) ───────────────────────────────
  {
    id: 'stripe-register-webhooks',
    feature: 'Card payments',
    kind: 'action',
    title: 'Register the Pixel Alpha webhook in Stripe (live and test) and paste its signing secrets',
    added: '2026-09-30',
    why: 'Card payments use the same Stripe account as the old product, and the API already holds its keys. But Stripe only tells us a card was paid through a webhook that has to be registered in the Stripe dashboard, and each registration has its own signing secret. The old product\'s secret belongs to ITS address and cannot be reused. Until this is done the "Pay by card" button stays hidden for customers on pixel-alpha.com, on purpose: a card charged with no webhook would leave the invoice unpaid, and the overdue job would then pause that customer\'s trading.',
    steps: [
      'LIVE: in the Stripe Dashboard (the same "Sinegual" account as the old product), make sure you are NOT in test mode / a sandbox. Open dashboard.stripe.com/webhooks (or bottom-left Developers → Webhooks) → "Add destination" (older screens: "Add endpoint").',
      'Events: "Your account" → search and tick checkout.session.completed only → Continue. Destination type: Webhook endpoint → Continue. Endpoint URL: https://pixel-alpha.com/api/payments/stripe/webhook → Create destination.',
      'On the new destination, find "Signing secret" → Reveal → copy it (starts with whsec_). Paste it into STRIPE_WEBHOOK_SECRET in the local sinegutrade-api/.env, then run `python .claude/deploy_sinegualcrypto.py sync-api-env`. Customers now see "Pay by card", and developers see the "Real card" button.',
      'TEST: open dashboard.stripe.com/test/webhooks (the test-mode side of the SAME account, the one whose sk_test_ key the API uses — not a separate Sandbox) and add the same URL with the same event. Paste its signing secret into STRIPE_WEBHOOK_SECRET_TEST on the PROD box only (api/.env, then `php artisan config:cache`). Developers now see the "Test card" button. Leave the local value alone: the local one is the Stripe CLI secret for `stripe listen`.',
      'Rehearse as a developer on prod: Test card with 4242 4242 4242 4242 should flip the invoice to Paid within seconds. Only then try Real card on a small invoice. Test-card payments can never settle a customer\'s invoice: the API refuses test-mode payments for anyone who is not a developer.',
      'Heads-up: the OLD product\'s webhook on the same Stripe account will also receive Pixel Alpha payments and answer them with an error, because they lack its "broker" field. That does no harm to either product, but Stripe will list those deliveries as failed on the old endpoint and may email about them. If that becomes noise, give Pixel Alpha its own Stripe account and swap the keys.',
    ],
    envKeys: ['STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET_TEST'],
    links: [{ label: 'Stripe → Webhooks', href: 'https://dashboard.stripe.com/webhooks' }],
  },
  // ── Transfer history from the exchange ledger (2026-09-25) ──────────────
  {
    id: 'ledger-backfill-existing-accounts',
    feature: 'Transfer history',
    kind: 'action',
    title: 'Apply the Binance transfer history to every existing Binance account',
    added: '2026-09-25',
    why: 'New accounts now get their starting balance from Binance\'s own records automatically, but accounts connected before this change still carry the old figure. On 25 Sep two customer accounts were counted at about twice their real capital (their deposit stored once as the starting balance and again as a transfer), and the master was missing its March–May transfers. Binance keeps roughly six months of history, so older transfers disappear from it for good — do this soon.',
    steps: [
      'Admin → API Keys → filter Binance.',
      'For each connected account, starting with the master: Actions → Transfer history. Read the preview: which transfers will be added and how the starting balance and total deposited change.',
      'If it lists problems (a transfer we store that Binance does not know, or a non-USDT balance), do not apply — look into that account first.',
      'Otherwise Apply and confirm. Nothing changes on issued invoices; analytics, the deposit gate and future invoices use the corrected figures.',
    ],
    envKeys: [],
    links: [{ label: 'Admin → API Keys', href: '/admin/api-keys' }],
  },
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
  {
    id: 'email-templates-approval',
    feature: 'Account emails',
    kind: 'decision',
    title: 'Approve the draft emails, and the day unpaid accounts are paused (day 5 or day 7)',
    added: '2026-09-28',
    why: 'Nine emails are designed but not sent: welcome, weekly summary, new invoice, the day-2 / day-3 / day-5 payment reminders, thank-you-for-paying, and the team notices for exchange connected / invoice issued / unpaid / paid. Each needs its wording approved before it is switched on. The reminders also assume trading pauses on day 5, but the code today pauses the day after the due date — the 8th of the month after the invoice period, roughly day 7.',
    steps: [
      'Open Admin → Sandbox → Email Templates. Read each email at Phone and Desktop width, or use "All" to mail every one to yourself as [Preview] copies.',
      'Write the wording changes, or "approved", in this item\'s note — per email.',
      'Decide the pause day: day 5 (the reminders\' wording) or keep today\'s day 7. Day 5 means moving the invoice due date in InvoiceService, which changes when overdue accounts stop trading.',
      'Decide when the weekly summary goes out (e.g. Monday morning Manila time) and whether customers can switch it off.',
      'Once approved, the senders get wired one by one; each flips from Draft to Live on that page when it does.',
    ],
    envKeys: ['MAIL_ADMIN_ADDRESS'],
    links: [{ label: 'Email Templates', href: '/admin/sandbox/emails' }],
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
      'To open MEXC ALONE: on the server set EXCHANGES_STAFF_ONLY=bybit in /var/www/sinegualerts/api/.env and run php artisan config:cache, THEN deploy the website with MEXC no longer marked staff-only in the app (the connect page carries its own copy of the lock). Note the CSV: since Bybit landed on 2026-09-24 the key lists BOTH closed venues, so clearing it entirely would open Bybit at the same time. Setting it back to `mexc,bybit` closes both again, and accounts already connected keep trading either way.',
      'Connecting the MASTER account to MEXC is a separate switch with its own consequence: it is what turns on MEXC Telegram recaps and the PnL line on MEXC close messages, which stay silent while the master has no account there.',
    ],
    envKeys: ['EXCHANGES_STAFF_ONLY'],
  },
  {
    id: 'mexc-customer-billing',
    feature: 'MEXC',
    kind: 'decision',
    title: 'How MEXC customers are billed until MEXC invoicing exists',
    added: '2026-11-06',
    why: 'MEXC opened to customers on Nov 6, 2026, but invoices only exist for Binance: the monthly run on the 1st skips MEXC, and the manual-fee tool in the Sandbox bills Binance accounts only. A customer who trades on MEXC therefore gets no invoice and pays no profit share until MEXC billing is built — and an unpaid MEXC month also never pauses their account.',
    steps: [
      'Decide: build MEXC invoicing before customers fund MEXC accounts, or accept that the first MEXC months go unbilled.',
      'Until it exists, see who trades on MEXC under Admin → API Keys (filter MEXC), and each customer’s MEXC results on their user page with the MEXC pill selected.',
      'Write the decision in the note here.',
    ],
    links: [{ label: 'API Keys', href: '/admin/api-keys' }],
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
      'Then deploy the website with Bybit no longer marked staff-only in the app (the connect page carries its own copy of the lock), and with the landing-page, FAQ and Trading Bot copy that still says Bybit is coming soon updated in the same change.',
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
