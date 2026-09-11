import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { displaySymbol } from '../../lib/chart'
import { fmtDateTime, fmtMediumDate, fmtNum, fmtSignedMoney } from '../../lib/format'
import { useTapUnlock } from '../../hooks/useTapUnlock'
import type { DayPnl, DayTrade } from '../../types/dashboard'

/** Trades shown per page — a busy day can close 30+, which is unreadable in one list. */
const PAGE_SIZE = 5

/** The edit / delete icons are hidden even for accounts allowed to use them,
 *  and appear only after the ticker label is tapped this many times inside
 *  the window — an easter egg, so a closed-trade row (permanent, and read by
 *  invoicing and the public track record) is never one stray click away. */
const UNLOCK_TAPS = 8
const UNLOCK_WINDOW_MS = 3000

const pageBtn =
  'inline-flex items-center gap-1 h-8 px-3 rounded-btn border border-border bg-surface2 text-[12px] font-semibold text-text cursor-pointer transition-colors hover:enabled:border-accent hover:enabled:text-accent disabled:opacity-40 disabled:cursor-not-allowed'

const rowBtn =
  'inline-grid place-items-center w-[30px] h-[30px] rounded-btn border border-border bg-surface text-muted cursor-pointer transition-colors hover:bg-surface2 hover:text-text'
const rowBtnDanger = `${rowBtn} hover:!border-[color-mix(in_srgb,var(--red)_40%,transparent)] hover:!bg-[color-mix(in_srgb,var(--red)_12%,transparent)] hover:!text-red`

interface DayTradesModalProps {
  /** ISO date (YYYY-MM-DD) of the selected day, or null when closed. */
  date: string | null
  day: DayPnl | null
  onClose: () => void
  /** Admin-only: allow per-trade edit / delete. Both handlers are required
   *  with it — the icons appear here, inside the day's list, because a single
   *  trade is the only thing they can act on (a calendar cell is a whole day).
   *  Allowed is not shown: the icons stay hidden until the tap gesture
   *  ({@link UNLOCK_TAPS}) unlocks them, and re-lock when the popup closes. */
  canManage?: boolean
  onEditTrade?: (trade: DayTrade) => void
  onDeleteTrade?: (trade: DayTrade) => void
}

/** Modal listing every trade closed on a given day (asset, side, P&L),
 *  paged {@link PAGE_SIZE} at a time. */
export default function DayTradesModal({
  date,
  day,
  onClose,
  canManage = false,
  onEditTrade,
  onDeleteTrade,
}: DayTradesModalProps) {
  const [page, setPage] = useState(0)
  // Re-locks on close and on switching day: `date` is the popup's identity.
  const { unlocked, tap } = useTapUnlock(UNLOCK_TAPS, UNLOCK_WINDOW_MS, date)
  const showManage = canManage && unlocked

  useEffect(() => {
    if (!date) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [date, onClose])

  // Reopening on another day must start at page 1, never mid-list.
  useEffect(() => setPage(0), [date])

  if (!date || !day) return null

  const pageCount = Math.max(1, Math.ceil(day.trades.length / PAGE_SIZE))
  // Clamp: the day's trade list can shrink under us on a refetch.
  const current = Math.min(page, pageCount - 1)
  const start = current * PAGE_SIZE
  const visible = day.trades.slice(start, start + PAGE_SIZE)

  return createPortal(
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] flex items-center justify-center z-[100] p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Trades for ${fmtMediumDate(date)}`}
    >
      <div
        className="w-full max-w-[520px] max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-[18px] py-[22px] px-6 animate-[dtm-in_0.2s_cubic-bezier(0.2,0.7,0.2,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="font-display text-[18px] font-extrabold">
              {fmtMediumDate(date)}
            </div>
            <div className="text-[12.5px] text-muted mt-[3px]">
              {day.trades.length} trade{day.trades.length === 1 ? '' : 's'} ·{' '}
              {day.wins}W / {day.losses}L · net{' '}
              <span
                className={`font-mono ${day.total < 0 ? 'text-red' : 'text-green'}`}
              >
                {fmtSignedMoney(day.total)}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-btn border border-border bg-surface2 text-muted cursor-pointer flex-shrink-0 hover:text-text hover:border-accent"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div
          key={current}
          className="flex flex-col gap-[9px] animate-[fadeup_0.35s_ease-out]"
        >
          {visible.map((t, i) => {
            const short = t.position_side === 'SHORT'
            return (
              <div
                className="flex items-center justify-between gap-3 py-3 px-[14px] border border-hair rounded-row bg-surface2"
                key={t.id ?? `${t.symbol}-${start + i}`}
              >
                <div className="flex items-center gap-[9px] flex-wrap">
                  {/* The tap target. No affordance on purpose; select-none so
                      a burst of clicks does not highlight the text. */}
                  <span
                    className="font-bold text-[14px] select-none"
                    onClick={canManage ? tap : undefined}
                  >
                    {displaySymbol(t.symbol)}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold tracking-[0.06em] py-[2px] px-2 rounded-pill border ${
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
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div className="flex flex-col items-end gap-[3px]">
                    <span className="text-[11px] text-faint whitespace-nowrap font-mono">
                      {fmtNum(Math.abs(t.position_amt), 4)} @{' '}
                      {fmtDateTime(t.closed_at)}
                    </span>
                    <span
                      className={`text-[14px] font-extrabold font-mono ${t.realized_pnl < 0 ? 'text-red' : 'text-green'}`}
                    >
                      {fmtSignedMoney(t.realized_pnl)}
                    </span>
                  </div>
                  {showManage && (
                    <div className="flex items-center gap-1.5 pl-2.5 border-l border-hair animate-[fadeup_0.35s_ease-out]">
                      <button
                        type="button"
                        className={rowBtn}
                        title={`Edit trade #${t.id}`}
                        onClick={() => onEditTrade?.(t)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={rowBtnDanger}
                        title={`Delete trade #${t.id}`}
                        onClick={() => onDeleteTrade?.(t)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-hair pt-3.5">
            <button
              type="button"
              className={pageBtn}
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              aria-label="Previous trades"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <span className="font-mono text-[11.5px] text-muted text-center">
              {start + 1}–{start + visible.length} of {day.trades.length}
            </span>
            <button
              type="button"
              className={pageBtn}
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
              aria-label="Next trades"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
