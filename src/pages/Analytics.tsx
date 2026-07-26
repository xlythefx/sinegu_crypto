import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import AnalyticsFilterBar, {
  type AnalyticsFilters,
} from '../components/analytics/AnalyticsFilterBar'
import PortfolioMetricsCard from '../components/analytics/PortfolioMetricsCard'
import TradeQualityCard from '../components/analytics/TradeQualityCard'
import RiskMetricsCard from '../components/analytics/RiskMetricsCard'
import UnrealizedByExchangeCard from '../components/analytics/UnrealizedByExchangeCard'
import AnalyticsKpis from '../components/analytics/AnalyticsKpis'
import PerformanceChartCard from '../components/analytics/PerformanceChartCard'
import PositionDistributionCard from '../components/analytics/PositionDistributionCard'
import DayOfWeekCard from '../components/analytics/DayOfWeekCard'
import CapitalFlowCard from '../components/analytics/CapitalFlowCard'
import MonthlyBreakdownCard from '../components/analytics/MonthlyBreakdownCard'
import StrategyAnalysisCard from '../components/analytics/StrategyAnalysisCard'
import { useApiData } from '../hooks/useApiData'
import { getAnalytics } from '../services/analytics'
import { ApiError } from '../services/api'

export default function Analytics() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    exchange: 'all',
    from: '',
    to: '',
  })

  const { data, loading, error, reload } = useApiData(
    () => getAnalytics(filters),
    [filters],
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  return (
    <DashboardLayout title="Performance Analytics">
      <div className="flex flex-col gap-stack">
        <AnalyticsFilterBar
          filters={filters}
          onExchange={(exchange) => setFilters((f) => ({ ...f, exchange }))}
          onFrom={(from) => setFilters((f) => ({ ...f, from }))}
          onTo={(to) => setFilters((f) => ({ ...f, to }))}
          onClearDates={() => setFilters((f) => ({ ...f, from: '', to: '' }))}
        />

        {data ? (
          <>
            <AnalyticsKpis
              totalReturnPct={data.total_return_pct}
              totalReturnAbs={data.total_return_abs}
              avgDailyPnl={data.avg_daily_pnl}
              tradingDays={data.trading_days}
              bestDay={data.best_day}
              worstDay={data.worst_day}
            />

            <div className="grid grid-cols-[1.25fr_1fr] gap-stack items-stretch max-[1100px]:grid-cols-1">
              <PerformanceChartCard
                dailyPnl={data.daily_pnl}
                baseline={data.baseline}
              />
              <PositionDistributionCard bySymbol={data.by_symbol} />
            </div>

            <PortfolioMetricsCard
              quality={data.quality}
              risk={data.risk}
              totalReturnAbs={data.total_return_abs}
              totalReturnPct={data.total_return_pct}
            />
            <TradeQualityCard quality={data.quality} />
            <RiskMetricsCard
              risk={data.risk}
              totalReturnAbs={data.total_return_abs}
            />
            <UnrealizedByExchangeCard
              byExchange={data.by_exchange}
              totalUnrealized={data.total_unrealized}
            />
            <DayOfWeekCard dayOfWeek={data.day_of_week} />

            <div className="grid grid-cols-2 gap-stack items-start max-[1100px]:grid-cols-1">
              <MonthlyBreakdownCard monthly={data.monthly} />
              <CapitalFlowCard
                flows={data.flows}
                currentCapital={data.current_capital}
                baseline={data.baseline}
              />
            </div>
          </>
        ) : (
          <DataState
            loading={loading}
            error={error}
            onRetry={reload}
            label="analytics"
          />
        )}
        {/* Self-fetches the user's trades; independent of the analytics payload. */}
        <StrategyAnalysisCard />
      </div>
    </DashboardLayout>
  )
}
