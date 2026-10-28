import { apiFetch } from './api'
import type { VisitorLog, VisitorLogFilters, VisitorSummary } from '../types/visitors'

/** Admin → Visitors — every staff role, IP included. */

/** `from` / `to` as 'YYYY-MM-DD'; '' leaves that end open (since counting started / today). */
export function getVisitorSummary(from: string, to: string): Promise<VisitorSummary> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return apiFetch<VisitorSummary>(`/admin/visitors/summary${qs ? `?${qs}` : ''}`, { auth: true })
}

export function getVisitorLog(
  filters: VisitorLogFilters,
  limit: number,
  offset: number,
): Promise<VisitorLog> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') params.set(key, value)
  }
  // 'all' is a real view for the log (suspicious included), unlike the facets.
  if (filters.view === 'all') params.set('view', 'all')
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  return apiFetch<VisitorLog>(`/admin/visitors/log?${params.toString()}`, { auth: true })
}
