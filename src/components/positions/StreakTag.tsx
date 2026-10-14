import { TrendingDown, TrendingUp, Layers } from 'lucide-react'
import { streakDetail, streakLabel, streakSentence } from '../../lib/streakLabel'
import type { TradeStreak } from '../../types/dashboard'

const ICON = { smaller: TrendingDown, larger: TrendingUp, same: Layers } as const

/** Under a closed trade's size: a gold pill saying streak sizing set it
 *  ("Smaller size · after 3 losses"). Gold, not red/green — those already mean
 *  direction and P&L in the same cell. Staff payloads carry the sizes, which
 *  add a faint line beneath; a customer's never do. Renders nothing for a
 *  normal-size trade. */
export default function StreakTag({ streak }: { streak?: TradeStreak | null }) {
  if (!streak) return null
  const Icon = ICON[streak.effect]
  const detail = streakDetail(streak)
  return (
    <span className="flex flex-col items-start gap-0.5 mt-1" title={streakSentence(streak)}>
      <span className="inline-flex items-center gap-1 py-[2px] px-[7px] rounded-pill border border-accent-line bg-accent-soft text-accent text-[10px] font-semibold whitespace-nowrap">
        <Icon size={11} className="flex-none" />
        {streakLabel(streak)}
      </span>
      {detail && <span className="text-[10px] font-mono text-faint whitespace-nowrap">{detail}</span>}
    </span>
  )
}
