import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { useIsMobile } from '../../../hooks/useIsMobile'

/**
 * THE FILTER CONVENTION — every admin list filters the same way:
 * 1. One FilterPanel per list, placed OUTSIDE the re-keyed animated list region,
 *    so typing never remounts (and unfocuses) an input.
 * 2. Groups in a fixed order: scope first (exchange / side / type), then coin and
 *    account narrowing (FilterSelect, SearchField), then dates (DateRangeFilter).
 * 3. Single-choice facets with a handful of choices use Segmented; long option
 *    lists use FilterSelect. Every control sits in a FilterGroup with a label.
 * 4. Every filter lives in the URL via `useUrlFilters`, so a reload or a shared
 *    link keeps the view.
 * 5. ActiveFilters chips go directly under the panel whenever anything is active.
 * 6. The list below re-keys on the filters (`key={...}` + the fadeup class) so it
 *    replays its reveal on every change — the project-wide convention.
 */

interface FilterPanelProps {
  children: ReactNode
  activeCount: number
  onClearAll: () => void
  /** Right side of the header row, e.g. "Showing 42 of 464". */
  summary?: ReactNode
  className?: string
}

/**
 * The filter bar's frame: a header row (title, active count, summary, Clear
 * all) over the FilterGroups. Always open from 640px up; on a phone the body
 * folds behind a "Filters" button and starts collapsed, so the list is the
 * first thing on screen and the count badge says whether it is narrowed.
 */
export default function FilterPanel({
  children,
  activeCount,
  onClearAll,
  summary,
  className = '',
}: FilterPanelProps) {
  const phone = useIsMobile(640)
  const [expanded, setExpanded] = useState(false)
  const open = !phone || expanded
  const bodyId = useId()
  const active = activeCount > 0

  const title = (
    <>
      <SlidersHorizontal size={14} aria-hidden="true" className="flex-none text-muted" />
      <span className="text-[13px] font-semibold text-text">Filters</span>
      {active && (
        <span className="inline-grid h-5 min-w-5 place-items-center rounded-pill bg-accent px-1.5 font-mono text-[11px] font-bold leading-none text-on-accent">
          <span aria-hidden="true">{activeCount}</span>
          <span className="sr-only">, {activeCount} active</span>
        </span>
      )}
    </>
  )

  return (
    <section
      aria-label="Filters"
      className={`rounded-card border border-border bg-surface ${className}`}
    >
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5 ${
          open ? 'border-b border-hair' : ''
        }`}
      >
        {phone ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setExpanded((v) => !v)}
            className="-mx-2 inline-flex min-h-9 items-center gap-2 rounded-btn px-2 transition-colors hover:bg-surface2"
          >
            {title}
            <ChevronDown
              size={15}
              aria-hidden="true"
              className={`flex-none text-faint transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        ) : (
          <div className="inline-flex min-h-8 items-center gap-2">{title}</div>
        )}

        {(summary || active) && (
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {summary && <div className="min-w-0 text-[12.5px] text-muted">{summary}</div>}
            {summary && active && <span aria-hidden="true" className="h-4 w-px flex-none bg-border" />}
            {active && (
              <button
                type="button"
                onClick={onClearAll}
                className="inline-flex min-h-8 flex-none items-center gap-1 rounded-btn px-1 text-[12.5px] font-semibold text-accent underline-offset-2 hover:underline"
              >
                <X size={13} aria-hidden="true" />
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      <div
        id={bodyId}
        className={
          open
            ? `flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-4 sm:px-5 ${
                phone ? 'animate-[fadeup_0.25s_ease-out]' : ''
              }`
            : 'hidden'
        }
      >
        {children}
      </div>
    </section>
  )
}
