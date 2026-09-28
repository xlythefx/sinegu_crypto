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
import KeyBlockedGate from '../components/dashboard/KeyBlockedGate'
import { useApiData } from '../hooks/useApiData'
import { useSessionUser } from '../hooks/useSessionUser'
import { useExchangeFilter } from '../context/ExchangeFilterContext'
import { EXCHANGE_META } from '../components/exchanges/meta'
import { getDashboardSummary } from '../services/dashboard'
import { ApiError } from '../services/api'

/**
 * The trading dashboard. Every figure on it is computed server-side for the
 * exchange scope the top-bar pills select (`useExchangeFilter`): "All" pools
 * every connected venue, a venue narrows the whole page to it — the API reads
 * that venue's own tables, nothing is filtered in the browser.
 */
export default function Dashboard() {
  const { exchange } = useExchangeFilter()
  const { data, loading, error, reload } = useApiData(
    () => getDashboardSummary(exchange),
    [exchange],
  )
  const sessionUser = useSessionUser()

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  // Under a venue filter, "connected" is whether THIS venue has an account —
  // the summary says so; a MEXC view of a Binance-only user is an empty
  // state, not a $0.00 account. For "All", the session flag still decides
  // (only an explicit false shows the empty state — undefined means a stale
  // stored session and must render the normal connected card).
  const venueLabel = exchange === 'all' ? undefined : EXCHANGE_META[exchange].label
  const connected = data
    ? exchange === 'all'
      ? sessionUser?.has_exchange_account !== false
      : data.accounts > 0
    : true

  return (
    <DashboardLayout title="Trading Dashboard">
      {/* An account the exchange is refusing takes no trades — say so here,
          on the page people actually open, not only in settings. */}
      <KeyBlockedGate />
      {data ? (
        // Re-keyed on the scope so a filter change replays the reveal rather
        // than hard-cutting the numbers (AOS re-inits the remounted cards).
        <div
          key={exchange}
          className={`animate-[fadeup_0.35s_ease-out] transition-opacity ${
            loading ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <EquityHeroCard
            equity={data.equity}
            realizedPnl={data.realized_pnl}
            realizedPnlGross={data.realized_pnl_gross}
            unrealizedPnl={data.unrealized_pnl}
            totalPnl={data.total_pnl}
            totalPnlGross={data.total_pnl_gross}
            fees={data.fees}
            pctBase={data.pct_base}
            curve={data.equity_curve}
            connected={connected}
            emptyExchangeLabel={venueLabel}
          />
          <MetricsRail metrics={data.metrics} fees={data.fees} />

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
            <DailyPnlCalendar exchange={exchange} />
            <div className="w-[344px] max-w-[344px] grow basis-[300px] flex flex-col gap-stack max-[900px]:max-w-none max-[900px]:w-full">
              <PnlBreakdownCard
                breakdown={data.pnl_breakdown}
                net={data.pnl_breakdown_net}
                pctBase={data.pct_base}
              />
            </div>
          </div>

          <AssetStrip assets={data.by_asset} />
        </div>
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
