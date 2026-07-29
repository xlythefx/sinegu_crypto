import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import ExchangeBadge from '../../billing/ExchangeBadge'
import { fmtMoney } from '../../../lib/format'
import type {
  AdminMemberStatus,
  AdminReferralMember,
  ExchangeBreakdown,
  PaymentReleaseStatus,
} from '../../../types/referrals'

const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-0 px-3.5 pb-2.5 border-b border-border whitespace-nowrap'
const TD = 'py-3 px-3.5 border-b border-hair text-[13px] text-text align-middle'
const PILL =
  'inline-block text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill'

const MEMBER_PILL: Record<AdminMemberStatus, string> = {
  new: 'bg-[color-mix(in_srgb,var(--muted)_16%,transparent)] text-muted',
  active: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
  overdue: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red',
}

const MEMBER_STATUS_LABEL: Record<AdminMemberStatus, string> = {
  new: 'New',
  active: 'Active',
  overdue: 'Overdue',
}

const RELEASE_BADGE: Record<
  Exclude<PaymentReleaseStatus, 'n_a'>,
  { label: string; cls: string }
> = {
  paid: {
    label: 'Released',
    cls: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
  },
  partial: {
    label: 'Partial',
    cls: 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent',
  },
  pending: {
    label: 'Unreleased',
    cls: 'bg-[color-mix(in_srgb,var(--muted)_16%,transparent)] text-muted',
  },
}

/** Line status for one exchange row — derived from server-computed figures only. */
function breakdownStatus(b: ExchangeBreakdown): { label: string; cls: string } {
  if (b.hasOverdue)
    return { label: 'Overdue', cls: MEMBER_PILL.overdue }
  if (b.releasedCommission > 0 && b.unreleasedCommission > 0)
    return RELEASE_BADGE.partial
  if (b.unreleasedCommission > 0) return RELEASE_BADGE.pending
  if (b.releasedCommission > 0) return RELEASE_BADGE.paid
  return { label: '—', cls: 'text-faint' }
}

/**
 * "Referrals" sub-tab of an expanded referrer: one row per referred user,
 * each expandable to its per-exchange breakdown table. All money figures are
 * sums of server-provided breakdown fields.
 */
export default function ReferrerReferralsList({
  members,
}: {
  members: AdminReferralMember[]
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (members.length === 0) {
    return (
      <p className="text-[13px] text-muted text-center py-6">
        No referred users yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {members.map((m) => {
        const open = openIds.has(m.userUniId)
        const feePaid = m.breakdown.reduce((s, b) => s + b.paidFee, 0)
        const feePending = m.breakdown.reduce((s, b) => s + b.pendingFee, 0)
        const commission = m.breakdown.reduce((s, b) => s + b.paidCommission, 0)
        const releaseBadge =
          m.paymentReleaseStatus === 'n_a'
            ? null
            : RELEASE_BADGE[m.paymentReleaseStatus]

        return (
          <div
            key={m.userUniId}
            className="border border-border rounded-row bg-surface"
          >
            <button
              type="button"
              className="w-full flex items-center gap-3 flex-wrap p-3 text-left cursor-pointer"
              onClick={() => toggle(m.userUniId)}
              aria-expanded={open}
            >
              <ChevronDown
                size={15}
                className={`flex-none text-faint transition-transform duration-150 ${
                  open ? 'rotate-180' : ''
                }`}
              />
              <span className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-[13px] font-bold text-text">{m.name}</span>
                <span className={`${PILL} ${MEMBER_PILL[m.status]}`}>
                  {MEMBER_STATUS_LABEL[m.status]}
                </span>
              </span>
              <span className="ml-auto flex items-center gap-3.5 flex-wrap text-[12px] text-muted">
                <span>
                  Fee paid{' '}
                  <span className="font-mono text-text">{fmtMoney(feePaid)}</span>
                </span>
                <span>
                  Pending{' '}
                  <span className="font-mono text-text">
                    {fmtMoney(feePending)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono font-bold text-accent">
                    {fmtMoney(commission)}
                  </span>
                  {releaseBadge && (
                    <span className={`${PILL} ${releaseBadge.cls}`}>
                      {releaseBadge.label}
                    </span>
                  )}
                </span>
              </span>
            </button>

            {open && (
              <div className="border-t border-hair px-3 pb-3 pt-1 overflow-x-auto animate-[fadeup_0.35s_ease-out]">
                {m.breakdown.length === 0 ? (
                  <p className="text-[12.5px] text-muted py-3 text-center">
                    No exchange activity yet.
                  </p>
                ) : (
                  <table className="w-full border-collapse min-w-[520px]">
                    <thead>
                      <tr>
                        <th className={`${TH} pt-2.5`}>Exchange</th>
                        <th className={`${TH} pt-2.5 text-right`}>Fee paid</th>
                        <th className={`${TH} pt-2.5 text-right`}>Fee pending</th>
                        <th className={`${TH} pt-2.5 text-right`}>Commission</th>
                        <th className={`${TH} pt-2.5`}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.breakdown.map((b) => {
                        const status = breakdownStatus(b)
                        return (
                          <tr key={b.exchange}>
                            <td className={TD}>
                              <ExchangeBadge exchange={b.exchange} />
                            </td>
                            <td className={`${TD} text-right font-mono`}>
                              {fmtMoney(b.paidFee)}
                            </td>
                            <td className={`${TD} text-right font-mono`}>
                              {fmtMoney(b.pendingFee)}
                            </td>
                            <td className={`${TD} text-right font-mono text-accent`}>
                              {fmtMoney(b.paidCommission)}
                            </td>
                            <td className={TD}>
                              <span className={`${PILL} ${status.cls}`}>
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
