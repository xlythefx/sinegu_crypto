import { AlertTriangle, Hand, LogIn, LogOut, Radio } from 'lucide-react'
import {
  ActiveFilters,
  DateRangeFilter,
  FilterGroup,
  FilterPanel,
  FilterSelect,
  SearchField,
  Segmented,
  type ActiveFilterItem,
  type SegmentedOption,
} from '../../ui/filters'
import { EXCHANGE_META } from '../../exchanges/meta'
import { dateRangeLabel } from '../../../lib/dateRange'
import type { TradeLogFilterState } from '../../../hooks/useTradeLogFilters'
import type { ExchangeKind } from '../../../types/exchanges'
import type { ReasonCount } from '../../../types/tradeLogs'

const KNOWN_EXCHANGES: ExchangeKind[] = ['binance', 'mexc', 'bybit']

/** One full-width line of the panel. */
const ROW = 'flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-3.5'

const SIDES: SegmentedOption[] = [
  { value: 'all', label: 'All' },
  { value: 'long', label: 'Long', tone: 'green' },
  { value: 'short', label: 'Short', tone: 'red' },
]

const TYPES: SegmentedOption[] = [
  { value: 'all', label: 'All' },
  { value: 'entry', label: 'Entries', icon: LogIn },
  { value: 'exit', label: 'Exits', icon: LogOut },
]

const SOURCES: SegmentedOption[] = [
  { value: 'all', label: 'All' },
  { value: 'signals', label: 'Bot signals', icon: Radio },
  { value: 'outside', label: 'Closed outside the bot', icon: Hand, tone: 'accent' },
]

const OUTCOMES: SegmentedOption[] = [
  { value: 'all', label: 'All' },
  { value: 'filled', label: 'Filled', tone: 'green' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'failed', label: 'Failed', tone: 'red' },
  { value: 'problem', label: 'Problems only', tone: 'red', icon: AlertTriangle },
]

const exchangeLabel = (kind: string) =>
  kind in EXCHANGE_META ? EXCHANGE_META[kind as ExchangeKind].label : kind

/** Reason keys in the API are snake_case; this is only a fallback label. */
function humanizeKey(key: string): string {
  const s = key.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * The Signal Log's filters, on the shared filter kit (components/ui/filters —
 * see FilterPanel for the convention): scope first (exchange, side, entry or
 * exit, what to show), then narrowing (coin, account outcome, reason, account
 * search), then dates; every value lives in the URL, and whatever is active
 * shows as removable chips under the panel.
 *
 * The Issues view gets only the SIGNAL filters — issues are grouped across
 * every account, so the account filters would have nothing to narrow.
 *
 * Lives OUTSIDE the re-keyed list region, so typing never remounts an input.
 */
