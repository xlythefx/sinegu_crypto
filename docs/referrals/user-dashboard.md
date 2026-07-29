# User dashboard — `/dashboard/referrals`

Port of the mother's user "Affiliate Dashboard". **Design only** — recreate with this repo's stack.

## Page skeleton (this repo's proven port pattern)

Reference: [`StrategyDetail.tsx`](../../src/pages/StrategyDetail.tsx), [`Invoices.tsx`](../../src/pages/Invoices.tsx).

```
Referrals.tsx (thin)
  <DashboardLayout title="Referrals">            // shell + TraderSidebar + TopBar + AOS init + logout ConfirmModal
    const { data, loading, error, reload } = useApiData(getReferrals)
    if (error is ApiError 401) return <Navigate to="/auth" replace />
    if (!data) return <DataState loading error onRetry={reload} label="referrals" />
    // useMemo derivations from src/lib/referrals.ts
    // compose src/components/referrals/* subcomponents
```

**Conventions (non-negotiable):**
- Tailwind **design tokens** only (`bg-surface`, `bg-surface2`, `border-border`, `text-muted`,
  `text-accent`, `rounded-card`, `p-card`, …) — dark/light theme aware. No amber literals.
- `fadeup` keyframe on tab/filter switches: wrap switched region in `key={\`${tab}-${status}-${search}\`}`
  + `className="animate-[fadeup_0.35s_ease-out]"`. AOS `data-aos="fade-up"` on scroll-in blocks.
- **`ConfirmModal`** for remove-referral. Mobile-first / PWA (verify mobile→tablet→desktop).

## New files

- `src/pages/Referrals.tsx` — thin page.
- `src/services/referrals.ts` — `getReferrals`, `createReferralCode`, `getCommunity`,
  `saveCommunity`, `removeMember`, `getPayouts` (+ payout-method reads once phase 5 lands).
- `src/types/referrals.ts` — `ReferralNetworkItem`, `ReferralBrokerBreakdown`,
  `ReferralsData`, `ReleasedPayoutRow`, `CommunityDetails`, status unions.
- `src/lib/referrals.ts` — pure helpers: `computeKpis`, `formatUSD`, `formatMonth`,
  `formatDateShort`, `truncateAddress`, `getInitials`, `mapMemberStatus`, `mapInvoiceStatus`,
  `brokerRowStatus`.
- `src/components/referrals/*` — components below.

## Layout order (top → bottom)

1. **Page header** — eyebrow "Affiliate", title "Grow your network", subtitle
   "Share your link, watch your community grow, and earn from every trade." + a Refresh button (`reload`).
2. **WalletWarningAlert** — only when no payout method on file.
3. **AffiliateKpiStrip** — 5 tiles.
4. **AffiliateHeroCard** — invite/code/commission/community/payout.
5. **Tabs** — "Your network" (+count) · "Released payments".
6. Dialogs — ReferralDetails / RemoveReferral / CommunitySetup.

## Components

### AffiliateKpiStrip — 5 tiles
`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`. Each: uppercase label, big value, hint, icon chip.

| Tile | Value | Hint |
|---|---|---|
| Total referrals | `kpis.totalReferrals` | `{active} active` |
| Active members | `kpis.activeReferrals` | `{n}% activation` |
| Lifetime earnings | `formatUSD(lifetimeEarnings)` | `Last payout {date}` / `No payouts yet` |
| Pending payout | `formatUSD(pendingPayout)` | `Awaiting release` |
| Commission | `{affiliate_percentage}%` or `—` | `Your current rate` |

`computeKpis(members, payouts, pct)`: `lifetimeEarnings` = Σ `total_amount` of `paid` payouts;
`pendingPayout` = Σ over members of `last_earnings × pct/100` skipping released/null.

### AffiliateHeroCard — the invite hero (2-col on `lg`)
- **AffiliateCodeBlock** — no code → "Generate referral code" button; has code → read-only mono input + copy.
- **InviteLinkBlock** — read-only `{origin}/auth?ref={code}` + "Copy link" (Check for 1.5s). Hidden if no code.
- **CommissionBlock** — shows `{affiliate_percentage}%` big, with a HelpCircle tooltip explaining
  commission. **Drop the tier auto-growth** ("unlock next tier") copy — rate is flat/admin-set.
