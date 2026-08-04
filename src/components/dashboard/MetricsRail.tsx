import { fmtSignedMoney } from '../../lib/format'
import type { DashboardMetrics } from '../../types/dashboard'

interface MetricsRailProps {
  metrics: DashboardMetrics
}

/** The 6-cell metrics rail: Net P&L · Win Rate · Profit Factor · Expectancy ·
 *  Max Drawdown · Sharpe, with hairline dividers. */
export default function MetricsRail({ metrics }: MetricsRailProps) {
  const cells = [
    {
      label: 'Net P&L',
      value: fmtSignedMoney(metrics.net_pnl, 0),
      tone: metrics.net_pnl >= 0 ? 'pos' : 'neg',
    },
    {
      label: 'Win Rate',
      value: metrics.win_rate !== null ? `${metrics.win_rate.toFixed(1)}%` : '—',
      tone: '',
    },
    {
      label: 'Profit Factor',
      value: metrics.profit_factor !== null ? metrics.profit_factor.toFixed(2) : '—',
      tone: metrics.profit_factor !== null && metrics.profit_factor >= 1 ? 'pos' : '',
    },
    {
      label: 'Expectancy',
      value: metrics.expectancy !== null ? fmtSignedMoney(metrics.expectancy) : '—',
      tone: metrics.expectancy !== null && metrics.expectancy >= 0 ? 'pos' : 'neg',
    },
    {
      label: 'Max Drawdown',
      value: `−${Math.abs(metrics.max_drawdown).toFixed(2)}%`,
      tone: 'neg',
    },
    {
      label: 'Sharpe',
      value: metrics.sharpe !== null ? metrics.sharpe.toFixed(2) : '—',
      tone: '',
    },
  ]

  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-px bg-hair border border-border rounded-rail overflow-hidden mb-stack"
      data-aos="fade-up"
      data-aos-delay="100"
    >
      {cells.map((c) => (
        <div
          className="bg-surface py-3.5 px-4 flex flex-col gap-1.5"
          key={c.label}
        >
          <span className="text-[10.5px] font-bold tracking-[0.4px] text-faint uppercase">
            {c.label}
          </span>
          <span
            className={`font-mono text-[17px] font-extrabold${c.tone === 'pos' ? ' text-green' : c.tone === 'neg' ? ' text-red' : ''}`}
          >
            {c.value}
          </span>
        </div>
      ))}
    </div>
  )
}
