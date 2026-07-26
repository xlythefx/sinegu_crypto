import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { useApiData } from '../../hooks/useApiData'
import { getAdminDailyPnl } from '../../services/admin'
import { displaySymbol } from '../../lib/chart'
import { fmtMediumDate, fmtSignedMoney } from '../../lib/format'
import type { DailyPnlDay } from '../../types/admin'
import './AdminPnlCalendar.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Cell {
  day: number | null
  iso: string
  data: DailyPnlDay | null
}

function isoKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildCells(
  year: number,
  month: number,
  days: Record<string, DailyPnlDay>,
): Cell[] {
  const first = new Date(year, month, 1).getDay()
  const count = new Date(year, month + 1, 0).getDate()
  const cells: Cell[] = []
  for (let i = 0; i < first; i++) cells.push({ day: null, iso: '', data: null })
  for (let d = 1; d <= count; d++) {
    const iso = isoKey(year, month, d)
    cells.push({ day: d, iso, data: days[iso] ?? null })
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: '', data: null })
  return cells
}

/**
 * Full-width admin Daily P&L calendar. Cells are tinted red→green by the sign
 * and magnitude of that day's realized P&L; clicking a day opens a panel with
 * every trade closed on it (asset, side, and P&L).
 */
export default function AdminPnlCalendar() {
  const { data: days } = useApiData(getAdminDailyPnl)
  const now = useMemo(() => new Date(), [])
  const [view, setView] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  )
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
  const canGoNext =
    view.getFullYear() < now.getFullYear() ||
    (view.getFullYear() === now.getFullYear() &&
      view.getMonth() < now.getMonth())

  // Scale color intensity by the biggest move in the visible month
  const maxAbs = useMemo(
    () => Math.max(1, ...cells.map((c) => Math.abs(c.data?.total ?? 0))),
    [cells]
  )
  const winDays = cells.filter((c) => (c.data?.total ?? 0) > 0).length
  const lossDays = cells.filter((c) => (c.data?.total ?? 0) < 0).length

  const selectedDay = selected ? daysMap[selected] : null

  const changeMonth = (delta: number) => {
    setSelected(null)
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))
  }

  // Close the day-detail modal on Escape.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  return (
    <section className="apc-cal dcard" data-aos="fade-up" data-aos-delay="250">
      <div className="dcard__title-row">
        <span className="dchip">
          <CalendarIcon size={16} />
        </span>
        <div>
          <div className="dcard__title">Daily P&L Calendar</div>
          <div className="dcard__sub">
            {winDays} green / {lossDays} red days · click a day for its trades
          </div>
        </div>
      </div>

      <div className="apc-cal__nav">
        <button
          type="button"
          className="apc-cal__nav-btn"
          onClick={() => changeMonth(-1)}
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <span className="apc-cal__month">{monthLabel}</span>
        <button
          type="button"
          className="apc-cal__nav-btn"
          disabled={!canGoNext}
          onClick={() => canGoNext && changeMonth(1)}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="apc-cal__weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="apc-cal__grid">
        {cells.map((c, i) => {
          if (c.day === null)
            return <div key={`blank-${i}`} className="apc-cal__cell apc-cal__cell--blank" />

          const pnl = c.data?.total ?? 0
          const intensity =
            pnl !== 0 ? 0.16 + Math.min(0.6, (Math.abs(pnl) / maxAbs) * 0.6) : 0
          const bg =
            pnl > 0
              ? `rgba(47, 214, 122, ${intensity.toFixed(3)})`
              : pnl < 0
                ? `rgba(255, 90, 90, ${intensity.toFixed(3)})`
                : undefined
          const cls =
            pnl > 0
              ? ' apc-cal__cell--pos'
              : pnl < 0
                ? ' apc-cal__cell--neg'
                : ''
          const active = c.iso === selected ? ' apc-cal__cell--active' : ''
          const clickable = c.data ? ' apc-cal__cell--clickable' : ''

          return (
            <button
              type="button"
              key={`day-${c.iso}`}
              className={`apc-cal__cell${cls}${active}${clickable}`}
              style={{ background: bg }}
              onClick={() => c.data && setSelected(c.iso === selected ? null : c.iso)}
              disabled={!c.data}
            >
              <span className="apc-cal__day">{c.day}</span>
              <span
                className={`apc-cal__pnl mono ${pnl > 0 ? 'is-pos' : pnl < 0 ? 'is-neg' : 'is-flat'}`}
              >
                {pnl === 0
                  ? '—'
                  : `${pnl > 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(0)}`}
              </span>
              {c.data && c.data.trades.length > 0 && (
                <span className="apc-cal__count mono">
                  {c.data.trades.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selected &&
        selectedDay &&
        createPortal(
          <div
            className="apc-cal__modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`Trades on ${fmtMediumDate(selected)}`}
            onClick={() => setSelected(null)}
          >
          <div
            className="apc-cal__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="apc-cal__modal-head">
              <div>
                <div className="apc-cal__detail-title">
                  {fmtMediumDate(selected)}
                </div>
                <div className="apc-cal__detail-sub">
                  {selectedDay.trades.length} trade
                  {selectedDay.trades.length === 1 ? '' : 's'} ·{' '}
                  {selectedDay.wins}W / {selectedDay.losses}L · net{' '}
                  <span
                    className={`mono ${selectedDay.total < 0 ? 'is-neg' : 'is-pos'}`}
                  >
                    {fmtSignedMoney(selectedDay.total)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="apc-cal__detail-close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="apc-cal__trades">
              {selectedDay.trades.map((t, i) => {
                const short = t.position_side === 'SHORT'
                return (
                  <div className="apc-cal__trade" key={`${t.symbol}-${i}`}>
                    <div className="apc-cal__trade-left">
                      <span className="apc-cal__trade-sym">
                        {displaySymbol(t.symbol)}
                      </span>
                      <span
                        className={`apc-cal__trade-side ${short ? 'is-short' : 'is-long'}`}
                      >
                        {t.position_side}
                      </span>
                      {t.strategy && (
                        <span className="apc-cal__trade-strat">{t.strategy}</span>
                      )}
                    </div>
                    <span
                      className={`apc-cal__trade-pnl mono ${t.realized_pnl < 0 ? 'is-neg' : 'is-pos'}`}
                    >
                      {fmtSignedMoney(t.realized_pnl)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>,
          document.body,
        )}
    </section>
  )
}
