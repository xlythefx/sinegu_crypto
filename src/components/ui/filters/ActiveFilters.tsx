import { X } from 'lucide-react'

export interface ActiveFilterItem {
  key: string
  /** What the chip says — name the facet and the value: "Exchange: Binance". */
  label: string
  onRemove: () => void
}

interface ActiveFiltersProps {
  items: ActiveFilterItem[]
  onClearAll: () => void
  className?: string
}

/**
 * The applied filters as removable chips, under the `FilterPanel`. On a phone
 * the panel starts collapsed, so this row is what tells the admin the list is
 * narrowed — and lets them undo one filter without opening it.
 * Renders nothing when no filter is applied.
 */
export default function ActiveFilters({ items, onClearAll, className = '' }: ActiveFiltersProps) {
  if (items.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      <ul aria-label="Active filters" className="m-0 flex min-w-0 list-none flex-wrap items-center gap-2 p-0">
        {items.map((item) => (
          <li key={item.key} className="min-w-0 max-w-full list-none">
            <button
              type="button"
              onClick={item.onRemove}
              aria-label={`Remove filter: ${item.label}`}
              title="Remove this filter"
              className="group inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-pill border border-accent-line bg-accent-soft py-1 pl-3 pr-2 text-[12px] font-semibold text-accent transition-colors duration-150 hover:border-accent"
            >
              <span className="min-w-0 truncate">{item.label}</span>
              <X
                size={12}
                aria-hidden="true"
                className="flex-none opacity-70 transition-opacity group-hover:opacity-100"
              />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex min-h-8 items-center px-1 text-[12.5px] font-semibold text-accent underline-offset-2 hover:underline"
      >
        Clear all
      </button>
    </div>
  )
}
