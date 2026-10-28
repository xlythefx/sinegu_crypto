import { useMemo, useState } from 'react'
import { useUrlFilters } from './useUrlFilters'
import { DATE_PRESET_VALUES, isDatePreset, rangeFor } from '../lib/dateRange'
import type { VisitorLogFilters, VisitorLogView } from '../types/visitors'

/** Every Admin → Visitors filter and its "off" value. The page opens on the last 30 days. */
const DEFAULTS = {
  date: '30d',
  from: '',
  to: '',
  view: 'clean',
  path: 'all',
  country: 'all',
  device: 'all',
  ip: '',
  q: '',
}

const ALLOWED = {
  date: DATE_PRESET_VALUES,
  view: ['clean', 'suspicious', 'all'],
  device: ['all', 'desktop', 'mobile', 'tablet'],
}

/**
 * Filter state for Admin → Visitors, in the URL (useUrlFilters).
 *
 * Two levels, kept apart because the page treats them apart:
 * - the PERIOD (date preset or custom pair) scopes every card AND the log;
 * - the LOG filters (show, page, country, device, IP) narrow the log only —
 *   the cards above it always describe the whole period.
 *
 * The log's page number is derived from the filters it was chosen under, so
 * any filter change lands back on page 1 with no reset effect.
 */
export function useVisitorFilters() {
  const url = useUrlFilters(DEFAULTS, { allowed: ALLOWED })
  const f = url.filters
  const preset = isDatePreset(f.date) ? f.date : '30d'
  const range = useMemo(() => rangeFor(preset, { from: f.from, to: f.to }), [preset, f.from, f.to])

  const logFilters = useMemo<VisitorLogFilters>(
    () => ({
      from: range.from,
      to: range.to,
      view: f.view as VisitorLogView,
      page: f.path,
      country: f.country,
      device: f.device,
      ip: f.ip,
      q: f.q,
    }),
    [range.from, range.to, f.view, f.path, f.country, f.device, f.ip, f.q],
  )
  const rangeKey = `${range.from}|${range.to}`
  const logKey = `${rangeKey}|${f.view}|${f.path}|${f.country}|${f.device}|${f.ip}|${f.q}`

  const [paging, setPaging] = useState({ key: logKey, page: 1 })
  const page = paging.key === logKey ? paging.page : 1
  const setPage = (next: number) => setPaging({ key: logKey, page: next })

  /** Narrow the log to one address (clicking an IP); the typed search makes way for it. */
  const focusIp = (ip: string) => url.setMany({ ip, q: '', view: 'all' })

  const logActive =
    f.view !== 'clean' || f.path !== 'all' || f.country !== 'all' || f.device !== 'all' || f.ip !== '' || f.q !== ''

  return {
    ...f,
    datePreset: preset,
    range,
    rangeKey,
    logFilters,
    logKey,
    logActive,
    set: url.set,
    setMany: url.setMany,
    reset: url.reset,
    page,
    setPage,
    focusIp,
    /** The log's filters back to their defaults; the period stays. */
    clearLog: () => url.setMany({ view: 'clean', path: 'all', country: 'all', device: 'all', ip: '', q: '' }),
  }
}

export type VisitorFilterState = ReturnType<typeof useVisitorFilters>
