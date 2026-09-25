import {
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  PiggyBank,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import MetricTile from './MetricTile'
import { fmtMediumDate, fmtMoney, fmtSignedMoney } from '../../lib/format'
import type { CapitalFlows } from '../../types/analytics'

interface CapitalFlowCardProps {
  flows: CapitalFlows
  currentCapital: number
  /** Absent on an older API; the tile then says so rather than guess. */
  initialDeposit?: number
}

/** "Capital Flow Summary" — funding KPIs, deposit/withdrawal composition bar
 *  and the most recent transactions. */
export default function CapitalFlowCard({
  flows,
  currentCapital,
  initialDeposit,
}: CapitalFlowCardProps) {
  const totalMovement = flows.deposits + flows.withdrawals
  const depPct = totalMovement > 0 ? (flows.deposits / totalMovement) * 100 : 0
  const wdPct = totalMovement > 0 ? 100 - depPct : 0

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
      data-aos-delay="150"
    >
      <div className="flex items-start justify-between gap-3.5 flex-wrap">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <Wallet size={16} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Capital Flow Summary
            </div>
            <div className="text-[12px] text-muted mt-px">
              Account funding and withdrawal overview
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-extrabold tracking-[0.5px] text-faint uppercase">
            Current Capital
          </span>
          <span className="font-mono text-[21px] font-extrabold text-accent tracking-[-0.4px]">
            {fmtMoney(currentCapital)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[10px]">
        <MetricTile
          label="Total Deposits"
          value={fmtMoney(flows.deposits)}
          tone="pos"
          sub="All time"
          icon={ArrowDownCircle}
          iconTone="pos"
        />
        <MetricTile
          label="Total Withdrawals"
          value={fmtMoney(flows.withdrawals)}
          tone="neg"
          sub="All time"
          icon={ArrowUpCircle}
          iconTone="neg"
        />
        <MetricTile
          label="Net Flow"
          value={fmtSignedMoney(flows.net_flow)}
          tone={flows.net_flow < 0 ? 'neg' : 'pos'}
          sub="Deposits − Withdrawals"
          icon={TrendingUp}
        />
        {/* The account's balance before the first transfer we recorded.
            This tile used to print the net flow — the tile beside it —
            under a different name. */}
        <MetricTile
          label="Initial Deposit"
          value={initialDeposit === undefined ? '—' : fmtMoney(initialDeposit)}
          sub="Held before the first recorded transfer"
          icon={PiggyBank}
        />
      </div>

      <div className="mt-3.5 border border-hair bg-surface2 rounded-row py-[13px] px-[14px] flex flex-col gap-[9px]">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
            Flow Composition
          </span>
          <span className="font-mono text-[11px] text-muted">
            {fmtMoney(totalMovement)} total movement
          </span>
        </div>
        <div className="h-2 rounded-[4px] overflow-hidden flex bg-surface">
          <div className="bg-green" style={{ width: `${depPct}%` }} />
          <div className="bg-red" style={{ width: `${wdPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5">
          <span>
            <i className="w-2 h-2 rounded-full inline-block bg-green" /> Deposits{' '}
            {depPct.toFixed(1)}%
          </span>
          <span>
            Withdrawals {wdPct.toFixed(1)}%{' '}
            <i className="w-2 h-2 rounded-full inline-block bg-red" />
          </span>
        </div>
      </div>

      <div className="mt-stack">
        <div className="flex items-center gap-[7px] mb-2.5 text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
          <Clock size={14} />
          <span>Recent Transactions</span>
        </div>
        <div className="border border-hair rounded-row overflow-hidden">
          {flows.recent.length === 0 && (
            <div className="flex items-center justify-between gap-3 py-[11px] px-3.5 border-b border-hair last:border-b-0">
              <span className="text-[11px] text-muted font-semibold">
                No transactions yet
              </span>
            </div>
          )}
          {flows.recent.map((tx, i) => {
            const isDeposit = tx.type.toLowerCase() === 'deposit'
            return (
              <div
                className="flex items-center justify-between gap-3 py-[11px] px-3.5 border-b border-hair last:border-b-0"
                key={i}
              >
                <div className="flex items-center gap-[11px] min-w-0">
                  <span
                    className={`w-8 h-8 rounded-[9px] flex items-center justify-center flex-none ${isDeposit ? 'text-green bg-[rgba(47,214,122,0.1)]' : 'text-red bg-[rgba(255,90,90,0.1)]'}`}
                  >
                    {isDeposit ? (
                      <ArrowDownCircle size={16} />
                    ) : (
                      <ArrowUpCircle size={16} />
                    )}
                  </span>
                  <div>
                    <div className="text-[13px] font-extrabold">
                      {isDeposit ? 'Deposit' : 'Withdrawal'}
                    </div>
                    <div className="text-[11px] text-muted font-semibold">
                      {fmtMediumDate(tx.date)}
                    </div>
                  </div>
                </div>
                <span
                  className={`font-mono text-[13px] font-extrabold ${isDeposit ? 'text-green' : 'text-red'}`}
                >
                  {fmtSignedMoney(
                    isDeposit ? Math.abs(tx.amount) : -Math.abs(tx.amount),
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
