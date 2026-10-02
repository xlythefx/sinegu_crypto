import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, CheckCircle2, FileText, Receipt, X } from 'lucide-react'
import ExchangeBadge from '../../billing/ExchangeBadge'
import { fmtMoney, fmtSignedMoney, fmtSignedPct, formatDate } from '../../../lib/format'
import type { AdminInvoiceRow } from '../../../services/admin'

interface AdminInvoiceDetailModalProps {
  invoice: AdminInvoiceRow | null
  onClose: () => void
  /** Opens the same printable document the customer sees. */
  onViewDocument: (invoice: AdminInvoiceRow) => void
  /** Present only when the invoice can still be settled. */
  onMarkPaid?: (invoice: AdminInvoiceRow) => void
  busy?: boolean
}

const SECTION = 'rounded-[14px] border border-border bg-surface2 p-4'
const LABEL = 'text-[10.5px] uppercase tracking-[0.1em] text-faint mb-3 inline-flex items-center gap-1.5'
const ROW = 'flex items-center justify-between gap-3 py-2 border-b border-hair last:border-b-0'
const KEY = 'text-[12px] text-muted'
const VAL = 'text-[13px] font-bold text-text font-mono text-right'

function Row({ k, children, tone }: { k: string; children: ReactNode; tone?: 'pos' | 'neg' | 'accent' }) {
  const color = tone === 'pos' ? 'text-green' : tone === 'neg' ? 'text-red' : tone === 'accent' ? 'text-accent' : ''
  return (
    <div className={ROW}>
      <span className={KEY}>{k}</span>
      <span className={`${VAL} ${color}`}>{children}</span>
    </div>
  )
}

/**
 * Everything the invoice row holds, for the admin — who billed, what period,
 * the figures the fee derives from, and its payment state. It RESTATES the
 * row (the same `Invoice` the customer's detail page renders), never
 * recomputes it. Sits at z 990 so ConfirmModal and the printable document
 * (z 1000) stack above it.
 */
