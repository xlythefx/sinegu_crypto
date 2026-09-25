import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import ApiKeyLedgerModal from '../../components/admin/ApiKeyLedgerModal'
import ApiKeyEditModal from '../../components/admin/ApiKeyEditModal'
import ApiKeyStatCards from '../../components/admin/ApiKeyStatCards'
import ApiKeyActionsMenu from '../../components/admin/ApiKeyActionsMenu'
import ExchangeFilterPill, {
  type ExchangePillValue,
} from '../../components/admin/user-detail/ExchangeFilterPill'
import { BADGE } from '../../components/admin/badges'
import { EXCHANGE_META } from '../../components/exchanges/meta'
import { useApiData } from '../../hooks/useApiData'
import {
  bulkDeleteAdminApiKeys,
  deleteAdminApiKey,
  getAdminApiKeys,
  purgeAdminApiKey,
  recheckEngineKey,
  updateAdminApiKey,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { fmtMediumDate, fmtMoney } from '../../lib/format'
import type {
  AdminApiKey,
  AdminApiKeyUpdateInput,
  ApiKeyRef,
} from '../../types/admin'

/**
 * Filters are predicates on the raw row, mirroring the server's `counts`
 * definitions exactly — a chip whose number disagrees with its own list is
 * worse than no chip at all. A disconnected row is never "faulty" or
 * "disabled": it is finished.
 */
type KeyFilter = 'all' | 'connected' | 'faulty' | 'disabled' | 'disconnected'

/**
 * One string per account for selection state and React keys. Accounts live
 * in one table per exchange and ids collide across them, so `id` alone would
 * make a Binance row and a MEXC row the same checkbox.
 */
const refKey = (k: ApiKeyRef): string => `${k.exchange}:${k.id}`
const toRef = (k: AdminApiKey): ApiKeyRef => ({ exchange: k.exchange, id: k.id })

const FILTERS: { key: KeyFilter; label: string; match: (k: AdminApiKey) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'connected', label: 'Connected', match: (k) => !k.deleted_at },
  { key: 'faulty', label: 'Faulty', match: (k) => !k.deleted_at && k.key_blocked },
  { key: 'disabled', label: 'Disabled', match: (k) => !k.deleted_at && !k.enabled },
  { key: 'disconnected', label: 'Disconnected', match: (k) => Boolean(k.deleted_at) },
]

const KEYS_PER_PAGE = 15

const BTN =
  'inline-flex items-center gap-[5px] rounded-pill border py-1.5 px-3 text-[12px] font-bold cursor-pointer transition disabled:opacity-[.55] disabled:cursor-not-allowed'
const BTN_GHOST = `${BTN} bg-transparent border-border text-muted enabled:hover:text-accent enabled:hover:border-accent-line enabled:hover:bg-accent-soft`
const BTN_DANGER = `${BTN} bg-transparent border-[color-mix(in_srgb,var(--red)_40%,transparent)] text-red enabled:hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)]`

const TH =
  'text-left border-b border-hair py-3 px-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint whitespace-nowrap'
const TD = 'border-b border-hair py-3 px-3.5 align-middle'
const PAG_BTN =
  'grid place-items-center w-[30px] h-[30px] rounded-[9px] border border-border bg-surface2 text-text cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const CHECKBOX = 'w-[15px] h-[15px] accent-[var(--accent)] cursor-pointer'

/** Delete confirmation target — one row, or the whole current selection. */
type DeleteTarget =
  | { kind: 'one'; key: AdminApiKey }
  | { kind: 'bulk'; keys: ApiKeyRef[] }

/** Sort weight: broken first, then disabled, then everything else, then gone. */
function rank(k: AdminApiKey): number {
  if (k.deleted_at) return 3
  if (k.key_blocked) return 0
  if (!k.enabled) return 1
  return 2
}

/** The exchange's own words about a refused key, as one line. */
function faultText(k: AdminApiKey): string {
  const parts = [
    k.error_code,
    k.error_message || k.error_reason?.replace(/_/g, ' '),
  ].filter(Boolean)
  return parts.length > 0
    ? parts.join(' · ')
    : 'The exchange is refusing this key.'
}

