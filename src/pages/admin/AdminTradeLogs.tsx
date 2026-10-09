import { Navigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Radio, RefreshCw } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import Tabs, { type TabItem } from '../../components/ui/Tabs'
import HealthBanner from '../../components/admin/tradeLogs/HealthBanner'
import SignalStats from '../../components/admin/tradeLogs/SignalStats'
import TradeLogToolbar from '../../components/admin/tradeLogs/TradeLogToolbar'
import SignalList from '../../components/admin/tradeLogs/SignalList'
import IssuesList from '../../components/admin/tradeLogs/IssuesList'
import { SECTION } from '../../components/admin/tradeLogs/tradeLogClasses'
import { useApiData } from '../../hooks/useApiData'
import { useTradeLogFilters } from '../../hooks/useTradeLogFilters'
import { getTradeLogHealth, getTradeLogIssues, getTradeLogs } from '../../services/tradeLogs'
import { ApiError } from '../../services/api'
import type { SignalIssue } from '../../types/tradeLogs'

const TITLE = 'Signal Log'
const SUBTITLE =
  'Every signal the engine processed, with the sizing decision it made per account.'
const PER_PAGE = 10
/** The banner's window — "is anything wrong right now". */
const HEALTH_HOURS = 24

type LogView = 'signals' | 'issues'

/**
 * Admin → Signal Log: a health banner (last 24 h, whatever is filtered
 * below), then two views over the same filters — every signal with its
 * per-account fan-out, or the problems grouped by cause with where to fix
 * them. `?view=issues` holds the second; the default omits the param.
 *
 * Both views are fetched as their filters change, not when shown, so
 * switching tabs is instant and the Issues tab can carry its count.
 */
export default function AdminTradeLogs() {
  const [params, setParams] = useSearchParams()
  const view: LogView = params.get('view') === 'issues' ? 'issues' : 'signals'
  const f = useTradeLogFilters()
  const offset = (f.page - 1) * PER_PAGE

  const health = useApiData(() => getTradeLogHealth(HEALTH_HOURS), [])
  const list = useApiData(
    () => getTradeLogs({ ...f.listFilters, limit: PER_PAGE, offset }),
    [f.listKey, offset],
  )
  const issues = useApiData(() => getTradeLogIssues(f.signalFilters), [f.signalKey])

  const select = (next: LogView) =>
    setParams(
      (p) => {
        const out = new URLSearchParams(p)
        if (next === 'signals') out.delete('view')
        else out.set('view', next)
        return out
      },
      { replace: true },
    )

  const refresh = () => {
    health.reload()
    list.reload()
    issues.reload()
  }
  const refreshing = health.loading || list.loading || issues.loading

  const showSignalsFor = (issue: SignalIssue) => {
    f.focusIssue(issue.reasonKey, issue.account)
    select('signals')
  }

  if (list.error instanceof ApiError && list.error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const tabs: TabItem<LogView>[] = [
    { key: 'signals', label: 'Signals', Icon: Radio },
    { key: 'issues', label: 'Issues', Icon: AlertTriangle, badge: issues.data?.issues.length },
  ]
  const tickers = list.data?.options.tickers ?? []
  const reasons = list.data?.options.reasons ?? []

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      <HealthBanner
        data={health.data}
        loading={health.loading}
        error={health.error}
        onRetry={health.reload}
        onSeeIssues={() => select('issues')}
      />

      <div className="mb-stack flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} active={view} onChange={select} label="Signal Log views" />
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-[6px] rounded-[9px] py-[7px] px-3 text-[12px] font-semibold cursor-pointer border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 disabled:opacity-50 enabled:hover:text-text enabled:hover:border-accent"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} />
          Refresh
        </button>
      </div>

      {/* keyed re-mount replays the reveal on every view switch */}
      <div key={view} className="animate-[fadeup_0.35s_ease-out]">
        {view === 'signals' ? (
          <>
            <SignalStats summary={list.data?.summary ?? null} showSplit={!f.accountFiltersActive} />
            <section className={SECTION} data-aos="fade-up" data-aos-delay="100">
              <TradeLogToolbar view="signals" filters={f} tickers={tickers} reasons={reasons} />
              {list.data ? (
                <div
                  key={`${f.listKey}-${f.page}`}
                  className={`animate-[fadeup_0.35s_ease-out] transition-opacity duration-150 ${list.loading ? 'opacity-60' : ''}`}
                >
                  <SignalList
                    data={list.data}
                    page={f.page}
                    perPage={PER_PAGE}
                    onPage={f.setPage}
                    accountFiltersActive={f.accountFiltersActive}
                    anyFilterActive={f.signalFiltersActive || f.accountFiltersActive}
                    onClear={f.clear}
                  />
                </div>
              ) : (
                <DataState
                  loading={list.loading}
                  error={list.error}
                  onRetry={list.reload}
                  label="signal log"
                />
              )}
            </section>
          </>
        ) : (
          <section className={SECTION}>
            <TradeLogToolbar view="issues" filters={f} tickers={tickers} reasons={reasons} />
            {issues.data ? (
              <div
                key={f.signalKey}
                className={`animate-[fadeup_0.35s_ease-out] transition-opacity duration-150 ${issues.loading ? 'opacity-60' : ''}`}
              >
                <IssuesList
                  data={issues.data}
                  from={f.from}
                  to={f.to}
                  onShowSignals={showSignalsFor}
                />
              </div>
            ) : (
              <DataState
                loading={issues.loading}
                error={issues.error}
                onRetry={issues.reload}
                label="issues"
              />
            )}
          </section>
        )}
      </div>
    </AdminLayout>
  )
}
