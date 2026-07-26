# Handoff: SineguAlerts — Concept 4 (Hybrid Landing + Auth)

## Overview
SineguAlerts is an automated crypto-trading-bot product. Users connect their own exchange
account (Binance / Bybit / MEXC) via trade-only API keys; SineguAlerts runs strategies on that
account and charges **20% of profit only** — the core positioning throughout the funnel.

This package covers **Concept 4 ("Hybrid")** — a fusion of a Bloomberg-terminal data aesthetic
with a warm, rounded, newcomer-friendly layout. It has two deliverables:

1. **Landing page** — full marketing funnel, with a working **light/dark theme toggle**.
2. **Auth page** — combined Sign In / Create Account in one view with a slide toggle.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the
intended look and behavior, **not production code to copy directly**. They are authored in a
lightweight in-house component format (`.dc.html` + a `support.js` runtime) purely for
prototyping.

Your task is to **recreate these designs in the target codebase's existing environment** (React,
Vue, Svelte, etc.) using its established patterns, component library, and styling approach. If no
frontend environment exists yet, choose the most appropriate framework and implement there. Do
**not** ship the `.dc.html` files or `support.js`.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interactions are final. Recreate the UI
pixel-perfectly. All exact values are in [Design Tokens](#design-tokens).

---

## Screens / Views

### 1. Landing Page — `Concept 4 - Hybrid (Light + Dark).dc.html`

Single scrolling page, max content width **1280px**, centered, 40px side padding. Sections are
separated by generous vertical padding (~52–76px). Theme is driven by a `data-theme` attribute on
the page root (`"dark"` default, `"light"`), all colors resolved through CSS variables.

Section order, top to bottom:

**a. Ticker tape (signature)**
Full-width bar, `--surface2` bg, 1px `--hair` bottom border. A single horizontal row of
monospace price quotes (BTC/USD, ETH/USD, SOL/USD, SINEGU USERS, AVG ROI, FUNDING) scrolling
right-to-left infinitely. Implemented as a flex row duplicated once and translated -50% over 42s
linear infinite (`@keyframes tick`). Up ticks in `--green`, down ticks in `--red`. 12.5px IBM Plex
Mono.

**b. Nav**
Flex row, space-between, wraps at small widths. Left cluster: logo mark (24px gold rounded-corner
square, rotated -8°) + "SineguAlerts" wordmark (Bricolage Grotesque 800, 20px) + text links
(Structure, Exchanges, Pricing — 14px Jakarta 500, `--muted`). Right cluster: **theme toggle**
button (pill, mono, shows ☀/Light in dark mode and ☾/Dark in light mode), "Sign in" text, and a
"Start free" primary pill button (`--accent` bg, white text).

**c. Hero**
Two-column grid `1.05fr .95fr`, 56px gap, ~64px vertical padding.
- Left: a small live pill badge ("48,200+ traders copying live signals right now" with a pulsing
  green dot), an H1 (Bricolage 800, 60px, -0.03em: "Pro-grade trading bots." / gold "Keep 80% of
  the upside."), an 18px `--muted` sub-paragraph, two buttons (primary "Start free →" pill + a
  `--surface` outline "See live results" pill), and a mono trust row (◆ Free to use · ◆ Pay only
  20% of profit · ◆ Funds stay on your exchange).
- Left column fades up on load (`@keyframes fadeup`, .8s). A soft radial gold glow drifts behind
  it (`@keyframes drift`, 14s).
- Right: **BTC-PERP order-book panel** (the hero signature). Card (`--surface`, 1px `--border`,
  20px radius, big shadow). Header: "BTC-PERP", green price 68,412.50, a gold pill tag
  **"Z-Score Reversion #2"**, and "24h Vol 1.2B · ● matching". Body: two-column bid/ask ladder
  (mono 12px; bids green, asks red) with proportional depth backgrounds behind each row. Footer:
  a 9-bar depth histogram (green → gold mid → red) with -0.5% / MID / +0.5% labels.

**d. Performance Analytics (centered)**
Centered heading "See every trade, verified" + sub. Then a 6-up stat card grid (Total P&L +42.9%,
Win Rate 71.3%, Total Trades 4,182, Avg Daily P&L +0.34%, Avg Win PNL +3.50%, Avg Loss PNL
−1.64%). Below, a large chart card titled "Performance Analytics" with an icon chip, a 3-tab bar
(Cumulative P&L active / Daily P&L / Date Range), a left $-axis label column, and an SVG
cumulative-P&L line chart: gold stroke, gold→transparent area fill, dashed "Deposit Amount"
baseline, and dated month ticks along the bottom. The line self-draws via `@keyframes draw`
(stroke-dashoffset 1000→0, 2.6s), and an end dot fades in after.

**e. Features**
Centered heading "Built to trade for you" + sub. 4-up card grid: Proven strategies, Trades 24/7,
Your funds/your keys, Aligned pricing. Each card: `--surface`, 1px `--border`, 20px radius, a
48px `--accentSoft` icon chip with mono glyph, Bricolage 18px title, 13.5px `--muted` body.

**f. Comparison / "The Receipts"**
Centered kicker "[ THE RECEIPTS ]", heading "We don't talk. We deliver results.", sub. Below: a
row of **4 vertical bars** (900px max, 440px tall, 16px gap) representing our strategies' avg
monthly ROI over 90 days:
- Z-Score Reversion #2 → +11.4% (74% height)
- ATR Reversion #1 → +9.8% (62%)
- Momentum Strategy → +8.6% (55%)
- **SineguAlerts blended → +12.9% (96%, highlighted in `--accent`)** with a "blended, 90d" tooltip chip.
Bar track: `--surface2` with a diagonal candy-stripe pattern (12px linear-gradient) + 1px border,
28px radius. Fill bar grows from bottom via `@keyframes grow` (scaleY 0→1, staggered .2s / .5s).
Value shown in a translucent pill inside each bar. Non-highlighted bars use `--muted`; label rows
show a small accent dot (or the logo mark on the highlighted bar).

**g. How it works**
Centered heading "Profitable in four steps". 4-up card grid, mono step numbers 01–04 in gold:
Connect your exchange → Pick a strategy → Bots trade for you → **Keep 80%** (4th card has an
`--accentSoft`→`--surface` gradient + `--accentLine` border).

**h. Exchanges + testimonials**
Mono caption "WORKS DIRECTLY WITH YOUR EXCHANGE — YOUR FUNDS NEVER LEAVE IT". 3-up cards:
Binance / Bybit / MEXC (Bricolage 22px + "Spot & Futures API" mono sub). Below, two 5-star
testimonial cards (Marcus T., Elena R.).

**i. Final CTA (bull parallax)**
Full-bleed section. Background = two dark gradient scrims **over** `assets/bull.png`, all three
layers set to `background-attachment: fixed` to create the parallax (image holds still while
content scrolls over it). No border radius, breaks out of the 1280 column. Mono pill "NO CARD ·
NO MINIMUM · CANCEL ANYTIME", Bricolage 56px white headline "Take the other side of the market.",
sub, two buttons, and a mono trust strip (48,200+ traders · $128M profit · funds stay on your
exchange). Text always uses light colors here (dark scrim in both themes).

**j. Footer**
1px `--hair` top border. 4-column grid: brand blurb + Product / Resources / Company link columns.
Mono bottom bar: "© 2026 SINEGUALERTS · ALL SYSTEMS OPERATIONAL ●" + responsive note.

### 2. Auth Page — `Concept 4 - Auth (Login + Register).dc.html`

Centered split card, max-width **960px**, two equal columns, 24px radius, min-height 600px, fades
up on load. Theme toggle pill top-right; **"← Home"** link top-left (routes to the landing page).

- **Left column (form):** logo + wordmark, an H1 title and sub that swap by mode, a row of 3
  social buttons (Google / X / GitHub — outline squares that fill with `--accent` and lift on
  hover), an "or …" divider, then the form. **Sign In** = Email, Password, "Forgot your
  password?", "Sign In" button, "Don't have an account? Create one free". **Create Account** adds
  a **Full name** field at top and **Confirm password** below, CTA "Create free account", swap
  link "Already trading with us? Sign in". Inputs: 48px tall, `--surface2` bg, 1px `--border`,
  12px radius; on focus → `--accent` border + 3px `--glow` ring. Primary button: `--accent` bg,
  `--onAccent` text, lifts on hover. A radial gold glow follows the mouse inside this column
  (opacity 0 until hover).
- **Right column (brand panel):** `--accentSoft`→`--surface2` diagonal gradient, rising bubble
  orbs, a mono kicker, a Bricolage title + body that swap by mode, and a 3-up stat row (48.2K
  traders · $128M profit · 20% our cut). No stock imagery.

---

## Interactions & Behavior

- **Theme toggle** (both pages): flips `data-theme` between `dark`/`light` on the page root. All
  colors are CSS variables, so the whole page transitions (`background`/`color` .4s ease). Persist
  choice in `localStorage` under key `sinegu-theme`; read on mount. Default dark.
- **Auth mode toggle:** swaps all copy, shows/hides Full name + Confirm password, swaps the right
  panel message. Pure client state, no route change. Forms `preventDefault` on submit (wire to
  real auth in the codebase).
- **Auth mouse glow:** on mousemove over the form column, position a blurred radial gold glow at
  the cursor; fade in on enter, out on leave.
- **Scroll reveals (landing):** AOS (`fade-up`, duration 700, once true, offset 80,
  ease-out-cubic). Comparison bars use staggered `data-aos-delay`. Recreate with your codebase's
  scroll-reveal utility or IntersectionObserver — don't pull in AOS if the app already has one.
- **On-load / self-drawing animations:** ticker scroll (42s), hero fade-up + glow drift, SVG line
  draw (2.6s stroke-dashoffset), bar grow (scaleY, staggered), rising bubbles. Keyframes:
  `tick`, `pulse`, `draw`, `travel`, `drift`, `fadeup`, `grow`, `bubble`.
- **Parallax:** final-CTA bull uses `background-attachment: fixed`. If you prefer a JS/transform
  parallax in-app, translate the image layer by a fraction of scroll — visually match "image
  holds while content scrolls over it."

### Responsive
Desktop-first at 1280px. Collapse guidance: multi-column grids (hero, stats 6-up, features 4-up,
how-it-works 4-up, comparison bars, footer) step down to 2-col then 1-col by ~900px; nav wraps its
two clusters; ticker persists; hero order-book panel drops below the copy; auth split card
stacks to a single column (form above brand panel) on mobile.

## State Management
- `theme`: `'dark' | 'light'` — persisted to `localStorage['sinegu-theme']`.
- `mode` (auth only): `'signin' | 'register'`.
- Auth glow: cursor x/y + hover boolean (transient, view-only).
- No data fetching in the prototype. In production: ticker/order-book/chart/testimonials/stats are
  all data-driven — back them with your market-data + analytics APIs. Bar heights are
  `value → % of max`.

## Design Tokens

CSS variables (dark → light):

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0a0c11` | `#faf7f1` |
| `--surface` | `#0f1319` | `#ffffff` |
| `--surface2` | `#0b0e13` | `#fbf8f2` |
| `--border` | `#1f2732` | `#ece2d2` |
| `--hair` | `#161d26` | `#f0e8db` |
| `--text` | `#e7ecf3` | `#1b1712` |
| `--muted` | `#8b94a3` | `#6f6a60` |
| `--faint` | `#5b6472` | `#9a9284` |
| `--accent` | `#d9ad55` | `#b8862a` |
| `--accentSoft` | `#17130a` | `#fdf5e4` |
| `--accentLine` | `#4a3c1c` | `#ecd9ab` |
| `--green` | `#2fd67a` | `#0fae76` |
| `--red` | `#ff5a5a` | `#e0492b` |
| `--onAccent` | `#0a0c11` | `#ffffff` |
| `--glow` | `rgba(217,173,85,.16)` | `rgba(184,134,42,.12)` |

Auth extras: `--glow` is bumped to .22/.18; `--onAccent` used for text on gold buttons.
Landing extras: `--bgScrim` (`rgba(10,12,17,.965)` / `rgba(250,247,241,.95)`) and `--bubble`
(`rgba(217,173,85,.10)` / `rgba(184,134,42,.08)`) for the subtle page backdrop + bubbles.

**Typography**
- Display / headings: **Bricolage Grotesque** 600/700/800 (Google Fonts).
- Body / UI: **Plus Jakarta Sans** 400/500/600/700.
- Data / labels / tags: **IBM Plex Mono** 400/500/600.
- Key sizes: hero H1 60px/-.03em; section H2 38–40px/-.02em/800; card titles 17–18px/700; body
  16–18px; captions/labels 11–14px; stat numbers 26–34px/800.

**Spacing** — 40px page gutters; section vertical padding 52–76px; card padding 20–28px; grid
gaps 14–18px; hero column gap 56px.

**Radius** — pills/buttons 100px; cards 16–22px; small chips/inputs 10–14px; logo mark
`8px 8px 8px 2px` (rotated -8°).

**Shadows** — cards `0 30px 80px rgba(0,0,0,.14–.18)`; primary button `0 10–12px 24–30px var(--glow)`.

## Assets
- `assets/hero-wallst.png` — Wall Street / NYSE photo, used as a very subtle fixed page backdrop
  (heavy `--bgScrim` over it) on the landing page. User-provided.
- `assets/bull.png` — Charging Bull photo, full-bleed background of the final-CTA parallax section.
  User-provided.
- Logo is CSS-only (rotated rounded gold square) — no image asset needed.
- Exchange names (Binance/Bybit/MEXC) render as text in this concept. If you want real logos,
  source official brand marks in the codebase.
- Auth social icons (Google/X/GitHub) are inline SVGs — replace with your icon library.
- No stock photography beyond the two user-provided backdrops.

## Files
- `Concept 4 - Hybrid (Light + Dark).dc.html` — landing page reference.
- `Concept 4 - Auth (Login + Register).dc.html` — auth (login + register) reference.
- `assets/hero-wallst.png`, `assets/bull.png` — background images.

> The `.dc.html` files are prototypes in an in-house format. Open them in a browser to observe
> behavior, but reimplement the UI in your codebase's framework — do not ship them.
