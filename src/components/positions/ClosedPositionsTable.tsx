import { ChevronLeft, ChevronRight } from 'lucide-react'
import FeeLine from './FeeLine'
import type { ClosedTrade } from './types'

export const ITEMS_PER_PAGE = 10

const TH = 'text-left text-[11px] font-bold tracking-[0.04em] uppercase text-faint py-2.5 px-3 border-b border-hair whitespace-nowrap'
const TD = 'py-3 px-3 border-b border-hair align-middle'
const PAG_BTN =
  'flex items-center gap-1 h-8 px-3 border border-border rounded-btn bg-surface text-text text-[12px] font-semibold cursor-pointer font-body disabled:opacity-45 disabled:cursor-not-allowed enabled:hover:border-accent-line enabled:hover:bg-accent-soft'

interface Props {
  trades: ClosedTrade[]
  page: number
  onPageChange: (next: number) => void
}

function tickerInitials(ticker: string) {
  return ticker.split('/')[0].slice(0, 3)
}

/** Closed positions table with pagination:
 *  Ticker · Price · Strategy · P&L · Closed · Closed At. */
export default function ClosedPositionsTable({
  trades,
  page,
  onPageChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(trades.length / ITEMS_PER_PAGE))
  const start = (page - 1) * ITEMS_PER_PAGE
  const visible = trades.slice(start, start + ITEMS_PER_PAGE)

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={TH}>Ticker</th>
              <th className={TH}>Price</th>
              <th className={TH}>Strategy</th>
              <th className={TH}>P&L</th>
              <th className={TH}>Closed</th>
              <th className={`${TH} max-[900px]:hidden`}>Closed At</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted text-[13px] py-7 px-3">
                  No trades found matching the selected filters.
                </td>
              </tr>
            )}
            {visible.map((t, i) => {
              const positive = t.pnl >= 0
              const tone = positive ? 'text-green' : 'text-red'
              return (
                <tr
                  key={`${t.ticker}-${t.closedAt}-${i}`}
                  className="transition-colors hover:bg-surface2"
                >
                  <td className={TD}>
                    <div className="flex items-center gap-[9px] font-bold whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-[9px] bg-accent-soft border border-accent-line text-accent text-[9.5px] font-semibold flex-none font-mono">
                        {tickerInitials(t.ticker)}
                      </span>
                      {t.ticker}
                    </div>
                  </td>
                  <td className={`${TD} font-mono`}>${t.price}</td>
                  <td className={`${TD} text-muted text-[12.5px]`}>{t.strategy}</td>
                  <td className={TD}>
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-[13px] font-bold font-mono ${tone}`}>
                        {positive ? '+' : '−'}${Math.abs(t.pnl).toFixed(2)}
                      </span>
                      <span className={`text-[11px] font-semibold font-mono ${tone}`}>
                        {positive ? '+' : '−'}
                        {Math.abs(t.pnlPct).toFixed(2)}%
                      </span>
                      <FeeLine fee={t.fee} source={t.feeSource} />
                    </div>
                  </td>
                  {/* fixed-width numeral so the "Position(s)" label starts at the
                      same x on every row instead of shifting with the digit count */}
                  <td className={`${TD} whitespace-nowrap`}>
                    <span className="font-mono inline-block min-w-[2ch] text-right">
                      {t.positions}
                    </span>{' '}
                    {t.positions === 1 ? 'Position' : 'Positions'}
                  </td>
                  <td className={`${TD} text-muted text-[12.5px] font-mono max-[900px]:hidden`}>
                    {t.closedAt}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {trades.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-3.5">
          <span className="text-[11.5px] text-faint text-center">
            Showing {start + 1}–{Math.min(start + ITEMS_PER_PAGE, trades.length)}{' '}
            of {trades.length}
            <span className="block pt-1">
              P&amp;L is shown after exchange fees (commission and funding),
              matching your exchange account. Fees marked est. are estimated
              until the exchange&apos;s receipts are matched.
            </span>
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className={PAG_BTN}
                disabled={page === 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="text-[12px] text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={PAG_BTN}
                disabled={page === totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
