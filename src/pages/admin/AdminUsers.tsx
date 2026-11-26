import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import Tabs, { type TabItem } from '../../components/ui/Tabs'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import CreateUserModal from '../../components/admin/CreateUserModal'
import { BADGE, RoleBadge, StatusBadge } from '../../components/admin/badges'
import RolePicker from '../../components/admin/RolePicker'
import UserBalanceCell from '../../components/admin/UserBalanceCell'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../../components/exchanges/meta'
import SearchField from '../../components/ui/filters/SearchField'
import { useApiData } from '../../hooks/useApiData'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useUrlFilters } from '../../hooks/useUrlFilters'
import { rememberUsersList } from '../../lib/adminUsersReturn'
import type { AllowedValues } from '../../lib/urlFilters'
import { hasOwnFeed, isCollaborator } from '../../lib/roles'
import {
  acceptUser,
  createAdminUser,
  getAdminUsers,
  rejectUser,
  updateAdminUser,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { fmtMediumDate, fmtMoney, fmtSignedMoney } from '../../lib/format'
import TradingBadge from '../../components/admin/users/TradingBadge'
import PaidViaBadge from '../../components/admin/invoices/PaidViaBadge'
import type {
  AdminUser,
  AdminUserCreateInput,
  UserRole,
  UserStatus,
} from '../../types/admin'
import type { ExchangeKind } from '../../types/exchanges'

type StatusFilter = 'all' | UserStatus
type RoleFilter = 'all' | UserRole

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
]

/**
 * Customers and staff are two lists: a customer is `type = 'user'` (the rule
 * the admin dashboard counts by), everyone else is staff. Customers first —
 * they are who this page is mostly for.
 */
type Group = 'users' | 'staff'
const isStaff = (u: AdminUser) => u.type !== 'user'
/**
 * Pending AND proved the address. An unverified sign-up stays listed under the
 * Pending filter (staff can still find it) but is not yet waiting on anyone.
 */
const awaitsApproval = (u: AdminUser) =>
  u.status === 'pending' && u.email_verified !== false

/** Staff roles only — the Users tab holds a single role, so it has no picker. */
const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'All roles' },
  { key: 'master', label: 'Master' },
  { key: 'admin', label: 'Admin' },
  { key: 'developer', label: 'Developer' },
  { key: 'collaborator', label: 'Collaborator' },
  { key: 'tester', label: 'Tester' },
  { key: 'submaster', label: 'Sub-master' },
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
  collaborator:
    'They get a read-only view of the admin portal — the dashboard overview, users and strategies — and can change nothing.',
  tester:
    'An internal test account: they get the admin portal (not the database console), their exchange accounts receive only the test feed (never the main TradingView signals), and they are never billed. Refused while they hold an open position.',
  submaster:
    'A second house account: trader dashboard only (no admin portal), their exchange accounts trade only the sub-master feed with real money (never the main TradingView signals), they are never billed, and their streak sizing follows their own trades. Refused while they hold an open position.',
}

/** The feed a role's exchange accounts trade, as the confirm sentence names it. */
function feedName(role: UserRole | undefined): string {
  if (role === 'tester') return 'the test feed'
  if (role === 'submaster') return 'the sub-master feed'
  return 'the main TradingView signals'
}

/**
 * The confirm dialog's sentence. Leaving `tester` or `submaster` is its own
 * case: the accounts switch feeds, so the API refuses it while a position is
 * open (409 OPEN_POSITIONS) — said up front rather than only on refusal.
 * Entering one already says so in ROLE_EFFECT.
 */
function roleEffect({ user, role }: PendingRole): string {
  if (!hasOwnFeed(user.type) || role === user.type) return ROLE_EFFECT[role]
  const feeds = `Their exchange accounts move from ${feedName(user.type)} to ${feedName(role)}. Refused while they hold an open position.`
  // Entering the other own-feed role: its sentence already names the feed.
  if (hasOwnFeed(role)) return ROLE_EFFECT[role].replace(' Refused while they hold an open position.', '') + ` ${feeds}`
  if (role === 'user') {
    // A sub-master never had the portal, so "they lose the admin portal" would be wrong.
    return `They become a customer: billed like everyone else and counted as one. ${feeds}`
  }
  return `${ROLE_EFFECT[role]} ${feeds}`
}

