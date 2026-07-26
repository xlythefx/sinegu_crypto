import { Calendar } from 'lucide-react'
import SignedBars from './SignedBars'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

/** P&L by day of week (Mon-first) and by month of year. */
export default function SeasonalityCard({
  stats,
}: {
  stats: StrategyDetailStats
}) {
  // Reorder day-of-week to Mon..Sun for the seasonality view
  const dow = [1, 2, 3, 4, 5, 6, 0].map((i) => ({
    label: stats.dayOfWeek[i].label,
    pnl: stats.dayOfWeek[i].pnl,
  }))
  const moy = stats.months.map((m) => ({ label: m.label, pnl: m.pnl }))

  return (
    <section className="dcard" data-aos="fade-up">
      <div className="dcard__title-row">
        <span className="dchip">
          <Calendar size={16} />
        </span>
        <div>
          <div className="dcard__title">Seasonality</div>
          <div className="dcard__sub">P&L by day of week and month of year</div>
        </div>
      </div>

      <div className="asd-seasonality">
        <div>
          <p className="asd-panel-label">By day of week</p>
          <SignedBars data={dow} />
        </div>
        <div>
          <p className="asd-panel-label">By month</p>
          <SignedBars data={moy} barMax={34} />
        </div>
      </div>
    </section>
  )
}
