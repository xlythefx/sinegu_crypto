import { Fragment, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
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
import TronAmountMismatchModal from '../../components/admin/TronAmountMismatchModal'
import { ClaimLine, ResolveDisputeModal } from '../../components/admin/TronClaims'
import { useApiData } from '../../hooks/useApiData'
import {
  attributeTronTransfer,
  getAdminTronTransfers,
  ignoreTronTransfer,
  readTronAmountMismatch,
  readTronNetworkMismatch,
  resolveTronClaim,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { fmtDateTime, fmtMoney } from '../../lib/format'
import type {
  AdminTronAmountMismatch,
  AdminTronClaim,
  AdminTronNetwork,
  AdminTronTransfer,
} from '../../types/admin'

/**
 * Filters are predicates on the raw row, mirroring the server's `counts`
 * exactly — a chip whose number disagrees with its own list is worse than no
 * chip at all.
 */
type TransferFilter = 'all' | 'disputed' | 'unmatched' | 'settled' | 'ignored' | 'rejected'

const FILTERS: {
  key: TransferFilter
  label: string
  match: (t: AdminTronTransfer) => boolean
}[] = [
  { key: 'all', label: 'All', match: () => true },
  // Not a status: two customers have pasted this payment's TXID.
  { key: 'disputed', label: 'Disputed', match: (t) => t.disputed },
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

/** A configured network whose cursor is not advancing — see `budget_exhausted_at`. */
type StuckNetwork = AdminTronNetwork & { budget_exhausted_at: string }

function isStuck(n: AdminTronNetwork): n is StuckNetwork {
  return n.configured && n.budget_exhausted_at !== null
}

/** The invoice an admin picked, and the figures the server answered with. */
interface PendingMismatch {
  invoiceId: number
  detail: AdminTronAmountMismatch
}

const STRIP =
  'rounded-card border py-3 px-4 text-[12.5px] font-semibold leading-[1.45] mb-stack'
const STRIP_RED = `${STRIP} text-red border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)]`

/**
 * Admin → Crypto Transfers. Every USDT-TRC20 arrival, and the decision the
 * automatic matcher refuses to make: which invoice an unplaceable payment pays.
 *
 * Open to every admin since the rail went public. The server keeps the routes
 * behind the ordinary admin middleware, because attributing a payment is
 * strictly less powerful than the manual mark-paid every admin already has.
 *
 * A HELD payment (two customers paying the same amount, or one arriving after
 * its timer) shows which invoices are being asked for its TXID; a payment two
 * customers both claimed is DISPUTED — `?status=disputed` is where the Admin
 * Overview's caution strip lands.
 */
export default function AdminTronTransfers() {
  const { data, loading, error, reload } = useApiData(getAdminTronTransfers)
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<TransferFilter>(() =>
    FILTERS.some((f) => f.key === params.get('status'))
      ? (params.get('status') as TransferFilter)
      : 'unmatched',
  )
  const [resolveTarget, setResolveTarget] = useState<AdminTronClaim | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attributeTarget, setAttributeTarget] = useState<AdminTronTransfer | null>(null)
  const [ignoreTarget, setIgnoreTarget] = useState<AdminTronTransfer | null>(null)
  // The second confirmation: the server said the amount is off, and the
  // admin has not yet said "attribute anyway".
  const [mismatch, setMismatch] = useState<PendingMismatch | null>(null)

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

  if (!data) {
    return (
      <AdminLayout title="Crypto Transfers" subtitle="Incoming USDT-TRC20 payments">
        <DataState loading={loading} error={error} onRetry={reload} label="transfers" />
      </AdminLayout>
    )
  }

  /**
   * First pass sends the invoice id alone. An `AMOUNT_MISMATCH` answer is not
   * a failure — it opens the second confirmation with the server's figures,
   * and confirming re-posts the SAME body with `accept_amount: true`. A
   * `NETWORK_MISMATCH` is final and lands in the error strip naming both
   * networks; anything else reads as before.
   */
  const runAttribute = async (invoiceId: number, acceptAmount = false) => {
    if (!attributeTarget) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await attributeTronTransfer(attributeTarget.id, invoiceId, { acceptAmount })
      setNotice(res.message)
      setMismatch(null)
      setAttributeTarget(null)
      reload()
    } catch (err) {
      const amount = acceptAmount ? null : readTronAmountMismatch(err)
      if (amount) {
        setMismatch({ invoiceId, detail: amount })
        return
      }
      setMismatch(null)
      const network = readTronNetworkMismatch(err)
      setActionError(
        network
          ? `${network.message} (transfer on ${network.transfer_network}, invoice expects ${network.invoice_network})`
          : getApiErrorMessage(err, 'Could not attribute the transfer.'),
      )
    } finally {
      setBusy(false)
    }
  }

  // While the mismatch confirmation is up, Escape and the scrim belong to it
  // alone — the attribute modal underneath must not close with it.
  const closeAttribute = () => {
    if (mismatch) return
    setAttributeTarget(null)
    setActionError(null)
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

  const runResolve = async () => {
    if (!resolveTarget) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await resolveTronClaim(resolveTarget.id, resolveNote.trim() || undefined)
      setNotice(res.message)
      setResolveTarget(null)
      setResolveNote('')
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not resolve the dispute.'))
    } finally {
      setBusy(false)
    }
  }

  const stalled = data.networks.filter((n) => n.configured && n.scan_stale)
  // A stuck cursor can hide behind a fresh `last_scan_at`: the watcher IS
  // running, it just never gets past the overlap window. Separate strip,
  // louder than stale — both can be true at once.
  const stuck = data.networks.filter(isStuck)

  return (
    <AdminLayout title="Crypto Transfers" subtitle="Incoming USDT-TRC20 payments">
      {/* Network health. Polling is the ONLY way one of these payments is
          noticed, so a stopped watcher has to be impossible to miss. */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-stack" data-aos="fade-up">
        {data.networks.map((n) => (
          <div
            key={n.name}
            className={`rounded-card border p-card ${
              n.configured && (n.scan_stale || n.budget_exhausted_at)
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
            {isStuck(n) && (
              <p className="flex items-start gap-1.5 text-[11.5px] font-semibold text-red mt-2">
                <TriangleAlert size={13} className="flex-shrink-0 mt-px" />
                Scanner stuck since {fmtDateTime(n.budget_exhausted_at)}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* One strip per stuck network, one level louder than "stale": solid
          red border, a titled lead-in, and the moment it stalled. */}
      {stuck.map((n) => (
        <div
          key={n.name}
          role="alert"
          className={`${STRIP} flex items-start gap-2.5 text-text border-red bg-[color-mix(in_srgb,var(--red)_16%,transparent)]`}
        >
          <TriangleAlert size={16} className="flex-shrink-0 mt-0.5 text-red" />
          <div className="min-w-0">
            <p className="font-bold text-red">Scanner stuck on {n.name}</p>
            <p className="mt-1 font-medium">
              The {n.name} scanner is stuck: the last scan hit its page budget without
              getting past the overlap window, so new payments are not being seen. Check
              TronGrid and the watcher log.
            </p>
            <p className="mt-1.5 font-mono text-[11px] font-medium text-muted">
              Since {fmtDateTime(n.budget_exhausted_at)}
            </p>
          </div>
        </div>
      ))}

      {stalled.length > 0 && (
        <p role="alert" className={`${STRIP_RED} flex items-start gap-2`}>
          <TriangleAlert size={15} className="flex-shrink-0 mt-px" />
          <span>
            The payment watcher has not run recently on{' '}
            {stalled.map((n) => n.name).join(', ')}. Payments are arriving unnoticed —
            check that the scheduler (<code className="font-mono">schedule:run</code>) is
            alive.
          </span>
        </p>
      )}

      {actionError && (
        <p role="alert" className={STRIP_RED}>
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
                <Fragment key={t.id}>
                <tr className={t.disputed ? 'bg-[color-mix(in_srgb,var(--red)_6%,transparent)]' : undefined}>
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
                    {t.disputed && (
                      <span className={`ml-1.5 inline-flex rounded-pill border px-2.5 py-1 text-[11px] font-bold ${STATUS_PILL.rejected}`}>
                        Disputed
                      </span>
                    )}
                    {t.reject_reason && (
                      <span className="block text-[11px] text-faint mt-1">{t.reject_reason}</span>
                    )}
                    {/* Held by the matcher: these customers are being asked for the TXID. */}
                    {t.status === 'unmatched' && t.candidate_invoice_ids.length > 0 && (
                      <span className="block text-[11px] text-faint mt-1">
                        Held · asking {t.candidate_invoice_ids.map((id) => `#${id}`).join(', ')} for the TXID
                      </span>
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
                {t.claims.length > 0 && (
                  <tr className={t.disputed ? 'bg-[color-mix(in_srgb,var(--red)_6%,transparent)]' : undefined}>
                    <td colSpan={7} className="border-b border-hair px-3.5 pb-3">
                      <ul className="flex flex-col gap-1.5">
                        {t.claims.map((c) => (
                          <ClaimLine
                            key={c.id}
                            claim={c}
                            busy={busy}
                            onResolve={() => {
                              setResolveNote('')
                              setResolveTarget(c)
                            }}
                          />
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
                </Fragment>
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
        onConfirm={(invoiceId) => runAttribute(invoiceId)}
        onCancel={closeAttribute}
      />

      {/* Layered over the attribute modal. Cancel sends nothing and hands the
          admin back their pick; confirm is the same POST plus accept_amount. */}
      <TronAmountMismatchModal
        open={mismatch !== null}
        invoiceId={mismatch?.invoiceId ?? null}
        detail={mismatch?.detail ?? null}
        busy={busy}
        onConfirm={() => mismatch && runAttribute(mismatch.invoiceId, true)}
        onCancel={() => setMismatch(null)}
      />

      <ResolveDisputeModal
        claim={resolveTarget}
        note={resolveNote}
        busy={busy}
        onNote={setResolveNote}
        onConfirm={runResolve}
        onCancel={() => setResolveTarget(null)}
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
