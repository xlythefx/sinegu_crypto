import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Search,
  UserCog,
  X,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { BADGE, StatusBadge } from '../../components/admin/badges'
import RolePicker from '../../components/admin/RolePicker'
import { useApiData } from '../../hooks/useApiData'
import { useSessionUser } from '../../hooks/useSessionUser'
import {
  acceptUser,
  getAdminUsers,
  rejectUser,
  updateAdminUser,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { fmtMediumDate, fmtMoney } from '../../lib/format'
import type { AdminUser, UserRole, UserStatus } from '../../types/admin'

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
  { key: 'developer', label: 'Developer' },
  { key: 'user', label: 'User' },
]

const USERS_PER_PAGE = 10

// Shared class-strings ------------------------------------------------------
// (BADGE / status + role badges now live in components/admin/badges.tsx)
const BTN =
  'inline-flex items-center gap-[5px] rounded-pill border py-1.5 px-3 text-[12px] font-bold cursor-pointer transition disabled:opacity-[.55] disabled:cursor-not-allowed'
const BTN_ACCEPT = `${BTN} bg-green border-green text-white enabled:hover:brightness-110`
const BTN_REJECT = `${BTN} bg-transparent border-[color-mix(in_srgb,var(--red)_40%,transparent)] text-red enabled:hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)]`
const BTN_VIEW = `${BTN} bg-transparent border-border text-muted enabled:hover:text-accent enabled:hover:border-accent-line enabled:hover:bg-accent-soft`

const TH =
  'text-left border-b border-hair py-3 px-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint whitespace-nowrap'
const TD = 'border-b border-hair py-3 px-3.5 align-middle'
const PAG_BTN =
  'grid place-items-center w-[30px] h-[30px] rounded-[9px] border border-border bg-surface2 text-text cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

/** Pending accept / reject action target. */
interface PendingAction {
  user: AdminUser
  action: 'accept' | 'reject'
}

/** Pending role change, held until the confirmation is answered. */
interface PendingRole {
  user: AdminUser
  role: UserRole
}

