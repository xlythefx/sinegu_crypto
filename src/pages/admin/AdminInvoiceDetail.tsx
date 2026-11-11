import { useCallback, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ExchangeBadge from '../../components/billing/ExchangeBadge'
import InvoiceWorkings from '../../components/billing/InvoiceWorkings'
import InvoiceDocumentModal from '../../components/billing/InvoiceDocumentModal'
import AdminInvoiceFacts from '../../components/admin/invoices/AdminInvoiceFacts'
import InvoicePaymentCard from '../../components/admin/invoices/InvoicePaymentCard'
import MarkPaidModal from '../../components/admin/invoices/MarkPaidModal'
import PaidViaBadge from '../../components/admin/invoices/PaidViaBadge'
import { paymentKind } from '../../lib/paymentKind'
import { useApiData } from '../../hooks/useApiData'
import { getAdminInvoice, updateInvoice, type ManualPaymentMethod } from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { fmtMoney, formatDate } from '../../lib/format'
import { INVOICE_STATE_LABEL, INVOICE_STATE_PILL, invoiceState } from '../../lib/invoiceStatus'

const BACK_BTN =
  'inline-flex items-center gap-[7px] py-2 px-[13px] border border-border rounded-field bg-surface text-muted text-[13px] font-semibold cursor-pointer transition-colors hover:bg-accent-soft hover:border-accent-line hover:text-accent'
const GHOST_BTN =
  'inline-flex items-center justify-center gap-2 text-[13px] font-semibold bg-surface text-text border border-border py-2.5 px-[18px] rounded-pill cursor-pointer transition-[border-color] duration-150 hover:border-accent'
const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 text-[13px] font-bold bg-accent text-on-accent border border-transparent py-2.5 px-[18px] rounded-pill cursor-pointer transition-[filter] duration-150 enabled:hover:brightness-[1.06] disabled:opacity-50 disabled:cursor-not-allowed'
const PILL = 'inline-block text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill'

/** Where "Back" goes: the page that opened this one, else Invoice History. */
export interface InvoiceBackState {
  backLabel: string
}

/**
 * One invoice on its own page (owner, 2026-11-11 — it was a pop-up on Invoice
 * History): who was billed, the amount, HOW it was paid (card / crypto, with
 * the reference and TronScan link), "how this bill was worked out" and every
 * figure the row holds. Opened from Invoice History and from a customer's
 * profile (Invoices tab, and the month table on Performance Analytics).
 */
export default function AdminInvoiceDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const backState = useLocation().state as InvoiceBackState | null

  const fetchInvoice = useCallback(() => getAdminInvoice(id), [id])
  const { data: invoice, loading, error, reload } = useApiData(fetchInvoice, [fetchInvoice])

  const [docOpen, setDocOpen] = useState(false)
  const [confirmPaid, setConfirmPaid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  // Opened from inside the app: go back to exactly that page (its tab, its
  // scroll). Opened from a link or a refresh: Invoice History.
  const back = () => (backState ? navigate(-1) : navigate('/admin/invoices'))
  const backButton = (
    <button type="button" className={BACK_BTN} onClick={back}>
      <ArrowLeft size={16} /> {backState?.backLabel ?? 'Back to Invoice History'}
    </button>
  )

  if (!invoice) {
    return (
      <AdminLayout title="Invoice" subtitle="One invoice in full.">
        <div className="mb-3.5">{backButton}</div>
        <DataState loading={loading} error={error} onRetry={reload} label="invoice" />
      </AdminLayout>
    )
  }

  const paid = invoice.status === 'paid'
  const state = invoiceState(invoice)
  const canMarkPaid = !paid && invoice.totalFee > 0

  // By hand only: says HOW the money came, with a note (2026-11-11).
  const markPaid = async ({ method, note }: { method: ManualPaymentMethod; note: string }) => {
    setBusy(true)
    setActionError(null)
    try {
      await updateInvoice(invoice.id, { status: 'paid', method, note })
      setConfirmPaid(false)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Unable to mark the invoice paid.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout title="Invoice" subtitle={`${invoice.formattedId} · ${invoice.userName ?? 'Customer'}`}>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        {backButton}
        <div className="flex flex-wrap items-center gap-2.5 max-[430px]:w-full max-[430px]:flex-col max-[430px]:items-stretch">
          <button type="button" className={GHOST_BTN} onClick={() => setDocOpen(true)}>
            <FileText size={14} /> Printable invoice
          </button>
          {canMarkPaid && (
            <button
            type="button"
            className={PRIMARY_BTN}
            onClick={() => {
              setActionError(null)
              setConfirmPaid(true)
            }}
            disabled={busy}
          >
              <CheckCircle2 size={14} /> Mark paid
            </button>
          )}
        </div>
      </div>

      {actionError && !confirmPaid && (
        <p className="mb-3.5 rounded-card border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-4 py-3 text-[13px] text-red">
          {actionError}
        </p>
      )}

      {/* who, which month, how much — and how it was paid, first thing */}
      <section
        className="mb-stack rounded-card border border-border bg-surface p-card flex flex-wrap items-end justify-between gap-x-6 gap-y-4"
        data-aos="fade-up"
      >
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-accent">{invoice.formattedId}</p>
          <h2 className="font-display text-[22px] font-extrabold tracking-[-0.01em] leading-tight mt-0.5">
            {invoice.userId ? (
              <Link to={`/admin/users/${invoice.userId}`} className="hover:text-accent transition-colors">
                {invoice.userName ?? 'Customer'}
              </Link>
            ) : (
              (invoice.userName ?? 'Customer')
            )}
          </h2>
          {invoice.userEmail && <p className="text-[12.5px] text-faint mt-0.5 break-all">{invoice.userEmail}</p>}
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className={`${PILL} ${INVOICE_STATE_PILL[state]}`}>{INVOICE_STATE_LABEL[state]}</span>
            <ExchangeBadge exchange={invoice.exchange} />
            <span className="text-[12.5px] text-muted">
              {invoice.accountName} · {invoice.monthLabel}
            </span>
          </div>
        </div>
        <div className="text-right max-[560px]:text-left">
          <p className="text-[10.5px] uppercase tracking-[0.1em] text-faint">{paid ? 'Amount paid' : 'Amount due'}</p>
          <p className="font-mono text-[32px] font-extrabold text-text leading-[1.1] mt-1">
            {fmtMoney(invoice.totalFee)}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-2 flex-wrap justify-end max-[560px]:justify-start text-[12.5px] text-muted">
            {paid ? (
              invoice.totalFee > 0 ? (
                <>
                  Paid on {formatDate(invoice.paidDate)}
                  <PaidViaBadge
                    kind={invoice.payment?.kind ?? paymentKind(invoice.paymentProvider)}
                    title={invoice.payment?.label}
                    size="md"
                  />
                </>
              ) : (
                'No fee this month'
              )
            ) : (
              <span className={state === 'overdue' ? 'text-red font-semibold' : ''}>
                Due by {formatDate(invoice.dueDate)}
              </span>
            )}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-stack items-start max-[1000px]:grid-cols-1">
        <div className="flex flex-col gap-stack min-w-0" data-aos="fade-up" data-aos-delay="80">
          <InvoiceWorkings invoice={invoice} />
        </div>
        <div className="flex flex-col gap-stack min-w-0" data-aos="fade-up" data-aos-delay="140">
          <InvoicePaymentCard invoice={invoice} payment={invoice.payment} />
          <AdminInvoiceFacts invoice={invoice} />
        </div>
      </div>

      <InvoiceDocumentModal
        open={docOpen}
        invoice={docOpen ? invoice : null}
        customer={{ name: invoice.userName, email: invoice.userEmail }}
        onClose={() => setDocOpen(false)}
      />

      <MarkPaidModal
        invoice={confirmPaid ? invoice : null}
        busy={busy}
        error={actionError}
        onConfirm={markPaid}
        onCancel={() => setConfirmPaid(false)}
      />
    </AdminLayout>
  )
}
