import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  EyeOff,
  Search,
  TriangleAlert,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import TronAttributeModal from '../../components/admin/TronAttributeModal'
import { useApiData } from '../../hooks/useApiData'
import {
  attributeTronTransfer,
  getAdminTronTransfers,
  ignoreTronTransfer,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { fmtMoney } from '../../lib/format'
import { getUser } from '../../lib/session'
import { isDeveloper } from '../../lib/roles'
import type { AdminTronTransfer } from '../../types/admin'

/**
 * Filters are predicates on the raw row, mirroring the server's `counts`
 * exactly — a chip whose number disagrees with its own list is worse than no
 * chip at all.
 */
type TransferFilter = 'all' | 'unmatched' | 'settled' | 'ignored' | 'rejected'

const FILTERS: {
  key: TransferFilter
  label: string
  match: (t: AdminTronTransfer) => boolean
}[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'unmatched', label: 'Needs attention', match: (t) => t.status === 'unmatched' },
  { key: 'settled', label: 'Settled', match: (t) => t.status === 'settled' },
  { key: 'ignored', label: 'Ignored', match: (t) => t.status === 'ignored' },
  { key: 'rejected', label: 'Not payments', match: (t) => t.status === 'rejected' },
]

const PER_PAGE = 15

const BTN =
  'inline-flex items-center gap-[5px] rounded-pill border py-1.5 px-3 text-[12px] font-bold cursor-pointer transition disabled:opacity-[.55] disabled:cursor-not-allowed'
const BTN_GHOST = `${BTN} bg-transparent border-border text-muted enabled:hover:text-accent enabled:hover:border-accent-line enabled:hover:bg-accent-soft`
const BTN_PRIMARY = `${BTN} bg-accent border-accent text-on-accent`
const TH =
  'text-left border-b border-hair py-3 px-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint whitespace-nowrap'
const TD = 'border-b border-hair py-3 px-3.5 align-middle'
const PAG_BTN =
  'grid place-items-center w-[30px] h-[30px] rounded-[9px] border border-border bg-surface2 text-text cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const CHIP_BASE =
  'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] cursor-pointer transition'

const STATUS_PILL: Record<AdminTronTransfer['status'], string> = {
  unmatched:
    'border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-accent-soft text-accent',
  settled: 'border-[color-mix(in_srgb,var(--green)_45%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-green',
  ignored: 'border-border bg-surface2 text-faint',
  rejected: 'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red',
}

const STATUS_LABEL: Record<AdminTronTransfer['status'], string> = {
  unmatched: 'Needs attention',
  settled: 'Settled',
  ignored: 'Ignored',
  rejected: 'Not a payment',
}

function shortHash(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash
}

/**
 * Admin → Crypto Transfers. Every USDT-TRC20 arrival, and the decision the
 * automatic matcher refuses to make: which invoice an unplaceable payment pays.
 *
 * Developer-gated for now (the rail is hidden from customers); delete the guard
 * and the sidebar's `developerOnly` flag when it goes public. The server keeps
 * the routes behind the ordinary admin middleware either way, because
 * attributing a payment is strictly less powerful than the manual mark-paid
 * every admin already has.
 */
