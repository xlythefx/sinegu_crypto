import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, TriangleAlert } from 'lucide-react'
import { fmtCryptoAmount, fmtMoney } from '../../lib/format'
import type { AdminTronAmountMismatch } from '../../types/admin'

interface TronAmountMismatchModalProps {
  open: boolean
  invoiceId: number | null
  detail: AdminTronAmountMismatch | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ROW =
  'flex items-baseline justify-between gap-3 py-2.5 border-b border-hair last:border-b-0 max-[430px]:flex-col max-[430px]:items-start max-[430px]:gap-0.5'
const ROW_LABEL = 'text-[11px] font-mono uppercase tracking-[0.1em] text-faint'
const ROW_VALUE = 'font-mono text-[14px] font-bold text-text'

/** "3.000000" → "3.00", "0.980000" → "0.98", never dropping a significant digit. */
function fmtUsdt(n: number): string {
  return `${fmtCryptoAmount(Math.abs(n).toFixed(6))} USDT`
}

/**
 * The second confirmation on Admin → Crypto Transfers: the amount is outside
 * the matcher's band, and the admin is about to attribute it anyway.
 *
 * Same shape as `ui/ConfirmModal` (scrim, 420px card, red confirm, Escape,
 * focus on the confirm), carried as its own piece because that modal's
 * `message` is a string and this one has three figures that must read as
 * labelled lines — stacked at phone width — before the sentence that says what
 * confirming does. Portaled into <body> for the same reason ConfirmModal is:
 * the caller sits under `data-aos` cards whose transforms would trap a fixed
 * overlay.
 */
export default function TronAmountMismatchModal({
  open,
  invoiceId,
  detail,
  busy = false,
  onConfirm,
  onCancel,
}: TronAmountMismatchModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open || !detail) return null

  const title = 'Amount does not match the invoice'
  const invoice = fmtMoney(detail.expected_usd)
  const sign = detail.direction === 'short' ? '−' : '+'

  return createPortal(
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[3px] flex justify-center overflow-y-auto p-6 z-[1001] animate-[fadeup_0.2s_ease_both]"
      onClick={() => !busy && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-surface border border-border rounded-[20px] p-7 max-w-[420px] w-full my-auto shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-2">
          <span className="grid place-items-center flex-shrink-0 w-9 h-9 rounded-[12px] border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-red">
            <TriangleAlert size={18} />
          </span>
          <h3 className="font-display text-[20px] font-extrabold tracking-[-0.02em] leading-[1.2] text-text pt-1">
            {title}
          </h3>
        </div>

        <p className="text-[13px] leading-[1.6] text-muted mb-4">
          Invoice #{invoiceId ?? '—'} and this transfer disagree by more than the
          matcher allows.
        </p>

        <dl className="rounded-[12px] border border-border bg-surface2 px-4 py-1 mb-4">
          <div className={ROW}>
            <dt className={ROW_LABEL}>Invoice</dt>
            <dd className={ROW_VALUE}>{invoice}</dd>
          </div>
          <div className={ROW}>
            <dt className={ROW_LABEL}>Received</dt>
            <dd className={ROW_VALUE}>{fmtUsdt(detail.received_usdt)}</dd>
          </div>
          <div className={ROW}>
            <dt className={ROW_LABEL}>Difference</dt>
            <dd className={`${ROW_VALUE} text-red`}>
              {sign}
              {fmtUsdt(detail.difference)}{' '}
              <span className="text-[11.5px] font-semibold text-muted">
                ({detail.direction})
              </span>
            </dd>
          </div>
        </dl>

        <p className="text-[14px] leading-[1.6] text-muted mb-[22px]">
          Attributing it marks the invoice paid in full at{' '}
          <strong className="font-mono font-bold text-text">{invoice}</strong>. Only do
          this if you know why the amount differs (exchange withdrawal fee, late
          top-up, overpayment).
        </p>

        <div className="flex gap-2.5 justify-end max-[430px]:flex-col-reverse">
          <button
            type="button"
            className="text-[14px] font-semibold bg-surface2 text-text border border-border py-[11px] px-[22px] rounded-pill cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-[430px]:w-full"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 text-[14px] font-bold py-[11px] px-[22px] rounded-pill border-0 cursor-pointer bg-red text-white shadow-[0_10px_24px_rgba(255,90,90,0.25)] disabled:opacity-60 disabled:cursor-not-allowed max-[430px]:w-full"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy && <Loader2 size={15} className="animate-[dstate-spin_0.8s_linear_infinite]" />}
            {busy ? 'Attributing…' : 'Attribute anyway'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
