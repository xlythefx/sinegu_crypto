import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BarChart3, ChevronDown } from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import PnlOverview from '../components/positions/PnlOverview'
import PortfolioMetrics from '../components/positions/PortfolioMetrics'
import PositionFilters from '../components/positions/PositionFilters'
import ActivePositionsTable from '../components/positions/ActivePositionsTable'
import ClosedPositionsTable from '../components/positions/ClosedPositionsTable'
import { toActivePosition, toClosedTrade } from '../components/positions/adapters'
import type { ExchangeFilter } from '../components/positions/types'
import { useApiData } from '../hooks/useApiData'
import {
  useExchangeFilter,
  type ExchangeFilter as ExchangeScope,
} from '../context/ExchangeFilterContext'
import {
  getDashboardSummary,
  getOpenPositions,
  getPastPositions,
} from '../services/dashboard'
import { ApiError } from '../services/api'

type Tab = 'active' | 'closed'

/** Everything the positions page needs, in one parallel fetch, under the
 *  top-bar exchange scope (the API reads that venue's tables, or all). */
async function fetchPositionsData(scope: ExchangeScope) {
  const [summary, open, closed] = await Promise.all([
    getDashboardSummary(scope),
    getOpenPositions(scope),
    getPastPositions(scope),
  ])
  return { summary, open, closed }
}

export default function Positions() {
  // Two exchange controls, two jobs: the top bar decides what the API
  // returns; the facet below narrows what is already on the page.
  const { exchange: scope } = useExchangeFilter()
  const { data, loading, error, reload } = useApiData(
    () => fetchPositionsData(scope),
    [scope],
  )

  const [tab, setTab] = useState<Tab>('active')
  const [exchange, setExchange] = useState<ExchangeFilter>('all')
  const [ticker, setTicker] = useState('all')
  const [strategy, setStrategy] = useState('all')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [page, setPage] = useState(1)

  const active = useMemo(
    () => (data ? data.open.map(toActivePosition) : []),
    [data]
  )
  const closed = useMemo(
    () =>
      data
        ? data.closed.map((p) => toClosedTrade(p, data.summary.pct_base))
        : [],
    [data]
  )
  const tickers = useMemo(
    () =>
      Array.from(
        new Set([...active.map((p) => p.ticker), ...closed.map((t) => t.ticker)])
      ).sort(),
    [active, closed]
  )
  const strategies = useMemo(
    () => Array.from(new Set(closed.map((t) => t.strategy))).sort(),
    [closed]
  )

  const activeFiltered = useMemo(
    () =>
      active.filter(
        (p) =>
          (exchange === 'all' || p.exchange === exchange) &&
          (ticker === 'all' || p.ticker === ticker)
      ),
    [active, exchange, ticker]
  )

  const closedFiltered = useMemo(
    () =>
      closed.filter(
        (t) =>
          (exchange === 'all' || t.exchange === exchange) &&
          (ticker === 'all' || t.ticker === ticker) &&
          (strategy === 'all' || t.strategy === strategy)
      ),
    [closed, exchange, ticker, strategy]
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const applyFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
  }

  const clearFilters = () => {
    setExchange('all')
    setTicker('all')
    setStrategy('all')
    setPage(1)
  }

  if (!data) {
    return (
      <DashboardLayout title="Positions">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="positions"
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Positions">
      <div
        className="flex items-end justify-between gap-3 flex-wrap mb-[18px]"
        data-aos="fade-up"
      >
        <div>
          <p className="font-mono text-[11px] tracking-[0.12em] text-accent">
            TRADING ACTIVITY
          </p>
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] mt-1">
            Recent Trades
          </h1>
          <p className="text-[13px] text-muted mt-0.5">
            Live PNL, performance metrics, and a full history of your trades.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 flex-wrap ml-auto max-[640px]:w-full max-[640px]:justify-start max-[640px]:ml-0">
          <PositionFilters
            exchange={exchange}
            setExchange={applyFilter(setExchange)}
            ticker={ticker}
            setTicker={applyFilter(setTicker)}
            strategy={strategy}
            setStrategy={applyFilter(setStrategy)}
            onClear={clearFilters}
            tickers={tickers}
            strategies={strategies}
          />
          <button
            type="button"
            className="flex items-center gap-1.5 h-9 px-3 border border-border rounded-field bg-surface text-text text-[12.5px] font-semibold cursor-pointer font-body hover:border-accent-line hover:bg-accent-soft"
            onClick={() => setShowAnalytics((v) => !v)}
          >
            <BarChart3 size={14} />
            {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
            <ChevronDown
              size={14}
              className={`transition-transform duration-300${showAnalytics ? ' rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      <PnlOverview
        realized={data.summary.realized_pnl}
        unrealized={data.summary.unrealized_pnl}
        total={data.summary.total_pnl}
        pctBase={data.summary.pct_base}
      />

      {showAnalytics && (
        <PortfolioMetrics
          metrics={data.summary.metrics}
          trades={closed}
          balance={data.summary.equity}
          pctBase={data.summary.pct_base}
        />
      )}

      <div
        className="rounded-card border border-border bg-surface px-5 py-[18px]"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        <div className="flex justify-end mb-3.5">
          <div className="flex gap-[3px] bg-surface2 border border-hair rounded-seg p-1">
            {(
              [
                ['active', 'Active Positions', activeFiltered.length],
                ['closed', 'Closed Positions', closedFiltered.length],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`font-body py-[7px] px-[13px] text-[12.5px] rounded-btn border ${
                  tab === key
                    ? 'bg-surface border-border text-text font-bold'
                    : 'border-transparent bg-transparent text-muted font-semibold'
                }`}
                onClick={() => setTab(key)}
              >
                {label}
                <span className="inline-flex items-center justify-center min-w-5 h-[18px] ml-2 px-[5px] rounded-pill bg-accent-soft border border-accent-line text-accent text-[10.5px] font-semibold font-mono">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* key on the filter/tab signature re-mounts the table so it replays the
            fade-slide reveal every time the category or filters change. */}
        <div
          key={`${tab}-${exchange}-${ticker}-${strategy}-${page}`}
          className="animate-[fadeup_0.35s_ease-out]"
        >
          {tab === 'active' ? (
            <ActivePositionsTable rows={activeFiltered} />
          ) : (
            <ClosedPositionsTable
              trades={closedFiltered}
              page={page}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
