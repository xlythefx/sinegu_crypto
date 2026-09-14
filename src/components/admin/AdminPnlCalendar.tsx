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
import type { DailyPnlDay, DailyPnlMap } from '../../types/admin'
import FeeLine from '../positions/FeeLine'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Base calendar cell (no background — set per-cell to keep blanks transparent). */
const cellBase =
  'relative flex flex-col justify-between items-start min-h-[82px] py-3 px-[13px] rounded-row border-0 text-left transition-[transform,box-shadow] duration-150 max-[700px]:min-h-[60px] max-[700px]:py-[9px] max-[700px]:px-2.5 max-[700px]:rounded-field'

const navBtn =
  'inline-flex items-center gap-1 h-8 px-3 rounded-btn border border-accent-soft bg-surface text-accent text-[12px] font-semibold cursor-pointer hover:enabled:bg-accent-soft disabled:opacity-45 disabled:cursor-not-allowed'

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

interface AdminPnlCalendarProps {
  /**
   * Data source override (defaults to the master GET /admin/daily-pnl).
   * MUST be referentially stable (module fn or `useCallback`) — an inline
   * arrow here would make the calendar refetch in a loop.
   */
  fetchDays?: () => Promise<DailyPnlMap>
  /** Replaces the default "n green / n red days" subtitle line. */
  subtitle?: string
  /** AOS reveal delay in ms (matches the admin-dashboard stagger by default). */
  aosDelay?: number
}

/**
 * Full-width admin Daily P&L calendar. Cells are tinted red→green by the sign
 * and magnitude of that day's realized P&L; clicking a day opens a panel with
 * every trade closed on it (asset, side, and P&L).
 */
export default function AdminPnlCalendar({
  fetchDays = getAdminDailyPnl,
  subtitle,
  aosDelay = 250,
}: AdminPnlCalendarProps = {}) {
  const { data: days } = useApiData(fetchDays, [fetchDays])
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
    <section
      className="rounded-card border border-border bg-surface p-card"
      data-aos="fade-up"
      data-aos-delay={aosDelay}
    >
      <div className="flex items-center gap-2.5 mb-[14px]">
        <span className="w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none">
          <CalendarIcon size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Daily P&L Calendar
          </div>
          <div className="text-[12px] text-muted mt-px">
            {subtitle ??
              `${winDays} green / ${lossDays} red days · click a day for its trades`}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2.5 mb-3">
        <button type="button" className={navBtn} onClick={() => changeMonth(-1)}>
          <ChevronLeft size={14} />
          Previous
        </button>
        <span className="text-[13px] font-extrabold">{monthLabel}</span>
        <button
          type="button"
          className={navBtn}
          disabled={!canGoNext}
          onClick={() => canGoNext && changeMonth(1)}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.5px] text-faint"
          >
            {d}
          </span>
        ))}
      </div>

      <div
        key={monthLabel}
        className="grid grid-cols-7 gap-[9px] animate-[fadeup_0.35s_ease-out]"
      >
        {cells.map((c, i) => {
          if (c.day === null)
            return (
              <div key={`blank-${i}`} className={`${cellBase} bg-transparent`} />
            )

          const pnl = c.data?.total ?? 0
          const intensity =
            pnl !== 0 ? 0.16 + Math.min(0.6, (Math.abs(pnl) / maxAbs) * 0.6) : 0
          const bg =
            pnl > 0
              ? `rgba(47, 214, 122, ${intensity.toFixed(3)})`
              : pnl < 0
                ? `rgba(255, 90, 90, ${intensity.toFixed(3)})`
                : undefined
          const active =
            c.iso === selected ? ' outline outline-2 outline-accent outline-offset-1' : ''
          const clickable = c.data
            ? ' cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.22)]'
            : ''

          return (
            <button
              type="button"
              key={`day-${c.iso}`}
              className={`${cellBase} bg-surface2${active}${clickable}`}
              style={{ background: bg }}
              onClick={() => c.data && setSelected(c.iso === selected ? null : c.iso)}
              disabled={!c.data}
            >
              <span className="text-[11px] font-bold text-faint">{c.day}</span>
              <span
                className={`font-mono text-[12px] max-w-full overflow-hidden text-ellipsis ${
                  pnl > 0
                    ? 'font-extrabold text-green'
                    : pnl < 0
                      ? 'font-extrabold text-red'
                      : 'font-semibold text-faint'
                }`}
              >
                {pnl === 0
                  ? '—'
                  : `${pnl > 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(0)}`}
              </span>
              {c.data && c.data.trades.length > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-pill bg-surface border border-border font-mono text-[9.5px] font-bold text-muted">
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
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label={`Trades on ${fmtMediumDate(selected)}`}
            onClick={() => setSelected(null)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-[540px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-hair py-4 px-5">
                <div>
                  <div className="font-display text-[16px] font-extrabold">
                    {fmtMediumDate(selected)}
                  </div>
                  <div className="text-[12.5px] text-muted mt-0.5">
                    {selectedDay.trades.length} trade
                    {selectedDay.trades.length === 1 ? '' : 's'} ·{' '}
                    {selectedDay.wins}W / {selectedDay.losses}L ·{' '}
                    {selectedDay.fees !== 0 ? 'after fees' : 'net'}{' '}
                    <span
                      className={`font-mono ${selectedDay.total < 0 ? 'text-red' : 'text-green'}`}
                    >
                      {fmtSignedMoney(selectedDay.total)}
                    </span>
                  </div>
                  {selectedDay.fees !== 0 && (
                    <div className="text-[11.5px] text-faint mt-0.5 font-mono">
                      before fees{' '}
                      <span className={selectedDay.total_gross < 0 ? 'text-red' : 'text-green'}>
                        {fmtSignedMoney(selectedDay.total_gross)}
                      </span>
                      {' · '}exchange fees {fmtSignedMoney(-selectedDay.fees)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-btn border border-border bg-surface text-muted cursor-pointer shrink-0 hover:text-text hover:border-accent"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto p-4">
                {selectedDay.trades.map((t, i) => {
                  const short = t.position_side === 'SHORT'
                  return (
                    <div
                      className="flex items-center justify-between gap-3 py-2.5 px-3 border border-hair rounded-field bg-surface"
                      key={`${t.symbol}-${i}`}
                    >
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-[13.5px]">
                          {displaySymbol(t.symbol)}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-semibold tracking-[0.06em] py-0.5 px-2 rounded-pill border ${
                            short
                              ? 'text-red border-[rgba(255,90,90,0.35)] bg-[rgba(255,90,90,0.08)]'
                              : 'text-green border-[rgba(47,214,122,0.35)] bg-[rgba(47,214,122,0.08)]'
                          }`}
                        >
                          {t.position_side}
                        </span>
                        {t.strategy && (
                          <span className="text-[11.5px] text-faint">
                            {t.strategy}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-[3px] shrink-0">
                        <span
                          className={`font-mono text-[13.5px] font-extrabold ${t.realized_pnl < 0 ? 'text-red' : 'text-green'}`}
                        >
                          {fmtSignedMoney(t.realized_pnl)}
                        </span>
                        <FeeLine fee={t.exchange_fee} source={t.fee_source} align="end" />
                      </div>
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
