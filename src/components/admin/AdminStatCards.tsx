import { Activity, DollarSign, TrendingUp, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fmtNum, fmtSignedMoney } from '../../lib/format'
import type { MasterStats } from '../../types/admin'
import './AdminStatCards.css'

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
      title: 'Closed Positions',
      value: fmtNum(stats.closed_positions, 0),
      description: 'Finished positions contributing to P&L.',
      icon: Users,
    },
  ]

  return (
    <div className="astat" data-aos="fade-up" data-aos-delay="100">
      {cards.map((s) => (
        <div className="dcard astat__card" key={s.title}>
          <div className="astat__head">
            <span className="astat__title">{s.title}</span>
            <span className="dchip">
              <s.icon size={15} />
            </span>
          </div>
          <div
            className={`astat__value${
              s.tone === 'pos'
                ? ' is-pos'
                : s.tone === 'neg'
                  ? ' is-neg'
                  : ''
            }`}
          >
            {s.value}
          </div>
          <div className="astat__desc">{s.description}</div>
        </div>
      ))}
    </div>
  )
}
