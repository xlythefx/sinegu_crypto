import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import { fmtDateTime } from '../../lib/format'
import type { AdminTronClaim } from '../../types/admin'

const RESOLVE_BTN =
  'inline-flex flex-none items-center gap-[5px] rounded-pill border border-red bg-red py-1.5 px-3 text-[12px] font-bold text-white cursor-pointer transition disabled:opacity-[.55] disabled:cursor-not-allowed'

/**
 * One customer's "that payment is mine" under a Crypto Transfers row. An
 * accepted claim is history; an open DISPUTE carries the Resolve button.
 */
export function ClaimLine({
  claim,
  busy,
  onResolve,
}: {
  claim: AdminTronClaim
  busy: boolean
  onResolve: () => void
}) {
  const who = claim.owner?.name || claim.owner?.email || claim.user_id
  const when = claim.created_at ? fmtDateTime(claim.created_at) : ''
  const openDispute = claim.outcome === 'disputed' && claim.resolved_at === null

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 text-[12px]">
      {claim.outcome === 'accepted' ? (
        <CheckCircle2 size={14} className="mt-px flex-none text-green" />
      ) : (
        <ShieldAlert size={14} className={`mt-px flex-none ${openDispute ? 'text-red' : 'text-faint'}`} />
      )}
      <span className="min-w-0 flex-1 text-muted">
        <strong className="font-semibold text-text">{who}</strong>{' '}
        {claim.outcome === 'accepted'
          ? `confirmed this payment with its TXID for invoice #${claim.invoice_id}`
          : `also claimed it for invoice #${claim.invoice_id}, but it was already paying #${claim.against_invoice_id ?? '?'}`}
        {when && <span className="text-faint"> · {when}</span>}
        {claim.owner?.email && claim.owner.name && (
          <a href={`mailto:${claim.owner.email}`} className="ml-1 text-accent hover:underline">
            {claim.owner.email}
          </a>
        )}
        {claim.resolved_at && (
          <span className="block text-faint">
            Resolved {fmtDateTime(claim.resolved_at)}
            {claim.resolution_note ? ` — ${claim.resolution_note}` : ''}
          </span>
        )}
      </span>
      {openDispute && (
        <button type="button" className={RESOLVE_BTN} onClick={onResolve} disabled={busy}>
          Mark resolved
        </button>
      )}
    </li>
  )
}

/**
 * The confirmation for closing a dispute — the standard ConfirmModal's look,
 * plus the note that records what was decided (it is the only trace of who
 * really sent the money once the alarm is gone).
 */
export function ResolveDisputeModal({
  claim,
  note,
  busy,
  onNote,
  onConfirm,
  onCancel,
}: {
  claim: AdminTronClaim | null
  note: string
  busy: boolean
  onNote: (note: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!claim) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [claim, onCancel])

  if (!claim) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[3px] flex justify-center overflow-y-auto p-6 z-[1000] animate-[fadeup_0.2s_ease_both]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Mark this dispute resolved?"
    >
      <div
        className="bg-surface border border-border rounded-[20px] p-7 max-w-[460px] w-full my-auto shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both] max-[420px]:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[20px] font-extrabold tracking-[-0.02em] mb-2 text-text">
          Mark this dispute resolved?
        </h3>
        <p className="text-[14px] leading-[1.6] text-muted mb-4">
          Fix the invoices first (Invoice History): un-pay the invoice that got the wrong money and
          mark the real payer&apos;s invoice paid. This only clears the alarm on the Admin Overview.
        </p>
        <label className="block mb-[22px]">
          <span className="mb-1.5 block text-[10.5px] uppercase tracking-[0.1em] text-faint">
            What was decided (optional)
          </span>
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            maxLength={255}
            rows={3}
            placeholder={`e.g. Invoice #${claim.against_invoice_id ?? '…'}'s owner showed the withdrawal record.`}
            className="w-full resize-none rounded-[12px] border border-border bg-surface2 py-2.5 px-3 text-[13px] text-text outline-none focus:border-accent"
          />
        </label>
        <div className="flex gap-2.5 justify-end">
          <button
            type="button"
            className="text-[14px] font-semibold bg-surface2 text-text border border-border py-[11px] px-[22px] rounded-pill cursor-pointer"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="text-[14px] font-bold py-[11px] px-[22px] rounded-pill border-0 cursor-pointer bg-accent text-on-accent shadow-[0_10px_24px_var(--glow)] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Yes, resolved'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
