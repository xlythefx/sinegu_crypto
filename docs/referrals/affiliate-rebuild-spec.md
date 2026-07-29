# Affiliate System — Rebuild Specification

Portable spec for re-implementing the affiliate/referral system (user side + admin side)
on a new stack (e.g. Laravel API + React frontend). **No source paths on purpose** — this
document describes *what the system does and stores*, not where the old code lives.
Derived by reading the current PHP endpoints, SQL schemas and both React surfaces.

The system has two faces over one data model:

- **User side** — a trader shares a referral code, sees their network, their commission,
  and payouts they've received.
- **Admin side** — operators see every referrer, what commission is owed, release payouts
  (crypto or bank wire) with proof, and audit the ledger.

Money flow in one sentence: *a referred trader pays a performance-fee invoice → a fixed
percentage of that fee becomes the referrer's commission → an admin releases it as a
payout with proof → both sides see it in their ledgers.*

---

## 1. Data model

### Tables owned by the affiliate system

**`referral_codes`** — one row per referrer.
| column | type | notes |
|---|---|---|
| referral_id | int PK AI | |
| code | varchar(50) **UNIQUE** | the shareable code |
| user_uni_id | varchar(255) | the referrer (→ users) |
| created_at / updated_at | timestamp | |

**`referral_tracking`** — one row per referred user (the network edge).
| column | type | notes |
|---|---|---|
| tracking_id | int PK AI | |
| referral_code | varchar(50) | |
| referrer_uni_id | varchar(255) | |
| referred_user_uni_id | varchar(255) | |
| created_at | timestamp | "referred at" |
| | | **UNIQUE (referral_code, referred_user_uni_id)** |

**`referrer_payouts`** — one envelope per admin release action.
| column | type | notes |
|---|---|---|
| id | int unsigned PK AI | |
| referrer_uni_id | varchar(255) | |
| month_year | char(7) NULL | representative period; NULL when the envelope spans months |
| total_amount | decimal(12,2) | USD released (audit figure) |
| payout_address | varchar(255) | crypto address or bank label |
| tx_hash | varchar(255) NULL | blockchain proof (crypto) |
| paid_at | datetime | when admin confirmed |
| status | enum pending/paid/rejected, default **paid** | |
| payment_method | enum crypto/bank_wire, default crypto | |
| proof_file | varchar(500) NULL | uploaded proof (bank wire) |
| created_at | datetime | |

**`referrer_payout_items`** — the released lines inside an envelope.
| column | type | notes |
|---|---|---|
| id | int unsigned PK AI | |
| payout_id | FK → referrer_payouts.id **ON DELETE CASCADE** | |
| referrer_uni_id / referred_user_uni_id | varchar(255) | |
| broker | enum capital_com/binance/ig | |
| month_year | char(7) | YYYY-MM |
| fee_paid | decimal(20,8) | the invoice total_fee behind this line |
| commission | decimal(20,8) | fee_paid × pct/100 **frozen at release time** |
| released_at / created_at | datetime | |
| | | **UNIQUE (referrer_uni_id, referred_user_uni_id, broker, month_year)** |

**`community_details`** — optional public profile per referral code.
| column | type | notes |
|---|---|---|
| community_id | int unsigned PK AI | |
| referral_id | FK → referral_codes **UNIQUE, ON DELETE CASCADE** | 1:1 with code |
| community_name | varchar(255) | required |
| profile_banner / profile_image | varchar(500) NULL | upload endpoints exist; old UI never surfaced them |
| bio | text | |
| created_at / updated_at | timestamp | |

### Tables read (owned elsewhere)

| table | role here |
|---|---|
| `user_credentials` | user identity; **`affiliate_percentage`** (the commission rate) lives here, per referrer |
| `billing_periods` | Capital.com invoices (user_id = uni_id, month_year, total_fee, status, due_date) |
| `binance_invoices` | Binance invoices, same shape |
| `ig_invoices` | IG invoices, same shape |
| `accounts` | "does the referred user have any trading account yet" (drives status `new`) |
| `crypto_wallets` | referrer's saved payout wallets (id, network, address, name, is_main 0/1) |
| `bank_wire_accounts` | referrer's saved bank accounts (label, bank_name, currency, iban, swift_bic, …, is_main 0/1) |
| `trades` | per-referral realized/unrealized P&L shown in the user-side details dialog |

**Broker → invoice table map** (used everywhere commission is computed):
`capital_com → billing_periods` · `binance → binance_invoices` · `ig → ig_invoices`.
All three share the columns that matter: `user_id` (uni_id), `month_year`, `total_fee`,
`status` (pending/paid/…), `due_date`.

