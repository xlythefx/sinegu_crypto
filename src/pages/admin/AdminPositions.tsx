import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Layers,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import PnlOverview from '../../components/positions/PnlOverview'
import AdminPositionsAnalytics from '../../components/admin/positions/AdminPositionsAnalytics'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useApiData } from '../../hooks/useApiData'
import {
  deleteAdminPastTrade,
  deleteAdminPosition,
  getAdminPositions,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { displaySymbol } from '../../lib/chart'
import { computeAdminPositionMetrics } from '../../lib/adminPositionsStats'
import { fmtDateTime, fmtMoney, fmtSignedMoney } from '../../lib/format'
import type {
  AdminOpenPosition,
  AdminPastTrade,
} from '../../types/admin'

type Tab = 'active' | 'closed'
const PAGE_SIZE = 10

// shared table primitives (mirrors the user Positions tables)
const TH_BASE =
  'py-[11px] px-3.5 text-[10.5px] font-bold tracking-[0.3px] uppercase text-faint whitespace-nowrap'
const TH = `${TH_BASE} text-left`
const TH_R = `${TH_BASE} text-right`
const TH_C = `${TH_BASE} text-center`
const TD = 'py-[11px] px-3.5 align-middle'
const TD_R = `${TD} text-right`
const TD_C = `${TD} text-center`
const ROW = 'border-t border-hair transition-colors hover:bg-surface2'

const ICON_BTN =
  'inline-grid place-items-center w-8 h-8 border border-border rounded-[9px] bg-surface text-muted cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed enabled:hover:bg-surface2 enabled:hover:text-text'
const ICON_BTN_DANGER = `${ICON_BTN} enabled:hover:!border-[color-mix(in_srgb,var(--red)_40%,transparent)] enabled:hover:!bg-[color-mix(in_srgb,var(--red)_12%,transparent)] enabled:hover:!text-red`

const FILTER_FIELD =
  'flex items-center gap-2 h-10 px-3 border border-border rounded-nav bg-surface2 text-faint'
const FILTER_SELECT =
  'border-0 bg-transparent text-text text-[13px] font-semibold outline-none cursor-pointer min-w-[130px]'

/** A group of same account + ticker open positions merged into one row. */
interface PositionGroup {
  key: string
  ids: number[]
  count: number
  accountId: number | null
  accountName: string | null
  accountBalance: number
  symbol: string
  price: number
  unrealizedPnl: number
  broker: string
}

/** A group of same account + ticker closed trades merged into one row. */
interface TradeGroup {
  key: string
  ids: number[]
  count: number
  accountId: number | null
  accountName: string | null
  accountBalance: number
  symbol: string
  price: number
  realizedPnl: number
  strategy: string | null
  closedAt: string
  broker: string
}

function groupPositions(rows: AdminOpenPosition[]): PositionGroup[] {
  const map = new Map<string, PositionGroup>()
  for (const p of rows) {
    const key = `${p.account_id}|${p.symbol}`
    const g = map.get(key)
    if (g) {
      g.ids.push(p.id)
      g.count += 1
      g.unrealizedPnl += p.unrealized_pnl
      g.price += p.price // accumulate for averaging below
    } else {
      map.set(key, {
        key,
        ids: [p.id],
        count: 1,
        accountId: p.account_id,
        accountName: p.account_name,
        accountBalance: p.account_balance,
        symbol: p.symbol,
        price: p.price,
        unrealizedPnl: p.unrealized_pnl,
        broker: p.broker,
      })
    }
  }
  return Array.from(map.values()).map((g) => ({ ...g, price: g.price / g.count }))
}

function groupTrades(rows: AdminPastTrade[]): TradeGroup[] {
  const map = new Map<string, TradeGroup & { priceSum: number; strategies: Set<string> }>()
  for (const t of rows) {
    const key = `${t.account_id}|${t.symbol}`
    const g = map.get(key)
    if (g) {
      g.ids.push(t.id)
      g.count += 1
      g.realizedPnl += t.realized_pnl
      g.priceSum += t.price
      if (t.strategy) g.strategies.add(t.strategy)
      if (t.closed_at > g.closedAt) g.closedAt = t.closed_at
    } else {
      map.set(key, {
        key,
        ids: [t.id],
        count: 1,
        accountId: t.account_id,
        accountName: t.account_name,
        accountBalance: t.account_balance,
        symbol: t.symbol,
        price: 0,
        priceSum: t.price,
        realizedPnl: t.realized_pnl,
        strategy: null,
        strategies: new Set(t.strategy ? [t.strategy] : []),
        closedAt: t.closed_at,
        broker: t.broker,
      })
    }
  }
  return Array.from(map.values())
    .map((g) => ({
      key: g.key,
      ids: g.ids,
      count: g.count,
      accountId: g.accountId,
      accountName: g.accountName,
      accountBalance: g.accountBalance,
      symbol: g.symbol,
      price: g.priceSum / g.count,
      realizedPnl: g.realizedPnl,
      strategy:
        g.strategies.size === 0
          ? null
          : g.strategies.size === 1
            ? [...g.strategies][0]
            : 'Multiple',
      closedAt: g.closedAt,
      broker: g.broker,
    }))
    .sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1))
}

