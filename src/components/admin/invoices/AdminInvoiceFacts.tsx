import type { ReactNode } from 'react'
import { ArrowRight, Receipt } from 'lucide-react'
import { fmtMoney, fmtSignedMoney, fmtSignedPct, formatDate } from '../../../lib/format'
import { invoiceState } from '../../../lib/invoiceStatus'
import type { Invoice } from '../../../lib/billing'

export const FACT_CARD = 'rounded-card border border-border bg-surface p-card'
export const FACT_LABEL =
  'text-[10.5px] uppercase tracking-[0.1em] text-faint mb-3 inline-flex items-center gap-1.5'
const ROW = 'flex items-center justify-between gap-3 py-2 border-b border-hair last:border-b-0'
const KEY = 'text-[12.5px] text-muted'
const VAL = 'text-[13px] font-bold text-text font-mono text-right'

export function FactRow({
  k,
  children,
  tone,
}: {
  k: ReactNode
  children: ReactNode
  tone?: 'pos' | 'neg' | 'accent'
}) {
  const color =
    tone === 'pos' ? 'text-green' : tone === 'neg' ? 'text-red' : tone === 'accent' ? 'text-accent' : ''
  return (
    <div className={ROW}>
      <span className={KEY}>{k}</span>
      <span className={`${VAL} ${color} min-w-0 break-all`}>{children}</span>
    </div>
  )
}

/**
 * The invoice row restated for the admin — billing period, the performance
 * the fee derives from, the high-water mark and the fee breakdown. It never
 * recomputes: every figure is the row's own (the same `Invoice` the
 * customer's page renders). Laid out as cards for the invoice page.
 */
export default function AdminInvoiceFacts({ invoice }: { invoice: Invoice }) {
  const paid = invoice.status === 'paid'
  const manual = invoice.feeSource === 'manual'
  const overdue = invoiceState(invoice) === 'overdue'

  return (
    <>
      <section className={FACT_CARD}>
        <p className={FACT_LABEL}>Billing period</p>
        <FactRow k="Period">{invoice.monthLabel}</FactRow>
        <FactRow k="Invoice date">{formatDate(invoice.invoiceDate)}</FactRow>
        <FactRow k="Due date" tone={overdue ? 'neg' : undefined}>
          {formatDate(invoice.dueDate)}
        </FactRow>
        {paid && (
          <FactRow k="Paid date" tone="pos">
            {formatDate(invoice.paidDate)}
          </FactRow>
        )}
        <FactRow k={invoice.referenceLabel}>{fmtMoney(invoice.referenceValue)}</FactRow>
        {invoice.isFirstInvoice && (invoice.depositAmount ?? 0) > 0 && (
          <FactRow k="Initial deposit">{fmtMoney(invoice.depositAmount!)}</FactRow>
        )}
      </section>

      <section className={FACT_CARD}>
        <p className={FACT_LABEL}>Performance</p>
        <FactRow k="Performance gain" tone={invoice.performanceGain >= 0 ? 'pos' : 'neg'}>
          {fmtSignedPct(invoice.performanceGain, 2)}
        </FactRow>
        <FactRow k="Balance">{fmtMoney(invoice.currentBalance)}</FactRow>
        <FactRow k="Realized P&L" tone={invoice.realizedPnl >= 0 ? 'pos' : 'neg'}>
          {fmtSignedMoney(invoice.realizedPnl)}
        </FactRow>
        <FactRow k="Unrealized P&L" tone={invoice.unrealizedPnl >= 0 ? 'pos' : 'neg'}>
          {fmtSignedMoney(invoice.unrealizedPnl)}
        </FactRow>
      </section>

      <section className={FACT_CARD}>
        <p className={FACT_LABEL}>High-water mark</p>
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
        {/* Transfers move the mark and are never billed (2026-11-08). */}
        {invoice.capitalFlow !== 0 && (
          <FactRow k="Deposits − withdrawals this month" tone={invoice.capitalFlow >= 0 ? 'pos' : 'neg'}>
            {fmtSignedMoney(invoice.capitalFlow)}
          </FactRow>
        )}
      </section>

      <section className={FACT_CARD}>
        <p className={FACT_LABEL}>
          <Receipt size={12} className="text-accent" /> Fee breakdown
        </p>
        {manual ? (
          <FactRow k={`Set manually for ${invoice.monthLabel}`}>{fmtMoney(invoice.totalFee)}</FactRow>
        ) : (
          <>
            <FactRow k={`Realized share · ${invoice.realizedPercent}% of ${fmtSignedMoney(invoice.realizedPnl)}`}>
              {fmtMoney(invoice.feeRealized)}
            </FactRow>
            {invoice.unrealizedPnl !== 0 && (
              <FactRow
                k={`Unrealized share · ${invoice.unrealizedPercent}% of ${fmtSignedMoney(invoice.unrealizedPnl)}`}
              >
                {fmtMoney(invoice.feeUnrealized)}
              </FactRow>
            )}
          </>
        )}
        <div className="flex items-center justify-between gap-3 pt-3 mt-1">
          <span className="text-[13.5px] font-bold text-text">{paid ? 'Total paid' : 'Total due'}</span>
          <span className="font-mono text-[18px] font-extrabold text-accent">{fmtMoney(invoice.totalFee)}</span>
        </div>
      </section>
    </>
  )
}
