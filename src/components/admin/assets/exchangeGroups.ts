import { EXCHANGE_META, EXCHANGE_ORDER, exchangeFromBroker } from '../../exchanges/meta'
import type { ExchangeKind } from '../../../types/exchanges'

/**
 * Pure helpers (no React) that split Admin → Trading Assets by exchange.
 * The same coin is a separate asset row per venue (LTCUSDT on Binance and
 * LTCUSDT on MEXC), so every list on that page is grouped by this.
 */

/** `?exchange=` on the page: every venue, or one. */
export type ExchangeFilter = 'all' | ExchangeKind

export function parseExchangeFilter(raw: string | null): ExchangeFilter {
  const kind = exchangeFromBroker(raw)
  return kind ?? 'all'
}

/** Assets per exchange, every venue present (0 when it has none). */
export function countByExchange<T extends { broker: string | null }>(
  assets: readonly T[],
): Record<ExchangeKind, number> {
  const counts = Object.fromEntries(EXCHANGE_ORDER.map((k) => [k, 0])) as Record<
    ExchangeKind,
    number
  >
  for (const a of assets) {
    const kind = exchangeFromBroker(a.broker)
    if (kind) counts[kind] += 1
  }
  return counts
}

export interface ExchangeGroup<T> {
  /** null = rows whose broker names no supported exchange (the bot never trades them). */
  exchange: ExchangeKind | null
  assets: T[]
}

/**
 * The sections to render, in `EXCHANGE_ORDER`. Under 'all' every venue gets a
 * section, empty or not, plus a trailing "no exchange" one only when some row
 * has no supported broker; under one exchange, only that section. Input
 * order is kept inside a section, so a caller's sort survives the split.
 */
export function groupByExchange<T extends { broker: string | null }>(
  assets: readonly T[],
  filter: ExchangeFilter,
): ExchangeGroup<T>[] {
  const venues = filter === 'all' ? EXCHANGE_ORDER : [filter]
  const groups: ExchangeGroup<T>[] = venues.map((exchange) => ({ exchange, assets: [] }))
  const unlinked: T[] = []
  for (const a of assets) {
    const kind = exchangeFromBroker(a.broker)
    const group = kind ? groups.find((g) => g.exchange === kind) : undefined
    if (group) group.assets.push(a)
    else if (!kind && filter === 'all') unlinked.push(a)
  }
  if (unlinked.length > 0) groups.push({ exchange: null, assets: unlinked })
  return groups
}

/** The section heading: the exchange's label, or what an unlinked row is. */
export function groupLabel(exchange: ExchangeKind | null): string {
  return exchange ? EXCHANGE_META[exchange].label : 'No exchange set'
}

/** "1 coin" / "3 coins". */
export function coinCount(n: number): string {
  return `${n} ${n === 1 ? 'coin' : 'coins'}`
}

/**
 * The muted line under a venue the engine is not trading, or null when it
 * is — or when nobody knows (`traded` null = the engine did not answer,
 * which must never read as "trades nothing").
 */
export function notTradingNote(
  exchange: ExchangeKind | null,
  traded: ReadonlySet<ExchangeKind> | null,
  tail: string,
): string | null {
  if (!exchange || !traded || traded.has(exchange)) return null
  return `${EXCHANGE_META[exchange].label} isn’t trading yet — ${tail}`
}
