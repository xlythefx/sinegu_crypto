import { apiFetch } from './api'
import type { Analytics } from '../types/analytics'

export interface AnalyticsFilters {
  /** 'all' (or omitted) returns every exchange. */
  exchange?: string
  /** 'YYYY-MM-DD' inclusive lower bound. */
  from?: string
  /** 'YYYY-MM-DD' inclusive upper bound. */
  to?: string
}

export async function getAnalytics(
  filters?: AnalyticsFilters,
): Promise<Analytics> {
  const params = new URLSearchParams()
  if (filters?.exchange && filters.exchange !== 'all') {
    params.set('exchange', filters.exchange)
  }
  if (filters?.from) params.set('from', filters.from)
  if (filters?.to) params.set('to', filters.to)

  const qs = params.toString()
  const res = await apiFetch<{ success: boolean; analytics: Analytics }>(
    qs ? `/analytics?${qs}` : '/analytics',
    { auth: true },
  )
  // PHP serializes an empty keyed collection as [] — normalize to an object
  if (Array.isArray(res.analytics.daily_pnl)) res.analytics.daily_pnl = {}
  return res.analytics
}
