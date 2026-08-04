import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { ChipMode } from '../../types/analytics'

export interface ChipOption {
  /** Sent to the API verbatim. */
  value: string
  /** What the chip reads as (e.g. 'BTC/USDT' for 'BTCUSDT'). */
  label: string
}

interface ChipFilterPanelProps {
  /** Everything selectable in the current exchange + date scope. */
  available: ChipOption[]
  selected: Set<string>
  mode: ChipMode
  onToggle: (value: string) => void
  onModeChange: (mode: ChipMode) => void
  onClear: () => void
  /** Singular noun for the copy, e.g. 'ticker'. */
  noun: string
  /** Show the search box once the list passes this many chips. */
  searchThreshold?: number
}

const MODES: ChipMode[] = ['include', 'exclude']

const SEG_BASE =
  'rounded-pill px-3 py-1 text-[11px] font-extrabold capitalize cursor-pointer transition-colors border border-transparent'
const SEG_OFF = 'text-muted hover:text-text'
const SEG_ON: Record<ChipMode, string> = {
  include:
    'text-green border-[color-mix(in_srgb,var(--green)_38%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)]',
  exclude:
    'text-red border-[color-mix(in_srgb,var(--red)_38%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)]',
}

const CHIP_BASE =
  'rounded-pill border px-2.5 py-1 text-[11.5px] font-bold cursor-pointer transition-colors font-body'
const CHIP_IDLE =
  'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'
const CHIP_INCLUDED =
  'text-green border-[color-mix(in_srgb,var(--green)_45%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)]'
const CHIP_EXCLUDED =
  'text-red line-through border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)]'

/**
 * Include / exclude chip picker for one dimension (tickers, strategies).
 * Chrome-less on purpose — it renders as the body of a tab inside
 * AnalyticsFilterPanel, which owns the card and the heading.
 *
 * An empty selection means "no filter" in both modes, so the panel starts out
 * inert. In include mode the picked chips are the only ones counted; in
 * exclude mode they are the only ones dropped. Chips never disappear when
 * picked — the list is built before filtering — otherwise excluding something
 * would remove the only control that could bring it back.
 */
export default function ChipFilterPanel({
  available,
  selected,
  mode,
  onToggle,
  onModeChange,
  onClear,
  noun,
  searchThreshold = 12,
}: ChipFilterPanelProps) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return available
    return available.filter((option) => option.label.toUpperCase().includes(q))
  }, [available, query])

  if (available.length === 0) {
    return (
      <p className="text-[13px] text-muted py-1.5">
        No {noun}s closed any trades in the current exchange and date range.
      </p>
    )
  }

  const count = selected.size
  const isInclude = mode === 'include'
  // In include mode an empty set still shows everything, so only dim the
  // unpicked chips once at least one has been picked.
  const dimUnselected = isInclude && count > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="inline-flex gap-1 rounded-pill border border-hair bg-surface2 p-[3px]">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              aria-pressed={mode === m}
              className={`${SEG_BASE} ${mode === m ? SEG_ON[m] : SEG_OFF}`}
            >
              {m}
            </button>
          ))}
        </div>

        <span className="text-[11.5px] text-faint font-semibold">
          {isInclude
            ? `Only the selected ${noun}s count toward every metric below.`
            : `Selected ${noun}s are dropped from every metric below.`}
        </span>

        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold text-muted border border-border rounded-nav px-2.5 py-1.5 cursor-pointer hover:text-text hover:border-accent-line"
          >
            <X size={12} />
            Clear {count}
          </button>
        )}
      </div>

      {available.length > searchThreshold && (
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${noun}s…`}
            aria-label={`Search ${noun}s`}
            className="w-full h-[38px] rounded-nav border border-border bg-surface2 text-text pl-9 pr-3 text-[13px] placeholder:text-faint focus:border-accent-line"
          />
        </div>
      )}

      {/* Re-mounted per mode so the chips replay their reveal on a switch. */}
      <div
        key={mode}
        className="flex flex-wrap gap-[7px] max-h-40 overflow-y-auto pr-1 animate-[fadeup_0.35s_ease-out]"
      >
        {visible.length === 0 ? (
          <p className="text-[13px] text-muted py-1.5">
            No {noun}s match “{query}”.
          </p>
        ) : (
          visible.map((option) => {
            const active = selected.has(option.value)
            const tone = !active
              ? `${CHIP_IDLE}${dimUnselected ? ' opacity-50' : ''}`
              : isInclude
                ? CHIP_INCLUDED
                : CHIP_EXCLUDED
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggle(option.value)}
                aria-pressed={active}
                title={
                  isInclude
                    ? active
                      ? 'Click to drop from the view'
                      : 'Click to show only this'
                    : active
                      ? 'Click to include again'
                      : 'Click to exclude'
                }
                className={`${CHIP_BASE} ${tone}`}
              >
                {option.label}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
