# Pixel Alpha (sinegual-crypto)

Frontend for Pixel Alpha — an automated crypto-trading-bot product (users connect Binance / Bybit / MEXC via trade-only API keys; pricing is 20% of profit only).

## The product is called **Pixel Alpha**

Renamed from "SineguAlerts" on 2026-08-13. **Every user-visible mention of the
product is "Pixel Alpha"** — page titles, landing copy, sidebars, auth screens,
emails, the Telegram channel, docs. If you find "SineguAlerts" in anything a
user or reader can see, it is a leftover: fix it.

**Do NOT rename infrastructure identifiers.** These contain "sinegualerts" or
"sinegu" as an *address*, not a name, and renaming them breaks production or
silently splits state in two:

| Identifier | Where |
|---|---|
| `/var/www/sinegualerts/{dashboard,api,engine}` | server paths, every deploy command |
| `sinegualerts-engine` | systemd unit + its sudoers rule + journal reads |
| `/etc/nginx/sites-available/sinegualerts` | the vhost (and its `sites-enabled` symlink) |
| `sinegu_crypto` | the MySQL database |
| `sinegutrade-api` | the backend repo/folder |
| `sinegual-crypto`, `deploy_sinegualcrypto.py` | this repo and its deploy script |
| `prod` target alias `sinegualerts` | `.claude/deploy_sinegualcrypto.py` |

The rule is simple: **if a human reads it, it says Pixel Alpha; if a machine
resolves it, leave it alone.** A rename of the machine-side names is a
migration (move directories, rewrite the unit, re-point nginx, re-run certbot's
webroot), not a find-and-replace — and there is no benefit to justify it.
The domain is already `pixel-alpha.com`.

## Support contacts (the only ones — 2026-09-16)

| Channel | Value |
|---|---|
| Email | `support@pixel-alpha.com` |
| Telegram | `@pixel_alpha_support` → `https://t.me/pixel_alpha_support` |

