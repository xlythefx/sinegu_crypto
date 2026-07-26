import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Search,
  Shield,
  UserCog,
  X,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useApiData } from '../../hooks/useApiData'
import { acceptUser, getAdminUsers, rejectUser } from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { fmtMediumDate, fmtMoney } from '../../lib/format'
import type { AdminUser, UserRole, UserStatus } from '../../types/admin'
import './AdminUsers.css'

type StatusFilter = 'all' | UserStatus
type RoleFilter = 'all' | UserRole

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
]

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'All roles' },
  { key: 'master', label: 'Master' },
  { key: 'admin', label: 'Admin' },
  { key: 'user', label: 'User' },
]

const USERS_PER_PAGE = 10

/** Crown for master, shield for admin — plain users get no badge. */
function RoleBadge({ role }: { role: UserRole }) {
  if (role === 'master') {
    return (
      <span className="ausers-badge ausers-badge--master">
        <Crown size={11} />
        Master
      </span>
    )
  }
  if (role === 'admin') {
    return (
      <span className="ausers-badge ausers-badge--admin">
        <Shield size={11} />
        Admin
      </span>
    )
  }
  return null
}

function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={`ausers-badge ausers-badge--${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

/** Pending accept / reject action target. */
interface PendingAction {
  user: AdminUser
  action: 'accept' | 'reject'
}

export default function AdminUsers() {
  const { data, loading, error, reload } = useApiData(getAdminUsers)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const users = useMemo(() => data ?? [], [data])

  const pendingUsers = useMemo(
    () => users.filter((u) => u.status === 'pending'),
    [users],
  )

  const statusCounts = useMemo(
    () => ({
      all: users.length,
      pending: pendingUsers.length,
      active: users.filter((u) => u.status === 'active').length,
      suspended: users.filter((u) => u.status === 'suspended').length,
    }),
    [users, pendingUsers],
  )

  // Search + status + role filters; pending users float to the top so
  // approvals are never missed (API already orders pending-first).
  const filtered = useMemo(() => {
    let list = users
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
    }
    if (statusFilter !== 'all') {
      list = list.filter((u) => u.status === statusFilter)
    }
    if (roleFilter !== 'all') {
      list = list.filter((u) => u.type === roleFilter)
    }
    return list
  }, [users, search, statusFilter, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / USERS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice(
    (safePage - 1) * USERS_PER_PAGE,
    safePage * USERS_PER_PAGE,
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const setFilterAndResetPage = (fn: () => void) => {
    fn()
    setPage(1)
  }

  const toggleExpanded = (uniId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(uniId)) next.delete(uniId)
      else next.add(uniId)
      return next
    })
  }

  const runPendingAction = async () => {
    if (!pendingAction) return
    setActionLoading(true)
    setActionError(null)
    try {
      if (pendingAction.action === 'accept') {
        await acceptUser(pendingAction.user.uni_id)
      } else {
        await rejectUser(pendingAction.user.uni_id)
      }
      setPendingAction(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Unable to update user.'))
      setPendingAction(null)
    } finally {
      setActionLoading(false)
    }
  }

  if (!data) {
    return (
      <AdminLayout title="User Management" subtitle="Approve sign-ups and manage accounts.">
        <DataState loading={loading} error={error} onRetry={reload} label="users" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="User Management" subtitle="Approve sign-ups and manage accounts.">
      {/* Pending approvals — action queue so new sign-ups are never missed */}
      {pendingUsers.length > 0 && (
        <section className="ausers-pending" data-aos="fade-up">
          <div className="ausers-pending__head">
            <span className="ausers-pending__icon">
              <Clock size={18} />
              <span className="ausers-pending__count">
                {pendingUsers.length}
              </span>
            </span>
            <div>
              <div className="ausers-pending__title">
                {pendingUsers.length} account
                {pendingUsers.length > 1 ? 's' : ''} awaiting approval
              </div>
              <div className="ausers-pending__sub">
                New sign-ups need review before they can connect an exchange
              </div>
            </div>
          </div>
          <div className="ausers-pending__list">
            {pendingUsers.slice(0, 6).map((u) => (
              <div className="ausers-pending__row" key={u.uni_id}>
                <div className="ausers-pending__id">
                  <span className="ausers-pending__name">
                    {u.name || '—'}
                  </span>
                  <span className="ausers-pending__email">{u.email}</span>
                </div>
                <div className="ausers-pending__actions">
                  <button
                    type="button"
                    className="ausers-btn ausers-btn--accept"
                    disabled={actionLoading}
                    onClick={() => setPendingAction({ user: u, action: 'accept' })}
                  >
                    <Check size={13} />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="ausers-btn ausers-btn--reject"
                    disabled={actionLoading}
                    onClick={() => setPendingAction({ user: u, action: 'reject' })}
                  >
                    <X size={13} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
          {pendingUsers.length > 6 && (
            <button
              type="button"
              className="ausers-pending__more"
              onClick={() =>
                setFilterAndResetPage(() => setStatusFilter('pending'))
              }
            >
              +{pendingUsers.length - 6} more — view all pending
            </button>
          )}
        </section>
      )}

      {actionError && (
        <p className="ausers-error" role="alert">
          {actionError}
        </p>
      )}

      <section
        className="ausers-panel"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        {/* Search + filters */}
        <div className="ausers-filters">
          <label className="ausers-search">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) =>
                setFilterAndResetPage(() => setSearch(e.target.value))
              }
              className="ausers-search__input"
            />
          </label>
          <div className="ausers-filter-row">
            <div className="ausers-chips">
              {STATUS_FILTERS.map((s) => {
                const active = statusFilter === s.key
                const alert = s.key === 'pending' && statusCounts.pending > 0
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`ausers-chip${
                      active ? ' ausers-chip--active' : alert ? ' ausers-chip--alert' : ''
                    }`}
                    onClick={() =>
                      setFilterAndResetPage(() => setStatusFilter(s.key))
                    }
                  >
                    {s.label}
                    <span
                      className={`ausers-chip__count${
                        active ? ' ausers-chip__count--active' : ''
                      }`}
                    >
                      {statusCounts[s.key]}
                    </span>
                  </button>
                )
              })}
            </div>
            <label className="ausers-role">
              <UserCog size={14} />
              <select
                value={roleFilter}
                onChange={(e) =>
                  setFilterAndResetPage(() =>
                    setRoleFilter(e.target.value as RoleFilter),
                  )
                }
                aria-label="Filter by role"
                className="ausers-role__select"
              >
                {ROLE_FILTERS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Users table */}
        <div className="ausers-table-wrap">
          <table className="ausers-table">
            <thead>
              <tr>
                {['', 'Name', 'Email', 'Role', 'Status', 'Joined'].map((h, i) => (
                  <th key={i} className="ausers-th">
                    {h}
                  </th>
                ))}
                <th className="ausers-th ausers-th--right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="ausers-empty">
                    {users.length === 0
                      ? 'No users yet.'
                      : 'No users match your filters.'}
                  </td>
                </tr>
              )}
              {paginated.map((u) => {
                const isExpanded = expanded.has(u.uni_id)
                return (
                  <UserRows
                    key={u.uni_id}
                    user={u}
                    expanded={isExpanded}
                    actionLoading={actionLoading}
                    onToggle={() => toggleExpanded(u.uni_id)}
                    onAccept={() => setPendingAction({ user: u, action: 'accept' })}
                    onReject={() => setPendingAction({ user: u, action: 'reject' })}
                  />
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="ausers-pag">
            <span className="ausers-pag__info">
              Showing {(safePage - 1) * USERS_PER_PAGE + 1}–
              {Math.min(safePage * USERS_PER_PAGE, filtered.length)} of{' '}
              {filtered.length} users
            </span>
            <div className="ausers-pag__controls">
              <button
                type="button"
                className="ausers-pag__btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="ausers-pag__page">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                className="ausers-pag__btn"
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
          pendingAction?.action === 'accept'
            ? `Approve ${pendingAction?.user.name ?? 'user'}?`
            : `Reject ${pendingAction?.user.name ?? 'user'}?`
        }
        message={
          pendingAction?.action === 'accept'
            ? 'The account becomes active and can connect an exchange to start trading.'
            : 'The account will be suspended and blocked from signing in.'
        }
        confirmLabel={
          actionLoading
            ? 'Working…'
            : pendingAction?.action === 'accept'
              ? 'Yes, approve'
              : 'Yes, reject'
        }
        cancelLabel="No"
        danger={pendingAction?.action === 'reject'}
        onConfirm={runPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </AdminLayout>
  )
}

interface UserRowsProps {
  user: AdminUser
  expanded: boolean
  actionLoading: boolean
  onToggle: () => void
  onAccept: () => void
  onReject: () => void
}

/** Main user row + (when expanded) its exchange-account sub-rows. */
function UserRows({
  user,
  expanded,
  actionLoading,
  onToggle,
  onAccept,
  onReject,
}: UserRowsProps) {
  return (
    <>
      <tr className={user.status === 'pending' ? 'ausers-row--pending' : undefined}>
        <td className="ausers-td">
          <button
            type="button"
            className={`ausers-expand${expanded ? ' ausers-expand--open' : ''}`}
            onClick={onToggle}
            aria-label={expanded ? 'Collapse accounts' : 'Expand accounts'}
          >
            <ChevronDown size={14} />
          </button>
        </td>
        <td className="ausers-td ausers-td--name">
          {user.name}
        </td>
        <td className="ausers-td ausers-td--muted">{user.email}</td>
        <td className="ausers-td">
          <RoleBadge role={user.type} />
          {user.type === 'user' && <span className="ausers-td__user">User</span>}
        </td>
        <td className="ausers-td">
          <StatusBadge status={user.status} />
        </td>
        <td className="ausers-td ausers-td--date">
          {user.created_at ? fmtMediumDate(user.created_at) : '—'}
        </td>
        <td className="ausers-td ausers-td--right">
          {user.status === 'pending' ? (
            <div className="ausers-row-actions">
              <button
                type="button"
                className="ausers-btn ausers-btn--accept"
                disabled={actionLoading}
                onClick={onAccept}
              >
                <Check size={13} />
                Accept
              </button>
              <button
                type="button"
                className="ausers-btn ausers-btn--reject"
                disabled={actionLoading}
                onClick={onReject}
              >
                <X size={13} />
                Reject
              </button>
            </div>
          ) : (
            <span className="ausers-dash">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td className="ausers-sub-spacer" />
          <td className="ausers-sub-cell" colSpan={6}>
            {user.accounts.length === 0 ? (
              <p className="ausers-sub-empty">
                No exchange accounts yet.
              </p>
            ) : (
              <div className="ausers-accts">
                {user.accounts.map((a) => (
                  <div
                    className={`ausers-acct${a.deleted_at ? ' ausers-acct--gone' : ''}`}
                    key={a.id}
                  >
                    <span className="ausers-acct__name">
                      <Building2 size={12} />
                      {a.name}
                      {a.deleted_at && (
                        <span className="ausers-acct__tag">
                          Disconnected
                        </span>
                      )}
                    </span>
                    <span className="ausers-acct__key">
                      {a.api_key ?? '—'}
                    </span>
                    <span className="ausers-acct__badges">
                      <span className="ausers-badge ausers-badge--neutral">
                        {a.demo ? 'Demo' : 'Live'}
                      </span>
                      <span className="ausers-badge ausers-badge--neutral">
                        {a.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </span>
                    <span className="ausers-acct__bal">
                      {fmtMoney(a.balance)} {a.currency_type ?? 'USDT'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
