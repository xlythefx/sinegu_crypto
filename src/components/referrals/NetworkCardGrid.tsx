import { Eye, Trash2 } from 'lucide-react'
import { fmtMediumDate, fmtMoney } from '../../lib/format'
import { formatMonth } from '../../lib/referrals'
import { MemberAvatar, type NetworkListProps } from './NetworkTable'
import {
  InvoicePaymentPill,
  MemberStatusPill,
  ReleaseStatusPill,
} from './status'

const ICON_BTN =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-btn bg-transparent text-muted cursor-pointer flex-none transition-[background,color] duration-150'

/** Card view of the referral network — the forced layout on mobile. */
export default function NetworkCardGrid({
  members,
  onView,
  onRemove,
}: NetworkListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {members.map((m) => (
        <div
          key={m.userUniId}
          className="rounded-card border border-border bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-2.5">
            <MemberAvatar name={m.name} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                {m.name}
              </p>
              <div className="mt-1">
                <MemberStatusPill status={m.status} />
              </div>
            </div>
            <div className="flex gap-0.5 flex-none">
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
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-row border border-hair bg-surface2 p-2.5">
              <p className="text-[10px] uppercase tracking-[0.07em] text-faint mb-1">
                Last earnings
              </p>
              <p className="font-mono text-[14px] font-semibold">
                {m.lastEarnings != null ? fmtMoney(m.lastEarnings) : '—'}
              </p>
              {m.lastEarningsMonth && (
                <p className="text-[10.5px] text-faint mt-0.5">
                  {formatMonth(m.lastEarningsMonth)}
                </p>
              )}
            </div>
            <div className="rounded-row border border-hair bg-surface2 p-2.5">
              <p className="text-[10px] uppercase tracking-[0.07em] text-faint mb-1">
                Your fee
              </p>
              <p className="font-mono text-[14px] font-semibold text-accent">
                {m.yourFee != null ? fmtMoney(m.yourFee) : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-2.5 border-t border-hair">
            <div className="flex items-center gap-1.5 flex-wrap">
              <InvoicePaymentPill status={m.paymentStatus} />
              <ReleaseStatusPill status={m.paymentReleaseStatus} />
            </div>
            <span className="text-[11px] text-faint whitespace-nowrap">
              {m.referredAt ? `Joined ${fmtMediumDate(m.referredAt)}` : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
