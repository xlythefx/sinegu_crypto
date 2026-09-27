import { apiFetch } from './api'
import type { Analytics, ChipMode } from '../types/analytics'

export interface AnalyticsFilters {
  /** 'all' (or omitted) returns every exchange. */
  exchange?: string
  /** 'YYYY-MM-DD' inclusive lower bound. */
  from?: string
  /** 'YYYY-MM-DD' inclusive upper bound. */
  to?: string
  /** Raw symbols (e.g. 'BTCUSDT'), not display labels. Empty = no filter. */
  symbols?: string[]
  symbolMode?: ChipMode
  /** Strategy tags; untagged trades are selected as 'Untagged'. */
  strategies?: string[]
  strategyMode?: ChipMode
}

/**
 * Append a chip selection as `key[]=A&key[]=B`, which PHP reads as an array.
 * The mode rides along only when something is actually selected, so an idle
 * filter bar leaves the URL (and the browser cache key) untouched. It is
 * always sent explicitly: the API's own fallback for a missing mode is
 * `exclude`, while the page defaults to `include`.
 */
function appendChips(
  params: URLSearchParams,
  key: string,
  modeKey: string,
  values: string[] | undefined,
  mode: ChipMode | undefined,
): void {
  if (!values || values.length === 0) return
  // Sorted so the same selection always produces the same URL.
  for (const value of [...values].sort()) params.append(`${key}[]`, value)
  params.set(modeKey, mode ?? 'include')
}

export function getAnalytics(filters?: AnalyticsFilters): Promise<Analytics> {
  return fetchAnalytics('/analytics', filters)
}

/**
 * The same payload for any user (admin only) — the admin dashboard's Master
 * Account tab reads the master's analytics through it.
 */
export function getAdminUserAnalytics(
  uniId: string,
  filters?: AnalyticsFilters,
): Promise<Analytics> {
  return fetchAnalytics(`/admin/users/${encodeURIComponent(uniId)}/analytics`, filters)
}

async function fetchAnalytics(
  path: string,
  filters?: AnalyticsFilters,
): Promise<Analytics> {
  const params = new URLSearchParams()
  if (filters?.exchange && filters.exchange !== 'all') {
    params.set('exchange', filters.exchange)
  }
  if (filters?.from) params.set('from', filters.from)
  if (filters?.to) params.set('to', filters.to)
  appendChips(
    params,
    'symbols',
    'symbol_mode',
    filters?.symbols,
    filters?.symbolMode,
  )
  appendChips(
    params,
    'strategies',
    'strategy_mode',
    filters?.strategies,
    filters?.strategyMode,
  )

  const qs = params.toString()
  const res = await apiFetch<{ success: boolean; analytics: Analytics }>(
    qs ? `${path}?${qs}` : path,
    { auth: true },
  )
  // PHP serializes an empty keyed collection as [] — normalize to an object
  // so the declared Record types are not a lie for an account with no history.
  const a = res.analytics
  if (Array.isArray(a.daily_pnl)) a.daily_pnl = {}
  if (Array.isArray(a.daily_pnl_net)) a.daily_pnl_net = {}
  if (Array.isArray(a.daily_capital)) a.daily_capital = {}
  if (Array.isArray(a.daily_flows)) a.daily_flows = {}
  if (Array.isArray(a.daily_balance)) a.daily_balance = {}
  return a
}
