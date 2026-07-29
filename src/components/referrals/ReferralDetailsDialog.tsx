import { useEffect } from 'react'
import { PieChart, TrendingUp, X } from 'lucide-react'
import ExchangeBadge from '../billing/ExchangeBadge'
import { BreakdownStatusPill } from './status'
import { fmtMoney, fmtSignedMoney } from '../../lib/format'
import type { ReferralMember } from '../../types/referrals'

interface ReferralDetailsDialogProps {
  /** null = closed. */
  member: ReferralMember | null
  onClose: () => void
}

const SECTION_LABEL =
  'flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] uppercase text-faint mb-2.5 [&_svg]:text-accent [&_svg]:flex-none'
const TILE = 'rounded-row border border-hair bg-surface2 p-3.5'
const TILE_LABEL = 'text-[10.5px] uppercase tracking-[0.07em] text-faint mb-1'
const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-0 px-3 pb-2 border-b border-border whitespace-nowrap'
const TD = 'py-3 px-3 border-b border-hair text-[12.5px] text-text align-middle'

function pnlClass(n: number): string {
  if (n > 0) return 'text-green'
  if (n < 0) return 'text-red'
  return 'text-text'
}

/**
 * Eye-action modal: a member's P&L, profit-share rates, and the
 * per-exchange commission breakdown (all figures server-computed).
 */
export default function ReferralDetailsDialog({
  member,
  onClose,
}: ReferralDetailsDialogProps) {
  useEffect(() => {
    if (!member) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [member, onClose])

  if (!member) return null

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center p-5 bg-[var(--bgScrim)] backdrop-blur-[4px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${member.name} — P&L & profit share`}
    >
      <div
        className="relative w-full max-w-[560px] max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-[18px] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-btn bg-transparent text-faint cursor-pointer hover:bg-surface2 hover:text-text"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h3 className="text-[17px] font-bold pr-10 mb-5">
          {member.name} — P&amp;L &amp; profit share
        </h3>

        {/* P&L */}
        <div className="mb-5">
          <p className={SECTION_LABEL}>
            <TrendingUp size={13} />
            P&amp;L
          </p>
          <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
            <div className={TILE}>
              <p className={TILE_LABEL}>Realized P&amp;L</p>
              <p
                className={`font-mono text-[18px] font-bold ${pnlClass(member.realizedPnl)}`}
              >
                {fmtSignedMoney(member.realizedPnl)}
              </p>
            </div>
            <div className={TILE}>
              <p className={TILE_LABEL}>Unrealized P&amp;L</p>
              <p
                className={`font-mono text-[18px] font-bold ${pnlClass(member.unrealizedPnl)}`}
              >
                {fmtSignedMoney(member.unrealizedPnl)}
              </p>
            </div>
          </div>
        </div>

        {/* Profit share */}
        <div className="mb-5">
          <p className={SECTION_LABEL}>
            <PieChart size={13} />
            Profit share
          </p>
          <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
            <div className={TILE}>
              <p className={TILE_LABEL}>Realized fee rate</p>
              <p className="font-mono text-[18px] font-bold text-accent">
                {member.realizedPercentage != null
                  ? `${member.realizedPercentage}%`
                  : '—'}
              </p>
            </div>
            <div className={TILE}>
              <p className={TILE_LABEL}>Unrealized fee rate</p>
              <p className="font-mono text-[18px] font-bold text-accent">
                {member.unrealizedPercentage != null
                  ? `${member.unrealizedPercentage}%`
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Per-exchange breakdown */}
        {member.breakdown.length > 0 && (
          <div>
            <p className={SECTION_LABEL}>Per-exchange breakdown</p>
            <div className="overflow-x-auto rounded-row border border-hair">
              <table className="w-full border-collapse min-w-[460px]">
                <thead>
                  <tr>
                    <th className={`${TH} pt-3`}>Exchange</th>
                    <th className={`${TH} pt-3 text-right`}>Fee paid</th>
                    <th className={`${TH} pt-3 text-right`}>Fee pending</th>
                    <th className={`${TH} pt-3 text-right`}>Commission</th>
                    <th className={`${TH} pt-3`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {member.breakdown.map((b) => (
                    <tr key={b.exchange}>
                      <td className={TD}>
                        <ExchangeBadge exchange={b.exchange} />
                      </td>
                      <td className={`${TD} text-right font-mono`}>
                        {fmtMoney(b.paidFee)}
                      </td>
                      <td className={`${TD} text-right font-mono text-muted`}>
                        {fmtMoney(b.pendingFee)}
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className="font-mono font-semibold text-accent">
                          {fmtMoney(b.paidCommission)}
                        </span>
                        {b.pendingCommission > 0 && (
                          <span className="block text-[10.5px] text-faint mt-0.5">
                            +{fmtMoney(b.pendingCommission)} pending
                          </span>
                        )}
                      </td>
                      <td className={TD}>
                        <BreakdownStatusPill breakdown={b} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
