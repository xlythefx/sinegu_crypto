import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Search,
  Trash2,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import ExchangeBadge from '../../components/billing/ExchangeBadge'
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
import './AdminInvoiceHistory.css'

type StatusFilter = 'all' | 'pending' | 'paid'
type ExchangeFilter = 'all' | ExchangeKind
const PER_PAGE = 10

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Outstanding' },
  { key: 'paid', label: 'Paid' },
]

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
    return list
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
      <div className="ainv-stats" data-aos="fade-up">
        <div className="dcard ainv-stat">
          <span className="ainv-stat__icon"><DollarSign size={18} /></span>
          <div>
            <p className="ainv-stat__label">Total Collected</p>
            <p className="ainv-stat__value mono">{fmtMoney(summary.totalCollected)}</p>
          </div>
        </div>
        <div className="dcard ainv-stat">
          <span className="ainv-stat__icon is-pos"><CheckCircle2 size={18} /></span>
          <div>
            <p className="ainv-stat__label">Paid Invoices</p>
            <p className="ainv-stat__value mono">{summary.countPaid}</p>
          </div>
        </div>
        <div className="dcard ainv-stat">
          <span className="ainv-stat__icon is-warn"><Clock size={18} /></span>
          <div>
            <p className="ainv-stat__label">Outstanding</p>
            <p className="ainv-stat__value mono">{summary.countPending}</p>
          </div>
        </div>
        <div className="dcard ainv-stat">
          <span className="ainv-stat__icon"><DollarSign size={18} /></span>
          <div>
            <p className="ainv-stat__label">Outstanding Amount</p>
            <p className="ainv-stat__value mono">{fmtMoney(summary.outstandingAmount)}</p>
          </div>
        </div>
      </div>

      {actionError && (
        <p className="ainv-error" role="alert">{actionError}</p>
      )}

      <section className="dcard ainv-panel" data-aos="fade-up" data-aos-delay="100">
        {/* filters */}
        <div className="ainv-filters">
          <label className="ainv-search">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search account, invoice #, user…"
              value={search}
              onChange={(e) => setFilter(() => setSearch(e.target.value))}
            />
          </label>
          <div className="ainv-filter-row">
            <div className="ainv-chips">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`ainv-chip${statusFilter === s.key ? ' is-active' : ''}`}
                  onClick={() => setFilter(() => setStatusFilter(s.key))}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <select
              className="ainv-select"
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

        {/* table */}
        <div className="ainv-table-wrap">
          <table className="ainv-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>User</th>
                <th>Account</th>
                <th>Period</th>
                <th className="ainv-th--right">Total Fee</th>
                <th>Status</th>
                <th className="ainv-th--right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="ainv-empty">
                    {invoices.length === 0
                      ? 'No invoices yet. Generate one from the Sandbox.'
                      : 'No invoices match your filters.'}
                  </td>
                </tr>
              )}
              {paginated.map((inv) => (
                <tr key={inv.id}>
                  <td className="ainv-td mono">{inv.formattedId}</td>
                  <td className="ainv-td">
                    <span className="ainv-user__name">{inv.userName ?? '—'}</span>
                    <span className="ainv-user__email">{inv.userEmail ?? ''}</span>
                  </td>
                  <td className="ainv-td">
                    <span className="ainv-acct">
                      {inv.accountName}
                      <ExchangeBadge exchange={inv.exchange} />
                    </span>
                  </td>
                  <td className="ainv-td ainv-td--muted">{inv.monthLabel}</td>
                  <td className="ainv-td ainv-td--right mono">{fmtMoney(inv.totalFee)}</td>
                  <td className="ainv-td">
                    <span className={`ainv-badge ainv-badge--${inv.status}`}>
                      {inv.status === 'paid' ? 'Paid' : inv.isOverdue && inv.totalFee > 0 ? 'Overdue' : 'Outstanding'}
                    </span>
                  </td>
                  <td className="ainv-td ainv-td--right">
                    <div className="ainv-actions">
                      {inv.status !== 'paid' && inv.totalFee > 0 && (
                        <button
                          type="button"
                          className="ainv-btn ainv-btn--pay"
                          disabled={actionLoading}
                          onClick={() => setPendingAction({ invoice: inv, action: 'markPaid' })}
                        >
                          <CheckCircle2 size={13} /> Mark paid
                        </button>
                      )}
                      <button
                        type="button"
                        className="ainv-btn ainv-btn--del"
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
          <div className="ainv-pag">
            <span className="ainv-pag__info">
              Showing {(safePage - 1) * PER_PAGE + 1}–
              {Math.min(safePage * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="ainv-pag__controls">
              <button
                type="button"
                className="ainv-pag__btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="ainv-pag__page">Page {safePage} of {totalPages}</span>
              <button
                type="button"
                className="ainv-pag__btn"
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
