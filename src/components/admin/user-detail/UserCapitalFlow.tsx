import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Landmark,
} from 'lucide-react'
import MetricTile from '../../analytics/MetricTile'
import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { AdminUserSummary } from '../../../types/admin'

interface UserCapitalFlowProps {
  summary: AdminUserSummary | null
  loading: boolean
}

/** Deposits / withdrawals / net flow / capital — 4 tiles. */
export default function UserCapitalFlow({
  summary,
  loading,
}: UserCapitalFlowProps) {
  const cf = summary?.capital_flow

  return (
    <section className="flex flex-col rounded-card border border-border bg-surface p-card">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <ArrowLeftRight size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Capital Flow
          </div>
          <div className="mt-px text-[12px] text-muted">
            Deposits and withdrawals across live accounts
          </div>
        </div>
      </div>

      {!cf ? (
        <div className="grid min-h-[140px] flex-1 place-items-center text-[13px] text-muted">
          {loading ? 'Loading capital flow…' : 'Could not load capital flow.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <MetricTile
            label="Total Deposits"
            value={fmtMoney(cf.deposits)}
            tone="pos"
            icon={ArrowDownToLine}
            iconTone="pos"
            sub={`${cf.deposit_count} transaction${cf.deposit_count === 1 ? '' : 's'}`}
          />
          <MetricTile
            label="Total Withdrawals"
            value={fmtMoney(cf.withdrawals)}
            tone="neg"
            icon={ArrowUpFromLine}
            iconTone="neg"
            sub={`${cf.withdrawal_count} transaction${cf.withdrawal_count === 1 ? '' : 's'}`}
          />
          <MetricTile
            label="Net Flow"
            value={fmtSignedMoney(cf.net_flow)}
            tone={cf.net_flow < 0 ? 'neg' : 'pos'}
            icon={ArrowLeftRight}
            sub="Deposits − withdrawals"
          />
          <MetricTile
            label="Capital"
            value={fmtMoney(cf.capital)}
            icon={Landmark}
            sub="Initial deposit + net flow"
          />
        </div>
      )}
    </section>
  )
}
