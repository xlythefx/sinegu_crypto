import { useMemo } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Percent, TrendingUp, Zap } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import StrategyDetailBody from '../../components/admin/strategy-detail/StrategyDetailBody'
import Segmented from '../../components/ui/filters/Segmented'
import { useApiData } from '../../hooks/useApiData'
import { getStrategies } from '../../services/admin'
import { ApiError } from '../../services/api'
import {
  computeStrategyDetail,
  groupTradesByStrategy,
  isMasterTrade,
} from '../../lib/strategyStats'
import { fmtSignedMoney } from '../../lib/format'

const BACK_BTN =
  'inline-flex items-center gap-[7px] py-2 px-[13px] border border-border rounded-field bg-surface text-muted text-[13px] font-semibold cursor-pointer transition-colors hover:bg-accent-soft hover:border-accent-line hover:text-accent'
const BADGE =
  'inline-flex items-center gap-1.5 py-[7px] px-3 rounded-pill text-[13px] font-bold font-mono'
const BADGE_OUTLINE = 'border border-border bg-surface2 text-text'
const EMPTY_PAGE =
  'mt-2 py-[30px] px-4 border border-dashed border-border rounded-row bg-surface2 text-center text-[13px] text-muted'

type OwnerScope = 'all' | 'master'

export default function AdminStrategyDetail() {
  const { key = '' } = useParams<{ key: string }>()
  const decodedKey = decodeURIComponent(key)
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApiData(getStrategies)
  // Whose trades the WHOLE page measures — in the URL so Back and a refresh
  // keep it (2026-11-19: "master only" = the strategy's own result).
  const [params, setParams] = useSearchParams()
  const scope: OwnerScope = params.get('owner') === 'master' ? 'master' : 'all'
  const setScope = (v: OwnerScope) => {
    const next = new URLSearchParams(params)
    if (v === 'master') next.set('owner', 'master')
    else next.delete('owner')
    setParams(next, { replace: true })
  }

  const strategyTrades = useMemo(
    () => (data ? (groupTradesByStrategy(data.trades).get(decodedKey) ?? []) : []),
    [data, decodedKey],
  )
  const masterCount = useMemo(
    () => strategyTrades.filter(isMasterTrade).length,
    [strategyTrades],
  )

  const stats = useMemo(() => {
    const trades = scope === 'master' ? strategyTrades.filter(isMasterTrade) : strategyTrades
    if (trades.length === 0) return null
    return computeStrategyDetail(decodedKey, trades)
  }, [strategyTrades, scope, decodedKey])

  const scopeSwitch = (
    <Segmented<OwnerScope>
      ariaLabel="Whose trades this page measures"
      value={scope}
      onChange={setScope}
      options={[
        { value: 'all', label: 'All accounts', count: strategyTrades.length, tone: 'neutral' },
        { value: 'master', label: 'Master only', count: masterCount },
      ]}
    />
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const back = () => navigate('/admin/strategies')

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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
          <button type="button" className={BACK_BTN} onClick={back}>
            <ArrowLeft size={16} /> Back to Strategies
          </button>
          {strategyTrades.length > 0 && scopeSwitch}
        </div>
        <div className={EMPTY_PAGE}>
          {scope === 'master' && strategyTrades.length > 0
            ? `The master has no closed trades on “${decodedKey}”.`
            : `No trades found for strategy “${decodedKey}”.`}
        </div>
      </AdminLayout>
    )
  }

  const pf = stats.profitFactor === null ? '∞' : stats.profitFactor.toFixed(2)

  return (
    <AdminLayout title={decodedKey} subtitle="In-depth strategy performance.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <button type="button" className={BACK_BTN} onClick={back}>
          <ArrowLeft size={16} /> Back to Strategies
        </button>
        {scopeSwitch}
      </div>

      {/* header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3.5 mb-4 p-5 border border-accent-line rounded-card bg-[linear-gradient(to_bottom_right,var(--accentSoft),var(--surface))]"
        data-aos="fade-up"
      >
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.4px] max-[560px]:text-[20px]">
            {decodedKey}
          </h1>
          <p className="mt-[3px] text-[13px] text-muted">
            {stats.totalTrades.toLocaleString()} closed trades ·{' '}
            {scope === 'master' ? 'master account only' : 'every account'} · every exchange · PF {pf}
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

      <div key={scope} className="animate-[fadeup_0.35s_ease-out]">
        <StrategyDetailBody stats={stats} ownerSwitch={scope === 'all'} />
      </div>
    </AdminLayout>
  )
}
