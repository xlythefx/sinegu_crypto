import { useState } from 'react'
import MetricCards from './MetricCards'
import EquityCurveCard from './EquityCurveCard'
import WinLossCard from './WinLossCard'
import RollingCard from './RollingCard'
import ConcentrationCard from './ConcentrationCard'
import SeasonalityCard from './SeasonalityCard'
import HeatmapAssetsCard from './HeatmapAssetsCard'
import TradesTable from './TradesTable'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

/**
 * Every in-depth card for one strategy — shared by the strategy page
 * (`/admin/strategies/:key`) and the admin dashboard's Strategies tab.
 */
export default function StrategyDetailBody({ stats }: { stats: StrategyDetailStats }) {
  const [assetFilter, setAssetFilter] = useState<string | null>(null)

  return (
    <>
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
    </>
  )
}
