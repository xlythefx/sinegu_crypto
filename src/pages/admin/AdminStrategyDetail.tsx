import { useMemo, useRef } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Percent, TrendingUp, Zap } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import StrategyDetailBody from '../../components/admin/strategy-detail/StrategyDetailBody'
import StrategyFilterBar from '../../components/admin/strategy-detail/StrategyFilterBar'
import { STAGGER_REVEAL } from '../../components/admin/strategy-detail/stagger'
import { EXCHANGE_META } from '../../components/exchanges/meta'
import { useApiData } from '../../hooks/useApiData'
import { useStrategyFilters, type StrategyFilterState } from '../../hooks/useStrategyFilters'
import { getStrategies } from '../../services/admin'
import { ApiError } from '../../services/api'
import {
  computeStrategyDetail,
  groupTradesByStrategy,
  type StrategyTrade,
} from '../../lib/strategyStats'
import { coinKey, filterStrategyTrades } from '../../lib/strategyFilters'
import { dateRangeLabel } from '../../lib/dateRange'
import { displaySymbol } from '../../lib/chart'
import { fmtSignedMoney } from '../../lib/format'
import type { ExchangeKind } from '../../types/exchanges'

const BACK_BTN =
  'inline-flex items-center gap-[7px] py-2 px-[13px] border border-border rounded-field bg-surface text-muted text-[13px] font-semibold cursor-pointer transition-colors hover:bg-accent-soft hover:border-accent-line hover:text-accent'
const BADGE =
  'inline-flex items-center gap-1.5 py-[7px] px-3 rounded-pill text-[13px] font-bold font-mono'
const BADGE_OUTLINE = 'border border-border bg-surface2 text-text'
const EMPTY_PAGE =
  'mt-2 py-[30px] px-4 border border-dashed border-border rounded-row bg-surface2 text-center text-[13px] text-muted'
const CLEAR_BTN =
  'mt-3 inline-flex items-center py-2 px-3.5 border border-accent-line rounded-btn bg-accent-soft text-accent text-[12.5px] font-bold cursor-pointer transition-colors hover:bg-accent hover:text-on-accent'

const exchangeLabel = (kind: string) =>
  kind in EXCHANGE_META ? EXCHANGE_META[kind as ExchangeKind].label : kind

/** "SANTOS/USDT · Binance · master account only · This month" — what the page measures. */
function scopeLine(f: StrategyFilterState, trades: StrategyTrade[]): string {
  const coins =
    f.coins.length === 0
      ? 'every coin'
      : f.coins.length <= 3
        ? f.coins.map(displaySymbol).join(' + ')
        : `${f.coins.length} coins`
  const venue = f.exchange === 'all' ? 'every exchange' : exchangeLabel(f.exchange)
  const side = f.side === 'long' ? 'longs only' : f.side === 'short' ? 'shorts only' : null
  let who = 'every account'
  if (f.owner === 'master') who = 'master account only'
  else if (f.owner === 'customers') who = 'customers only'
  else if (f.owner === 'testers') who = 'testers only'
  else if (f.owner.startsWith('u:')) {
    who = trades.find((t) => `u:${t.uni_id}` === f.owner)?.owner_name ?? 'one account'
  }
  const parts = [coins, venue, ...(side ? [side] : []), who]
  if (f.date !== 'all') parts.push(dateRangeLabel(f.date, f.from, f.to))
  return parts.join(' · ')
}

