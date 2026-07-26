import { Activity } from 'lucide-react'
import { fmtPctOf, fmtSignedMoney } from '../../lib/format'
import type { PnlBreakdown } from '../../types/dashboard'

interface PnlBreakdownCardProps {
  breakdown: PnlBreakdown
  pctBase: number
}

/** Sits beside the calendar: Daily / Weekly / Monthly realized P&L,
 *  each as amount + percentage. */
export default function PnlBreakdownCard({
  breakdown,
  pctBase,
}: PnlBreakdownCardProps) {
  const monthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const rows = [
    { label: 'Daily', value: breakdown.daily },
    { label: 'Weekly', value: breakdown.weekly },
    { label: 'Monthly', value: breakdown.monthly },
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
            Realized · {monthLabel}
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
              <span
                className={`font-mono text-[15px] font-extrabold ${r.value < 0 ? 'text-red' : 'text-green'}`}
              >
                {fmtSignedMoney(r.value)}
              </span>
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
