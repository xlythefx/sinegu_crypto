import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import OutsideCloseCard from './OutsideCloseCard'
import TradeLogCard from './TradeLogCard'
import type { TradeLogsData } from '../../../types/tradeLogs'

const PAG_BTN =
  'grid place-items-center w-8 h-8 border border-border bg-surface2 text-text rounded-[9px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

/**
 * One page of signals. The parent re-keys this on every filter and page
 * change, which both replays the reveal and closes whichever row was open.
 */
export default function SignalList({
  data,
  page,
  perPage,
  onPage,
  accountFiltersActive,
  anyFilterActive,
  onClear,
}: {
  data: TradeLogsData
  page: number
  perPage: number
  onPage: (page: number) => void
  accountFiltersActive: boolean
  anyFilterActive: boolean
  onClear: () => void
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const { logs, pagination } = data
  const total = pagination.total
  const offset = (page - 1) * perPage
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 py-[34px] text-center">
        <p className="text-[13px] text-muted">
          {anyFilterActive
            ? 'Nothing matches your filters.'
            : 'Nothing logged yet. The engine writes a row here every time TradingView fires.'}
        </p>
        {anyFilterActive && (
          <button
            type="button"
            onClick={onClear}
            className="text-[12.5px] font-semibold text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {logs.map((item) =>
          item.kind === 'outside_close' ? (
            <OutsideCloseCard key={item.id} row={item} />
          ) : (
            <TradeLogCard
              key={item.id}
              log={item}
              expanded={expanded === item.id}
              onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              accountFiltersActive={accountFiltersActive}
            />
          ),
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2.5 mt-4 pt-3.5 border-t border-hair">
          <span className="text-[12px] text-faint">
            Showing {offset + 1}–{Math.min(offset + logs.length, total)} of {total}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className={PAG_BTN}
              onClick={() => onPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[12.5px] text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className={PAG_BTN}
              onClick={() => onPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
