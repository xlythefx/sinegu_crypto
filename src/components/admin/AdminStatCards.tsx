import { Activity, DollarSign, TrendingUp, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fmtNum, fmtSignedMoney } from '../../lib/format'
import type { MasterStats } from '../../types/admin'

interface Stat {
  title: string
  value: string
  description: string
  icon: LucideIcon
  tone?: 'pos' | 'neg'
}

interface AdminStatCardsProps {
  stats: MasterStats['stats']
}

/** The 4 master-account stat cards. */
export default function AdminStatCards({ stats }: AdminStatCardsProps) {
  const cards: Stat[] = [
    {
      title: 'Total Closed P&L',
      value: fmtSignedMoney(stats.total_closed_pnl),
      description: 'Aggregated realised profits across all trades.',
      icon: DollarSign,
      tone: stats.total_closed_pnl < 0 ? 'neg' : 'pos',
    },
    {
      title: 'Trades Executed',
      value: fmtNum(stats.trades_executed, 0),
      description: 'Total number of closed trades.',
      icon: TrendingUp,
    },
    {
      title: 'Active Positions',
      value: fmtNum(stats.active_positions, 0),
      description: 'Currently open positions for master account.',
      icon: Activity,
    },
    {
      title: 'Unrealized P&L',
      value: fmtSignedMoney(stats.unrealized_pnl),
      description: 'Live P&L across the open positions above.',
      icon: Wallet,
      tone: stats.unrealized_pnl < 0 ? 'neg' : 'pos',
    },
  ]

  return (
    <div
      className="grid grid-cols-2 gap-stack grow-[2] basis-[480px] max-[700px]:grid-cols-1"
      data-aos="fade-up"
      data-aos-delay="100"
    >
      {cards.map((s) => (
        <div
          className="rounded-card border border-border bg-surface flex flex-col gap-2 py-[18px] px-5"
          key={s.title}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-bold text-muted">{s.title}</span>
            <span className="w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none">
              <s.icon size={15} />
            </span>
          </div>
          <div
            className={`font-mono text-[24px] font-extrabold${
              s.tone === 'pos'
                ? ' text-green'
                : s.tone === 'neg'
                  ? ' text-red'
                  : ''
            }`}
          >
            {s.value}
          </div>
          <div className="text-[11.5px] leading-[1.5] text-faint">
            {s.description}
          </div>
        </div>
      ))}
    </div>
  )
}