---

## 2. Core business rules

### Commission
```
commission(invoice) = invoice.total_fee × referrer.affiliate_percentage / 100
```
- The percentage is **per referrer**, stored on their user row. May be null/0 → no commission.
- Live figures (owed, pending) are computed on the fly from paid/pending invoices.
- **At release time the commission is frozen** into `referrer_payout_items.commission`.
  Later invoice edits or percentage changes must not alter already-released history.

### Referral status — one rule, two vocabularies
Both surfaces derive the same status; only the *label* differs:

```
no rows in accounts for the user      -> "new"
any pending invoice past its due_date -> admin: "overdue"   user: "suspended"
otherwise                             -> "active"
```
> The old system implemented this twice with different words for the middle state.
> In the rebuild, derive it **once** and map to per-surface labels in the presenter.

### Releasable = paid, not yet released
A (referred user, broker, month) line is **releasable** when:
1. its invoice `status = 'paid'`, and
2. no `referrer_payout_items` row exists for
   `(referrer, referred_user, broker, month_year)`.

Pending invoices produce *projected* commission (shown, never releasable).
Released items are excluded from every "yet to be released" figure.

### Release integrity (the money rules)
On release, per item, the server re-checks and **rejects the whole request** if:
- the item was already released (unique key above) →
  `"Item already released: {broker} {month} for {user}"`
- there is **no paid invoice** behind it →
  `"No paid invoice for {broker} {month} / {user}"`

Proof is mandatory and method-specific: crypto requires `tx_hash`; bank wire requires an
uploaded `proof_file`. One release = one `referrer_payouts` envelope + N items, atomically.

**Undo** = delete the envelope; items cascade-delete, which makes those lines releasable
again. This is the only rollback.

> Keying released lines by *(user, broker, month)* — not invoice id — is deliberate:
> invoice tables in this system get cleared and regenerated during resets, and payout
> history must survive that without enabling double-pays. Keep this property.

### Registration binding
Sign-up accepts an optional `referral_code`:
- code looked up in `referral_codes`; invalid codes are **silently ignored** (registration proceeds)
- **self-referral is blocked**
- success inserts one `referral_tracking` row; the unique key makes re-binding a no-op
- invite links have the form `{frontend}/user-register?ref={CODE}`

### Removal
A referrer can remove a referral → deletes the `referral_tracking` row only.
Payout history (`referrer_payout_items`) is intentionally untouched.

---

## 3. User-side features (referrer's dashboard)

**Invite & identity**
- Show referral code; generate one on demand if absent (random unique, uppercase)
- Copy code / copy invite link (`/user-register?ref=CODE`)
- Show the referrer's commission % prominently

**Community profile** (1:1 with the code)
- Name + bio; both required; edit dialog
- First visit with no profile → setup dialog auto-opens
- Banner/profile-image columns + upload endpoints exist — **old UI never wired them; decide
  deliberately whether the rebuild surfaces them**

**Payout methods**
- List crypto wallets and bank accounts (masked), copy address
- Mark one as *main* (`is_main`), which pre-fills the admin release screen
- Warning banner when the user has zero payout methods
- Add/edit lives in account settings, not on this page

**KPIs**
- Total referrals · Active referrals (+ activation %)
- Lifetime earnings = Σ `referrer_payouts` with status paid (+ last payout date)
- Pending payout (estimate) — see §6 first gotcha
- Commission %

**Network list** (per referred trader)
- name, referred_at, status (new/active/suspended)
- last_earnings = latest **paid** invoice fee (+ its month); fee = latest **pending** invoice fee
- payment_status = status of the latest invoice if pending/paid
- payment_release_status: `n_a` (nothing paid) / `paid` (all released) / `partial` / `pending` (none released)
- broker_breakdown per broker: paid/pending fee, paid/pending/released/unreleased commission, has_overdue
- realized/unrealized P&L + profit-share % (details dialog)
- Search by name · status filter · table/cards toggle (cards forced on mobile) · pagination
- Remove referral (confirm dialog)
- Empty-network state distinct from no-filter-matches state

**Released payments tab** (lazy-loaded)
- Rows from `referrer_payouts`: month, amount, payout address, tx hash, paid_at, status

---

## 4. Admin-side features

### Overview
- KPI tiles: **Fees sent** (ledger stats) · **Fees yet to be released** (Σ releasable
  commission) · **Fees left to be paid** · **Users still not paid**
- Referrer list: name, email, code, affiliate %, total commission earned, flags
  (`has_releasable`, `has_released`, overdue/pending rollups)
