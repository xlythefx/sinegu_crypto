import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CompareCard from './CompareCard'
import { fmtMediumDate } from '../../../../lib/format'
import { FEED_SOURCE, MS_PRECISION_SINCE } from '../../../../lib/feedCompare'
import type { FeedCompareData } from '../../../../types/feedCompare'

const PER_PAGE = 10
const PAG_BTN =
  'grid place-items-center w-8 h-8 border border-border bg-surface2 text-text rounded-[9px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

/**
 * Every compared signal, newest first: pairs and signals only one side sent
 * in one timeline. Paged here — the API answers the whole window at once, so
 * turning a page costs nothing. The parent re-keys this on every filter
 * change, which replays the reveal and lands back on page 1.
 */
export default function CompareList({
  data,
  anyFilterActive,
  onClear,
}: {
  data: FeedCompareData
  anyFilterActive: boolean
  onClear: () => void
}) {
  const [page, setPage] = useState(1)
  const { rows, window: w, matchSeconds } = data
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const offset = (page - 1) * PER_PAGE
  const shown = rows.slice(offset, offset + PER_PAGE)
  const span = `${fmtMediumDate(w.from)} – ${w.to ? fmtMediumDate(w.to) : 'now'}`

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 py-[34px] text-center">
        <p className="max-w-[520px] text-[13px] leading-[1.55] text-muted">
          No coin got signals from both {FEED_SOURCE.main} and {FEED_SOURCE.test} between {span}. A signal is
          compared once both have sent the same coin in these dates.
        </p>
        {anyFilterActive && (
          <button type="button" onClick={onClear} className="text-[12.5px] font-semibold text-accent hover:underline">
            Clear filters
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <p className="mb-3 text-[12px] leading-[1.55] text-faint">
        {span} · the same coin and action within {matchSeconds / 60} minutes counts as one signal. Arrival times
        are to the millisecond from {fmtMediumDate(MS_PRECISION_SINCE)}; earlier ones to the second.
      </p>

      <div className="flex flex-col gap-2.5">
        {shown.map((row) => (
          <CompareCard key={`${row.main?.id ?? 0}-${row.test?.id ?? 0}`} row={row} matchSeconds={matchSeconds} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-hair pt-3.5">
        <span className="text-[12px] text-faint">
          Showing {offset + 1}–{offset + shown.length} of {total}
        </span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className={PAG_BTN}
            onClick={() => setPage(Math.max(1, page - 1))}
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
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </>
  )
}
