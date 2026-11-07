import type { ReactNode } from 'react'

export interface Choice<V extends string | number> {
  value: V
  label: ReactNode
  /** Small second line under the label ("long & short"). */
  hint?: string
  /** Leading visual, e.g. an exchange logo. */
  icon?: ReactNode
}

interface ChoiceGroupProps<V extends string | number> {
  labelId: string
  value: V
  options: Choice<V>[]
  onChange: (value: V) => void
  /** Columns on a wide enough screen; a narrow phone gets two. */
  columns?: 2 | 3 | 4
}

const COLS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 min-[360px]:grid-cols-3',
  4: 'grid-cols-2 min-[440px]:grid-cols-4',
}

/**
 * A single choice shown as buttons (a radio group): exchange, side, 1×/2×/3×.
 * Every option is visible at once, which a select hides, and each is a 44px
 * target. Arrow keys are the browser's default for buttons — Tab moves through
 * them in order, Space/Enter picks.
 */
export default function ChoiceGroup<V extends string | number>({
  labelId,
  value,
  options,
  onChange,
  columns = 3,
}: ChoiceGroupProps<V>) {
  return (
    <div role="radiogroup" aria-labelledby={labelId} className={`grid gap-2 ${COLS[columns]}`}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            // With an icon, a phone stacks it over the label: three exchange
            // names side by side do not fit 390px with their logos beside them.
            className={`flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-field border px-2.5 py-2 text-center font-body transition-[border-color,background,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              o.icon ? 'flex-col gap-1 min-[480px]:flex-row min-[480px]:gap-2' : 'gap-2'
            } ${
              on
                ? 'border-accent bg-accent-soft text-text'
                : 'border-border bg-surface2 text-muted hover:border-accent hover:text-text'
            }`}
          >
            {o.icon}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold">{o.label}</span>
              {o.hint && <span className="block truncate text-[10.5px] font-medium text-faint">{o.hint}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
