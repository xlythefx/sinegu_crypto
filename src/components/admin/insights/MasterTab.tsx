import { useCallback } from 'react'
import DataState from '../../dashboard/DataState'
import MasterAccountCard from '../MasterAccountCard'
import AdminStatCards from '../AdminStatCards'
import AdminPerformanceChart from '../AdminPerformanceChart'
import PerformanceBreakdown from '../PerformanceBreakdown'
import AdminPnlCalendar from '../AdminPnlCalendar'
import MaintenanceCard from '../MaintenanceCard'
import AnalyticsView from '../../analytics/AnalyticsView'
import { useApiData } from '../../../hooks/useApiData'
import { getMasterStats } from '../../../services/admin'
import { getAdminUserAnalytics, type AnalyticsFilters } from '../../../services/analytics'

/**
 * The master account: the cards the dashboard always had, then the full
 * Performance Analytics page for the master's own login (risk, drawdown,
 * Sharpe, monthly, day of week, capital flow) — read through the admin
 * endpoint, so it is the same computation the master sees, not a second one.
 */
export default function MasterTab() {
  const { data, loading, error, reload } = useApiData(getMasterStats)
  const uniId = data?.master.uni_id ?? ''

  const fetchAnalytics = useCallback(
    (query: AnalyticsFilters) => getAdminUserAnalytics(uniId, query),
    [uniId],
  )

  if (!data) {
    return (
      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        label="master account stats"
      />
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-stack mb-stack">
        <MasterAccountCard master={data.master} stats={data.stats} />
        <AdminStatCards stats={data.stats} />
      </div>

      <div className="flex flex-wrap items-stretch gap-stack mb-stack">
        <AdminPerformanceChart />
        <PerformanceBreakdown />
      </div>

      <AdminPnlCalendar />

      <h2 className="mt-8 mb-1 font-display text-[18px] font-extrabold">
        In-depth performance
      </h2>
      <p className="mb-stack text-[13px] text-muted">
        Every exchange the master trades on, before fees, with risk and return
        measured the same way the trader's own Performance Analytics page does.
      </p>
      <AnalyticsView
        fetchAnalytics={fetchAnalytics}
        sourceKey={uniId}
        showStrategyCard={false}
      />

      <div className="flex flex-wrap items-stretch gap-stack mt-stack">
        <MaintenanceCard />
      </div>
    </>
  )
}
