import { Calendar } from 'lucide-react'
import SignedBars from './SignedBars'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

const CARD = 'rounded-card border border-border bg-surface p-card'
const TITLE_ROW = 'flex items-center gap-2.5 mb-3.5'
const CHIP =
  'w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'
const PANEL_LABEL =
  'flex items-center gap-1.5 mb-2.5 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-faint'

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
    <section className={CARD} data-aos="fade-up">
      <div className={TITLE_ROW}>
        <span className={CHIP}>
          <Calendar size={16} />
        </span>
        <div>
          <div className={CARD_TITLE}>Seasonality</div>
          <div className={CARD_SUB}>P&L by day of week and month of year</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 max-[1000px]:grid-cols-1">
        <div>
          <p className={PANEL_LABEL}>By day of week</p>
          <SignedBars data={dow} />
        </div>
        <div>
          <p className={PANEL_LABEL}>By month</p>
          <SignedBars data={moy} barMax={34} />
        </div>
      </div>
    </section>
  )
}
