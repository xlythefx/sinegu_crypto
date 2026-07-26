import { LayoutGrid } from 'lucide-react'
import { fmtMoney } from '../../../lib/format'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

const R = 66
const CIRC = 2 * Math.PI * R

const CARD = 'rounded-card border border-border bg-surface p-card'
const TITLE_ROW = 'flex items-center gap-2.5 mb-3.5'
const CHIP =
  'w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'

const TILE_BASE = 'p-2.5 rounded-[11px] text-center'
const TILE_LABEL =
  'block text-[9.5px] font-bold tracking-[0.4px] uppercase text-faint mb-[3px]'

/** Win/Loss donut + avg win/loss + streak tiles. */
export default function WinLossCard({ stats }: { stats: StrategyDetailStats }) {
  const total = stats.wins + stats.losses
  const winFrac = total > 0 ? stats.wins / total : 0
  const winLen = winFrac * CIRC

  return (
    <section
      className={`${CARD} flex flex-col`}
      data-aos="fade-up"
      data-aos-delay="50"
    >
      <div className={TITLE_ROW}>
        <span className={CHIP}>
          <LayoutGrid size={16} />
        </span>
        <div>
          <div className={CARD_TITLE}>Win / Loss</div>
          <div className={CARD_SUB}>Trade outcome distribution</div>
        </div>
      </div>

      <div className="relative w-[170px] mx-auto mt-1 mb-3.5">
        <svg viewBox="0 0 160 160" className="w-full block">
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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-extrabold tracking-[-0.5px] font-mono">
            {total}
          </span>
          <span className="text-[10px] font-bold tracking-[0.6px] uppercase text-faint">
            trades
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 mb-3.5 text-[12px] font-bold">
        <span className="flex-1 h-2 rounded-[4px] bg-surface2 overflow-hidden">
          <span
            className="block h-full rounded-[4px] bg-green"
            style={{ width: `${stats.winrate}%` }}
          />
        </span>
        <span className="font-mono text-green">{stats.winrate.toFixed(0)}%</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div
          className={`${TILE_BASE} border bg-[color-mix(in_srgb,var(--green)_9%,transparent)] border-[color-mix(in_srgb,var(--green)_24%,transparent)]`}
        >
          <span className={TILE_LABEL}>Avg Win</span>
          <b className="text-[15px] font-extrabold text-green">
            +{fmtMoney(stats.avgWin).slice(1)}
          </b>
        </div>
        <div
          className={`${TILE_BASE} border bg-[color-mix(in_srgb,var(--red)_9%,transparent)] border-[color-mix(in_srgb,var(--red)_24%,transparent)]`}
        >
          <span className={TILE_LABEL}>Avg Loss</span>
          <b className="text-[15px] font-extrabold text-red">
            −{fmtMoney(stats.avgLoss).slice(1)}
          </b>
        </div>
        <div className={`${TILE_BASE} bg-surface2 border border-hair`}>
          <span className={TILE_LABEL}>Max Win Streak</span>
          <b className="text-[15px] font-extrabold text-green">
            {stats.maxWinStreak}
          </b>
        </div>
        <div className={`${TILE_BASE} bg-surface2 border border-hair`}>
          <span className={TILE_LABEL}>Max Loss Streak</span>
          <b className="text-[15px] font-extrabold text-red">
            {stats.maxLossStreak}
          </b>
        </div>
      </div>
    </section>
  )
}
