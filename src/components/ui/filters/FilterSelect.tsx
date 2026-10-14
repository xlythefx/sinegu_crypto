import { Fragment } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * The box every native field in the filter bar shares (select, date): one
 * height, radius and focus glow, so a select beside a date input reads as a
 * set. The global outline is swapped for the border + glow, which marks focus
 * just as clearly without a second ring around the box.
 */
export const FILTER_FIELD =
  'h-9 min-w-0 max-w-full rounded-field border border-border bg-surface2 px-3 text-[12.5px] font-semibold text-text outline-none transition-[border-color,box-shadow] duration-150 hover:border-accent-line focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_16%,transparent)] focus-visible:outline-none'

export interface FilterSelectOption<V extends string = string> {
  value: V
  label: string
  /** Rows this choice would show; printed as "Label (12)". */
  count?: number
  /** Consecutive options with the same group render under one <optgroup>. */
  group?: string
}

interface FilterSelectProps<V extends string> {
  value: V
  onChange: (value: V) => void
  options: FilterSelectOption<V>[]
  ariaLabel: string
  className?: string
}

function optionText({ label, count }: FilterSelectOption): string {
  return count === undefined ? label : `${label} (${count.toLocaleString()})`
}

/** Consecutive runs of options sharing a group (ungrouped runs have none). */
function runs<V extends string>(options: FilterSelectOption<V>[]) {
  const out: { group?: string; options: FilterSelectOption<V>[] }[] = []
  for (const option of options) {
    const last = out[out.length - 1]
    if (last && last.group === option.group) last.options.push(option)
    else out.push({ group: option.group, options: [option] })
  }
  return out
}

/**
 * A styled native <select> for facets with many choices (coin, account,
 * reason). Native on purpose: a phone opens its own picker, which beats any
 * custom dropdown for a long list.
 *
 * A value no longer among the options (an old link, a coin with no rows in
 * this window) is kept as an extra option, so the box never silently shows a
 * different choice from the one actually applied.
 */
export default function FilterSelect<V extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: FilterSelectProps<V>) {
  const list = options.some((o) => o.value === value)
    ? options
    : [{ value, label: value }, ...options]

  return (
    <span className="relative flex w-full min-w-0 sm:inline-flex sm:w-auto">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        aria-label={ariaLabel}
        className={`${FILTER_FIELD} w-full cursor-pointer appearance-none pr-9 sm:min-w-[150px] sm:max-w-[280px] [&>option]:bg-surface ${className}`}
      >
        {runs(list).map((run, i) =>
          run.group ? (
            <optgroup key={`${run.group}-${i}`} label={run.group}>
              {run.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {optionText(o)}
                </option>
              ))}
            </optgroup>
          ) : (
            <Fragment key={`run-${i}`}>
              {run.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {optionText(o)}
                </option>
              ))}
            </Fragment>
          ),
        )}
      </select>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
      />
    </span>
  )
}
