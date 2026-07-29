import { useState } from 'react'
import { Check, Copy, ExternalLink, FileText, Undo2 } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { useApiData } from '../../../hooks/useApiData'
import {
  fetchProofBlob,
  getReferrerPayouts,
  undoPayout,
} from '../../../services/adminReferrals'
import { getApiErrorMessage } from '../../../services/api'
import { formatMonth, tronscanTxUrl, truncateAddress } from '../../../lib/referrals'
import { fmtDateTime, fmtMoney } from '../../../lib/format'
import type { ReleasedPayout } from '../../../types/referrals'

const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-0 px-3.5 pb-2.5 border-b border-border whitespace-nowrap'
const TD = 'py-3 px-3.5 border-b border-hair text-[13px] text-text align-middle'
const ICON_BTN =
  'inline-grid place-items-center w-7 h-7 rounded-[8px] border border-border bg-surface2 text-muted cursor-pointer transition-[border-color,color] duration-150 hover:text-text hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed'

interface ReferrerPayoutsPanelProps {
  referrerUniId: string
  /** Called after an undo so the parent can reload the overview (flags/totals change). */
  onChanged: () => void
}

/**
 * "Released payments" sub-tab — lazily fetches the referrer's payout envelopes
 * on first open (the panel only mounts when its tab is selected).
 */
export default function ReferrerPayoutsPanel({
  referrerUniId,
  onChanged,
}: ReferrerPayoutsPanelProps) {
  const { data, loading, error, reload } = useApiData(
    () => getReferrerPayouts(referrerUniId),
    [referrerUniId],
  )

  const [pendingUndo, setPendingUndo] = useState<ReleasedPayout | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [proofLoadingId, setProofLoadingId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const copyAddress = (p: ReleasedPayout) => {
    navigator.clipboard.writeText(p.payoutAddress)
    setCopiedId(p.id)
    window.setTimeout(() => {
      setCopiedId((current) => (current === p.id ? null : current))
    }, 1600)
  }

  const openProof = async (p: ReleasedPayout) => {
    setProofLoadingId(p.id)
    setActionError(null)
    try {
      const blob = await fetchProofBlob(p.id)
      window.open(URL.createObjectURL(blob))
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Unable to load the proof file.'))
    } finally {
      setProofLoadingId(null)
    }
  }

  const runUndo = async () => {
    if (!pendingUndo) return
    setActionLoading(true)
    setActionError(null)
    try {
      await undoPayout(pendingUndo.id)
      setPendingUndo(null)
      reload()
      onChanged()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Unable to remove the payout.'))
      setPendingUndo(null)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-8 text-[13px] text-muted">
        <span className="w-[18px] h-[18px] rounded-full border-2 border-border border-t-accent animate-[dstate-spin_0.8s_linear_infinite]" />
        Loading payouts…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-[13px] text-muted max-w-[380px]">
          {getApiErrorMessage(error, 'Could not load the released payments.')}
        </p>
        <button
          type="button"
          className="border border-border bg-surface2 text-text py-2 px-4 rounded-pill text-[12.5px] font-semibold cursor-pointer hover:border-accent"
          onClick={reload}
        >
          Try again
        </button>
      </div>
    )
  }

  const payouts = data ?? []

  return (
    <div>
      {actionError && (
        <p className="text-red text-[12.5px] mb-2.5" role="alert">
          {actionError}
        </p>
      )}

      {payouts.length === 0 ? (
        <p className="text-[13px] text-muted text-center py-6">
          No payouts released to this referrer yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr>
                <th className={TH}>Month</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={TH}>Payout address</th>
                <th className={TH}>TX hash</th>
                <th className={TH}>Paid at</th>
                <th className={TH}>Proof</th>
                <th className={`${TH} text-right`}>Undo</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className={TD}>
                    <span className="block font-semibold">
                      {formatMonth(p.monthYear)}
                    </span>
                    {p.itemsCount !== null && (
                      <span className="block text-[11px] text-faint">
                        {p.itemsCount} line{p.itemsCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </td>
                  <td className={`${TD} text-right font-mono font-bold`}>
                    {fmtMoney(p.totalAmount)}
                  </td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono text-[12px] text-muted">
                        {truncateAddress(p.payoutAddress)}
                      </span>
                      <button
                        type="button"
                        className={ICON_BTN}
                        onClick={() => copyAddress(p)}
                        title="Copy address"
                        aria-label="Copy payout address"
                      >
                        {copiedId === p.id ? (
                          <Check size={12} className="text-green" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </span>
                  </td>
                  <td className={TD}>
                    {p.txHash ? (
                      <a
                        href={tronscanTxUrl(p.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[12px] text-accent hover:underline"
                      >
                        {truncateAddress(p.txHash)}
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className={`${TD} text-muted whitespace-nowrap`}>
                    {p.paidAt ? fmtDateTime(p.paidAt) : '—'}
                  </td>
                  <td className={TD}>
                    {p.hasProof ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-[5px] rounded-[9px] py-1.5 px-2.5 text-[12px] font-semibold cursor-pointer border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 hover:text-text hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => openProof(p)}
                        disabled={proofLoadingId === p.id}
                      >
                        <FileText size={12} />
                        {proofLoadingId === p.id ? 'Opening…' : 'View'}
                      </button>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className={`${TD} text-right`}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-[5px] rounded-[9px] py-1.5 px-2.5 text-[12px] font-semibold cursor-pointer border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 enabled:hover:border-red enabled:hover:text-red disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setPendingUndo(p)}
                      disabled={actionLoading}
                      aria-label="Undo payout release"
                    >
                      <Undo2 size={12} /> Undo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={pendingUndo !== null}
        title="Remove payout release?"
        message={
          pendingUndo
            ? `This deletes the ${fmtMoney(pendingUndo.totalAmount)} payout record for ${formatMonth(
                pendingUndo.monthYear,
              )}. The lines it covered become releasable again.`
            : undefined
        }
        confirmLabel={actionLoading ? 'Working…' : 'Yes, remove'}
        cancelLabel="No"
        danger
        onConfirm={runUndo}
        onCancel={() => setPendingUndo(null)}
      />
    </div>
  )
}
