/** Pure admin-positions row building — no React. Turns the raw
 *  `/admin/positions` payload into the rows the table renders, in either of
 *  the two views the admin can switch between:
 *
 *  - `grouped` — same account + ticker merged into ONE row with a count pill
 *    (the overview: how much of a symbol an account is carrying).
 *  - `rows`    — every DB row on its own line, carrying its own id, side and
 *    quantity, so a single position/trade can be found and deleted.
 *
 *  Both views come out of here as the SAME `PositionRow` shape, so the table
 *  renders one body and the view only decides how many ids each line owns. */

import type { AdminOpenPosition, AdminPastTrade } from '../types/admin'
import type { FeeSource } from '../types/dashboard'
import { displaySymbol } from './chart'

export type PositionView = 'grouped' | 'rows'

/** A merged line's fee source: the one value its rows share, or `mixed`. */
export type RowFeeSource = FeeSource | 'mixed'

/** Every filter the toolbar owns. `all` means "no filter on this facet". */
export interface PositionFilters {
  search: string
  /** `binance_accounts.id` as a string, or `all`. */
  account: string
  ticker: string
  broker: string
}

export const EMPTY_FILTERS: PositionFilters = {
  search: '',
  account: 'all',
  ticker: 'all',
  broker: 'all',
}

export function hasActiveFilters(f: PositionFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.account !== 'all' ||
    f.ticker !== 'all' ||
    f.broker !== 'all'
  )
}

/** One account as offered by the "per user" filter. */
export interface AccountOption {
  id: number
  name: string
}

/** One rendered table line — a merged group or a single DB row. */
export interface PositionRow {
  key: string
  /** Every DB id this line stands for; delete acts on all of them. */
  ids: number[]
  count: number
  /** The DB id, set only in the per-row view (null when merged). */
  rowId: number | null
  accountId: number | null
  accountName: string | null
  accountBalance: number
  symbol: string
  price: number
  pnl: number
  /** Closed trades only: exchange fee already out of `pnl` (summed on a
   *  merged line; null when no row carries one). Open positions: null. */
  fee: number | null
  /** Closed trades only; `mixed` when a merged line's rows disagree. */
  feeSource: RowFeeSource
  /** LONG / SHORT / BUY / SELL — per-row only; a merge can span both. */
  side: string | null
  /** Position size — per-row only, for the same reason. */
  qty: number | null
  strategy: string | null
  /** Closed trades only. */
  closedAt: string | null
  broker: string
}

type AnyRow = AdminOpenPosition | AdminPastTrade

function strategyOf(r: AnyRow): string {
  return 'strategy' in r ? (r.strategy ?? '') : ''
}

/** Every field a search term may match, lowercased once per row. */
function haystack(r: AnyRow): string {
  return [
    r.id,
    r.account_id ?? '',
    r.account_name ?? '',
    r.symbol,
    displaySymbol(r.symbol),
    r.broker,
    strategyOf(r),
  ]
    .join(' ')
    .toLowerCase()
}

/** Facets are AND-ed, and every whitespace-separated search term must match —
 *  so "master ltc" narrows to that account's LTC rows. */
export function matchesFilters(r: AnyRow, f: PositionFilters): boolean {
  if (f.account !== 'all' && String(r.account_id ?? '') !== f.account) return false
  if (f.ticker !== 'all' && r.symbol !== f.ticker) return false
  if (f.broker !== 'all' && r.broker !== f.broker) return false
  const q = f.search.trim().toLowerCase()
  if (!q) return true
  const hay = haystack(r)
  return q.split(/\s+/).every((term) => hay.includes(term))
}

