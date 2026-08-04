import { Wallet } from 'lucide-react'
import MetricTile, { type Tone } from '../../analytics/MetricTile'
import { fmtMoney, fmtPctOf, fmtSignedMoney } from '../../../lib/format'
import type { AdminUserSummary } from '../../../types/admin'

const toneOf = (n: number): Tone => (n < 0 ? 'neg' : 'pos')

interface UserBalanceCardProps {
  summary: AdminUserSummary | null
  loading: boolean
}

/**
 * Headline balance + the 5 P&L / commission stats. Figures come from LIVE
 * accounts only, so they match what the user sees on their own dashboard.
 */
export default function UserBalanceCard({
  summary,
  loading,
}: UserBalanceCardProps) {
  return (
    <section className="mb-stack rounded-card border border-border bg-surface p-card">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Wallet size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Balance / Equity
          </div>
          <div className="mt-px text-[12px] text-muted">
            Live accounts — matches the user's own dashboard
          </div>
        </div>
      </div>

      {!summary ? (
        <div className="grid min-h-[140px] place-items-center text-[13px] text-muted">
          {loading ? 'Loading stats…' : 'Could not load this user’s stats.'}
        </div>
      ) : (
        <>
          <div className="font-mono text-[30px] font-extrabold tracking-[-0.5px] max-[560px]:text-[26px]">
            {fmtMoney(summary.balance)}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-hair pt-4 sm:grid-cols-3 xl:grid-cols-5">
            <MetricTile
              label="Total P&L"
              value={fmtSignedMoney(summary.total_pnl)}
              tone={toneOf(summary.total_pnl)}
              sub={fmtPctOf(summary.total_pnl, summary.pct_base, 2)}
              subTone={toneOf(summary.total_pnl)}
            />
            <MetricTile
              label="Unrealized P&L"
              value={fmtSignedMoney(summary.unrealized_pnl)}
              tone={toneOf(summary.unrealized_pnl)}
              sub="From open positions"
            />
            <MetricTile
              label="Realized P&L"
              value={fmtSignedMoney(summary.realized_pnl)}
              tone={toneOf(summary.realized_pnl)}
              sub="From closed positions"
            />
            <MetricTile
              label="Commission this month"
              value={fmtMoney(summary.commissions.this_month)}
              tone="accent"
              sub="Invoiced fees"
            />
            <MetricTile
              label="All-time commission"
              value={fmtMoney(summary.commissions.all_time)}
              tone="accent"
              sub={`${fmtMoney(summary.commissions.all_time_paid)} collected`}
            />
          </div>
        </>
      )}
    </section>
  )
}
