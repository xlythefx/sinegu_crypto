import { Navigate } from 'react-router-dom'
import { CalendarDays, RefreshCw, X } from 'lucide-react'
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
 * Clicking a bar on the chart narrows the cards and the log to that day (or
 * week); the chart keeps the whole period so another day is one click away.
 * Counting rules and the spam filter live in the API (VisitRecorder);
 * this page only reads.
 */
export default function AdminVisitors() {
  const f = useVisitorFilters()
  const offset = (f.page - 1) * PER_PAGE

  const summary = useApiData(() => getVisitorSummary(f.range.from, f.range.to), [f.rangeKey])
  // The picked bar's own numbers; nothing to fetch while none is picked.
  const daySummary = useApiData(
    () => (f.pick ? getVisitorSummary(f.pick.from, f.pick.to) : Promise.resolve(null)),
    [f.scopeKey],
  )
  const log = useApiData(() => getVisitorLog(f.logFilters, PER_PAGE, offset), [f.logKey, offset])

  const refresh = () => {
    summary.reload()
    if (f.pick) daySummary.reload()
    log.reload()
  }
  const refreshing = summary.loading || log.loading || (f.pick !== null && daySummary.loading)

  if (summary.error instanceof ApiError && summary.error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const s = summary.data
  // What the cards describe: the picked bar when there is one, else the period.
  const cards = f.pick ? daySummary.data : s
  const cardsLoading = f.pick ? daySummary.loading : summary.loading
  const pickLabel = f.pick
    ? f.pick.from === f.pick.to
      ? fmtMediumDate(f.pick.from)
      : `${fmtMediumDate(f.pick.from)} – ${fmtMediumDate(f.pick.to)}`
    : null
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
        onClearAll={() => f.setMany({ date: '30d', from: '', to: '', day: '', day_to: '' })}
        summary={periodLabel}
      >
        <FilterGroup label="Period">
          <DateRangeFilter
            preset={f.datePreset}
            from={f.from}
            to={f.to}
            onChange={(next) => f.setMany({ date: next.preset, from: next.from, to: next.to, day: '', day_to: '' })}
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
          {pickLabel && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-accent-line bg-accent-soft px-4 py-3 text-[13px]">
              <CalendarDays size={16} className="flex-none text-accent" />
              {/* At least 260px for the words, so on a phone the button wraps below them. */}
              <span className="min-w-[min(100%,260px)] flex-1 basis-[260px]">
                <span className="font-semibold text-text">Showing {pickLabel} only.</span>{' '}
                <span className="text-muted">
                  The numbers, cards and visitor log below are for the bar you clicked; the chart still shows{' '}
                  {periodLabel ?? 'the whole period'}.
                </span>
              </span>
              <button
                type="button"
                onClick={f.clearPick}
                className={`${REFRESH_BTN} flex-none`}
              >
                <X size={13} />
                Back to the whole period
              </button>
            </div>
          )}
          {cards ? (
            // Re-keyed on the picked bar: the cards replay their reveal for the new day.
            <div
              key={`tiles-${f.scopeKey}`}
              className={`flex flex-col gap-stack animate-[fadeup_0.35s_ease-out] transition-opacity duration-150 ${cardsLoading ? 'opacity-60' : ''}`}
            >
              <VisitorTiles totals={cards.totals} />
              <SpamFilterStrip summary={cards} />
            </div>
          ) : (
            <DataState loading={daySummary.loading} error={daySummary.error} onRetry={daySummary.reload} label="that day's numbers" />
          )}
          <div className={GRID_2}>
            <VisitorChart
              summary={s}
              selected={f.pick ? f.day : null}
              onPick={f.pickDays}
              onClearPick={f.clearPick}
            />
            {cards && <FunnelCard key={f.scopeKey} funnel={cards.funnel} />}
          </div>
          {cards && (
            <div
              key={`cards-${f.scopeKey}`}
              className={`flex flex-col gap-stack animate-[fadeup_0.35s_ease-out] transition-opacity duration-150 ${cardsLoading ? 'opacity-60' : ''}`}
            >
              <div className={GRID_3}>
                <SourcesCard sources={cards.sources} />
                <InvitesCard codes={cards.referral_codes} campaigns={cards.campaigns} />
                <HeardAboutCard answers={cards.heard_about} />
              </div>
              <div className={GRID_3}>
                <PagesCard pages={cards.pages} />
                <CountriesCard countries={cards.countries} />
                <DevicesCard devices={cards.devices} browsers={cards.browsers} systems={cards.systems} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <DataState loading={summary.loading} error={summary.error} onRetry={summary.reload} label="visitor numbers" />
      )}

      <div className="mt-8 mb-3" data-aos="fade-up">
        <h2 className="m-0 font-display text-[18px] font-extrabold">Visitor log</h2>
        <p className="m-0 mt-1 text-[12.5px] text-muted">
          Every page view, newest first{pickLabel ? `, on ${pickLabel}` : ''}. Click an IP address to see all its
          visits and any account that signed up from it.
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