/** "Who needs action" chips on the Users tab (the admin audit, 2026-11-11). */
type ActionFilter = 'all' | 'owes' | 'key' | 'not_trading' | 'never_connected'

const NOT_TRADING: readonly string[] = ['paused_unpaid', 'key_blocked', 'below_min', 'deposit_unknown', 'off']

const ACTION_TEST: Record<Exclude<ActionFilter, 'all'>, (u: AdminUser) => boolean> & {
  all: (u: AdminUser) => boolean
} = {
  all: () => true,
  owes: (u) => (u.owes?.amount ?? 0) > 0,
  key: (u) => u.key_problem === true,
  not_trading: (u) => NOT_TRADING.includes(u.trading?.state ?? ''),
  never_connected: (u) => u.trading?.state === 'no_exchange' && u.status === 'active',
}

const ACTION_FILTERS: { key: ActionFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'Everyone', hint: 'Every customer' },
  { key: 'owes', label: 'Owes money', hint: 'Has an unpaid invoice (red = past its due date)' },
  { key: 'key', label: 'Key problem', hint: 'An exchange refuses their API key' },
  {
    key: 'not_trading',
    label: 'Not trading',
    hint: 'Connected, but the bot is not trading for them: paused for an unpaid invoice, key refused, deposit below the minimum, or switched off',
  },
  { key: 'never_connected', label: 'Never connected', hint: 'Approved, but no exchange account yet' },
]

/**
 * "Connected exchange" (Dima, 2026-11-26): who has an exchange account still
 * connected, on any venue or on one. Demo accounts count (the row tags them);
 * disconnected and sandbox scratch accounts do not — the line the Trading
 * column's "No exchange" / "Disconnected" already draws.
 */
type ExchangeFilter = 'all' | 'connected' | ExchangeKind

const connectedOn = (u: AdminUser, venue?: ExchangeKind) =>
  (u.accounts ?? []).some((a) => !a.deleted_at && !a.sandbox && (venue === undefined || a.exchange === venue))

const exchangeTest = (f: ExchangeFilter) => (u: AdminUser) =>
  f === 'all' || connectedOn(u, f === 'connected' ? undefined : f)

const EXCHANGE_FILTERS: { key: ExchangeFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'Any', hint: 'Every customer, connected or not' },
  {
    key: 'connected',
    label: 'Connected exchange',
    hint: 'Has at least one exchange account still connected (demo accounts included)',
  },
  ...EXCHANGE_ORDER.map((x) => ({
    key: x,
    label: EXCHANGE_META[x].label,
    hint: `Has a ${EXCHANGE_META[x].label} account still connected`,
  })),
]

/**
 * Every filter lives in the page address (2026-11-26), so Back from a
 * customer, a refresh or a pasted link lands on the same list. A value equal
 * to its default stays out of the address; anything not allowed reads as the
 * default. `group` is the old `?group=staff`, so existing links still work.
 */
const URL_DEFAULTS = { group: 'users', status: 'all', action: 'all', exchange: 'all', role: 'all', q: '', page: '1' }
type UrlKeys = typeof URL_DEFAULTS

const URL_ALLOWED: AllowedValues<UrlKeys> = {
  group: ['users', 'staff'],
  status: STATUS_FILTERS.map((s) => s.key),
  action: ACTION_FILTERS.map((f) => f.key),
  exchange: EXCHANGE_FILTERS.map((f) => f.key),
  role: ROLE_FILTERS.map((r) => r.key),
}

interface ChipGroupProps<K extends string> {
  label: string
  items: { key: K; label: string; hint: string }[]
  active: K
  counts: Record<K, number>
  /** The group's "show everyone" key: never highlighted as needing a look. */
  allKey: K
  onPick: (key: K) => void
}

