import { useState } from 'react'
import { Check, Copy, ExternalLink, Inbox } from 'lucide-react'
import DataState from '../dashboard/DataState'
import { PayoutStatusPill } from './status'
import { fmtMediumDate, fmtMoney } from '../../lib/format'
import { formatMonth, tronscanTxUrl, truncateAddress } from '../../lib/referrals'
import type { ReleasedPayout } from '../../types/referrals'

interface ReleasedPaymentsTableProps {
  /** null until first fetch resolves (lazy tab — fetched on first activation). */
  payouts: ReleasedPayout[] | null
  loading: boolean
  error: unknown
  onRetry: () => void
}

const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-0 px-3.5 pb-2.5 border-b border-border whitespace-nowrap'
const TD =
  'py-3.5 px-3.5 border-b border-hair text-[13px] text-text align-middle whitespace-nowrap'

/** The caller's released payout envelopes (Released payments tab). */
export default function ReleasedPaymentsTable({
  payouts,
  loading,
  error,
  onRetry,
}: ReleasedPaymentsTableProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null)

  if (!payouts) {
    return (
      <DataState
        loading={loading}
        error={error}
        onRetry={onRetry}
        label="released payments"
      />
    )
  }

  if (payouts.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-surface flex flex-col items-center text-center py-12 px-6">
        <Inbox size={44} className="text-faint mb-3.5" />
        <h3 className="text-[17px] font-bold mb-1.5">No released payments yet</h3>
        <p className="text-[13px] text-muted max-w-[380px] leading-[1.55]">
          Released monthly payouts will appear here once processed.
        </p>
      </div>
    )
  }

  const handleCopy = (id: number, text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    window.setTimeout(
      () => setCopiedId((current) => (current === id ? null : current)),
      1500,
    )
  }

  return (
    <div className="rounded-card border border-border bg-surface p-[18px] overflow-x-auto">
      <table className="w-full border-collapse min-w-[760px]">
        <thead>
          <tr>
            <th className={TH}>Month</th>
            <th className={`${TH} text-right`}>Amount</th>
            <th className={TH}>Payout address</th>
            <th className={TH}>Tx hash</th>
            <th className={TH}>Paid at</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className={`${TD} font-semibold`}>{formatMonth(p.monthYear)}</td>
              <td className={`${TD} text-right font-mono font-semibold text-accent`}>
                {fmtMoney(p.totalAmount)}
              </td>
              <td className={TD}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono text-[12px] text-muted">
                    {truncateAddress(p.payoutAddress)}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-btn bg-transparent text-muted cursor-pointer flex-none transition-[background,color] duration-150 hover:text-accent hover:bg-accent-soft"
                    onClick={() => handleCopy(p.id, p.payoutAddress)}
                    title="Copy address"
                    aria-label="Copy payout address"
                  >
                    {copiedId === p.id ? (
                      <Check size={13} className="text-green" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </span>
                <span className="block text-[10.5px] text-faint mt-0.5">
                  {p.paymentMethod === 'bank_wire' ? 'Bank wire' : 'USDT (TRC20)'}
                </span>
              </td>
              <td className={TD}>
                {p.txHash ? (
                  <a
                    href={tronscanTxUrl(p.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[12px] text-accent hover:underline"
                    title="View on Tronscan"
                  >
                    {truncateAddress(p.txHash)}
                    <ExternalLink size={12} className="flex-none" />
                  </a>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className={`${TD} text-muted`}>
                {p.paidAt ? fmtMediumDate(p.paidAt) : '—'}
              </td>
              <td className={TD}>
                <PayoutStatusPill status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
