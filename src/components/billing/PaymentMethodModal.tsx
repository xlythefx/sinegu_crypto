import { useEffect } from 'react'
import { Coins, CreditCard, Lock, X } from 'lucide-react'
import { fmtMoney } from '../../lib/format'
import type { Invoice } from '../../lib/billing'

interface PaymentMethodModalProps {
  open: boolean
  invoice: Invoice | null
  onClose: () => void
  onPayWithCard: () => void
  onPayWithCrypto: () => void
}

/**
 * Payment-method chooser shown before an invoice is paid (card via Stripe or
 * crypto). Prototype-only — selecting a method is wired to the API later.
 */
export default function PaymentMethodModal({
  open,
  invoice,
  onClose,
  onPayWithCard,
  onPayWithCrypto,
}: PaymentMethodModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !invoice) return null

  const ROW = 'flex items-center justify-between text-[13px] text-text'
  const ROW_SUB = `${ROW} text-[12px] text-muted`
  const BTN =
    'flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 rounded-[12px] py-[13px] px-4 text-[13px] font-bold cursor-pointer transition-[filter,border-color] duration-150'

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center p-5 bg-[var(--bgScrim)] backdrop-blur-[4px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pay invoice"
    >
      <div
        className="relative w-full max-w-[460px] bg-surface border border-border rounded-[18px] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-btn bg-transparent text-faint cursor-pointer hover:bg-surface2 hover:text-text"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex gap-3 items-center mb-[18px] pr-8">
          <span className="w-[38px] h-[38px] flex-shrink-0 grid place-items-center rounded-[11px] bg-[var(--bubble)] border border-accent-line text-accent">
            <Lock size={16} />
          </span>
          <div>
            <h3 className="text-[17px] font-bold">Pay Invoice</h3>
            <p className="text-[12.5px] text-muted mt-0.5">
              Pay billing period for {invoice.accountName}
            </p>
          </div>
        </div>

        <div className="border border-accent-line bg-accent-soft rounded-[12px] p-4 mb-5 space-y-2.5">
          <div className={ROW}>
            <span>Amount Due</span>
            <span className="text-[22px] font-extrabold text-text font-mono">
              {fmtMoney(invoice.totalFee)}
            </span>
          </div>
          <div className={ROW_SUB}>
            <span>Billing Period</span>
            <span className="font-mono">{invoice.monthLabel}</span>
          </div>
          <div className={ROW_SUB}>
            <span>Account</span>
            <span className="font-mono">{invoice.accountName}</span>
          </div>
        </div>

        <p className="text-[13px] font-bold mb-1">Choose a payment method</p>
        <p className="text-[11.5px] text-muted mb-4">
          Card payments are processed via Stripe. Crypto payments settle in USDT.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className={`${BTN} border-0 text-on-accent bg-accent hover:brightness-[1.06]`}
            onClick={onPayWithCard}
          >
            <CreditCard size={16} /> Pay with card
          </button>
          <button
            type="button"
            className={`${BTN} border border-border bg-surface2 text-text hover:border-accent`}
            onClick={onPayWithCrypto}
          >
            <Coins size={16} /> Pay with crypto
          </button>
        </div>
      </div>
    </div>
  )
}
