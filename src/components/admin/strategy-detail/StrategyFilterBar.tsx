import { ArrowDownRight, ArrowUpRight, Crown, FlaskConical, Gem, Users } from 'lucide-react'
import {
  ActiveFilters,
  DateRangeFilter,
  FilterGroup,
  FilterPanel,
  FilterSelect,
  Segmented,
  type ActiveFilterItem,
  type FilterSelectOption,
  type SegmentedOption,
} from '../../ui/filters'
import { EXCHANGE_META } from '../../exchanges/meta'
import { MONTH_DATE_PRESETS, dateRangeLabel } from '../../../lib/dateRange'
import { displaySymbol } from '../../../lib/chart'
import {
  coinOptions,
  exchangeCounts,
  ownerCounts,
  sideCounts,
  type OwnerFilter,
  type SideFilter,
} from '../../../lib/strategyFilters'
import type { StrategyTrade } from '../../../lib/strategyStats'
import type { StrategyFilterState } from '../../../hooks/useStrategyFilters'
import type { ExchangeKind } from '../../../types/exchanges'

/** One full-width line of the panel. */
const ROW = 'flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-3.5'

const COIN_BASE =
  'inline-flex min-h-8 items-center gap-1.5 rounded-pill border px-3 text-[12px] cursor-pointer transition-all duration-200 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-accent'
const COIN_ON = `${COIN_BASE} border-accent bg-accent text-on-accent font-bold shadow-[0_2px_10px_-4px_var(--accent)]`
const COIN_OFF = `${COIN_BASE} border-border bg-surface2 text-muted font-semibold hover:border-accent-line hover:text-text`
const COUNT = 'font-mono text-[10.5px] opacity-75'

const ROLE_GROUP: Record<string, string> = {
  master: 'Master',
  user: 'Customers',
  tester: 'Testers',
  submaster: 'Sub-master',
}

const exchangeLabel = (kind: string) =>
  kind in EXCHANGE_META ? EXCHANGE_META[kind as ExchangeKind].label : kind

/**
 * Every filter the strategy pages apply — coins (any number), exchange,
 * long / short, whose accounts, dates (presets or custom) — on the shared filter kit (see
 * FilterPanel for the convention). Lives OUTSIDE the re-keyed region so the
 * date inputs never lose focus; the cards below re-key on the filters.
 */
