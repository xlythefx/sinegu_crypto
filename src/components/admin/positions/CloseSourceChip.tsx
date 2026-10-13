import { Hand } from 'lucide-react'
import type { CloseSource } from '../../../types/admin'

/** The plain-English "what this means", shared by every admin surface that
 *  shows a close made outside the bot (the chip, the Needs attention card). */
export const OUTSIDE_CLOSE_EXPLAINED =
  'Closed on the exchange without the bot — by the customer, their own take-profit/stop-loss, or a liquidation. The next signal treats that account as empty.'

const TOOLTIP =
  'Closed on the exchange without the bot (by the customer, their own take-profit/stop-loss, or a liquidation), so the next signal treats this account as empty and opens a fresh first entry.'

/**
 * Admin-only tag for a closed trade that the bot did not close. Calm amber
 * (accent tokens), never red: it explains a fresh first entry, it is not an
 * error. Renders nothing for a bot close or an unjudged one (null / absent),
 * so a clean table stays clean.
 */
export default function CloseSourceChip({ source }: { source: CloseSource | undefined }) {
  if (source !== 'outside') return null
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill border border-accent-line bg-accent-soft px-2 py-0.5 font-body text-[10.5px] font-bold leading-[15px] text-accent"
      title={TOOLTIP}
    >
      <Hand size={11} className="flex-none" aria-hidden="true" />
      Closed outside the bot
    </span>
  )
}
