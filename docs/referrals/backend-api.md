# Backend API — Referrals

Backend: `C:\wamp64\www\sinegutrade-api` (Laravel + Sanctum, DB `sinegu_crypto`).
Canonical behaviour source: [affiliate-rebuild-spec.md](./affiliate-rebuild-spec.md) §2/§5/§6.

## Conventions (match existing endpoints)

- Every response wrapped: `{ "success": true, "<key>": ... }`. Errors → non-2xx +
  `{ success:false, error_code, message }`. 422 business-rule, 404 missing/ownership, 403 role.
- User routes in `routes/api.php` under the `auth:sanctum` group. Admin routes inside the existing
  `Route::prefix('admin')->middleware('admin')` group (`EnsureAdmin` — real auth, spec §6.6).
- Frontend service layer unwraps `{ success, <key> }` and maps to domain types
  (see [`src/services/billing.ts`](../../src/services/billing.ts) for the pattern).
- Centralize all derivation + commission math in **one `ReferralService`** (mirrors `InvoiceService`).
  Controllers stay thin. **The client never does commission math** (spec §6.1).

## `ReferralService` — single source of truth

```
commission(fee, pct)   = bcmath: fee × pct / 100 at 8 dp (strings, never floats); null pct → 0
network(referrer)      = referral_tracking WHERE referrer_uni_id = referrer
paidInvoices(user)     = invoices WHERE user_id = user AND status = 'paid'
releasable(referrer)   = paid invoices of tracked users with NO referrer_payout_items row for
                         (referrer, referred_user, exchange, month_year)
released(referrer)     = rows in referrer_payout_items
```

**Member status — derived ONCE (spec §2), one rule, two labels:**
```
no non-deleted rows in {exchange}_accounts        -> "new"
any invoice (status='pending' AND due_date<today)
          OR status IN ('overdue','failed')       -> internal "overdue"
otherwise                                         -> "active"
```
Presenters map the middle state: **admin surface = `overdue`, user surface = `suspended`.**
(`failed` counting as overdue is a deliberate this-repo decision — a failed charge is unpaid money.)
`user_credentials.status` is NOT part of this derivation.

Per-referral **payment_release_status**: `n_a` (no paid invoices) / `paid` (all released) /
`partial` (some) / `pending` (none released).

**Release integrity (the money rules, spec §2):** on release, per triple, the server re-checks inside a
DB transaction and rejects the WHOLE request if the line was already released
(`"Item already released: {exchange} {month} for {user}"`) or has no paid invoice behind it
(`"No paid invoice for {exchange} {month} / {user}"`). The `uq_payout_items_line` unique key is the
final backstop. Commission is frozen into the items at this moment.

## User endpoints — `ReferralController`

