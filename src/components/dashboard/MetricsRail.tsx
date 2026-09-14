import { fmtSignedMoney } from '../../lib/format'
import type { DashboardMetrics, FeeSummary } from '../../types/dashboard'
import PnlBreakdown from '../ui/PnlBreakdown'

interface MetricsRailProps {
  metrics: DashboardMetrics
  fees?: FeeSummary
}

/** The 6-cell metrics rail: P&L · Win Rate · Profit Factor · Expectancy ·
 *  Max Drawdown · Sharpe, with hairline dividers. Every figure is the
 *  strategy's result BEFORE exchange fees; the P&L cell shows the after-fees
 *  figure on hover. */
export default function MetricsRail({ metrics, fees }: MetricsRailProps) {
  const feesSince = fees && fees.trades_without_fee > 0 ? fees.since : null
  const cells = [
    {
      label: 'P&L before fees',
      value: fmtSignedMoney(metrics.gross_pnl, 0),
      tone: metrics.gross_pnl >= 0 ? 'pos' : 'neg',
      breakdown: { gross: metrics.gross_pnl, net: metrics.net_pnl },
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
          {'breakdown' in c && c.breakdown ? (
            <PnlBreakdown gross={c.breakdown.gross} net={c.breakdown.net} feesSince={feesSince}>
              <span
                className={`font-mono text-[17px] font-extrabold${c.tone === 'pos' ? ' text-green' : c.tone === 'neg' ? ' text-red' : ''}`}
              >
                {c.value}
              </span>
            </PnlBreakdown>
          ) : (
            <span
              className={`font-mono text-[17px] font-extrabold${c.tone === 'pos' ? ' text-green' : c.tone === 'neg' ? ' text-red' : ''}`}
            >
              {c.value}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
