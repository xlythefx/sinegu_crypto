import {
  BarChart3,
  DollarSign,
  Percent,
  Target,
  TrendingDown,
  Trophy,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

type Tone = 'pos' | 'neg' | 'accent' | ''

interface Card {
  label: string
  value: string
  sub: string
  tone: Tone
  icon: LucideIcon
}

/** The 7-tile metric grid at the top of the strategy detail page. */
export default function MetricCards({ stats }: { stats: StrategyDetailStats }) {
  const pf =
    stats.profitFactor === null ? '∞' : stats.profitFactor.toFixed(2)

  const cards: Card[] = [
    {
      label: 'Total P&L',
      value: fmtSignedMoney(stats.totalPnl),
      sub: `Gross win: +${fmtMoney(stats.grossWin).slice(1)}`,
      tone: stats.totalPnl >= 0 ? 'pos' : 'neg',
      icon: DollarSign,
    },
    {
      label: 'Winrate',
      value: `${stats.winrate.toFixed(1)}%`,
      sub: `${stats.wins}W / ${stats.losses}L`,
      tone: stats.winrate >= 50 ? 'pos' : 'neg',
      icon: Percent,
    },
    {
      label: 'Sharpe Ratio',
      value: stats.sharpe.toFixed(2),
      sub: stats.sharpe >= 1 ? 'Strong' : stats.sharpe >= 0 ? 'Moderate' : 'Negative',
      tone: stats.sharpe >= 1 ? 'pos' : stats.sharpe >= 0 ? 'accent' : 'neg',
      icon: Zap,
    },
    {
      label: 'Profit Factor',
      value: pf,
      sub: `Gross loss: −${fmtMoney(stats.grossLoss).slice(1)}`,
      tone: stats.profitFactor === null || stats.profitFactor >= 1 ? 'pos' : 'neg',
      icon: Target,
    },
    {
      label: 'Max Drawdown',
      value: `−${fmtMoney(stats.maxDrawdown).slice(1)}`,
      sub: `Worst trade: ${fmtSignedMoney(stats.worstTrade)}`,
      tone: 'neg',
      icon: TrendingDown,
    },
    {
      label: 'Avg Win / Loss',
      value: `+${fmtMoney(stats.avgWin).slice(1)}`,
      sub: `Avg loss: −${fmtMoney(stats.avgLoss).slice(1)}`,
      tone: 'pos',
      icon: BarChart3,
    },
    {
      label: 'Best Trade',
      value: fmtSignedMoney(stats.bestTrade),
      sub: `Max win streak: ${stats.maxWinStreak}`,
      tone: 'pos',
      icon: Trophy,
    },
  ]

  return (
    <div className="asd-metrics" data-aos="fade-up">
      {cards.map((c) => (
        <div className="asd-metric" key={c.label}>
          <div className="asd-metric__head">
            <span className="asd-metric__icon">
              <c.icon size={15} />
            </span>
            <span className="asd-metric__label">{c.label}</span>
          </div>
          <div className={`asd-metric__value mono${c.tone ? ` is-${c.tone}` : ''}`}>
            {c.value}
          </div>
          <div className="asd-metric__sub">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
