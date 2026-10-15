import { useMemo, useState } from 'react'
import { useUrlFilters } from './useUrlFilters'
import { isDatePreset, rangeFor } from '../lib/dateRange'
import type { TradeLogFilters, TradeLogOutcome } from '../types/tradeLogs'

export type OutcomeFilter = TradeLogOutcome | 'all'

/** Every Signal Log filter and its "off" value — what an unfiltered URL means. */
const DEFAULTS = {
  exchange: 'all',
  feed: 'all',
  side: 'all',
  type: 'all',
  source: 'all',
  ticker: 'all',
  outcome: 'all',
  reason: 'all',
  account: '',
  date: 'all',
  from: '',
  to: '',
}

const ALLOWED = {
  feed: ['all', 'main', 'test'],
  side: ['all', 'long', 'short'],
  type: ['all', 'entry', 'exit'],
  source: ['all', 'signals', 'outside'],
  outcome: ['all', 'filled', 'skipped', 'failed', 'problem'],
  date: ['all', 'today', '24h', '7d', '30d', 'custom'],
}

/**
 * Filter state for Admin → Signal Log, kept in the URL (useUrlFilters) so a
 * reload or a shared link lands on the same view. Shared by its two views.
 *
 * Two kinds of filter, kept apart because the endpoints treat them apart:
 * - SIGNAL filters (exchange, feed, side, type, coin, dates) narrow which signals
 *   are read — both the list and the Issues view honour them;
 * - LIST-ONLY filters (source, account outcome, reason, account search) — the
 *   Issues view has its own grouping.
 *
 * The page number is DERIVED from the filters it was chosen under, so any
 * filter change lands back on page 1 with no reset effect.
 */
export function useTradeLogFilters() {
  const url = useUrlFilters(DEFAULTS, { allowed: ALLOWED })
  const f = url.filters
  const preset = isDatePreset(f.date) ? f.date : 'all'
  const range = useMemo(() => rangeFor(preset, { from: f.from, to: f.to }), [preset, f.from, f.to])

  const signalFilters = useMemo<TradeLogFilters>(
    () => ({
      exchange: f.exchange,
      feed: f.feed,
      side: f.side,
      type: f.type,
      ticker: f.ticker,
      from: range.from,
      to: range.to,
    }),
    [f.exchange, f.feed, f.side, f.type, f.ticker, range.from, range.to],
  )
  const listFilters = useMemo<TradeLogFilters>(
    () => ({
      ...signalFilters,
      source: f.source,
      outcome: f.outcome as OutcomeFilter,
      reason: f.reason,
      account: f.account,
    }),
    [signalFilters, f.source, f.outcome, f.reason, f.account],
  )
  const signalKey = `${f.exchange}|${f.feed}|${f.side}|${f.type}|${f.ticker}|${range.from}|${range.to}`
  const listKey = `${signalKey}|${f.source}|${f.outcome}|${f.reason}|${f.account}`

  const [paging, setPaging] = useState({ key: listKey, page: 1 })
  const page = paging.key === listKey ? paging.page : 1
  const setPage = (next: number) => setPaging({ key: listKey, page: next })

  const accountFiltersActive = f.outcome !== 'all' || f.reason !== 'all' || f.account !== ''

  /** Narrow the list to one issue's cause (and account, when it has one). */
  const focusIssue = (reasonKey: string, accountName: string | null) =>
    url.setMany({ outcome: 'all', reason: reasonKey, account: accountName ?? '' })

  return {
    ...f,
    datePreset: preset,
    /** The YYYY-MM-DD bounds the date preset (or the custom pair) works out to. */
    range,
    set: url.set,
    setMany: url.setMany,
    reset: url.reset,
    clear: url.clear,
    isActive: url.isActive,
    activeCount: url.activeCount,
    page,
    setPage,
    signalFilters,
    listFilters,
    signalKey,
    listKey,
    accountFiltersActive,
    focusIssue,
  }
}

export type TradeLogFilterState = ReturnType<typeof useTradeLogFilters>