export default function AdminInvoiceDetailModal({
  invoice,
  onClose,
  onViewDocument,
  onMarkPaid,
  busy = false,
}: AdminInvoiceDetailModalProps) {
  useEffect(() => {
    if (!invoice) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [invoice, onClose])

  if (!invoice) return null

  const paid = invoice.status === 'paid'
  const overdue = !paid && invoice.isOverdue && invoice.totalFee > 0
  const manual = invoice.feeSource === 'manual'
  const statusLabel = paid ? 'Paid' : overdue ? 'Overdue' : 'Outstanding'
  const statusPill = paid
    ? 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green'
    : overdue
      ? 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red'
      : 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent'

  return createPortal(
    <div
      className="fixed inset-0 z-[990] flex justify-center overflow-y-auto p-4 max-[420px]:p-3 sm:p-6 bg-[var(--bgScrim)] backdrop-blur-[4px] animate-[fadeup_0.2s_ease_both]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice ${invoice.formattedId}`}
    >
      <div
        className="relative w-full max-w-[640px] my-auto flex flex-col max-h-[calc(100vh-2rem)] bg-surface border border-border rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 p-5 pr-14 max-[420px]:p-4 max-[420px]:pr-12 border-b border-hair">
          <p className="font-mono text-[11.5px] text-accent">{invoice.formattedId}</p>
          <h3 className="font-display text-[19px] font-extrabold tracking-[-0.01em] leading-tight mt-0.5">
            {invoice.userName ?? '—'}
          </h3>
          <p className="text-[12px] text-faint mt-0.5 break-all">{invoice.userEmail ?? ''}</p>
          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            <span className={`inline-block text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill ${statusPill}`}>
              {statusLabel}
            </span>
            <ExchangeBadge exchange={invoice.exchange} />
            <span className="text-[12px] text-muted">
              {invoice.accountName} · {invoice.monthLabel}
            </span>
          </div>
          <button
            type="button"
            className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-btn bg-transparent text-faint cursor-pointer transition-colors duration-150 hover:bg-surface2 hover:text-text"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-5 max-[420px]:p-4 flex flex-col gap-3.5">
          {/* amount */}
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.1em] text-faint">
                {paid ? 'Amount paid' : 'Amount due'}
              </p>
              <p className="font-mono text-[30px] font-extrabold text-text leading-[1.1] mt-1">
                {fmtMoney(invoice.totalFee)}
              </p>
            </div>
            <p className="text-[12px] text-muted">
              {paid ? `Paid on ${formatDate(invoice.paidDate)}` : `Due by ${formatDate(invoice.dueDate)}`}
            </p>
          </div>

          {/* billing period first, like the customer's invoice page */}
          <section className={SECTION}>
            <p className={LABEL}>Billing period</p>
            <Row k="Period">{invoice.monthLabel}</Row>
            <Row k="Invoice date">{formatDate(invoice.invoiceDate)}</Row>
            <Row k="Due date" tone={overdue ? 'neg' : undefined}>{formatDate(invoice.dueDate)}</Row>
            {paid && <Row k="Paid date" tone="pos">{formatDate(invoice.paidDate)}</Row>}
            <Row k={invoice.referenceLabel}>{fmtMoney(invoice.referenceValue)}</Row>
            {invoice.isFirstInvoice && (invoice.depositAmount ?? 0) > 0 && (
              <Row k="Initial deposit">{fmtMoney(invoice.depositAmount!)}</Row>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
            <section className={SECTION}>
              <p className={LABEL}>Performance</p>
              <Row k="Performance gain" tone={invoice.performanceGain >= 0 ? 'pos' : 'neg'}>
                {fmtSignedPct(invoice.performanceGain, 2)}
              </Row>
              <Row k="Balance">{fmtMoney(invoice.currentBalance)}</Row>
              <Row k="Realized P&L" tone={invoice.realizedPnl >= 0 ? 'pos' : 'neg'}>
                {fmtSignedMoney(invoice.realizedPnl)}
              </Row>
              <Row k="Unrealized P&L" tone={invoice.unrealizedPnl >= 0 ? 'pos' : 'neg'}>
                {fmtSignedMoney(invoice.unrealizedPnl)}
              </Row>
            </section>

            <section className={SECTION}>
              <p className={LABEL}>High-water mark</p>
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10.5px] text-faint">Before</p>
                  <p className="font-mono text-[14px] font-bold text-text">
                    {invoice.hwmBefore != null ? fmtMoney(invoice.hwmBefore) : '—'}
                  </p>
                </div>
                <ArrowRight size={16} className="text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[10.5px] text-faint">{paid ? 'Set' : 'After payment'}</p>
                  <p className="font-mono text-[14px] font-bold text-accent">
                    {invoice.hwmAfter != null ? fmtMoney(invoice.hwmAfter) : '—'}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className={SECTION}>
            <p className={LABEL}>
              <Receipt size={12} className="text-accent" /> Fee breakdown
            </p>
            {manual ? (
              <Row k={`Set manually for ${invoice.monthLabel}`}>{fmtMoney(invoice.totalFee)}</Row>
            ) : (
              <>
                <Row k={`Realized share · ${invoice.realizedPercent}% of ${fmtSignedMoney(invoice.realizedPnl)}`}>
                  {fmtMoney(invoice.feeRealized)}
                </Row>
                {invoice.unrealizedPnl !== 0 && (
                  <Row k={`Unrealized share · ${invoice.unrealizedPercent}% of ${fmtSignedMoney(invoice.unrealizedPnl)}`}>
                    {fmtMoney(invoice.feeUnrealized)}
                  </Row>
                )}
              </>
            )}
            <div className="flex items-center justify-between gap-3 pt-3 mt-1">
              <span className="text-[13.5px] font-bold text-text">{paid ? 'Total paid' : 'Total due'}</span>
              <span className="font-mono text-[18px] font-extrabold text-accent">{fmtMoney(invoice.totalFee)}</span>
            </div>
          </section>
        </div>

        <footer className="flex-shrink-0 border-t border-hair p-4 flex items-center justify-end gap-2.5 flex-wrap max-[430px]:flex-col max-[430px]:items-stretch">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold bg-surface2 text-text border border-border py-2.5 px-[18px] rounded-pill cursor-pointer transition-[border-color] duration-150 hover:border-accent"
            onClick={() => onViewDocument(invoice)}
          >
            <FileText size={14} /> Printable invoice
          </button>
          {onMarkPaid && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 text-[13px] font-bold bg-accent text-on-accent border border-transparent py-2.5 px-[18px] rounded-pill cursor-pointer transition-[filter] duration-150 enabled:hover:brightness-[1.06] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onMarkPaid(invoice)}
              disabled={busy}
            >
              <CheckCircle2 size={14} /> Mark paid
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
