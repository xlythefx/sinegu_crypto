import { Activity } from 'lucide-react'
import { fmtPctOf, fmtSignedMoney } from '../../lib/format'
import type { PnlBreakdown as PnlPeriods } from '../../types/dashboard'
import PnlBreakdown from '../ui/PnlBreakdown'

interface PnlBreakdownCardProps {
  /** Before fees. */
  breakdown: PnlPeriods
  /** After fees, same keys. */
  net: PnlPeriods
  pctBase: number
}

/** Sits beside the calendar: Daily / Weekly / Monthly realized P&L before
 *  exchange fees, each as amount + percentage; hover a figure for what
 *  landed after fees. These are recent windows, all inside the fee ledger's
 *  era, so no "fees recorded from…" caveat is needed here. */
export default function PnlBreakdownCard({
  breakdown,
  net,
  pctBase,
}: PnlBreakdownCardProps) {
  const monthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const rows = [
    { label: 'Daily', value: breakdown.daily, net: net.daily },
    { label: 'Weekly', value: breakdown.weekly, net: net.weekly },
    { label: 'Monthly', value: breakdown.monthly, net: net.monthly },
  ]
  return (
    <section
      className="rounded-card p-card border border-border bg-surface flex-1"
      data-aos="fade-up"
      data-aos-delay="350"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Activity size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            P&L Breakdown
          </div>
          <div className="text-[12px] text-muted mt-px">
            Realized · before fees · {monthLabel}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div
            className="flex items-center justify-between py-[13px] px-3.5 rounded-row bg-surface2 border border-hair"
            key={r.label}
          >
            <span className="text-[12.5px] font-bold text-muted">
              {r.label} P&L
            </span>
            <div className="flex flex-col items-end gap-0.5">
              <PnlBreakdown gross={r.value} net={r.net} heading={`${r.label} · realized`}>
                <span
                  className={`font-mono text-[15px] font-extrabold ${r.value < 0 ? 'text-red' : 'text-green'}`}
                >
                  {fmtSignedMoney(r.value)}
                </span>
              </PnlBreakdown>
              <span
                className={`font-mono text-[11px] font-bold ${r.value < 0 ? 'text-red' : 'text-green'}`}
              >
                {fmtPctOf(r.value, pctBase, 2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
