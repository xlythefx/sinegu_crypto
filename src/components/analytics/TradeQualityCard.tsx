import {
  AlertTriangle,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import MetricTile from './MetricTile'
import { fmtSignedMoney } from '../../lib/format'
import type { TradeQuality } from '../../types/analytics'

interface TradeQualityCardProps {
  quality: TradeQuality
}

/** "Trade Quality Metrics" — per-trade averages, extremes and edge. */
export default function TradeQualityCard({ quality }: TradeQualityCardProps) {
  const avgLossAbs = Math.abs(quality.avg_loss)

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
      data-aos-delay="50"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Target size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Trade Quality Metrics
          </div>
          <div className="text-[12px] text-muted mt-px">
            Per-trade averages, extremes, and edge
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-[10px]">
        <MetricTile
          label="Avg Win"
          value={fmtSignedMoney(Math.abs(quality.avg_win))}
          tone="pos"
          icon={TrendingUp}
          iconTone="pos"
        />
        <MetricTile
          label="Avg Loss"
          value={fmtSignedMoney(-avgLossAbs)}
          tone="neg"
          icon={TrendingDown}
          iconTone="neg"
        />
        <MetricTile
          label="Expectancy"
          value={fmtSignedMoney(quality.expectancy)}
          tone={quality.expectancy < 0 ? 'neg' : 'pos'}
          sub="per trade"
          icon={Sparkles}
        />
        <MetricTile
          label="Largest Win"
          value={fmtSignedMoney(Math.abs(quality.largest_win))}
          tone="pos"
          icon={Trophy}
          iconTone="pos"
        />
        <MetricTile
          label="Largest Loss"
          value={fmtSignedMoney(-Math.abs(quality.largest_loss))}
          tone="neg"
          icon={AlertTriangle}
          iconTone="neg"
        />
      </div>
    </section>
  )
}
