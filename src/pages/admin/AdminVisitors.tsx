import { Navigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import { DateRangeFilter, FilterGroup, FilterPanel } from '../../components/ui/filters'
import { GRID_2, GRID_3 } from '../../components/admin/insights/parts'
import { SECTION } from '../../components/admin/tradeLogs/tradeLogClasses'
import VisitorTiles from '../../components/admin/visitors/VisitorTiles'
import SpamFilterStrip from '../../components/admin/visitors/SpamFilterStrip'
import VisitorChart from '../../components/admin/visitors/VisitorChart'
import {
  FunnelCard,
  HeardAboutCard,
  InvitesCard,
  SourcesCard,
} from '../../components/admin/visitors/VisitorJourneyCards'
import { CountriesCard, DevicesCard, PagesCard } from '../../components/admin/visitors/VisitorAudienceCards'
import VisitorLogToolbar from '../../components/admin/visitors/VisitorLogToolbar'
import VisitorLog from '../../components/admin/visitors/VisitorLog'
import { useApiData } from '../../hooks/useApiData'
import { useVisitorFilters } from '../../hooks/useVisitorFilters'
import { fmtMediumDate } from '../../lib/format'
import { getVisitorLog, getVisitorSummary } from '../../services/adminVisitors'
import { ApiError } from '../../services/api'

const TITLE = 'Visitors'
const SUBTITLE =
  'Who opens the public website, where they come from and how many sign up. Bots, spam, refreshes and our own team are left out.'
const PER_PAGE = 25

const REFRESH_BTN =
  'inline-flex items-center gap-[6px] rounded-[9px] py-[7px] px-3 text-[12px] font-semibold cursor-pointer border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 disabled:opacity-50 enabled:hover:text-text enabled:hover:border-accent'

/**
 * Admin → Visitors (every staff role, IP included — owner, 2026-10-28).
 * The period at the top scopes everything; the cards describe the whole
 * period, and the visitor log below has its own filters on top of it.
 * Counting rules and the spam filter live in the API (VisitRecorder);
 * this page only reads.
 */
export default function AdminVisitors() {
  const f = useVisitorFilters()
  const offset = (f.page - 1) * PER_PAGE

  const summary = useApiData(() => getVisitorSummary(f.range.from, f.range.to), [f.rangeKey])
  const log = useApiData(() => getVisitorLog(f.logFilters, PER_PAGE, offset), [f.logKey, offset])

  const refresh = () => {
    summary.reload()
    log.reload()
  }
  const refreshing = summary.loading || log.loading

  if (summary.error instanceof ApiError && summary.error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const s = summary.data
  const periodLabel = s
    ? s.range.from === s.range.to
      ? fmtMediumDate(s.range.from)
      : `${fmtMediumDate(s.range.from)} – ${fmtMediumDate(s.range.to)}`
    : undefined
  const logSummary = log.data
    ? `${log.data.pagination.total.toLocaleString()} ${log.data.pagination.total === 1 ? 'page view' : 'page views'}`
    : undefined

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      <FilterPanel
        className="mb-stack"
        activeCount={f.datePreset !== '30d' ? 1 : 0}
        onClearAll={() => f.setMany({ date: '30d', from: '', to: '' })}
        summary={periodLabel}
      >
        <FilterGroup label="Period">
          <DateRangeFilter
            preset={f.datePreset}
            from={f.from}
            to={f.to}
            onChange={(next) => f.setMany({ date: next.preset, from: next.from, to: next.to })}
          />
        </FilterGroup>
        <button type="button" onClick={refresh} disabled={refreshing} className={`${REFRESH_BTN} self-start sm:ml-auto sm:self-center`}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} />
          Refresh
        </button>
      </FilterPanel>

      {s ? (
        // Re-keyed on the period: a new window replays the reveal.
        <div
          key={f.rangeKey}
          className={`flex flex-col gap-stack animate-[fadeup_0.35s_ease-out] transition-opacity duration-150 ${summary.loading ? 'opacity-60' : ''}`}
        >
          <VisitorTiles totals={s.totals} />
          <SpamFilterStrip summary={s} />
          <div className={GRID_2}>
            <VisitorChart summary={s} />
            <FunnelCard funnel={s.funnel} />
          </div>
          <div className={GRID_3}>
            <SourcesCard sources={s.sources} />
            <InvitesCard codes={s.referral_codes} campaigns={s.campaigns} />
            <HeardAboutCard answers={s.heard_about} />
          </div>
          <div className={GRID_3}>
            <PagesCard pages={s.pages} />
            <CountriesCard countries={s.countries} />
            <DevicesCard devices={s.devices} browsers={s.browsers} systems={s.systems} />
          </div>
        </div>
      ) : (
        <DataState loading={summary.loading} error={summary.error} onRetry={summary.reload} label="visitor numbers" />
      )}

      <div className="mt-8 mb-3" data-aos="fade-up">
        <h2 className="m-0 font-display text-[18px] font-extrabold">Visitor log</h2>
        <p className="m-0 mt-1 text-[12.5px] text-muted">
          Every page view, newest first. Click an IP address to see all its visits and any account that signed up from it.
        </p>
      </div>
      <VisitorLogToolbar
        filters={f}
        pages={log.data?.options.pages ?? []}
        countries={log.data?.options.countries ?? []}
        summary={logSummary}
      />
      <section className={SECTION}>
        {log.data ? (
          <div
            key={`${f.logKey}-${f.page}`}
            className={`animate-[fadeup_0.35s_ease-out] transition-opacity duration-150 ${log.loading ? 'opacity-60' : ''}`}
          >
            <VisitorLog
              data={log.data}
              page={f.page}
              perPage={PER_PAGE}
              onPage={f.setPage}
              onIp={f.focusIp}
              anyFilterActive={f.logActive}
              onClear={f.clearLog}
            />
          </div>
        ) : (
          <DataState loading={log.loading} error={log.error} onRetry={log.reload} label="visitor log" />
        )}
      </section>
    </AdminLayout>
  )
}
