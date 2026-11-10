import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, Clock, Eye, FileText, Receipt } from 'lucide-react'
import ExchangeBadge from '../../billing/ExchangeBadge'
import InvoiceDocumentModal from '../../billing/InvoiceDocumentModal'
import AdminInvoiceDetailModal from '../invoices/AdminInvoiceDetailModal'
import { useApiData } from '../../../hooks/useApiData'
import { getAdminUserInvoices, type AdminInvoiceRow } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { fmtMediumDate, fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { Invoice } from '../../../lib/billing'
import type { ExchangePillValue } from './ExchangeFilterPill'

const CARD = 'rounded-card border border-border bg-surface p-card'
const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-2.5 px-3 border-b border-hair whitespace-nowrap'
const TD = 'py-3 px-3 border-b border-hair align-middle text-[13px] whitespace-nowrap'
const PILL =
  'inline-block text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill whitespace-nowrap'
const VIEW_BTN =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-btn border border-border bg-surface2 text-[12px] font-semibold text-text cursor-pointer transition-colors hover:border-accent-line hover:text-accent'

/** Overdue is a flag on an unpaid row with something to pay. */
function isOverdue(inv: Invoice): boolean {
  return inv.status !== 'paid' && inv.isOverdue && inv.totalFee > 0
}

function statusPill(inv: Invoice) {
  if (inv.status === 'paid')
    return { label: 'Paid', cls: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green' }
  if (isOverdue(inv))
    return { label: 'Overdue', cls: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red' }
  return { label: 'Outstanding', cls: 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent' }
}

function Stat({
  label,
  value,
  sub,
  Icon,
  tone,
}: {
  label: string
  value: string
  sub: string
  Icon: typeof Receipt
  tone: string
}) {
  return (
    <div className={`${CARD} flex items-center gap-3.5`}>
      <span className={`grid h-10 w-10 flex-none place-items-center rounded-[11px] border border-border bg-surface2 ${tone}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-faint">{label}</div>
        <div className="font-mono text-[20px] font-extrabold leading-tight">{value}</div>
        <div className="text-[11.5px] font-semibold text-muted">{sub}</div>
      </div>
    </div>
  )
}

interface UserInvoicesTabProps {
  uniId: string
  /** The page's exchange pill — invoices are per exchange. */
  exchange: ExchangePillValue
  user: { name: string | null; email: string | null }
}

/**
 * Every invoice this user has had, with the profit each one billed on — the
 * profile's answer to "what did they make, and what did we charge". The
 * figures are the invoice's own snapshot (never recomputed), so they read
 * exactly as the customer's copy does. Read-only: marking paid or deleting
 * stays on Invoice History, linked from the header.
 */
export default function UserInvoicesTab({ uniId, exchange, user }: UserInvoicesTabProps) {
  const fetchInvoices = useCallback(
    () => getAdminUserInvoices(uniId, exchange),
    [uniId, exchange],
  )
  const { data, loading, error } = useApiData(fetchInvoices, [fetchInvoices])
  const [viewing, setViewing] = useState<AdminInvoiceRow | null>(null)
  const [docInvoice, setDocInvoice] = useState<AdminInvoiceRow | null>(null)

  const invoices = data ?? []
  const asRow = (inv: Invoice): AdminInvoiceRow => ({
    ...inv,
    userName: user.name,
    userEmail: user.email,
  })

  const billed = invoices.reduce((s, i) => s + i.totalFee, 0)
  const paid = invoices.filter((i) => i.status === 'paid')
  const unpaid = invoices.filter((i) => i.status !== 'paid' && i.totalFee > 0)
  const overdue = unpaid.filter(isOverdue)

  return (
    <div className="flex flex-col gap-stack">
      <div className="grid grid-cols-3 gap-stack max-[900px]:grid-cols-1">
        <Stat
          label="Billed"
          value={fmtMoney(billed)}
          sub={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`}
          Icon={Receipt}
          tone="text-accent"
        />
        <Stat
          label="Paid"
          value={fmtMoney(paid.reduce((s, i) => s + i.totalFee, 0))}
          sub={`${paid.length} paid`}
          Icon={CheckCircle2}
          tone="text-green"
        />
        <Stat
          label="Outstanding"
          value={fmtMoney(unpaid.reduce((s, i) => s + i.totalFee, 0))}
          sub={overdue.length > 0 ? `${overdue.length} overdue` : `${unpaid.length} unpaid`}
          Icon={Clock}
          tone={overdue.length > 0 ? 'text-red' : 'text-muted'}
        />
      </div>

      <section className={CARD}>
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
              <FileText size={16} />
            </span>
            <div className="min-w-0">
              <div className="font-display text-[15px] font-extrabold">Invoices</div>
              <div className="mt-px text-[12px] text-muted">
                Newest first · each month&apos;s profit as the invoice billed it
              </div>
            </div>
          </div>
          <Link
            to="/admin/invoices"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline"
          >
            Manage in Invoice History <ArrowUpRight size={13} />
          </Link>
        </div>

        {!data ? (
          <div className="grid min-h-[140px] place-items-center px-4 text-center text-[13px] text-muted">
            {loading ? 'Loading invoices…' : getApiErrorMessage(error, 'Could not load invoices.')}
          </div>
        ) : invoices.length === 0 ? (
          <div className="grid min-h-[140px] place-items-center rounded-row border border-dashed border-border bg-surface2 px-4 text-center text-[13px] text-muted">
            No invoices yet for this user{exchange === 'all' ? '' : ' on this exchange'}.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Period</th>
                    <th className={TH}>Exchange</th>
                    <th className={TH}>Closed profit</th>
                    <th className={TH}>Open P&amp;L</th>
                    <th className={TH}>Our fee</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Due</th>
                    <th className={TH}>Paid</th>
                    <th className={TH}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const pill = statusPill(inv)
                    return (
                      <tr key={`${inv.exchange}-${inv.id}`} className="transition-colors hover:bg-surface2">
                        <td className={TD}>
                          <div className="font-semibold">{inv.monthLabel}</div>
                          <div className="font-mono text-[11px] text-faint">{inv.formattedId}</div>
                        </td>
                        <td className={TD}>
                          <ExchangeBadge exchange={inv.exchange} />
                        </td>
                        <td className={`${TD} font-mono font-bold ${inv.realizedPnl < 0 ? 'text-red' : 'text-green'}`}>
                          {fmtSignedMoney(inv.realizedPnl)}
                        </td>
                        <td className={`${TD} font-mono ${inv.unrealizedPnl < 0 ? 'text-red' : 'text-muted'}`}>
                          {inv.unrealizedPnl === 0 ? '—' : fmtSignedMoney(inv.unrealizedPnl)}
                        </td>
                        <td className={`${TD} font-mono font-bold`}>{fmtMoney(inv.totalFee)}</td>
                        <td className={TD}>
                          <span className={`${PILL} ${pill.cls}`}>{pill.label}</span>
                        </td>
                        <td className={`${TD} font-mono text-[12px] ${isOverdue(inv) ? 'text-red' : 'text-muted'}`}>
                          {inv.dueDate ? fmtMediumDate(inv.dueDate) : '—'}
                        </td>
                        <td className={`${TD} font-mono text-[12px] text-muted`}>
                          {inv.paidDate ? fmtMediumDate(inv.paidDate) : '—'}
                        </td>
                        <td className={`${TD} text-right`}>
                          <button type="button" className={VIEW_BTN} onClick={() => setViewing(asRow(inv))}>
                            <Eye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11.5px] font-semibold text-muted leading-[1.5]">
              Closed profit is the month&apos;s closed-trade P&amp;L the invoice was billed on — after
              exchange fees for trades from Sep 11, 2026. Open P&amp;L is what was still open at month end.
            </p>
          </>
        )}
      </section>

      <AdminInvoiceDetailModal
        invoice={viewing}
        onClose={() => setViewing(null)}
        onViewDocument={(inv) => setDocInvoice(inv)}
      />
      <InvoiceDocumentModal
        open={docInvoice !== null}
        invoice={docInvoice}
        customer={docInvoice ? { name: docInvoice.userName, email: docInvoice.userEmail } : null}
        onClose={() => setDocInvoice(null)}
      />
    </div>
  )
}
