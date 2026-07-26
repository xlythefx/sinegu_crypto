import { useMemo, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApiData } from '../../hooks/useApiData'
import { getDashboardDailyPnl } from '../../services/dashboard'
import DayTradesModal from './DayTradesModal'
import type { DayPnl } from '../../types/dashboard'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Base calendar cell (also used by blank cells). Mirrors the old .dcal__cell. */
const cellBase =
  'relative min-h-[58px] border border-hair rounded-btn py-[7px] px-2 flex flex-col items-start justify-between bg-surface2 text-left transition-[transform,box-shadow,border-color] duration-150 ease-[ease] max-[900px]:min-h-[46px] max-[900px]:py-[5px] max-[900px]:px-1.5'

type DisplayMode = 'amount' | 'percentage'

interface DailyPnlCalendarProps {
  /** Equity base used for the % display mode. */
  balance: number
}

interface Cell {
  day: number | null
  iso: string
  data: DayPnl | null
}

function isoKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildCells(
  year: number,
  month: number,
  days: Record<string, DayPnl>,
): Cell[] {
  const first = new Date(year, month, 1).getDay()
  const count = new Date(year, month + 1, 0).getDate()
  const cells: Cell[] = []
  for (let i = 0; i < first; i++) cells.push({ day: null, iso: '', data: null })
  for (let d = 1; d <= count; d++) {
    const iso = isoKey(year, month, d)
    cells.push({ day: d, iso, data: days[iso] ?? null })
  }
  return cells
}

/** Daily P&L calendar — month grid tinted by P&L sign + magnitude, with month
 *  navigation, an Amount/% toggle, and a click-to-open trades modal per day. */
export default function DailyPnlCalendar({ balance }: DailyPnlCalendarProps) {
  const { data: days } = useApiData(getDashboardDailyPnl)
  const now = useMemo(() => new Date(), [])
  const [view, setView] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  )
  const [mode, setMode] = useState<DisplayMode>('amount')
  const [selected, setSelected] = useState<string | null>(null)

  const daysMap = days ?? {}

  const cells = useMemo(
    () => buildCells(view.getFullYear(), view.getMonth(), daysMap),
    [view, daysMap]
  )
  const monthLabel = view.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const total = (c: Cell) => c.data?.total ?? 0
  const winDays = cells.filter((c) => c.day && total(c) > 0).length
  const lossDays = cells.filter((c) => c.day && total(c) < 0).length
  const maxAbs = Math.max(1, ...cells.map((c) => Math.abs(total(c))))
  const canGoNext =
    view.getFullYear() < now.getFullYear() ||
    (view.getFullYear() === now.getFullYear() &&
      view.getMonth() < now.getMonth())

  const display = (pnl: number) => {
    if (pnl === 0) return '—'
    if (mode === 'percentage')
      return `${pnl > 0 ? '+' : ''}${balance > 0 ? ((pnl / balance) * 100).toFixed(2) : '0.00'}%`
    return `${pnl > 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(0)}`
  }

  return (
    <section
      className="rounded-card p-card border border-border bg-surface grow basis-[480px] min-w-0"
      data-aos="fade-up"
      data-aos-delay="300"
    >
      <div className="flex items-center justify-between mb-stack gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <CalendarIcon size={16} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Daily P&L Calendar
            </div>
            <div className="text-[12px] text-muted mt-px">
              {winDays} green / {lossDays} red days · click a day for its trades
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center justify-center w-[30px] h-[30px] rounded-btn border border-border bg-surface text-accent cursor-pointer disabled:text-faint disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() =>
                setView(
                  (v) => new Date(v.getFullYear(), v.getMonth() - 1, 1)
                )
              }
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[116px] text-center text-[13px] font-extrabold">
              {monthLabel}
            </span>
            <button
              type="button"
              className="flex items-center justify-center w-[30px] h-[30px] rounded-btn border border-border bg-surface text-accent cursor-pointer disabled:text-faint disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!canGoNext}
              onClick={() =>
                canGoNext &&
                setView(
                  (v) => new Date(v.getFullYear(), v.getMonth() + 1, 1)
                )
              }
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex gap-[3px] bg-surface2 border border-hair rounded-seg p-1">
            {(['amount', 'percentage'] as DisplayMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`font-body py-[5px] px-2.5 text-[11.5px] rounded-btn border ${
                  mode === m
                    ? 'bg-surface border-border text-text font-bold'
                    : 'border-transparent bg-transparent text-muted font-semibold'
                }`}
                onClick={() => setMode(m)}
              >
                {m === 'amount' ? 'Amount' : '%'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-[7px] mb-[7px]">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="font-mono text-[10px] font-semibold text-faint text-center tracking-[0.5px]"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[7px]">
        {cells.map((c, i) => {
          if (c.day === null)
            return (
              <div
                key={`blank-${i}`}
                className={`${cellBase} border-dashed`}
              />
            )
          const pnl = total(c)
          const mag =
            pnl !== 0
              ? 0.16 + Math.min(0.6, (Math.abs(pnl) / maxAbs) * 0.6)
              : 0
          const bg =
            pnl > 0
              ? `rgba(47, 214, 122, ${mag.toFixed(3)})`
              : pnl < 0
                ? `rgba(255, 90, 90, ${mag.toFixed(3)})`
                : undefined
          const toneClass =
            pnl > 0
              ? ' border-[rgba(47,214,122,0.55)]'
              : pnl < 0
                ? ' border-[rgba(255,90,90,0.55)]'
                : ''
          const clickable = c.data
            ? ' cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.22)]'
            : ''
          const count = c.data?.trades.length ?? 0
          return (
            <button
              type="button"
              key={`day-${c.iso}`}
              className={`${cellBase}${toneClass}${clickable}`}
              style={{ background: bg }}
              onClick={() => c.data && setSelected(c.iso)}
              disabled={!c.data}
            >
              <span className="text-[11px] font-bold text-faint">{c.day}</span>
              <span
                className={`font-mono text-[11.5px] font-bold max-[900px]:text-[9.5px] ${pnl > 0 ? 'text-green' : pnl < 0 ? 'text-red' : 'text-faint'}`}
              >
                {display(pnl)}
              </span>
              {count > 0 && (
                <span className="absolute top-[5px] right-[5px] min-w-[15px] h-[15px] px-1 inline-flex items-center justify-center rounded-pill bg-surface border border-border font-mono text-[9px] font-bold text-muted">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <DayTradesModal
        date={selected}
        day={selected ? daysMap[selected] ?? null : null}
        onClose={() => setSelected(null)}
      />
    </section>
  )
}
