import { useMemo, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Info, RadioTower } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import VsMasterSummary from '../../components/admin/vs-master/VsMasterSummary'
import VsMasterChart from '../../components/admin/vs-master/VsMasterChart'
import VsMasterTable from '../../components/admin/vs-master/VsMasterTable'
import { STAGGER_REVEAL } from '../../components/admin/strategy-detail/stagger'
import {
  ActiveFilters,
  DateRangeFilter,
  FilterGroup,
  FilterPanel,
  SearchField,
  Segmented,
  type ActiveFilterItem,
  type SegmentedOption,
} from '../../components/ui/filters'
import { EXCHANGE_META } from '../../components/exchanges/meta'
import { useApiData } from '../../hooks/useApiData'
import { useUrlFilters } from '../../hooks/useUrlFilters'
import { getVsMaster } from '../../services/admin'
import { ApiError } from '../../services/api'
import { MONTH_DATE_PRESETS, dateRangeLabel, rangeFor, type DatePreset } from '../../lib/dateRange'
import { localIsoDate } from '../../lib/capture'
import { fmtMediumDate } from '../../lib/format'
import { showRow, summarize, type VsShow } from '../../lib/vsMaster'

const ROW = 'flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-3.5'
const DEFAULTS = { exchange: 'all', date: 'month', from: '', to: '', show: 'all', q: '' }
const EXCHANGES: SegmentedOption[] = [
  { value: 'all', label: 'All', tone: 'neutral' },
  ...(['binance', 'mexc', 'bybit'] as const).map((k) => ({ value: k, label: EXCHANGE_META[k].label })),
]
const SHOW: SegmentedOption<VsShow>[] = [
  { value: 'all', label: 'Everyone', tone: 'neutral' },
  { value: 'ahead', label: 'Ahead', tone: 'green', icon: ArrowUpRight },
  { value: 'behind', label: 'Behind', tone: 'red', icon: ArrowDownRight },
  { value: 'missed', label: 'Missed trades', icon: RadioTower },
]
/** "All time" asks from a date before the product existed. */
const EPOCH = '2026-01-01'

/**
 * Admin → Customers vs master (2026-11-23): every customer's return beside
 * the master's over the same days, ranked, with how many of the master's
 * trades each one followed. The API measures (MasterComparison); this page
 * only filters, sorts and draws.
 */
export default function AdminVsMaster() {
  const f = useUrlFilters(DEFAULTS, {
    allowed: {
      exchange: EXCHANGES.map((o) => o.value),
      date: MONTH_DATE_PRESETS.map((p) => p.value),
      show: SHOW.map((o) => o.value),
    },
  })
  const v = f.filters
  const preset = v.date as DatePreset
  const range = rangeFor(preset, { from: v.from, to: v.to })
  const from = range.from || EPOCH
  const to = range.to || localIsoDate()

  const { data, loading, error, reload } = useApiData(
    () => getVsMaster({ exchange: v.exchange, from, to }),
    [v.exchange, from, to],
  )

  const rows = useMemo(() => {
    const q = v.q.toLowerCase()
    return (data?.customers ?? []).filter(
      (r) => showRow(r, v.show as VsShow) && (!q || r.name.toLowerCase().includes(q)),
    )
  }, [data, v.show, v.q])
  const summary = useMemo(() => summarize(data?.customers ?? []), [data])

  // Replay the cards on a filter change — not on the first load (AOS's).
  const signature = [v.exchange, from, to, v.show, v.q].join('|')
  const first = useRef(signature)
  const changed = signature !== first.current

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const chips: ActiveFilterItem[] = []
  if (v.exchange !== 'all') {
    chips.push({ key: 'exchange', label: EXCHANGES.find((o) => o.value === v.exchange)?.label ?? v.exchange, onRemove: () => f.reset('exchange') })
  }
  if (v.date !== 'month') {
    chips.push({ key: 'date', label: dateRangeLabel(preset, v.from, v.to), onRemove: () => f.setMany({ date: 'month', from: '', to: '' }) })
  }
  if (v.show !== 'all') {
    chips.push({ key: 'show', label: SHOW.find((o) => o.value === v.show)?.label ?? v.show, onRemove: () => f.reset('show') })
  }
  if (v.q) chips.push({ key: 'q', label: `“${v.q}”`, onRemove: () => f.reset('q') })

  const period = data
    ? data.from === data.to
      ? fmtMediumDate(data.from)
      : `${fmtMediumDate(data.from)} – ${fmtMediumDate(data.to)}`
    : ''

  return (
    <AdminLayout
      title="Customers vs master"
      subtitle="Every customer’s return beside the master’s, over the same days."
    >
      <div className="mb-4 flex flex-col gap-3" data-aos="fade-up">
        <FilterPanel
          activeCount={chips.length}
          onClearAll={f.clear}
          summary={data ? `${rows.length} of ${data.customers.length} customers · ${period}` : undefined}
        >
          <div className={ROW}>
            <FilterGroup label="Exchange">
              <Segmented size="sm" value={v.exchange} onChange={(x) => f.set('exchange', x)} options={EXCHANGES} ariaLabel="Exchange" />
            </FilterGroup>
            <FilterGroup label="Show">
              <Segmented<VsShow> size="sm" value={v.show as VsShow} onChange={(x) => f.set('show', x)} options={SHOW} ariaLabel="Which customers" />
            </FilterGroup>
            <FilterGroup label="Customer">
              <SearchField value={v.q} onChange={(x) => f.set('q', x)} placeholder="Search a name…" ariaLabel="Search a customer" />
            </FilterGroup>
          </div>
          <div className={ROW}>
            <FilterGroup label="Dates">
              <DateRangeFilter
                preset={preset}
                from={v.from}
                to={v.to}
                presets={MONTH_DATE_PRESETS}
                onChange={(d) =>
                  f.setMany(d.preset === 'custom' ? { date: d.preset, from: d.from, to: d.to } : { date: d.preset, from: '', to: '' })
                }
              />
            </FilterGroup>
          </div>
        </FilterPanel>
        {chips.length > 0 && <ActiveFilters items={chips} onClearAll={f.clear} />}
      </div>

      {!data ? (
        <DataState loading={loading} error={error} onRetry={reload} label="comparison" />
      ) : (
        <div
          key={signature}
          className={`${changed ? STAGGER_REVEAL : ''} transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}
          aria-busy={loading}
        >
          <VsMasterSummary data={data} summary={summary} />
          <VsMasterChart rows={rows} masterPct={data.master?.pct ?? null} />
          <VsMasterTable rows={rows} animateKey={signature} />
          <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
            <Info size={14} className="mt-0.5 flex-none text-faint" />
            <span>
              Return = each day’s P&amp;L after fees over the money the account started that day with, the days
              added up — the same figure as the P&amp;L calendar, so deposits and withdrawals do not move it.
              “vs master” is the difference in percentage points. A master trade counts as followed when the
              customer closed the same coin and side on the same exchange within 15 minutes; it only counts
              against customers who had an account there at the time. Days are UTC days. Customers only, real
              money only.
            </span>
          </p>
        </div>
      )}
    </AdminLayout>
  )
}
