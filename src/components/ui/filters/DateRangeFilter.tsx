import Segmented from './Segmented'
import { FILTER_FIELD } from './FilterSelect'
import { DATE_PRESETS, rangeFor, type DatePreset } from '../../../lib/dateRange'

export interface DateRangeValue {
  preset: DatePreset
  /** 'YYYY-MM-DD' or ''. Only meaningful for 'custom'. */
  from: string
  /** 'YYYY-MM-DD' or ''. Only meaningful for 'custom'. */
  to: string
}

interface DateRangeFilterProps extends DateRangeValue {
  onChange: (next: DateRangeValue) => void
}

const DATE_INPUT = `${FILTER_FIELD} flex-1 cursor-pointer sm:flex-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100`

/**
 * Preset windows plus, only under "Custom", a From / To pair.
 *
 * A preset reports empty `from` / `to`: the page keeps just the preset (so a
 * shared "Last 7 days" stays relative) and asks the API for
 * `rangeFor(preset, { from, to })`. Switching TO Custom starts from the
 * window that was on screen, so "Last 7 days" can be nudged by a day rather
 * than typed from scratch.
 */
export default function DateRangeFilter({ preset, from, to, onChange }: DateRangeFilterProps) {
  const pick = (next: DatePreset) => {
    if (next === preset) return
    if (next === 'custom') onChange({ preset: next, ...rangeFor(preset, { from, to }) })
    else onChange({ preset: next, from: '', to: '' })
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <Segmented size="sm" value={preset} onChange={pick} options={DATE_PRESETS} ariaLabel="Date range" />

      {preset === 'custom' && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="flex items-center gap-2.5 text-[12px] font-semibold text-muted">
            <span className="w-9 flex-none sm:w-auto">From</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => onChange({ preset, from: e.target.value, to })}
              className={DATE_INPUT}
            />
          </label>
          <label className="flex items-center gap-2.5 text-[12px] font-semibold text-muted">
            <span className="w-9 flex-none sm:w-auto">To</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => onChange({ preset, from, to: e.target.value })}
              className={DATE_INPUT}
            />
          </label>
        </div>
      )}
    </div>
  )
}
