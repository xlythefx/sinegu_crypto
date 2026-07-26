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
import './AdminStrategyDetail.css'

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
        <button type="button" className="asd-back" onClick={back}>
          <ArrowLeft size={16} /> Back to Strategies
        </button>
        <div className="asd-empty asd-empty--page">
          No trades found for strategy “{decodedKey}”.
        </div>
      </AdminLayout>
    )
  }

  const pf = stats.profitFactor === null ? '∞' : stats.profitFactor.toFixed(2)

  return (
    <AdminLayout title={decodedKey} subtitle="In-depth strategy performance.">
      <button type="button" className="asd-back" onClick={back}>
        <ArrowLeft size={16} /> Back to Strategies
      </button>

      {/* header */}
      <div className="asd-head" data-aos="fade-up">
        <div>
          <h1 className="asd-head__title">{decodedKey}</h1>
          <p className="asd-head__sub">
            {stats.totalTrades.toLocaleString()} closed trades · Binance · PF {pf}
          </p>
        </div>
        <div className="asd-head__badges">
          <span
            className={`asd-badge ${stats.totalPnl >= 0 ? 'asd-badge--pos' : 'asd-badge--neg'}`}
          >
            <TrendingUp size={14} />
            {fmtSignedMoney(stats.totalPnl)}
          </span>
          <span className="asd-badge asd-badge--outline">
            <Percent size={14} />
            {stats.winrate.toFixed(1)}% WR
          </span>
          <span className="asd-badge asd-badge--outline">
            <Zap size={14} />
            Sharpe {stats.sharpe.toFixed(2)}
          </span>
        </div>
      </div>

      <MetricCards stats={stats} />

      <div className="asd-row asd-row--2-1">
        <EquityCurveCard equitySeries={stats.equitySeries} />
        <WinLossCard stats={stats} />
      </div>

      <div className="asd-row asd-row--1-1">
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
