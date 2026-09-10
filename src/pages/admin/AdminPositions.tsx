import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  RefreshCw,
  Users,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import PnlOverview from '../../components/positions/PnlOverview'
import AdminPositionsAnalytics from '../../components/admin/positions/AdminPositionsAnalytics'
import PositionsTable, {
  ICON_BTN,
} from '../../components/admin/positions/PositionsTable'
import PositionsToolbar from '../../components/admin/positions/PositionsToolbar'
import PositionEditModal, {
  type PositionEditKind,
  type PositionEditPayload,
} from '../../components/admin/positions/PositionEditModal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useApiData } from '../../hooks/useApiData'
import {
  deleteAdminPastTrade,
  deleteAdminPosition,
  getAdminPositions,
  updateAdminPastTrade,
  updateAdminPosition,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { displaySymbol } from '../../lib/chart'
import { computeAdminPositionMetrics } from '../../lib/adminPositionsStats'
import {
  accountOptions,
  buildPositionRows,
  buildTradeRows,
  matchesFilters,
  EMPTY_FILTERS,
  type PositionFilters,
  type PositionRow,
  type PositionView,
} from '../../lib/adminPositionRows'
import { fmtSignedMoney } from '../../lib/format'

type Tab = 'active' | 'closed'
const PAGE_SIZE = 10

interface DeleteTarget {
  ids: number[]
  label: string
  kind: 'position' | 'trade'
}

export default function AdminPositions() {
  const { data, loading, error, reload } = useApiData(getAdminPositions)

  const [tab, setTab] = useState<Tab>('active')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [view, setView] = useState<PositionView>('grouped')
  const [filters, setFilters] = useState<PositionFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<{
    row: PositionRow
    kind: PositionEditKind
  } | null>(null)
  const [pendingEdit, setPendingEdit] = useState<PositionEditPayload | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const positions = useMemo(() => data?.positions ?? [], [data])
  const trades = useMemo(() => data?.trades ?? [], [data])

  // --- facet options, from both tabs so switching tab keeps the filters usable
  const accounts = useMemo(() => accountOptions(positions, trades), [positions, trades])
  const brokers = useMemo(
    () => Array.from(new Set([...positions, ...trades].map((r) => r.broker))).sort(),
    [positions, trades],
  )
  const tickers = useMemo(
    () => Array.from(new Set([...positions, ...trades].map((r) => r.symbol))).sort(),
    [positions, trades],
  )

  // --- portfolio-wide analytics (across every account) ---
  const metrics = useMemo(
    () => computeAdminPositionMetrics(positions, trades),
    [positions, trades],
  )

  // --- the rows on screen: filtered, then merged or left per-row ---
  const rows = useMemo(() => {
    if (tab === 'active') {
      return buildPositionRows(
        positions.filter((p) => matchesFilters(p, filters)),
        view,
      )
    }
    return buildTradeRows(
      trades.filter((t) => matchesFilters(t, filters)),
      view,
    )
  }, [tab, positions, trades, filters, view])

  // DB rows behind the lines on screen — equals rows.length in the per-row view
  const matchedCount = rows.reduce((s, r) => s + r.count, 0)
  const tabTotal = tab === 'active' ? positions.length : trades.length

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [tab, view, filters])

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const patchFilters = (patch: Partial<PositionFilters>) =>
    setFilters((f) => ({ ...f, ...patch }))

  const askDelete = (r: PositionRow) => {
    const noun = tab === 'active' ? 'position' : 'trade'
    setDeleteTarget({
      ids: r.ids,
      kind: tab === 'active' ? 'position' : 'trade',
      label:
        r.rowId !== null
          ? `${noun} #${r.rowId} — ${displaySymbol(r.symbol)} on ${r.accountName ?? 'an unknown account'}`
          : `${r.count} ${displaySymbol(r.symbol)} ${noun}${r.count > 1 ? 's' : ''} for ${r.accountName ?? 'this account'}`,
    })
  }

  const askEdit = (r: PositionRow) => {
    if (r.rowId === null) return // merged line — no single row to write to
    setEditError(null)
    setEditTarget({ row: r, kind: tab === 'active' ? 'position' : 'trade' })
  }

  const runEdit = async () => {
    if (!pendingEdit) return
    setSaving(true)
    setEditError(null)
    try {
      if (pendingEdit.kind === 'position') {
        await updateAdminPosition(pendingEdit.id, pendingEdit.input)
      } else {
        await updateAdminPastTrade(pendingEdit.id, pendingEdit.input)
      }
      setPendingEdit(null)
      setEditTarget(null)
      reload()
    } catch (err) {
      setEditError(getApiErrorMessage(err, 'Failed to save the change.'))
      setPendingEdit(null)
    } finally {
      setSaving(false)
    }
  }

  const runDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setActionError(null)
    try {
      const del =
        deleteTarget.kind === 'position' ? deleteAdminPosition : deleteAdminPastTrade
      for (const id of deleteTarget.ids) {
        await del(id)
      }
      setDeleteTarget(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Failed to delete.'))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const stats = [
    {
      label: 'Active Positions',
      value: positions.length.toLocaleString(),
      hint: 'Currently open',
      icon: Activity,
      tone: '',
    },
    {
      label: 'Closed Positions',
      value: trades.length.toLocaleString(),
      hint: 'Total closed',
      icon: BarChart3,
      tone: '',
    },
    {
      label: 'Active Accounts',
      value: metrics.activeAccounts.toLocaleString(),
      hint: 'With positions',
      icon: Users,
      tone: '',
    },
    {
      label: 'Total P&L',
      value: fmtSignedMoney(metrics.totalPnl),
      hint: 'Realized + unrealized',
      icon: DollarSign,
      tone: metrics.totalPnl >= 0 ? 'pos' : 'neg',
    },
  ]

  if (!data) {
    return (
      <AdminLayout
        title="Trading Positions"
        subtitle="Monitor active and historical positions across every account."
      >
        <DataState loading={loading} error={error} onRetry={reload} label="positions" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title="Trading Positions"
      subtitle="Monitor active and historical positions across every account."
    >
      {/* stat cards */}
      <div
        className="grid grid-cols-4 gap-3 mb-4 max-[1000px]:grid-cols-2"
        data-aos="fade-up"
      >
        {stats.map((s) => (
          <div
            className="flex items-start justify-between gap-2.5 py-4 px-[18px] border border-border rounded-card bg-surface transition-colors hover:border-accent-line"
            key={s.label}
          >
            <div className="flex flex-col gap-[3px] min-w-0">
              <span className="text-[10.5px] font-bold tracking-[0.4px] uppercase text-faint">
                {s.label}
              </span>
              <span
                className={`text-2xl font-extrabold tracking-[-0.5px] font-mono ${
                  s.tone === 'pos' ? 'text-green' : s.tone === 'neg' ? 'text-red' : ''
                }`}
              >
                {s.value}
              </span>
              <span className="text-[11.5px] text-muted">{s.hint}</span>
            </div>
            <span className="grid place-items-center w-[38px] h-[38px] flex-none rounded-nav bg-accent-soft border border-accent-line text-accent">
              <s.icon size={18} />
            </span>
          </div>
        ))}
      </div>

      {/* realized / unrealized / total P&L tiles, across every account */}
      <PnlOverview
        realized={metrics.realized}
        unrealized={metrics.unrealized}
        total={metrics.totalPnl}
        pctBase={metrics.equityBase}
      />

      {showAnalytics && <AdminPositionsAnalytics m={metrics} />}

      {actionError && (
        <p
          className="mb-3.5 py-[9px] px-3 border border-[color-mix(in_srgb,var(--red)_30%,transparent)] rounded-field bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-[12.5px] text-red"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <section
        className="border border-border rounded-card bg-surface overflow-hidden"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        {/* panel header */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-4 px-5 border-b border-hair bg-[linear-gradient(to_right,var(--accentSoft),transparent)]">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-[38px] h-[38px] rounded-nav bg-accent-soft border border-accent-line text-accent">
              <BarChart3 size={18} />
            </span>
            <div>
              <div className="font-display text-[15px] font-extrabold">
                Positions Overview
              </div>
              <div className="mt-px text-xs text-muted">
                Live positions and historical trades
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] py-2 px-3.5 border border-border rounded-field bg-surface text-text text-[13px] font-bold cursor-pointer transition-colors hover:border-accent-line hover:bg-accent-soft"
              onClick={() => setShowAnalytics((v) => !v)}
              aria-expanded={showAnalytics}
            >
              <BarChart3 size={14} />
              {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
              <ChevronDown
                size={14}
                className={`transition-transform duration-300${showAnalytics ? ' rotate-180' : ''}`}
              />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-[7px] py-2 px-3.5 border border-accent-line rounded-field bg-accent-soft text-accent text-[13px] font-bold cursor-pointer transition-colors hover:bg-accent hover:text-on-accent"
              onClick={reload}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 mt-[18px] mx-5 p-1 border border-hair rounded-row bg-surface2 w-fit">
          {(
            [
              ['active', 'Active Positions', positions.length],
              ['closed', 'Past Positions', trades.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={`inline-flex items-center gap-2 py-2 px-4 border rounded-[9px] text-[13px] cursor-pointer transition-colors ${
                tab === key
                  ? 'bg-accent border-transparent text-on-accent font-bold'
                  : 'border-transparent bg-transparent text-muted font-semibold'
              }`}
              onClick={() => setTab(key)}
            >
              {label}
              <span
                className={`inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-pill text-[11px] font-bold ${
                  tab === key
                    ? 'bg-[color-mix(in_srgb,var(--onAccent)_25%,transparent)] text-on-accent'
                    : 'bg-surface text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* The toolbar sits OUTSIDE the keyed region below — re-keying unmounts
            its children, which is what stole the search box's focus on every
            keystroke. */}
        <PositionsToolbar
          filters={filters}
          onChange={patchFilters}
          onClear={() => setFilters(EMPTY_FILTERS)}
          view={view}
          onView={setView}
          accounts={accounts}
          tickers={tickers}
          brokers={brokers}
          shown={matchedCount}
          total={tabTotal}
        />

        {/* key on the tab/filter signature re-mounts the region so it replays the
            fade-slide reveal every time the category or filters change. The free
            text search is deliberately left out: it changes per keystroke, and
            replaying the reveal on every letter is a flicker, not a reveal. */}
        <div
          key={`${tab}-${view}-${filters.account}-${filters.ticker}-${filters.broker}-${safePage}`}
          className="animate-[fadeup_0.35s_ease-out]"
        >
          <PositionsTable
            tab={tab}
            view={view}
            rows={paged}
            onEdit={askEdit}
            onDelete={askDelete}
          />
        </div>

        {rows.length > 0 && totalPages > 1 && (
          <Pager
            page={safePage}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        )}
      </section>

      <PositionEditModal
        row={editTarget?.row ?? null}
        kind={editTarget?.kind ?? 'trade'}
        saving={saving}
        error={editError}
        confirming={pendingEdit !== null}
        onSubmit={setPendingEdit}
        onCancel={() => {
          setEditTarget(null)
          setEditError(null)
        }}
      />

      {/* The edit form itself only collects values — this is what writes. */}
      <ConfirmModal
        open={pendingEdit !== null}
        title={
          pendingEdit?.kind === 'trade'
            ? `Update trade #${pendingEdit.id}?`
            : `Update position #${pendingEdit?.id}?`
        }
        message={
          pendingEdit
            ? `${pendingEdit.changes.join(' · ')}.${
                pendingEdit.kind === 'trade'
                  ? ' Invoicing and the public track record read these figures.'
                  : ' The next poller sync for this account overwrites it.'
              }`
            : ''
        }
        confirmLabel={saving ? 'Saving…' : 'Yes, update'}
        cancelLabel="No"
        onConfirm={runEdit}
        onCancel={() => setPendingEdit(null)}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete positions?"
        message={
          deleteTarget
            ? `This permanently removes ${deleteTarget.label}. This action cannot be undone.`
            : ''
        }
        confirmLabel={deleting ? 'Deleting…' : 'Yes, delete'}
        cancelLabel="No"
        danger
        onConfirm={runDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  )
}

interface PagerProps {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

function Pager({ page, totalPages, onPrev, onNext }: PagerProps) {
  return (
    <div className="flex items-center justify-end gap-3.5 py-4 px-5">
      <span className="text-[12.5px] text-muted">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          className={ICON_BTN}
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          className={ICON_BTN}
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
