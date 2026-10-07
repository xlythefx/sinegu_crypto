import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Loader2, X } from 'lucide-react'
import { fmtMoney } from '../../lib/format'
import type { AdminTronTransfer } from '../../types/admin'

interface TronAttributeModalProps {
  open: boolean
  transfer: AdminTronTransfer | null
  busy?: boolean
  error?: string | null
  onConfirm: (invoiceId: number) => void
  onCancel: () => void
}

const OPTION =
  'w-full text-left flex items-start gap-3 rounded-[12px] border p-3 cursor-pointer transition-[border-color,background-color] duration-150'

/**
 * Which invoice does this money belong to?
 *
 * Suggestions come from the server — invoices whose reservation matches this
 * amount, including ones that have since expired, which is the ordinary case
 * (someone paid an hour after the quote lapsed). They are a HINT: nothing here
 * settles until a human picks one, because guessing pays off the wrong
 * customer's invoice.
 */
export default function TronAttributeModal({
  open,
  transfer,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: TronAttributeModalProps) {
  const [choice, setChoice] = useState<number | null>(null)
  const [manual, setManual] = useState('')

  // Reset the pick only when a transfer is (re)opened — not on every `busy`
  // flip or `onCancel` identity change, which used to wipe a typed invoice id
  // the moment the request answered, including with the amount-mismatch
  // confirm the admin may still cancel back out of.
  useEffect(() => {
    if (!open) return
    setChoice(transfer?.suggestions[0]?.invoice_id ?? null)
    setManual('')
  }, [open, transfer])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open || !transfer) return null

  const typed = Number(manual.trim())
  const invoiceId = manual.trim() !== '' && Number.isInteger(typed) && typed > 0 ? typed : choice

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--bgScrim)] backdrop-blur-[4px] animate-[fadeup_0.2s_ease_both]">
      <div className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto rounded-[20px] border border-border bg-surface animate-[fadeup_0.28s_cubic-bezier(0.2,0.7,0.2,1)_both]">
        <header className="relative border-b border-hair p-5 pr-14">
          <h2 className="text-[16px] font-bold text-text">Attribute this payment</h2>
          <p className="text-[12px] text-muted mt-1">
            {transfer.amount} {transfer.token_symbol_reported ?? 'USDT'}
            {transfer.amount_usd != null && <> · {fmtMoney(transfer.amount_usd)}</>} received on{' '}
            {transfer.network}. Settling marks the invoice paid and re-enables the
            owner's bot.
          </p>
          <button
            type="button"
            className="absolute top-4 right-4 grid place-items-center w-8 h-8 rounded-[10px] border border-border bg-surface2 text-muted cursor-pointer hover:text-text disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </header>

        <div className="p-5 flex flex-col gap-2.5">
          {transfer.suggestions.length === 0 && (
            <p className="text-[12.5px] text-muted leading-[1.5]">
              Nothing on file matches this amount. Enter the invoice id by hand if
              you know which one it pays.
            </p>
          )}

          {transfer.suggestions.map((s) => (
            <button
              key={s.intent_id}
              type="button"
              className={`${OPTION} ${
                choice === s.invoice_id && manual.trim() === ''
                  ? 'border-accent bg-accent-soft'
                  : 'border-border bg-surface2 hover:border-accent'
              }`}
              onClick={() => {
                setChoice(s.invoice_id)
                setManual('')
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-text">
                  Invoice #{s.invoice_id}
                  {s.owner?.name && <> · {s.owner.name}</>}
                </span>
                <span className="block text-[11.5px] text-muted mt-0.5">
                  {s.owner?.email ?? s.user_id}
                </span>
                <span className="block text-[11.5px] text-faint mt-1">
                  Expected {s.expected} ·{' '}
                  {s.delta_usd === 0
                    ? 'exact match'
                    : `${s.delta_usd > 0 ? '+' : ''}${s.delta_usd.toFixed(2)} USD`}{' '}
                  · {s.why}
                </span>
              </span>
            </button>
          ))}

          <label className="block mt-1">
            <span className="block text-[10.5px] uppercase tracking-[0.1em] text-faint mb-1.5">
              Or enter an invoice id
            </span>
            <input
              type="number"
              min={1}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="e.g. 1207"
              className="w-full rounded-field border border-border bg-surface2 py-2.5 px-3 font-mono text-[13px] text-text outline-none focus:border-accent"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="text-[12px] font-semibold text-red rounded-[10px] border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] py-2.5 px-3 leading-[1.45]"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex gap-2.5 justify-end border-t border-hair p-5 max-[430px]:flex-col-reverse">
          <button
            type="button"
            className="text-[13.5px] font-semibold bg-surface2 text-text border border-border py-2.5 px-5 rounded-pill cursor-pointer hover:border-accent disabled:opacity-50 max-[430px]:w-full"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 text-[13.5px] font-bold bg-accent text-on-accent border-0 py-2.5 px-5 rounded-pill cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed max-[430px]:w-full"
            onClick={() => invoiceId && onConfirm(invoiceId)}
            disabled={busy || !invoiceId}
          >
            {busy ? (
              <Loader2 size={15} className="animate-[dstate-spin_0.8s_linear_infinite]" />
            ) : (
              <ArrowRight size={15} />
            )}
            {busy ? 'Settling…' : `Settle invoice #${invoiceId ?? '—'}`}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
