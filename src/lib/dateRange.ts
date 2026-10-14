/**
 * Date presets for the admin filter bar (`components/ui/filters/DateRangeFilter`).
 *
 * Every date is a 'YYYY-MM-DD' string on the READER's local calendar — the day
 * the admin looking at the screen calls "today" — and '' means open-ended.
 * Only the PRESET is worth keeping in a URL: "Last 7 days" shared tomorrow
 * should still mean the last 7 days, so a page stores the preset and derives
 * the window with `rangeFor` when it asks the API. `from` / `to` are stored
 * only for 'custom'. Pure — no React.
 */
import { localIsoDate } from './capture'
import { fmtMediumDate } from './format'

export type DatePreset = 'all' | 'today' | '24h' | '7d' | '30d' | 'custom'

export interface DateRange {
  /** 'YYYY-MM-DD', or '' for no lower bound. */
  from: string
  /** 'YYYY-MM-DD', or '' for no upper bound. */
  to: string
}

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '24h', label: 'Last 24 h' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
]

/** Every preset value — handy as `useUrlFilters`' `allowed` list. */
export const DATE_PRESET_VALUES: readonly DatePreset[] = DATE_PRESETS.map((p) => p.value)

export function isDatePreset(value: string): value is DatePreset {
  return (DATE_PRESET_VALUES as readonly string[]).includes(value)
}

/** The local calendar date `days` before `now` (month and DST safe). */
function daysAgo(now: Date, days: number): string {
  return localIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days))
}

/**
 * The window a preset covers, both ends inclusive. "Last 24 h" spans
 * yesterday and today because the API filters whole days.
 */
export function rangeFor(preset: DatePreset, custom: DateRange, now: Date = new Date()): DateRange {
  const today = localIsoDate(now)
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '24h':
      return { from: daysAgo(now, 1), to: today }
    case '7d':
      return { from: daysAgo(now, 6), to: today }
    case '30d':
      return { from: daysAgo(now, 29), to: today }
    case 'custom':
      return { from: custom.from, to: custom.to }
    case 'all':
    default:
      return { from: '', to: '' }
  }
}

/**
 * Plain-English name for the chosen window, for an active-filter chip:
 * "Last 7 days", "Oct 1, 2026 – Oct 14, 2026", "From Oct 1, 2026".
 */
export function dateRangeLabel(preset: DatePreset, from: string, to: string): string {
  if (preset !== 'custom') {
    return DATE_PRESETS.find((p) => p.value === preset)?.label ?? 'All time'
  }
  if (from && to) return from === to ? fmtMediumDate(from) : `${fmtMediumDate(from)} – ${fmtMediumDate(to)}`
  if (from) return `From ${fmtMediumDate(from)}`
  if (to) return `Until ${fmtMediumDate(to)}`
  return 'Custom dates'
}
