import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Activity,
  BarChart3,
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
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useApiData } from '../../hooks/useApiData'
import {
  deleteAdminPastTrade,
  deleteAdminPosition,
  getAdminPositions,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { displaySymbol } from '../../lib/chart'
import { fmtDateTime, fmtMoney, fmtSignedMoney } from '../../lib/format'
import type {
  AdminOpenPosition,
  AdminPastTrade,
} from '../../types/admin'
import './AdminPositions.css'

type Tab = 'active' | 'closed'
const PAGE_SIZE = 10

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

/** Small ticker chip used in the ticker column. */
function TickerChip({ symbol }: { symbol: string }) {
  return <span className="apos-ticker">{displaySymbol(symbol)}</span>
}

/** P&L value + percentage of the account balance. */
function PnlCell({ pnl, balance }: { pnl: number; balance: number }) {
  const pos = pnl >= 0
  const pct = balance > 0 ? (pnl / balance) * 100 : null
  return (
    <div className={`apos-pnl ${pos ? 'is-pos' : 'is-neg'}`}>
      <span className="apos-pnl__value mono">{fmtSignedMoney(pnl)}</span>
      {pct !== null && (
        <span className="apos-pnl__pct mono">
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
    <span className={`apos-count${count > 1 ? ' apos-count--multi' : ''}`}>
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

  // --- stat cards ---
  const totalPnl = useMemo(
    () => trades.reduce((s, t) => s + t.realized_pnl, 0),
    [trades],
  )
  const activeAccounts = useMemo(
    () => new Set(positions.map((p) => p.account_id)).size,
    [positions],
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
      value: activeAccounts.toLocaleString(),
      hint: 'With positions',
      icon: Users,
      tone: '',
    },
    {
      label: 'Total P&L',
      value: fmtSignedMoney(totalPnl),
      hint: totalPnl >= 0 ? 'Profit' : 'Loss',
      icon: DollarSign,
      tone: totalPnl >= 0 ? 'pos' : 'neg',
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
      <div className="apos-stats" data-aos="fade-up">
        {stats.map((s) => (
          <div className="apos-stat" key={s.label}>
            <div className="apos-stat__body">
              <span className="apos-stat__label">{s.label}</span>
              <span className={`apos-stat__value mono${s.tone ? ` is-${s.tone}` : ''}`}>
                {s.value}
              </span>
              <span className="apos-stat__hint">{s.hint}</span>
            </div>
            <span className="apos-stat__icon">
              <s.icon size={18} />
            </span>
          </div>
        ))}
      </div>

      {actionError && (
        <p className="apos-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="apos-panel" data-aos="fade-up" data-aos-delay="100">
        {/* panel header */}
        <div className="apos-panel__head">
          <div className="apos-panel__title-row">
            <span className="apos-panel__icon">
              <BarChart3 size={18} />
            </span>
            <div>
              <div className="apos-panel__title">Positions Overview</div>
              <div className="apos-panel__sub">
                Live positions and historical trades
              </div>
            </div>
          </div>
          <button type="button" className="apos-refresh" onClick={reload}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* tabs */}
        <div className="apos-tabs">
          <button
            type="button"
            className={`apos-tab${tab === 'active' ? ' apos-tab--active' : ''}`}
            onClick={() => setTab('active')}
          >
            Active Positions
            <span className="apos-tab__count">{positions.length}</span>
          </button>
          <button
            type="button"
            className={`apos-tab${tab === 'closed' ? ' apos-tab--active' : ''}`}
            onClick={() => setTab('closed')}
          >
            Past Positions
            <span className="apos-tab__count">{trades.length}</span>
          </button>
        </div>

        {/* ACTIVE */}
        {tab === 'active' && (
          <>
            <div className="apos-filters">
              <label className="apos-select">
                <Layers size={14} />
                <select
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

            <div className="apos-table-wrap">
              <table className="apos-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Ticker</th>
                    <th>Broker</th>
                    <th className="apos-th--right">Price</th>
                    <th className="apos-th--right">Unrealized P&L</th>
                    <th className="apos-th--center">Count</th>
                    <th className="apos-th--right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activePaged.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="apos-empty">
                        No active positions found.
                      </td>
                    </tr>
                  ) : (
                    activePaged.map((g) => (
                      <tr key={g.key}>
                        <td>
                          <div className="apos-account">
                            <span className="apos-account__name">
                              {g.accountName ?? 'Unknown account'}
                            </span>
                            <span className="apos-account__id">
                              ID {g.accountId ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <TickerChip symbol={g.symbol} />
                        </td>
                        <td>
                          <span className="apos-broker">{g.broker}</span>
                        </td>
                        <td className="apos-td--right mono">{fmtMoney(g.price)}</td>
                        <td className="apos-td--right">
                          <PnlCell pnl={g.unrealizedPnl} balance={g.accountBalance} />
                        </td>
                        <td className="apos-td--center">
                          <CountPill count={g.count} />
                        </td>
                        <td className="apos-td--right">
                          <button
                            type="button"
                            className="apos-icon-btn apos-icon-btn--danger"
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
            <div className="apos-filters">
              <label className="apos-search">
                <Search size={14} />
                <input
                  type="search"
                  placeholder="Search by account or ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="apos-select">
                <Layers size={14} />
                <select
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
              <label className="apos-select">
                <Layers size={14} />
                <select
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

            <div className="apos-table-wrap">
              <table className="apos-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Ticker</th>
                    <th>Broker</th>
                    <th>Strategy</th>
                    <th className="apos-th--right">Price</th>
                    <th className="apos-th--right">P&L</th>
                    <th className="apos-th--center">Count</th>
                    <th className="apos-th--right">Closed At</th>
                    <th className="apos-th--right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {closedPaged.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="apos-empty">
                        No past positions found.
                      </td>
                    </tr>
                  ) : (
                    closedPaged.map((g) => (
                      <tr key={g.key}>
                        <td>
                          <div className="apos-account">
                            <span className="apos-account__name">
                              {g.accountName ?? 'Unknown account'}
                            </span>
                            <span className="apos-account__id">
                              ID {g.accountId ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <TickerChip symbol={g.symbol} />
                        </td>
                        <td>
                          <span className="apos-broker">{g.broker}</span>
                        </td>
                        <td className="apos-td--muted">{g.strategy ?? '—'}</td>
                        <td className="apos-td--right mono">{fmtMoney(g.price)}</td>
                        <td className="apos-td--right">
                          <PnlCell pnl={g.realizedPnl} balance={g.accountBalance} />
                        </td>
                        <td className="apos-td--center">
                          <CountPill count={g.count} />
                        </td>
                        <td className="apos-td--right apos-td--muted mono">
                          {fmtDateTime(g.closedAt)}
                        </td>
                        <td className="apos-td--right">
                          <button
                            type="button"
                            className="apos-icon-btn apos-icon-btn--danger"
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
    <div className="apos-pag">
      <span className="apos-pag__info">
        Page {page} of {totalPages}
      </span>
      <div className="apos-pag__controls">
        <button
          type="button"
          className="apos-icon-btn"
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          className="apos-icon-btn"
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