- Search + status filter: all / overdue / pending / paid / unreleased / released
- Expand referrer → their referrals, each expandable to broker_breakdown
- Per-referrer sub-tab "Released" → that referrer's payout envelopes (lazy)
- **Undo** a released payout (confirm dialog → delete envelope, cascade items)
- CTA per referrer with releasable lines → release screen

### Release screen (the money path)
- Loads releasable lines for one referrer, grouped per referred user, sorted month-desc
- Line identity = `broker|referred_user|month_year`; multi-select with totals
- Payment method toggle:
  - **crypto** → choose among referrer's wallets (main pre-selected), require `tx_hash`, JSON submit
  - **bank_wire** → choose bank account, require proof-file upload (drag-drop + preview), multipart submit
- Confirm modal → submit → success modal with released-amount snapshot
- Server re-validates every line (see §2 release integrity)

### Ledger
- All envelopes across referrers: paid_at, referrer (name/email), month, amount, address,
  tx hash; paginated; totals (count + sum) from a dedicated stats endpoint

### Per-user admin view
- Any user's referrals (who they referred, when, code used) — read-only listing

---

## 5. API surface to re-implement

Shapes are what the old system returns; adapt naming to the new stack, keep semantics.

**User side**
| Endpoint (old) | Purpose |
|---|---|
| get_referral_code | code + referral_id for a user |
| create_referral_code | generate if absent |
| get_referral_network_details | code + full network array (everything in §3 network list) |
| remove_referral | delete tracking row |
| get_community_details / save_community_details | 1:1 community profile |
| upload_community_banner / upload_community_image | exist; unused by old UI |
| get_referral_stats | light counts variant |
| get_my_payouts | the user's `referrer_payouts` rows |
| get_crypto_wallets / get_bank_wire_accounts / set_main_payout_method | payout methods |
| get_user_info | includes `affiliate_percentage` |

**Admin side**
| Endpoint (old) | Purpose |
|---|---|
| get_affiliate_overview | all referrers + nested referrals + breakdowns + flags (heaviest endpoint; see §6) |
| get_referrer_releasable | releasable lines + referrer's wallets/banks + affiliate % (feeds release screen) |
| release_referrer_payout | **the write**; JSON (crypto) or multipart (bank wire); items = [{referred_user_uni_id, broker, month_year}] |
| delete_referrer_payout | undo one envelope |
| get_referrer_payouts | one referrer's envelopes |
| get_affiliate_ledger / get_affiliate_ledger_stats | global ledger + totals |
| get_user_referrals | referrals of one user |

---

## 6. Gotchas & modernization notes (found the hard way)

1. **User-side "pending payout" and "your fee" were client-side estimates**
   (`last_earnings × pct`) and can disagree with server math (which works per-invoice and
   excludes released lines). In the rebuild, return server-computed figures and drop the
   client math.
2. **Admin `overdue` ≡ user `suspended`** — same condition, two labels (see §2). Unify.
3. **The overview endpoint is N+1-heavy** in the old system (per referral: accounts check,
   3-table invoice union, payout-items lookup). Fine at ~14 tracking rows; a rebuild
   should aggregate with joins/eager loading before this grows.
4. **Two submit encodings, one endpoint** — crypto releases post JSON, bank-wire posts
   multipart. Any new field must be added to both paths (this was an easy silent-miss).
5. **`referrer_payouts.status` defaults to `paid`** — an envelope existing means money
   went out; `pending`/`rejected` exist in the enum but the old flow never writes them.
6. **No auth on the old admin endpoints** beyond obscurity; the release endpoint moves
   money. The rebuild must gate all admin affiliate routes properly (this was a known gap,
   not a feature).
7. **Percentage may be null** → treat as 0, show "—", never NaN.
8. **`month_year` is char(7) `YYYY-MM` everywhere** — string compare == chronological
   compare; keep the format.
9. Amount precision: invoices/commission use decimal(20,8); envelope total is
   decimal(12,2). Don't float-round commission before freezing it.
10. **Invoice regeneration must not re-enable payouts** — the (user, broker, month) unique
    key is the guard; preserve it under any new schema.

---

## 7. Statuses — quick reference

| Concept | Values | Where derived |
|---|---|---|
| Referral status | new / active / overdue(admin)=suspended(user) | accounts existence + overdue invoice |
| Invoice status | pending / paid (+ overdue via due_date < today) | invoice tables |
| Payment release (per referral) | n_a / pending / partial / paid | paid invoices vs released items |
| Payout envelope | paid (default) / pending / rejected | `referrer_payouts.status` |
| Payment method | crypto / bank_wire | envelope |
| Broker | capital_com / binance / ig | fixed enum |
