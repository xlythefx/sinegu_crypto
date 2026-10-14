import { useId, type ReactNode } from 'react'

/** The small mono caption every filter carries ("EXCHANGE", "COIN", "DATE"). */
export const FILTER_LABEL =
  'font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint'

interface FilterGroupProps {
  label: string
  children: ReactNode
  className?: string
}

/**
 * One labelled filter inside a `FilterPanel`. On a phone the caption sits
 * above a full-width control; from 640px up it sits beside the control and
 * the groups flow in a row, wrapping as the panel narrows.
 */
export default function FilterGroup({ label, children, className = '' }: FilterGroupProps) {
  const labelId = useId()
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={`flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 ${className}`}
    >
      <span id={labelId} className={`${FILTER_LABEL} whitespace-nowrap`}>
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
