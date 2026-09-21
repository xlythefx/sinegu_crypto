import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  CheckCircle2,
  Mail,
  MapPin,
  Printer,
  ShieldCheck,
  User,
  Wallet,
  X,
} from 'lucide-react'
import { COMPANY, OFFICE, VAT_RATE } from '../../lib/company'
import { fmtMoney, fmtSignedMoney, fmtSignedPct, fmtMediumDate } from '../../lib/format'
import { hasFee, type Invoice } from '../../lib/billing'
import { EXCHANGE_META } from '../exchanges/meta'

/**
 * The invoice as a DOCUMENT — white paper on a dark scrim, deliberately outside
 * the app's theme.
 *
 * Everything else in the product is the dark dashboard; this one surface is a
 * printable record with an issuer, a billed party, line items and a total,
 * so it is styled with fixed light colors rather than the theme tokens. Flipping
 * to light theme must not change what the customer's copy looks like, and a
 * dark PDF is not an invoice anyone files.
 *
 * The numbers are the SAME ones the detail page shows — this restates them in
 * document form, it never recomputes a fee.
 */

/** Fixed paper palette — intentionally not `var(--…)`; see the note above. */
const INK = '#0e1524'
const INK_SOFT = '#475569'
const INK_FAINT = '#94a3b8'
const RULE = '#e6eaf2'
const PAPER_TINT = '#f7f9fc'
const GOLD = '#a97c1e'

const META_LINE = 'flex items-start gap-2 text-[12.5px] leading-[1.55]'

interface LineItem {
  description: string
  detail: string
  qty: number
  amount: number
}

interface InvoiceDocumentModalProps {
  open: boolean
  invoice: Invoice | null
  /** Who the invoice is billed to. Falls back to the exchange account name. */
  customer?: { name?: string | null; email?: string | null } | null
  onClose: () => void
  /** Optional — renders a pay action on an unpaid document. */
  onPay?: () => void
}

