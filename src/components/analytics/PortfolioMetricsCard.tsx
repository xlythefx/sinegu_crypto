import { BarChart3 } from 'lucide-react'
import MetricTile from './MetricTile'
import { fmtSignedMoney, fmtSignedPct } from '../../lib/format'
import type { RiskStats, TradeQuality } from '../../types/analytics'

interface PortfolioMetricsCardProps {
  quality: TradeQuality
  risk: RiskStats
  /** Before fees. */
  totalReturnAbs: number
  totalReturnAbsNet: number
  totalReturnPct: number | null
  feesSince: string | null
}

/** "Portfolio Performance Metrics" — overall trading statistics tiles, all
 *  before exchange fees; the P&L tile shows the after-fees figure on hover. */
export default function PortfolioMetricsCard({
  quality,
  risk,
  totalReturnAbs,
  totalReturnAbsNet,
  totalReturnPct,
  feesSince,
}: PortfolioMetricsCardProps) {
  const totalTrades = quality.wins + quality.losses

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <BarChart3 size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Portfolio Performance Metrics
          </div>
          <div className="text-[12px] text-muted mt-px">
            Overall trading statistics across all assets
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-[10px]">
        <MetricTile label="Total Trades" value={`${totalTrades} Trades`} />
        <MetricTile
          label="Winrate"
          value={totalTrades > 0 ? `${quality.win_rate.toFixed(1)}%` : '—'}
          tone={totalTrades > 0 ? 'pos' : ''}
          sub={`${quality.wins}W / ${quality.losses}L`}
        />
        <MetricTile
          label="Profit Factor"
          value={
            quality.profit_factor === null
              ? '—'
              : quality.profit_factor.toFixed(2)
          }
          tone={
            quality.profit_factor === null
              ? ''
              : quality.profit_factor >= 1
                ? 'pos'
                : 'neg'
          }
        />
        <MetricTile
          label="Total P&L · before fees"
          value={fmtSignedMoney(totalReturnAbs)}
          tone={totalReturnAbs < 0 ? 'neg' : 'pos'}
          sub={totalReturnPct === null ? undefined : fmtSignedPct(totalReturnPct)}
          subTone={totalReturnPct !== null && totalReturnPct < 0 ? 'neg' : 'pos'}
          breakdown={{ gross: totalReturnAbs, net: totalReturnAbsNet, feesSince }}
        />
        <MetricTile
          label="Max Consecutive Winning Days"
          value={`${risk.best_streak} days`}
          tone="pos"
        />
        <MetricTile
          label="Max Consecutive Losing Days"
          value={`${risk.worst_streak} days`}
          tone="neg"
        />
      </div>
    </section>
  )
}
