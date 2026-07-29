# SineguAlerts (sinegual-crypto)

Frontend for SineguAlerts — an automated crypto-trading-bot product (users connect Binance / Bybit / MEXC via trade-only API keys; pricing is 20% of profit only).

## Stack

- **Frontend (this repo):** React 19 + TypeScript + Vite (scaffolded with `npm create vite`), `react-router-dom`. Styling is currently **plain CSS with design-token variables** but is **migrating to Tailwind** (see "Styling — migrating to Tailwind" below). Routes: `/` (landing), `/auth` (sign in / register).
- **Backend:** `sinegutrade-api` (Laravel + Sanctum) + MySQL DB `sinegu_crypto`, running locally on WAMP.
  Exchange data lives in `binance_*` tables (accounts, positions, pastpositions, transactions, invoices);
  **`mexc_*` and `bybit_*` tables will be added soon** — keep exchange-specific reads behind API
  endpoints so the new exchanges can be merged in without frontend changes.
- **Deployment (live):** **http://2.24.139.176** — Ubuntu 24.04 Contabo VPS, provisioned
  2026-07-28. nginx serves the React build at `/` and `sinegutrade-api` at `/api` from the
  same origin (`/var/www/sinegualerts/{dashboard,api}`). Deploy with `/deploy` (see
  `.claude/skills/deploy/SKILL.md`). No domain/TLS yet — it answers on the bare IP.

**Supported exchanges (the only brokers) — Binance, Bybit, MEXC.** These three are the
entire universe of exchanges the product supports; there are no others (no Capital.com, no
IG, etc.). Any "broker/exchange" list, filter, badge, or selector must contain exactly these
three. Binance is live; Bybit and MEXC are "Coming soon" until their `bybit_*`/`mexc_*`
tables land. Canonical labels/brand colors/order live in `src/components/exchanges/meta.ts`.

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
  (`/dashboard/exchanges`, from UserBrokers — Binance connect wizard live against
  `/api/exchange/*`; Bybit/MEXC locked "Coming soon"), **Settings**
  (`/dashboard/settings`, from UserProfile — account info/password/sign-out wired to
  `/api/user/*`; payment method, crypto wallets, bank wire still static),
  **Admin Dashboard** (`/admin`, from AdminOverview — master account card, 4 stat cards,
  cumulative P&L chart + date/ticker filters, performance breakdown, daily P&L calendar;
  static prototype data), **Billing & Invoices** (`/dashboard/invoices`, from
  UserInvoicePayment — stat cards + HWM banner, Outstanding/History tabs, exchange filter
  chips, collapsible invoice cards with performance breakdown, "How billing works" sidebar,
  and an in-depth detail page at `/dashboard/invoices/:id`; **wired live** to
  `sinegutrade-api` via `services/billing.ts` + `useApiData`. The trader pay button is still
  a stub — no live Stripe/Coinsbuy yet). Remaining user pages:
  Trading Assets, Referrals; further admin pages (Strategies, ...).

**Invoicing backend (live).** One unified `invoices` table (exchange discriminator
binance|bybit|mexc — renamed from `binance_invoices`, HWM stored on the row).
`InvoiceService` (`generateForAccount` + a single idempotent `settle()`) is the reusable
core; a `PnlSource` adapter per exchange (only `BinancePnlSource` so far). Fees are
mother-style: per-user `realized_percentage × realized + unrealized_percentage × unrealized`
(defaults 20% / 6% on `user_credentials`). Endpoints: user `GET /invoices`,`/invoices/{id}`;
admin `GET/POST/PUT/DELETE /admin/invoices*`. **Admin Invoice History** (`/admin/invoices`)
lists/filters/settles/deletes; **Admin Sandbox → Invoice Testing** generates an invoice from
a user's closed P&L and marks it paid (manual charging). Monthly auto-generation and live
Stripe/Coinsbuy webhooks + off-session auto-charge are deferred phases that reuse
`InvoiceService::settle`.

**Admin access rule:** users whose `user_credentials.type` is `master` or `admin` get an
"Admin Dashboard" button in the trader sidebar footer (above Log out) routing to `/admin`.
`AdminLayout` client-guards the route (logged-in plain users bounce to `/dashboard`); the
role comes from the auth payload (`AuthUser.type`) in the stored session. Client gating is
cosmetic — real enforcement must be added as admin middleware in `sinegutrade-api`.

## Related projects (context only — do not modify unless asked)

