import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Eye,
  Search,
  Trash2,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import ExchangeBadge from '../../components/billing/ExchangeBadge'
import InvoiceDocumentModal from '../../components/billing/InvoiceDocumentModal'
import AdminInvoiceDetailModal from '../../components/admin/invoices/AdminInvoiceDetailModal'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../../components/exchanges/meta'
import { useApiData } from '../../hooks/useApiData'
import {
  deleteInvoice,
  getAdminInvoices,
  updateInvoice,
  type AdminInvoiceRow,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { fmtMoney } from '../../lib/format'
import type { ExchangeKind } from '../../types/exchanges'

type StatusFilter = 'all' | 'pending' | 'paid'
type ExchangeFilter = 'all' | ExchangeKind
const PER_PAGE = 10

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Outstanding' },
  { key: 'paid', label: 'Paid' },
]

const STAT_ICON =
  'w-10 h-10 flex-shrink-0 grid place-items-center rounded-[11px] bg-surface2 border border-border'
const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-0 px-3.5 pb-2.5 border-b border-border whitespace-nowrap'
const TD = 'py-3.5 px-3.5 border-b border-hair text-[13px] text-text align-middle'
const CHIP_BASE =
  'border rounded-pill py-[7px] px-3.5 text-[12px] font-semibold cursor-pointer transition-[border-color,color] duration-150'
const PAG_BTN =
  'grid place-items-center w-8 h-8 border border-border bg-surface2 text-text rounded-[9px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

// paid → green tint, pending/overdue → accent tint (preserves original color-mix)
const STATUS_PILL: Record<AdminInvoiceRow['status'], string> = {
  paid: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
  pending: 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent',
}

/** Sort key: overdue, then outstanding, then paid. */
function urgency(i: AdminInvoiceRow): number {
  if (i.status === 'paid') return 2
  return i.isOverdue && i.totalFee > 0 ? 0 : 1
}

interface PendingAction {
  invoice: AdminInvoiceRow
  action: 'markPaid' | 'delete'
}

