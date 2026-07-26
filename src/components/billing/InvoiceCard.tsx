import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, FileText } from 'lucide-react'
import { fmtMoney } from '../../lib/format'
import { hasFee, type Invoice } from '../../lib/billing'
import ExchangeBadge from './ExchangeBadge'

const TAG =
  'text-[9.5px] font-bold uppercase tracking-[0.05em] px-[7px] py-0.5 rounded-pill inline-flex items-center gap-[3px] leading-[1.5]'

/** A single invoice row — navigates to its in-depth detail page on click. */
export default function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const paid = invoice.status === 'paid'
  const fee = hasFee(invoice)

  return (
    <Link
      to={`/dashboard/invoices/${invoice.id}`}
      className={`group rounded-card border border-border bg-surface flex items-center gap-3.5 py-4 px-5 text-inherit no-underline transition-[border-color,transform,box-shadow] duration-150 hover:border-accent hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-14px_var(--glow)]${paid ? ' opacity-90' : ''}`}
    >
      <span
        className={`w-10 h-10 flex-shrink-0 grid place-items-center rounded-[11px] border ${
          paid
            ? 'bg-[color-mix(in_srgb,var(--green)_14%,transparent)] border-[color-mix(in_srgb,var(--green)_40%,transparent)] text-green'
            : 'bg-[var(--bubble)] border-accent-line text-accent'
        }`}
      >
        {paid ? <CheckCircle2 size={18} /> : <FileText size={18} />}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-[3px]">
          <span className="text-[14.5px] font-bold text-text">
            {invoice.accountName}
          </span>
          <ExchangeBadge exchange={invoice.exchange} />
          {paid && (
            <span
              className={`${TAG} bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green`}
            >
              <CheckCircle2 size={11} /> Paid
            </span>
          )}
          {!paid && fee && (
            <span
              className={`${TAG} ${
                invoice.isOverdue
                  ? 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red'
                  : 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent'
              }`}
            >
              {invoice.isOverdue ? 'Overdue' : 'Due Soon'}
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-faint overflow-hidden text-ellipsis whitespace-nowrap font-mono">
          {invoice.formattedId} · {invoice.monthLabel}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-[10px] uppercase tracking-[0.08em] text-faint mb-0.5">
          {paid ? 'Amount Paid' : 'Amount Due'}
        </p>
        <p className="text-[22px] font-extrabold text-text leading-none font-mono">
          {fmtMoney(fee ? invoice.totalFee : 0)}
        </p>
      </div>

      <span className="flex-shrink-0 text-faint grid place-items-center transition-[color,transform] duration-150 group-hover:text-accent group-hover:translate-x-0.5">
        <ChevronRight size={18} />
      </span>
    </Link>
  )
}
