import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Percent, TrendingUp, Zap } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import MetricCards from '../../components/admin/strategy-detail/MetricCards'
import EquityCurveCard from '../../components/admin/strategy-detail/EquityCurveCard'
import WinLossCard from '../../components/admin/strategy-detail/WinLossCard'
import RollingCard from '../../components/admin/strategy-detail/RollingCard'
import ConcentrationCard from '../../components/admin/strategy-detail/ConcentrationCard'
import SeasonalityCard from '../../components/admin/strategy-detail/SeasonalityCard'
import HeatmapAssetsCard from '../../components/admin/strategy-detail/HeatmapAssetsCard'
import TradesTable from '../../components/admin/strategy-detail/TradesTable'
import { useApiData } from '../../hooks/useApiData'
import { getStrategies } from '../../services/admin'
import { ApiError } from '../../services/api'
import {
  computeStrategyDetail,
  groupTradesByStrategy,
} from '../../lib/strategyStats'
import { fmtSignedMoney } from '../../lib/format'

const BACK_BTN =
  'inline-flex items-center gap-[7px] mb-3.5 py-2 px-[13px] border border-border rounded-field bg-surface text-muted text-[13px] font-semibold cursor-pointer transition-colors hover:bg-accent-soft hover:border-accent-line hover:text-accent'
const BADGE =
  'inline-flex items-center gap-1.5 py-[7px] px-3 rounded-pill text-[13px] font-bold font-mono'
const BADGE_OUTLINE = 'border border-border bg-surface2 text-text'
const EMPTY_PAGE =
  'mt-2 py-[30px] px-4 border border-dashed border-border rounded-row bg-surface2 text-center text-[13px] text-muted'

export default function AdminStrategyDetail() {
  const { key = '' } = useParams<{ key: string }>()
  const decodedKey = decodeURIComponent(key)
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApiData(getStrategies)
  const [assetFilter, setAssetFilter] = useState<string | null>(null)

  const stats = useMemo(() => {
    if (!data) return null
    const grouped = groupTradesByStrategy(data.trades)
    const trades = grouped.get(decodedKey)
    if (!trades || trades.length === 0) return null
    return computeStrategyDetail(decodedKey, trades)
  }, [data, decodedKey])

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
        <button type="button" className={BACK_BTN} onClick={back}>
          <ArrowLeft size={16} /> Back to Strategies
        </button>
        <div className={EMPTY_PAGE}>
          No trades found for strategy “{decodedKey}”.
        </div>
      </AdminLayout>
    )
  }

  const pf = stats.profitFactor === null ? '∞' : stats.profitFactor.toFixed(2)

  return (
    <AdminLayout title={decodedKey} subtitle="In-depth strategy performance.">
      <button type="button" className={BACK_BTN} onClick={back}>
        <ArrowLeft size={16} /> Back to Strategies
      </button>

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
            {stats.totalTrades.toLocaleString()} closed trades · Binance · PF {pf}
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

      <MetricCards stats={stats} />

      <div className="grid gap-4 mb-4 grid-cols-[2fr_1fr] max-[1000px]:grid-cols-1">
        <EquityCurveCard equitySeries={stats.equitySeries} />
        <WinLossCard stats={stats} />
      </div>

      <div className="grid gap-4 mb-4 grid-cols-2 max-[1000px]:grid-cols-1">
        <RollingCard rolling={stats.rolling} />
        <ConcentrationCard stats={stats} />
      </div>

      <SeasonalityCard stats={stats} />

      <HeatmapAssetsCard stats={stats} onOpenAsset={setAssetFilter} />

      <TradesTable
        trades={stats.trades}
        assets={stats.byAsset}
        assetFilter={assetFilter}
        onAssetFilter={setAssetFilter}
      />
    </AdminLayout>
  )
}