/** Coin-initials avatar + display symbol (mirrors the user Positions tables). */
function TickerCell({ symbol }: { symbol: string }) {
  const display = displaySymbol(symbol)
  const initials = display.split('/')[0].slice(0, 3)
  return (
    <div className="flex items-center gap-[9px] font-bold whitespace-nowrap">
      <span className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-[9px] bg-accent-soft border border-accent-line text-accent text-[9.5px] font-semibold flex-none font-mono">
        {initials}
      </span>
      {display}
    </div>
  )
}

/** P&L value + percentage of the account balance. */
function PnlCell({ pnl, balance }: { pnl: number; balance: number }) {
  const pos = pnl >= 0
  const pct = balance > 0 ? (pnl / balance) * 100 : null
  return (
    <div
      className={`inline-flex flex-col items-end gap-px ${pos ? 'text-green' : 'text-red'}`}
    >
      <span className="text-[13px] font-extrabold font-mono">{fmtSignedMoney(pnl)}</span>
      {pct !== null && (
        <span className="text-[11px] font-semibold font-mono opacity-85">
          {pos ? '+' : '−'}
          {Math.abs(pct).toFixed(2)}%
        </span>
      )}
    </div>
  )
}

/** Merged-count pill; only emphasized when it actually merges >1 row. */
function CountPill({ count }: { count: number }) {
  return (
    <span
      className={`inline-grid place-items-center min-w-[26px] h-6 px-2 rounded-pill border font-mono text-xs font-bold ${
        count > 1
          ? 'bg-accent-soft border-accent-line text-accent'
          : 'bg-surface2 border-hair text-muted'
      }`}
    >
      {count}
    </span>
  )
}

interface DeleteTarget {
  ids: number[]
  label: string
  kind: 'position' | 'trade'
}

