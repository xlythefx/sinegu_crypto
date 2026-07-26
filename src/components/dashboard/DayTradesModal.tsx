import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { displaySymbol } from '../../lib/chart'
import { fmtDateTime, fmtMediumDate, fmtNum, fmtSignedMoney } from '../../lib/format'
import type { DayPnl } from '../../types/dashboard'

interface DayTradesModalProps {
  /** ISO date (YYYY-MM-DD) of the selected day, or null when closed. */
  date: string | null
  day: DayPnl | null
  onClose: () => void
}

/** Modal listing every trade closed on a given day (asset, side, P&L). */
export default function DayTradesModal({
  date,
  day,
  onClose,
}: DayTradesModalProps) {
  useEffect(() => {
    if (!date) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [date, onClose])

  if (!date || !day) return null

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

        <div className="flex flex-col gap-[9px]">
          {day.trades.map((t, i) => {
            const short = t.position_side === 'SHORT'
            return (
              <div
                className="flex items-center justify-between gap-3 py-3 px-[14px] border border-hair rounded-row bg-surface2"
                key={`${t.symbol}-${i}`}
              >
                <div className="flex items-center gap-[9px] flex-wrap">
                  <span className="font-bold text-[14px]">
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
                <div className="flex flex-col items-end gap-[3px] flex-shrink-0">
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
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
