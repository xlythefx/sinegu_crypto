import { DollarSign } from 'lucide-react'
import { fmtMoney } from '../../lib/format'
import type { CommissionRow } from '../../types/dashboard'

interface CommissionsCardProps {
  total: number
  rows: CommissionRow[]
}

/** Estimated commissions this month: headline total + per-exchange breakdown. */
export default function CommissionsCard({ total, rows }: CommissionsCardProps) {
  return (
    <section
      className="rounded-card p-card border border-border bg-surface flex-1"
      data-aos="fade-up"
      data-aos-delay="250"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <DollarSign size={16} />
        </span>
        <div className="font-display text-[15px] font-extrabold">
          Est. Commissions
        </div>
      </div>
      <div className="font-mono text-[28px] font-extrabold text-accent">
        {fmtMoney(total)}
      </div>
      <div className="text-[11px] text-muted mt-2 mb-3">
        This month · 20% of profit only
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div className="flex justify-between text-[12px]" key={r.exchange}>
            <span className="text-muted font-semibold">{r.exchange}</span>
            <span className="font-mono font-bold">{fmtMoney(r.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