export default function AdminInvoiceHistory() {
  const { data, loading, error, reload } = useApiData(getAdminInvoices)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<AdminInvoiceRow | null>(null)
  const [docInvoice, setDocInvoice] = useState<AdminInvoiceRow | null>(null)

  const invoices = useMemo(() => data?.invoices ?? [], [data])

  const filtered = useMemo(() => {
    let list = invoices
    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter)
    if (exchangeFilter !== 'all') list = list.filter((i) => i.exchange === exchangeFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((i) =>
        `${i.accountName} ${i.formattedId} ${i.userName ?? ''} ${i.userEmail ?? ''}`
          .toLowerCase()
          .includes(q)
      )
    }
    // Outstanding first (overdue at the very top) — the rows that need an
    // action. A stable sort, so the API's newest-first order holds within
    // each group.
    return [...list].sort((a, b) => urgency(a) - urgency(b))
  }, [invoices, statusFilter, exchangeFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const setFilter = (fn: () => void) => {
    fn()
    setPage(1)
  }

  const runAction = async () => {
    if (!pendingAction) return
    setActionLoading(true)
    setActionError(null)
    try {
      if (pendingAction.action === 'markPaid') {
        await updateInvoice(pendingAction.invoice.id, { status: 'paid' })
      } else {
        await deleteInvoice(pendingAction.invoice.id)
      }
      setPendingAction(null)
      setViewing(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Unable to update invoice.'))
      setPendingAction(null)
    } finally {
      setActionLoading(false)
    }
  }

  if (!data) {
    return (
      <AdminLayout title="Invoice History" subtitle="View, settle, and manage every invoice.">
        <DataState loading={loading} error={error} onRetry={reload} label="invoices" />
      </AdminLayout>
    )
  }

  const { summary } = data

  return (
    <AdminLayout title="Invoice History" subtitle="View, settle, and manage every invoice.">
      {/* summary stat cards */}
      <div
        className="grid grid-cols-4 gap-[14px] mb-[18px] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1"
        data-aos="fade-up"
      >
        <div className="rounded-card border border-border bg-surface p-card flex items-center gap-[13px]">
          <span className={`${STAT_ICON} text-muted`}><DollarSign size={18} /></span>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]">Total Collected</p>
            <p className="text-[19px] font-bold text-text leading-[1.1] font-mono">{fmtMoney(summary.totalCollected)}</p>
          </div>
        </div>
        <div className="rounded-card border border-border bg-surface p-card flex items-center gap-[13px]">
          <span className={`${STAT_ICON} text-green`}><CheckCircle2 size={18} /></span>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]">Paid Invoices</p>
            <p className="text-[19px] font-bold text-text leading-[1.1] font-mono">{summary.countPaid}</p>
          </div>
        </div>
        <div className="rounded-card border border-border bg-surface p-card flex items-center gap-[13px]">
          <span className={`${STAT_ICON} text-accent`}><Clock size={18} /></span>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]">Outstanding</p>
            <p className="text-[19px] font-bold text-text leading-[1.1] font-mono">{summary.countPending}</p>
          </div>
        </div>
        <div className="rounded-card border border-border bg-surface p-card flex items-center gap-[13px]">
          <span className={`${STAT_ICON} text-muted`}><DollarSign size={18} /></span>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]">Outstanding Amount</p>
            <p className="text-[19px] font-bold text-text leading-[1.1] font-mono">{fmtMoney(summary.outstandingAmount)}</p>
          </div>
        </div>
      </div>

      {actionError && (
        <p className="text-red text-[13px] mb-3" role="alert">{actionError}</p>
      )}

      <section
        className="rounded-card border border-border bg-surface p-[18px]"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        {/* filters */}
        <div className="flex flex-col gap-3 mb-4">
          <label className="flex items-center gap-[9px] border border-border rounded-[12px] bg-surface2 px-3.5 text-muted max-w-[340px]">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search account, invoice #, user…"
              value={search}
              onChange={(e) => setFilter(() => setSearch(e.target.value))}
              className="flex-1 h-10 border-none outline-none bg-transparent text-text text-[13px] font-body"
            />
          </label>
          <div className="flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`${CHIP_BASE} ${
                    statusFilter === s.key
                      ? 'bg-accent border-accent text-on-accent'
                      : 'border-border bg-surface2 text-muted hover:text-text hover:border-accent'
                  }`}
                  onClick={() => setFilter(() => setStatusFilter(s.key))}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <select
              className="h-[38px] border border-border rounded-[12px] bg-surface2 text-text px-3 text-[12.5px] font-body cursor-pointer"
              value={exchangeFilter}
              onChange={(e) => setFilter(() => setExchangeFilter(e.target.value as ExchangeFilter))}
              aria-label="Filter by exchange"
            >
              <option value="all">All exchanges</option>
              {EXCHANGE_ORDER.map((k) => (
                <option key={k} value={k}>{EXCHANGE_META[k].label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* table — key excludes search so typing doesn't replay the reveal */}
        <div
          key={`${statusFilter}-${exchangeFilter}`}
          className="overflow-x-auto animate-[fadeup_0.35s_ease-out]"
        >
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr>
                <th className={TH}>Invoice</th>
                <th className={TH}>User</th>
                <th className={TH}>Account</th>
                <th className={TH}>Period</th>
                <th className={`${TH} text-right`}>Total Fee</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-[34px] text-[13px]">
                    {invoices.length === 0
                      ? 'No invoices yet. Generate one from the Sandbox.'
                      : 'No invoices match your filters.'}
                  </td>
                </tr>
              )}
              {paginated.map((inv) => (
                <tr
                  key={inv.id}
                  className="cursor-pointer transition-colors duration-150 hover:bg-surface2"
                  onClick={() => setViewing(inv)}
                >
                  <td className={`${TD} font-mono`}>{inv.formattedId}</td>
                  <td className={TD}>
                    <span className="block font-semibold">{inv.userName ?? '—'}</span>
                    <span className="block text-[11px] text-faint">{inv.userEmail ?? ''}</span>
                  </td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-2 flex-wrap">
                      {inv.accountName}
                      <ExchangeBadge exchange={inv.exchange} />
                    </span>
                  </td>
                  <td className={`${TD} text-muted`}>{inv.monthLabel}</td>
                  <td className={`${TD} text-right font-mono`}>{fmtMoney(inv.totalFee)}</td>
                  <td className={TD}>
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill ${STATUS_PILL[inv.status]}`}
                    >
                      {inv.status === 'paid' ? 'Paid' : inv.isOverdue && inv.totalFee > 0 ? 'Overdue' : 'Outstanding'}
                    </span>
                  </td>
                  <td className={`${TD} text-right`}>
                    <div className="inline-flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-[5px] rounded-[9px] py-[7px] px-3 text-[12px] font-semibold cursor-pointer border border-border bg-surface2 text-text transition-[border-color] duration-150 hover:border-accent"
                        onClick={() => setViewing(inv)}
                      >
                        <Eye size={13} /> View
                      </button>
                      {inv.status !== 'paid' && inv.totalFee > 0 && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-[5px] rounded-[9px] py-[7px] px-3 text-[12px] font-semibold cursor-pointer border border-transparent bg-accent text-on-accent transition-[border-color,filter] duration-150 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:brightness-[1.06]"
                          disabled={actionLoading}
                          onClick={() => setPendingAction({ invoice: inv, action: 'markPaid' })}
                        >
                          <CheckCircle2 size={13} /> Mark paid
                        </button>
                      )}
                      <button
                        type="button"
                        className="inline-flex items-center gap-[5px] rounded-[9px] py-[7px] px-2.5 text-[12px] font-semibold cursor-pointer border border-border bg-surface2 text-muted transition-[border-color,filter] duration-150 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:border-red enabled:hover:text-red"
                        disabled={actionLoading}
                        onClick={() => setPendingAction({ invoice: inv, action: 'delete' })}
                        aria-label="Delete invoice"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-2.5 mt-4 pt-3.5 border-t border-hair">
            <span className="text-[12px] text-faint">
              Showing {(safePage - 1) * PER_PAGE + 1}–
              {Math.min(safePage * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className={PAG_BTN}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-[12.5px] text-muted">Page {safePage} of {totalPages}</span>
              <button
                type="button"
                className={PAG_BTN}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>

      <AdminInvoiceDetailModal
        invoice={viewing}
        onClose={() => setViewing(null)}
        onViewDocument={(inv) => setDocInvoice(inv)}
        onMarkPaid={
          viewing && viewing.status !== 'paid' && viewing.totalFee > 0
            ? (inv) => setPendingAction({ invoice: inv, action: 'markPaid' })
            : undefined
        }
        busy={actionLoading}
      />

      <InvoiceDocumentModal
        open={docInvoice !== null}
        invoice={docInvoice}
        customer={docInvoice ? { name: docInvoice.userName, email: docInvoice.userEmail } : null}
        onClose={() => setDocInvoice(null)}
      />

      <ConfirmModal
        open={pendingAction !== null}
        title={
          pendingAction?.action === 'markPaid'
            ? `Mark ${pendingAction?.invoice.formattedId} paid?`
            : `Delete ${pendingAction?.invoice.formattedId}?`
        }
        message={
          pendingAction?.action === 'markPaid'
            ? `This settles the invoice (${fmtMoney(pendingAction?.invoice.totalFee ?? 0)}), locks in the new high-water mark, and re-enables the account.`
            : 'This permanently removes the invoice. This cannot be undone.'
        }
        confirmLabel={
          actionLoading
            ? 'Working…'
            : pendingAction?.action === 'markPaid'
              ? 'Yes, mark paid'
              : 'Yes, delete'
        }
        cancelLabel="No"
        danger={pendingAction?.action === 'delete'}
        onConfirm={runAction}
        onCancel={() => setPendingAction(null)}
      />
    </AdminLayout>
  )
}
