import { AlertTriangle, CirclePause, CirclePlay } from 'lucide-react'
import {
  ActiveFilters,
  FilterGroup,
  FilterPanel,
  FilterSelect,
  SearchField,
  Segmented,
  type ActiveFilterItem,
  type SegmentedOption,
} from '../../ui/filters'
import type { AssetStatus } from '../../../lib/assetFilters'
import type { UrlFilters } from '../../../hooks/useUrlFilters'

export type AssetFilterValues = { q: string; status: string; type: string }

const STATUS_LABEL: Record<AssetStatus, string> = {
  all: 'All',
  on: 'Trading',
  off: 'Off',
  attention: 'Needs attention',
}

interface AssetsToolbarProps {
  filters: UrlFilters<AssetFilterValues>
  /** Coins per status in the exchange in view (not the search), so the counts never jump while typing. */
  counts: Record<AssetStatus, number>
  types: string[]
  summary: string
}

/**
 * Trading Assets' filters (shared filter kit — see FilterPanel): status first,
 * then type, then a search. The exchange is the page's switcher above, shared
 * with the other tabs. Lives OUTSIDE the re-keyed list, so typing keeps focus.
 */
export default function AssetsToolbar({ filters: f, counts, types, summary }: AssetsToolbarProps) {
  const status = f.filters.status as AssetStatus
  const statusOptions: SegmentedOption<AssetStatus>[] = [
    { value: 'all', label: STATUS_LABEL.all, count: counts.all },
    { value: 'on', label: STATUS_LABEL.on, count: counts.on, icon: CirclePlay, tone: 'green' },
    { value: 'off', label: STATUS_LABEL.off, count: counts.off, icon: CirclePause },
    {
      value: 'attention',
      label: STATUS_LABEL.attention,
      count: counts.attention,
      icon: AlertTriangle,
      tone: 'accent',
    },
  ]
  const typeOptions = [
    { value: 'all', label: 'All types' },
    ...types.map((t) => ({ value: t, label: t })),
  ]

  const chips: ActiveFilterItem[] = []
  if (status !== 'all') chips.push({ key: 'status', label: STATUS_LABEL[status], onRemove: () => f.reset('status') })
  if (f.filters.type !== 'all') chips.push({ key: 'type', label: f.filters.type, onRemove: () => f.reset('type') })
  if (f.filters.q !== '') chips.push({ key: 'q', label: `“${f.filters.q}”`, onRemove: () => f.reset('q') })

  return (
    <div className="flex flex-col gap-3">
      <FilterPanel activeCount={f.activeCount} onClearAll={f.clear} summary={summary}>
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-7 sm:gap-y-3.5">
          <FilterGroup label="Status">
            <Segmented
              value={status}
              onChange={(v) => f.set('status', v)}
              options={statusOptions}
              ariaLabel="Coin status"
              size="sm"
            />
          </FilterGroup>
          {types.length > 1 && (
            <FilterGroup label="Type">
              <FilterSelect
                value={f.filters.type}
                onChange={(v) => f.set('type', v)}
                options={typeOptions}
                ariaLabel="Asset type"
                className="min-w-[170px]"
              />
            </FilterGroup>
          )}
          <FilterGroup label="Search" className="w-full sm:w-auto sm:flex-1">
            <SearchField
              value={f.filters.q}
              onChange={(v) => f.set('q', v)}
              placeholder="Ticker, e.g. LTC"
              ariaLabel="Search coins by ticker"
              className="w-full sm:max-w-[280px]"
            />
          </FilterGroup>
        </div>
      </FilterPanel>
      <ActiveFilters items={chips} onClearAll={f.clear} />
    </div>
  )
}
