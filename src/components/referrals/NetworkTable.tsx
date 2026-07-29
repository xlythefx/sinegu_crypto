import { Eye, Trash2 } from 'lucide-react'
import { fmtMediumDate, fmtMoney } from '../../lib/format'
import { formatMonth, getInitials } from '../../lib/referrals'
import {
  InvoicePaymentPill,
  MemberStatusPill,
  ReleaseStatusPill,
} from './status'
import type { ReferralMember } from '../../types/referrals'

export interface NetworkListProps {
  /** The current page slice — pagination lives in the parent. */
  members: ReferralMember[]
  onView: (member: ReferralMember) => void
  onRemove: (member: ReferralMember) => void
}

/** Initials avatar shared by the table and the card grid. */
export function MemberAvatar({ name }: { name: string }) {
  return (
    <span className="w-9 h-9 rounded-full bg-accent-soft border border-accent-line text-accent grid place-items-center font-display text-[12px] font-extrabold flex-none">
      {getInitials(name) || '?'}
    </span>
  )
}

const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-0 px-3.5 pb-2.5 border-b border-border whitespace-nowrap'
const TD =
  'py-3.5 px-3.5 border-b border-hair text-[13px] text-text align-middle'
const ICON_BTN =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-btn bg-transparent text-muted cursor-pointer flex-none transition-[background,color] duration-150'

/** Desktop table view of the referral network. */
export default function NetworkTable({
  members,
  onView,
  onRemove,
}: NetworkListProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-[18px] overflow-x-auto">
      <table className="w-full border-collapse min-w-[860px]">
        <thead>
          <tr>
            <th className={TH}>Trader</th>
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Last earnings</th>
            <th className={`${TH} text-right`}>Your fee</th>
            <th className={TH}>Invoice</th>
            <th className={TH}>Payment release</th>
            <th className={TH}>Joined</th>
            <th className={`${TH} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userUniId}>
              <td className={TD}>
                <span className="inline-flex items-center gap-2.5">
                  <MemberAvatar name={m.name} />
                  <span className="font-semibold">{m.name}</span>
                </span>
              </td>
              <td className={TD}>
                <MemberStatusPill status={m.status} />
              </td>
              <td className={`${TD} text-right`}>
                {m.lastEarnings != null ? (
                  <>
                    <span className="font-mono font-semibold">
                      {fmtMoney(m.lastEarnings)}
                    </span>
                    {m.lastEarningsMonth && (
                      <span className="block text-[11px] text-faint mt-0.5">
                        {formatMonth(m.lastEarningsMonth)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className={`${TD} text-right`}>
                {m.yourFee != null ? (
                  <span className="font-mono font-semibold text-accent">
                    {fmtMoney(m.yourFee)}
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className={TD}>
                <InvoicePaymentPill status={m.paymentStatus} />
              </td>
              <td className={TD}>
                <ReleaseStatusPill status={m.paymentReleaseStatus} />
              </td>
              <td className={`${TD} text-muted whitespace-nowrap`}>
                {m.referredAt ? fmtMediumDate(m.referredAt) : '—'}
              </td>
              <td className={`${TD} text-right`}>
                <div className="inline-flex gap-1 justify-end">
                  <button
                    type="button"
                    className={`${ICON_BTN} hover:text-accent hover:bg-accent-soft`}
                    onClick={() => onView(m)}
                    title="View details"
                    aria-label={`View details for ${m.name}`}
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    type="button"
                    className={`${ICON_BTN} hover:text-red hover:bg-[rgba(255,90,90,0.1)]`}
                    onClick={() => onRemove(m)}
                    title="Remove from network"
                    aria-label={`Remove ${m.name} from network`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