export default function AdminPositions() {
  const { data, loading, error, reload } = useApiData(getAdminPositions)

  const [tab, setTab] = useState<Tab>('active')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [activeBroker, setActiveBroker] = useState('all')
  const [pastBroker, setPastBroker] = useState('all')
  const [pastTicker, setPastTicker] = useState('all')
  const [search, setSearch] = useState('')
  const [activePage, setActivePage] = useState(1)
  const [closedPage, setClosedPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const positions = useMemo(() => data?.positions ?? [], [data])
  const trades = useMemo(() => data?.trades ?? [], [data])

  const brokers = useMemo(
    () => Array.from(new Set([...positions, ...trades].map((r) => r.broker))).sort(),
    [positions, trades],
  )
  const tickers = useMemo(
    () => Array.from(new Set(trades.map((t) => t.symbol))).sort(),
    [trades],
  )

  // --- portfolio-wide analytics (across every account) ---
  const metrics = useMemo(
    () => computeAdminPositionMetrics(positions, trades),
    [positions, trades],
  )

  // --- grouped + filtered rows ---
  const activeGroups = useMemo(() => {
    const filtered =
      activeBroker === 'all'
        ? positions
        : positions.filter((p) => p.broker === activeBroker)
    return groupPositions(filtered).sort((a, b) =>
      (a.accountName ?? '').localeCompare(b.accountName ?? '') ||
      a.symbol.localeCompare(b.symbol),
    )
  }, [positions, activeBroker])

  const closedGroups = useMemo(() => {
    let list = trades
    if (pastBroker !== 'all') list = list.filter((t) => t.broker === pastBroker)
    if (pastTicker !== 'all') list = list.filter((t) => t.symbol === pastTicker)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          String(t.id).includes(q) ||
          String(t.account_id ?? '').includes(q) ||
          (t.account_name ?? '').toLowerCase().includes(q),
      )
    }
    return groupTrades(list)
  }, [trades, pastBroker, pastTicker, search])

  const activeTotalPages = Math.max(1, Math.ceil(activeGroups.length / PAGE_SIZE))
  const closedTotalPages = Math.max(1, Math.ceil(closedGroups.length / PAGE_SIZE))
  const activeSafePage = Math.min(activePage, activeTotalPages)
  const closedSafePage = Math.min(closedPage, closedTotalPages)
  const activePaged = activeGroups.slice(
    (activeSafePage - 1) * PAGE_SIZE,
    activeSafePage * PAGE_SIZE,
  )
  const closedPaged = closedGroups.slice(
    (closedSafePage - 1) * PAGE_SIZE,
    closedSafePage * PAGE_SIZE,
  )

  useEffect(() => setActivePage(1), [activeGroups.length])
  useEffect(() => setClosedPage(1), [closedGroups.length])

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const runDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setActionError(null)
    try {
      const del =
        deleteTarget.kind === 'position'
          ? deleteAdminPosition
          : deleteAdminPastTrade
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
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="positions"
        />
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

        {/* key on the tab/filter signature re-mounts the region so it replays the
            fade-slide reveal every time the category or filters change. */}
        <div
          key={`${tab}-${activeBroker}-${pastBroker}-${pastTicker}-${search}-${activeSafePage}-${closedSafePage}`}
          className="animate-[fadeup_0.35s_ease-out]"
        >
          {/* ACTIVE */}
          {tab === 'active' && (
            <>
              <div className="flex flex-wrap gap-2.5 py-[18px] px-5">
                <label className={FILTER_FIELD}>
                  <Layers size={14} />
                  <select
                    className={FILTER_SELECT}
                    value={activeBroker}
                    onChange={(e) => setActiveBroker(e.target.value)}
                    aria-label="Filter by broker"
                  >
                    <option value="all">All brokers</option>
                    {brokers.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mx-5 border border-hair rounded-row overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-surface2">
                      <th className={TH}>Account</th>
                      <th className={TH}>Ticker</th>
                      <th className={TH}>Broker</th>
                      <th className={TH_R}>Price</th>
                      <th className={TH_R}>Unrealized P&L</th>
                      <th className={TH_C}>Count</th>
                      <th className={TH_R}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePaged.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center text-muted py-[30px] px-3.5"
                        >
                          No active positions found.
                        </td>
                      </tr>
                    ) : (
                      activePaged.map((g) => (
                        <tr key={g.key} className={ROW}>
                          <td className={TD}>
                            <div className="flex flex-col">
                              <span className="font-bold">
                                {g.accountName ?? 'Unknown account'}
                              </span>
                              <span className="text-[11px] text-faint">
                                ID {g.accountId ?? '—'}
                              </span>
                            </div>
                          </td>
                          <td className={TD}>
                            <TickerCell symbol={g.symbol} />
                          </td>
                          <td className={TD}>
                            <span className="inline-block py-[3px] px-[9px] border border-border rounded-btn bg-surface2 text-[11.5px] font-semibold text-muted">
                              {g.broker}
                            </span>
                          </td>
                          <td className={`${TD_R} font-mono`}>{fmtMoney(g.price)}</td>
                          <td className={TD_R}>
                            <PnlCell pnl={g.unrealizedPnl} balance={g.accountBalance} />
                          </td>
                          <td className={TD_C}>
                            <CountPill count={g.count} />
                          </td>
                          <td className={TD_R}>
                            <button
                              type="button"
                              className={ICON_BTN_DANGER}
                              title={`Delete ${g.count} position${g.count > 1 ? 's' : ''}`}
                              onClick={() =>
                                setDeleteTarget({
                                  ids: g.ids,
                                  label: `${g.count} ${displaySymbol(g.symbol)} position${g.count > 1 ? 's' : ''} for ${g.accountName ?? 'this account'}`,
                                  kind: 'position',
                                })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {activeGroups.length > 0 && activeTotalPages > 1 && (
                <Pager
                  page={activeSafePage}
                  totalPages={activeTotalPages}
                  onPrev={() => setActivePage((p) => Math.max(1, p - 1))}
                  onNext={() => setActivePage((p) => Math.min(activeTotalPages, p + 1))}
                />
              )}
            </>
          )}

          {/* CLOSED */}
          {tab === 'closed' && (
            <>
              <div className="flex flex-wrap gap-2.5 py-[18px] px-5">
                <label
                  className={`${FILTER_FIELD} flex-1 min-w-[220px] max-w-[320px] max-[560px]:max-w-none`}
                >
                  <Search size={14} />
                  <input
                    type="search"
                    className="flex-1 border-0 bg-transparent text-text text-[13px] outline-none"
                    placeholder="Search by account or ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className={FILTER_FIELD}>
                  <Layers size={14} />
                  <select
                    className={FILTER_SELECT}
                    value={pastTicker}
                    onChange={(e) => setPastTicker(e.target.value)}
                    aria-label="Filter by ticker"
                  >
                    <option value="all">All tickers</option>
                    {tickers.map((t) => (
                      <option key={t} value={t}>
                        {displaySymbol(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={FILTER_FIELD}>
                  <Layers size={14} />
                  <select
                    className={FILTER_SELECT}
                    value={pastBroker}
                    onChange={(e) => setPastBroker(e.target.value)}
                    aria-label="Filter by broker"
                  >
                    <option value="all">All brokers</option>
                    {brokers.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mx-5 border border-hair rounded-row overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-surface2">
                      <th className={TH}>Account</th>
                      <th className={TH}>Ticker</th>
                      <th className={TH}>Broker</th>
                      <th className={TH}>Strategy</th>
                      <th className={TH_R}>Price</th>
                      <th className={TH_R}>P&L</th>
                      <th className={TH_C}>Count</th>
                      <th className={TH_R}>Closed At</th>
                      <th className={TH_R}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedPaged.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-center text-muted py-[30px] px-3.5"
                        >
                          No past positions found.
                        </td>
                      </tr>
                    ) : (
                      closedPaged.map((g) => (
                        <tr key={g.key} className={ROW}>
                          <td className={TD}>
                            <div className="flex flex-col">
                              <span className="font-bold">
                                {g.accountName ?? 'Unknown account'}
                              </span>
                              <span className="text-[11px] text-faint">
                                ID {g.accountId ?? '—'}
                              </span>
                            </div>
                          </td>
                          <td className={TD}>
                            <TickerCell symbol={g.symbol} />
                          </td>
                          <td className={TD}>
                            <span className="inline-block py-[3px] px-[9px] border border-border rounded-btn bg-surface2 text-[11.5px] font-semibold text-muted">
                              {g.broker}
                            </span>
                          </td>
                          <td className={`${TD} text-muted`}>{g.strategy ?? '—'}</td>
                          <td className={`${TD_R} font-mono`}>{fmtMoney(g.price)}</td>
                          <td className={TD_R}>
                            <PnlCell pnl={g.realizedPnl} balance={g.accountBalance} />
                          </td>
                          <td className={TD_C}>
                            <CountPill count={g.count} />
                          </td>
                          <td className={`${TD_R} text-muted font-mono`}>
                            {fmtDateTime(g.closedAt)}
                          </td>
                          <td className={TD_R}>
                            <button
                              type="button"
                              className={ICON_BTN_DANGER}
                              title={`Delete ${g.count} trade${g.count > 1 ? 's' : ''}`}
                              onClick={() =>
                                setDeleteTarget({
                                  ids: g.ids,
                                  label: `${g.count} ${displaySymbol(g.symbol)} trade${g.count > 1 ? 's' : ''} for ${g.accountName ?? 'this account'}`,
                                  kind: 'trade',
                                })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {closedGroups.length > 0 && closedTotalPages > 1 && (
                <Pager
                  page={closedSafePage}
                  totalPages={closedTotalPages}
                  onPrev={() => setClosedPage((p) => Math.max(1, p - 1))}
                  onNext={() => setClosedPage((p) => Math.min(closedTotalPages, p + 1))}
                />
              )}
            </>
          )}
        </div>
      </section>

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
