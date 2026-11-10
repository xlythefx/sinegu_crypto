import { useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import DataState from '../dashboard/DataState'
import AnalyticsFilterPanel, {
  type AnalyticsFilters,
} from './AnalyticsFilterPanel'
import PortfolioMetricsCard from './PortfolioMetricsCard'
import TradeQualityCard from './TradeQualityCard'
import RiskMetricsCard from './RiskMetricsCard'
import UnrealizedByExchangeCard from './UnrealizedByExchangeCard'
import AnalyticsKpis from './AnalyticsKpis'
import AfterFeesCard from './AfterFeesCard'
import PerformanceChartCard from './PerformanceChartCard'
import PositionDistributionCard from './PositionDistributionCard'
import DayOfWeekCard from './DayOfWeekCard'
import CapitalFlowCard from './CapitalFlowCard'
import MonthlyBreakdownCard from './MonthlyBreakdownCard'
import StrategyAnalysisCard from './StrategyAnalysisCard'
import AnalyticsSkeleton from './AnalyticsSkeleton'
import Dimmable from './Dimmable'
import Capturable from '../ui/Capturable'
import { useApiData } from '../../hooks/useApiData'
import type { AnalyticsFilters as AnalyticsQuery } from '../../services/analytics'
import { ApiError } from '../../services/api'
import { displaySymbol } from '../../lib/chart'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../exchanges/meta'
import type { Analytics, ChipMode, DayExtreme } from '../../types/analytics'
import type { Invoice } from '../../lib/billing'

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

interface AnalyticsViewProps {
  /** The request behind every figure — the trader's own, or an admin's read of one user. */
  fetchAnalytics: (query: AnalyticsQuery) => Promise<Analytics>
  /** Changes whenever `fetchAnalytics` points at different data (e.g. the uni_id). */
  sourceKey?: string
  /** Strategy Analysis self-fetches the SIGNED-IN user's trades, so only their own page shows it. */
  showStrategyCard?: boolean
  /**
   * Adds a "Download as PNG" button to every card, footed with this name
   * (the admin's read of one user). Absent on the trader's own page, which
   * then renders exactly as before.
   */
  capture?: { name: string }
  /**
   * The admin's read of one user (2026-11-10; owner: "priority after fees"):
   * a "Profit after exchange fees" card on top, and every money KPI, the
   * monthly / weekday bars and each coin's P&L lead AFTER exchange fees, with
   * before fees in the hover. Adds the month-by-month table. The trader's own
   * page keeps before fees as the headline.
   */
  showAfterFees?: boolean
  /**
   * The user's invoices (every exchange). The monthly table then shows each
   * month's bill beside its profit; narrowed here to the exchange in view.
   */
  invoices?: Invoice[]
  /** Opens one invoice's "how this bill was worked out". */
  onOpenInvoice?: (invoice: Invoice) => void
}

/** The best and worst day AFTER fees — the API picks them before fees, and on
 *  an after-fees page the two can be different days. */
function netExtremes(gross: Record<string, number>, net: Record<string, number>) {
  let best: DayExtreme | null = null
  let worst: DayExtreme | null = null
  for (const [date, pnlNet] of Object.entries(net)) {
    const day = { date, pnl: gross[date] ?? pnlNet, pnl_net: pnlNet }
    if (best === null || pnlNet > best.pnl_net) best = day
    if (worst === null || pnlNet < worst.pnl_net) worst = day
  }
  return { best, worst }
}

const pct2 = (n: number) => Math.round(n * 100) / 100

/**
 * The whole Performance Analytics page body (filters + every card), shared by
 * the trader's `/dashboard/analytics` and the admin dashboard's Master
 * Account tab, so both render one computation of the same payload.
 */
export default function AnalyticsView({
  fetchAnalytics,
  sourceKey = '',
  showStrategyCard = true,
  capture,
  showAfterFees = false,
  invoices,
  onOpenInvoice,
}: AnalyticsViewProps) {
  /** Wrap one card in the screenshot control — only when `capture` is set. */
  const cap = (title: string, card: ReactNode) =>
    capture ? (
      <Capturable name={title} subject={capture.name}>
        {card}
      </Capturable>
    ) : (
      card
    )

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
      fetchAnalytics({
        ...filters,
        symbols: [...symbols],
        symbolMode,
        strategies: [...strategies],
        strategyMode,
      }),
    [sourceKey, filters, symbolKey, symbolMode, strategyKey, strategyMode],
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

  // Narrowing to a venue with nothing connected returns a page of legitimate
  // zeros, which reads as "the filter did nothing". Say so instead.
  const scopeLabel = activeExchangeLabel(filters.exchange)
  const noAccountsInScope =
    !!data && data.by_exchange.every((e) => e.accounts === 0)
  // Nothing closed in this exchange / date / ticker selection: every
  // trade-derived card would be dashes and $0.00, so those are tinted down.
  const noTrades = !!data && data.trading_days === 0
  const noFlows = !!data && Object.keys(data.daily_flows).length === 0
  // A filter change keeps the current figures on screen until the new ones
  // arrive, faded, rather than blanking the page to a spinner.
  const refreshing = loading && !!data

  // After-fees twins the payload does not carry ready-made. Both percentages
  // use the API's own denominators (Total Return: net money put in; Return
  // on Deposit: money deposited), so they differ from the before-fees ones
  // only by the fees.
  const extremes = showAfterFees && data ? netExtremes(data.daily_pnl, data.daily_pnl_net) : null
  const totalReturnPctNet =
    data && data.baseline > 0 ? pct2((data.total_return_abs_net / data.baseline) * 100) : null
  const returnOnDepositPctNet =
    data && data.return_on_deposit.deposits > 0
      ? pct2((data.return_on_deposit.realized_net / data.return_on_deposit.deposits) * 100)
      : null
  const invoicesInView =
    invoices === undefined
      ? undefined
      : filters.exchange === 'all'
        ? invoices
        : invoices.filter((i) => i.exchange === filters.exchange)

  return (
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
        // Deliberately not re-keyed or animated on a filter change: the
        // figures update in place, so clicking a filter never replays a reveal.
        <div
          className={`relative flex flex-col gap-stack transition-opacity duration-200 ${
            refreshing ? 'opacity-60' : ''
          }`}
          aria-busy={refreshing || undefined}
        >
          {refreshing && (
            <span className="pointer-events-none absolute left-1/2 -top-2 z-10 -translate-x-1/2 inline-flex items-center gap-2 rounded-pill border border-accent-line bg-surface px-3 py-1 text-[11.5px] font-bold text-accent shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
              <span className="h-3 w-3 rounded-full border-2 border-accent-line border-t-accent animate-spin" />
              Updating…
            </span>
          )}
          {noAccountsInScope ? (
            <p className="rounded-card border border-border bg-surface2 px-4 py-3 text-[13px] text-muted">
              {filters.exchange === 'all'
                ? 'No exchange accounts connected yet — every figure below is zero until you connect one.'
                : `No ${scopeLabel} account connected, so every figure below is zero. Pick another exchange, or connect ${scopeLabel} from Exchange Accounts.`}
            </p>
          ) : (
            noTrades && (
              <p className="rounded-card border border-border bg-surface2 px-4 py-3 text-[13px] text-muted">
                No closed trades in this view, so the trade figures below are dimmed.
                Widen the dates or clear a ticker or strategy filter.
              </p>
            )
          )}
          {showAfterFees && (
            <Dimmable dim={noTrades}>
              {cap(
                'Profit after exchange fees',
                <AfterFeesCard
                  gross={data.total_realized}
                  net={data.total_realized_net}
                  trades={data.fees.trades_with_fee + data.fees.trades_without_fee}
                  from={filters.from}
                  to={filters.to}
                  filtered={data.filters.filtered}
                  feesSince={data.fees.trades_without_fee > 0 ? data.fees.since : null}
                  tradesWithoutFee={data.fees.trades_without_fee}
                />,
              )}
            </Dimmable>
          )}
          <Dimmable dim={noTrades}>
            {cap(
              'Key Metrics',
              <AnalyticsKpis
                totalReturnPct={data.total_return_pct}
                totalReturnAbs={data.total_return_abs}
                totalReturnAbsNet={data.total_return_abs_net}
                returnOnDeposit={data.return_on_deposit}
                filtered={data.filters.filtered}
                avgDailyPnl={data.avg_daily_pnl}
                avgDailyPnlNet={data.avg_daily_pnl_net}
                tradingDays={data.trading_days}
                bestDay={extremes ? extremes.best : data.best_day}
                worstDay={extremes ? extremes.worst : data.worst_day}
                fees={data.fees}
                afterFees={showAfterFees}
                totalReturnPctNet={totalReturnPctNet}
                returnOnDepositPctNet={returnOnDepositPctNet}
              />,
            )}
          </Dimmable>

          <div className="grid grid-cols-[1.25fr_1fr] gap-stack items-stretch max-[1100px]:grid-cols-1">
            {/* Its Deposits & Withdrawals tab has something to show even
                without a trade, so it dims only when both are empty. */}
            <Dimmable dim={noTrades && noFlows}>
              {cap(
                'Performance Analytics',
                <PerformanceChartCard
                  dailyPnl={data.daily_pnl}
                  dailyPnlNet={data.daily_pnl_net}
                  dailyCapital={data.daily_capital}
                  dailyFlows={data.daily_flows}
                  dailyBalance={data.daily_balance}
                  dailyUnrecordedFees={data.daily_unrecorded_fees}
                  initialDeposit={data.initial_deposit}
                  dailyReturns={data.daily_returns}
                  filtered={data.filters.filtered}
                  refreshing={refreshing}
                  baseline={data.baseline}
                  feesSince={data.fees.trades_without_fee > 0 ? data.fees.since : null}
                />,
              )}
            </Dimmable>
            <Dimmable dim={noTrades}>
              {cap(
                'Position Distribution by Asset',
                <PositionDistributionCard bySymbol={data.by_symbol} afterFees={showAfterFees} />,
              )}
            </Dimmable>
          </div>

          <Dimmable dim={noTrades} className="gap-stack">
            {cap(
              'Portfolio Performance Metrics',
              <PortfolioMetricsCard
                quality={data.quality}
                risk={data.risk}
                totalReturnAbs={data.total_return_abs}
                totalReturnAbsNet={data.total_return_abs_net}
                totalReturnPct={data.total_return_pct}
                feesSince={data.fees.trades_without_fee > 0 ? data.fees.since : null}
              />,
            )}
            {cap('Trade Quality Metrics', <TradeQualityCard quality={data.quality} />)}
            {cap(
              'Risk-Adjusted Performance',
              <RiskMetricsCard risk={data.risk} totalReturnAbs={data.total_return_abs} />,
            )}
          </Dimmable>
          {/* Open positions, not closed trades — dims only with no account. */}
          <Dimmable dim={noAccountsInScope}>
            {cap(
              'Unrealized P&L by Exchange',
              <UnrealizedByExchangeCard
                byExchange={data.by_exchange}
                totalUnrealized={data.total_unrealized}
              />,
            )}
          </Dimmable>
          <Dimmable dim={noTrades}>
            {cap(
              'Performance by Day of Week',
              <DayOfWeekCard dayOfWeek={data.day_of_week} afterFees={showAfterFees} />,
            )}
          </Dimmable>

          <div className="grid grid-cols-2 gap-stack items-start max-[1100px]:grid-cols-1">
            <Dimmable dim={noTrades}>
              {cap(
                'Monthly Performance Breakdown',
                <MonthlyBreakdownCard
                  monthly={data.monthly}
                  afterFees={showAfterFees}
                  showTable={showAfterFees}
                  invoices={invoicesInView}
                  onOpenInvoice={onOpenInvoice}
                />,
              )}
            </Dimmable>
            <Dimmable dim={noAccountsInScope && noFlows}>
              {cap(
                'Capital Flow Summary',
                <CapitalFlowCard
                  flows={data.flows}
                  currentCapital={data.current_capital}
                  initialDeposit={data.initial_deposit}
                />,
              )}
            </Dimmable>
          </div>
        </div>
      ) : loading ? (
        <AnalyticsSkeleton />
      ) : (
        <DataState
          loading={false}
          error={error}
          onRetry={reload}
          label="analytics"
        />
      )}
      {/* Self-fetches the user's trades; independent of the analytics payload. */}
      {showStrategyCard && <StrategyAnalysisCard />}
    </div>
  )
}
