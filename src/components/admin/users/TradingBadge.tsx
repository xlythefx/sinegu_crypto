import type { TradingState, TradingVerdict } from '../../../types/admin'

const GREEN = 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green'
const RED = 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red'
const AMBER = 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent'
const GREY = 'bg-surface2 text-muted'

/** Green = trading, red = money or a key needs someone, amber = waiting, grey = nothing to trade. */
const TONE: Record<TradingState, string> = {
  trading: GREEN,
  paused_unpaid: RED,
  key_blocked: RED,
  below_min: AMBER,
  deposit_unknown: AMBER,
  off: GREY,
  suspended: GREY,
  demo: GREY,
  demo_only: GREY,
  disconnected: GREY,
  no_exchange: GREY,
}

/** Short words for a table cell; the full sentence is the hover. */
const SHORT: Partial<Record<TradingState, string>> = {
  paused_unpaid: 'Paused · unpaid',
  below_min: 'Below minimum',
  deposit_unknown: 'Waiting for balance',
}

/**
 * Is the bot trading for this customer — and if not, why (API
 * `Admin\CustomerStatus`). The same verdict on User Management and on the
 * profile's account cards.
 */
export default function TradingBadge({ verdict, full = false }: { verdict: TradingVerdict; full?: boolean }) {
  const label = full ? verdict.label : (SHORT[verdict.state] ?? verdict.label)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill py-[3px] px-[9px] text-[10.5px] font-bold whitespace-nowrap ${TONE[verdict.state] ?? GREY}`}
      title={verdict.label}
    >
      {verdict.state === 'trading' && <span className="h-1.5 w-1.5 rounded-full bg-green" />}
      {label}
    </span>
  )
}