export default function AdminTronTransfers() {
  const { data, loading, error, reload } = useApiData(getAdminTronTransfers)
  const [filter, setFilter] = useState<TransferFilter>('unmatched')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attributeTarget, setAttributeTarget] = useState<AdminTronTransfer | null>(null)
  const [ignoreTarget, setIgnoreTarget] = useState<AdminTronTransfer | null>(null)

  const user = getUser()
  const transfers = useMemo(() => data?.transfers ?? [], [data])

  const visible = useMemo(() => {
    const predicate = FILTERS.find((f) => f.key === filter)?.match ?? (() => true)
    const needle = search.trim().toLowerCase()
    return transfers.filter(
      (t) =>
        predicate(t) &&
        (needle === '' ||
          t.tx_hash.toLowerCase().includes(needle) ||
          t.from_address.toLowerCase().includes(needle) ||
          String(t.invoice_id ?? '').includes(needle)),
    )
  }, [transfers, filter, search])

  const pages = Math.max(1, Math.ceil(visible.length / PER_PAGE))
  const safePage = Math.min(page, pages)
  const rows = visible.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }
  // Cosmetic only — the server is the real gate.
  if (user && !isDeveloper(user.type)) return <Navigate to="/admin" replace />

  if (!data) {
    return (
      <AdminLayout title="Crypto Transfers" subtitle="Incoming USDT-TRC20 payments">
        <DataState loading={loading} error={error} onRetry={reload} label="transfers" />
      </AdminLayout>
    )
  }

  const runAttribute = async (invoiceId: number) => {
    if (!attributeTarget) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await attributeTronTransfer(attributeTarget.id, invoiceId)
      setNotice(res.message)
      setAttributeTarget(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not attribute the transfer.'))
    } finally {
      setBusy(false)
    }
  }

  const runIgnore = async () => {
    if (!ignoreTarget) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await ignoreTronTransfer(ignoreTarget.id)
      setNotice(res.message)
      setIgnoreTarget(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not ignore the transfer.'))
    } finally {
      setBusy(false)
    }
  }

  const stalled = data.networks.filter((n) => n.configured && n.scan_stale)

  return (
    <AdminLayout title="Crypto Transfers" subtitle="Incoming USDT-TRC20 payments">
      {/* Network health. Polling is the ONLY way one of these payments is
          noticed, so a stopped watcher has to be impossible to miss. */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-stack" data-aos="fade-up">
        {data.networks.map((n) => (
          <div
            key={n.name}
            className={`rounded-card border p-card ${
              n.configured && n.scan_stale
                ? 'border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]'
                : 'border-border bg-surface'
            }`}
          >
            <p className="flex items-center justify-between gap-2 text-[12.5px] font-bold text-text">
              {n.label}
              <span
                className={`rounded-pill border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                  n.configured
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-border bg-surface2 text-faint'
                }`}
              >
                {n.configured ? 'Active' : 'Not configured'}
              </span>
            </p>
            <p className="font-mono text-[11px] text-muted break-all mt-2">
              {n.address ?? 'No receiving address set'}
            </p>
            {n.configured && !n.address_valid && (
              <p className="flex items-start gap-1.5 text-[11.5px] font-semibold text-red mt-2">
                <TriangleAlert size={13} className="flex-shrink-0 mt-px" />
                The address failed its checksum — it is mistyped.
              </p>
            )}
            <p className="text-[11.5px] text-muted mt-2">
              Last scan:{' '}
              {n.last_scan_at ? new Date(n.last_scan_at).toLocaleTimeString() : 'never'}
            </p>
          </div>
        ))}
      </section>

      {stalled.length > 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 text-[12.5px] font-semibold text-red rounded-card border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] py-3 px-4 leading-[1.45] mb-stack"
        >
          <TriangleAlert size={15} className="flex-shrink-0 mt-px" />
          The payment watcher has not run recently on {stalled.map((n) => n.name).join(', ')}.
          Payments are arriving unnoticed — check that the scheduler
          (<code className="font-mono">schedule:run</code>) is alive.
        </p>
      )}

      {actionError && (
        <p
          role="alert"
          className="text-[12.5px] font-semibold text-red rounded-card border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] py-3 px-4 mb-stack"
        >
          {actionError}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="flex items-center justify-between gap-3 text-[12.5px] font-semibold text-green rounded-card border border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] py-3 px-4 mb-stack"
        >
          {notice}
          <button
            type="button"
            className="text-[11.5px] text-muted cursor-pointer hover:text-text"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </p>
      )}

      <section
        className="overflow-hidden rounded-card border border-border bg-surface"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        <div className="flex flex-wrap items-center gap-2.5 p-card border-b border-hair">
          <label className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by tx hash, sender or invoice id"
              className="w-full rounded-field border border-border bg-surface2 py-2 pl-9 pr-3 text-[12.5px] text-text outline-none focus:border-accent"
            />
          </label>
          {FILTERS.map((f) => {
            const count = transfers.filter(f.match).length
            return (
              <button
                key={f.key}
                type="button"
                className={`${CHIP_BASE} ${
                  filter === f.key
                    ? 'bg-accent border-accent text-on-accent font-bold'
                    : 'border-border bg-surface2 text-muted hover:border-accent hover:text-text'
                }`}
                onClick={() => {
                  setFilter(f.key)
                  setPage(1)
                }}
              >
                {f.label}
                <span className="font-mono text-[11px] opacity-80">{count}</span>
              </button>
            )
          })}
        </div>

        {/* House rule: a filter switch replays a reveal, never a hard cut. */}
        <div key={`${filter}-${safePage}`} className="overflow-x-auto animate-[fadeup_0.35s_ease-out]">
          <table className="w-full border-collapse min-w-[860px]">
            <thead>
              <tr>
                <th className={TH}>Amount</th>
                <th className={TH}>Status</th>
                <th className={TH}>Transaction</th>
                <th className={TH}>From</th>
                <th className={TH}>Seen</th>
                <th className={TH}>Invoice</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    {transfers.length === 0
                      ? 'No crypto transfers have arrived yet.'
                      : 'No transfers match your filters.'}
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className={TD}>
                    <span className="block font-mono text-[13px] font-bold text-text">
                      {t.amount ?? t.value_raw}
                    </span>
                    <span className="block text-[11px] text-faint">
                      {t.amount_usd != null ? fmtMoney(t.amount_usd) : 'unrepresentable'}
                      {!t.contract_trusted && ' · not our token'}
                    </span>
                  </td>
                  <td className={TD}>
                    <span
                      className={`inline-flex rounded-pill border px-2.5 py-1 text-[11px] font-bold ${STATUS_PILL[t.status]}`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                    {t.reject_reason && (
                      <span className="block text-[11px] text-faint mt-1">{t.reject_reason}</span>
                    )}
                  </td>
                  <td className={TD}>
                    <a
                      href={t.explorer_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-accent hover:underline"
                    >
                      {shortHash(t.tx_hash)} <ExternalLink size={11} />
                    </a>
                    <span className="block text-[11px] text-faint mt-0.5">{t.network}</span>
                  </td>
                  <td className={`${TD} font-mono text-[11px] text-muted`}>
                    {shortHash(t.from_address)}
                  </td>
                  <td className={`${TD} text-[11.5px] text-muted whitespace-nowrap`}>
                    {t.seen_at ? new Date(t.seen_at).toLocaleString() : '—'}
                  </td>
                  <td className={`${TD} text-[12px] text-text`}>
                    {t.invoice_id ? `#${t.invoice_id}` : '—'}
                    {t.settled_by && (
                      <span className="block text-[11px] text-faint">{t.settled_by}</span>
                    )}
                  </td>
                  <td className={`${TD} text-right whitespace-nowrap`}>
                    {t.attributable ? (
                      <span className="inline-flex gap-2">
                        <button
                          type="button"
                          className={BTN_PRIMARY}
                          onClick={() => setAttributeTarget(t)}
                          disabled={busy}
                        >
                          <ArrowDownToLine size={12} /> Attribute
                        </button>
                        <button
                          type="button"
                          className={BTN_GHOST}
                          onClick={() => setIgnoreTarget(t)}
                          disabled={busy}
                        >
                          <EyeOff size={12} /> Ignore
                        </button>
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-faint">
                        {t.attribution_blocked_reason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 p-card border-t border-hair">
            <button
              type="button"
              className={PAG_BTN}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="font-mono text-[11.5px] text-muted">
              {safePage} / {pages}
            </span>
            <button
              type="button"
              className={PAG_BTN}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={safePage === pages}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </section>

      <TronAttributeModal
        open={attributeTarget !== null}
        transfer={attributeTarget}
        busy={busy}
        error={actionError}
        onConfirm={runAttribute}
        onCancel={() => {
          setAttributeTarget(null)
          setActionError(null)
        }}
      />

      <ConfirmModal
        open={ignoreTarget !== null}
        title="Ignore this transfer?"
        message="It stays on record but leaves the queue. You can still find it under the Ignored filter."
        confirmLabel={busy ? 'Working…' : 'Yes, ignore'}
        onConfirm={runIgnore}
        onCancel={() => setIgnoreTarget(null)}
      />
    </AdminLayout>
  )
}
