import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import AnalyticsFilterPanel, {
  type AnalyticsFilters,
} from '../components/analytics/AnalyticsFilterPanel'
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
import { displaySymbol } from '../lib/chart'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../components/exchanges/meta'
import type { ChipMode } from '../types/analytics'

/** Toggle one value in a Set, returning a new Set (never mutate state). */
function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (!next.delete(value)) next.add(value)
  return next
}

/** 'mexc' -> 'MEXC'; 'all' -> 'any exchange'. */
function activeExchangeLabel(exchange: string): string {
  const kind = EXCHANGE_ORDER.find((k) => k === exchange)
  return kind ? EXCHANGE_META[kind].label : 'any exchange'
}

export default function Analytics() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    exchange: 'all',
    from: '',
    to: '',
  })
  // Both chip filters open on INCLUDE: picking a ticker reads as "show me
  // this one", which is what a chip looks like it does. Exclude is the
  // deliberate second choice, one click away. (Either way no chip is selected
  // on load, so the mode changes nothing until one is.)
  const [symbols, setSymbols] = useState<Set<string>>(new Set())
  const [symbolMode, setSymbolMode] = useState<ChipMode>('include')
  const [strategies, setStrategies] = useState<Set<string>>(new Set())
  const [strategyMode, setStrategyMode] = useState<ChipMode>('include')

  // Switching mode clears the selection: the same chips would silently flip
  // meaning from "hide these three" to "show only these three".
  const changeSymbolMode = (mode: ChipMode) => {
    setSymbolMode(mode)
    setSymbols(new Set())
  }
  const changeStrategyMode = (mode: ChipMode) => {
    setStrategyMode(mode)
    setStrategies(new Set())
  }

  const clearAll = () => {
    setFilters({ exchange: 'all', from: '', to: '' })
    setSymbols(new Set())
    setStrategies(new Set())
  }

  // Stable primitives so the fetch only re-runs when the selection really
  // changed — a Set's identity changes on every toggle, sorted keys don't.
  const symbolKey = useMemo(() => [...symbols].sort().join('|'), [symbols])
  const strategyKey = useMemo(
    () => [...strategies].sort().join('|'),
    [strategies],
  )

  const { data, loading, error, reload } = useApiData(
    () =>
      getAnalytics({
        ...filters,
        symbols: [...symbols],
        symbolMode,
        strategies: [...strategies],
        strategyMode,
      }),
    [filters, symbolKey, symbolMode, strategyKey, strategyMode],
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const symbolOptions = (data?.filters.available_symbols ?? []).map((value) => ({
    value,
    label: displaySymbol(value),
  }))
  const strategyOptions = (data?.filters.available_strategies ?? []).map(
    (value) => ({ value, label: value }),
  )

  // Every metric below is server-filtered, so a filter change swaps the whole
  // block — re-mount it to replay the reveal instead of hard-cutting.
  const resultsKey = `${filters.exchange}-${filters.from}-${filters.to}-${symbolMode}:${symbolKey}-${strategyMode}:${strategyKey}`

  // Narrowing to a venue with nothing connected returns a page of legitimate
  // zeros, which reads as "the filter did nothing". Say so instead.
  const scopeLabel = activeExchangeLabel(filters.exchange)
  const noAccountsInScope =
    !!data && data.by_exchange.every((e) => e.accounts === 0)

  return (
    <DashboardLayout title="Performance Analytics">
      <div className="flex flex-col gap-stack">
        <AnalyticsFilterPanel
          filters={filters}
          onExchange={(exchange) => setFilters((f) => ({ ...f, exchange }))}
          onFrom={(from) => setFilters((f) => ({ ...f, from }))}
          onTo={(to) => setFilters((f) => ({ ...f, to }))}
          onClearDates={() => setFilters((f) => ({ ...f, from: '', to: '' }))}
          symbolOptions={symbolOptions}
          symbols={symbols}
          symbolMode={symbolMode}
          onSymbolToggle={(value) => setSymbols((s) => toggle(s, value))}
          onSymbolMode={changeSymbolMode}
          onSymbolsClear={() => setSymbols(new Set())}
          strategyOptions={strategyOptions}
          strategies={strategies}
          strategyMode={strategyMode}
          onStrategyToggle={(value) => setStrategies((s) => toggle(s, value))}
          onStrategyMode={changeStrategyMode}
          onStrategiesClear={() => setStrategies(new Set())}
          onClearAll={clearAll}
        />

        {data ? (
          <div
            key={resultsKey}
            className="flex flex-col gap-stack animate-[fadeup_0.35s_ease-out]"
          >
            {noAccountsInScope && (
              <p className="rounded-card border border-border bg-surface2 px-4 py-3 text-[13px] text-muted">
                {filters.exchange === 'all'
                  ? 'No exchange accounts connected yet — every figure below is zero until you connect one.'
                  : `No ${scopeLabel} account connected, so every figure below is zero. Pick another exchange, or connect ${scopeLabel} from Exchange Accounts.`}
              </p>
            )}
            <AnalyticsKpis
              totalReturnPct={data.total_return_pct}
              totalReturnAbs={data.total_return_abs}
              totalReturnAbsNet={data.total_return_abs_net}
              returnOnDeposit={data.return_on_deposit}
              filtered={data.filters.filtered}
              avgDailyPnl={data.avg_daily_pnl}
              avgDailyPnlNet={data.avg_daily_pnl_net}
              tradingDays={data.trading_days}
              bestDay={data.best_day}
              worstDay={data.worst_day}
              fees={data.fees}
            />

            <div className="grid grid-cols-[1.25fr_1fr] gap-stack items-stretch max-[1100px]:grid-cols-1">
              <PerformanceChartCard
                dailyPnl={data.daily_pnl}
                dailyPnlNet={data.daily_pnl_net}
                dailyCapital={data.daily_capital}
                dailyFlows={data.daily_flows}
                baseline={data.baseline}
                feesSince={data.fees.trades_without_fee > 0 ? data.fees.since : null}
              />
              <PositionDistributionCard bySymbol={data.by_symbol} />
            </div>

            <PortfolioMetricsCard
              quality={data.quality}
              risk={data.risk}
              totalReturnAbs={data.total_return_abs}
              totalReturnAbsNet={data.total_return_abs_net}
              totalReturnPct={data.total_return_pct}
              feesSince={data.fees.trades_without_fee > 0 ? data.fees.since : null}
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
          </div>
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