**NEVER add or touch code in `sinegu-api`, `sinequal-dash-fusion-main`, or
`C:\Users\Xlythe\trading-flask`.** They are read-only reference material,
consulted only when explicitly prompted.

| Path | Role |
|---|---|
| `C:\Users\Xlythe\sinequal-dash-fusion-main` | **Mother project.** Use only as context/reference when prompted. |
| `C:\wamp64\www\sinegu-api` | **Mother API.** Consult ONLY when explicitly prompted — it is legacy spaghetti code. Never use it as the sole reference or copy its architecture; at most a lookup for domain facts (field names, business rules). |
| `C:\wamp64\www\sinegutrade-api` | **This project's API** (Laravel + Sanctum, DB `sinegu_crypto`). Live: auth, profile/password, dashboard summary, binance positions/past-positions. `mexc_*`/`bybit_*` tables coming soon. |
| `C:\Users\Xlythe\trading-flask` | **Original bot engine — READ-ONLY, NEVER WRITE.** Copied into this repo as `trading-flask/` (see below). All edits go to the in-repo copy; this folder is never modified, not even its `.env`. |

## `trading-flask/` — the bot engine (in this repo)

**This repo holds two codebases.** The React frontend at the root, and the Python
trading engine in `trading-flask/` — copied in from `C:\Users\Xlythe\trading-flask`
so both live in one repo and can be read together.

> **`trading-flask/` in THIS repo is the only copy you may edit.**
> `C:\Users\Xlythe\trading-flask` is read-only — never write to it, never
> `sed`/edit/create files there, and that includes its `.env`. If a change needs
> to reach the original (secrets, deploy config), make it here and tell the user
> to copy it across themselves. When in doubt, check the path you are writing to
> starts with `c:\Users\Xlythe\sinegual-crypto\`.

`trading-flask/` is the thing that actually places trades: a Flask webhook receiver
per exchange (TradingView posts signals to it), plus pollers that push positions,
balances, past positions and transactions **into the same `sinegu_crypto` data this
frontend reads**. That makes it the upstream of the whole product — when a number
looks wrong on a dashboard page, the answer is usually here or in `sinegutrade-api`.

```
trading-flask/
├── src/                  # Binance (normal, balance >= 500 USDT)
├── binance_lite_src/     # Binance Lite (100 <= balance < 500 USDT)
├── bybit_src/            # Bybit
├── mexc_src/             # MEXC
├── *_tradingbot.py       # Tkinter launchers (one per exchange)
├── plan/                 # architecture notes (01-overview … 06-run-instructions)
├── api-docs/, binance-docs/   # exchange API reference
├── tests/                # pytest
└── .env.example          # every config key; real .env is gitignored
```

| Service | Port | Webhook |
|---|---|---|
| Binance | 5000 | `/binance_webhook` |
| MEXC | 5001 | `/mexc_webhook` |
| Bybit | 5002 | `/bybit_webhook` |
| Binance Lite | 5003 | `/binance_lite_webhook` |

**Naming trap — `src/` is ambiguous in this repo.** Root `src/` is the React app;
`trading-flask/src/` is the *Binance Flask service*. Always say which one you mean,
and never let Python and TypeScript conventions bleed across the boundary.

**Not copied over** (deliberately, they hold credentials or bulk): the real `.env`
(kept gitignored — the values still live in the original folder), `out/`
(SSH/deploy probe scripts), `deploy_position_upsert.py` (embedded host credentials),
and ~50 MB of `headless/*.log`. Frontend tooling ignores this folder —
`tsconfig.app.json` only includes root `src`, and oxlint is JS/TS only.

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

## .claude setup

- `.claude/settings.json` — permission allow-list (npm/tsc, php artisan/composer, deploy script). No secrets in it, ever.
- **Two agents live in `.claude/agents/`** — one for frontend, one for backend:
  - `.claude/agents/frontend.md` — frontend specialist for this repo (React conventions above).
  - `.claude/agents/backend.md` — backend specialist pointing at `C:\wamp64\www\sinegutrade-api` (Laravel), using `sinegu-api` as read-only reference.
- `.claude/skills/deploy/SKILL.md` — deployment procedure (`/deploy`), driving `.claude/deploy_sinegualcrypto.py`. **Live at http://2.24.139.176** (Ubuntu 24.04); the skill holds the flow (backup → build → upload → verify). Credentials live in gitignored `.claude/deploy.creds.json` only; never in committed files, and never use the mother project's servers from this repo.

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
