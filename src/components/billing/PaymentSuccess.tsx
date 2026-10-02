import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ExternalLink, FileText, FlaskConical, LayoutDashboard } from 'lucide-react'
import { fmtCryptoAmount, fmtMoney } from '../../lib/format'
import type { Invoice } from '../../lib/billing'
import type { TronSettlement } from '../../types/payments'

interface PaymentSuccessProps {
  invoice: Invoice
  settlement: TronSettlement
  onDone: () => void
}

const ACTION =
  'inline-flex items-center justify-center gap-2 rounded-pill py-3 px-[22px] text-[13.5px] font-bold cursor-pointer transition-[filter,border-color,transform] duration-150 active:translate-y-px max-[430px]:w-full'
const ACTION_PRIMARY = `${ACTION} bg-accent text-on-accent border-0 shadow-[0_10px_24px_var(--glow)] hover:brightness-[1.06]`
const ACTION_GHOST = `${ACTION} bg-surface2 text-text border border-border hover:border-accent`
const META_ROW =
  'flex items-center justify-between gap-3 py-2.5 border-b border-hair last:border-b-0'

/**
 * The confirmation that replaces the pay sheet once an invoice is settled.
 *
 * Deliberately a full replacement rather than a green strip inside the sheet:
 * after the money has landed, the fee breakdown and the list of payment methods
 * are describing a decision the customer has already made. What is still useful
 * is what was paid, that their bot is running again, and somewhere to go.
 */
export default function PaymentSuccess({ invoice, settlement, onDone }: PaymentSuccessProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[1000] flex justify-center overflow-y-auto p-4 max-[420px]:p-3 sm:p-6 bg-[var(--bgScrim)] backdrop-blur-[4px] animate-[fadeup_0.2s_ease_both]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDone()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Payment received"
        className="w-full max-w-[480px] h-fit my-auto rounded-[20px] border border-border bg-surface overflow-hidden animate-[fadeup_0.28s_cubic-bezier(0.2,0.7,0.2,1)_both]"
      >
        <div className="p-6 max-[420px]:p-5 text-center">
          <span className="mx-auto mb-4 grid place-items-center w-14 h-14 rounded-full border border-[color-mix(in_srgb,var(--green)_45%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-green">
            <CheckCircle2 size={28} />
          </span>

          <h2 className="text-[20px] font-bold text-text display">Payment received</h2>
          <p className="text-[12.5px] text-muted leading-[1.5] mt-1.5">
            Invoice {invoice.formattedId} is settled and your bot is active again.
          </p>

          <p className="font-mono text-[34px] font-bold text-accent mt-4 mb-1">
            {fmtMoney(settlement.usdAmount)}
          </p>
          <p className="font-mono text-[12px] text-faint">
            {fmtCryptoAmount(settlement.amount)} {settlement.asset}
          </p>

          {settlement.simulated && (
            <p className="inline-flex items-center gap-1.5 rounded-pill border border-accent-line bg-[var(--bubble)] py-1 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-accent mt-3">
              <FlaskConical size={11} /> Simulated — no funds moved
            </p>
          )}

          <div className="text-left mt-5 rounded-[12px] border border-hair bg-surface2 py-1 px-3.5">
            <div className={META_ROW}>
              <span className="text-[12px] text-muted">Account</span>
              <span className="text-[12.5px] font-bold text-text text-right">
                {invoice.accountName}
              </span>
            </div>
            <div className={META_ROW}>
              <span className="text-[12px] text-muted">Period</span>
              <span className="text-[12.5px] font-bold text-text font-mono text-right">
                {invoice.monthLabel}
              </span>
            </div>
            {invoice.hwmAfter != null && (
              <div className={META_ROW}>
                <span className="text-[12px] text-muted">New high-water mark</span>
                <span className="text-[12.5px] font-bold text-accent font-mono text-right">
                  {fmtMoney(invoice.hwmAfter)}
                </span>
              </div>
            )}
          </div>

          {settlement.explorerUrl && (
            <a
              href={settlement.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-accent mt-4 hover:underline"
            >
              <ExternalLink size={12} /> View the transaction
            </a>
          )}
        </div>

        <div className="flex gap-2.5 justify-center border-t border-hair bg-surface p-5 max-[430px]:flex-col-reverse">
          <Link to="/dashboard" className={ACTION_GHOST} onClick={onDone}>
            <LayoutDashboard size={15} /> Back to dashboard
          </Link>
          <Link to="/dashboard/invoices" className={ACTION_PRIMARY} onClick={onDone}>
            <FileText size={15} /> View invoices
          </Link>
        </div>
      </div>
    </div>
  )
}
