import { useState } from 'react'
import { CalendarRange, Layers, SlidersHorizontal, X } from 'lucide-react'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../exchanges/meta'
import ChipFilterPanel, { type ChipOption } from './ChipFilterPanel'
import { fmtMediumDate } from '../../lib/format'
import type { ChipMode } from '../../types/analytics'

export interface AnalyticsFilters {
  exchange: string
  from: string
  to: string
}

type Tab = 'scope' | 'tickers' | 'strategies'

interface AnalyticsFilterPanelProps {
  filters: AnalyticsFilters
  onExchange: (exchange: string) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onClearDates: () => void

  symbolOptions: ChipOption[]
  symbols: Set<string>
  symbolMode: ChipMode
  onSymbolToggle: (value: string) => void
  onSymbolMode: (mode: ChipMode) => void
  onSymbolsClear: () => void

  strategyOptions: ChipOption[]
  strategies: Set<string>
  strategyMode: ChipMode
  onStrategyToggle: (value: string) => void
  onStrategyMode: (mode: ChipMode) => void
  onStrategiesClear: () => void

  onClearAll: () => void
}

const DATE_INPUT =
  'h-[42px] border border-border rounded-nav bg-surface2 text-text px-3 font-mono text-[13px] [color-scheme:dark] [[data-theme=light]_&]:[color-scheme:light]'

const CHIP_BASE =
  'inline-flex items-center gap-2 text-[12px] font-bold py-[7px] px-3 rounded-pill border font-body'

const TAB_BASE =
  'inline-flex items-center justify-center gap-2 text-center py-[9px] px-2 rounded-btn text-[12.5px] cursor-pointer transition-colors'
const TAB_ON = 'bg-surface border border-border font-bold text-text'
const TAB_OFF =
  'font-semibold text-muted border border-transparent bg-transparent hover:text-text'

const BADGE =
  'inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-pill font-mono text-[10px] font-bold'

/** A dismissible summary of one active filter, shown whatever tab is open. */
function SummaryPill({
  label,
  tone,
  onClear,
}: {
  label: string
  tone: 'accent' | 'green' | 'red'
  onClear: () => void
}) {
  const tint = {
    accent: 'text-accent border-accent-line bg-accent-soft',
    green:
      'text-green border-[color-mix(in_srgb,var(--green)_38%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)]',
    red: 'text-red border-[color-mix(in_srgb,var(--red)_38%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)]',
  }[tone]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-bold ${tint}`}
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label}`}
        className="cursor-pointer opacity-70 hover:opacity-100"
      >
        <X size={11} />
      </button>
    </span>
  )
}

/**
 * Every analytics filter in one card: exchange + date range, tickers and
 * strategies as three subtabs.
 *
 * Only one set of controls is on screen at a time, but the header keeps a
 * dismissible pill for each active filter — so collapsing them into tabs
 * never hides the fact that a metric is being narrowed.
 */
export default function AnalyticsFilterPanel({
  filters,
  onExchange,
  onFrom,
  onTo,
  onClearDates,
  symbolOptions,
  symbols,
  symbolMode,
  onSymbolToggle,
  onSymbolMode,
  onSymbolsClear,
  strategyOptions,
  strategies,
  strategyMode,
  onStrategyToggle,
  onStrategyMode,
  onStrategiesClear,
  onClearAll,
}: AnalyticsFilterPanelProps) {
  const [tab, setTab] = useState<Tab>('scope')

  const hasDates = filters.from !== '' || filters.to !== ''
  const dateLabel = !hasDates
    ? ''
    : filters.from && filters.to
      ? `${fmtMediumDate(filters.from)} → ${fmtMediumDate(filters.to)}`
      : filters.from
        ? `From ${fmtMediumDate(filters.from)}`
        : `Until ${fmtMediumDate(filters.to)}`

  // EXCHANGE_META is keyed by ExchangeKind, so narrow before indexing it.
  const activeExchange = EXCHANGE_ORDER.find((key) => key === filters.exchange)
  const exchangeLabel = activeExchange
    ? EXCHANGE_META[activeExchange].label
    : filters.exchange

  const anyActive =
    filters.exchange !== 'all' || hasDates || symbols.size > 0 || strategies.size > 0

  const TABS: { id: Tab; label: string; short: string; count: number }[] = [
    { id: 'scope', label: 'Exchange & dates', short: 'Exchange', count: 0 },
    { id: 'tickers', label: 'Tickers', short: 'Tickers', count: symbols.size },
    {
      id: 'strategies',
      label: 'Strategies',
      short: 'Strategies',
      count: strategies.size,
    },
  ]

  const badgeTone = (mode: ChipMode) =>
    mode === 'include'
      ? 'text-green bg-[color-mix(in_srgb,var(--green)_18%,transparent)]'
      : 'text-red bg-[color-mix(in_srgb,var(--red)_18%,transparent)]'

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <SlidersHorizontal size={16} />
          </span>
          <div className="min-w-0">
            <div className="font-display text-[15px] font-extrabold">Filters</div>
            <div className="text-[12px] text-muted mt-px">
              Narrow every metric below by exchange, date, ticker or strategy
            </div>
          </div>
        </div>

        {anyActive && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.exchange !== 'all' && (
              <SummaryPill
                label={exchangeLabel}
                tone="accent"
                onClear={() => onExchange('all')}
              />
            )}
            {hasDates && (
              <SummaryPill label={dateLabel} tone="accent" onClear={onClearDates} />
            )}
            {symbols.size > 0 && (
              <SummaryPill
                label={`${symbols.size} ticker${symbols.size > 1 ? 's' : ''} ${symbolMode}d`}
                tone={symbolMode === 'include' ? 'green' : 'red'}
                onClear={onSymbolsClear}
              />
            )}
            {strategies.size > 0 && (
              <SummaryPill
                label={`${strategies.size} strateg${strategies.size > 1 ? 'ies' : 'y'} ${strategyMode}d`}
                tone={strategyMode === 'include' ? 'green' : 'red'}
                onClear={onStrategiesClear}
              />
            )}
            <button
              type="button"
              onClick={onClearAll}
              className="text-[11.5px] font-bold text-muted underline underline-offset-2 cursor-pointer hover:text-text"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 bg-surface2 border border-hair rounded-xl p-[5px] mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`${TAB_BASE} ${tab === t.id ? TAB_ON : TAB_OFF}`}
          >
            <span className="max-[620px]:hidden truncate">{t.label}</span>
            <span className="hidden max-[620px]:inline truncate">{t.short}</span>
            {t.count > 0 && (
              <span
                className={`${BADGE} ${badgeTone(t.id === 'tickers' ? symbolMode : strategyMode)}`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div>
        {tab === 'scope' && (
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                <Layers size={12} /> Exchange
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
                        filters.exchange === key
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

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                  <CalendarRange size={12} /> From
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
        )}

        {tab === 'tickers' && (
          <ChipFilterPanel
            available={symbolOptions}
            selected={symbols}
            mode={symbolMode}
            onToggle={onSymbolToggle}
            onModeChange={onSymbolMode}
            onClear={onSymbolsClear}
            noun="ticker"
          />
        )}

        {tab === 'strategies' && (
          <ChipFilterPanel
            available={strategyOptions}
            selected={strategies}
            mode={strategyMode}
            onToggle={onStrategyToggle}
            onModeChange={onStrategyMode}
            onClear={onStrategiesClear}
            noun="strategy"
            searchThreshold={8}
          />
        )}
      </div>
    </section>
  )
}
