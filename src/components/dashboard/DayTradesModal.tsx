import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { displaySymbol } from '../../lib/chart'
import { fmtDateTime, fmtMediumDate, fmtNum, fmtSignedMoney } from '../../lib/format'
import type { DayPnl } from '../../types/dashboard'
import './DayTradesModal.css'

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
      className="dtm__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Trades for ${fmtMediumDate(date)}`}
    >
      <div className="dtm" onClick={(e) => e.stopPropagation()}>
        <div className="dtm__head">
          <div>
            <div className="dtm__title">{fmtMediumDate(date)}</div>
            <div className="dtm__sub">
              {day.trades.length} trade{day.trades.length === 1 ? '' : 's'} ·{' '}
              {day.wins}W / {day.losses}L · net{' '}
              <span className={`mono ${day.total < 0 ? 'is-neg' : 'is-pos'}`}>
                {fmtSignedMoney(day.total)}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="dtm__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="dtm__trades">
          {day.trades.map((t, i) => {
            const short = t.position_side === 'SHORT'
            return (
              <div className="dtm__trade" key={`${t.symbol}-${i}`}>
                <div className="dtm__trade-main">
                  <span className="dtm__trade-sym">
                    {displaySymbol(t.symbol)}
                  </span>
                  <span
                    className={`dtm__trade-side ${short ? 'is-short' : 'is-long'}`}
                  >
                    {t.position_side}
                  </span>
                  {t.strategy && (
                    <span className="dtm__trade-strat">{t.strategy}</span>
                  )}
                </div>
                <div className="dtm__trade-meta">
                  <span className="dtm__trade-qty mono">
                    {fmtNum(Math.abs(t.position_amt), 4)} @{' '}
                    {fmtDateTime(t.closed_at)}
                  </span>
                  <span
                    className={`dtm__trade-pnl mono ${t.realized_pnl < 0 ? 'is-neg' : 'is-pos'}`}
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