export default function AdminApiKeys() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApiData(getAdminApiKeys)

  const [filter, setFilter] = useState<KeyFilter>('all')
  const [exchange, setExchange] = useState<ExchangePillValue>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<AdminApiKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [purgeTarget, setPurgeTarget] = useState<AdminApiKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rechecking, setRechecking] = useState<string | null>(null)
  const [ledgerTarget, setLedgerTarget] = useState<AdminApiKey | null>(null)

  const keys = useMemo(() => data?.keys ?? [], [data])
  const counts = data?.counts

  /** Every faulty (and still connected) key — the bulk-cleanup target. */
  const faultyRefs = useMemo(
    () => keys.filter((k) => !k.deleted_at && k.key_blocked).map(toRef),
    [keys],
  )

  const filtered = useMemo(() => {
    const predicate = FILTERS.find((f) => f.key === filter)?.match ?? (() => true)
    let list = keys.filter(predicate)
    if (exchange !== 'all') {
      list = list.filter((k) => k.exchange === exchange)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (k) =>
          k.name.toLowerCase().includes(q) ||
          k.api_key_hint.toLowerCase().includes(q) ||
          k.exchange.includes(q) ||
          (EXCHANGE_META[k.exchange]?.label ?? '').toLowerCase().includes(q) ||
          (k.owner.name ?? '').toLowerCase().includes(q) ||
          (k.owner.email ?? '').toLowerCase().includes(q),
      )
    }
    // Broken keys float to the top of every view, so they are on screen
    // without anyone having to pick a filter first. Within a group the API's
    // newest-first order is preserved (Array.sort is stable).
    return [...list].sort((a, b) => rank(a) - rank(b))
  }, [keys, filter, exchange, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / KEYS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice(
    (safePage - 1) * KEYS_PER_PAGE,
    safePage * KEYS_PER_PAGE,
  )

  // Only connected rows can be disconnected — a deleted row has nothing left
  // to do, so it never carries a checkbox.
  const selectableOnPage = paginated.filter((k) => !k.deleted_at)
  const allPageSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every((k) => selected.has(refKey(k)))

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const setFilterAndResetPage = (fn: () => void) => {
    fn()
    setPage(1)
  }

  const toggleOne = (k: AdminApiKey) => {
    const key = refKey(k)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) selectableOnPage.forEach((k) => next.delete(refKey(k)))
      else selectableOnPage.forEach((k) => next.add(refKey(k)))
      return next
    })
  }

  /** The selected rows as (exchange, id) pairs — what the server takes. */
  const selectedRefs = (): ApiKeyRef[] =>
    keys.filter((k) => selected.has(refKey(k))).map(toRef)

  const runSave = async (input: AdminApiKeyUpdateInput) => {
    if (!editing) return
    setSaving(true)
    setEditError(null)
    try {
      await updateAdminApiKey(toRef(editing), input)
      setEditing(null)
      setNotice('API key updated.')
      reload()
    } catch (err) {
      setEditError(getApiErrorMessage(err, 'Unable to update the API key.'))
    } finally {
      setSaving(false)
    }
  }

  const runDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    setActionError(null)
    try {
      if (deleteTarget.kind === 'one') {
        await deleteAdminApiKey(toRef(deleteTarget.key))
        setNotice(`${deleteTarget.key.name} disconnected.`)
        setSelected((prev) => {
          const next = new Set(prev)
          next.delete(refKey(deleteTarget.key))
          return next
        })
      } else {
        const res = await bulkDeleteAdminApiKeys(deleteTarget.keys)
        setNotice(
          res.skipped > 0
            ? `${res.message} ${res.skipped} were already gone.`
            : res.message,
        )
        setSelected(new Set())
      }
      setDeleteTarget(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Unable to disconnect.'))
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  const runPurge = async () => {
    if (!purgeTarget) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await purgeAdminApiKey(toRef(purgeTarget))
      const wiped = res.removed.trades + res.removed.positions + res.removed.transactions
      setNotice(
        wiped > 0
          ? `${purgeTarget.name} deleted permanently, along with ${wiped} data rows.`
          : `${purgeTarget.name} deleted permanently.`,
      )
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(refKey(purgeTarget))
        return next
      })
      setPurgeTarget(null)
      reload()
    } catch (err) {
      // The server re-checks the guard, so a key that recovered since the page
      // loaded lands here — show its refusal verbatim.
      setActionError(getApiErrorMessage(err, 'Unable to delete the API key.'))
      setPurgeTarget(null)
    } finally {
      setBusy(false)
    }
  }

  /**
   * A real exchange round trip — the only thing that can settle the verdict.
   * A success clears the flag server-side, so we just reload afterwards.
   */
  const runRecheck = async (key: AdminApiKey) => {
    setRechecking(refKey(key))
    setActionError(null)
    try {
      const res = await recheckEngineKey(toRef(key))
      setNotice(`${key.name}: ${res.message}`)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not reach the engine.'))
    } finally {
      setRechecking(null)
    }
  }

  if (!data) {
    return (
      <AdminLayout
        title="API Keys"
        subtitle="Every exchange key on the platform, and who owns it."
      >
        <DataState loading={loading} error={error} onRetry={reload} label="API keys" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title="API Keys"
      subtitle="Every exchange key on the platform, and who owns it."
    >
      {counts && <ApiKeyStatCards counts={counts} graceDays={data.graceDays} />}

      {/* Faulty keys — the action queue. Same shape as the pending-approvals
          banner on User Management, because it is the same kind of job. */}
      {counts && counts.faulty > 0 && (
        <section
          className="mb-[18px] flex flex-wrap items-center gap-4 rounded-card border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_7%,transparent)] px-5 py-4"
          data-aos="fade-up"
        >
          <span className="grid place-items-center w-[42px] h-[42px] flex-none rounded-[12px] bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red">
            <ShieldAlert size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-extrabold">
              {counts.faulty} key{counts.faulty > 1 ? 's are' : ' is'} being
              refused by the exchange
            </div>
            <div className="mt-px text-[12px] text-muted">
              The owner sees “connected” while the balance freezes and no trades
              arrive. They have {data.graceDays} days to allow-list{' '}
              <strong className="font-mono text-text">
                {data.serverIp ?? 'our server IP'}
              </strong>{' '}
              before the account is disconnected automatically.
            </div>
          </div>
          <div className="flex flex-none flex-wrap gap-2">
            <button
              type="button"
              className={BTN_GHOST}
              onClick={() => setFilterAndResetPage(() => setFilter('faulty'))}
            >
              Show faulty
            </button>
            <button
              type="button"
              className={BTN_DANGER}
              onClick={() => setDeleteTarget({ kind: 'bulk', keys: faultyRefs })}
            >
              <Trash2 size={13} />
              Disconnect all {counts.faulty}
            </button>
          </div>
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

      {notice && (
        <p
          className="mb-3.5 flex items-center justify-between gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--green)_30%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] px-3 py-[9px] text-[12.5px] text-green"
          role="status"
        >
          <span>{notice}</span>
          <button
            type="button"
            className="flex-none cursor-pointer text-green opacity-70 hover:opacity-100"
            onClick={() => setNotice(null)}
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
        {/* Search + filters */}
        <div className="flex flex-col gap-3 border-b border-hair px-5 py-[18px]">
          <label className="flex items-center gap-[9px] h-10 rounded-[11px] border border-border bg-surface2 px-[13px] text-muted">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search by owner, account name or key…"
              value={search}
              onChange={(e) =>
                setFilterAndResetPage(() => setSearch(e.target.value))
              }
              className="flex-1 border-0 bg-transparent text-[13px] text-text outline-none placeholder:text-faint"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const active = filter === f.key
                const count = counts ? counts[f.key] : 0
                const alert = f.key === 'faulty' && count > 0
                return (
                  <button
                    key={f.key}
                    type="button"
                    className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold cursor-pointer ${
                      active
                        ? 'bg-accent border-accent text-on-accent font-bold'
                        : alert
                          ? 'border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-surface2 text-red'
                          : 'border-border bg-surface2 text-muted'
                    }`}
                    onClick={() => setFilterAndResetPage(() => setFilter(f.key))}
                  >
                    {f.label}
                    <span
                      className={`grid place-items-center h-[18px] min-w-[18px] px-[5px] rounded-full font-mono text-[11px] font-bold ${
                        active
                          ? 'bg-[rgba(0,0,0,0.18)] border border-transparent text-on-accent'
                          : 'bg-surface border border-hair'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
            {/* Which venue's keys — the same pill the user-detail page uses. */}
            <div className="ml-auto">
              <ExchangeFilterPill
                value={exchange}
                onChange={(value) => setFilterAndResetPage(() => setExchange(value))}
              />
            </div>
          </div>
        </div>

        {/* Selection bar — only present when something is selected */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair bg-accent-soft px-5 py-3">
            <span className="text-[12.5px] font-bold text-text">
              {selected.size} key{selected.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={BTN_GHOST}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
              <button
                type="button"
                className={BTN_DANGER}
                onClick={() =>
                  setDeleteTarget({ kind: 'bulk', keys: selectedRefs() })
                }
              >
                <Trash2 size={13} />
                Disconnect selected
              </button>
            </div>
          </div>
        )}

        {/* Table — re-mounts on filter/page switch to replay the reveal */}
        <div
          key={`${filter}-${exchange}-${safePage}`}
          className="overflow-x-auto animate-[fadeup_0.35s_ease-out]"
        >
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={TH}>
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={allPageSelected}
                    onChange={togglePage}
                    disabled={selectableOnPage.length === 0}
                    aria-label="Select all on this page"
                  />
                </th>
                {['Account', 'Owner', 'API key', 'Status', 'Balance', 'Connected'].map(
                  (h) => (
                    <th key={h} className={TH}>
                      {h}
                    </th>
                  ),
                )}
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted">
                    {keys.length === 0
                      ? 'No exchange accounts have been connected yet.'
                      : 'No keys match your filters.'}
                  </td>
                </tr>
              )}
              {paginated.map((k) => (
                <KeyRow
                  key={refKey(k)}
                  apiKey={k}
                  selected={selected.has(refKey(k))}
                  rechecking={rechecking === refKey(k)}
                  onToggle={() => toggleOne(k)}
                  onEdit={() => {
                    setEditError(null)
                    setEditing(k)
                  }}
                  onRecheck={() => runRecheck(k)}
                  onLedger={() => setLedgerTarget(k)}
                  onDelete={() => setDeleteTarget({ kind: 'one', key: k })}
                  onPurge={() => setPurgeTarget(k)}
                  onViewOwner={() =>
                    k.owner.uni_id && navigate(`/admin/users/${k.owner.uni_id}`)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-[13px] max-[720px]:flex-col max-[720px]:items-start">
            <span className="text-[12.5px] text-muted">
              Showing {(safePage - 1) * KEYS_PER_PAGE + 1}–
              {Math.min(safePage * KEYS_PER_PAGE, filtered.length)} of{' '}
              {filtered.length} keys
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

      <ApiKeyLedgerModal
        apiKey={ledgerTarget}
        onClose={() => setLedgerTarget(null)}
        onApplied={(key, message) => {
          setLedgerTarget(null)
          setNotice(`${key.name}: ${message}`)
          reload()
        }}
      />

      <ApiKeyEditModal
        apiKey={editing}
        saving={saving}
        error={editError}
        onSubmit={runSave}
        onCancel={() => setEditing(null)}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === 'one'
            ? `Disconnect ${deleteTarget.key.name}?`
            : `Disconnect ${deleteTarget?.keys.length ?? 0} API keys?`
        }
        message={
          deleteTarget?.kind === 'one'
            ? `${deleteTarget.key.owner.email ?? 'The owner'} stops trading immediately and frees their account slot. Trade history and invoices are kept.`
            : 'Those accounts stop trading immediately and their owners free up their account slot. Trade history and invoices are kept.'
        }
        confirmLabel={busy ? 'Working…' : 'Yes, disconnect'}
        cancelLabel="No"
        danger
        onConfirm={runDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Permanent delete names what it destroys — "this cannot be undone" is
          not information, a row count is. */}
      <ConfirmModal
        open={purgeTarget !== null}
        title={
          purgeTarget
            ? `Permanently delete ${purgeTarget.name}?`
            : 'Delete permanently?'
        }
        message={
          purgeTarget
            ? `This erases the key and its stored credentials from the database, along with ${purgeTarget.usage.trades} closed trade${
                purgeTarget.usage.trades === 1 ? '' : 's'
              }, ${purgeTarget.usage.positions} open position${
                purgeTarget.usage.positions === 1 ? '' : 's'
              } and ${purgeTarget.usage.transactions} transfer${
                purgeTarget.usage.transactions === 1 ? '' : 's'
              }. It cannot be recovered. Disconnect instead if you only want it to stop trading.`
            : undefined
        }
        confirmLabel={busy ? 'Deleting…' : 'Yes, delete permanently'}
        cancelLabel="No, keep it"
        danger
        onConfirm={runPurge}
        onCancel={() => setPurgeTarget(null)}
      />
    </AdminLayout>
  )
}

interface KeyRowProps {
  apiKey: AdminApiKey
  selected: boolean
  rechecking: boolean
  onToggle: () => void
  onEdit: () => void
  onRecheck: () => void
  onLedger: () => void
  onDelete: () => void
  onPurge: () => void
  onViewOwner: () => void
}

function KeyRow({
  apiKey: k,
  selected,
  rechecking,
  onToggle,
  onEdit,
  onRecheck,
  onLedger,
  onDelete,
  onPurge,
  onViewOwner,
}: KeyRowProps) {
  const gone = Boolean(k.deleted_at)
  const broken = k.key_blocked && !gone

  return (
    <tr
      className={
        broken
          ? 'bg-[color-mix(in_srgb,var(--red)_7%,transparent)] [&>td:first-child]:border-l-[3px] [&>td:first-child]:border-l-red'
          : gone
            ? 'opacity-[.6]'
            : undefined
      }
    >
      <td className={TD}>
        {!gone && (
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${k.name}`}
          />
        )}
      </td>
      <td className={`${TD} whitespace-nowrap`}>
        <div className="flex items-center gap-2 font-bold text-text">
          <KeyRound size={13} className="flex-none text-muted" />
          {k.name}
        </div>
        <div className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-faint">
          <span
            className="h-1.5 w-1.5 flex-none rounded-full"
            style={{ background: EXCHANGE_META[k.exchange]?.color ?? 'var(--accent)' }}
          />
          {EXCHANGE_META[k.exchange]?.label ?? k.exchange}
        </div>
        {/* The exchange's own refusal, spelled out. A support screen that only
            says "Faulty" makes someone go and look this up elsewhere. */}
        {broken && (
          <div className="mt-1 max-w-[280px] whitespace-normal text-[11.5px] leading-[1.45] text-red">
            {faultText(k)}
          </div>
        )}
      </td>
      <td className={TD}>
        {k.owner.uni_id ? (
          <div className="flex flex-col gap-px min-w-0">
            <span className="font-semibold text-text">
              {k.owner.name || '—'}
            </span>
            <span className="truncate text-[12px] text-muted">
              {k.owner.email}
            </span>
          </div>
        ) : (
          <span className="text-muted">Orphaned key</span>
        )}
      </td>
      <td className={`${TD} font-mono text-[12px] text-muted whitespace-nowrap`}>
        {k.api_key_hint}
      </td>
      <td className={TD}>
        <div className="flex flex-wrap gap-1.5">
          {gone && (
            <span className={`${BADGE} bg-surface2 border-border text-muted`}>
              Disconnected
            </span>
          )}
          {!gone && k.key_blocked && (
            <span
              className={`${BADGE} bg-[color-mix(in_srgb,var(--red)_12%,transparent)] border-[color-mix(in_srgb,var(--red)_35%,transparent)] text-red`}
              title={k.error_message ?? undefined}
            >
              Faulty
              {k.days_left !== null && ` · ${Math.max(0, k.days_left)}d left`}
            </span>
          )}
          {!gone && !k.enabled && (
            <span className={`${BADGE} bg-surface2 border-border text-muted`}>
              Disabled
            </span>
          )}
          {!gone && k.enabled && !k.key_blocked && (
            <span
              className={`${BADGE} bg-[color-mix(in_srgb,var(--green)_12%,transparent)] border-[color-mix(in_srgb,var(--green)_35%,transparent)] text-green`}
            >
              Active
            </span>
          )}
          {k.demo && (
            <span className={`${BADGE} bg-surface2 border-border text-muted`}>
              Demo
            </span>
          )}
          {k.is_sandbox && (
            <span className={`${BADGE} bg-accent-soft border-accent-line text-accent`}>
              Sandbox
            </span>
          )}
        </div>
      </td>
      <td className={`${TD} font-mono font-bold text-text whitespace-nowrap`}>
        {k.balance !== null ? (
          <>
            {fmtMoney(k.balance)}{' '}
            <span className="font-normal text-faint">
              {k.currency_type ?? 'USDT'}
            </span>
          </>
        ) : (
          <span className="font-normal text-faint">Awaiting sync</span>
        )}
      </td>
      <td className={`${TD} font-mono text-[12px] text-muted whitespace-nowrap`}>
        {k.created_at ? fmtMediumDate(k.created_at) : '—'}
      </td>
      <td className={`${TD} text-right`}>
        <div className="flex justify-end">
          <ApiKeyActionsMenu
            apiKey={k}
            rechecking={rechecking}
            onViewOwner={onViewOwner}
            onRecheck={onRecheck}
            onEdit={onEdit}
            onLedger={onLedger}
            onDisconnect={onDelete}
            onPurge={onPurge}
          />
        </div>
      </td>
    </tr>
  )
}