export default function InvoiceDocumentModal({
  open,
  invoice,
  customer,
  onClose,
  onPay,
}: InvoiceDocumentModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Lock the page behind the sheet, and mark <body> so the print rules in
    // index.css know a document is on screen — without the marker, printing a
    // normal page would hide everything and emit a blank sheet.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('invoice-doc-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      document.body.classList.remove('invoice-doc-open')
    }
  }, [open, onClose])

  if (!open || !invoice) return null

  const paid = invoice.status === 'paid'
  const fee = hasFee(invoice)
  const overdue = !paid && invoice.isOverdue && fee
  const exchange = EXCHANGE_META[invoice.exchange].label

  // Line items mirror the fee breakdown exactly: one line per profit share that
  // actually earned a fee. A zero-fee period still prints a line — an invoice
  // with no items reads like a rendering failure, not like "nothing was owed".
  const items: LineItem[] = []
  if (invoice.feeRealized > 0) {
    items.push({
      description: `Performance fee — realized profit (${invoice.monthLabel})`,
      detail: `${invoice.realizedPercent}% of ${fmtSignedMoney(invoice.realizedPnl)} realized · ${exchange} · ${invoice.accountName}`,
      qty: 1,
      amount: invoice.feeRealized,
    })
  }
  if (invoice.feeUnrealized > 0) {
    items.push({
      description: `Performance fee — unrealized profit (${invoice.monthLabel})`,
      detail: `${invoice.unrealizedPercent}% of ${fmtSignedMoney(invoice.unrealizedPnl)} open P&L · ${exchange} · ${invoice.accountName}`,
      qty: 1,
      amount: invoice.feeUnrealized,
    })
  }
  if (items.length === 0) {
    items.push({
      description: `Performance fee (${invoice.monthLabel})`,
      detail: `No profit above the high-water mark · ${exchange} · ${invoice.accountName}`,
      qty: 1,
      amount: 0,
    })
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0)
  const vat = subtotal * (VAT_RATE / 100)
  const total = subtotal + vat

  // Printed as the payment term, derived from the dates on the invoice itself
  // rather than assumed — the API owns the due date.
  const issued = new Date(`${invoice.invoiceDate.slice(0, 10)}T00:00:00`)
  const due = new Date(`${invoice.dueDate.slice(0, 10)}T00:00:00`)
  const termDays =
    Number.isNaN(issued.getTime()) || Number.isNaN(due.getTime())
      ? null
      : Math.round((due.getTime() - issued.getTime()) / 86_400_000)

  const billedName = customer?.name?.trim() || invoice.accountName
  const billedEmail = customer?.email?.trim() || null

  const statusStyle = paid
    ? { color: '#0f7b46', background: '#e8f7ef', border: '#b7e6cd' }
    : overdue
      ? { color: '#b3261e', background: '#fdecea', border: '#f5c6c2' }
      : { color: GOLD, background: '#fdf6e6', border: '#eddcb4' }

  return createPortal(
    <div
      className="invoice-doc-overlay fixed inset-0 z-[1000] flex justify-center overflow-y-auto p-4 sm:p-8 max-[420px]:p-2 bg-[var(--bgScrim)] backdrop-blur-[4px] animate-[fadeup_0.2s_ease_both]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice ${invoice.formattedId}`}
    >
      <div className="w-full max-w-[880px] my-auto">
        {/* toolbar — sits on the scrim, never on the paper, and never prints */}
        <div className="print:hidden flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="font-mono text-[11px] tracking-[0.14em] text-faint">
            INVOICE DOCUMENT
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface2 py-2 px-4 text-[12.5px] font-semibold text-text cursor-pointer transition-colors duration-150 hover:border-accent"
              onClick={(e) => {
                e.stopPropagation()
                window.print()
              }}
            >
              <Printer size={15} /> Print / Save as PDF
            </button>
            <button
              type="button"
              className="grid place-items-center w-9 h-9 rounded-pill border border-border bg-surface2 text-muted cursor-pointer transition-colors duration-150 hover:border-accent hover:text-text"
              onClick={onClose}
              aria-label="Close invoice"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ---- the paper ---- */}
        <article
          className="invoice-doc-sheet rounded-[18px] overflow-hidden bg-white shadow-[0_40px_90px_rgba(0,0,0,0.5)] animate-[fadeup_0.28s_cubic-bezier(0.2,0.7,0.2,1)_both]"
          style={{ color: INK }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <header
            className="flex items-center justify-between gap-4 flex-wrap py-[18px] px-6 sm:px-9"
            style={{ background: PAPER_TINT, borderBottom: `1px solid ${RULE}` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/assets/logo.png"
                alt=""
                className="w-8 h-8 object-contain flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="font-display text-[15px] font-extrabold leading-tight">
                  {COMPANY.name}
                </p>
                <p
                  className="font-mono text-[11.5px] leading-tight mt-0.5"
                  style={{ color: INK_FAINT }}
                >
                  Invoice {invoice.formattedId}
                </p>
              </div>
            </div>
            <span
              className="text-[10.5px] font-bold uppercase tracking-[0.09em] py-[6px] px-3.5 rounded-pill inline-flex items-center gap-1.5"
              style={{
                color: statusStyle.color,
                background: statusStyle.background,
                border: `1px solid ${statusStyle.border}`,
              }}
            >
              {paid && <CheckCircle2 size={13} />}
              {paid ? 'Paid' : overdue ? 'Overdue' : 'Outstanding'}
            </span>
          </header>

          <div className="py-7 px-6 sm:px-9">
            {/* from / bill to */}
            <div className="grid grid-cols-2 gap-7 max-[560px]:grid-cols-1">
              <div>
                <p
                  className="text-[10.5px] uppercase tracking-[0.12em] mb-2.5"
                  style={{ color: INK_FAINT }}
                >
                  From
                </p>
                <p className="text-[16px] font-extrabold mb-2 leading-tight">
                  {COMPANY.name}
                </p>
                <div className="flex flex-col gap-1.5" style={{ color: INK_SOFT }}>
                  <p className={META_LINE}>
                    <MapPin size={14} className="flex-shrink-0 mt-[2px]" />
                    <span>
                      {OFFICE.addressLines.join(', ')}, {OFFICE.country}
                    </span>
                  </p>
                  <p className={META_LINE}>
                    <Mail size={14} className="flex-shrink-0 mt-[2px]" />
                    <span>{COMPANY.email}</span>
                  </p>
                </div>
              </div>

              <div>
                <p
                  className="text-[10.5px] uppercase tracking-[0.12em] mb-2.5"
                  style={{ color: INK_FAINT }}
                >
                  Bill To
                </p>
                <p className="text-[16px] font-extrabold mb-2 leading-tight flex items-center gap-2">
                  <User size={15} style={{ color: INK_FAINT }} />
                  {billedName}
                </p>
                <div className="flex flex-col gap-1.5" style={{ color: INK_SOFT }}>
                  {billedEmail && (
                    <p className={META_LINE}>
                      <Mail size={14} className="flex-shrink-0 mt-[2px]" />
                      <span className="break-all">{billedEmail}</span>
                    </p>
                  )}
                  <p className={META_LINE}>
                    <Wallet size={14} className="flex-shrink-0 mt-[2px]" />
                    <span>
                      {exchange} · {invoice.accountName}
                    </span>
                  </p>
                  <p className={META_LINE}>
                    <CalendarDays size={14} className="flex-shrink-0 mt-[2px]" />
                    <span>Billing period: {invoice.monthLabel}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* dates */}
            <div
              className="flex flex-wrap items-center gap-x-8 gap-y-2.5 mt-6 pt-5"
              style={{ borderTop: `1px solid ${RULE}` }}
            >
              <p className="flex items-center gap-2 text-[12.5px]" style={{ color: INK_SOFT }}>
                <CalendarDays size={14} style={{ color: INK_FAINT }} />
                Issue Date:{' '}
                <strong style={{ color: INK }}>{fmtMediumDate(invoice.invoiceDate)}</strong>
              </p>
              <p className="flex items-center gap-2 text-[12.5px]" style={{ color: INK_SOFT }}>
                <CalendarDays size={14} style={{ color: INK_FAINT }} />
                Due Date:{' '}
                <strong style={{ color: overdue ? '#b3261e' : INK }}>
                  {fmtMediumDate(invoice.dueDate)}
                </strong>
              </p>
              {paid && invoice.paidDate && (
                <p
                  className="flex items-center gap-2 text-[12.5px]"
                  style={{ color: INK_SOFT }}
                >
                  <CheckCircle2 size={14} style={{ color: '#0f7b46' }} />
                  Paid:{' '}
                  <strong style={{ color: '#0f7b46' }}>
                    {fmtMediumDate(invoice.paidDate)}
                  </strong>
                </p>
              )}
            </div>

            {/* items */}
            <p
              className="text-[10.5px] uppercase tracking-[0.12em] mt-7 mb-3"
              style={{ color: INK_FAINT }}
            >
              Items
            </p>
            <table className="w-full border-collapse">
              <thead>
                <tr
                  className="text-[10.5px] uppercase tracking-[0.08em]"
                  style={{ color: INK_FAINT }}
                >
                  <th
                    className="text-left font-semibold pb-2.5"
                    style={{ borderBottom: `1px solid ${RULE}` }}
                  >
                    Description
                  </th>
                  <th
                    className="text-right font-semibold pb-2.5 w-[52px]"
                    style={{ borderBottom: `1px solid ${RULE}` }}
                  >
                    Qty
                  </th>
                  <th
                    className="text-right font-semibold pb-2.5 w-[110px] max-[560px]:hidden"
                    style={{ borderBottom: `1px solid ${RULE}` }}
                  >
                    Rate
                  </th>
                  <th
                    className="text-right font-semibold pb-2.5 w-[120px]"
                    style={{ borderBottom: `1px solid ${RULE}` }}
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-4 pr-4" style={{ borderBottom: `1px solid ${RULE}` }}>
                      <p className="text-[13.5px] font-semibold leading-[1.4]">
                        {item.description}
                      </p>
                      <p
                        className="text-[11.5px] font-mono leading-[1.5] mt-1"
                        style={{ color: INK_FAINT }}
                      >
                        {item.detail}
                      </p>
                    </td>
                    <td
                      className="py-4 text-right text-[13px] font-mono"
                      style={{ borderBottom: `1px solid ${RULE}`, color: INK_SOFT }}
                    >
                      {item.qty}
                    </td>
                    <td
                      className="py-4 text-right text-[13px] font-mono max-[560px]:hidden"
                      style={{ borderBottom: `1px solid ${RULE}`, color: INK_SOFT }}
                    >
                      {fmtMoney(item.amount)}
                    </td>
                    <td
                      className="py-4 text-right text-[13.5px] font-mono font-bold"
                      style={{ borderBottom: `1px solid ${RULE}` }}
                    >
                      {fmtMoney(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* totals */}
            <div className="flex justify-end mt-5">
              <div className="w-full max-w-[320px]">
                <div
                  className="flex items-center justify-between py-2 text-[13px]"
                  style={{ color: INK_SOFT }}
                >
                  <span>Subtotal</span>
                  <span className="font-mono">{fmtMoney(subtotal)}</span>
                </div>
                <div
                  className="flex items-center justify-between py-2 text-[13px]"
                  style={{ color: INK_SOFT, borderBottom: `1px solid ${RULE}` }}
                >
                  <span>VAT ({VAT_RATE}%)</span>
                  <span className="font-mono">{fmtMoney(vat)}</span>
                </div>
                <div className="flex items-center justify-between pt-3.5">
                  <span className="text-[15px] font-extrabold">
                    {paid ? 'Total Paid' : 'Total Due'}
                  </span>
                  <span className="font-mono text-[24px] font-extrabold leading-none">
                    {fmtMoney(total)}
                    <span
                      className="text-[11px] font-semibold ml-1.5 align-middle"
                      style={{ color: INK_FAINT }}
                    >
                      {invoice.currency}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* how the figure was reached — an invoice for a share of profit has
                to show the profit it is a share of, or it can't be checked */}
            <div
              className="mt-7 rounded-[12px] py-4 px-[18px]"
              style={{ background: PAPER_TINT, border: `1px solid ${RULE}` }}
            >
              <p
                className="text-[10.5px] uppercase tracking-[0.12em] mb-3"
                style={{ color: INK_FAINT }}
              >
                Performance summary — {invoice.monthLabel}
              </p>
              <div className="grid grid-cols-4 gap-4 max-[640px]:grid-cols-2">
                <div>
                  <p className="text-[10.5px] mb-1" style={{ color: INK_FAINT }}>
                    Period gain
                  </p>
                  <p
                    className="text-[14px] font-mono font-bold"
                    style={{ color: invoice.performanceGain >= 0 ? '#0f7b46' : '#b3261e' }}
                  >
                    {fmtSignedPct(invoice.performanceGain, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] mb-1" style={{ color: INK_FAINT }}>
                    Realized P&amp;L
                  </p>
                  <p
                    className="text-[14px] font-mono font-bold"
                    style={{ color: invoice.realizedPnl >= 0 ? '#0f7b46' : '#b3261e' }}
                  >
                    {fmtSignedMoney(invoice.realizedPnl)}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] mb-1" style={{ color: INK_FAINT }}>
                    Unrealized P&amp;L
                  </p>
                  <p
                    className="text-[14px] font-mono font-bold"
                    style={{ color: invoice.unrealizedPnl >= 0 ? '#0f7b46' : '#b3261e' }}
                  >
                    {fmtSignedMoney(invoice.unrealizedPnl)}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] mb-1" style={{ color: INK_FAINT }}>
                    High-water mark
                  </p>
                  <p className="text-[14px] font-mono font-bold">
                    {invoice.hwmBefore != null ? fmtMoney(invoice.hwmBefore) : '—'}
                    {' → '}
                    {invoice.hwmAfter != null ? fmtMoney(invoice.hwmAfter) : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* notes */}
            <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${RULE}` }}>
              <p
                className="text-[10.5px] uppercase tracking-[0.12em] mb-2"
                style={{ color: INK_FAINT }}
              >
                Notes
              </p>
              <p className="text-[12.5px] leading-[1.65]" style={{ color: INK_SOFT }}>
                {termDays != null && `Payment terms: Net ${termDays}. `}
                Fees are charged only on profit above your high-water mark of{' '}
                {invoice.hwmBefore != null ? fmtMoney(invoice.hwmBefore) : 'your starting capital'}
                {' '}— you never pay twice on the same gains.{' '}
                {paid
                  ? 'This billing period is settled. Thank you.'
                  : `Settle in USDT or supported crypto from your ${COMPANY.name} billing page.`}
              </p>
            </div>
          </div>

          {/* footer */}
          <footer
            className="flex items-center justify-between gap-4 flex-wrap py-4 px-6 sm:px-9"
            style={{ background: PAPER_TINT, borderTop: `1px solid ${RULE}` }}
          >
            <p
              className="inline-flex items-center gap-1.5 text-[11.5px]"
              style={{ color: INK_FAINT }}
            >
              <ShieldCheck size={13} /> {COMPANY.name} · {COMPANY.website}
            </p>
            {!paid && fee && onPay && (
              <button
                type="button"
                className="print:hidden inline-flex items-center gap-2 rounded-pill py-2.5 px-5 text-[13px] font-bold text-white cursor-pointer transition-[filter] duration-150 hover:brightness-110"
                style={{ background: GOLD }}
                onClick={onPay}
              >
                <Wallet size={15} /> Pay {fmtMoney(total)}
              </button>
            )}
          </footer>
        </article>
      </div>
    </div>,
    document.body,
  )
}