const ROLE_EFFECT: Record<UserRole, string> = {
  user: 'They lose the admin portal and keep only their trader dashboard.',
  admin: 'They get the admin portal — users, invoices, engine and assets. Not the database console.',
  master: 'This is the house account the master stats and public track record are read from.',
  developer:
    'They get the admin portal plus the database console, and their invoice payments run against the providers’ sandbox instead of real money.',
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const sessionUser = useSessionUser()
  const { data, loading, error, reload } = useApiData(getAdminUsers)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [pendingRole, setPendingRole] = useState<PendingRole | null>(null)
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

  const runRoleChange = async () => {
    if (!pendingRole) return
    setActionLoading(true)
    setActionError(null)
    try {
      await updateAdminUser(pendingRole.user.uni_id, { type: pendingRole.role })
      setPendingRole(null)
      reload()
    } catch (err) {
      // The API owns the rules (no self-change, one master) — show what it said.
      setActionError(getApiErrorMessage(err, 'Unable to change the role.'))
      setPendingRole(null)
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
        <section
          className="mb-[18px] overflow-hidden rounded-card border border-accent-line bg-gradient-to-br from-accent-soft to-surface"
          data-aos="fade-up"
        >
          <div className="flex items-center gap-[13px] border-b border-accent-line px-5 py-4">
            <span className="relative grid place-items-center w-[42px] h-[42px] flex-none rounded-[12px] bg-accent text-on-accent">
              <Clock size={18} />
              <span className="absolute -right-1.5 -top-1.5 grid place-items-center h-[19px] min-w-[19px] px-[5px] rounded-full bg-red text-[11px] font-extrabold text-white">
                {pendingUsers.length}
              </span>
            </span>
            <div>
              <div className="font-display text-[15px] font-extrabold">
                {pendingUsers.length} account
                {pendingUsers.length > 1 ? 's' : ''} awaiting approval
              </div>
              <div className="mt-px text-[12px] text-muted">
                New sign-ups need review before they can connect an exchange
              </div>
            </div>
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            {pendingUsers.slice(0, 6).map((u) => (
              <div
                className="flex items-center justify-between gap-3 border-b border-hair px-5 py-[11px] last:border-b-0 max-[720px]:flex-col max-[720px]:items-start"
                key={u.uni_id}
              >
                <div className="flex flex-col gap-px min-w-0">
                  <span className="text-[13.5px] font-bold text-text">
                    {u.name || '—'}
                  </span>
                  <span className="truncate text-[12px] text-muted">{u.email}</span>
                </div>
                <div className="flex flex-none gap-2">
                  <button
                    type="button"
                    className={BTN_ACCEPT}
                    disabled={actionLoading}
                    onClick={() => setPendingAction({ user: u, action: 'accept' })}
                  >
                    <Check size={13} />
                    Approve
                  </button>
                  <button
                    type="button"
                    className={BTN_REJECT}
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
              className="w-full border-t border-accent-line p-2.5 text-[12.5px] font-bold text-accent cursor-pointer hover:bg-accent-soft"
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
        <p
          className="mb-3.5 rounded-[10px] border border-[color-mix(in_srgb,var(--red)_30%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3 py-[9px] text-[12.5px] text-red"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <section
        className="overflow-hidden rounded-card border border-border bg-surface"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        {/* Search + filters */}
        <div className="flex flex-col gap-3 border-b border-hair px-5 py-[18px]">
          <label className="flex items-center gap-[9px] h-10 rounded-[11px] border border-border bg-surface2 px-[13px] text-muted">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) =>
                setFilterAndResetPage(() => setSearch(e.target.value))
              }
              className="flex-1 border-0 bg-transparent text-[13px] text-text outline-none placeholder:text-faint"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((s) => {
                const active = statusFilter === s.key
                const alert = s.key === 'pending' && statusCounts.pending > 0
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold cursor-pointer ${
                      active
                        ? 'bg-accent border-accent text-on-accent font-bold'
                        : alert
                          ? 'border-accent-line bg-surface2 text-accent'
                          : 'border-border bg-surface2 text-muted'
                    }`}
                    onClick={() =>
                      setFilterAndResetPage(() => setStatusFilter(s.key))
                    }
                  >
                    {s.label}
                    <span
                      className={`grid place-items-center h-[18px] min-w-[18px] px-[5px] rounded-full font-mono text-[11px] font-bold ${
                        active
                          ? 'bg-[rgba(0,0,0,0.18)] border border-transparent text-on-accent'
                          : 'bg-surface border border-hair'
                      }`}
                    >
                      {statusCounts[s.key]}
                    </span>
                  </button>
                )
              })}
            </div>
            <label className="ml-auto flex items-center gap-2 h-9 flex-none rounded-full border border-border bg-surface2 px-3 text-muted">
              <UserCog size={14} />
              <select
                value={roleFilter}
                onChange={(e) =>
                  setFilterAndResetPage(() =>
                    setRoleFilter(e.target.value as RoleFilter),
                  )
                }
                aria-label="Filter by role"
                className="cursor-pointer border-0 bg-transparent text-[12.5px] font-semibold text-text outline-none"
              >
                {ROLE_FILTERS.map((r) => (
                  <option key={r.key} value={r.key} className="bg-surface text-text">
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Users table — re-mounts on filter/page switch to replay the reveal */}
        <div
          key={`${statusFilter}-${roleFilter}-${safePage}`}
          className="overflow-x-auto animate-[fadeup_0.35s_ease-out]"
        >
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['', 'Name', 'Email', 'Role', 'Status', 'Joined'].map((h, i) => (
                  <th key={i} className={TH}>
                    {h}
                  </th>
                ))}
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
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
                    isSelf={u.uni_id === sessionUser?.uni_id}
                    onToggle={() => toggleExpanded(u.uni_id)}
                    onAccept={() => setPendingAction({ user: u, action: 'accept' })}
                    onReject={() => setPendingAction({ user: u, action: 'reject' })}
                    onView={() => navigate(`/admin/users/${u.uni_id}`)}
                    onRoleSelect={(role) => setPendingRole({ user: u, role })}
                  />
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-[13px] max-[720px]:flex-col max-[720px]:items-start">
            <span className="text-[12.5px] text-muted">
              Showing {(safePage - 1) * USERS_PER_PAGE + 1}–
              {Math.min(safePage * USERS_PER_PAGE, filtered.length)} of{' '}
              {filtered.length} users
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
              <span className="text-[12.5px] font-bold text-text whitespace-nowrap">
                Page {safePage} of {totalPages}
              </span>
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

      <ConfirmModal
        open={pendingRole !== null}
        title={
          pendingRole
            ? `Make ${pendingRole.user.name || 'this user'} a ${pendingRole.role}?`
            : 'Change role?'
        }
        message={pendingRole ? ROLE_EFFECT[pendingRole.role] : undefined}
        confirmLabel={actionLoading ? 'Working…' : 'Yes, change role'}
        cancelLabel="No"
        danger={pendingRole?.role === 'master' || pendingRole?.role === 'developer'}
        onConfirm={runRoleChange}
        onCancel={() => setPendingRole(null)}
      />
    </AdminLayout>
  )
}

interface UserRowsProps {
  user: AdminUser
  expanded: boolean
  actionLoading: boolean
  /** The signed-in admin's own row — self-demotion to `user` is refused. */
  isSelf: boolean
  onToggle: () => void
  onAccept: () => void
  onReject: () => void
  onView: () => void
  onRoleSelect: (role: UserRole) => void
}

/** Main user row + (when expanded) its exchange-account sub-rows. */
function UserRows({
  user,
  expanded,
  actionLoading,
  isSelf,
  onToggle,
  onAccept,
  onReject,
  onView,
  onRoleSelect,
}: UserRowsProps) {
  return (
    <>
      <tr className={user.status === 'pending' ? 'bg-accent-soft' : undefined}>
        <td className={TD}>
          <button
            type="button"
            className={`grid place-items-center w-[26px] h-[26px] rounded-[8px] border bg-surface2 cursor-pointer transition-transform ${
              expanded
                ? 'rotate-180 border-accent-line text-accent'
                : 'border-border text-muted'
            }`}
            onClick={onToggle}
            aria-label={expanded ? 'Collapse accounts' : 'Expand accounts'}
          >
            <ChevronDown size={14} />
          </button>
        </td>
        <td className={`${TD} font-bold text-text whitespace-nowrap`}>
          {user.name}
        </td>
        <td className={`${TD} text-muted`}>{user.email}</td>
        <td className={TD}>
          <RolePicker
            role={user.type}
            isSelf={isSelf}
            onSelect={(role) => onRoleSelect(role)}
          />
        </td>
        <td className={TD}>
          <StatusBadge status={user.status} />
        </td>
        <td className={`${TD} font-mono text-[12px] text-muted whitespace-nowrap`}>
          {user.created_at ? fmtMediumDate(user.created_at) : '—'}
        </td>
        <td className={`${TD} text-right`}>
          <div className="flex flex-wrap justify-end gap-2">
            {user.status === 'pending' && (
              <>
                <button
                  type="button"
                  className={BTN_ACCEPT}
                  disabled={actionLoading}
                  onClick={onAccept}
                >
                  <Check size={13} />
                  Accept
                </button>
                <button
                  type="button"
                  className={BTN_REJECT}
                  disabled={actionLoading}
                  onClick={onReject}
                >
                  <X size={13} />
                  Reject
                </button>
              </>
            )}
            <button type="button" className={BTN_VIEW} onClick={onView}>
              <Eye size={13} />
              View details
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td className="bg-surface2" />
          <td className="bg-surface2 py-3 px-3.5" colSpan={6}>
            {user.accounts.length === 0 ? (
              <p className="py-1 text-[12.5px] text-muted">
                No exchange accounts yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {user.accounts.map((a) => (
                  <div
                    className={`flex flex-wrap items-center gap-4 rounded-[10px] border border-hair bg-surface px-2.5 py-[7px] text-[12.5px] ${
                      a.deleted_at ? 'opacity-[.55]' : ''
                    }`}
                    key={a.id}
                  >
                    <span className="flex items-center gap-[7px] min-w-[140px] font-bold text-text">
                      <Building2 size={12} />
                      {a.name}
                      {a.deleted_at && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-muted">
                          Disconnected
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[12px] text-muted">
                      {a.api_key ?? '—'}
                    </span>
                    <span className="flex gap-1.5">
                      <span className={`${BADGE} bg-surface2 border-border text-muted`}>
                        {a.demo ? 'Demo' : 'Live'}
                      </span>
                      <span className={`${BADGE} bg-surface2 border-border text-muted`}>
                        {a.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </span>
                    <span className="ml-auto font-mono font-bold text-text">
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