Both live in **`src/lib/company.ts`** (`COMPANY.email`, `COMPANY.telegram`, plus
`SUPPORT_EMAIL` / `SUPPORT_TELEGRAM_HANDLE` / `SUPPORT_TELEGRAM_URL`). Any page
that tells a customer where to write — legal contact sections, footers,
error/empty states, "need help?" strips — **reads those constants, never
retypes the address or handle.** The legal renderer already has `email` and
`telegram` block kinds (`types/legal.ts`) for contact lines. The public
signals channel (**Voltrax Trades**) is NOT a support contact. **No personal
line beside the desk** (the founder's Telegram was removed 2026-09-18): a
contact must outlive whoever holds it.

**That mailbox also SENDS and RECEIVES everything the API mails (2026-09-23).**
Invoices, reminders, password resets, the approval email a customer gets and
the "someone registered" notice the desk gets — all from
`support@pixel-alpha.com` (`MAIL_FROM_ADDRESS`), and the notice goes back to
the same box (`MAIL_ADMIN_ADDRESS`). Never a `noreply@`, and never a personal
inbox: same rule as the contact page. The mailbox is **Hostinger's**
(`pixel-alpha.com` MX → `mx1/mx2.hostinger.com`, SPF already includes
`_spf.mail.hostinger.com`), so sending needs no third party — only that
mailbox's password in `MAIL_PASSWORD` (`smtp.hostinger.com`:465, `smtps`).
Two rules: the credentials and the recipient ARE mirrored by `sync-api-env`
(they are the product's identity), but **`MAIL_MAILER` is not** — the
transport is per box, `log` locally and `smtp` on prod, so a developer
testing locally can never switch prod's mail off. Until that key is set,
`MAIL_MAILER=log` means nothing is delivered anywhere, the reset code
included; `App\Services\Notifications\AccountMail` therefore treats every send
as best-effort (the row is the fact, the mail is the telling), and
`php artisan mail:preview` renders every template to
`storage/app/mail-previews/` from the real Mailables so a design can be
reviewed without mailing anyone.

**Every email lives in ONE catalogue (2026-09-28):**
`App\Services\Notifications\EmailCatalogue` — slug, audience (customer / team),
trigger, `live` flag and a Mailable built from sample data. It feeds both
`mail:preview` and **Admin → Sandbox → Email Templates**
(`/admin/sandbox/emails/:slug`, `SandboxEmailController`), which renders each
email in an iframe at phone/desktop width and mails `[Preview]` copies to a
reviewer (one or all; sample data only). Every Mailable extends
`App\Mail\PixelMail` (scalars, never models; subject through `subjectLine()` so
the preview prefix survives Laravel re-applying the envelope). **Only three are
LIVE** — sign-up notice, approval, password reset. The rest (welcome, weekly
summary with $ P&L, invoice, reminders day 2/3/5, thank-you, and team notices
for exchange connected / invoice issued / unpaid / paid) are DRAFTS awaiting
the owner's wording approval (to-do `email-templates-approval`); wiring one
means sending it best-effort like `AccountMail` and flipping its `live` in the
same change. `MAIL_ADMIN_ADDRESS` is a comma-separated team list
(`AccountMail::teamRecipients()`) — support@ plus Dmitri
(dmitri@feature-digital.com; asked for sign-ups, exchange connections and
payments) and Christian (christian@feature-digital.com; asked for sign-ups).
One list for every team notice — if they ever want different notices, split
it per notice rather than dropping someone.

**Pixel Alpha is the ONLY name and the Bangkok office the ONLY address a
customer ever sees (2026-09-20).** `COMPANY.name` + `OFFICE.addressLines` /
`OFFICE.country` in `company.ts` feed the Contact page, the legal pages'
controller/contact blocks, the footer, the invoice's FROM block and the API's
emails. The billing entity that used to be printed beside it (a legal name,
registry number and Israeli address — `COMPANY.legalName` / `registryNumber`
/ `addressLines`, since deleted) was removed from every user-visible surface,
**invoices included**, at the owner's request. Do not reintroduce a second
entity name anywhere a customer reads; if the owner wants it back on invoices
it goes back through `company.ts`, not retyped.

## Stack

- **Frontend (this repo):** React 19 + TypeScript + Vite (scaffolded with `npm create vite`), `react-router-dom`. Styling is **Tailwind v4 utility classes mapped to the design tokens** in `src/index.css` (`@theme inline` — `bg-surface`, `text-muted`, `rounded-card`, …); repeated strings are hoisted into module-level `const`s or a shared `*Classes.ts` (`components/settings/formClasses.ts`, `components/auth/authClasses.ts`, `components/dashboard/shellClasses.ts`). Routes: `/` (landing), `/auth` (sign in / register), `/auth/discord/*` (Discord sign-in).
- **Backend:** `sinegutrade-api` (Laravel + Sanctum) + MySQL DB `sinegu_crypto`, running locally on WAMP.
  Exchange data lives in `binance_*` tables (accounts, positions, pastpositions, transactions, invoices);
  `mexc_*` landed 2026-09-16 and `bybit_*` 2026-09-24, all four tables per venue.
  Keep exchange-specific reads behind API endpoints and behind `ExchangeSchema`,
  so the next venue merges in without frontend changes.
- **Deployment (live):** **https://pixel-alpha.com** — Ubuntu 24.04 Contabo VPS
  (origin `2.24.139.176`), provisioned 2026-07-28, domain + TLS 2026-08-11. nginx
  serves the React build at `/` and `sinegutrade-api` at `/api` from the same origin
  (`/var/www/sinegualerts/{dashboard,api}`). Deploy with `/deploy` (see
  `.claude/skills/deploy/SKILL.md`).
  DNS is Cloudflare, **proxied**; the origin holds its own Let's Encrypt cert
  (`setup-tls`, auto-renewing) so Cloudflare can run **Full (strict)**. `www` 301s
  to the apex; the bare IP still serves over http. Two rules the vhost exists to
  protect: **port 80 must never blanket-redirect to https** (the engine reaches the
  API at `http://127.0.0.1/api`, so a global 301 would cut the loop — only the
  DOMAIN's :80 block redirects), and **`CF-Connecting-IP` is trusted only from
  Cloudflare's published ranges**, because `/api/engine/*` is gated on
  `allow 127.0.0.1` and a spoofable real-IP would expose the endpoint that hands out
  account API keys.
  The frontend needed no rebuild — `src/services/api.ts` resolves the API base from
  the host at runtime, so https came for free.

**Supported exchanges (the only brokers) — Binance, Bybit, MEXC.** These three are the
entire universe of exchanges the product supports; there are no others (no Capital.com, no
IG, etc.). Any "broker/exchange" list, filter, badge, or selector must contain exactly these
three. **All three are wired as of 2026-09-24**; MEXC and Bybit are staff-only
to connect (below). Canonical labels/brand colors/order live in
`src/components/exchanges/meta.ts`.

**MEXC and Bybit are live in the engine but STAFF-ONLY to connect** (MEXC
2026-09-23, Bybit 2026-09-24). They trade and sync like Binance; they have
simply not run long enough on a real customer account to sell, so only
`admin` / `master` / `developer` may connect one. The gate is
`config('exchanges.staff_only')` (CSV env `EXCHANGES_STAFF_ONLY`, default
`mexc,bybit`) checked in
`ExchangeAccountController::store` against `EnsureAdmin::ROLES` — the admin
portal's own list, never a second spelling of it — answering 403
`EXCHANGE_RESTRICTED`. Three rules:
- **It gates CONNECTING ONLY.** An account already on the venue keeps trading,
  keeps syncing, and can always be renamed or disconnected. Closing a venue
  must never trap someone's keys inside it (a test asserts it).
- **A customer is told "Coming soon", not "staff only"** — for them that is the
  whole truth. `staffOnly` in `meta.ts` + `canConnectExchange(kind, role)` is
  the client twin (cosmetic, as always); staff see the row selectable with a
  "Staff only" badge.
- **Opening one is a config change on the box** (`EXCHANGES_STAFF_ONLY=…` then
  `config:cache`), never a deploy — and it is deliberately NOT mirrored by
  `sync-api-env`, for the same reason `TRON_PUBLIC` is not: rollout state must
  not follow a local experiment onto prod. The default is the closed state, so
  a box missing the key still protects it — which means **a new venue must join
  that default in the same change that registers it**. And note the CSV now
  that two venues are listed: **clearing the key opens BOTH**, so opening one
  alone means naming the other (`EXCHANGES_STAFF_ONLY=bybit` opens MEXC).

## Current objective — port the user side of the mother dashboard

We are **gradually recreating the USER side of `sinequal-dash-fusion-main` in this repo** —
page by page ("we slowly do it"). Rules for every ported page:

- **Design/UI only** — never copy code, hooks, API layers, or data logic from the mother.
  Recreate the layout pixel-faithfully using THIS repo's stack and conventions
  (plain CSS + our design tokens, AOS, ConfirmModal, lucide-react, thin pages).
- `sinegutrade-api` (Laravel, DB `sinegu_crypto`) **already exists and is running on WAMP** —
  so **prefer wiring pages to the real API over static prototype data.** Whenever a page can be
  connected, build its hook + `services/` layer and connect it; only fall back to static data
  when no endpoint/column exists yet. Before wiring anything exchange-related, **check the
  actual `binance_*` table columns** in the `sinegu_crypto` DB (accounts, positions,
  pastpositions, transactions, invoices) and match field names to what's really there —
  don't assume.
- Adapt domain terms: brokers (Capital.com/IG) → **exchanges (Binance/Bybit/MEXC)**.
- Ported so far: **Trading Dashboard** (`/dashboard`, from DashboardV2), **Positions**
  (`/dashboard/positions`, from UserAlerts), **Performance Analytics**
  (`/dashboard/analytics`, from UserAnalytics), **Exchange Accounts**
  (`/dashboard/exchanges`, from UserBrokers — live against `/api/exchange/*`;
  **all three venues connect; MEXC and Bybit are staff-only**. One
  account per user PER exchange; every row carries `exchange` and every
  rename/refresh/disconnect goes to `/exchange/{exchange}/accounts/{id}`
  because ids repeat across the per-exchange tables. Connecting is its own
  PAGE, not a modal: `/dashboard/exchanges/connect` (`pages/ConnectExchange.tsx`
  + `components/exchanges/connect/`), four steps — exchange → **mode (live or
  demo)** → keys → review, confirmed through ConfirmModal. The mode step writes
  the account's `demo` flag, which is the ONE choice on the page whose
  consequence is invisible until a signal fires: the engine picks the API host
  from it, and the key sets are not interchangeable — a mainnet key on the
  testnet never trades, a testnet key on mainnet is refused — so the step
  names the site each key comes from and the review step repeats the verdict.
  **The step exists only where the venue has a testnet** (`EXCHANGE_META.hasTestnet`
  — both Binance and MEXC do; a venue without one gets a three-step wizard and
  the API refuses `demo: true` for it, `DEMO_NOT_AVAILABLE`). Per-venue wording — key URL, the venue's names
  for the IP setting and the futures permission, its key rules (MEXC keys with
  no IP bound expire in 90 days; futures API trading needs KYC) — is data in
  `components/exchanges/exchangeCopy.ts`, shared with the blocked-key modal. A
  page rather than a dialog because the user leaves for the exchange mid-flow
  and comes back, and because the instructions belong BESIDE the fields, not
  stacked above them in 520px), **Settings**
  (`/dashboard/settings`, from UserProfile — account info/password/sign-out wired to
  `/api/user/*`; payment method, crypto wallets, bank wire still static),
  **Admin Dashboard** (`/admin`, from AdminOverview — master account card, 4 stat cards,
  cumulative P&L chart + date/ticker filters, performance breakdown, daily P&L calendar;
  **wired live** to the master account via `GET /admin/master-stats`, `/admin/performance`
  and `/admin/daily-pnl`, all reading the `binance_*` tables of the
  `user_credentials.type = 'master'` row. `stats.balance` is **nullable** — null means the
  balance poller has not written yet and the card shows "Awaiting sync" rather than $0.00),
  **Billing & Invoices** (`/dashboard/invoices`, from
  UserInvoicePayment — stat cards + HWM banner, Outstanding/History tabs, exchange filter
  chips, collapsible invoice cards with performance breakdown, "How billing works" sidebar,
  and an in-depth detail page at `/dashboard/invoices/:id`; **wired live** to
  `sinegutrade-api` via `services/billing.ts` + `useApiData`. The trader pay button opens
  `PaymentMethodModal` → USDT-TRC20 or, where the server allows it, a card via Stripe
  Checkout — see "Card payments" below). Remaining user pages:
  Trading Assets, Referrals; further admin pages (Strategies, ...).

**The printable invoice document** — "View invoice" on `/dashboard/invoices/:id` opens
`components/billing/InvoiceDocumentModal.tsx`: white paper on the dark scrim, with the
issuer (`lib/company.ts` — **Pixel Alpha** at the Bangkok `OFFICE`; no legal entity or
registry number, by decision on 2026-09-20), the billed trader, line items, subtotal /
VAT / total, the performance summary the fee derives from, and payment terms. Two rules:
- **It is styled with FIXED light colors, never the theme tokens.** It is a legal record
  the customer files and prints; a dark PDF is not an invoice, and flipping the app to
  light theme must not change what their copy looks like.
- **It restates, never recomputes.** Every figure comes off the same `Invoice` the detail
  page renders; the only arithmetic is summing the line items it was handed. A document
  that derives its own total is a second, divergent source of what is owed.
  Printing is real (`window.print()`): the `@media print` block in `index.css` is gated on
  the `body.invoice-doc-open` class the modal sets, so Ctrl+P on any other page still
  prints that page rather than a blank sheet.

**Invoicing backend (live).** One unified `invoices` table (exchange discriminator
binance|bybit|mexc — renamed from `binance_invoices`, HWM stored on the row).
`InvoiceService` (`generateForAccount` + a single idempotent `settle()`) is the reusable
core; a `PnlSource` adapter per exchange (only `BinancePnlSource` so far). Fees are
mother-style: per-user `realized_percentage × realized + unrealized_percentage × unrealized`
(defaults 20% / 6% on `user_credentials`). Endpoints: user `GET /invoices`,`/invoices/{id}`;
admin `GET/POST/PUT/DELETE /admin/invoices*`. **Admin Invoice History** (`/admin/invoices`)
lists/filters/settles/deletes; **Admin Sandbox → Invoice Testing** generates an invoice from
a user's closed P&L and marks it paid (manual charging). Its **Manual fee** tab
(2026-09-30, `POST /admin/invoices/manual` → `InvoiceService::generateManual`)
bills ONE Binance account a typed fee (see also **monthly auto-invoicing**
below): same row, same HWM math as the P&L
invoice for that month, but `total_fee` = the amount, the realized/unrealized
split zero and `invoices.fee_source = 'manual'` (every screen then prints one
"set manually" line — never a split that does not add up to the total). It
replaces that month's unpaid invoice and refuses a paid one (a $0 row that
generate stored as 'paid' collected nothing and IS replaceable); **due the 4th
of the month after the billing month, like every invoice (owner, 2026-10-02,
`InvoiceService::manualDueDate`)** — or today + 3 days once that 4th has
passed, never a past date, or the overdue sweep would disable the account the
same night. Regenerating from P&L resets `fee_source` to 'pnl'.
**Billing schedule as the team states it:** 2nd reminder, 3rd reminder, 4th
the account is cut off (paused) and emailed that it was — NO reminder on the
4th. The `PaymentReminder` stages gentle / firm / paused already say exactly
that. Invoice page: the Billing Period card sits directly under the amount
due; crypto amounts print via `fmtCryptoAmount` ("3.000000" → "3.00", never
dropping a significant digit); "Show QR code" opens its own `TronQrModal`.
**The master account is never invoiced** (owner, 2026-09-25):
`InvoiceService::notInvoiceableReason` refuses it inside `generateForAccount`, so
the admin screen (422 `NOT_INVOICEABLE`) and the future monthly run agree;
`SBXINV-` scenario accounts stay exempt. **Exception (2026-09-30): Admin →
Sandbox → Invoice Testing may bill the master** — it sends `sandbox: true` to
`/admin/invoices/generate|manual`, an explicit per-request opt-in that nothing
else sends. Its safety half: **`engine:mark-overdue` never disables a master's
account** (the invoice still goes overdue), so a rehearsal left unpaid cannot
stop the house trading. Still deferred: off-session auto-charge.

**Monthly auto-billing (2026-10-01) — 16:00 Thailand time (Asia/Bangkok),
owner's schedule; to move to 09:00 the week of 2026-10-08.** A scheduler in the
ENGINE (`binance_abcd/monthly_invoices.py`) decides only WHEN, four steps at
the same hour:
**1st** refresh every balance (the HWM test reads the LIVE balance +
unrealized), then `POST /api/engine/binance/invoices/monthly {month_year}`
(`EngineInvoiceController`) invoices the month that just ended through
`InvoiceService::generateForAccount` with each user's own rates and emails
"invoice ready"; **2nd / 3rd** `POST …/invoices/remind {stage: gentle|firm}`
emails everyone still unpaid; **4th = the DUE DATE** (`computeForAccount`:
start of next month + 3 days) `POST …/invoices/enforce` marks them overdue,
disables the account and emails "trading paused" (`Billing\OverdueEnforcer`,
shared with the nightly `engine:mark-overdue`, which only pauses invoices due
BEFORE today so it can never pre-empt the 4th's hour). Emails:
`Billing\InvoiceNotifier`, best-effort; the four templates are now `live` in
`EmailCatalogue`. Reminders catch up 12 h only (a reminder after the pause is
wrong); invoice/pause 72 h. Rules:
- **Customers only** (`type = 'user'`), real money (demo 0, not sandbox, not
  `SBXINV-`), connected before the month ended; master/staff never.
- **An account already invoiced for that month is SKIPPED, never
  regenerated** — a re-run must not overwrite a manual fee. Only an ENDED
  month (UTC) is accepted.
- A disconnected account that traded in the month is NOT billed but named in
  the summary ("bill by hand"). Bybit/MEXC are refused until they have a
  `PnlSource`; `INVOICED_EXCHANGES` grows with them.
- State `out/invoice_state.json`; first run after a firing time seeds without
  billing; catch-up 72 h, else a "missed" alert; unreachable API retried every
  10 min, a 4xx is final. The summary (names + $) goes to the admin chat ONLY
  (`notify._send_private` — never the public fallback). Runs only with
  `RUN_POLLERS`. Config `BINANCE_ABCD_MONTHLY_INVOICE_*` (not mirrored —
  defaults are the schedule); `/health` shows `monthly_invoices.next`.
- Due date is the 4th of the following month (`computeForAccount`), and
  the 4th's enforce step pauses unpaid accounts at the billing hour.

**Direct USDT-TRC20 payments — THE rail customers pay on (2026-09-23).**
Customers send USDT straight to a TRON wallet we control; a scheduled poller
reads the public chain and settles the invoice. Built 2026-08-16 as a second
rail beside Coinsbuy; **on 2026-09-23 the owner hid Coinsbuy and made this the
only method a trader is offered.**
- **Coinsbuy is hidden, not removed.** `COINSBUY_ENABLED = false` in
  `components/billing/PaymentMethodModal.tsx` (same shape as
  `CARD_PAYMENTS_ENABLED`) drops the option; the whole provider — keys,
  gateway, signed callback, `InvoiceService::settle` — stays wired on both
  sides, and its ENDPOINT stays live so a deposit opened before the switch can
  still settle. Bringing it back is that one flag.
- **Three env keys make it work, and all three are needed**:
  `TRON_MAINNET_ADDRESS` (the receiving wallet — `enabled` is false without
  it), `TRON_PUBLIC=true` (`visible` = developer OR public; without it a
  customer opening the pay sheet reads "Crypto payments are not configured on
  this server yet"), and `PAYMENTS_DEFAULT_PROVIDER=tron`. The address is
  mirrored by `sync-api-env`; the two switches are rollout state, set ON THE
  BOX by hand and never mirrored.
- **A `developer` account still pays on Nile, not mainnet**
  (`TRON_DEVELOPER_NETWORK=nile`) — that is the rule that stops a test ever
  exposing the real receiving address, so a MAINNET rehearsal means flipping
  that key temporarily rather than testing as a developer and assuming.
- **On prod since 2026-10-02:** `TRON_PUBLIC=true` and
  `PAYMENTS_DEFAULT_PROVIDER=tron` are set on the box (they were missing, so
  only developers saw the rail). `TRON_DEVELOPER_NETWORK` is still `mainnet`
  there from a rehearsal — set it back to `nile` when that is over.

- **Matching is by AMOUNT, not by sender or address.** One shared receiving
  address; a `payment_intents` row reserves the exact figure for an invoice and
  `UNIQUE(network, address, open_units)` makes it impossible for two *open*
  intents to claim the same one (NULLs are distinct in a UNIQUE index on both
  MySQL and SQLite, so it holds in CI too). The sender is useless as a signal:
  most customers pay from an exchange withdrawal, where the on-chain `from` is
  the exchange, not them.
- **The "odd trailing decimals" fingerprint is OFF (`fingerprint_units = 0`) and
  must stay off until measured.** Every major exchange DEDUCTS ITS WITHDRAWAL FEE
  FROM THE AMOUNT THE CUSTOMER TYPES, so a payment arrives short by that fee
  (1 USDT, then 0.2, on Binance TRC-20 at different times) — and a tolerance band
  wide enough to absorb it is ~100,000× wider than sub-cent fingerprint spacing.
  You get one or the other, never both. So: exact invoice amount, an asymmetric
  band (shortfall `max($1.00, 1%)`, overpay 5%), and **settle only when EXACTLY
  ONE open intent matches** — zero or several goes to a human.
- **Only the contract address identifies the token.** `symbol` is
  attacker-controlled (anyone can deploy a "USDT"), and so is `decimals`, where
  a contract reporting 0 would make one base unit look like a dollar. Both are
  stored as reported and never consulted.
- **`TronAddress` is base58check, never a regex.** `^T[1-9A-HJ-NP-Za-km-z]{33}$`
  passes a typo, and a mistyped RECEIVING address loses customers' money silently
  — the watcher just reports zero transfers forever. A test asserts all 1,881
  single-character mutations of the real USDT contract are rejected.
- **`order_by=block_timestamp,asc` in the TronGrid query is load-bearing.**
  TronGrid defaults to `desc`; with descending order plus a page limit, a dust
  flood (free — the address is public) means we fetch the newest page, advance
  the cursor past everything older we never fetched, and skip a real payment
  permanently. The cursor is DERIVED (`MAX(block_timestamp)` over
  `tron_transfers`, minus an overlap), which is why **every transfer is stored,
  including rejected ones** — an early `continue` before the insert would freeze
  it.
- **`payment_intents.network` carries the environment on the DATA**, because
  `PaymentEnvironment::forceSandbox()` is request-scoped and the watcher has no
  request. `PaymentEnvironment::tron($network)` is therefore a pure lookup that
  deliberately ignores `sandboxIsForced()`; `tronNetworkFor(bool $isDeveloper)`
  is the single role-aware call. The watcher scans every configured network,
  Nile included, on prod. **A client-supplied network is never read** — it would
  let a trader settle a real invoice with testnet tokens.
- **Settlement is unchanged**: `InvoiceService::settle($invoice, 'tron', $txid,
  $usd)`, with the invoice's own USD figure rather than the USDT amount
  reinterpreted. `payment_events` needed no schema change (`provider='tron'`,
  `event_id` = a sha256 of the identifying tuple — **not the bare txid, because
  one TRON transaction can carry several TRC-20 transfers**).
- **Scheduling the poller made cron load-bearing for MONEY**, not just the daily
  sweeps: `Schedule::command('payments:watch-tron')->everyMinute()->withoutOverlapping(5)`.
  A dead scheduler now silently stops invoices settling, so `last_scan_at` is
  surfaced per network on the admin screen and on the trader's pay sheet.
- Surface: `POST /payments/tron/intent`, `GET /payments/tron/intent/{invoiceId}`
  (**answers 200 for a paid invoice** — that is the state it exists to observe,
  so it must not reuse `resolveInvoice()`, which 409s), and admin
  `GET|POST /admin/tron-transfers*`. Frontend: `TronPayPanel` inside
  `PaymentMethodModal`, and **Admin → Crypto Transfers** (`/admin/tron-transfers`)
  for the manual attribution a matcher can never do — late payments, wrong
  amounts, duplicates. That screen is permanent, not a stopgap.
- **Still to do:** create a Nile wallet + look up the Nile USDT contract, run the
  end-to-end rehearsal, then set `TRON_MAINNET_ADDRESS`. **Before `TRON_PUBLIC=true`,
  measure a real withdrawal from each exchange customers use** and record how many
  decimals survived and how much fee was deducted — only then decide whether a
  fingerprint is viable. The QR (added 2026-10-02) carries the bare address ONLY,
  never an amount URI (TRON wallet URI support is inconsistent, and a QR that
  silently drops the amount is worse than none under amount matching).
  Off-ramping USDT stays manual, and AML screening on inbound funds becomes ours
  the day this is the default rather than Coinsbuy's.

**Crypto payments are LIVE on prod (2026-08-14).** Coinsbuy production keys, real money.
The one switch that decides it is a URL: `PaymentEnvironment` holds **both** providers on
test credentials until `PAYMENTS_API_URL` is https (`callbacksAreSecure()`), because a live
key with an unreachable callback charges the customer and leaves the invoice pending
forever — which then disables their account through `engine:mark-overdue`. Push the config
with `python .claude/deploy_sinegualcrypto.py sync-api-env` (mirrors `COINSBUY_*` from local
`sinegutrade-api/.env`, writes the prod-only `PAYMENTS_*` URLs, re-runs `config:cache` —
without which a new key stays invisible to every request). The callback URL is sent per
deposit, so nothing needs configuring in the Coinsbuy dashboard except the **outbound IP
allow-list** (2.24.139.176, else 403 / code 2016).

**Card payments — Stripe hosted Checkout (wired 2026-09-30).** Ported from the
mother (`sinegu-api/stripe/create-checkout-session.php` + `webhook.php`), reusing
the SAME Stripe account's keys.
**The two rails are SEPARATE BUTTONS on the invoice page (owner, 2026-10-02):**
`/dashboard/invoices/:id` shows **"Pay with crypto"** (gold) → opens
`PaymentMethodModal`, which is **crypto ONLY** (`SHEET_OFFERS_CARD = false`
there), and **"Pay with Stripe"** (violet, `CARD_BTN` in `InvoiceDetail.tsx`) →
straight to Stripe Checkout. Never put the card back inside the crypto sheet.
`CARD_PAYMENTS_ENABLED` in `lib/paymentRails.ts` is the one kill switch for
every card button. The address window (`TronPayPanel`) has a "Show QR code"
toggle that encodes the bare ADDRESS only — the amount is always typed.
Flow: "Pay with Stripe"
→ `POST /payments/stripe/checkout-session` (amount from the invoice row, a Stripe
Customer per uni_id with `setup_future_usage=off_session` so a later auto-charge
can reuse the card) → redirect to checkout.stripe.com → back to
`/dashboard/invoices/:id?payment=success&session_id=…`, which only POLLS; the
invoice is settled by the signed `checkout.session.completed` webhook
(`StripeWebhookController` → `InvoiceService::settle`), never by the return.
Rules:
- **The button is server-gated on `stripe.enabled`** = a secret key AND a webhook
  secret for the resolved mode. `CARD_PAYMENTS_ENABLED` is only a kill switch. A
  box with no webhook secret therefore shows no card button — a card charged
  with no webhook would leave the invoice pending and `engine:mark-overdue`
  would pause the customer.
- **A webhook secret belongs to an ENDPOINT, not the account.** The mother's
  live `whsec_` is for its own URL and was deliberately NOT copied; the live
  endpoint for `https://pixel-alpha.com/api/payments/stripe/webhook` is owner
  to-do `stripe-register-webhooks`. Locally `STRIPE_WEBHOOK_SECRET_TEST` is the
  Stripe CLI secret (`stripe listen --forward-to 127.0.0.1:8000/api/payments/stripe/webhook`).
  `sync-api-env` mirrors both secret keys and the LIVE webhook secret; the TEST
  webhook secret is per box and never mirrored.
- **The mother's endpoint also receives our events** (one account) and answers
  them 400 (no `broker` metadata). Harmless to both products, noisy in Stripe's
  delivery log; the fix, if wanted, is a separate Stripe account.
- Live keys still need https callbacks (`PaymentEnvironment`).
- **A developer picks test card OR real card** (2026-09-30): `GET /payments/methods`
  gives developers `stripe.modes {test, live}` (each = that mode's secret key AND
  webhook secret), and `POST /payments/stripe/checkout-session` takes
  `mode: test|live` from developers ONLY (default test; a trader's `mode` is
  ignored). `live` merely stops pinning them to test keys — the machine verdict
  still decides, so a dev box answers `STRIPE_LIVE_UNAVAILABLE`. The real-charge
  button goes through ConfirmModal.
- **The webhook verifies against BOTH secrets** (`constructEventAnyMode`), because
  a delivery carries no user and so always resolved to LIVE on prod — a
  developer's test-card payment could never settle there. The price of that is
  the rule in `StripeWebhookController`: **on the live box a `livemode: false`
  event settles only a developer's invoice** (`test_mode_refused` otherwise) —
  `livemode` is inside the signed payload. Same pairing as Coinsbuy's
  sandbox-signed callback. Never drop one half without the other.
- Saved cards / off-session auto-charge are NOT built yet — the Customer and the
  reusable PaymentMethod are captured now so that phase needs no re-entry.

**A `developer` account is the test rig, on every box including prod.**
`PaymentController::applyRoleOverrides` pins that role to the providers' SANDBOX keys
one-way (nothing can force live keys ON), and `VerifyCoinsbuySignature` accepts the
sandbox-signed callback only when its tracking_id resolves to a developer's invoice — so
the full flow (deposit → checkout → real webhook → invoice flips to Paid) is exercisable
against production without money moving. **Locally the callback cannot arrive**: with
`PAYMENTS_PUBLIC_API_URL_DEV` unset the callback URL is `127.0.0.1`, so a local end-to-end
test needs a tunnel (`cloudflared tunnel --url http://127.0.0.1:8000`) in that var. On WAMP
also expect cURL error 60 (`COINSBUY_UNREACHABLE`) until `COINSBUY_CACERT` points at a
cacert.pem.

**Payment failures speak twice — one fault, two audiences.** A trader always gets
the single friendly sentence ("Could not start the crypto payment."); a
`developer` account gets that PLUS a `debug` envelope on the same response —
error code, a hint naming what to check first, the environment verdict, and
`CoinsbuyGateway::diagnostics()` (mode, callback URL, credential PRESENCE
booleans, and an ordered `trace` of every provider step: `token.rejected`,
`wallet.none_active`, `deposit.rejected`, with Coinsbuy's own status/detail).
The gate is the ROLE, not the environment — the interesting failures happen on
the live box, and `PaymentController` is the only place that decides who sees
it, so a trader's response simply has no `debug` key to leak. Rendered by
`components/ui/DevDetails.tsx` (collapsible, copy-to-clipboard) behind
`isDeveloper(user.type)`. **A diagnostic must never become a key leak** — expose
`*_set` booleans, never a credential value; a test asserts the payload contains
no secret. Same rule for any future dev-only error surface.

**Invoice scenario runner** (`SandboxInvoiceController`, **Admin Sandbox → Invoice
Scenarios**). Ten automated cases regression-test the billing rules end to end: each
resets a throwaway account, seeds real `binance_pastpositions`/`binance_transactions`
rows plus open P&L for the month, invoices through `InvoiceService::generateForAccount`
at fixed 20%/6% rates, then asserts the row against hand-derived figures (first invoice,
realized-only, unrealized-only, loss month, below-HWM, recovery, month chaining, deposit
mid-month, regenerate-idempotency, paid-row protection). Endpoints:
`GET|POST /admin/sandbox/invoice-scenarios[/run]`,
`DELETE /admin/sandbox/users/{uniId}/{invoices,scenario-account}`.
**Runs only ever write to a scratch account whose `api_key` starts `SBXINV-`** — real
exchange accounts, trade history and invoices are never touched, which is what makes the
runner safe to point at any user. Add a case by appending to `scenarios()`; expected
figures must be derived by hand from the rules, never copied from the code under test.

**Month strings are parsed with `'!Y-m'`, never `'Y-m'`.** Without the `!`, PHP fills the
missing day from *today*, so `'2026-06'` parsed on the 31st overflows to 2026-07-01 and
the invoice bills the wrong month. The scenario suite catches this.

**Admin access rule:** users whose `user_credentials.type` is `master` or `admin` get an
"Admin Dashboard" button in the trader sidebar footer (above Log out) routing to `/admin`.
`AdminLayout` client-guards the route (logged-in plain users bounce to `/dashboard`); the
role comes from the auth payload (`AuthUser.type`) in the stored session. Client gating is
cosmetic — real enforcement must be added as admin middleware in `sinegutrade-api`.

## Admin Dashboard tabs (2026-09-27)

`/admin` is tabbed via `?tab=` (`pages/admin/AdminDashboard.tsx`, shared
`components/ui/Tabs.tsx`): **Overview** (sub-tabbed via `?view=`, 2026-09-28:
**Platform** — every user combined — and **Needs attention**, the old
Overview, in `insights/AttentionPane.tsx`), **Customers**, **Money**,
**System**. The **Master Account** and **Strategies** tabs were removed at the
owner's request on 2026-09-28; their components (`insights/MasterTab.tsx`,
`insights/StrategiesTab.tsx`) are kept but unmounted, and the Strategies view
lost its "Customers vs master" card for "By exchange" in the same change. Data:
`GET /admin/insights/{overview,customers,money,system,strategies}`
(`AdminInsightsController` → `App\Services\Admin\AdminInsights`, cached 60s,
DB reads only — never an exchange call). Rules:
- **A customer is `type = 'user'`**; staff/master/developer never count, and
  demo, sandbox and `SBXINV-` accounts are never business. Every venue via
  `ExchangeSchema::supported()`.
- `GET /admin/strategies` now reads **every exchange** and takes
  `?scope=master|customers|all` (default all) + `?exchange=`; the tab defaults
  to **master** — the strategy's true result. Stats stay client-side
  (`lib/strategyStats.ts`, `lib/strategyLeaderboard.ts`).
- The funnel's "deposited the minimum" reads `services.engine.min_deposit`
  (`ENGINE_MIN_DEPOSIT`, default 1000) — keep it equal to the engine's
  `BINANCE_ABCD_MIN_DEPOSIT`.
- Skip reasons are shown in plain English via `lib/insightLabels.ts`; a new
  engine reason needs a line there.
- **Overview → Platform** (`insights/PlatformPane.tsx`) pools every account
  into one portfolio: `GET /admin/insights/platform` (money under management,
  P&L today / 7d / month / all, after fees with gross on hover) and
  `/admin/insights/platform/daily-pnl` (a pooled P&L calendar), both taking
  `?scope=all|customers|master`. **LIVE accounts only** (`deleted_at IS
  NULL`), unlike the master's track record: it pairs P&L with capital, and a
  disconnected account's capital is no longer on record. The calendar is
  `UserStatsService::calendarDays` (the same method every per-user calendar
  uses) over the pooled accounts, so a cell's % is the pooled P&L ÷ the
  pooled balance the day started with; its trades carry the owner's `name`.
  The money-under-management card is shared with the Money tab
  (`insights/UnderManagementCard.tsx`).
- **Open positions tab** (`?tab=positions`, 2026-10-01,
  `insights/OpenPositionsTab.tsx` + `components/admin/open-positions/`,
  `AdminOpenPositionsController`): every venue's open rows, a forced fetch
  (`POST /admin/open-positions/refresh` → engine `refresh-positions`; **30 s
  cooldown PLATFORM-WIDE**, `Cache::add`, 429 `REFRESH_COOLDOWN`), and a manual
  close of ticked rows (`POST /admin/open-positions/close`, body
  `{positions: [{exchange, id}]}` — owner/symbol/side are resolved SERVER-side,
  never taken from the client) → engine `POST /admin/close-positions`, which
  runs the normal exit path per (exchange, symbol, side) narrowed to those
  uni_ids, **with `announce=False`** (no public post; admin-chat failures
  only) and waits ≤40 s for per-account results. The engine REFUSES a venue
  that is not live — `_process_trade_job` falls back to every live venue with
  no user filter otherwise. A retry now inherits `announce` only if the run
  owed one. Rows on accounts the engine does not trade (disabled, sandbox,
  disconnected, owner suspended) show why and cannot be ticked. The page
  shows the request and response JSON for testing (folded; opens after a close).
  **Closing is one step** (2026-10-03, `open-positions/ClosePanel.tsx`): pick
  **Everyone / Master only / One user** (searchable by name, account,
  exchange) → **Close all** → ConfirmModal. Every user row and the master view
  also carry their own "Exit all (N)". The client splits anything over 50 into
  sequential batches (the API + engine cap) and one failed batch never stops
  the rest. A position on a venue the engine is NOT trading (read from its
  `/health`, `EngineCache::tradedExchanges`, cached 60 s; engine silent =
  unknown = blocks nothing) is not closable — the engine refuses a whole
  request naming such a venue, so one Bybit row would sink "close everyone".
  **It leads with the MASTER's positions** (owner's request — keep it
  uncluttered); a "Users" view lists every traded account (`accounts`, flat
  ones included — holding nothing while the master is in a trade is the case
  that matters) compared with the master ON THE SAME VENUE by coin + side
  only (`lib/openPositions.ts` `splitByMaster`; sizes scale with balance, so
  size is never a difference). A venue missing from `master_exchanges` reads
  "No master here", not "different".
  Overview's Platform / Needs attention sub-tabs sit at the RIGHT end of the
  dashboard's tab row (portaled into `toolbarSlot`).
- **Pending sign-ups are approved FROM the Overview** (2026-09-28, owner's
  request — they were buried as one line). `OverviewTab` owns the overview
  fetch so Platform shows a "N new users need to be approved" strip (click →
  Needs attention) and the Needs attention tab carries the count as a badge;
  Needs attention opens with `insights/PendingApprovalsCard.tsx` (approve /
  reject through ConfirmModal, first 10, rest on User Management; read-only
  for a collaborator). `resolvePending` forgets the cached `overview` and
  `customers` answers, so an approved user never lingers for the cache minute.

## Email verification on sign-up (2026-10-01)

Register creates the row with `email_verified = false`, signs the user in, and
mails a 6-digit code; `/auth/verify` (`pages/VerifyEmail.tsx`,
`components/auth/CodeInput.tsx` — six boxes, also used by Forgot password)
takes it. API: `App\Services\Auth\EmailVerification` (15-min TTL, 5 attempts,
60 s resend cooldown derived from the expiry — no extra column),
`POST /auth/email/{verify,resend}`. Rules:
- **`EnsureEmailVerified` (`email.verified`) guards every signed-in route**
  except `/auth/me`, `/auth/logout`, `/auth/email/*` → 403 `EMAIL_UNVERIFIED`;
  the client redirects are cosmetic, and only an explicit `false` redirects
  (a session stored before the field existed is not "unverified").
- **The team's "someone registered" notice and the approval queue wait for
  verification** — sent from `EmailVerification::verify`, not `register()`.
  Unverified pending users still appear under User Management's Pending filter
  with an "Email unverified" tag.
- Discord sign-ups whose Discord email is verified skip the code.
- Every pre-existing row was backfilled verified.
- **It depends on prod actually sending mail** (`MAIL_MAILER=smtp`): with `log`,
  no sign-up could ever finish.

## Collaborator role — read-only staff (2026-09-28)

`user_credentials.type = 'collaborator'` opens the admin portal READ-ONLY:
the dashboard Overview, User Management (list + user detail) and Strategies —
nothing else, and no write control anywhere.
- **The API is the enforcement.** `EnsureStaff` / the `staff` route group holds
  exactly the GETs a collaborator may call (insights overview + platform,
  users list/detail/summary/daily-pnl/analytics, strategies reads). **New
  collaborator-visible data = a GET route in the staff group, never widening
  `EnsureAdmin::ROLES`.** `GET /admin/users/{uniId}` omits the fee shares and
  the exchange accounts / key fields for this role, so those are optional in
  `types/admin.ts` and read as `accounts ?? []`.
- **Client twin: `lib/roles.ts`.** `ADMIN_ROLES` / `canSeeAdmin` still mean FULL
  admin (they also gate staff-only exchanges and the calendar edit gesture —
  a collaborator must not get those). `STAFF_ROLES` / `canSeeAdminPortal` admit
  the portal (trader sidebar button, `AdminLayout`); `isCollaborator` hides
  writes; `collaboratorMayOpen(pathname)` is the path allowlist (`/admin`
  exactly, `/admin/users[/*]`, `/admin/strategies[/*]`) — `AdminLayout`
  redirects anything else to `/admin`, and `AdminSidebar` items opt in with
  `collaborator: true`. Keep the two in step.
- What a collaborator does not see: dashboard tabs other than Overview; links
  from Needs attention to forbidden pages (rendered as plain rows); New User,
  approve/reject, the role picker (a `RoleBadge` instead) and key hints on
  Users; the strategy on/off switch; and on user detail the Positions tab plus
  the account cards, invoices, referrals and settings/fees cards — NOT
  RENDERED, so their requests never fire (they would 403).
- **User detail has a "Performance Analytics" tab for all staff** — the shared
  `AnalyticsView` over `GET /admin/users/{uniId}/analytics`, with
  `capture={{ name }}`: every card gets a camera button
  (`components/ui/Capturable.tsx`, `html-to-image`) that downloads it as
  `pixel-alpha-{user}-{card}-{yyyy-mm-dd}.png` with a "Pixel Alpha · {user} ·
  {date}" footer. It forces AOS nodes visible for the capture and retries
  without embedded fonts if the Google Fonts embed fails. The trader's own
  `/dashboard/analytics` passes no `capture` and is unchanged.
- **"P&L card" button on user detail, every staff role** (2026-09-28,
  `components/admin/pnl-card/`, math in `lib/pnlCard.ts`): a shareable PNG
  for Today / This week / This month / All time — chained return %, a return
  curve, win rate, current win streak (all history), W/L, best day. Built
  client-side from the calendar days the page already loads (each day's `pct`
  = P&L over the balance it started with, after fees; UTC days), under the
  page's exchange pill. **It is posted publicly, so: percentages and counts
  only, no name, no dollar figure** — the `/api/public/*` rule. Fixed
  colours, never theme tokens (it is an image, like the invoice document).

## Owner to-do list — Admin → To be Done (`/admin/todo`, 2026-09-21)

**Whenever a feature leaves work only the OWNER can do — register at a third
party, paste a key, run something on prod by hand, or make a product decision —
append an item to `src/lib/adminTodos.ts` in the SAME change.** That page is
where the owner looks; a chat transcript is not. Item shape (`types/adminTodos.ts`):
a stable slug `id` (never renamed once shipped — it is the API's key), the
`feature`, `kind: 'action' | 'decision'`, `title`, `added` (YYYY-MM-DD), `why`
(what stays broken or undecided until it is done), ordered `steps`, the
`envKeys` the steps fill in, and `links`. Rules:
- **Never a secret** — this repo is public. Steps say WHERE a value comes from
  and WHICH env key it goes in, never the value.
- **Items are never marked done in code.** The owner ticks them on the page;
  done-state and the note live in the API's `admin_todo_states` (`GET|PUT
  /admin/todos[/{slug}]`, `AdminTodoController`) so a phone and a laptop agree.
  A `decision` item's note is where the outcome gets written down — read it
  before assuming a decision is still open.
- **Remove an item only when its feature is removed**; a done item stays so the
  note and the date it was settled stay readable. A state row whose slug is
  gone is harmless and simply not rendered.
The list was seeded with the Discord items below and the owner tasks this file
already recorded (TRON Nile wallet / rehearsal / withdrawal-fee measurement,
MEXC funding sign).

## Sign in with Discord + server roles (2026-09-21)

`POST /auth/discord/*` (`DiscordAuthController`), `App\Services\Discord\{DiscordGateway,DiscordRoleSync}`,
frontend `pages/Discord{Start,Callback,Terms}.tsx` + `lib/discordOAuth.ts` +
`components/settings/DiscordCard.tsx`. Hand-rolled OAuth2 (no Socialite): the bot
half needs an HTTP client anyway and the WAMP cacert must apply to every call.
The code is dormant until `DISCORD_CLIENT_ID`/`_SECRET` exist — **the owner
registers the app from Admin → To be Done**; tests fake the gateway
(`tests/Feature/Support/FakeDiscordGateway.php`).
- **Flow.** `/auth` reads `GET /auth/discord/config` (`configured`, `enabled`,
  `authorize_url`) and shows the button only when `enabled`. The SPA mints the
  `state` nonce and keeps it in localStorage (`lib/discordOAuth.ts` — NOT
  sessionStorage, which a phone browser drops when the redirect opens a new
  tab); the callback page strips the query, guards against StrictMode's
  double effect (the code is single-use), consumes the record, and only a
  `state` this browser minted is accepted. **The browser-held nonce IS the CSRF
  defence — there is deliberately no server-side state store** (the API has no
  session; anyone can obtain an issued state). A mismatch is not a dead end:
  "we couldn't confirm this sign-in started here" + a restart button (the
  in-app-browser case). `redirect_uri` is client-sent, checked against the
  `DISCORD_REDIRECT_URIS` allow-list (prod AND localhost:5173, so a local SPA on
  the prod API round-trips) and echoed into the token exchange.
- **Three outcomes from the callback**: known `discord_id` → login (suspended →
  403); email already registered → `password_required` (a 15-min encrypted
  Cache token, ≤5 wrong guesses, login's throttle) — **never auto-linked, verified
  flag or not**: `register()` marks every address verified unchecked and the
  profile lets anyone change theirs, so an attacker registered as your email
  would capture your Discord login and the exchange keys you paste next; the
  account's password is the proof. New → `terms_required`: the row is created
  only after `POST /auth/discord/complete` (Terms mandatory, `?ref=` recalled
  from `lib/referral.ts`, `status = pending` like everyone), `password = NULL`.
- **Discord-only accounts.** `user_credentials.password` is nullable;
  `hasPassword()` drives `DISCORD_ONLY` on password login, `NO_PASSWORD` on
  change-password and on unlink (Discord would be the only way in), and
  `POST /user/password/set` (once, while NULL). Settings swaps Change Password
  for "Set a password" when `has_password === false`. Forgot-password also
  works on such a row. **`discord_id` is a string end to end** (snowflake >
  2^53) and UNIQUE (the race backstop, `DISCORD_TAKEN`).
- **Roles are the point.** `DiscordRoleSync`: Member while `status = active`,
  Trader while `hasLiveExchangeAccount()` (demo = 0), both off on suspended;
  an empty role id switches that rule off and the bot never touches a role it
  was not given. Synced **explicitly** (never an observer — it would fire
  inside transactions) after `resolvePending`, `AdminUserController::update`
  (status change only), `ExchangeAccountController::store/destroy`,
  `AdminApiKeyController::destroy/purge/bulkDestroy` (one sync per owner) and
  `exchange:disconnect-blocked-keys`; nightly `discord:sync-roles` (00:40,
  stops after 3 consecutive non-answers — 401/403 count toward Discord's
  Cloudflare ban). Best-effort like `EngineCache`: a Discord outage never fails
  a login, approval or connect (a test asserts it). **The user's OAuth token is
  never stored**: the guild join happens at login/complete with the token in
  hand; the nightly pass is bot-only and skips non-members (404/10007).
- **Discord facts encoded in `DiscordGateway`**: form-encoded token exchange
  with client id/secret as fields; `/users/@me` `email`/`verified` need the
  `email` scope; Add Guild Member → 201 added / 204 already there (roles in that
  body apply on 201 only, so roles are always reconciled separately);
  `Authorization: Bot …` AND a `DiscordBot (url, version)` User-Agent or
  Cloudflare blocks it. Bot invite permissions `268435457` (Create Invite +
  Manage Roles); its role must sit ABOVE the ones it assigns; Membership
  Screening off. No secret ever appears in a response (test); `diagnostics()`
  is presence booleans.
- **Rollout.** `DISCORD_LOGIN_PUBLIC=false` only hides the button — the flow is
  reachable at `/auth/discord/start` (a developer rehearses on prod; an early
  sign-up merely lands in the pending queue, so it is a rollout switch, not a
  gate). `sync-api-env` mirrors `DISCORD_CLIENT_ID/SECRET/REDIRECT_URIS/BOT_TOKEN/
  GUILD_ID/ROLE_MEMBER_ID/ROLE_TRADER_ID`; `LOGIN_PUBLIC` (rollout) and `CACERT`
  (box) are deliberately not mirrored. A faked `ConnectionException` crashes
  PHP natively on the WAMP box, so that one gateway test skips on Windows.

## Related projects (context only — do not modify unless asked)

**NEVER add or touch code in `sinegu-api`, `sinequal-dash-fusion-main`,
`C:\Users\Xlythe\trading-flask`, or `C:\Users\Xlythe\binance-flask`.** They are
read-only reference material, consulted only when explicitly prompted.

| Path | Role |
|---|---|
| `C:\Users\Xlythe\sinequal-dash-fusion-main` | **Mother project.** Use only as context/reference when prompted. |
| `C:\wamp64\www\sinegu-api` | **Mother API.** Consult ONLY when explicitly prompted — it is legacy spaghetti code. Never use it as the sole reference or copy its architecture; at most a lookup for domain facts (field names, business rules). |
| `C:\wamp64\www\sinegutrade-api` | **This project's API** (Laravel + Sanctum, DB `sinegu_crypto`). Live: auth, profile/password, dashboard summary, binance positions/past-positions, invoices, referrals, the public `/api/public/track-record` feed, and the engine's `/api/engine/*` surface. All three venues' tables exist (`binance_*`, `mexc_*`, `bybit_*`). |
| `C:\Users\Xlythe\trading-flask` | **Original multi-exchange bot — READ-ONLY.** Reference for env-driven config, tests, and the per-exchange service split. Never edit it, not even its `.env`. |
| `C:\Users\Xlythe\binance-flask` | **Mature bot reference — READ-ONLY.** The runtime pattern the in-repo engine was modeled on (fast-ACK dispatch + account pools, retry queue, billing gate via `enabled=0`). Consult only; never edit. |

## `trading-flask/` — the BINANCE_ABCD engine (in this repo)

**This repo holds two codebases**: the React frontend at the root and the Python
trading engine in `trading-flask/` (package `binance_abcd/` — freshly written for
this product; NOT a copy of the read-only reference projects above, and not the
old vendored snapshot either, which remains recoverable at commit `2e6e884`).

- **What it does:** TradingView posts to `POST /binance_abcd_webhook` or
  `POST /mexc_abcd_webhook` (port 5010) — **one path per venue, the path decides
  which exchange's accounts trade**; the webhook fast-ACKs (~2 ms) and a bounded
  worker pool fans the signal out to every tradeable account on that venue. Pollers push balances/positions/past-positions/
  transfers back into `sinegu_crypto`. Full docs in `trading-flask/README.md`.
- **Signal log:** every processed signal appends one row to the unified
  `trade_logs` table (exchange discriminator, same pattern as `invoices`) via
  `POST /api/engine/{exchange}/trade-logs`. The `details` JSON holds the
  per-account fan-out, and each **entry** detail carries a `sizing` block —
  `balance`, `total_deposit`, `min_deposit`, `base_size`, `reference_balance`,
  `coarse_step`, `quantity`, `size_multiple`, `stacks_now`, `max_increments`.
  plus `max_size` (the raw column) alongside the derived `max_increments`.
  A deposit-gated skip writes a **partial** block (deposit fields + balance
  only, no `base_size`/`quantity`) — readers must not assume a full block.
  Recording the sizing
  **inputs** (not just the resulting quantity) is the point: a size, or a
  "maxed sizing" / "size too small" skip, must be explainable from the row
  alone without replaying the account's balance at signal time. Read it at
  **Admin → Signal Log** (`/admin/trade-logs`, `AdminTradeLogController`,
  read-only — the engine is the only writer). Also mirrored to the local
  JSONL `trading-flask/out/webhook_trades.log`.
- **Backend surface:** `sinegutrade-api`'s `/api/engine/{exchange}/*` routes
  (`EngineController`, `EngineSyncController`, `VerifyEngineSecret` middleware,
  `X-Engine-Secret` header). Who may trade is decided THERE: accounts endpoint
  filters enabled + non-sandbox + non-suspended owners; `php artisan
  engine:mark-overdue` (scheduled daily) disables accounts with past-due
  invoices; `InvoiceService::settle` re-enables on payment. `{exchange}` is
  resolved to its own four tables by `App\Services\Exchanges\ExchangeSchema`
  (all three since 2026-09-24) — the ONE map from an exchange name to
  `{x}_accounts/positions/pastpositions/transactions`, its asset broker label
  and its taker fee rate. `BinanceAccount`, `MexcAccount` and `BybitAccount`
  share the abstract `ExchangeAccount`. Adding a venue is one REGISTRY entry
  plus its four migrations; no controller changes.
- **Exchanges (2026-09-16): one process, one WEBHOOK PATH PER VENUE, every
  venue in `BINANCE_ABCD_EXCHANGES`** (CSV, default `binance`; add `mexc` or
  `bybit` to turn those on — deliberately NOT mirrored to prod by the deploy
  script, because enabling a venue for customers is a decision made on the box.
  Prod has had MEXC on since 2026-09-17. **Bybit's CODE has been on prod since
  2026-09-24 but the venue is OFF** — the adapter, the four tables and the
  nginx route are all live, and adding `bybit` to this CSV on the box is the
  only thing between that and trading).
  `hooks.WEBHOOK_PATHS` maps `binance → /binance_abcd_webhook`,
  `mexc → /mexc_abcd_webhook`, `bybit → /bybit_abcd_webhook`; the path a
  TradingView alert posts to is what decides which exchange's accounts the
  signal trades, so each venue has its own alert(s) and a payload `exchanges`
  field is accepted only when it agrees with the path (a disabled venue's
  path answers 400 after the secret gate). nginx proxies exactly those paths
  (`ENGINE_WEBHOOK_PATHS` in the deploy script — adding a venue means adding it
  there too, or nginx 404s it before the engine sees it). The job resolves
  that venue's `assets` row (by `assets.broker`), its accounts and its
  `positions/check`, every write routed back to `/engine/{account.exchange}/…`,
  one `trade_logs` row per venue, one Telegram message labelled with the venue. The core
  (`trading_handler`, the fan-out, the pollers) speaks ONE vocabulary —
  tickers, **coins**, LONG/SHORT with SHORT negative, `None` = failed read —
  through the `ExchangeClient` protocol (`exchange_api.py`);
  `exchanges.client_for(account)` picks `BinanceAdapter` (over the untouched
  `BinanceAPI`) or `MexcAdapter` (over `mexc_api.MexcFuturesAPI`). Retries
  are keyed `{exchange: uni_ids}` so a user with accounts on both venues is
  only replayed where it failed. MEXC rules that live in the adapter: sizes
  are CONTRACTS on the wire (`coins_to_vol`: ÷ `contractSize`, floor to
  `volScale`, refuse < `minVol`; × back on every read); leverage goes ON the
  order (a stacked entry reuses the position's own leverage/openType/
  positionId — 7004 otherwise; a fresh one takes the signal's, then the
  account's setting, then `MEXC_DEFAULT_LEVERAGE`, else refused); business
  errors are HTTP 200 + `success:false`, judged by code (510/2037 rate limit,
  604/801 maintenance = rejection, 401/402/406/602/701–704 credential →
  `key_status` on `/engine/mexc/key-status`); **`demo=1` routes to MEXC's futures
  testnet** (`futures.testnet.mexc.com`, `MEXC_TESTNET_API_BASE`) — same
  login and same API keys as live, 10,000 test USDT; learned live 2026-09-17
  that it authenticates a production key as-is and, sitting behind a CDN,
  refuses any IP-BOUND key with 406, so a demo key is created without "Link
  IP address". Closes + fee receipts come from `fetch_mexc_history` (history_orders
  → order_deals → funding_records, own watermarks). **Verified end to end on
  2026-09-17** with a real key on that testnet (one 0.01 BTC round trip, see
  `mexc_smoke.py`'s docstring): entry with leverage on the order, exit via
  side 4 + positionId, deal `profit` is GROSS (`DEAL_PROFIT_IS_NET=False` is
  right — the netted P&L matched the account balance to the cent), both fills
  shipped as receipts and rebased the close to `fee_source=actual` on the
  next tick, `start_time`/`end_time` honoured. The one fact still not seen
  live is the SIGN of `funding_records.funding` (no settlement fell inside
  the test position's lifetime) — check the first MEXC position held across
  00/08/16 UTC against the app before trusting a funded row's fee.
  **Where `mexc_*` is read (2026-09-18):** every per-user read goes through
  `UserStatsService` and spans every exchange or the one `?exchange=` names —
  the trader dashboard / analytics / positions / calendar, AND the admin
  user-detail page (`AdminUserController`, whose exchange pill is the DATA
  SCOPE of summary, calendar, positions and invoices, not a client filter).
  Admin → API Keys, Engine → key issues and User Management list every
  exchange's accounts. Still Binance-only: Admin → Trading Positions
  (`AdminController::positions` and its edit/delete routes) and the master
  stats card. **`bybit_*` is read through exactly the same paths** — it needed
  no reader changes at all, because every one of them goes through
  `ExchangeSchema::supported()`.
- **Bybit is the third venue (2026-09-24), shipped DARK.** `bybit_api.py` +
  `bybit_adapter.py` + `fetch_bybit_history.py`, `/bybit_abcd_webhook`, the
  four `bybit_*` tables and one `ExchangeSchema` entry — but `bybit` is NOT in
  `BINANCE_ABCD_EXCHANGES` and that key is not deploy-mirrored, so prod does
  not trade it until someone types it on the box. It is closer to Binance than
  to MEXC (leverage POSTed, sizes already in base coins, a real
  `trade_permission()` from `/v5/user/query-api`), so roughly half of the MEXC
  client has no counterpart. The facts worth knowing before touching it:
  - **V5 signing is a THIRD scheme**: `timestamp + api_key + recv_window +
    (queryString | rawBody)`, and the query string is signed **unsorted, in URL
    order** — `mexc_api._param_string` sorts, so it must not be reused.
    `recv_window` is MILLISECONDS here and SECONDS on MEXC (hence
    `BYBIT_RECV_WINDOW_MS`); copying MEXC's 20 asks for a 20 ms window.
  - **`positionIdx` is READ off the account's own rows, never configured.** A
    UNIFIED account may not support hedge mode on `category=linear` at all, so
    `position_map` keys LONG/SHORT in EITHER mode (a one-way `side: "Buy"` row
    IS a long) and a refused `switch-mode` is logged rather than failing the
    venue. Keying "BOTH" would make every exit read "no position to close" —
    positions would open and never close. A test pins it.
  - **`/v5/position/list` for linear needs `symbol` or `settleCoin`.** A bare
    `category=linear` is refused; folding that refusal into `[]` is the
    empty-vs-unavailable conflation that deleted live positions on 2026-08-18.
  - **`retCode == 0` means ACCEPTED, not filled.** Bybit converts a market
    order to an IOC limit inside a slippage band, so an order can end
    `Cancelled` having filled nothing — `fill_summary_once` therefore probes
    the order and returns `(None, None)` on a dead one instead of exhausting
    the retry budget and publishing a close with no PnL line.
  - **`110043` / `110025` ("not modified") are successes**, handled in the
    transport so no later call site can forget it.
  - **Funding receipts are NOT sign-flipped.** Binance income and MEXC
    `funding_records` report what the account RECEIVED (negative = paid) and
    are negated; Bybit reports funding as an execution FEE, already what was
    paid. Flipping it would invert every funding charge on the venue.
  - **Transfers come from `/v5/account/transaction-log` TRANSFER_IN/OUT**, not
    `/v5/asset/*`: deposit records are movements into the Bybit ACCOUNT, so a
    customer whose funds sit in the Funding wallet would pass the deposit gate
    and trade against a zero balance.
  - **`exchange_fee_receipts.ref` became a string for Bybit.** Its `execId` is
    a UUID and is the only per-execution id it publishes (`orderId` cannot
    serve — one order yields several executions, and the unique key is what
    makes re-sent pages harmless). Hashing it was rejected: a ref nobody can
    paste back into Bybit's UI defeats the one question that table answers.
  - **STILL UNVERIFIED, and it gates real money:** whether
    `/v5/position/closed-pnl`'s `closedPnl` is gross or net of fees
    (`bybit_adapter.CLOSED_PNL_IS_NET`, the `DEAL_PROFIT_IS_NET` twin). The
    engine posts GROSS and the API nets once on ingest, so a wrong answer nets
    twice. `closed_gross_pnl` prefers `cumExitValue - cumEntryValue` — gross by
    definition — so a wrong switch degrades to a fallback rather than to wrong
    money, but the demo round trip is what settles it. Owner to-do
    `bybit-demo-round-trip`.
  - **Demo is Demo Trading (`api-demo.bybit.com`), NOT testnet.bybit.com** —
    the same bybit.com login but keys minted in its own module, not
    interchangeable with live ones in either direction.
- **Cache freshness is PUSHED, never polled — and the engine is never
  restarted for a data change.** The engine TTL-caches its account and asset
  lists (90 s, `binance_abcd/cache.py`); Laravel's `App\Services\EngineCache`
  POSTs `/admin/refresh-accounts|assets` on `127.0.0.1:5010` from every write
  that changes what may be traded — connect/disconnect an account,
  `InvoiceService::settle` (after COMMIT, never inside the transaction),
  `engine:mark-overdue` (only when it actually disabled something), and every
  `AssetController` write (base_size, max_increments, side, enabled). That is
  **invalidation, not a fetch**: the engine drops the list and reloads it
  lazily on the next signal or poller tick, in ONE call for all accounts — so a
  hundred users connecting at once costs a hundred sub-millisecond local pings
  and zero extra Binance calls, where a shorter TTL would spend requests on
  every quiet minute instead. Best-effort by design: a failed ping is logged
  and swallowed (the TTL is the safety net) so a dead engine can never make
  "Connect Binance" fail. `/admin/*` is bound to localhost — nginx proxies only
  `/binance_abcd_webhook`.
- **Blocked API keys** (`binance_abcd/key_status.py`). Binance `-2015`
  ("Invalid API-key, IP, or permissions") is what a key restricted to the
  user's own IP says when OUR server uses it, and it is silent: the account
  reads "connected", its balance freezes, no trades arrive. The engine reports
  the verdict to `POST /api/engine/{exchange}/key-status`, which sets
  `binance_accounts.key_status` + `key_blocked_at` (columns, not a new table —
  it is one current state per account, and the engine's account list is the
  hottest read in the system). Rules that make it recoverable:
  - **Only an exchange error code flags a key** (-2015/-2014/-2008/-1022) —
    never a timeout, 5xx or rate limit, which say nothing about the key.
  - **A success clears only what it PROVES** (2026-09-23). A signed GET proves
    the key READS; only a successful signed WRITE proves it may TRADE, and
    those are two separate permissions on every venue. So every verdict carries
    a `scope` (`key_status.READ` / `.TRADE`): a read success clears a block
    raised on a read — which is still how a user who allow-lists our IP
    un-flags themselves — and never one raised by a refused order.
    `_request_get(..., account_scoped=False)` exists so a public call
    (exchangeInfo) can never clear a flag at all.
    **Until then any success cleared everything**, and a real customer key with
    Reading enabled and Futures NOT enabled therefore FLAPPED: flagged by the
    refused order, cleared by the next poller tick ~90s later, so
    `key_status` sat at `ok` with a live balance while the account took no
    trades for a day and the modal never fired. `test_key_status.py` pins it.
  - **-2015 is sharpened by what we already know.** Binance answers it for
    three different faults (dead key / IP not allow-listed / permission
    missing). When a signed read has succeeded on the same key the IP is
    demonstrably allowed and the key demonstrably exists, so a refused WRITE
    can only be the futures permission — reported as `TRADE_PERMISSION`
    (`key_status._AMBIGUOUS`), which is the reading the customer can act on.
    Without that proof it stays the ambiguous `IP_OR_PERMISSION`, whose
    instructions cover both; naming the wrong fix sends someone to edit a
    permission that was never the problem. Reads failing later downgrades it
    back. MEXC needs no entry — 406 (IP), 402 (expired) and 701–704
    (permissions) each name their own fault.
  - **"Recheck" asks the venue what the key is ALLOWED to do**, not just for a
    balance. `BinanceAdapter.trade_permission()` reads
    `GET /sapi/v1/account/apiRestrictions` (`enableFutures`) — a SPOT-host call
    needing only the Reading permission, so it answers for exactly the key that
    cannot trade. Without it the button would read the balance, succeed, and
    report a fixed key that still cannot place an order — reading being
    precisely what the broken key can do. It runs on a targeted
    `refresh-balances` (the trader's and the admin's recheck button) **and on
    every poll of an already-FLAGGED account**, never on a healthy one's: on a
    healthy account it would be one extra call per account per tick to
    re-answer a question that changes only when a human edits a key, while on a
    flagged one it is the ONLY path back. **A trade verdict cannot clear
    itself** — entries are skipped while blocked and a flat account has no exit
    to try — so without the re-probe a customer who fixed their key would stay
    frozen until the 3-day deadline disconnected them. Same rule as "the
    pollers keep probing them", applied to the verdict a read cannot settle.
    MEXC returns `None` (no such endpoint, and its codes already name the
    permission); `None` always leaves the standing verdict alone.
  - **Blocked accounts stay in `GET /accounts`**, flagged `key_blocked`. The
    fan-out skips them on ENTRY only (exits still try — an open position must
    be closable, and a successful exit clears the flag); the pollers keep
    probing them, which is the only way recovery is ever detected. Filtering
    them out server-side would freeze them as broken and then disconnect them.
  - **`key_blocked_at` is set once, on the transition**, never refreshed by a
    repeat report, so the 3-day deadline cannot drift forever.
  - After `BinanceAccount::KEY_GRACE_DAYS` (3), `exchange:disconnect-blocked-keys`
    (scheduled daily) soft-deletes the account — which is what frees the
    one-account-per-user slot so they can connect a new key.
  - **Reconnecting a key you disconnected REVIVES that row** rather than
    failing "This API key is already connected". `api_key` and `name` carry
    table-wide UNIQUE indexes (not partial — MySQL has none), so a soft-deleted
    row holds those credentials forever and is the only row they can live in;
    without the revive, disconnecting locked the owner out of their own key,
    which is exactly the path a blocked-key recovery walks. `storeBinance`
    clears the stale key verdict (`key_status`/`key_error_*`/`key_blocked_at`)
    because the old refusal says nothing about the key being pasted now, and
    **deliberately keeps `balance`, `initial_deposit` and the invoice HWM** —
    same account, same deposits, and a disconnect/reconnect must not be a way
    to reset the high-water mark. Another user's disconnected row is never
    revived (`API_KEY_TAKEN`): it carries their trade history.
  UI: `KeyBlockedModal` (the IP to allow-list, copyable, plus recheck /
  disconnect) raised on the dashboard by `KeyBlockedGate` and from a red strip
  on the exchange card. "Recheck" is the balance-refresh call — a real exchange
  round trip is what settles the verdict. The IP comes from
  `config('services.engine.public_ip')`, never hardcoded in the frontend.
  **The modal names ONE of three faults** (`keyFault()` in `exchangeCopy.ts`,
  read off `key_error_reason`): `dead` (replace the key), `tradePermission`
  (the key reads but may not trade — the permission gets its own highlighted
  card beside the IP, because "tick Enable Futures" buried as step 3 is the
  instruction people skim past) and `ip` as the fallback, since that is what an
  unnamed credential refusal has always meant and its steps cover both. The
  wording per fault per venue is data in `EXCHANGE_COPY[kind].blocked`.
  **The admin Telegram alert carries the fix too** (`notify._credential_fixes`
  → `key_status.fix_for`): Binance's own sentence names three possible faults
  and no remedy, and whoever reads the alert has to answer a customer. One line
  per distinct fault, and an ordinary order rejection (balance short, bad size)
  gets no key advice at all.

**Admin → API Keys** (`/admin/api-keys`, `AdminApiKeyController`) is the whole
inventory: every `{exchange}_accounts` row (Binance and MEXC, via
`ExchangeSchema::supported()`) with its owner, soft-deleted ones included,
filtered by Connected / Faulty / Disabled / Disconnected and by exchange.
**Ids repeat across the per-exchange tables**, so every row carries
`exchange`, every write is `/admin/api-keys/{exchange}/{id}` (same rule as
the trader's `/exchange/{exchange}/accounts/{id}`), bulk-delete takes
`{exchange, id}` pairs, the engine recheck is
`/admin/engine/key-issues/{exchange}/{id}/recheck`, and the purge guard's
invoice count is narrowed to the row's exchange — a Binance invoice on
`account_id = 3` must not shield MEXC account 3. Three rules make it a support
screen rather than a liability:
- **Rows carry `api_key_hint` (first 6 + last 4) and never `secret_key`** — a
  test asserts the full key does not appear in the response. Editing is limited
  to the display name and `enabled`; re-keying stays in the owner's connect
  flow, and `demo` (testnet-vs-real orders) is not a two-click toggle.
- **Delete is the same soft disconnect** the trader and
  `exchange:disconnect-blocked-keys` perform, so positions and invoices (joined
  on `api_key`) survive and the user's one-account slot is freed. There is no
  hard delete.
- **Bulk delete takes explicit ids from the client**, never a server-side
  "everything currently faulty" — the engine can flag another account between
  the page loading and the button being pressed, and what gets disconnected must
  be exactly what the admin saw. Already-deleted ids are skipped, not errors.
- **Permanent delete** (`DELETE /admin/api-keys/{id}/purge`) is the one hard
  delete, and the only way a stored credential leaves the DB. Two gates, both
  re-evaluated server-side rather than trusted from the row the admin was
  looking at: the key must be **not working** (refused by the exchange, or
  already disconnected) — a healthy account is someone's live setup — and it
  must have **no invoices**, because an invoice whose account row vanished
  cannot be explained to whoever paid it. Closed trades do not block it; they
  cascade, and the confirmation states the exact row counts (`usage` on every
  listing row) instead of saying "cannot be undone".
Faulty rows sort to the top of every filter, carry the exchange's own error
text, and are counted on the stat cards — the fault is meant to be visible
without picking a filter first.
Listing reads only columns the engine wrote, so opening the page costs nothing
at Binance; "Recheck" is the one action that spends an exchange call.

**Admin → Trading Positions** (`/admin/positions`) lists every open position and
closed trade across all accounts, in two views the admin switches between:
**Combined** merges same account + ticker into one line with a count pill, and
**Per row** shows every DB row with its own id, side and size. Search is
multi-term over account name/id, row id, ticker, exchange and strategy
(`lib/adminPositionRows.ts`, pure), beside per-user / ticker / exchange facets.
Rules:
- **Per row is the DEFAULT, and Past Positions are never merged** (owner,
  2026-10-03) — the Combined switch exists on Active Positions only.
- **Each open position has a Close button** (per-row view only): ConfirmModal →
  `POST /admin/open-positions/close` with `{exchange: 'binance', id}` — the same
  engine exit path as Admin Dashboard → Open positions, no public post. A
  refused row shows the API's `blocked[].reason`. Binance-only like the rest of
  this page.
- **Editing writes ONE row, so it exists only in the per-row view** — the button
  is disabled on a merged line, which has no single target. Delete still works
  on both (a merged line deletes its whole `ids` list).
- **`api_key` / `uni_id` are not editable** through `PUT /admin/positions/{id}`
  or `/admin/past-positions/{id}`. They join a row to its account's invoices and
  to the published track record, so a mis-owned row is deleted and re-synced,
  never moved to another user. A test asserts they are ignored in the payload.
- **The two kinds of edit are not the same act.** An open position is replaced
  by the poller on that account's next sync (full replace per `api_key`), so
  editing it corrects the display for a minute; a closed trade is permanent and
  its `realized_pnl` / `closed_at` are read by invoicing and the public track
  record. The modal says which, and the confirm step reads back the exact
  before → after of every changed field.
- **The filter toolbar sits OUTSIDE the re-keyed animated region.** That key
  replays the reveal on filter change by remounting — with the search box
  inside it, every keystroke unmounted the input and dropped focus.

The **same editor is reachable from the Daily P&L Calendar** on the trader
dashboard (`DailyPnlCalendar` → `DayTradesModal`) for admin/master/developer
accounts, gated on `canSeeAdmin` — the client twin of `EnsureAdmin::ROLES`.
The icons live on a TRADE inside the day's popup, never on a calendar cell: a
cell is a whole day, and edit/delete address one `binance_pastpositions` row.
**They are hidden even for those roles, and unlock only by tapping a trade's
ticker label 8 times within 3 seconds** (`hooks/useTapUnlock.ts`, constants in
`DayTradesModal`) — an easter egg, requested 2026-09-11 so the master's own
dashboard never shows a delete button on a permanent row. The unlock lives as
long as the popup: closing it or switching day re-locks. The role gate is
unchanged (`canManage` only makes the gesture live), and the server-side
admin middleware is still the real enforcement.
`UserStatsService::dailyPnlDays` therefore returns `id` and `exit_price` (a row
the editor cannot name is a row it cannot correct); the write is still
`/admin/past-positions/{id}` behind the admin middleware. `PositionEditModal`
is portaled into `<body>` because both callers sit inside `data-aos` cards, and
AOS animates with `transform` — which would make the card the containing block
for the overlay's `position: fixed` and trap it inside.
- **A failed Binance read is NEVER stored or acted on as "nothing there."**
  `get_positions_v3` / `get_user_trades` return **`None` on a failed request**
  and `[]` only for a genuinely flat account / an order with no fills yet.
  Until 2026-08-19 both answered `[]` either way, and one prod incident
  (2026-08-18, four hours of `-1007` timeouts on `demo-fapi`) produced three
  symptoms from that single conflation:
  - `positions/sync` is a **full replace per `api_key`**, so a failed read sent
    as "flat" **deleted live positions from the DB**. The stack cap counts open
    size from exactly those rows, so it read 0 open and **stopped firing** —
    LTCUSDT took three entries with the engine believing each was the first.
    The poller now **skips** an account it could not read (rows go stale for one
    cycle, which the next tick fixes); a real close still syncs `[]`.
  - The published `Increment (1/3)` was stuck at 1 for the same reason — the
    Telegram line and the cap read the same number, so a wrong line is the
    visible half of a cap that is not enforcing.
  - `get_order_fill_summary` saw an empty `userTrades` and reported no PnL, so
    the close message shipped with neither `Exit Price:` nor `PnL:`. It now
    **retries** (`FILL_SUMMARY_ATTEMPTS`/`_RETRY_SECONDS`, worst case under
    `TELEGRAM_PNL_WAIT_SECONDS`) on its own `BOOKKEEPING_WORKERS` pool, so a
    sleeping retry can never hold a fan-out worker the next signal needs.
    The DB self-heals either way (the past-positions poller backfills the
    NULLs); the Telegram message is sent once and never edited, which is why
    the retry belongs on the close path and not only in the poller.
  Apply the same rule to any new exchange adapter: **empty and unavailable are
  different answers**, and only one of them may be written to the DB.
- **An unconfirmed close is retried; a rejected one is escalated** (2026-08-28,
  after a `408`/`-1007` on `demo-fapi` announced "EXIT FAILED — MANUAL ACTION
  REQUIRED" for two accounts the retry queue was already fixing). One verdict
  drives both halves: `_request_post` stamps `transient` (no response at all,
  408, or 5xx — the request failed on the way) versus a rejection (`-1111`,
  `-2019`, position-mode mismatch — an answer that repeats identically).
  - `handle_exit` re-attempts a transient failure in the fan-out worker
    (`EXIT_RETRY_ATTEMPTS`, default 2) before the queue's 60s, because 60s is a
    long time to hold a position the strategy has exited. Safe only because
    **every attempt re-reads `positionRisk` first** — a 408'd order may be on
    the book, and a flat side is how the engine learns it landed. Keep that
    read; without it this is a double-close.
  - **Exits retry, entries do not.** A close re-reads; an entry replayed on an
    unknown execution status is one signal becoming two positions. Entries stay
    retryable on a rate-limit backoff alone, which fails fast before any order.
  - **Red is reserved for "nobody is coming".** A transient failure alerts
    amber (⏳ RETRYING, sent AFTER the enqueue so it can say so); the red
    MANUAL ACTION alert fires only on a rejection or from `retry_queue._requeue`
    when the attempts run out — which until then was a log line nobody reads.
    Alerts quote Binance's own code+msg (`error_summary`), since "408 Client
    Error" does not say *execution status unknown*.
  - **A retried exit still reaches the channel.** `_process_trade_job(...,
    announce=)` carries the right to publish: a retry inherits it only when the
    live run filled nothing, and the queue clears it once any run fills. One
    close, one message.
- **Poller weight is not evenly spread.** Per account per tick, balances /
  positions / transfers cost weight 5; past-positions (`/fapi/v1/income`) costs
  **30**. Against Binance's 2400/min per-IP ceiling that one loop is ~95% of the
  budget and decides how many accounts the platform carries — which is why
  `PAST_POSITIONS_FETCH_INTERVAL` is **180s, not 60s**, and why it is the first
  interval to raise. Balances at 300s are ~3%; leave them. **Caching cannot
  help**: `/fapi/v3/account` is signed per account key, so no two accounts can
  share a response. What they share is the IP's weight budget, so the only
  levers are interval and spread (`POLLER_START_STAGGER_SECONDS`).
- **Live orders:** accounts with `demo=1` route to the Binance futures testnet;
  everything else is REAL. Entries fail closed on unconfigured assets.
- **Sizing & the deposit gate** (`_scale_qty` + `_deposit_gate` in
  `routes/webhook.py`). Two independent rules, both entry-only — **exits are
  never gated, so an open position is always closable**:
  1. **Deposit gate** — an account may only OPEN a position once its
     `total_deposit` (deposited capital net of withdrawals) reaches
     `BINANCE_ABCD_MIN_DEPOSIT` (1000). Gated on **deposit, not balance**: an
     account funded above the minimum keeps trading after a drawdown well
     below it. An unknown deposit **fails closed** (skip reason
     `deposit unknown`). Set to 0 to disable.
  2. **Size** — `BINANCE_ABCD_REFERENCE_BALANCE` (1000) is the balance earning
     one `base_size`. Below it every account still gets exactly one
     `base_size`; above it BTCUSDT (`COARSE_STEP_TICKERS`) steps in whole
     multiples per reference block, everything else in tenths, floored.
  3. **Stack cap** — how many entries may stack in one open position, counted
     in THIS ACCOUNT'S entry size: `stacks_now = open_amount / quantity`,
     refused when `stacks_now + 1 > max_increments`. Per symbol AND side, so a
     long stack never limits a short. Dividing by the raw `base_size` instead
     (as it did until 2026-08-05) made the cap one fixed absolute size for
     every account, so anything from ~3× the reference balance up filled it
     with its first entry and could never add — the cap has to scale with the
     size it is capping.
     **The `assets.max_increments` COLUMN is a max position SIZE, not a count**
     — the name is inherited from the mother schema, whose migration comments
     it "Max position size", and `binance-flask` reads it the same way. The
     count is DERIVED once, in `assets_api._increment_cap`:
     `max_increments = max(1, round(max_size / base_size))`, and everything
     downstream sees `max_size` (units) and `max_increments` (entries) as two
     separate keys. Until 2026-08-13 the engine read the column as a count, so
     LTCUSDT's `42` (= 3 stacks of 14) meant "42 entries" and **the cap never
     fired** — an account reached a 4th increment against an intended max of 3,
     and the Telegram line read `Increment (4/42)`. The count is
     balance-independent by design (it is a property of the asset); only the
     size each account trades scales with its balance, which is what makes one
     cap correct for a 500 and a 50,000 USDT account alike.
  `total_deposit` comes from `GET /api/engine/{exchange}/accounts` as
  `initial_deposit + (deposits − withdrawals)` over `binance_transactions` —
  **not** raw `initial_deposit`, which `EngineSyncController` writes once and
  never updates, so top-ups would otherwise never count. Same figure invoicing
  bills against (`BinancePnlSource::adjustedDeposit`).
- **Telegram:** every signal is announced to the channel **Voltrax Trades**
  (`t.me/voltraxtrades`, id `-1003995568293`) — entries, exits, realized PnL,
  plus ops alerts. `binance_abcd/notify.py`; config is `BINANCE_ABCD_TELEGRAM_*`
  and the bot token lives in the gitignored `.env` only. Off unless both a token
  and a chat id are set; `tests/conftest.py` forces it off so the suite never posts.
  **The public channel publishes no account counts** — an entry is
  side + ticker, `Increment (2/3)`, and the executed price; an exit is
  side + ticker, price, and the PnL percent.
  **That exit percentage is AFTER exchange fees (2026-09-23).** The venue
  reports `realizedPnl` GROSS, so until then the channel was the one surface
  claiming a bigger profit than the customer received, and the daily recap
  could never add up to the closes it was built from. `notify.report_exit_fill`
  now carries an estimated round-trip commission beside the P&L
  (`hooks.estimate_round_trip_fee`, mirroring `TradingFee::estimate` — quantity
  × exit price × the venue's taker rate × 2, `TAKER_FEE_RATES`), and
  `_pnl_percent` nets it. **The figure posted to `past-positions/sync` is
  still GROSS** — the API owns netting on ingest, and sending a netted P&L
  would net it twice. An unknown fee (no exit price yet) leaves that account's
  figure gross rather than treating the trade as free.
  **And it is the MASTER ACCOUNT'S figure, not a blend** (2026-09-23). The
  published track record is the master's alone, so a percentage pooled across
  every filled account could never reconcile with the daily recap built from
  it — the residual was ~0.05pp on 22 Sep and grows with every customer whose
  sizing sits differently against their balance. `GET /engine/{exchange}/accounts`
  carries `is_master` (from `user_credentials.type`, never the account's NAME,
  which any user can set), and `notify._master_reports` distinguishes three
  cases: the master reported → its figure; the flag is present and no report
  carries it → **publish no percentage at all** rather than a customer blend;
  no report carries the flag → pooled, because an engine deployed ahead of the
  API must not silently drop the figure from every message in the channel. The
  consequence to know: **a venue the master has no account on announces its
  closes without a PnL line** — true of MEXC today, the same condition that
  keeps MEXC out of the recaps; connecting the master there turns both on. The
  exit PRICE stays pooled (a market fact, not a performance claim).
  How many customers filled is
  business information and the channel is readable by anyone (same rule as
  `/api/public/*`). Counts live in `trade_logs` and, where a human is needed,
  the admin chat: `notify_max_increments` lists the accounts already at their
  cap (`3/3 🟢🟢🟢 · no add placed`) so a stack that stops adding is visible
  without being mistaken for a missed trade.
  **`BINANCE_ABCD_TELEGRAM_ADMIN_CHAT_ID` routes every ops alert to the private
  group "Pixel Alpha Admin Control"** (2026-09-04) — account failures, capped
  stacks, rejected signals, poller errors, and the engine's restart ping. Until
  then it was unset, so `_admin_chat()` fell back to the PUBLIC channel and
  published all of it, account names included. That is what the key exists to
  stop, so **an empty value is a regression, not a default**: it silently
  re-opens the leak. It is a config-only fix — paste the id in
  `trading-flask/.env` and run `sync-engine-env` (the key is already in
  `MIRRORED_ENGINE_ENV_KEYS`). `notify_startup` sends with `_send_admin` for the
  same reason: it carries account and asset counts.
  **The PUBLIC messages are mirrored to a Discord channel as coloured embeds**
  (2026-09-18, `binance_abcd/discord_notify.py`; green long entry, red short,
  exit by PnL sign, blue recap). `notify._send_public` is the one path to
  Discord and only the three public builders call it; admin builders go
  through `_send_admin` → `_send`, which knows nothing about Discord — so an
  ops alert cannot reach the mirror by construction. **No admin webhook, no
  fallback**, for the reason above. It is independent of Telegram
  (`BINANCE_ABCD_DISCORD_WEBHOOK_URL` alone turns it on; an exit batch opens
  when either destination exists) and posts on a ONE-worker pool with a single
  `Retry-After` retry — order preserved, and the month-end tick's six recaps
  do not trip Discord's 5-per-2-s bucket. The URL is a credential (last path
  segment = token): gitignored `.env` only, in `MIRRORED_ENGINE_ENV_KEYS`, and
  scrubbed from every log line — a `requests` error quotes the request path.
  **A positive DAILY recap is also posted to the Discord "wins" channel as an
  image card** (2026-09-28, `BINANCE_ABCD_DISCORD_WINS_WEBHOOK_URL`, mirrored,
  secret like the other). `binance_abcd/win_card.py` draws the admin P&L card's
  design with Pillow (fonts + logo bundled in `binance_abcd/assets/`, OFL) —
  keep it in step with `PnlShareCard.tsx`. Figures come from the SAME public
  series as the recap (`reports.build_win_card`: day return, trades, month-to-
  date curve + %, green-day streak, top asset), so it cannot say more than the
  recap. "Positive" is judged on the recap's 3-dp rounding; per venue; daily
  only. The post is the card ALONE (green embed, no title/text — owner's call,
  and the card drops the bottom wordmark and "after exchange fees"); the text
  embed is only the fallback when rendering fails (or Pillow is missing).
  Preview locally with `python -m binance_abcd.reports wincard [YYYY-MM-DD]`
  → `out/win_card_<exchange>.png`, posted nowhere.
  **`Increment (2/3)` is the stack depth this entry reached** = pre-entry
  `stacks_now + 1`, over `assets.max_increments` (`(#2)` when the asset has no
  cap). Derived from the batched `positions/check` read the fan-out already
  makes — the reference bot in `binance-flask` re-reads the new position size
  from Binance per account per signal purely to print this number. Published
  as the **MASTER account's** depth (2026-09-23), like every other figure the
  channel publishes. Falls back to the most common depth among filled accounts
  when the master did not fill, or when the API sends no `is_master`: one user
  who connected late is still at #1 while everyone else is at #3, and the mode
  keeps them from deciding what the channel says.
  **`Increments Closed (3/3)` is its mirror on the close** (`_closed_increments`)
  = `closed_quantity / _scale_qty(...)`. The divisor is the SCALED entry size,
  never the raw `base_size`, for the same reason the cap is measured that way:
  a 5,000 USDT account's entry is several base sizes, so base_size would report
  a 3-increment position as 15. Fail-soft — **exits skip every asset gate**, so
  a close must still work for a ticker whose asset row was disabled or deleted
  since the entry; no asset row just means the line is omitted. The count is
  measured against TODAY's balance, so a position opened before a large PnL
  swing is divided by a slightly different entry size than the one that opened
  it — the same approximation `stacks_now` carries, and why it is rounded.
- **Scheduled recaps** (`binance_abcd/reports.py`, 2026-09-07) are the ONE thing
  the engine posts because a clock ticked rather than because a signal fired:
  **daily 23:55, weekly Friday 23:55, monthly last-day 23:55 — Asia/Manila**, to
  the PUBLIC channel (`BINANCE_ABCD_REPORT_*`, mirrored to prod).
  **They are built from `GET /api/public/track-record`, never from a fresh
  query**, and that is the whole design. It cannot leak — the channel is
  world-readable, so a recap may carry percentages, TRADE counts and tickers
  only (a ticker is already public on every entry the channel announces), and
  sourcing it from an already-public endpoint makes that structural rather than
  remembered (there is no balance or account count in the payload to print by
  mistake; a test asserts it). And it cannot disagree with the landing page,
  which renders the same series — a second P&L walk would drift, and then the
  site and the channel would publish two different track records for the same
  month. So `reports.py` touches neither Binance nor the DB: it slices the daily
  series and chains it, and `notify.notify_report` owns what the channel may say.
  - **Days are MANILA calendar days, and every recap ends on TODAY** (2026-09-16;
    until then the series was UTC days and each recap covered the *previous*
    one, so the "daily" posted at 23:30 Manila described a day that had ended
    at 08:00 that morning). The API buckets the track record in
    `services.track_record.timezone` (`TRACK_RECORD_TIMEZONE`, default
    Asia/Manila) and publishes it as `payload.timezone`; `reports.py` cuts its
    window in THAT calendar (`series_timezone`, UTC fallback for an older API),
    never in `REPORT_TIMEZONE`, so the channel's "16 Sep" and the landing
    chart's "16 Sep" are the same trades by construction. The daily is the
    local day it fires in, the weekly the 7 days ending today, the monthly the
    1st → today (so `last` is the whole month; `<1-28>` is month-to-date). The
    stated trade-off: a close AFTER the firing time is on the site and in the
    weekly/monthly but in no daily — hence 23:55, the latest the ~3-min
    past-positions backfill and the endpoint's 5-min cache allow. A published
    percentage is still never reposted or revised.
  - **Chained, not summed** — same time-weighted math as the endpoint's own
    total, so a mid-period deposit cannot inflate it. **Except the DAILY
    (2026-09-28, owner's request):** its return, trade count and asset ranking
    are the SUM of the `PnL:` lines the channel posted that day
    (`binance_abcd/published_closes.py` → `out/published_closes.jsonl`, stored
    rounded as printed), so a lone +2.224% close recaps as +2.224% — the track
    record's walked capital had it at +2.189%. A day with no recorded close
    falls back to the track record; weekly/monthly still chain it.
  - **The DAILY recap ranks every asset traded** (`reports.rank_assets` +
    `notify._asset_ranking`, 2026-09-14) from the `assets` list each series
    point carries: per symbol, its realized P&L over the SAME capital as the
    day's `pct`, so the shares add up to the day's return. 🥇🥈🥉 for the top
    three **by rank, profit or not** (the podium says who did best; the signed
    percent beside it says whether best was good — medals-only-in-profit was
    tried and read as a missing bronze), everything below the podium numbered —
    a ranking that hides the losers is not a ranking. **Daily only, by design**: across
    several days the shares are SUMMED while the period return is chained, and
    a leaderboard that does not add up to the line above it is a question in
    the channel. **No all-time / return-on-capital line** — removed the same
    day; a recap is the period it names and nothing else.
  - **One recap per EXCHANGE** (2026-09-17). `GET /api/public/track-record`
    pools every exchange the master trades on into one portfolio (capital and
    P&L summed across `ExchangeSchema::supported()`, `exchanges: [...]` naming
    the contributors) and is what the landing page reads;
    `/api/public/track-record/{exchange}` is one exchange's slice, measured on
    its OWN capital. `reports.py` fetches the slice for every exchange in
    `hooks.EXCHANGES` and posts one message per venue (`Daily Report — 16 Sep
    2026 · Binance`, the label entries and exits already carry). An exchange
    with `available: false` (no real master account there) posts NOTHING —
    not "No trades closed" — and is marked done. State is per (kind, exchange)
    so one venue's failed fetch retries alone; a legacy one-date-per-kind
    state file counts for every venue. MEXC recaps start the day
    `BINANCE_ABCD_EXCHANGES` includes `mexc` on prod AND the master has a
    `mexc_accounts` row.
  - **"Trades closed" counts INCREMENTS, not close orders** — settled
    2026-09-23, and **this rule has now been flipped twice; read the whole
    bullet before touching it a third time.** Binance merges a stacked
    position, so two entries announced as `Increment (1/3)` and `(2/3)` come
    back as ONE `pastpositions` row carrying `increments_closed = 2`.
    09-17 counted increments; 09-20 switched to rows, because the owner had
    held up the reference bot's recap (`binance-flask`
    `performance_report.py`: `len(rows)`) as correct for the 19 Sep day; 09-23
    switched back, because on 22 Sep the channel announced two entries and the
    recap then said "1 trade". The settled reading: **the count is what was
    OPENED, so it matches `Increments Closed (n/cap)` on the close message.**
    `PublicStatsController` sums `COALESCE(increments_closed, 1)` for every
    `trades` figure (series, assets, `stats.trades`). NULL = not recorded
    (history, poller rows) and is never backfilled from `position_amt`: the
    divisor was that account's scaled entry size at close time and is not
    recoverable later. **A consequence to state when comparing with Nexa:**
    binance-flask counts rows, so for a stacked day its recap reads lower than
    ours by design — that is the count rule, NOT a timezone difference. The
    two products' daily windows are the SAME day (binance-flask anchors at
    23:00 Bangkok = 16:00 UTC = 00:00 Manila, exactly the Manila calendar day
    this series buckets on).
  - **A failed fetch is not "no trades"** — `None` leaves the period unmarked
    and the next tick retries it, the same empty-vs-unavailable rule the pollers
    follow. `available: false` is an answer and is marked done.
  - **First run seeds `out/report_state.json` silently** so a deploy does not
    fire all three at once; a missed recap catches up only within
    `REPORT_CATCHUP_HOURS` (12), then is dropped.
  - `tzdata` is in `requirements.txt` because Windows has no tz database; an
    unusable timezone disables reports and alerts admin, never stops the engine.
- **Config:** env-driven, prefix `BINANCE_ABCD_*` — committed `.env.example`,
  gitignored `.env` (webhook secret + engine secret; engine secret must match
  `ENGINE_SECRET` in `sinegutrade-api/.env`, and the webhook secret must match
  `BINANCE_ENGINE_WEBHOOK_SECRET` there).
- **Prod mirrors the local `.env` for product keys.** The server's
  `engine/.env` is created once and never overwritten wholesale, but every
  engine deploy now upserts `MIRRORED_ENGINE_ENV_KEYS` (deploy script) from the
  local `trading-flask/.env`: the webhook secret and the whole
  `BINANCE_ABCD_TELEGRAM_*` block. Those describe the PRODUCT — which
  TradingView token, which channel — so prod differing from local is always a
  mistake. It is the mistake that made prod silent on Telegram for its first
  weeks while local posted fine, because `notify.py` disables itself unless
  BOTH a token and a chat id are set and the generated prod file had neither.
  **Never mirrored** (they describe the BOX, and copying a dev value breaks
  prod): `ENGINE_API_BASE`, `ENGINE_SECRET`, `FLASK_PORT`, `RUN_POLLERS`,
  `SYNC_POSITION_MODE_ON_STARTUP`. Config-only fix, no code, no test gate:
  `python .claude/deploy_sinegualcrypto.py sync-engine-env` (upserts + restarts).
- **Commands:** `python -m binance_abcd.main` (waitress), `python -m pytest
  tests/ -q` (457 tests, no network), `python webhook_tester.py` (Tkinter GUI
  trade sender — local or prod target, red banner on prod).
- **Naming trap:** root `src/` is the React app; the engine package is
  `binance_abcd/`, deliberately not named `src`. Python and TypeScript
  conventions never bleed across the boundary.
- **Not deployed yet:** prod needs an nginx location + systemd unit and an
  IP-restriction on `/api/engine/*` (see README's deploy TODO).

### TradingView alert setup

Paste this into a TradingView alert's **Message** box. **One webhook URL per
exchange — the URL decides which venue's accounts trade**, so a strategy that
should run on both needs one alert per URL with the same message:

| Venue | Prod webhook URL | Local |
|---|---|---|
| Binance | **`https://pixel-alpha.com/binance_abcd_webhook`** | `http://127.0.0.1:5010/binance_abcd_webhook` |
| MEXC | **`https://pixel-alpha.com/mexc_abcd_webhook`** | `http://127.0.0.1:5010/mexc_abcd_webhook` |
| Bybit | **`https://pixel-alpha.com/bybit_abcd_webhook`** | `http://127.0.0.1:5010/bybit_abcd_webhook` |

Same secret on all three (one engine). nginx proxies exactly these paths to
waitress on 127.0.0.1:5010; `/health` and `/admin/*` stay local-only. The older
`http://2.24.139.176/binance_abcd_webhook` still works — the bare IP is not
redirected — so existing alerts keep firing; move them to https when convenient.
The engine authenticates on the `secret` field alone — there is no signature header.

```json
{
  "secret": "<BINANCE_ENGINE_WEBHOOK_SECRET>",
  "action": "BUY",
  "symbol": "{{ticker}}",
  "price": "{{close}}",
  "leverage": 25,
  "strategy": "ABCD-v1"
}
```

**The real secret is NOT in this file** — this repo is public on GitHub, so the
live token lives in gitignored `.claude/tradingview.creds.md` alongside a
ready-to-paste copy of the block above. Open that file, copy, paste into
TradingView.

Field contract (`trading-flask/binance_abcd/routes/webhook.py`):

| Field | Required | Notes |
|---|---|---|
| `secret` | yes | Must equal the engine's `BINANCE_ABCD_WEBHOOK_SECRET`; mismatch → `403 Unauthorized`. May also be sent as `?secret=` or a form field. |
| `action` | yes | `BUY` \| `SELL` \| `EXIT_LONG` \| `EXIT_SHORT` (case-insensitive). Exits skip every size/asset gate. |
| `symbol` | yes | Or `ticker`. A `BINANCE:` prefix is stripped, so `{{ticker}}` works as-is. |
| `price` | no | Or `close`. Informational — sizing uses the live mark price. |
| `leverage` | no | 1–125; defaults to 25 in the admin console. Omit to let the engine decide. |
| `strategy` | no | Free label stored on the position so the closing trade keeps it. |
| `target_uni_ids` | no | Admin manual-trade only — restricts the fan-out to specific users. Never put it in a TradingView alert. |

Only enabled, non-sandbox accounts of non-suspended, non-overdue users receive
the fan-out — that filtering happens in `sinegutrade-api`, not in the alert.

## `pixel-telegram/` — VPS ops alerts (in this repo)

**A third codebase in this repo**, beside the React app and the engine: a small
Python package (`pixel_telegram/`) that reports the VPS to the private Telegram
group **Pixel Alpha Admin Control**. Full docs in `pixel-telegram/README.md`.

- **It is standalone on purpose.** It never imports `binance_abcd`, has its own
  venv and `.env` (`PIXEL_TG_*`), and runs from its own systemd timers. The
  situation it exists for is the engine being the thing that is down — a
  reporter living inside the engine goes quiet exactly when it is needed.
- **Two timers, one oneshot script.** `report` (`OnCalendar=00/4:00`,
  `Persistent=true`) posts CPU/RAM/disk bars, uptime, every watched unit's
  state and the engine's `/health`. `watch` (every 2 min) posts **nothing**
  unless something changed: a unit restarted or went down, or a resource
  crossed its threshold. Deployed to `/var/www/sinegualerts/telegram` with
  `deploy-telegram`; config-only changes go through `sync-telegram-env`.
- **A restart is `ActiveEnterTimestampMonotonic` changing**, not the human
  `ActiveEnterTimestamp` string (locale- and timezone-formatted, and it would
  have to be parsed back). Monotonic resets on reboot, so a reboot correctly
  reads as "everything restarted".
- **The first run seeds state silently** — a unit is only announced as
  restarted once it has been seen before, or the deploy itself reports every
  service on the box as freshly restarted. The one exception is a unit already
  DOWN on that first run: that is the report, not noise. `state/` is
  server-owned and excluded from the deploy sync for the same reason.
- **Alerts are rate-limited but re-arm on recovery** — one message per metric
  per hour, and dropping back under the threshold clears the cooldown, so the
  next breach is not swallowed by an hour that started before the box recovered.
- **Nothing in it raises.** An unreadable unit reports `unknown`, an
  unreachable Telegram logs and exits 1, a truncated state file is treated as
  empty. A monitoring job that crashes needs its own monitor.
- **`PIXEL_TG_UNITS` is a list of `unit=Label` pairs, and the halves are
  different things.** The unit is the address systemctl resolves
  (`sinegualerts-engine`); the label is what a person reads in the group
  (`Pixel Alpha engine`) — the machine-name/product-name rule at the top of this
  file, applied to a Telegram message. **State is keyed by the unit, never the
  label**, so a relabel does not make every service look brand new and
  re-announce itself as restarted. Env-driven because the php-fpm unit carries
  the PHP version in its name; the deploy step prints the units actually
  installed so a stale name is visible rather than reading "not readable"
  forever.
- **The bot is the SAME bot as the public channel** — only the chat differs. It
  must be added to the group as an admin; the id comes from
  `python -m pixel_telegram.main chat-id`, never guessed. Token lives in the
  gitignored `pixel-telegram/.env` only (this repo is public on GitHub), and the
  deploy mirrors `MIRRORED_TELEGRAM_ENV_KEYS` logging key names only.

## Design reference

- `design_handoff_concept4/` — the original design handoff (README + `.dc.html` prototypes + assets). The React implementation in `src/` was recreated from it. Prototypes are reference-only; never ship them.
- Theme: dark (default) / light via `data-theme` on `<html>`, persisted in `localStorage['sinegu-theme']`. All colors are CSS variables defined in `src/index.css`.
- Fonts: Bricolage Grotesque (display), Plus Jakarta Sans (body), IBM Plex Mono (data/labels).

## Folder structure & conventions

Follow this structure as the app grows (feature-based once it passes ~10 pages):

```
src/
├── assets/              # images, fonts
├── components/
│   ├── ui/              # generic building blocks (Button, Card, Input)
│   └── <feature>/       # feature-specific components (e.g. landing/)
├── hooks/               # custom hooks (useAuth, useMediaQuery, ...)
├── lib/                 # pure JS/TS helpers — no React (formatters, validators)
├── services/            # HTTP layer — one file per API resource; components never call fetch/axios directly
├── context/             # React context providers
├── types/               # shared TypeScript types
├── pages/               # one file per route — thin, compose components only
│   └── admin/           # admin-portal pages (AdminDashboard, AdminUsers, AdminStrategies, AdminAssets, ...)
├── App.tsx              # routes only
└── main.tsx             # entry point
```

**Admin pages live in `src/pages/admin/`** — every `/admin/*` route page goes here
(imported in `App.tsx` from `./pages/admin/...`). User-side pages stay in `pages/` root.

When it grows into a full dashboard, migrate to `features/<domain>/` folders
(each with its own `components/`, `hooks/`, `api/`, `types.ts`) — test:
"deleting a feature = deleting one folder".

**Rules of thumb**

1. Extract a **hook** when `useState`/`useEffect` logic is reusable or clutters the JSX (see `theme.tsx`).
2. Extract a **util** to `lib/` when a function has no React in it.
3. Extract a **component** when JSX repeats or a section exceeds ~100 lines.
4. Keep **pages thin** — they compose; presentational components render.
5. One **API layer** (`services/`) — `sinegutrade-api` exists; the base URL lives in one place.

**UI conventions**

- **Scroll reveals:** use **AOS** (`aos` package) — `data-aos="fade-up"` + `AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })` on page mount, `data-aos-delay` for staggering. Do not hand-roll IntersectionObserver reveals.
- **Filter / category switches always animate:** whenever changing a tab, category, or filter swaps the content that's already on screen (tables, lists, grids), the new content must replay a short reveal — never a hard cut. Wrap the switched region in a container whose `key` includes the active tab + every filter value (e.g. `key={`${tab}-${exchange}-${ticker}`}`) so React re-mounts it, and give it `className="animate-[fadeup_0.35s_ease-out]"` (the `fadeup` keyframe in `index.css`). Pattern reference: Positions page (`/dashboard/positions`) tables. AOS is for first scroll-in; this is for in-place re-renders on filter change.
  **Exception — Performance Analytics** (`/dashboard/analytics`, 2026-09-25): its
  figures update IN PLACE on a filter change — the current cards fade while the
  new payload loads ("Updating…"), no re-keyed reveal; cards with nothing to
  measure in the view are tinted down (`Dimmable`), and the first load shows
  `AnalyticsSkeleton`.
- **Confirmation modals:** every significant/destructive action (delete, stop bot, disconnect exchange, irreversible submit) must be confirmed with the standard yes/no modal `src/components/ui/ConfirmModal.tsx` before executing.
- **Proper spacing:** give every element room to breathe — consistent padding/margins from the design-token spacing scale, no text touching or clipping against container edges, buttons, or icons (e.g. a title crowding a popover's close button), and comfortable gaps between rows, cards, and controls. Cramped layouts are a bug; fix spacing before shipping.
- **This is a PWA — responsiveness is non-negotiable:** every page and component must work and look right from small mobile screens up to desktop. Always design mobile-first, use fluid/responsive layouts (flex/grid, relative units, sensible breakpoints), keep tap targets comfortable, and verify each screen at mobile, tablet, and desktop widths before shipping. Never ship a layout that only works at desktop width.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — type-check + production build
- `npm run lint` — oxlint

## Git

- **Remote:** `https://github.com/xlythefx/sinegu_crypto.git` — this is where the
  frontend repo is committed/pushed.
- **Single-developer project.** No PRs, no feature-branch review flow, no
  `Co-Authored-By` ceremony needed — commit straight to the working branch.
- **Only push to `main` when explicitly prompted.** Committing locally is fine
  whenever it makes sense, but never `git push` (to `main` or otherwise) unless
  the user asks for it in that message.
- **Auto-commit to `main` after every large chain of work** (2026-09-11). When a
  task lands as a coherent unit — a feature, a migration plus its ingest rule
  plus its tests, a deploy that changed prod behaviour — commit it on `main`
  without being asked, in BOTH repos if both moved (`sinegutrade-api` is
  `https://github.com/xlythefx/sinegu_crypto_api.git`). Stage only the files that
  chain touched; other people's uncommitted work in the tree stays out of the
  commit. The point is a rollback line: every prod-affecting change must be one
  `git revert` (or `migrate:rollback --step=1`) away from undone. Small
  mid-chain edits do not need their own commit.
- **Name a commit for what CHANGED, judged from the diff, not for what was
  asked.** Imperative subject line ≤ 72 chars that a reader can act on from
  `git log` alone — the behaviour and its boundary, not the file list:
  `Restore gross realized_pnl before 2026-09-11; net closes only from the cutoff on`,
  not `Update TradingFee and migration`. Never `Sync working tree`, `fixes`,
  `wip`. Body = why (the incident, the request, the trade-off accepted), one
  short paragraph; the diff already says what. A commit that touches a number
  someone has been shown (P&L basis, track record, invoicing inputs) says so in
  the subject.
- **Tag the two sides of a reversible decision** when a change restates data
  someone has already reported on, so "which version is the truth" is a
  `git checkout <tag>` rather than an archaeology session. Pair convention:
  `<topic>-<before>` / `<topic>-<after>`, same names in both repos. Existing
  pair: `pnl-net-history` (all history net of fees, LTC +545.66) and
  `pnl-gross-history` (history gross, new closes net, LTC +1,384.41) — the API
  tag's message carries the DB rollback command.

## .claude setup

- `.claude/settings.json` — permission allow-list (npm/tsc, php artisan/composer, deploy script). No secrets in it, ever.
- **Auto-allowlist hook** (`.claude/hooks/auto-allow.mjs`, wired in `settings.json` under
  `hooks`): whenever the user manually approves a permission prompt for a shell/WebFetch/MCP
  call, a generalized prefix rule (e.g. `PowerShell(php artisan *)`) is appended to the
  gitignored `.claude/settings.local.json` so the same kind of command never prompts again.
  Destructive first tokens (rm, Remove-Item, …) are never auto-added.
- **Two agents live in `.claude/agents/`** — one for frontend, one for backend:
  - `.claude/agents/frontend.md` — frontend specialist for this repo (React conventions above).
  - `.claude/agents/backend.md` — backend specialist pointing at `C:\wamp64\www\sinegutrade-api` (Laravel), using `sinegu-api` as read-only reference.
- `.claude/skills/deploy/SKILL.md` — deployment procedure (`/deploy`), driving `.claude/deploy_sinegualcrypto.py`. **Live at https://pixel-alpha.com** (Ubuntu 24.04, origin `2.24.139.176`); the skill holds the flow (backup → build → upload → verify). Credentials live in gitignored `.claude/deploy.creds.json` only; never in committed files, and never use the mother project's servers from this repo.

## Notes

- **`sinegutrade-api` already exists** (Laravel + Sanctum, DB `sinegu_crypto` on WAMP) with
  the tables `assets`, `binance_accounts`, `binance_invoices`, `binance_pastpositions`,
  `binance_positions`, `binance_transactions`, `strategies`, `users`, `user_credentials`
  (plus Laravel's own cache/jobs/sessions/etc.). **Connect pages to it whenever possible**
  instead of leaving static data, and **always check the real `binance_*` columns** before
  wiring exchange data — match field names to the actual schema.
- Wire auth forms (currently client-state only via `preventDefault`) to the real API.
- Ticker / order book / chart / stats are static prototype data only until an endpoint
  exists; connect them to the API as soon as one does.

**`binance_pastpositions.realized_pnl` is NET of exchange commission for closes
from `TradingFee::NET_SINCE` (2026-09-11 00:00 UTC) on, and GROSS before it.**
The netting was built 2026-09-09 and applied to all of history; two days later
the historical rows were put BACK to gross (migration
`2026_09_11_000001_restore_gross_pnl_before_net_cutoff`) because the figures
had already been reported on and the restatement (LTC +1,384 → +546) read as
invalid data. The compromise is dated, not undone: **the column is deliberately
MIXED across the cutoff**, `exchange_fee IS NULL` is the row-level marker of a
gross figure in either era, `TradingFee::applyTo` refuses to net a close dated
before the cutoff (so a late-discovered old trade lands gross too), and any
total spanning the boundary — the by-asset chart, September 2026's monthly
P&L and its invoice, the public track record — is neither basis. Do not
"fix" the old rows back to net and do not net the new ones out; both were
decided.
Binance's `realizedPnl` on a fill — what the engine reads and posts — is GROSS:
`(exit − entry) × qty`, before commission and funding. Binance's own Position
History screen shows the same trade NET, so every screen we owned published a
bigger profit than the customer's exchange app did for the same trade (+$52.76
against 43.09 on one LTC close; the $9.67 gap was exactly the round-trip fee),
and invoices billed 20% of money the customer never received.
- **The conversion happens ONCE, on ingest** (`EngineSyncController::syncPastPositions`
  → `App\Services\Pnl\TradingFee`), never at read time. A dozen readers touch
  `realized_pnl` — dashboard, analytics, calendar, referrals, `BinancePnlSource`,
  the public track record — and netting at the column is what stops them
  disagreeing about whether the number they hold includes fees. The engine stays
  unaware: it reports what the exchange said, the API decides what that means.
- **The fee is ESTIMATED, and stored** in `exchange_fee`, so gross is always
  recoverable as `realized_pnl + exchange_fee` (which is how the migration
  reverses). It cannot simply be read from Binance: the real commission is per
  FILL and the ENTRY half belongs to the entry order, which a closed-trade row
  never references — the same gap that leaves `entry_price` null. Capturing it
  truly means aggregating `/fapi/v1/income` for COMMISSION + FUNDING_FEE, and
  that endpoint is already ~95% of the poller's weight budget.
- **The estimate is trustworthy only because the engine places MARKET orders
  exclusively**, so every fill is a TAKER fill at the flat published rate
  (`services.binance.taker_fee_rate`, 0.05%/side) — there is no maker/taker
  ambiguity to guess wrong. Verified against the real closes to within two cents.
  If limit orders are ever added, this estimate stops being valid.
- **Null is not zero.** The webhook writes a close before Binance indexes its
  fills; with no exit price there is no fee to estimate, so `exchange_fee` stays
  null and that row's P&L stays gross until the poller backfills both together.
  A zero fee and an unknown fee bill differently.
- **Neither migration touched issued invoices** (they store their own
  `realized_pnl` snapshot) nor the HWM (measured on exchange-reported equity,
  not on this column). Invoice-scenario rows (`SBXINV-…`) are excluded from
  both: they are seeded straight into the table with hand-derived figures and
  never pass through the netting ingest.
- **The published track record follows the column**, since `PublicStatsController`
  reads it — so it, too, is gross before the cutoff and net after.

**The estimate is the starting point, not the final word (2026-09-14).** The
engine now ships the exchange's own fee RECEIPTS and the API replaces the
estimate with them per close: `exchange_fee` = entry commission + exit
commission + funding attributed to the position, and
`binance_pastpositions.fee_source` says which figure a row holds — `NULL`
(gross row), `estimated`, `actual`, or `manual` (an admin typed the P&L;
`AdminController::updatePastPosition` stamps it, and nothing automatic
touches that row again). Customers see the amount plus an `est.` pill only
while `estimated` (`components/positions/FeeLine.tsx`); the other words are
admin-only (Admin → Trading Positions has a Fee column).
- **Receipts are their own table, `exchange_fee_receipts`** — one append-only
  row per charge: every userTrades FILL (its `commission`/`commissionAsset`,
  qty, side, `positionSide`, `realizedPnl`; `ref` = the fill id, which is
  PER SYMBOL, hence `symbol` in the unique key) and every FUNDING_FEE income
  row (`ref` = `tranId`). `amount > 0` is money OUT; funding is stored
  negated so a credit is negative and a trade's fee is a plain sum. `asset`
  is stored as reported and never assumed.
- **Entry fills are captured at ENTRY time.** The past-positions poller's
  income call is now unfiltered (REALIZED_PNL + COMMISSION + FUNDING_FEE, the
  same weight-30 request), with a second watermark `out/last_fees_sync.json`.
  A COMMISSION row is what puts a symbol on the fee fetch list, so an entry's
  fills reach the ledger hours before its close — the closes flow alone only
  ever reads fills since the LAST close and would never see them. Every fill
  is shipped, even at zero commission: its quantity is what the replay needs.
  Seed lookback `BINANCE_ABCD_FEES_LOOKBACK_HOURS` (168; userTrades goes no
  further back, the cursor is clamped). The fee mark holds whenever any
  userTrades read for the account failed — a receipt skipped once is skipped
  forever. Closes payload and endpoint are byte-identical to before.
- **Attribution is a replay, in Laravel, pure** (`FeeAttribution`, keyed on
  `(symbol, position_side)` — the engine runs HEDGE mode, `BOTH` is a
  fallback by net sign). Entry fills pile into the open bucket, funding
  charged while it is open attaches to it, the closing order takes the
  bucket (pro-rata on a partial close). Three refusals, never guesses:
  `entry_missing` (position predates the ledger, or a webhook row with
  `order_id = 0`), `entry_qty_short`, `non_usdt` (BNB fee discount — summing
  BNB and USDT is not a fee). A refused close stays `estimated`;
  `php artisan fees:reconcile --dry-run` prints the reason, the row does not
  store it.
- **The rebase keeps `gross = realized_pnl + exchange_fee`** (`FeeRebase`):
  gross is recovered from the row, the actual fee comes off it. Never
  touched: pre-cutoff rows (still gross by decision), `is_sandbox`,
  `SBXINV-%`, `manual`, `realized_pnl IS NULL`, `order_id = 0`. An `actual`
  row is never downgraded; a late funding receipt moves it again. Runs
  synchronously in `POST /engine/{exchange}/fees` for the posted pairs, and a
  rebase failure never fails that request (a 500 would make the engine
  re-send the same rows into the same exception every tick); daily
  `fees:reconcile` at 00:30 UTC is the safety net. Issued invoices keep their
  snapshot; post-cutoff figures customers have seen move by cents plus funding
  — tags `fees-estimated` / `fees-actual` in both repos mark the two sides.
- **Rollback**: engine `git revert` (the API tolerates silence), then API
  `git revert` + `migrate:rollback --step=2` (re-estimates `actual` rows, drops
  the receipts table and `fee_source`), then frontend.

**The trading dashboard and Performance Analytics lead with P&L BEFORE
exchange fees (2026-09-15)** — "how did the strategy do" — and every money
figure carries its after-fees twin so the UI can show the three-line hover
*Before fees / Exchange fees / After fees* (`components/ui/PnlBreakdown.tsx`,
portaled to `<body>` because the rail clips overflow and every AOS card is a
transform; `hoverOnly` for figures inside a button or link, whose tap has its
own job). The rule per surface:
- **Dashboard + Analytics + strategy pages: before fees is the big number**,
  the equity curves are drawn before fees (`equity_gross` = the anchored
  curve plus cumulative fees, so it ends at balance + fees), and the ratio
  stats (win rate, PF, expectancy, drawdown, Sharpe) are computed on that
  basis too — one basis per page, or the drawdown would not match the curve
  above it. Analytics has an **Exchange Fees** KPI card of its own.
- **The calendar keeps AFTER fees on the cell** — a day is what landed — with
  before fees on hover and in the day popup's header. Every cell also shows
  its **percentage of the balance that day STARTED with** (2026-09-28,
  `start_balance` / `pct` / `pct_gross` per day from `dailyPnlDays`, via the
  same `UserStatsService::capitalWalk` Analytics uses for `daily_capital`) —
  never today's balance, which let a deposit rewrite every earlier day. `pct`
  is null when no capital is on record; the old Amount/% toggle is gone.
- **Positions page and admin user detail keep `realized_pnl` / `total_pnl`
  (after fees)**: a total beside a list of net trades must sum to them.
The switch is server-side, once: `UserStatsService::withFeeBasis()` stamps
every row with `pnl_gross` / `pnl_net` / `pnl_fee` / `fee_known`, and
`feeSummary()` returns `{total, trades_with_fee, trades_without_fee, since}`.
Payload convention: the gross figure keeps the plain key, its twin is `*_net`
(`realized_pnl` / `total_pnl` are the exception — they stayed net and gained
`*_gross`, for the readers above). Pre-cutoff rows carry no fee, so before ==
after for them; `trades_without_fee > 0` is what makes the hover print "fees
are recorded from Sep 11, 2026" rather than a $0 that reads as free trading.
Strategy math is client-side (`lib/strategyStats.ts`: `tradePnl` /
`tradePnlNet` / `tradeFee`), fed `exchange_fee` by `/admin/strategies` and
`pastPositionsToStrategyTrades`. The public track record is untouched.

**Period Return now ADDS the saved daily % (2026-10-05, Christian's request:
"yesterday 4%, the day before 1% → between the two I see 5%").** Each day's
% is the P&L calendar cell (`UserStatsService::dailyReturns` — the ONE
function behind both, 2 dp), saved in `daily_returns` (uni_id, scope =
'all'|exchange, day). `GET /analytics` syncs its scope from the data it
already loaded and presents the stored rows as `daily_returns`;
`pnl:daily-returns` (every 15 min) covers users who never open the page. A
row is rewritten when its day's trades change and dropped when they are gone
— never frozen. The card sums them (`lib/periodReturn.ts`); with a ticker /
strategy chip active it measures the filtered trades with the same formula
instead (a saved day holds every trade). Clicking the tile opens
`PeriodReturnModal`: Added vs Compounded from the same daily % plus the day
list. The landing page / recaps still COMPOUND — the modal says so. The
compounded history below is kept for the record.

**Performance Analytics' date-range percentage is TIME-WEIGHTED (2026-09-23).**
The Performance card's second tile was "Relative to Baseline" = window P&L ÷
the ALL-TIME baseline, so a deposit made in September changed the percentage
August had already reported — a finished month moved, and the owner read the
drop as the product being wrong. It is now **"Period Return"**: each day's P&L
over the capital THAT day started with, the daily factors chained, the same
walk `PublicStatsController` publishes (flows land before the day's trades,
capital compounds with realized P&L, a gross row's estimated commission comes
off the CAPITAL only, seeded from `initial_deposit` — a walk from zero is the
−980% of 2026-09-04). A transfer can no longer move the figure in either
direction, so no "exclude deposits" toggle is needed. The denominator ships as
`analytics.daily_capital` (one entry per day with a trade **or** a flow, built
from EVERY trade and flow — the chips and the date range narrow what is
measured, not the money that was at work); the chaining itself is in
`PerformanceChartCard`. Two consequences: the tile no longer equals
`realized ÷ baseline`, so the card shows a dollar total beside a compounded
return rather than one over the other; and its days are **UTC** like the rest
of that page, where the public track record buckets in Asia/Manila — same
method, different boundary, so the two will not tie out to the decimal.
`baseline` itself is unchanged (still net flows, still omitting
`initial_deposit`, unlike the dashboard and invoices) and so is every other
figure on the page. Pinned by `AnalyticsPeriodReturnTest`.
The same walk read at each day's CLOSE ships as `analytics.daily_balance`
(+ `initial_deposit`, the seed), and the Date Range card's balance is that
walk on its end date (2026-09-25). It used to print `baseline` + P&L to date —
the ALL-TIME net flow, so a range ending in August carried September's
transfers, and without `initial_deposit`. `baseline` is net flows alone and is
never a balance; Capital Flow's "Initial Deposit" tile had also been printing
it. The tab's presets (`lib/rangePresets.ts`) include one window per stretch
between transfers, in which contributed capital is constant.

**Capital comes from the exchange's LEDGER, and `initial_deposit` is only
what predates it (2026-09-25).** Binance keeps ~6 months of `/fapi/v1/income`
(every TRANSFER, REALIZED_PNL, COMMISSION, FUNDING_FEE), and on the master
11,321 rows summed to its walletBalance to the cent. So `binance_abcd/ledger.py`
computes `opening balance = wallet − Σ every income row` (0 for any account
younger than the retention), and `App\Services\Exchanges\TransferLedger` stores
every transfer the ledger lists and sets `initial_deposit` to that opening
balance minus any stored transfer older than the window. Two faults it fixed,
both on prod: `initial_deposit` was the WALLET at the first poll, which already
held the deposit the 3-day transfers poller then stored too (two customers at
~2× their capital); and the master's pre-connection transfers were never stored.
Rules:
- **A new Binance account is seeded from its ledger by the balance poller**
  (`POST /engine/{exchange}/ledger`, fills an UNSET figure only). An unreadable
  ledger leaves it unset — the deposit gate fails closed — and never falls back
  to the wallet. MEXC/Bybit still use the wallet snapshot (no ledger read yet,
  same double-count exposure: the MEXC demo row has it).
- **`initial_deposit = 0` is an answer, not "unset".** `updateBalances` fills
  only NULL; until 2026-09-25 it also refilled 0, which after a backfill would
  have overwritten 0 with the whole wallet.
- **Existing accounts are corrected by an admin**: Admin → API Keys → Actions →
  Transfer history (preview, then apply). The apply re-reads the exchange and
  409s if it no longer matches the preview; a stored transfer the exchange does
  not know, or a non-USDT balance, blocks it. Issued invoices keep their snapshot.
- **Transfers are dated when the money moved** (`created_at` = the exchange's
  `transaction_time`), not when the poller saw it — every reader buckets flows
  by `created_at`. Rows stored before this keep their poll time.

**Timestamps are UTC in the DB and rendered in the READER's zone**
(`fmtDateTime`, `lib/format.ts`). The API runs on `'timezone' => 'UTC'`, but a
bare `"2026-09-09 04:30:22"` has no zone designator and JS reads a zoneless
datetime as LOCAL — so UTC digits were printed unchanged and labelled as local
time, putting a trade seven hours from where the exchange app showed it. The
helper appends `Z` only when the string carries no zone of its own. **Day
GROUPING is still UTC server-side** (the P&L calendar, invoice months), so a
trade closing near midnight UTC can list under a different date than the
calendar cell it counts toward. The one exception is the **public track
record**, whose days are Asia/Manila calendar days since 2026-09-16
(`services.track_record.timezone`) because the Telegram recaps slice it into
"today".

**The dashboard equity curve separates SHAPE from LEVEL**
(`UserStatsService::buildDailyEquityCurve`, pure and unit-tested in
`EquityCurveTest`). One point per trading day:
- **Shape is realized P&L alone.** Deposits and withdrawals are never points on
  the line; they only move the starting base (`adjustedDeposit` =
  `initial_deposit` + net flows, the same figure `BinancePnlSource` bills on).
  The chart answers "what did trading do to the capital", so a withdrawal
  cannot draw itself as a crash — structurally, not by special-casing it.
- **Level is one constant offset**, `equity − lastCumulative`, applied to every
  point. Shifting the whole series preserves each day's move exactly while
  landing the last point on the balance the EXCHANGE reports — the only figure
  on the page that is not a reconstruction. Unseen transfers, commissions and
  funding fees all land in that offset instead of bending the line.

This replaced a replay of funding + trades accumulated from zero (2026-09-08),
which could not be made honest, because **the curve was only ever as complete as
`binance_transactions` — and the transfers poller asks Binance for the last
`TRANSFERS_LOOKBACK_DAYS` (3) only.** An account trading before it was connected
has NO early funding rows at all: the live master's first closed trade was
2026-05-11 and its first recorded deposit 2026-07-01, so the replay opened the
account at **$2.52** (that first trade's own profit) against ~1,050 of real
capital. Max Drawdown then divided by it and published **−3392.46%**. The
missing +1,050.00 deposit is still in Binance's income history — we never asked
for it — and the same probe showed commissions (hundreds of dollars) are never
captured either, by us or by the mother. Anchoring needs neither.

Two consequences worth keeping in mind:
- **Mid-period deposits no longer show as steps**, and the early curve is drawn
  at a capital level including money that had not arrived yet. Deliberate: the
  mother (`DashboardV2/selectors.ts`, `rebasedPart`) accepts the same trade-off.
- **Backfilling transfers would now DOUBLE-COUNT** unless `initial_deposit` is
  zeroed in the same operation — on the master they are the same $1,050. That is
  a billing-input migration (`adjustedDeposit` → HWM → invoices), not a data fix.

**Max Drawdown** (`maxDrawdownPct`) walks daily realized P&L from the curve's own
starting level (`equity − realized`) and divides by the peak AT THE TROUGH, not
the highest peak ever — a later run-up must not shrink a drawdown that already
happened. Never measure it on an equity curve that contains funding.

**Sharpe** (`sharpeFromCurve`) is annualized from the curve's daily fractional
RETURNS, so account size cancels; it is `null`, never 0, when there is nothing
to measure. It previously used dollar P&L divided by an unexplained 10.

**Still on `created_at`, deliberately left alone:** `PublicStatsController` (the
published track record's per-day flow buckets) and `BinancePnlSource` (which
month a deposit bills in). Both change a number someone has already been shown.

**Landing page track record (live).** The "See every trade, verified" section
(`components/landing/Performance.tsx` + `TrackRecordChart.tsx`, math in
`lib/trackRecord.ts`) is wired to `GET /api/public/track-record` — the FIRST and
only unauthenticated data endpoint (`PublicStatsController`, 5-minute server-side
cache). **Privacy rule for anything under `/api/public/*`: percentages and counts
only — never a balance, a USD amount, an account name or a uni_id**, since the
whole internet can read it (same rule as the public Telegram channel). That is
why the chart's Y axis is a percentage, not dollars. `available: false` in the
payload means nothing is published yet and the section renders its empty state
rather than inventing numbers.

Three rules decide the numbers, all learned from one incident (2026-09-04, the
page publishing **−980%** against a real +46.6%):

- **The record is scoped by `api_key`, never by the master's `uni_id`.** That
  uni_id also owned a **testnet** account (`demo=1`) and can own invoice-sandbox
  scratch accounts; their play-money trades were being published as a verified
  track record. Filter is `demo = 0` AND `is_sandbox = 0`, soft-deleted rows
  INCLUDED — a rotated key still traded real money, and excluding it would
  rewrite history every time an account is reconnected.
- **Opening capital is seeded from `binance_accounts.initial_deposit`**, then
  walked forward with net flows and realized P&L — the same figure
  `BinancePnlSource::adjustedDeposit` bills on. `binance_transactions` holds
  only transfers the poller has SEEN, and an account funded before it was
  connected has none: the live master had exactly zero. Starting the walk at
  zero divided day one's P&L by the pennies of profit that preceded it, which
  is where −1220% for a −0.73 day came from.
- **A GROSS row's commission is charged to the CAPITAL, never to its P&L**
  (2026-09-23). Pre-cutoff rows (`exchange_fee IS NULL`) keep gross
  `realized_pnl` by the 09-11 decision, but the exchange did take that
  commission — so a walk that compounds those figures accumulates money the
  account never had. On the live master it stood **1,103 above the balance
  Binance reports** (13,559 walked against 12,456), which made every published
  daily ~9% too small and impossible to reconcile with the close the channel
  had announced for the same trade (1.427% against 1.689% on 22 Sep).
  `compute()` now estimates the fee per gross row exactly as
  `TradingFee::estimate` does, at that row's own venue rate, and subtracts it
  from `$capital` only. Restated 2026-09-23: every daily/monthly percentage
  rose ~9% (22 Sep 1.427 → 1.567, the compounded total 14.13 → 17.06).
  **`roc` and `return_on_capital_pct` did NOT move** — they divide by
  `capitalContributed`, which is deposits alone — so the landing page's
  cumulative curve and its Return on Capital card are untouched. The residual
  against a close message is the ~0.02–0.05pp of POOLING: the channel's
  percentage blends every filled account's balance, the track record is the
  master's alone.
- **The total is the daily returns CHAINED, not summed** — a time-weighted
  return, which is the growth a customer can check against a balance.
  Deposits still cannot inflate it, because each day's return is already
  measured on that day's own capital. The deliberate consequence: **`avg daily ×
  trading days` no longer reconciles with the total**, since the mean is
  arithmetic and the total is compounded. Both are labelled as such
  ("Compounded return" / "Per trading day"). Monthly points compound within the
  month for the same reason.
- **The Cumulative view draws `roc`, not the chained `cumulative`** (2026-09-18).
  `roc` = realized P&L to date over ALL capital invested — the dashboard's
  equity curve as a percentage (the dollar curve over one constant), so the
  two rise and fall together and the curve ends on the Return on Capital
  card. The chained curve is still published (`cumulative`, `total_pnl_pct`)
  but no longer drawn: on the master most of the capital arrived after the
  losing May–June weeks, so chaining measured those losses against ~1k and
  every later gain against ~6k, and the landing page fell to −17% while the
  dashboard's equity climbed — the owner read that as the site being wrong.
  The accepted cost is the one `roc` always had: a new deposit rescales the
  whole curve (shape intact). **Daily and monthly views stay on the day's-
  capital basis** because those are the figures the Telegram recaps post, and
  a day must read the same on the site and in the channel; each view names its
  basis in a caption under the chart (`CHART_MODES[].note`), so a −13% day
  beside a −2% dip on the cumulative curve reads as two measures, not a bug.
  Every equity curve — hero, by-asset/strategy, landing — snaps a crosshair to
  the nearest trading day; the by-group card puts every series on ONE shared
  date axis (carried forward, one point per trading day) for that, where it
  used to space each line by its own trade count.
- **The landing page shows the LTC/USDT strategy alone** (2026-09-18,
  `LANDING_TRACK_RECORD_SYMBOLS` in `lib/trackRecord.ts`; empty = every
  trade). It requests `?symbols=LTCUSDT`; the API filters the TRADES only —
  the capital stays the whole account's, since every position is backed by
  all of it — and echoes the applied list as `symbols`, which is what the
  section labels itself from (subtitle, chart pill, footnote): a page that
  shows one strategy says so. Names are reduced to `[A-Z0-9]` before
  matching, so one filter covers Binance's `LTCUSDT` and MEXC's `LTC_USDT`.
  The filter is caller-chosen and part of the cache key, hence capped at 5
  and the `/public/*` group throttled 60/min per IP. **The Telegram recaps
  are NOT filtered**: the channel announces every asset's entries and exits,
  so its recap covers every asset — the site and the channel now describe
  two labelled scopes, not one number twice.
