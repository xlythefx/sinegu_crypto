# Admin dashboard — Affiliate console

Port of the mother's admin affiliate management. Two pages in `src/pages/admin/` (admin pages live
there per `CLAUDE.md`). Same Tailwind-token + `fadeup` + AOS + `ConfirmModal` conventions as the user side.

## Wire-up

- **Sidebar:** add to `ADMIN_NAV_ITEMS` in
  [`AdminSidebar.tsx`](../../src/components/admin/AdminSidebar.tsx#L41):
  `{ label: 'Affiliate', url: '/admin/affiliate', icon: Share2 }` (import `Share2` from lucide).
- **Routes** in [`src/App.tsx`](../../src/App.tsx): add **before** the `/admin/*` catch-all (line 52):
  ```tsx
  <Route path="/admin/affiliate/release/:referrerUniId" element={<AdminReleasePayment />} />
  <Route path="/admin/affiliate" element={<AdminReferrals />} />
  ```
- **Guard:** `/admin/*` is already client-guarded by `AdminLayout` (role from `AuthUser.type`).

## New files

- `src/pages/admin/AdminReferrals.tsx`, `src/pages/admin/AdminReleasePayment.tsx`
- `src/services/adminReferrals.ts` — overview, ledger, ledger-stats, referrer payouts, referrer
  releasable, release (crypto JSON / bank multipart), delete payout.
- `src/components/admin/referrals/*` — stat cards, referrer accordion, sub-tabs, ledger table, release steps.

---

## `AdminReferrals.tsx` — main console

Header: "Affiliate" / "Referrers, referrals, and payout ledger." Tabs: **Affiliate overview** · **Ledger**.
Loading = spinner; error = alert + Retry.

### 4 stat cards (always above tabs)
`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. Each: uppercase label, big `tabular-nums` value, sub-line.

| Card | Value | Sub |
|---|---|---|
| Fees sent | `ledgerStats.total_sent_count` | `{formatUSD(total_sent_amount)} total` |
| Fees yet to be released | Σ `releasable_commission_total` (all referrers) | `total to release (all referrers)` |
| Fees left to be paid | count referrers with `has_releasable` | `referrers with unreleased` |
| Users still not paid | same count | `referrers awaiting payout` |

### Overview tab
- **Search** (code / name / email) + **status Select**: `all | overdue | pending | paid | unreleased | released`.
- Empty states: "No referrers yet" / "No referrers match your filters or search."
- **Referrer accordion rows** — state-colored (overdue+pending→red, pending→amber, all paid→green,
  else neutral; use theme tokens). Header: chevron · `code` (mono) · "{N} referrals" badge ·
  conditional Overdue/Pending/"{paid}/{total} paid" badges · line 2 = name · email · `Commission: {pct}%`
  · `{earned} earned`. Right action: **Release Payment** button (→ `/admin/affiliate/release/{user_uni_id}`)
  when `has_releasable`, else "Payout Released!" when `has_released`.
- **Expanded body — two sub-tabs per referrer:**
  - **Referrals** — list of referred users (per-exchange breakdown expandable): status badge, fee
    paid/pending, commission with Released/Partial/Unreleased badge. Breakdown table
    `Exchange | Fee paid | Fee pending | Commission | Status` (exchange labels from `meta.ts`).
  - **Released payments** — lazy-load `referrers/{uni}/payouts`: table
    `Month | Amount | Payout address | TX hash | Paid at | Undo`. TX hash → Tronscan. **Undo** →
    **ConfirmModal** ("Remove payout release? … released invoices will be available to release again")
    → `DELETE /admin/affiliate/payouts/{id}` → refetch.

### Ledger tab
Card "Ledger" / "All fees sent, latest at top". Table
`Paid at | Referrer | Month | Amount | Payout address | TX hash` (TX → Tronscan).
Client pagination, page size **10**: "Page {p} of {t} (x–y of N)" + Previous/Next.

---

## `AdminReleasePayment.tsx` — release flow

Full-screen page `/admin/affiliate/release/:referrerUniId`. Loads `referrers/{uni}/releasable`
→ `releasable_items, referrer_wallets, bank_wire_accounts, referrer_name, referrer_code, affiliate_percentage`.
Header: back button + "Release Commission" + `{referrerName} · {pct}% rate`. Two numbered step cards.

### Step 1 — Select invoices to release
- **Total panel**: "Total to release" + `formatUSD(totalToRelease)` + "{fees} fees × {pct}% · {n} items"
  + "Select all releasable" checkbox.
- **Groups by referred user** (tri-state checkbox: all/indeterminate/none, collapse chevron, group total).
- **Line items**: checkbox + `{exchangeLabel} · {formatMonth(month_year)}`, "Fee paid: {…}", commission (accent).
- `itemKey` keyed on `invoice_id` (preferred) or `{exchange}|{referred_user_uni_id}|{month_year}`.
  All pre-selected. `totalToRelease` = Σ selected commission (2dp).

### Step 2 — Payment method
- Preferred-method pill (reads referrer's main wallet/bank; auto-applies on load). Toggle crypto / bank_wire.
- **Crypto**: show TRC20 wallet card (copy, network badge), require **TX hash** input. None → "No crypto wallet on file".
- **Bank wire**: account selector + detail card (Holder, Bank, Account #, Routing #, IBAN, SWIFT/BIC,
  Type, Address), require **proof upload** (JPEG/PNG/GIF/WebP/PDF, ≤5 MB). None → "No bank wire account on file".

### Confirm & submit
- Floating confirm button enabled when: items selected, total > 0, and (crypto→tx_hash+wallet) or
  (bank→proof+account). → **ConfirmModal** ("Confirm Release" summary: referrer / invoices / amount /
  method / address+tx or bank+proof) → `POST /admin/affiliate/release`:
  - crypto: JSON `{ referrer_uni_id, items:[{invoice_id}], total_amount, payout_address, tx_hash }`
  - bank: `FormData` `{ referrer_uni_id, items, total_amount, payout_address, payment_method:'bank_wire', proof_file }`
- **Success receipt**: Referrer, Invoices, Amount Sent, Method, TX Hash, Payout Address/Account +
  "Back to Affiliate Dashboard".

> Reuse [`src/components/exchanges/meta.ts`](../../src/components/exchanges/meta.ts) for all exchange
> labels/colors. Every mutation (release, undo) routes through **ConfirmModal**.