/** Accounts present in the payload, for the "per user" select. */
export function accountOptions(
  positions: AdminOpenPosition[],
  trades: AdminPastTrade[],
): AccountOption[] {
  const byId = new Map<number, string>()
  for (const r of [...positions, ...trades]) {
    if (r.account_id != null && !byId.has(r.account_id)) {
      byId.set(r.account_id, r.account_name ?? `Account ${r.account_id}`)
    }
  }
  return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

function byAccountThenSymbol(a: PositionRow, b: PositionRow): number {
  return (
    (a.accountName ?? '').localeCompare(b.accountName ?? '') ||
    a.symbol.localeCompare(b.symbol) ||
    (a.rowId ?? 0) - (b.rowId ?? 0)
  )
}

/** Open positions → table rows. */
export function buildPositionRows(
  rows: AdminOpenPosition[],
  view: PositionView,
): PositionRow[] {
  if (view === 'rows') {
    return rows
      .map((p) => ({
        key: `p${p.id}`,
        ids: [p.id],
        count: 1,
        rowId: p.id,
        accountId: p.account_id,
        accountName: p.account_name,
        accountBalance: p.account_balance,
        symbol: p.symbol,
        price: p.price,
        pnl: p.unrealized_pnl,
        fee: null,
        feeSource: null,
        side: p.position_side || null,
        qty: p.position_amt,
        strategy: null,
        closedAt: null,
        broker: p.broker,
      }))
      .sort(byAccountThenSymbol)
  }

  const map = new Map<string, PositionRow & { priceSum: number }>()
  for (const p of rows) {
    const key = `${p.account_id}|${p.symbol}`
    const g = map.get(key)
    if (g) {
      g.ids.push(p.id)
      g.count += 1
      g.pnl += p.unrealized_pnl
      g.priceSum += p.price
      g.qty = (g.qty ?? 0) + p.position_amt
    } else {
      map.set(key, {
        key,
        ids: [p.id],
        count: 1,
        rowId: null,
        accountId: p.account_id,
        accountName: p.account_name,
        accountBalance: p.account_balance,
        symbol: p.symbol,
        price: 0,
        priceSum: p.price,
        pnl: p.unrealized_pnl,
        fee: null,
        feeSource: null,
        side: null,
        qty: p.position_amt,
        strategy: null,
        closedAt: null,
        broker: p.broker,
      })
    }
  }
  return Array.from(map.values())
    .map(({ priceSum, ...g }) => ({ ...g, price: priceSum / g.count }))
    .sort(byAccountThenSymbol)
}

/** Sum of the fees a merged line's rows carry; null when none does. */
function sumFees(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return a + b
}

function mergeFeeSource(a: RowFeeSource, b: FeeSource): RowFeeSource {
  return a === b ? a : 'mixed'
}

/** Closed trades → table rows, newest close first. */
export function buildTradeRows(
  rows: AdminPastTrade[],
  view: PositionView,
): PositionRow[] {
  if (view === 'rows') {
    return rows
      .map((t) => ({
        key: `t${t.id}`,
        ids: [t.id],
        count: 1,
        rowId: t.id,
        accountId: t.account_id,
        accountName: t.account_name,
        accountBalance: t.account_balance,
        symbol: t.symbol,
        price: t.price,
        pnl: t.realized_pnl,
        fee: t.exchange_fee,
        feeSource: t.fee_source,
        side: t.side || null,
        qty: t.position_amt,
        strategy: t.strategy,
        closedAt: t.closed_at,
        broker: t.broker,
      }))
      .sort((a, b) => ((a.closedAt ?? '') < (b.closedAt ?? '') ? 1 : -1))
  }

  const map = new Map<
    string,
    PositionRow & { priceSum: number; strategies: Set<string> }
  >()
  for (const t of rows) {
    const key = `${t.account_id}|${t.symbol}`
    const g = map.get(key)
    if (g) {
      g.ids.push(t.id)
      g.count += 1
      g.pnl += t.realized_pnl
      g.fee = sumFees(g.fee, t.exchange_fee)
      g.feeSource = mergeFeeSource(g.feeSource, t.fee_source)
      g.priceSum += t.price
      g.qty = (g.qty ?? 0) + t.position_amt
      if (t.strategy) g.strategies.add(t.strategy)
      if (g.closedAt === null || t.closed_at > g.closedAt) g.closedAt = t.closed_at
    } else {
      map.set(key, {
        key,
        ids: [t.id],
        count: 1,
        rowId: null,
        accountId: t.account_id,
        accountName: t.account_name,
        accountBalance: t.account_balance,
        symbol: t.symbol,
        price: 0,
        priceSum: t.price,
        pnl: t.realized_pnl,
        fee: t.exchange_fee,
        feeSource: t.fee_source,
        side: null,
        qty: t.position_amt,
        strategy: null,
        closedAt: t.closed_at,
        broker: t.broker,
        strategies: new Set(t.strategy ? [t.strategy] : []),
      })
    }
  }
  return Array.from(map.values())
    .map(({ priceSum, strategies, ...g }) => ({
      ...g,
      price: priceSum / g.count,
      strategy:
        strategies.size === 0
          ? null
          : strategies.size === 1
            ? [...strategies][0]
            : 'Multiple',
    }))
    .sort((a, b) => ((a.closedAt ?? '') < (b.closedAt ?? '') ? 1 : -1))
}
