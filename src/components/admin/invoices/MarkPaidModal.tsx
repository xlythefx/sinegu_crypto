import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Banknote, CheckCircle2, Coins, HandCoins, Landmark, X } from 'lucide-react'
import { fmtMoney } from '../../../lib/format'
import type { ManualPaymentMethod } from '../../../services/admin'

const METHODS: { key: ManualPaymentMethod; label: string; Icon: typeof Coins }[] = [
  { key: 'bank_transfer', label: 'Bank transfer', Icon: Landmark },
  { key: 'crypto_wallet', label: 'Crypto to another wallet', Icon: Coins },
  { key: 'cash', label: 'Cash', Icon: Banknote },
  { key: 'other', label: 'Other', Icon: HandCoins },
]

interface MarkPaidModalProps {
  /** The invoice being marked; null = closed. */
  invoice: { formattedId: string; totalFee: number; userName?: string | null } | null
  busy?: boolean
  error?: string | null
  onConfirm: (choice: { method: ManualPaymentMethod; note: string }) => void
  onCancel: () => void
}

/**
 * "Mark paid" for money that did not come through Stripe or the USDT watcher
 * (2026-11-11 — "we don't know how it was paid"). The admin says HOW it came
 * and adds a short note; the API records both and the admin's name, and the
 * invoice page, the Timeline and the "invoice paid" notices then say so.
 * Card and USDT payments never come here: they settle themselves.
 */
export default function MarkPaidModal({ invoice, busy = false, error, onConfirm, onCancel }: MarkPaidModalProps) {
  const [method, setMethod] = useState<ManualPaymentMethod | null>(null)
  const [note, setNote] = useState('')

  // A fresh form for every invoice.
  useEffect(() => {
    setMethod(null)
    setNote('')
  }, [invoice?.formattedId])

  useEffect(() => {
    if (!invoice) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [invoice, busy, onCancel])

  if (!invoice) return null
  const ready = method !== null && note.trim().length >= 3 && !busy

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--bgScrim)] backdrop-blur-[4px] animate-[fadeup_0.2s_ease_both]"
      onClick={() => !busy && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-label={`Mark ${invoice.formattedId} paid`}
    >
      <div
        className="relative w-full max-w-[480px] rounded-[20px] border border-border bg-surface p-6 max-[420px]:p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-btn text-faint cursor-pointer hover:bg-surface2 hover:text-text"
          onClick={onCancel}
          aria-label="Close"
          disabled={busy}
        >
          <X size={18} />
        </button>
        <h3 className="font-display text-[18px] font-extrabold pr-10">Mark {invoice.formattedId} paid</h3>
        <p className="text-[13px] text-muted mt-1">
          {fmtMoney(invoice.totalFee)}
          {invoice.userName ? ` from ${invoice.userName}` : ''}. Card and USDT payments settle by themselves; use
          this only for money that came another way.
        </p>

        <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">How did the money come?</p>
        <div className="grid grid-cols-2 gap-2 max-[380px]:grid-cols-1" role="radiogroup" aria-label="How the money came">
          {METHODS.map(({ key, label, Icon }) => {
            const on = method === key
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMethod(key)}
                className={`flex items-center gap-2 rounded-[12px] border px-3 py-2.5 text-left text-[13px] font-semibold cursor-pointer transition-colors ${
                  on ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface2 text-text hover:border-accent-line'
                }`}
              >
                <Icon size={15} className="flex-none" /> {label}
              </button>
            )
          })}
        </div>

        <label className="block mt-4">
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Who paid, where it arrived, any reference (e.g. Wise transfer, ref 4471)"
            className="w-full rounded-field border border-border bg-surface2 px-3 py-2.5 text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none resize-y"
          />
        </label>
        <p className="mt-1.5 text-[11.5px] text-faint">
          Saved with your name. It also settles the invoice, locks in the new high-water mark, switches the account
          back on, and tells the customer and the team.
        </p>

        {error && <p className="mt-3 text-[12.5px] font-semibold text-red">{error}</p>}

        <div className="mt-5 flex justify-end gap-2.5 max-[420px]:flex-col-reverse">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-pill border border-border bg-surface2 px-[18px] py-2.5 text-[13px] font-semibold text-text cursor-pointer hover:border-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => method && onConfirm({ method, note: note.trim() })}
            className="inline-flex items-center justify-center gap-2 rounded-pill bg-accent px-[18px] py-2.5 text-[13px] font-bold text-on-accent cursor-pointer enabled:hover:brightness-[1.06] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={14} /> {busy ? 'Saving…' : 'Mark paid'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
