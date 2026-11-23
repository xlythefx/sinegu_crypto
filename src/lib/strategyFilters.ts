/**
 * The strategy page's filter bar (`/admin/strategies/:key`) — which of the
 * strategy's closed trades the WHOLE page measures. Pure, no React.
 *
 * Every card on the page is computed from the trades this returns, so a
 * filter narrows the metric cards, the equity curve, the heatmap and the
 * table alike — never one card and not the others.
 *
 * - Coins are keyed by their letters and digits only, so Binance's `LTCUSDT`
 *   and MEXC's `LTC_USDT` are one coin (same rule as the landing page's
 *   track-record filter).
 * - Dates are the READER's calendar days (`lib/dateRange`), the convention of
 *   every admin filter bar.
 * - Option counts are taken under the OTHER filters, so "SANTOS (12)" is what
 *   picking SANTOS will show with the exchange / accounts / dates already set.
 */
import { coinKey, displaySymbol, seriesColor } from './chart'
import { localIsoDate } from './capture'
import { parseUtc } from './format'
import { rangeFor, type DatePreset } from './dateRange'
import type { StrategyTrade } from './strategyStats'

/** Whose trades: everyone, a role group, or one account owner (`u:<uni_id>`). */
export type OwnerFilter = 'all' | 'master' | 'customers' | 'testers' | `u:${string}`

export interface StrategyFilters {
  /** Coin keys (see `coinKey`); empty = every coin. */
  coins: string[]
  /** 'all' or an exchange kind (binance | mexc | bybit). */
  exchange: string
  owner: OwnerFilter
  date: DatePreset
  /** Only for date = 'custom'. */
  from: string
  to: string
}

type Facet = 'coins' | 'exchange' | 'owner' | 'date'

export { coinKey }

/** The calendar day (reader's zone) a trade closed on, '' when unreadable. */
export function closedDay(t: StrategyTrade): string {
  const d = parseUtc(t.closed_at)
  return d ? localIsoDate(d) : ''
}

export function ownerMatches(t: StrategyTrade, owner: OwnerFilter): boolean {
  switch (owner) {
    case 'all':
      return true
    case 'master':
      return t.owner_role === 'master'
    case 'customers':
      return t.owner_role === 'user'
    case 'testers':
      return t.owner_role === 'tester'
    default:
      return t.uni_id === owner.slice(2)
  }
}

/** The trades the page measures; `skip` leaves one facet out (for counts). */
export function filterStrategyTrades(
  trades: StrategyTrade[],
  f: StrategyFilters,
  skip?: Facet,
  now: Date = new Date(),
): StrategyTrade[] {
  const coins = skip === 'coins' ? null : f.coins.length ? new Set(f.coins) : null
  const range = skip === 'date' ? { from: '', to: '' } : rangeFor(f.date, { from: f.from, to: f.to }, now)
  return trades.filter((t) => {
    if (coins && !coins.has(coinKey(t.symbol))) return false
    if (skip !== 'exchange' && f.exchange !== 'all' && (t.exchange ?? 'binance') !== f.exchange) return false
    if (skip !== 'owner' && !ownerMatches(t, f.owner)) return false
    if (range.from || range.to) {
      const day = closedDay(t)
      if (!day) return false
      if (range.from && day < range.from) return false
      if (range.to && day > range.to) return false
    }
    return true
  })
}

export interface CoinOption {
  key: string
  label: string
  color: string
  /** Trades under the other filters. */
  count: number
}

/**
 * One chip per coin the strategy ever traded (most traded first), counted
 * under the other filters. A coin with 0 there still shows, so a picked coin
 * never vanishes from the bar.
 */
export function coinOptions(all: StrategyTrade[], f: StrategyFilters, now?: Date): CoinOption[] {
  const total = new Map<string, number>()
  for (const t of all) total.set(coinKey(t.symbol), (total.get(coinKey(t.symbol)) ?? 0) + 1)
  const scoped = new Map<string, number>()
  for (const t of filterStrategyTrades(all, f, 'coins', now)) {
    scoped.set(coinKey(t.symbol), (scoped.get(coinKey(t.symbol)) ?? 0) + 1)
  }
  return [...total.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key], i) => ({
      key,
      label: displaySymbol(key),
      color: seriesColor(key, i),
      count: scoped.get(key) ?? 0,
    }))
}

export interface CountedOption {
  value: string
  label: string
  count: number
}

/** The exchanges the strategy traded on, counted under the other filters. */
export function exchangeCounts(all: StrategyTrade[], f: StrategyFilters, now?: Date): Map<string, number> {
  const venues = new Map<string, number>()
  for (const t of all) venues.set(t.exchange ?? 'binance', 0)
  for (const t of filterStrategyTrades(all, f, 'exchange', now)) {
    const v = t.exchange ?? 'binance'
    venues.set(v, (venues.get(v) ?? 0) + 1)
  }
  return venues
}

export interface OwnerCounts {
  all: number
  master: number
  customers: number
  testers: number
  /** One entry per account owner, master first, then by name. */
  people: (CountedOption & { role: string | null })[]
}

/** The accounts facet: role groups plus every owner, counted under the other filters. */
export function ownerCounts(all: StrategyTrade[], f: StrategyFilters, now?: Date): OwnerCounts {
  const scoped = filterStrategyTrades(all, f, 'owner', now)
  const people = new Map<string, { label: string; role: string | null; count: number }>()
  for (const t of all) {
    if (!t.uni_id || people.has(t.uni_id)) continue
    people.set(t.uni_id, { label: t.owner_name || t.uni_id, role: t.owner_role ?? null, count: 0 })
  }
  for (const t of scoped) {
    const p = t.uni_id ? people.get(t.uni_id) : undefined
    if (p) p.count += 1
  }
  const rank = (role: string | null) => (role === 'master' ? 0 : role === 'user' ? 1 : 2)
  return {
    all: scoped.length,
    master: scoped.filter((t) => t.owner_role === 'master').length,
    customers: scoped.filter((t) => t.owner_role === 'user').length,
    testers: scoped.filter((t) => t.owner_role === 'tester').length,
    people: [...people.entries()]
      .map(([uni, p]) => ({ value: `u:${uni}`, label: p.label, role: p.role, count: p.count }))
      .sort((a, b) => rank(a.role) - rank(b.role) || a.label.localeCompare(b.label)),
  }
}
