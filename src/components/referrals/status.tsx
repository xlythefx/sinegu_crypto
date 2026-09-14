import type {
  ExchangeBreakdown,
  MemberStatus,
  PaymentReleaseStatus,
  PayoutStatus,
} from '../../types/referrals'
import { Pill, type PillTone as Tone } from '../ui/Pill'

/**
 * Status pills for the referrals feature. All labels come from server-derived
 * statuses — nothing here computes money or state, it only renders it.
 * The pill itself lives in `components/ui/Pill.tsx`.
 */

/** Plain em-dash used where a pill would be noise (no status at all). */
function Dash() {
  return <span className="text-faint">—</span>
}

const MEMBER_STATUS: Record<MemberStatus, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'green' },
  new: { label: 'New account', tone: 'muted' },
  suspended: { label: 'Suspended', tone: 'red' },
}

export function MemberStatusPill({ status }: { status: MemberStatus }) {
  const s = MEMBER_STATUS[status] ?? MEMBER_STATUS.new
  return <Pill tone={s.tone}>{s.label}</Pill>
}

/** Latest-invoice payment status: paid / pending / — (no invoice yet). */
export function InvoicePaymentPill({
  status,
}: {
  status: 'pending' | 'paid' | null
}) {
  if (status === null) return <Dash />
  return (
    <Pill tone={status === 'paid' ? 'green' : 'accent'}>
      {status === 'paid' ? 'Paid' : 'Pending'}
    </Pill>
  )
}

const RELEASE_STATUS: Record<
  PaymentReleaseStatus,
  { label: string; tone: Tone }
> = {
  n_a: { label: 'N/A', tone: 'muted' },
  paid: { label: 'Paid', tone: 'green' },
  partial: { label: 'Partially released', tone: 'accent' },
  pending: { label: 'Pending', tone: 'accent' },
}

export function ReleaseStatusPill({
  status,
}: {
  status: PaymentReleaseStatus
}) {
  const s = RELEASE_STATUS[status] ?? RELEASE_STATUS.n_a
  return <Pill tone={s.tone}>{s.label}</Pill>
}

const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: Tone }> = {
  paid: { label: 'Paid', tone: 'green' },
  pending: { label: 'Pending', tone: 'accent' },
  rejected: { label: 'Rejected', tone: 'red' },
}

export function PayoutStatusPill({ status }: { status: PayoutStatus }) {
  const s = PAYOUT_STATUS[status] ?? PAYOUT_STATUS.pending
  return <Pill tone={s.tone}>{s.label}</Pill>
}

/**
 * Per-exchange breakdown row status, derived from the server-computed flags
 * (never from money math done here): released / partial / paid / overdue /
 * pending / —.
 */
export function BreakdownStatusPill({
  breakdown,
}: {
  breakdown: ExchangeBreakdown
}) {
  if (breakdown.hasOverdue) return <Pill tone="red">Overdue</Pill>
  if (breakdown.releasedCommission > 0 && breakdown.unreleasedCommission <= 0)
    return <Pill tone="green">Released</Pill>
  if (breakdown.releasedCommission > 0)
    return <Pill tone="accent">Partially released</Pill>
  if (breakdown.paidCommission > 0) return <Pill tone="green">Paid</Pill>
  if (breakdown.pendingCommission > 0 || breakdown.pendingFee > 0)
    return <Pill tone="accent">Pending</Pill>
  return <Dash />
}
