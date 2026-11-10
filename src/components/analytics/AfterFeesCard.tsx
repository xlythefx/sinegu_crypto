import { Receipt } from 'lucide-react'
import { fmtMediumDate, fmtMoney, fmtSignedMoney } from '../../lib/format'

interface AfterFeesCardProps {
  /** Closed-trade P&L in the view, before exchange fees (`total_realized`). */
  gross: number
  /** The same trades after fees (`total_realized_net`). */
  net: number
  /** Closed trades in the view. */
  trades: number
  /** The date filter, 'YYYY-MM-DD' or '' when open. */
  from: string
  to: string
  /** True when a ticker / strategy chip narrows the trades. */
  filtered: boolean
  /** Set when some of the trades predate the fee ledger. */
  feesSince: string | null
  /** How many of them. */
  tradesWithoutFee: number
}

const CELL = 'rounded-row border border-hair bg-surface2 px-4 py-3 flex flex-col gap-1 min-w-0'
const CELL_LABEL = 'text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase'
const CELL_ROW =
  'rounded-row border border-hair bg-surface2 px-4 py-3 flex items-center justify-between gap-3 min-w-0'
const CELL_VALUE_SM = 'font-mono text-[17px] font-extrabold tracking-[-0.3px] leading-tight'

/** "Oct 1, 2026 – Oct 31, 2026", "From Oct 1, 2026", "All time". */
function rangeLabel(from: string, to: string): string {
  if (from && to) return `${fmtMediumDate(from)} – ${fmtMediumDate(to)}`
  if (from) return `From ${fmtMediumDate(from)}`
  if (to) return `Up to ${fmtMediumDate(to)}`
  return 'All time'
}

/**
 * Admin read of one user (Dima, 2026-11-10): "how much did he make AFTER
 * Binance fees" for the dates picked, as a figure on the page rather than a
 * hover. Closed trades only, the same rows every other card measures, so it
 * matches the before-fees numbers below it. The fee line is DERIVED
 * (before − after), the one figure guaranteed to reconcile with the two it
 * sits between — same rule as `PnlBreakdown`.
 */
export default function AfterFeesCard({
  gross,
  net,
  trades,
  from,
  to,
  filtered,
  feesSince,
  tradesWithoutFee,
}: AfterFeesCardProps) {
  const fees = Math.round((gross - net) * 100) / 100
  const scope = [
    rangeLabel(from, to),
    filtered ? 'selected tickers / strategies' : null,
    `${trades.toLocaleString('en-US')} closed trade${trades === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="rounded-card p-card border border-accent-line bg-surface">
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Receipt size={16} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-[15px] font-extrabold">Profit after exchange fees</div>
          <div className="text-[12px] text-muted mt-px">{scope}</div>
        </div>
      </div>

      {/* After fees leads (owner, 2026-11-10: "priority after fees"); the
          two figures it comes from sit beside it, smaller, as the working. */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-2.5 max-[640px]:grid-cols-1">
        <div className={`${CELL} justify-center border-accent-line bg-accent-soft py-4`}>
          <span className={`${CELL_LABEL} text-accent`}>Profit after fees</span>
          <span
            className={`font-mono text-[32px] font-extrabold tracking-[-0.6px] leading-tight ${
              net < 0 ? 'text-red' : 'text-green'
            }`}
          >
            {fmtSignedMoney(net)}
          </span>
          <span className="text-[11.5px] font-semibold text-muted">What the account kept from these trades</span>
        </div>
        <div className="grid grid-rows-2 gap-2.5">
          <div className={CELL_ROW}>
            <span className={CELL_LABEL}>Before fees</span>
            <span className={`${CELL_VALUE_SM} ${gross < 0 ? 'text-red' : 'text-text'}`}>
              {fmtSignedMoney(gross)}
            </span>
          </div>
          <div className={CELL_ROW}>
            <span className={CELL_LABEL}>Exchange fees</span>
            <span className={`${CELL_VALUE_SM} text-text`}>
              {fees === 0 ? '$0.00' : `${fees > 0 ? '−' : '+'}${fmtMoney(fees)}`}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11.5px] font-semibold text-muted leading-[1.5]">
        Closed trades only — open positions are not counted until they close. Fees are what the
        exchange charged: commission on every fill plus funding while a position was held.
        {feesSince && tradesWithoutFee > 0 && (
          <>
            {' '}Fees are recorded from {fmtMediumDate(feesSince)}, so{' '}
            {tradesWithoutFee.toLocaleString('en-US')} earlier trade
            {tradesWithoutFee === 1 ? ' shows' : 's show'} the same figure before and after.
          </>
        )}
      </p>
    </section>
  )
}