/** One labelled row of filter chips, each with its count. */
function ChipGroup<K extends string>({ label, items, active, counts, allKey, onPick }: ChipGroupProps<K>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 min-w-[92px] text-[11px] font-bold uppercase tracking-[0.08em] text-faint">{label}</span>
      {items.map((f) => {
        const on = active === f.key
        const count = counts[f.key]
        return (
          <button
            key={f.key}
            type="button"
            title={f.hint}
            aria-pressed={on}
            onClick={() => onPick(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12px] font-semibold cursor-pointer ${
              on
                ? 'bg-accent border-accent text-on-accent font-bold'
                : f.key !== allKey && count > 0
                  ? 'border-accent-line bg-surface2 text-text'
                  : 'border-border bg-surface2 text-muted'
            }`}
          >
            {f.label}
            <span className="font-mono text-[11px] opacity-80">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const sessionUser = useSessionUser()
  // Read-only staff: no approvals, no role changes, no account creation. The
  // API refuses every write for this role; the UI simply does not offer one.
  const readOnly = isCollaborator(sessionUser?.type)
  const { data, loading, error, reload } = useApiData(getAdminUsers)

  // Search, status, the Users / Staff tab, role, "Needs action" (customers,
  // the admin audit 2026-11-11), "Exchange" (customers, Dima 2026-11-26) and
  // the page: all in the URL, see URL_DEFAULTS.
  const { filters, setMany } = useUrlFilters(URL_DEFAULTS, { allowed: URL_ALLOWED })
  const group: Group = filters.group === 'staff' ? 'staff' : 'users'
  const statusFilter = filters.status as StatusFilter
  const actionFilter = filters.action as ActionFilter
  const exchangeFilter = filters.exchange as ExchangeFilter
  const roleFilter = filters.role as RoleFilter
  const search = filters.q
  const page = Math.max(1, Number.parseInt(filters.page, 10) || 1)
  /** Any filter change starts again on page 1 — one history entry for both. */
  const setFilters = (patch: Partial<UrlKeys>) => setMany({ ...patch, page: '1' })
  const setPage = (next: number) => setMany({ page: String(next) })

  // "Back to Users" on a customer's page returns to this exact view.
  const { search: listSearch } = useLocation()
  useEffect(() => rememberUsersList(listSearch), [listSearch])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [pendingRole, setPendingRole] = useState<PendingRole | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdEmail, setCreatedEmail] = useState<string | null>(null)

  const users = useMemo(() => data ?? [], [data])

  // Every sign-up waiting for approval, whichever tab is open — the queue
  // above the table must never be hidden by a tab.
  const pendingUsers = useMemo(
    () => users.filter(awaitsApproval),
    [users],
  )

  const inGroup = useMemo(
    () => users.filter((u) => (group === 'staff') === isStaff(u)),
    [users, group],
  )

  const groupTabs: TabItem<Group>[] = useMemo(
    () => [
      {
        key: 'users',
        label: `Users · ${users.filter((u) => !isStaff(u)).length}`,
        Icon: Users,
        badge: users.filter((u) => !isStaff(u) && awaitsApproval(u)).length,
      },
      {
        key: 'staff',
        label: `Staff · ${users.filter(isStaff).length}`,
        Icon: ShieldCheck,
        badge: users.filter((u) => isStaff(u) && awaitsApproval(u)).length,
      },
    ],
    [users],
  )

  const statusCounts = useMemo(
    () => ({
      all: inGroup.length,
      pending: inGroup.filter((u) => u.status === 'pending').length,
      active: inGroup.filter((u) => u.status === 'active').length,
      suspended: inGroup.filter((u) => u.status === 'suspended').length,
    }),
    [inGroup],
  )

  // Search + status + role filters within the open tab; pending users float
  // to the top so approvals are never missed (API already orders pending-first).
  const filtered = useMemo(() => {
    let list = inGroup
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
    if (group === 'staff' && roleFilter !== 'all') {
      list = list.filter((u) => u.type === roleFilter)
    }
    if (group === 'users' && actionFilter !== 'all') {
      list = list.filter(ACTION_TEST[actionFilter])
    }
    if (group === 'users' && exchangeFilter !== 'all') {
      list = list.filter(exchangeTest(exchangeFilter))
    }
    return list
  }, [inGroup, group, search, statusFilter, roleFilter, actionFilter, exchangeFilter])

  const actionCounts = useMemo(
    () =>
      Object.fromEntries(
        ACTION_FILTERS.map((f) => [f.key, f.key === 'all' ? inGroup.length : inGroup.filter(ACTION_TEST[f.key]).length]),
      ) as Record<ActionFilter, number>,
    [inGroup],
  )
  const exchangeCounts = useMemo(
    () =>
      Object.fromEntries(
        EXCHANGE_FILTERS.map((f) => [f.key, inGroup.filter(exchangeTest(f.key)).length]),
      ) as Record<ExchangeFilter, number>,
    [inGroup],
  )
  // The billing columns exist only for full admins (the API sends them to no one else).
  const showStanding = !readOnly && group === 'users'
  const colCount = 6 + (readOnly ? 0 : 1) + (showStanding ? 4 : 0)

  const totalPages = Math.max(1, Math.ceil(filtered.length / USERS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice(
    (safePage - 1) * USERS_PER_PAGE,
    safePage * USERS_PER_PAGE,
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  /**
   * Switch tab; the status chips and the search carry over, the staff-only
   * role filter and the customers-only chips do not.
   */
  const setGroup = (next: Group) => setFilters({ group: next, role: 'all', action: 'all', exchange: 'all' })

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

  const runCreate = async (input: AdminUserCreateInput) => {
    setCreating(true)
    setCreateError(null)
    try {
      const user = await createAdminUser(input)
      setCreateOpen(false)
      // Clear the filters so the new row is actually visible — creating a
      // user while "Pending" is selected must not look like nothing happened.
      setFilters({ ...URL_DEFAULTS, group: user.type === 'user' ? 'users' : 'staff' })
      setCreatedEmail(user.email)
      reload()
    } catch (err) {
      // The API owns the rules (unique email, one master) — show what it said.
      setCreateError(getApiErrorMessage(err, 'Unable to create the account.'))
    } finally {
      setCreating(false)
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
      // The API owns the rules (no self-change, one master, no switching a
      // tester's or sub-master's feed under an open position — 409
      // OPEN_POSITIONS) — show
      // what it said.
      const fallback =
        err instanceof ApiError && err.errorCode === 'OPEN_POSITIONS'
          ? 'This user holds an open position — close it first, then change the role.'
          : 'Unable to change the role.'
      setActionError(getApiErrorMessage(err, fallback))
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
    <AdminLayout
      title="User Management"
      subtitle={readOnly ? 'Browse accounts — view only.' : 'Approve sign-ups and manage accounts.'}
    >
      {/* Pending approvals — action queue so new sign-ups are never missed */}
      {!readOnly && pendingUsers.length > 0 && (
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
                // Sign-ups are customers until an admin gives them a role.
                setFilters({ group: 'users', role: 'all', action: 'all', exchange: 'all', status: 'pending' })
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

      {createdEmail && (
        <p
          className="mb-3.5 flex items-center justify-between gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--green)_30%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] px-3 py-[9px] text-[12.5px] text-green"
          role="status"
        >
          <span>
            Account created for <strong>{createdEmail}</strong>. Send them the
            password — it is not shown again.
          </span>
          <button
            type="button"
            className="flex-none cursor-pointer text-green opacity-70 hover:opacity-100"
            onClick={() => setCreatedEmail(null)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </p>
      )}

      <section
        className="overflow-hidden rounded-card border border-border bg-surface"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        {/* Search, then status chips (left) + Users / Staff tabs (right) */}
        <div className="flex flex-col gap-3 border-b border-hair px-5 py-[18px]">
          {/* Shows every keystroke, writes the URL once typing pauses. */}
          <SearchField
            value={search}
            onChange={(q) => setFilters({ q })}
            placeholder="Search by name or email…"
            ariaLabel="Search users by name or email"
            className="h-10! sm:w-full!"
          />
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
                    onClick={() => setFilters({ status: s.key })}
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
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Tabs tabs={groupTabs} active={group} onChange={setGroup} label="Customers or staff" />
              {group === 'staff' && (
                <label className="flex items-center gap-2 h-9 flex-none rounded-full border border-border bg-surface2 px-3 text-muted">
                  <UserCog size={14} />
                  <select
                    value={roleFilter}
                    onChange={(e) => setFilters({ role: e.target.value })}
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
              )}
              {!readOnly && (
                <button
                  type="button"
                  className="inline-flex h-9 flex-none items-center gap-1.5 rounded-pill bg-accent px-4 text-[12.5px] font-bold text-on-accent cursor-pointer hover:brightness-110"
                  onClick={() => {
                    setCreateError(null)
                    setCreatedEmail(null)
                    setCreateOpen(true)
                  }}
                >
                  <UserPlus size={15} />
                  New User
                </button>
              )}
            </div>
          </div>
        </div>

        {showStanding && (
          <div className="flex flex-col gap-2.5 border-b border-hair px-5 py-3">
            <ChipGroup
              label="Needs action"
              items={ACTION_FILTERS}
              active={actionFilter}
              counts={actionCounts}
              allKey="all"
              onPick={(action) => setFilters({ action })}
            />
            <ChipGroup
              label="Exchange"
              items={EXCHANGE_FILTERS}
              active={exchangeFilter}
              counts={exchangeCounts}
              allKey="all"
              onPick={(exchange) => setFilters({ exchange })}
            />
          </div>
        )}

        {/* Users table — re-mounts on filter/page switch to replay the reveal */}
        <div
          key={`${group}-${statusFilter}-${roleFilter}-${actionFilter}-${exchangeFilter}-${safePage}`}
          className="overflow-x-auto animate-[fadeup_0.35s_ease-out]"
        >
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {/* Balance is for full admins only — a collaborator's table has
                    no such column (owner, 2026-10-19). */}
                {[
                  '',
                  'Name',
                  'Role',
                  'Status',
                  ...(showStanding ? ['Trading', 'Owes', 'Last payment', 'This month'] : []),
                  ...(readOnly ? [] : ['Balance']),
                  'Joined',
                ].map((h, i) => (
                  <th
                    key={i}
                    className={['Balance', 'Owes', 'This month'].includes(h) ? `${TH} text-right` : TH}
                    title={
                      h === 'This month'
                        ? 'Closed profit after exchange fees since the 1st (UTC), real money only'
                        : h === 'Trading'
                          ? 'Is the bot trading for this customer, and if not, why'
                          : undefined
                    }
                  >
                    {h}
                  </th>
                ))}
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="py-10 text-center text-muted">
                    {inGroup.length === 0
                      ? group === 'staff' ? 'No staff accounts yet.' : 'No users yet.'
                      : 'No accounts match your filters.'}
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
                    readOnly={readOnly}
                    showStanding={showStanding}
                    colCount={colCount}
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
              {filtered.length} {group === 'staff' ? 'staff' : 'users'}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className={PAG_BTN}
                onClick={() => setPage(Math.max(1, safePage - 1))}
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
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>

      <CreateUserModal
        open={!readOnly && createOpen}
        saving={creating}
        error={createError}
        onSubmit={runCreate}
        onCancel={() => setCreateOpen(false)}
      />

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
        message={pendingRole ? roleEffect(pendingRole) : undefined}
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
  /** Collaborator view: role shown as a badge, no approve/reject, no API keys. */
  readOnly: boolean
  /** Trading / owes / last payment / this month — full admins, Users tab. */
  showStanding: boolean
  colCount: number
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
  readOnly,
  showStanding,
  colCount,
  isSelf,
  onToggle,
  onAccept,
  onReject,
  onView,
  onRoleSelect,
}: UserRowsProps) {
  // May be omitted from a read-only (collaborator) payload.
  const accounts = user.accounts ?? []
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
        <td className={TD}>
          <span className="block font-bold text-text whitespace-nowrap">{user.name}</span>
          <span className="block text-[11.5px] text-muted">{user.email}</span>
          {/* On a phone the standing columns are a swipe away — repeat the two that matter. */}
          {showStanding && user.trading && (
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
              <TradingBadge verdict={user.trading} />
              {(user.owes?.amount ?? 0) > 0 && (
                <span className={`font-mono text-[11px] font-bold ${user.owes?.overdue ? 'text-red' : 'text-accent'}`}>
                  Owes {fmtMoney(user.owes?.amount ?? 0)}
                </span>
              )}
            </span>
          )}
        </td>
        <td className={TD}>
          {readOnly ? (
            user.type === 'user' ? (
              <span className="text-[12px] text-muted">User</span>
            ) : (
              <RoleBadge role={user.type} />
            )
          ) : (
            <RolePicker
              role={user.type}
              isSelf={isSelf}
              onSelect={(role) => onRoleSelect(role)}
            />
          )}
        </td>
        <td className={TD}>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={user.status} />
            {user.email_verified === false && (
              <span className="rounded-full border border-border bg-surface2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted whitespace-nowrap">
                Email unverified
              </span>
            )}
          </div>
        </td>
        {showStanding && <StandingCells user={user} />}
        {!readOnly && (
          <td className={`${TD} text-right`}>
            <UserBalanceCell accounts={accounts} />
          </td>
        )}
        <td className={`${TD} whitespace-nowrap`}>
          <span className="block font-mono text-[12px] text-muted">
            {user.created_at ? fmtMediumDate(user.created_at) : '—'}
          </span>
          {/* Set at sign-in only — someone who stays signed in shows the day they signed in. */}
          {user.last_activity && (
            <span className="block text-[11px] text-faint" title="Last sign-in">
              Signed in {fmtMediumDate(user.last_activity)}
            </span>
          )}
        </td>
        <td className={`${TD} text-right`}>
          <div className="flex flex-wrap justify-end gap-2">
            {!readOnly && user.status === 'pending' && (
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
          <td className="bg-surface2 py-3 px-3.5" colSpan={colCount - 1}>
            {accounts.length === 0 ? (
              <p className="py-1 text-[12.5px] text-muted">
                No exchange accounts yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {accounts.map((a) => (
                  <div
                    className={`flex flex-wrap items-center gap-4 rounded-[10px] border border-hair bg-surface px-2.5 py-[7px] text-[12.5px] ${
                      a.deleted_at ? 'opacity-[.55]' : ''
                    }`}
                    // Ids repeat across the per-exchange tables — key by both.
                    key={`${a.exchange}-${a.id}`}
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
                    {/* Which venue the key is on — a user can hold one per
                        exchange, so the name alone no longer says. */}
                    <span className="inline-flex items-center gap-1.5 rounded-pill border border-hair bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      <span
                        className="h-1.5 w-1.5 flex-none rounded-full"
                        style={{ background: EXCHANGE_META[a.exchange]?.color ?? 'var(--accent)' }}
                      />
                      {EXCHANGE_META[a.exchange]?.label ?? a.exchange}
                    </span>
                    {!readOnly && (
                      <span className="font-mono text-[12px] text-muted">
                        {a.api_key ?? '—'}
                      </span>
                    )}
                    <span className="flex gap-1.5">
                      <span className={`${BADGE} bg-surface2 border-border text-muted`}>
                        {a.demo ? 'Demo' : 'Live'}
                      </span>
                      <span className={`${BADGE} bg-surface2 border-border text-muted`}>
                        {a.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {a.key_status === 'blocked' && !a.deleted_at && (
                        <span
                          className={`${BADGE} border-transparent bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red`}
                          title={a.key_blocked_at ? `Refused since ${fmtMediumDate(a.key_blocked_at)}` : undefined}
                        >
                          Key blocked
                        </span>
                      )}
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

/** Trading / Owes / Last payment / This month — one customer's standing (API `Admin\\CustomerStatus`). */
function StandingCells({ user }: { user: AdminUser }) {
  const owes = user.owes
  const last = user.last_payment
  const pnl = user.pnl_month ?? 0
  return (
    <>
      <td className={TD}>
        <span className="flex flex-wrap items-center gap-1">
          {user.trading ? <TradingBadge verdict={user.trading} /> : <span className="text-faint">—</span>}
          {user.key_problem && user.trading?.state !== 'key_blocked' && (
            <span className="rounded-pill bg-[color-mix(in_srgb,var(--red)_16%,transparent)] px-[7px] py-[2px] text-[10px] font-bold text-red">
              Key issue
            </span>
          )}
        </span>
      </td>
      <td className={`${TD} text-right whitespace-nowrap`}>
        {owes && owes.amount > 0 ? (
          <span
            className={`font-mono font-bold ${owes.overdue ? 'text-red' : 'text-accent'}`}
            title={owes.overdue ? 'Past its due date' : 'Not due yet'}
          >
            {fmtMoney(owes.amount)}
            {owes.overdue && <span className="block text-[10px] font-bold uppercase tracking-[0.05em]">Overdue</span>}
          </span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className={`${TD} whitespace-nowrap`}>
        {last ? (
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[12px] font-bold text-text">{fmtMoney(last.amount)}</span>
              <PaidViaBadge kind={last.kind} title={last.label} />
            </span>
            {last.paid_at && <span className="text-[11px] text-faint">{fmtMediumDate(last.paid_at)}</span>}
          </span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td
        className={`${TD} text-right font-mono whitespace-nowrap ${pnl > 0 ? 'text-green' : pnl < 0 ? 'text-red' : 'text-faint'}`}
      >
        {pnl === 0 ? '—' : fmtSignedMoney(pnl)}
      </td>
    </>
  )
}
