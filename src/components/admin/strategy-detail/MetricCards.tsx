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

  const toneClass = (t: Tone) =>
    t === 'pos'
      ? 'text-green'
      : t === 'neg'
        ? 'text-red'
        : t === 'accent'
          ? 'text-accent'
          : ''

  return (
    <div
      className="grid grid-cols-4 gap-3 mb-4 max-[1000px]:grid-cols-2"
      data-aos="fade-up"
    >
      {cards.map((c) => (
        <div
          className="py-[14px] px-[15px] border border-border rounded-rail bg-surface"
          key={c.label}
        >
          <div className="flex items-center gap-2 mb-2 text-muted">
            <span className="flex text-accent">
              <c.icon size={15} />
            </span>
            <span className="text-[10.5px] font-bold tracking-[0.4px] uppercase">
              {c.label}
            </span>
          </div>
          <div
            className={`text-[20px] font-extrabold tracking-[-0.4px] font-mono ${toneClass(c.tone)}`}
          >
            {c.value}
          </div>
          <div className="mt-[3px] text-[10.5px] text-faint whitespace-nowrap overflow-hidden text-ellipsis">
            {c.sub}
          </div>
        </div>
      ))}
    </div>
  )
}
