import { fmtMoney } from '../../lib/format'
import type { AdminUserAccount } from '../../types/admin'

/** A user's balance across their CONNECTED accounts (every exchange), real
 *  money and demo kept apart. null = no connected account of that kind. */
function userBalances(accounts: AdminUserAccount[]): {
  live: number | null
  demo: number | null
} {
  let live: number | null = null
  let demo: number | null = null
  for (const a of accounts) {
    // A disconnected account's balance is the last one synced, not money we
    // still trade — the expanded row still lists it, greyed out.
    if (a.deleted_at) continue
    if (a.demo) demo = (demo ?? 0) + a.balance
    else live = (live ?? 0) + a.balance
  }
  return { live, demo }
}

/**
 * User Management's Balance column: the real-money total, with demo balances
 * on their own labelled line — test money is shown, never added to real money.
 * The per-account split stays in the row's expanded view.
 */
export default function UserBalanceCell({ accounts }: { accounts: AdminUserAccount[] }) {
  const { live, demo } = userBalances(accounts)
  if (live === null && demo === null) {
    return <span className="text-faint">—</span>
  }
  return (
    <div className="inline-flex flex-col items-end gap-0.5 whitespace-nowrap">
      {live !== null && (
        <span className="font-mono font-bold text-text">{fmtMoney(live)}</span>
      )}
      {demo !== null && (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-muted">
          <span className="rounded-full border border-border bg-surface2 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.05em]">
            Demo
          </span>
          {fmtMoney(demo)}
        </span>
      )}
    </div>
  )
}