export default function AdminStrategyDetail() {
  const { key = '' } = useParams<{ key: string }>()
  const decodedKey = decodeURIComponent(key)
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApiData(getStrategies)
  // Every filter lives in the URL — Back, a refresh and a shared link keep
  // the view (old `?owner=master` links still open "Master only").
  const filters = useStrategyFilters()
  const barRef = useRef<HTMLDivElement>(null)

  const strategyTrades = useMemo(
    () => (data ? (groupTradesByStrategy(data.trades).get(decodedKey) ?? []) : []),
    [data, decodedKey],
  )
  const { coins, exchange, side, owner, date, from, to } = filters
  const shown = useMemo(
    () => filterStrategyTrades(strategyTrades, { coins, exchange, side, owner, date, from, to }),
    // coins is a fresh array each render; its joined value is the dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strategyTrades, coins.join(','), exchange, side, owner, date, from, to],
  )
  const stats = useMemo(
    () => (shown.length === 0 ? null : computeStrategyDetail(decodedKey, shown)),
    [shown, decodedKey],
  )

  // The cards replay their reveal on a filter change — not on first load,
  // which belongs to AOS's scroll-in.
  const signature = [coins.join(','), exchange, side, owner, date, from, to].join('|')
  const firstSignature = useRef(signature)
  const changed = signature !== firstSignature.current

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const back = () => navigate('/admin/strategies')

  // A heatmap / asset-card click narrows the WHOLE page to that coin.
  const openAsset = (ticker: string) => {
    filters.setCoins([coinKey(ticker)])
    barRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const summary =
    shown.length === strategyTrades.length
      ? `${strategyTrades.length.toLocaleString()} trades`
      : `Showing ${shown.length.toLocaleString()} of ${strategyTrades.length.toLocaleString()} trades`

  const backRow = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
      <button type="button" className={BACK_BTN} onClick={back}>
        <ArrowLeft size={16} /> Back to Strategies
      </button>
    </div>
  )

  const filterBar = strategyTrades.length > 0 && (
    <div ref={barRef} className="scroll-mt-4">
      <StrategyFilterBar trades={strategyTrades} filters={filters} summary={summary} />
    </div>
  )

  if (!data) {
    return (
      <AdminLayout title="Strategy" subtitle="In-depth strategy performance.">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="strategy"
        />
      </AdminLayout>
    )
  }

  if (!stats) {
    return (
      <AdminLayout title={decodedKey} subtitle="In-depth strategy performance.">
        {backRow}
        {filterBar}
        <div key={signature} className={`${EMPTY_PAGE} animate-[fadeup_0.35s_ease-out]`}>
          {strategyTrades.length > 0 ? (
            <>
              No closed trades on “{decodedKey}” match these filters.
              <br />
              <button type="button" className={CLEAR_BTN} onClick={filters.clear}>
                Clear all filters
              </button>
            </>
          ) : (
            `No trades found for strategy “${decodedKey}”.`
          )}
        </div>
      </AdminLayout>
    )
  }

  const pf = stats.profitFactor === null ? '∞' : stats.profitFactor.toFixed(2)

  return (
    <AdminLayout title={decodedKey} subtitle="In-depth strategy performance.">
      {backRow}
      {filterBar}

      {/* keyed on the filters: every card below replays its reveal */}
      <div key={signature} className={changed ? STAGGER_REVEAL : ''}>
        <div
          className="flex flex-wrap items-center justify-between gap-3.5 mb-4 p-5 border border-accent-line rounded-card bg-[linear-gradient(to_bottom_right,var(--accentSoft),var(--surface))]"
          data-aos="fade-up"
        >
          <div className="min-w-0">
            <h1 className="font-display text-[24px] font-extrabold tracking-[-0.4px] max-[560px]:text-[20px]">
              {decodedKey}
            </h1>
            <p className="mt-[3px] text-[13px] text-muted">
              {stats.totalTrades.toLocaleString()} closed trades · {scopeLine(filters, strategyTrades)} · PF {pf}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`${BADGE} ${stats.totalPnl >= 0 ? 'bg-green text-[#052e16]' : 'bg-red text-[#450a0a]'}`}
            >
              <TrendingUp size={14} />
              {fmtSignedMoney(stats.totalPnl)}
            </span>
            <span className={`${BADGE} ${BADGE_OUTLINE}`}>
              <Percent size={14} />
              {stats.winrate.toFixed(1)}% WR
            </span>
            <span className={`${BADGE} ${BADGE_OUTLINE}`}>
              <Zap size={14} />
              Sharpe {stats.sharpe.toFixed(2)}
            </span>
          </div>
        </div>

        <StrategyDetailBody stats={stats} ownerSwitch={false} onOpenAsset={openAsset} />
      </div>
    </AdminLayout>
  )
}
