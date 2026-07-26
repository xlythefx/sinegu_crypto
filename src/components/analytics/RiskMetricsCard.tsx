import { Activity, Gauge, RefreshCw, Shield, TrendingDown } from 'lucide-react'
import MetricTile from './MetricTile'
import { fmtMoney, fmtSignedMoney } from '../../lib/format'
import type { RiskStats } from '../../types/analytics'

interface RiskMetricsCardProps {
  risk: RiskStats
  totalReturnAbs: number
}

/** "Risk-Adjusted Performance" — drawdown, Sharpe/Sortino, volatility tiles
 *  with hover tooltips explaining each metric. */
export default function RiskMetricsCard({
  risk,
  totalReturnAbs,
}: RiskMetricsCardProps) {
  const ddAbs = Math.abs(risk.max_drawdown_abs)
  const recovery = ddAbs > 0 ? totalReturnAbs / ddAbs : null

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
      data-aos-delay="100"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Shield size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Risk-Adjusted Performance
          </div>
          <div className="text-[12px] text-muted mt-px">
            How efficiently you generate returns relative to risk taken
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-[10px]">
        <MetricTile
          label="Max Drawdown"
          value={ddAbs > 0 ? fmtSignedMoney(-ddAbs) : fmtMoney(0)}
          tone={ddAbs > 0 ? 'neg' : ''}
          sub={
            risk.max_drawdown_pct === null
              ? undefined
              : `${Math.abs(risk.max_drawdown_pct).toFixed(2)}% from peak`
          }
          icon={TrendingDown}
          iconTone="neg"
          tooltip="Largest peak-to-trough decline in cumulative P&L. Smaller is better."
        />
        <MetricTile
          label="Recovery Factor"
          value={recovery === null ? '—' : recovery.toFixed(2)}
          tone={recovery === null ? '' : recovery >= 1 ? 'pos' : 'neg'}
          sub="Net profit ÷ drawdown"
          icon={RefreshCw}
          tooltip="Total P&L divided by max drawdown. Above 1 means profits exceed worst losses; above 3 is strong."
        />
        <MetricTile
          label="Sharpe Ratio"
          value={risk.sharpe === null ? '—' : risk.sharpe.toFixed(2)}
          tone={
            risk.sharpe === null
              ? ''
              : risk.sharpe >= 1
                ? 'pos'
                : risk.sharpe < 0
                  ? 'neg'
                  : ''
          }
          icon={Gauge}
          tooltip="Annualized return per unit of total volatility. >1 is good, >2 excellent."
        />
        <MetricTile
          label="Sortino Ratio"
          value={risk.sortino === null ? '—' : risk.sortino.toFixed(2)}
          tone={
            risk.sortino === null
              ? ''
              : risk.sortino >= 1
                ? 'pos'
                : risk.sortino < 0
                  ? 'neg'
                  : ''
          }
          icon={Gauge}
          tooltip="Like Sharpe but only penalizes downside volatility. Higher means losses are well-controlled."
        />
        <MetricTile
          label="Volatility"
          value={risk.volatility === null ? '—' : `${risk.volatility.toFixed(2)}%`}
          sub="Annualized"
          icon={Activity}
          tooltip="Standard deviation of daily returns, annualized. Measures how much equity swings around its average."
        />
        <MetricTile
          label="Risk Score"
          value={risk.risk_score === null ? '—' : risk.risk_score.toFixed(0)}
          tone={
            risk.risk_score === null
              ? ''
              : risk.risk_score >= 60
                ? 'pos'
                : risk.risk_score < 40
                  ? 'neg'
                  : ''
          }
          sub="Based on Sharpe & DD"
          icon={Shield}
          tooltip="Composite indicator: combines Sharpe ratio quality with drawdown magnitude."
        />
      </div>
    </section>
  )
}