| Method | Route | Body / Query | Returns (`success` +) |
|---|---|---|---|
| GET | `/referrals` | — | `code, referral_id, affiliate_percentage, community, stats, referrals[]` |
| POST | `/referrals/code` | — | `code` (generates if absent; idempotent) |
| GET | `/referrals/community` | — | `community` (null unless set) |
| POST | `/referrals/community` | `{ community_name, bio }` (both required) | `community` |
| POST | `/referrals/members/remove` | `{ referred_user_uni_id }` | `ok` (deletes the tracking row) |
| GET | `/referrals/payouts` | — | `payouts[]` (the caller's released envelopes) |

**`stats` is fully server-computed** (spec §6.1 — no client estimates):
```jsonc
"stats": {
  "total_referrals": 3,
  "active_referrals": 2,
  "lifetime_earnings": 182.50,      // Σ total_amount of the caller's paid envelopes
  "last_payout_at": "2026-06-30",   // null when no payouts yet
  "pending_payout": 24.11,          // Σ releasable commission (paid invoices, not yet released)
  "projected_commission": 9.87      // Σ commission on unpaid (pending/overdue/failed) invoices
}
```

**`referrals[]` item** (server-computed money fields; `your_fee` replaces the mother's client-side
`last_earnings × pct` estimate):
```jsonc
{
  "user_uni_id": "...", "name": "...", "referred_at": "2026-05-01 10:00:00",
  "status": "active",                       // new | active | suspended  (user-surface label)
  "last_earnings": 12.34, "last_earnings_month": "2026-06",   // latest PAID invoice fee
  "fee": 61.70,                             // latest PENDING invoice fee
  "your_fee": 12.34,                        // server-computed commission on last_earnings
  "payment_status": "paid",                 // status of latest invoice if pending/paid, else null
  "payment_release_status": "partial",      // paid | partial | pending | n_a
  "broker_breakdown": [{
    "exchange": "binance", "paid_fee": 61.70, "pending_fee": 0,
    "paid_commission": 12.34, "pending_commission": 0,
    "released_commission": 6.0, "unreleased_commission": 6.34, "has_overdue": false
  }],
  "realized_pnl": 300.0, "unrealized_pnl": 40.0,              // binance_pastpositions / positions
  "realized_percentage": 20, "unrealized_percentage": 6
}
```

`POST /referrals/code` generates an 8-char uppercase unique code (collision-retry `do/while`, the
`SandboxController` idiom). The invite link is built **frontend-side** as `{origin}/auth?ref={code}`.

**Registration binding** (`AuthController::register`): optional `referral_code` — looked up in
`referral_codes`; invalid codes **silently ignored** (NOT `exists`-validated); self-referral blocked;
user-create + tracking-insert wrapped in one `DB::transaction`.

## Payout methods — `PayoutMethodController` (user, `auth:sanctum`)

| Method | Route | Body | Returns |
|---|---|---|---|
| GET | `/payout-methods` | — | `wallets[], bank_accounts[]` |
| POST | `/payout-methods/wallets` | `{ network, address, name }` | `wallet` |
| PUT | `/payout-methods/wallets/{id}` | same (ownership-checked) | `wallet` |
| DELETE | `/payout-methods/wallets/{id}` | — | `ok` |
| POST/PUT/DELETE | `/payout-methods/banks[/{id}]` | bank fields | `bank_account` / `ok` |
| POST | `/payout-methods/set-main` | `{ type: 'wallet'\|'bank', id }` | `ok` (clears other is_main of that type) |

## Admin endpoints — `AdminReferralController` (inside `prefix('admin')->middleware('admin')`)

| Method | Route | Body / Query | Returns |
|---|---|---|---|
| GET | `/admin/affiliate/overview` | — | `referrers[]` |
| GET | `/admin/affiliate/ledger` | — | `payouts[]` (all, newest first, referrer name/email joined) |
| GET | `/admin/affiliate/ledger-stats` | — | `total_sent_count, total_sent_amount` |
| GET | `/admin/affiliate/referrers/{uni}/payouts` | — | `payouts[]` (one referrer, lazy sub-tab) |
| GET | `/admin/affiliate/referrers/{uni}/releasable` | — | `releasable_items[], referrer_wallets[], bank_wire_accounts[], referrer_name, referrer_code, affiliate_percentage` |
| POST | `/admin/affiliate/release` | see below | `payout` (created envelope + items) |
| DELETE | `/admin/affiliate/payouts/{id}` | — | `ok` (undo — cascade deletes items) |
| GET | `/admin/affiliate/payouts/{id}/proof` | — | file download (private disk, admin-only) |
| GET | `/admin/affiliate/users/{uni}/referrals` | — | `referrals[]` (read-only per-user listing) |

**`overview` → each `referrers[]` item:** `referral_id, code, user_uni_id, referrer_name,
referrer_email, affiliate_percentage, referrals[]` (admin-surface labels — middle status = `overdue`),
`referrer_overdue, referrer_pending, total_commission_earned, has_released, has_releasable,
releasable_commission_total`. Built with `whereIn` sidecar queries — no per-referral N+1 (spec §6.3).

**Admin stat sources:** Fees sent = ledger-stats · Fees yet to be released = Σ `releasable_commission_total`
· Fees left to be paid = Σ projected commission on unpaid invoices · Users still not paid = count of
referrers with `has_releasable`.

**`POST /admin/affiliate/release`** — items are ALWAYS triples
`[{ referred_user_uni_id, exchange, month_year }]` (never invoice ids — spec §6.10). One controller
path validates both encodings (spec §6.4):
- **Crypto** (JSON): `{ referrer_uni_id, items:[...], total_amount, payout_address, tx_hash }`
  → `payment_method='crypto'`, `tx_hash` required.
- **Bank wire** (multipart/form-data): `referrer_uni_id, items (JSON string), total_amount,
  payout_address, payment_method='bank_wire', proof_file` (JPEG/PNG/GIF/WebP/PDF ≤ 5 MB)
  → stored on the **private `local` disk** under `referral-proofs/`, served only via the proof route.
- Whole request wrapped in `DB::transaction`; envelope `month_year` = single common month else `null`.

**`DELETE /admin/affiliate/payouts/{id}`** — deletes the envelope; items cascade → those lines become
releasable again. This is the only rollback ("Undo").