- **CommunityBlock** — `community_name || "Your community"`, bio (trunc ~50 chars) or placeholder;
  "Edit"/"Set up" opens CommunitySetupDialog.
- **PayoutMethodsBlock** — list crypto/bank methods with set-main (Star) + copy; "Manage" →
  `/dashboard/settings`. Empty → "No payout methods yet · Add in settings". *(Live once phase 5 lands.)*

### Tabs
- **Your network** toolbar: search by name; status `Select` (`all|active|new|suspended`);
  table/cards toggle (desktop) — **forced to cards on mobile** (`useIsMobile`). Pagination:
  **8/page table, 6/page cards**. Body states: loading spinner, `NetworkEmptyState`,
  filtered-empty ("No members match your filters."), else NetworkTable / NetworkCardGrid.
- **Released payments** → ReleasedPaymentsTable.

### NetworkTable (desktop) — columns
`Trader | Status | Last earnings | Your fee | Invoice | Payment release | Joined | Actions`
- Trader = initials avatar + name. `Your fee` = `last_earnings × pct/100` (accent color, `—` if null).
- Status/Invoice/Payment-release = pill components. Actions = Eye (→ ReferralDetailsDialog) + Trash (→ RemoveReferralDialog).

### NetworkCardGrid (mobile/cards)
`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Avatar + name + status pill; 2-col mini-panel
(Last earnings / Your fee); footer with invoice + payment-release pills + joined date; Eye/Trash actions.

### Status pills (`status.tsx`)
- **MemberStatus**: active→green "Active", new→muted "New account", suspended→amber "Suspended".
- **InvoiceStatus**: none→`—`, paid→green, pending→amber, rejected→red.
- **PayoutStatus**: paid/pending/rejected (green/amber/red).
- **PaymentReleaseStatus**: n_a→"N/A", paid→"Paid", partial→"Partially released", pending→"Pending".
Use theme tokens for the green/amber/red/muted equivalents, not literal Tailwind colors.

### ReferralDetailsDialog (Eye)
Title `{name} — P&L & profit share`. Sections: **P&L** (Realized / Unrealized tiles), **Profit share**
(`realized_percentage%` / `unrealized_percentage%` tiles), **Per-exchange breakdown** table
`Exchange | Fee paid | Fee pending | Commission | Status` (only if `broker_breakdown.length > 0`).
Exchange labels/colors from [`meta.ts`](../../src/components/exchanges/meta.ts). `brokerRowStatus`
derives Partial / Partial·Overdue / Released / Partial released / Paid / Overdue / Pending / —.

### RemoveReferralDialog
Via **ConfirmModal** (`danger`): title "Remove from network?", message
"This will remove {name} from your referral network. This action cannot be undone." → `removeMember`, then `reload`.

### CommunitySetupDialog
Title "Set up your community profile", both fields required: Community name input + Short bio textarea.
Save disabled until both filled. **Auto-opens when the user has a code but no community.**

### ReleasedPaymentsTable
Columns `Month | Amount | Payout address | Tx hash | Paid at | Status`. Tx hash → Tronscan link.
Empty → "No released payments yet · Released monthly payouts will appear here once processed."

### WalletWarningAlert / NetworkEmptyState
- Alert (amber tokens): "Add a payout method to receive your earnings" + "Open settings" (→ `/dashboard/settings`), dismissible.
- Empty: "Your network is empty · Share your invitation link to start referring traders." + "Copy invite link".

## Wire-up

- Route in [`src/App.tsx`](../../src/App.tsx): add `<Route path="/dashboard/referrals" element={<Referrals />} />`
  **before** the `/dashboard/*` catch-all (currently line 43). Import `Referrals` at top.
- Unhide the nav: flip `hidden` off on the `Referrals` entry in
  [`TraderSidebar.tsx`](../../src/components/dashboard/TraderSidebar.tsx#L52) (`Users` icon already set).
