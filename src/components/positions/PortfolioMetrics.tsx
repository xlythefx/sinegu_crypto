import { fmtMoney, fmtSignedMoney } from '../../lib/format'
import type { DashboardMetrics } from '../../types/dashboard'
import type { ClosedTrade } from './types'

interface Tile {
  label: string
  value: string
  hint?: string
  tone?: 'pos' | 'neg' | 'accent'
}

interface PortfolioMetricsProps {
  metrics: DashboardMetrics
  trades: ClosedTrade[]
  balance: number
  pctBase: number
}

/** Collapsible analytics grid: 12 portfolio metric tiles. */
export default function PortfolioMetrics({
  metrics,
  trades,
  balance,
  pctBase,
}: PortfolioMetricsProps) {
  const wins = trades.filter((t) => t.pnl > 0)
  const losses = trades.filter((t) => t.pnl < 0)
  const avgWin = wins.length
    ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length
    : 0
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0)) / losses.length
    : 0
  const largestWin = wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0
  const largestLoss = losses.length
    ? Math.abs(Math.min(...losses.map((t) => t.pnl)))
    : 0
  const netPct = pctBase > 0 ? (metrics.net_pnl / pctBase) * 100 : 0

  const tiles: Tile[] = [
    {
      label: 'Total Trades',
      value: String(metrics.trades),
      hint: `${wins.length}W · ${losses.length}L`,
    },
    {
      label: 'Winrate',
      value: metrics.win_rate !== null ? `${metrics.win_rate.toFixed(1)}%` : '—',
      hint: `${wins.length}W / ${losses.length}L`,
      tone: 'pos',
    },
    {
      label: 'Profit Factor',
      value:
        metrics.profit_factor !== null ? metrics.profit_factor.toFixed(2) : '—',
      hint: 'Wins ÷ Losses',
      tone: metrics.profit_factor !== null && metrics.profit_factor >= 1 ? 'pos' : 'neg',
    },
    {
      label: 'Total P&L',
      value: fmtSignedMoney(metrics.net_pnl),
      hint: `${netPct >= 0 ? '+' : '−'}${Math.abs(netPct).toFixed(2)}% of deposits`,
      tone: metrics.net_pnl >= 0 ? 'pos' : 'neg',
    },
    {
      label: 'Max Drawdown',
      value: `${Math.abs(metrics.max_drawdown).toFixed(2)}%`,
      hint: 'Peak-to-trough equity',
      tone: 'neg',
    },
    {
      label: 'Avg Win',
      value: fmtMoney(avgWin),
      hint: 'Per winning trade',
      tone: 'pos',
    },
    {
      label: 'Avg Loss',
      value: fmtMoney(avgLoss),
      hint: 'Per losing trade',
      tone: 'neg',
    },
    {
      label: 'Largest Win',
      value: fmtMoney(largestWin),
      hint: 'Best single trade',
      tone: 'pos',
    },
    {
      label: 'Largest Loss',
      value: fmtMoney(largestLoss),
      hint: 'Worst single trade',
      tone: 'neg',
    },
    {
      label: 'Risk : Reward',
      value: metrics.avg_rr !== null ? `${metrics.avg_rr.toFixed(2)}×` : '—',
      hint: 'Avg win ÷ avg loss',
      tone: 'pos',
    },
    {
      label: 'Expectancy',
      value:
        metrics.expectancy !== null ? fmtSignedMoney(metrics.expectancy) : '—',
      hint: 'Expected per trade',
      tone: metrics.expectancy !== null && metrics.expectancy >= 0 ? 'pos' : 'neg',
    },
    {
      label: 'Balance',
      value: fmtMoney(balance),
      hint: 'Total across exchanges',
    },
  ]

  const toneClass: Record<NonNullable<Tile['tone']>, string> = {
    pos: 'text-green',
    neg: 'text-red',
    accent: 'text-accent',
  }

  return (
    <div className="grid grid-cols-6 gap-3 mb-4 max-[1100px]:grid-cols-3 max-[900px]:grid-cols-2">
      {tiles.map((t) => (
        <div
          className="rounded-card border border-border bg-surface flex flex-col gap-1 py-3.5 px-4"
          key={t.label}
        >
          <span className="text-[10.5px] font-bold tracking-[0.05em] uppercase text-faint">
            {t.label}
          </span>
          <span
            className={`text-[17px] font-extrabold font-mono${t.tone ? ` ${toneClass[t.tone]}` : ''}`}
          >
            {t.value}
          </span>
          {t.hint && <span className="text-[11px] text-muted">{t.hint}</span>}
        </div>
      ))}
    </div>
  )
}
