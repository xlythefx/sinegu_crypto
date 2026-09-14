import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { fmtSignedMoney } from '../../lib/format'
import type { DayOfWeekStat, Weekday } from '../../types/analytics'
import BarReadout from './BarReadout'

const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const W = 700
const H = 230
const TOP = 30
const BOTTOM = 34
const PLOT = H - TOP - BOTTOM
const SLOT = W / WEEKDAYS.length
const BAR_W = 46

interface DayOfWeekCardProps {
  dayOfWeek: Record<Weekday, DayOfWeekStat>
}

/** "Performance by Day of Week" — signed bar chart, best/worst summary.
 *  Bars are BEFORE exchange fees; hover one for the after-fees figure. */
export default function DayOfWeekCard({ dayOfWeek }: DayOfWeekCardProps) {
  const [hover, setHover] = useState<number | null>(null)

  const days = WEEKDAYS.map((day) => ({
    day,
    pnl: dayOfWeek[day]?.pnl ?? 0,
    pnlNet: dayOfWeek[day]?.pnl_net ?? 0,
    trades: dayOfWeek[day]?.trades ?? 0,
  }))
  const hasData = days.some((d) => d.trades > 0)

  const max = Math.max(...days.map((d) => d.pnl), 0)
  const min = Math.min(...days.map((d) => d.pnl), 0)
  const span = max - min || 1
  const yOf = (v: number) => TOP + ((max - v) / span) * PLOT
  const zeroY = yOf(0)

  const best = days.reduce((a, b) => (b.pnl > a.pnl ? b : a), days[0])
  const worst = days.reduce((a, b) => (b.pnl < a.pnl ? b : a), days[0])

  const hovered = hover !== null && days[hover].trades > 0 ? days[hover] : null
  const hoverX = hover !== null ? (hover * SLOT + SLOT / 2) / W : 0

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
      data-aos-delay="100"
    >
      <div className="flex items-start justify-between gap-3.5 flex-wrap">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <CalendarDays size={16} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Performance by Day of Week
            </div>
            <div className="text-[12px] text-muted mt-px">
              Identify which weekdays drive your edge · before fees
            </div>
          </div>
        </div>
        <div className="flex gap-[22px] text-right max-[640px]:text-left">
          <div className="flex flex-col gap-px">
            <span className="text-[10px] font-extrabold tracking-[0.5px] text-faint uppercase">
              Best Day
            </span>
            <span className="text-[14px] font-extrabold text-green">
              {hasData ? best.day : '—'}
            </span>
            <span className="font-mono text-[11px] text-muted font-bold">
              {hasData ? fmtSignedMoney(best.pnl, 0) : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-px">
            <span className="text-[10px] font-extrabold tracking-[0.5px] text-faint uppercase">
              Worst Day
            </span>
            <span className="text-[14px] font-extrabold text-red">
              {hasData ? worst.day : '—'}
            </span>
            <span className="font-mono text-[11px] text-muted font-bold">
              {hasData ? fmtSignedMoney(worst.pnl, 0) : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="relative" onPointerLeave={() => setHover(null)}>
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
          {days.map((d, i) => {
            const x = i * SLOT + (SLOT - BAR_W) / 2
            const y = d.pnl >= 0 ? yOf(d.pnl) : zeroY
            const h = Math.abs(yOf(d.pnl) - zeroY)
            const pos = d.pnl >= 0
            return (
              <g
                key={d.day}
                onPointerEnter={() => setHover(i)}
                className={d.trades > 0 ? 'cursor-help' : undefined}
              >
                <rect x={i * SLOT} y={0} width={SLOT} height={H} fill="transparent" />
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={Math.max(h, 2)}
                  rx="5"
                  fill={pos ? 'var(--green)' : 'var(--red)'}
                  opacity={hover === null || hover === i ? 0.85 : 0.35}
                  className="transition-opacity duration-150"
                />
                {d.trades > 0 && (
                  <text
                    x={x + BAR_W / 2}
                    y={pos ? y - 8 : y + h + 14}
                    textAnchor="middle"
                    className={`font-mono text-[11px] font-bold ${pos ? 'fill-green' : 'fill-red'}`}
                  >
                    {fmtSignedMoney(d.pnl, 0)}
                  </text>
                )}
                <text
                  x={x + BAR_W / 2}
                  y={H - 10}
                  textAnchor="middle"
                  className="font-mono text-[11px] font-semibold fill-faint tracking-[0.5px]"
                >
                  {d.day}
                </text>
              </g>
            )
          })}
        </svg>

        {hovered && (
          <BarReadout
            xFrac={hoverX}
            title={`${hovered.day} · ${hovered.trades} trade${hovered.trades === 1 ? '' : 's'}`}
            gross={hovered.pnl}
            net={hovered.pnlNet}
          />
        )}
      </div>
    </section>
  )
}
