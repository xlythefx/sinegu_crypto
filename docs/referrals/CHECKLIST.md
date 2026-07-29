# Referrals — Implementation Checklist

Ordered build phases. Check items off as they land. Each phase should end green on
`npm run build` + `npm run lint` (frontend) / `php artisan migrate` + a quick route test (backend).

## Phase 1 — Spec docs ✅ (this folder)
- [x] `README.md`, `data-model.md`, `backend-api.md`, `user-dashboard.md`, `admin-dashboard.md`, `CHECKLIST.md`
- [x] Canonical mother spec copied in as `affiliate-rebuild-spec.md`; docs reconciled to it
      (five owned tables, `(referrer, referred, exchange, month)` release key — **not** invoice_id,
      `referral_tracking` table — **not** a `referred_by` column, status derived from accounts +
      overdue invoices — **not** `user_credentials.status`)

## Phase 2 — Backend data model ✅
- [x] Migration `create_referral_codes_table` (UNIQUE user_uni_id, UNIQUE code)
- [x] Migration `create_referral_tracking_table` (UNIQUE (code, referred) + UNIQUE referred)
- [x] Migration `create_referrer_payouts_table`
- [x] Migration `create_referrer_payout_items_table` (**UNIQUE (referrer, referred, exchange, month)**, no invoice FK)
- [x] Migration `create_community_details_table`
- [x] Migrations `create_crypto_wallets_table` + `create_bank_wire_accounts_table`
- [x] Models: `ReferralCode`, `ReferralTracking`, `ReferrerPayout`, `ReferrerPayoutItem`,
      `CommunityDetail`, `CryptoWallet`, `BankWireAccount`
- [x] `php artisan migrate` clean; test referral chain seeded in `sinegu_crypto` (reftest-* users)

## Phase 3 — Backend user API ✅
- [x] `ReferralService` (single status derivation, bcmath commission, network/KPIs/releasable, bind)
- [x] `ReferralController`: `GET /referrals`, `POST /referrals/code`, `GET|POST /referrals/community`,
      `POST /referrals/members/remove`, `GET /referrals/payouts`
- [x] `PayoutMethodController`: `GET /payout-methods`, wallet/bank CRUD, `POST /payout-methods/set-main`
- [x] `AuthController::register` accepts optional `referral_code` (silently ignores invalid; transaction)
- [x] Routes registered under `auth:sanctum`; responses wrapped `{ success, <key> }`
- [x] Verified each endpoint over live HTTP against the seeded chain

## Phase 4 — Backend admin API + release flow ✅
- [x] `AdminReferralController`: overview, ledger, ledger-stats, referrer payouts, referrer releasable,
      per-user referrals
- [x] `POST /admin/affiliate/release` (items = triples; crypto JSON + bank multipart through ONE path;
      DB transaction; per-line re-validation with spec error messages; proof → private disk)
- [x] `DELETE /admin/affiliate/payouts/{id}` (undo, cascade) + `GET .../payouts/{id}/proof` (admin-only download)
- [x] Verified: double-release → 422 whole-request reject; unpaid line → 422; undo → releasable again;
      invoice regeneration does NOT resurrect released lines; non-admin → 403

## Phase 5 — User page `/dashboard/referrals` ✅
- [x] `src/types/referrals.ts`, `src/services/referrals.ts`, `src/services/payoutMethods.ts`,
      `src/lib/referrals.ts` (mappers/formatters only — **no commission math client-side**)
- [x] `src/hooks/useIsMobile.ts` (net-new; cards forced on mobile)
- [x] `src/components/referrals/`: AffiliateKpiStrip (server KPIs), AffiliateHeroCard
      (+ Code/InviteLink/Commission/Community/PayoutMethods blocks), NetworkTable, NetworkCardGrid,
      status pills, ReferralDetailsDialog, RemoveReferralDialog (ConfirmModal), CommunitySetupDialog,
      ReleasedPaymentsTable, WalletWarningAlert, NetworkEmptyState
- [x] `src/pages/Referrals.tsx` (thin, DashboardLayout + useApiData + DataState + 401 guard)
- [x] Route in `App.tsx` before `/dashboard/*`; unhidden nav entry in `TraderSidebar.tsx`
- [x] `Auth.tsx` reads `?ref` → register mode + sends `referral_code`
- [x] Settings payment-method section wired live (wallet/bank add/edit/delete/set-main;
      Stripe card-on-file stays static — no card endpoints yet)
- [x] `fadeup` on tab/filter switch; AOS on scroll-in
- [x] `npm run build` + `npm run lint` green

## Phase 6 — Admin pages ✅
- [x] `src/services/adminReferrals.ts` (multipart release via FormData pattern)
- [x] `src/components/admin/referrals/*` (stat cards, referrer accordion, sub-tabs, ledger table, release steps)
- [x] `src/pages/admin/AdminReferrals.tsx` (overview + ledger tabs, undo via ConfirmModal)
- [x] `src/pages/admin/AdminReleasePayment.tsx` (select triples → method → confirm → receipt)
- [x] Sidebar entry in `AdminSidebar.tsx`; routes in `App.tsx` before `/admin/*`
      (`/admin/referrals/release/:referrerUniId` above `/admin/referrals`)
- [x] `npm run build` + `npm run lint` green

## Phase 7 — QA
- [ ] Responsive check every screen (mobile / tablet / desktop) — PWA rule *(pending in-browser pass)*
- [x] Every mutation (generate code, save community, remove member, release, undo, delete payout method)
      confirmed via ConfirmModal where destructive
- [x] No `capital_com`/`ig` leakage; all exchanges are binance/bybit/mexc from `meta.ts`
- [x] Invite link is `{origin}/auth?ref={code}`; registering through it binds the network edge
      (verified over live HTTP)
- [ ] Theme: renders correctly in dark + light *(token-only styling; pending in-browser pass)*

---

### Deferred / out of scope (note for later)
- Commission **tier auto-growth** (mother's +5%/cap-30%) — intentionally dropped; rate is flat per-user.
- Monthly **auto-generation** of payouts / off-session auto-charge — manual admin release only for now.
- **Community banner/profile image uploads + UI** — columns exist (spec-faithful) but deliberately not
  surfaced; nothing consumes them (invite link lands on `/auth`, which renders no community page).
- Server-side pagination — house style returns full arrays; revisit if networks grow.