export default function StrategyFilterBar({
  trades,
  filters: f,
  summary,
}: {
  /** Every closed trade of the strategy, before any filter. */
  trades: StrategyTrade[]
  filters: StrategyFilterState
  summary: string
}) {
  const coins = coinOptions(trades, f)
  const venues = exchangeCounts(trades, f)
  const owners = ownerCounts(trades, f)
  const sides = sideCounts(trades, f)
  const hasSides = trades.some((t) => t.side === 'LONG' || t.side === 'SHORT')
  const sideOptions: SegmentedOption<SideFilter>[] = [
    { value: 'all', label: 'Both', count: sides.all, tone: 'neutral' },
    { value: 'long', label: 'Long', count: sides.long, tone: 'green', icon: ArrowUpRight },
    { value: 'short', label: 'Short', count: sides.short, tone: 'red', icon: ArrowDownRight },
  ]
  const hasTesters = trades.some((t) => t.owner_role === 'tester')
  const hasCustomers = trades.some((t) => t.owner_role === 'user')
  const hasSubmaster = trades.some((t) => t.owner_role === 'submaster')

  const exchangeOptions: SegmentedOption[] = [
    { value: 'all', label: 'All', tone: 'neutral' },
    ...[...venues.entries()].map(([v, count]) => ({ value: v, label: exchangeLabel(v), count })),
  ]

  const groupOptions: SegmentedOption[] = [
    { value: 'all', label: 'All accounts', count: owners.all, tone: 'neutral' },
    { value: 'master', label: 'Master', count: owners.master, icon: Crown },
    ...(hasCustomers ? [{ value: 'customers', label: 'Customers', count: owners.customers, icon: Users }] : []),
    ...(hasTesters ? [{ value: 'testers', label: 'Testers', count: owners.testers, icon: FlaskConical }] : []),
    ...(hasSubmaster ? [{ value: 'submaster', label: 'Sub-master', count: owners.submaster, icon: Gem }] : []),
  ]
  const person = f.owner.startsWith('u:') ? f.owner : 'any'
  const personOptions: FilterSelectOption[] = [
    { value: 'any', label: 'One account…' },
    ...owners.people.map((p) => ({
      value: p.value,
      label: p.label,
      count: p.count,
      group: ROLE_GROUP[p.role ?? ''] ?? 'Other',
    })),
  ]
  const personName = owners.people.find((p) => p.value === f.owner)?.label

  const chips: ActiveFilterItem[] = []
  for (const c of f.coins) {
    chips.push({ key: `coin-${c}`, label: displaySymbol(c), onRemove: () => f.resetCoin(c) })
  }
  if (f.exchange !== 'all') {
    chips.push({ key: 'exchange', label: exchangeLabel(f.exchange), onRemove: f.resetExchange })
  }
  if (f.side !== 'all') {
    chips.push({ key: 'side', label: f.side === 'long' ? 'Longs only' : 'Shorts only', onRemove: f.resetSide })
  }
  if (f.owner !== 'all') {
    const label =
      personName ?? groupOptions.find((o) => o.value === f.owner)?.label ?? 'One account'
    chips.push({ key: 'owner', label: f.owner.startsWith('u:') ? label : `${label} only`, onRemove: f.resetOwner })
  }
  if (f.date !== 'all') {
    chips.push({ key: 'date', label: dateRangeLabel(f.date, f.from, f.to), onRemove: f.resetDate })
  }

  return (
    <div className="mb-4 flex flex-col gap-3" data-aos="fade-up">
      <FilterPanel activeCount={chips.length} onClearAll={f.clear} summary={summary}>
        <div className={ROW}>
          <FilterGroup label="Coins">
            <button
              type="button"
              aria-pressed={f.coins.length === 0}
              className={f.coins.length === 0 ? COIN_ON : COIN_OFF}
              onClick={() => f.setCoins([])}
            >
              All coins
            </button>
            {coins.map((c) => {
              const on = f.coins.includes(c.key)
              return (
                <button
                  type="button"
                  key={c.key}
                  aria-pressed={on}
                  className={`${on ? COIN_ON : COIN_OFF}${!on && c.count === 0 ? ' opacity-50' : ''}`}
                  onClick={() => f.toggleCoin(c.key)}
                  title={on ? `Remove ${c.label}` : `Add ${c.label}`}
                >
                  <span
                    className="h-[9px] w-[9px] flex-none rounded-[3px] transition-transform duration-200"
                    style={{ background: on ? 'currentColor' : c.color }}
                  />
                  {c.label}
                  <span className={COUNT}>{c.count.toLocaleString()}</span>
                </button>
              )
            })}
          </FilterGroup>
        </div>

        <div className={ROW}>
          {venues.size > 1 && (
            <FilterGroup label="Exchange">
              <Segmented
                size="sm"
                value={f.exchange}
                onChange={f.setExchange}
                options={exchangeOptions}
                ariaLabel="Exchange"
              />
            </FilterGroup>
          )}
          {hasSides && (
            <FilterGroup label="Side">
              <Segmented<SideFilter>
                size="sm"
                value={f.side}
                onChange={f.setSide}
                options={sideOptions}
                ariaLabel="Long or short"
              />
            </FilterGroup>
          )}
          <FilterGroup label="Accounts">
            <Segmented
              size="sm"
              value={f.owner.startsWith('u:') ? '' : f.owner}
              onChange={(v) => f.setOwner(v as OwnerFilter)}
              options={groupOptions}
              ariaLabel="Whose trades"
            />
            {owners.people.length > 1 && (
              <FilterSelect
                value={person}
                onChange={(v) => f.setOwner(v === 'any' ? 'all' : (v as OwnerFilter))}
                options={personOptions}
                ariaLabel="One account"
              />
            )}
          </FilterGroup>
        </div>

        <div className={ROW}>
          <FilterGroup label="Dates">
            <DateRangeFilter
              preset={f.date}
              from={f.from}
              to={f.to}
              onChange={f.setDate}
              presets={MONTH_DATE_PRESETS}
            />
          </FilterGroup>
        </div>
      </FilterPanel>

      {chips.length > 0 && <ActiveFilters items={chips} onClearAll={f.clear} />}
    </div>
  )
}
