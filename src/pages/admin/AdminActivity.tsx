import { Navigate } from 'react-router-dom'
import { Info, LogIn, ShieldCheck, UserRound } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ActivityList from '../../components/admin/activity/ActivityList'
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
import { useApiData } from '../../hooks/useApiData'
import { useUrlFilters } from '../../hooks/useUrlFilters'
import { getAdminActivity } from '../../services/admin'
import { ApiError } from '../../services/api'
import { DATE_PRESETS, dateRangeLabel, rangeFor, type DatePreset } from '../../lib/dateRange'
import type { ActivitySource } from '../../types/activity'

const ROW = 'flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-3.5'
const DEFAULTS = { source: 'all', q: '', date: 'all', from: '', to: '', page: '1' }
const SOURCES: SegmentedOption<ActivitySource | 'all'>[] = [
  { value: 'all', label: 'Everything', tone: 'neutral' },
  { value: 'customer', label: 'Their own actions', icon: UserRound },
  { value: 'signin', label: 'Sign-ins & sign-ups', icon: LogIn },
  { value: 'admin', label: 'Admin actions', icon: ShieldCheck },
]

/**
 * Admin → Activity (Dima, 2026-11-23: "see last activity across all users"):
 * every user's own actions, every sign-in and sign-up, and every admin action,
 * newest first, one list. The API merges the three records (ActivityFeed);
 * each user's own slice is the Timeline tab on their profile.
 */
export default function AdminActivity() {
  const f = useUrlFilters(DEFAULTS, {
    allowed: { source: SOURCES.map((o) => o.value), date: DATE_PRESETS.map((p) => p.value) },
  })
  const v = f.filters
  const preset = v.date as DatePreset
  const range = rangeFor(preset, { from: v.from, to: v.to })
  const page = Math.max(1, Number(v.page) || 1)

  const { data, loading, error, reload } = useApiData(
    () => getAdminActivity({ source: v.source as ActivitySource | 'all', q: v.q, from: range.from, to: range.to, page }),
    [v.source, v.q, range.from, range.to, page],
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  // Any filter change starts again at page 1.
  const setFilter = (patch: Partial<typeof DEFAULTS>) => f.setMany({ ...patch, page: '1' })

  const chips: ActiveFilterItem[] = []
  if (v.source !== 'all') {
    chips.push({ key: 'source', label: SOURCES.find((o) => o.value === v.source)?.label ?? v.source, onRemove: () => setFilter({ source: 'all' }) })
  }
  if (v.q) chips.push({ key: 'q', label: `“${v.q}”`, onRemove: () => setFilter({ q: '' }) })
  if (v.date !== 'all') {
    chips.push({ key: 'date', label: dateRangeLabel(preset, v.from, v.to), onRemove: () => setFilter({ date: 'all', from: '', to: '' }) })
  }

  const first = data ? (data.page - 1) * data.per_page + 1 : 0
  const last = data ? Math.min(data.total, data.page * data.per_page) : 0
  const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1

  return (
    <AdminLayout title="Activity" subtitle="What every user did, every sign-in, and every admin action — newest first.">
      <div className="mb-4 flex flex-col gap-3" data-aos="fade-up">
        <FilterPanel
          activeCount={chips.length}
          onClearAll={f.clear}
          summary={data ? `${data.total.toLocaleString()} ${data.total === 1 ? 'entry' : 'entries'}` : undefined}
        >
          <div className={ROW}>
            <FilterGroup label="Show">
              <Segmented<ActivitySource | 'all'>
                size="sm"
                value={v.source as ActivitySource | 'all'}
                onChange={(x) => setFilter({ source: x })}
                options={SOURCES}
                ariaLabel="Which activity"
              />
            </FilterGroup>
            <FilterGroup label="User">
              <SearchField
                value={v.q}
                onChange={(x) => setFilter({ q: x })}
                placeholder="Name, email or words…"
                ariaLabel="Search a user or an action"
              />
            </FilterGroup>
          </div>
          <div className={ROW}>
            <FilterGroup label="Dates">
              <DateRangeFilter
                preset={preset}
                from={v.from}
                to={v.to}
                onChange={(d) =>
                  setFilter(d.preset === 'custom' ? { date: d.preset, from: d.from, to: d.to } : { date: d.preset, from: '', to: '' })
                }
              />
            </FilterGroup>
          </div>
        </FilterPanel>
        {chips.length > 0 && <ActiveFilters items={chips} onClearAll={f.clear} />}
      </div>

      {!data ? (
        <DataState loading={loading} error={error} onRetry={reload} label="activity" />
      ) : (
        <>
          <div
            key={[v.source, v.q, v.date, v.from, v.to, page].join('|')}
            className={`animate-[fadeup_0.35s_ease-out] transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}
            aria-busy={loading}
          >
            <ActivityList items={data.items} />
          </div>

          {data.total > data.per_page && (
            <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
              <span>
                {first.toLocaleString()}–{last.toLocaleString()} of {data.total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => f.set('page', String(page - 1))}
                  className="min-h-9 rounded-btn border border-border bg-surface px-3.5 font-semibold text-text cursor-pointer enabled:hover:border-accent-line disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Newer
                </button>
                <span className="font-mono text-[11.5px]">
                  {page} / {pages}
                </span>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => f.set('page', String(page + 1))}
                  className="min-h-9 rounded-btn border border-border bg-surface px-3.5 font-semibold text-text cursor-pointer enabled:hover:border-accent-line disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Older
                </button>
              </div>
            </nav>
          )}

          <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
            <Info size={14} className="mt-0.5 flex-none text-faint" />
            <span>
              Users’ own actions are recorded from Nov 23, 2026, admin actions from Nov 11, 2026 and sign-ins from Oct 14,
              2026. Passwords, API keys and contact details are never written here — only that they changed. Each user’s
              full story (with invoices and trades) is the Timeline tab on their profile.
            </span>
          </p>
        </>
      )}
    </AdminLayout>
  )
}
