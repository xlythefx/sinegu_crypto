import { Navigate } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import EquityHeroCard from '../components/dashboard/EquityHeroCard'
import MetricsRail from '../components/dashboard/MetricsRail'
import EquityByGroupCard from '../components/dashboard/EquityByGroupCard'
import HighWaterMarkCard from '../components/dashboard/HighWaterMarkCard'
import CommissionsCard from '../components/dashboard/CommissionsCard'
import DailyPnlCalendar from '../components/dashboard/DailyPnlCalendar'
import PnlBreakdownCard from '../components/dashboard/PnlBreakdownCard'
import AssetStrip from '../components/dashboard/AssetStrip'
import { useApiData } from '../hooks/useApiData'
import { useSessionUser } from '../hooks/useSessionUser'
import { getDashboardSummary } from '../services/dashboard'
import { ApiError } from '../services/api'

export default function Dashboard() {
  const { data, loading, error, reload } = useApiData(getDashboardSummary)
  const sessionUser = useSessionUser()

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  return (
    <DashboardLayout title="Trading Dashboard">
      {data ? (
        <>
          <EquityHeroCard
            equity={data.equity}
            realizedPnl={data.realized_pnl}
            unrealizedPnl={data.unrealized_pnl}
            totalPnl={data.total_pnl}
            pctBase={data.pct_base}
            curve={data.equity_curve}
            // Only an explicit false shows the empty state — undefined means a
            // stale stored session and must render the normal connected card.
            connected={sessionUser?.has_exchange_account !== false}
          />
          <MetricsRail metrics={data.metrics} />

          <div className="flex gap-stack mb-stack flex-wrap">
            <EquityByGroupCard
              assets={data.by_asset}
              strategies={data.by_strategy}
            />
            <div className="w-[344px] max-w-[344px] grow basis-[300px] flex flex-col gap-stack max-[900px]:max-w-none max-[900px]:w-full">
              <HighWaterMarkCard value={data.hwm} />
              <CommissionsCard
                total={data.commissions.total}
                rows={data.commissions.rows}
              />
            </div>
          </div>

          <div className="flex gap-stack mb-stack flex-wrap">
            <DailyPnlCalendar balance={data.equity} />
            <div className="w-[344px] max-w-[344px] grow basis-[300px] flex flex-col gap-stack max-[900px]:max-w-none max-[900px]:w-full">
              <PnlBreakdownCard
                breakdown={data.pnl_breakdown}
                pctBase={data.pct_base}
              />
            </div>
          </div>

          <AssetStrip assets={data.by_asset} />
        </>
      ) : (
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="dashboard"
        />
      )}
    </DashboardLayout>
  )
}
