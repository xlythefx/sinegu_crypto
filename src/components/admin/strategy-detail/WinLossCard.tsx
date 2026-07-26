import { LayoutGrid } from 'lucide-react'
import { fmtMoney } from '../../../lib/format'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

const R = 66
const CIRC = 2 * Math.PI * R

/** Win/Loss donut + avg win/loss + streak tiles. */
export default function WinLossCard({ stats }: { stats: StrategyDetailStats }) {
  const total = stats.wins + stats.losses
  const winFrac = total > 0 ? stats.wins / total : 0
  const winLen = winFrac * CIRC

  return (
    <section className="dcard asd-winloss" data-aos="fade-up" data-aos-delay="50">
      <div className="dcard__title-row">
        <span className="dchip">
          <LayoutGrid size={16} />
        </span>
        <div>
          <div className="dcard__title">Win / Loss</div>
          <div className="dcard__sub">Trade outcome distribution</div>
        </div>
      </div>

      <div className="asd-winloss__donut-wrap">
        <svg viewBox="0 0 160 160" className="asd-winloss__donut">
          <g transform="rotate(-90 80 80)">
            <circle
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke="var(--red)"
              strokeWidth="20"
            />
            <circle
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke="var(--green)"
              strokeWidth="20"
              strokeDasharray={`${winLen} ${CIRC - winLen}`}
            />
          </g>
        </svg>
        <div className="asd-winloss__center">
          <span className="asd-winloss__center-value mono">{total}</span>
          <span className="asd-winloss__center-label">trades</span>
        </div>
      </div>

      <div className="asd-winloss__wr">
        <span className="asd-winloss__wr-track">
          <span
            className="asd-winloss__wr-fill"
            style={{ width: `${stats.winrate}%` }}
          />
        </span>
        <span className="mono is-pos">{stats.winrate.toFixed(0)}%</span>
      </div>

      <div className="asd-winloss__grid">
        <div className="asd-winloss__tile asd-winloss__tile--pos">
          <span>Avg Win</span>
          <b className="is-pos">+{fmtMoney(stats.avgWin).slice(1)}</b>
        </div>
        <div className="asd-winloss__tile asd-winloss__tile--neg">
          <span>Avg Loss</span>
          <b className="is-neg">−{fmtMoney(stats.avgLoss).slice(1)}</b>
        </div>
        <div className="asd-winloss__tile">
          <span>Max Win Streak</span>
          <b className="is-pos">{stats.maxWinStreak}</b>
        </div>
        <div className="asd-winloss__tile">
          <span>Max Loss Streak</span>
          <b className="is-neg">{stats.maxLossStreak}</b>
        </div>
      </div>
    </section>
  )
}
