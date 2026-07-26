import { Calendar } from 'lucide-react'
import { fmtSignedMoney } from '../../lib/format'
import type { MonthlyStat } from '../../types/analytics'

const W = 600
const H = 230
const TOP = 30
const BOTTOM = 34
const PLOT = H - TOP - BOTTOM

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

interface MonthlyBreakdownCardProps {
  monthly: MonthlyStat[]
}

/** "Monthly Performance Breakdown" — P&L for every month (Jan–Dec) of the
 *  target year, with empty months shown as zero bars. */
export default function MonthlyBreakdownCard({
  monthly,
}: MonthlyBreakdownCardProps) {
  // Anchor on the most recent year present in the data (else this year).
  const year =
    monthly.length > 0
      ? Number(monthly[monthly.length - 1].month.slice(0, 4))
      : new Date().getFullYear()

  const byMonth = new Map(monthly.map((m) => [m.month, m]))
  const months = MONTH_LABELS.map((label, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const stat = byMonth.get(key)
    return { key, label, pnl: stat?.pnl ?? 0, trades: stat?.trades ?? 0 }
  })

  const yearLabel = String(year)

  const max = Math.max(...months.map((m) => m.pnl), 0)
  const min = Math.min(...months.map((m) => m.pnl), 0)
  const span = max - min || 1
  const yOf = (v: number) => TOP + ((max - v) / span) * PLOT
  const zeroY = yOf(0)
  const slot = W / months.length
  const barW = Math.min(52, slot * 0.6)

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
      data-aos-delay="200"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Calendar size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Monthly Performance Breakdown
          </div>
          <div className="text-[12px] text-muted mt-px">
            P&L by month for {yearLabel}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[250px] block">
        <g stroke="var(--hair)" strokeWidth="1">
          <line x1="0" y1={TOP} x2={W} y2={TOP} />
          <line x1="0" y1={(TOP + zeroY) / 2} x2={W} y2={(TOP + zeroY) / 2} />
        </g>
        <line
          x1="0"
          y1={zeroY}
          x2={W}
          y2={zeroY}
          stroke="var(--muted)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        {months.map((m, i) => {
          const x = i * slot + (slot - barW) / 2
          const pos = m.pnl >= 0
          const y = pos ? yOf(m.pnl) : zeroY
          const h = Math.abs(yOf(m.pnl) - zeroY)
          return (
            <g key={m.key}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 2)}
                rx="6"
                fill={pos ? 'var(--green)' : 'var(--red)'}
                opacity=".85"
              />
              {m.trades > 0 && (
                <text
                  x={x + barW / 2}
                  y={pos ? y - 8 : y + h + 14}
                  textAnchor="middle"
                  className={`font-mono text-[11px] font-bold ${pos ? 'fill-green' : 'fill-red'}`}
                >
                  {fmtSignedMoney(m.pnl, 0)}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H - 10}
                textAnchor="middle"
                className="font-mono text-[11px] font-semibold fill-faint tracking-[0.5px]"
              >
                {m.label}
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}
