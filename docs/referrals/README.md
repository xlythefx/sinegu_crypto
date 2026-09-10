# Referrals / Affiliate — Feature Spec

Spec set for porting the **Affiliate / Referrals** feature (user + admin) from the mother
project (`sinequal-dash-fusion-main`) into **Pixel Alpha** (`sinegual-crypto` frontend +
`sinegutrade-api` Laravel backend).

> **Status:** spec only — nothing built yet. Implementation is phased; see [CHECKLIST.md](./CHECKLIST.md).
> **UI-only port rule:** recreate the mother's *design* with this repo's stack/conventions —
> never copy its code, hooks, API layers, or data logic.

## What this feature is

Users get a personal **referral code + invite link**. Anyone who registers through it joins their
**network**. When a referred trader is billed a performance fee, the referrer earns a
**commission** = `fee × affiliate_percentage / 100`. Admins **release** those commissions as
monthly **payouts** (USDT-TRC20 or bank wire), tracked in a ledger with an undo.

## Documents

| File | Contents |
|---|---|
| [data-model.md](./data-model.md) | DB schema + migrations (`sinegutrade-api`) |
| [backend-api.md](./backend-api.md) | Endpoints, controllers, `ReferralService`, commission math |
| [user-dashboard.md](./user-dashboard.md) | `/dashboard/referrals` page + component spec |
| [admin-dashboard.md](./admin-dashboard.md) | Admin affiliate console + release-payment flow |
| [CHECKLIST.md](./CHECKLIST.md) | Master ordered implementation checklist |

## Design decisions (locked)

- **Scope:** full stack, **user + admin**.
- **Fidelity:** **full parity** with the mother — community profiles, released-payments ledger,
  admin release with crypto/bank proof + undo. Canonical behaviour source:
  [affiliate-rebuild-spec.md](./affiliate-rebuild-spec.md).
- **Commission:** **flat per-user %**, reusing the existing `user_credentials.affiliate_percentage`
  column (default `20.00`, admin-editable later). **No tier auto-growth** — the mother's
  "+5% steps, cap 30%" logic is **dropped**. The commission card still displays the rate; it just
  doesn't compute a "next tier".
- **Release identity = `(referrer, referred_user, exchange, month_year)` triples**, never invoice ids —
  payout history must survive invoice regeneration without enabling double-pays (spec §6.10).
- **Status derived once** (spec §2): `new` = no exchange accounts; internal `overdue` = any invoice
  pending-past-due **or `status IN ('overdue','failed')`** (failed charge counts as overdue — this-repo
  decision); else `active`. Labels per surface: admin `overdue` ≡ user `suspended`.
- **Server owns every number** (spec §6.1) — the frontend never computes commission; `GET /referrals`
  returns server-computed KPIs (`lifetime_earnings`, `pending_payout`, `projected_commission`, `your_fee`).
- **One network per user** — `UNIQUE(referred_user_uni_id)` on `referral_tracking` (closes the
  two-referrer double-pay hole the mother spec leaves open).
- **Community banner/profile image:** columns kept, uploads/UI deliberately NOT built (nothing consumes
  them — the invite link lands on `/auth`).
- **Admin stat cards de-duplicated:** Fees sent (ledger count+amount) · Fees yet to be released
  (Σ releasable) · Fees left to be paid (Σ projected commission on unpaid invoices) · Users still not
  paid (count of referrers with releasable).
- **Payout methods go live:** real `crypto_wallets` / `bank_wire_accounts` tables + Settings page wiring
  (add/edit/delete/set-main) — a prerequisite of the admin release screen.

## Domain adaptation rules (apply everywhere)

| Mother | This repo |
|---|---|
| brokers `capital_com`, `binance`, `ig` | **exchanges `binance`, `bybit`, `mexc`** |
| broker labels | canonical labels/colors from [`src/components/exchanges/meta.ts`](../../src/components/exchanges/meta.ts) — Binance live; Bybit/MEXC "coming soon" |
| invite link `/user-register?ref={code}` | **`{origin}/auth?ref={code}`** |
| amber-500 accent literals | this repo's **Tailwind design tokens** (`bg-surface`, `text-accent`, `rounded-card`, …) + dark/light theme |
| framer-motion entrances | **AOS** on scroll-in + `fadeup` keyframe on tab/filter switches |
| shadcn `AlertDialog` for destructive actions | **`ConfirmModal`** ([`src/components/ui/ConfirmModal.tsx`](../../src/components/ui/ConfirmModal.tsx)) |

Commission is a share of each referred trader's **performance fee** = `invoices.total_fee`.
Payouts are **monthly**; crypto tx hashes link to **Tronscan** (`https://tronscan.org/#/transaction/{hash}`).

## Phase roadmap (see CHECKLIST for detail)

1. Spec docs (this folder)
2. Backend data model — migrations + models
3. Backend user API — `ReferralService` + `ReferralController`
4. User page — `/dashboard/referrals`
5. Payout-methods prerequisite (crypto wallets + bank-wire accounts)
6. Backend admin API — `AdminReferralController` + release/undo
7. Admin pages — `AdminReferrals` + `AdminReleasePayment`
8. QA — responsive + build/lint
