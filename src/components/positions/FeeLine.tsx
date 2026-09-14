import type { FeeSource } from '../../types/dashboard'
import { Pill } from '../ui/Pill'

/**
 * The "net of $X fees" sub-line under a closed trade's P&L, with an "est."
 * tag while the fee is still the estimate rather than the exchange's own
 * receipts (minutes, normally; forever for a position opened before the fee
 * ledger existed or one whose fees were paid in BNB).
 *
 * Why this figure is smaller than the raw trade profit: the exchange's
 * commission and funding are already out of it, which is what makes the row
 * agree with the Binance app. A negative fee is a funding CREDIT larger than
 * the commission — it reads as an addition, never as "net of −$0.30".
 *
 * Customers only ever see the amount and "est."; the words actual / manual
 * belong to admin screens.
 */
export default function FeeLine({
  fee,
  source,
  align = 'start',
}: {
  fee: number | null
  source: FeeSource
  align?: 'start' | 'end'
}) {
  if (fee === null) return null
  const credit = fee < 0
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10.5px] text-faint font-mono pt-0.5 ${
        align === 'end' ? 'justify-end' : ''
      }`}
    >
      {credit
        ? `incl. $${Math.abs(fee).toFixed(2)} funding credit`
        : `net of $${fee.toFixed(2)} fees`}
      {source === 'estimated' && (
        <Pill tone="muted" size="xs" title="Estimated until the exchange's receipts are matched">
          est.
        </Pill>
      )}
    </span>
  )
}