export default function TradeLogToolbar({
  view,
  filters: f,
  tickers,
  exchanges,
  reasons,
  summary,
}: {
  view: 'signals' | 'issues'
  filters: TradeLogFilterState
  tickers: string[]
  exchanges: string[]
  reasons: ReasonCount[]
  /** "Showing 42 of 464" — the panel's header line. */
  summary?: string
}) {
  const signals = view === 'signals'
  // Closes made outside the bot carry no account outcome or reason, so those
  // two facets only apply when bot signals are in view.
  const accountFacets = signals && f.source !== 'outside'

  const venues = Array.from(new Set([...KNOWN_EXCHANGES, ...exchanges]))
  const exchangeOptions: SegmentedOption[] = [
    { value: 'all', label: 'All' },
    ...venues.map((v) => ({ value: v, label: exchangeLabel(v) })),
  ]
  const coinOptions = [
    { value: 'all', label: 'All coins' },
    ...tickers.map((t) => ({ value: t, label: t })),
  ]
  const reasonOptions = [
    { value: 'all', label: 'All reasons' },
    ...reasons.map((r) => ({
      value: r.key,
      label: r.label || humanizeKey(r.key),
      count: r.count,
      group: r.severity === 'problem' ? 'Problems' : 'Normal',
    })),
  ]

  const label = (options: SegmentedOption[], value: string) =>
    options.find((o) => o.value === value)?.label ?? value

  // Chips for what is active — one per facet; the date pair is ONE chip.
  const chips: ActiveFilterItem[] = []
  if (f.exchange !== 'all') {
    chips.push({ key: 'exchange', label: exchangeLabel(f.exchange), onRemove: () => f.reset('exchange') })
  }
  if (f.side !== 'all') chips.push({ key: 'side', label: label(SIDES, f.side), onRemove: () => f.reset('side') })
  if (f.type !== 'all') chips.push({ key: 'type', label: label(TYPES, f.type), onRemove: () => f.reset('type') })
  if (signals && f.source !== 'all') {
    chips.push({ key: 'source', label: label(SOURCES, f.source), onRemove: () => f.reset('source') })
  }
  if (f.ticker !== 'all') chips.push({ key: 'ticker', label: f.ticker, onRemove: () => f.reset('ticker') })
  if (accountFacets && f.outcome !== 'all') {
    chips.push({ key: 'outcome', label: `Accounts: ${label(OUTCOMES, f.outcome)}`, onRemove: () => f.reset('outcome') })
  }
  if (accountFacets && f.reason !== 'all') {
    const r = reasons.find((x) => x.key === f.reason)
    chips.push({ key: 'reason', label: r?.label ?? humanizeKey(f.reason), onRemove: () => f.reset('reason') })
  }
  if (signals && f.account !== '') {
    chips.push({ key: 'account', label: `“${f.account}”`, onRemove: () => f.reset('account') })
  }
  if (f.datePreset !== 'all') {
    chips.push({
      key: 'date',
      label: dateRangeLabel(f.datePreset, f.from, f.to),
      onRemove: () => f.setMany({ date: 'all', from: '', to: '' }),
    })
  }

  return (
    <div className="mb-stack flex flex-col gap-3">
      <FilterPanel activeCount={chips.length} onClearAll={f.clear} summary={summary}>
        {/* Each row is a full line of the panel (the panel lays children out
            in a wrapping row): scope, then narrowing, then outcome + dates. */}
        <div className={ROW}>
          <FilterGroup label="Exchange">
            <Segmented
              value={f.exchange}
              onChange={(v) => f.set('exchange', v)}
              options={exchangeOptions}
              ariaLabel="Exchange"
              size="sm"
            />
          </FilterGroup>
          <FilterGroup label="Side">
            <Segmented value={f.side} onChange={(v) => f.set('side', v)} options={SIDES} ariaLabel="Side" size="sm" />
          </FilterGroup>
          <FilterGroup label="Type">
            <Segmented value={f.type} onChange={(v) => f.set('type', v)} options={TYPES} ariaLabel="Entry or exit" size="sm" />
          </FilterGroup>
          {signals && (
            <FilterGroup label="Show">
              <Segmented
                value={f.source}
                onChange={(v) => f.set('source', v)}
                options={SOURCES}
                ariaLabel="What to show"
                size="sm"
              />
            </FilterGroup>
          )}
        </div>

        <div className={`${ROW} border-t border-hair pt-4`}>
          <FilterGroup label="Coin">
            <FilterSelect
              value={f.ticker}
              onChange={(v) => f.set('ticker', v)}
              options={coinOptions}
              ariaLabel="Coin"
              className="min-w-[150px]"
            />
          </FilterGroup>
          {accountFacets && (
            <FilterGroup label="Reason">
              <FilterSelect
                value={f.reason}
                onChange={(v) => f.set('reason', v)}
                options={reasonOptions}
                ariaLabel="Reason"
                className="min-w-[200px]"
              />
            </FilterGroup>
          )}
          {signals && (
            <FilterGroup label="Account" className="w-full sm:w-auto">
              <SearchField
                value={f.account}
                onChange={(v) => f.set('account', v)}
                placeholder="Account or customer name…"
                ariaLabel="Search by account or customer"
                className="w-full sm:w-[280px]"
              />
            </FilterGroup>
          )}
        </div>

        <div className={`${ROW} border-t border-hair pt-4`}>
          {accountFacets && (
            <FilterGroup label="Accounts">
              <Segmented
                value={f.outcome}
                onChange={(v) => f.set('outcome', v)}
                options={OUTCOMES}
                ariaLabel="Account outcome"
                size="sm"
              />
            </FilterGroup>
          )}
          <FilterGroup label="Dates">
            <DateRangeFilter
              preset={f.datePreset}
              from={f.from}
              to={f.to}
              onChange={(next) => f.setMany({ date: next.preset, from: next.from, to: next.to })}
            />
          </FilterGroup>
        </div>
      </FilterPanel>

      <ActiveFilters items={chips} onClearAll={f.clear} />
    </div>
  )
}
