import { ShieldAlert, Users } from 'lucide-react'
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
import { countryName, deviceTypeLabel } from '../../../lib/accessEvents'
import { visitPageLabel } from '../../../lib/visitPages'
import type { VisitorFilterState } from '../../../hooks/useVisitorFilters'
import type { VisitorDevice } from '../../../types/visitors'

const VIEWS: SegmentedOption[] = [
  { value: 'clean', label: 'Visitors', icon: Users },
  { value: 'suspicious', label: 'Suspicious', icon: ShieldAlert, tone: 'red' },
  { value: 'all', label: 'All' },
]

const DEVICES: SegmentedOption[] = [
  { value: 'all', label: 'All' },
  ...(['desktop', 'mobile', 'tablet'] as VisitorDevice[]).map((d) => ({ value: d, label: deviceTypeLabel(d) })),
]

/** One full-width line of the panel. */
const ROW = 'flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-3.5'

/**
 * The visitor log's filters (shared filter kit — see FilterPanel): what to
 * show first, then page / country / device, then an IP search. Clicking an
 * address in the log sets an EXACT IP filter, shown as its own chip. These
 * narrow the log only; the period above scopes the whole page.
 *
 * Lives OUTSIDE the re-keyed list region, so typing never remounts the input.
 */
export default function VisitorLogToolbar({
  filters: f,
  pages,
  countries,
  summary,
}: {
  filters: VisitorFilterState
  pages: string[]
  countries: string[]
  summary?: string
}) {
  // The chosen value stays selectable even when nothing in view has it any more.
  const withCurrent = (values: string[], current: string) =>
    current === 'all' || values.includes(current) ? values : [...values, current]
  const pageOptions = [
    { value: 'all', label: 'All pages' },
    ...withCurrent(pages, f.path).map((p) => ({ value: p, label: visitPageLabel(p) })),
  ]
  const countryOptions = [
    { value: 'all', label: 'All countries' },
    ...withCurrent(countries, f.country).map((c) => ({ value: c, label: countryName(c) ?? c })),
  ]

  const chips: ActiveFilterItem[] = []
  if (f.view !== 'clean') {
    chips.push({
      key: 'view',
      label: f.view === 'suspicious' ? 'Suspicious only' : 'Including suspicious',
      onRemove: () => f.reset('view'),
    })
  }
  if (f.path !== 'all') chips.push({ key: 'path', label: visitPageLabel(f.path), onRemove: () => f.reset('path') })
  if (f.country !== 'all') {
    chips.push({ key: 'country', label: countryName(f.country) ?? f.country, onRemove: () => f.reset('country') })
  }
  if (f.device !== 'all') {
    chips.push({ key: 'device', label: deviceTypeLabel(f.device as VisitorDevice), onRemove: () => f.reset('device') })
  }
  if (f.ip !== '') chips.push({ key: 'ip', label: `IP ${f.ip}`, onRemove: () => f.reset('ip') })
  if (f.q !== '') chips.push({ key: 'q', label: `IP starts “${f.q}”`, onRemove: () => f.reset('q') })

  return (
    <div className="mb-stack flex flex-col gap-3">
      <FilterPanel activeCount={chips.length} onClearAll={f.clearLog} summary={summary}>
        <div className={ROW}>
          <FilterGroup label="Show">
            <Segmented value={f.view} onChange={(v) => f.set('view', v)} options={VIEWS} ariaLabel="Which visits" size="sm" />
          </FilterGroup>
          <FilterGroup label="Device">
            <Segmented value={f.device} onChange={(v) => f.set('device', v)} options={DEVICES} ariaLabel="Device" size="sm" />
          </FilterGroup>
        </div>

        <div className={`${ROW} border-t border-hair pt-4`}>
          <FilterGroup label="Page">
            <FilterSelect
              value={f.path}
              onChange={(v) => f.set('path', v)}
              options={pageOptions}
              ariaLabel="Page"
              className="min-w-[180px]"
            />
          </FilterGroup>
          <FilterGroup label="Country">
            <FilterSelect
              value={f.country}
              onChange={(v) => f.set('country', v)}
              options={countryOptions}
              ariaLabel="Country"
              className="min-w-[180px]"
            />
          </FilterGroup>
          <FilterGroup label="IP address" className="w-full sm:w-auto">
            <SearchField
              value={f.q}
              onChange={(v) => f.set('q', v)}
              placeholder="Start of an IP address…"
              ariaLabel="Search by IP address"
              className="w-full sm:w-[240px]"
            />
          </FilterGroup>
        </div>
      </FilterPanel>

      <ActiveFilters items={chips} onClearAll={f.clearLog} />
    </div>
  )
}
