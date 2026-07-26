import { SlidersHorizontal, X } from 'lucide-react'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../exchanges/meta'

export interface AnalyticsFilters {
  exchange: string
  from: string
  to: string
}

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters
  onExchange: (exchange: string) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onClearDates: () => void
}

const DATE_INPUT =
  'h-[42px] border border-border rounded-nav bg-surface2 text-text px-3 font-mono text-[13px] [color-scheme:dark] [[data-theme=light]_&]:[color-scheme:light]'

const CHIP_BASE =
  'inline-flex items-center gap-2 text-[12px] font-bold py-[7px] px-3 rounded-pill border font-body'

/** Top-of-page filter bar for the Performance Analytics page: exchange chips
 *  (Bybit / MEXC locked "Coming soon") plus a From / To date range. */
export default function AnalyticsFilterBar({
  filters,
  onExchange,
  onFrom,
  onTo,
  onClearDates,
}: AnalyticsFilterBarProps) {
  const hasDates = filters.from !== '' || filters.to !== ''

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <SlidersHorizontal size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">Filters</div>
          <div className="text-[12px] text-muted mt-px">
            Refine analytics by exchange and date range
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        {/* Exchange chips */}
        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
            Exchange
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${CHIP_BASE} cursor-pointer ${
                filters.exchange === 'all'
                  ? 'bg-accent border-accent text-on-accent'
                  : 'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'
              }`}
              onClick={() => onExchange('all')}
            >
              All
            </button>
            {EXCHANGE_ORDER.map((key) => {
              const meta = EXCHANGE_META[key]
              const active = filters.exchange === key
              if (!meta.available) {
                return (
                  <span
                    key={key}
                    className={`${CHIP_BASE} border-hair bg-surface2 text-faint opacity-60 cursor-not-allowed`}
                    title="Coming soon"
                  >
                    <i
                      className="w-2 h-2 rounded-full"
                      style={{ background: meta.color }}
                    />
                    {meta.label}
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-muted">
                      Soon
                    </span>
                  </span>
                )
              }
              return (
                <button
                  key={key}
                  type="button"
                  className={`${CHIP_BASE} cursor-pointer ${
                    active
                      ? 'bg-accent border-accent text-on-accent'
                      : 'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'
                  }`}
                  onClick={() => onExchange(key)}
                >
                  <i
                    className="w-2 h-2 rounded-full"
                    style={{ background: meta.color }}
                  />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Date range */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
              From
            </span>
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => onFrom(e.target.value)}
              className={`${DATE_INPUT} min-w-[150px]`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
              To
            </span>
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => onTo(e.target.value)}
              className={`${DATE_INPUT} min-w-[150px]`}
            />
          </label>
          <button
            type="button"
            onClick={onClearDates}
            disabled={!hasDates}
            className="h-[42px] px-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-muted border border-border rounded-nav cursor-pointer hover:text-text hover:border-accent-line disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:border-border"
          >
            <X size={13} />
            Clear
          </button>
        </div>
      </div>
    </section>
  )
}
