import { Clock, DollarSign, Send, Users } from 'lucide-react'
import { fmtMoney } from '../../../lib/format'
import type { AdminReferrer, LedgerStats } from '../../../types/referrals'

const STAT_ICON =
  'w-10 h-10 flex-shrink-0 grid place-items-center rounded-[11px] bg-surface2 border border-border'
const CARD =
  'rounded-card border border-border bg-surface p-card flex items-center gap-[13px]'
const LABEL = 'text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]'
const VALUE = 'text-[19px] font-bold text-text leading-[1.1] font-mono tabular-nums'
const SUB = 'text-[11px] text-faint mt-[3px]'

interface AffiliateStatCardsProps {
  referrers: AdminReferrer[]
  ledgerStats: LedgerStats
}

/**
 * The 4 affiliate headline cards. All figures are server-computed — this
 * component only sums per-referrer totals, never multiplies fee × pct.
 */
export default function AffiliateStatCards({
  referrers,
  ledgerStats,
}: AffiliateStatCardsProps) {
  const releasableTotal = referrers.reduce(
    (sum, r) => sum + r.releasableCommissionTotal,
    0,
  )
  const projectedTotal = referrers.reduce(
    (sum, r) => sum + r.projectedCommissionTotal,
    0,
  )
  const unpaidReferrers = referrers.filter((r) => r.hasReleasable).length

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[18px]"
      data-aos="fade-up"
    >
      <div className={CARD}>
        <span className={`${STAT_ICON} text-green`}>
          <Send size={18} />
        </span>
        <div>
          <p className={LABEL}>Fees sent</p>
          <p className={VALUE}>{ledgerStats.totalSentCount}</p>
          <p className={SUB}>{fmtMoney(ledgerStats.totalSentAmount)} total</p>
        </div>
      </div>
      <div className={CARD}>
        <span className={`${STAT_ICON} text-accent`}>
          <Clock size={18} />
        </span>
        <div>
          <p className={LABEL}>Fees yet to be released</p>
          <p className={VALUE}>{fmtMoney(releasableTotal)}</p>
          <p className={SUB}>total to release (all referrers)</p>
        </div>
      </div>
      <div className={CARD}>
        <span className={`${STAT_ICON} text-muted`}>
          <DollarSign size={18} />
        </span>
        <div>
          <p className={LABEL}>Fees left to be paid</p>
          <p className={VALUE}>{fmtMoney(projectedTotal)}</p>
          <p className={SUB}>projected on unpaid invoices</p>
        </div>
      </div>
      <div className={CARD}>
        <span className={`${STAT_ICON} text-red`}>
          <Users size={18} />
        </span>
        <div>
          <p className={LABEL}>Users still not paid</p>
          <p className={VALUE}>{unpaidReferrers}</p>
          <p className={SUB}>referrers awaiting payout</p>
        </div>
      </div>
    </div>
  )
}
