import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  Percent,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import { useApiData } from '../hooks/useApiData'
import { getPastPositions } from '../services/dashboard'
import { ApiError } from '../services/api'
import {
  computeStrategyDetail,
  pastPositionsToStrategyTrades,
} from '../lib/strategyDetail'
import { fmtMediumDate, fmtMoney, fmtSignedMoney } from '../lib/format'
import { displaySymbol, linePath } from '../lib/chart'
import type { PastPosition } from '../types/dashboard'
import './StrategyDetail.css'

const DOW = [
  { i: 1, label: 'Mon' },
  { i: 2, label: 'Tue' },
  { i: 3, label: 'Wed' },
  { i: 4, label: 'Thu' },
  { i: 5, label: 'Fri' },
  { i: 6, label: 'Sat' },
  { i: 0, label: 'Sun' },
]
const PAGE_SIZE = 10
const CURVE_W = 620
const CURVE_H = 220

type SortKey = 'closed_at' | 'realized_pnl' | 'symbol'

function strategyOf(r: PastPosition): string {
  return (r.strategy ?? '').trim() || 'Manual'
}

function num(v: string | null): number {
  return Number(v) || 0
}

function sharpeLabel(s: number): string {
  if (s >= 1) return 'Strong'
  if (s >= 0) return 'Moderate'
  return 'Negative'
}

/** Wins-vs-losses donut. */
function WinLossDonut({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  const R = 54
  const C = 2 * Math.PI * R
  const winFrac = total > 0 ? wins / total : 0
  return (
    <div className="sd-donut">
      <svg viewBox="0 0 140 140" className="sd-donut__svg">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--red)" strokeWidth="16" />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="var(--green)"
          strokeWidth="16"
          strokeDasharray={`${(winFrac * C).toFixed(1)} ${C.toFixed(1)}`}
          strokeDashoffset={(C * 0.25).toFixed(1)}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="sd-donut__center">
        <span className="sd-donut__value">{total}</span>
        <span className="sd-donut__label">Trades</span>
      </div>
    </div>
  )
}

export default function StrategyDetail() {
  const { strategyKey } = useParams()
  const decodedKey = decodeURIComponent(strategyKey ?? '')
  const { data, loading, error, reload } = useApiData(getPastPositions)

  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('closed_at')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)

  // All of this strategy's rows for the user.
  const strategyRows = useMemo(
    () => (data ?? []).filter((r) => strategyOf(r) === decodedKey),
    [data, decodedKey],
  )

  // Date-scoped rows feed both stats and the table.
  const scopedRows = useMemo(
    () =>
      strategyRows.filter((r) => {
        const day = r.closed_at.slice(0, 10)
        if (dateFrom && day < dateFrom) return false
        if (dateTo && day > dateTo) return false
        return true
      }),
    [strategyRows, dateFrom, dateTo],
  )

  const detail = useMemo(
    () =>
      computeStrategyDetail(
        decodedKey,
        pastPositionsToStrategyTrades(scopedRows),
        excluded,
      ),
    [decodedKey, scopedRows, excluded],
  )

  // Table rows: date-scoped, ticker-excluded, searched, sorted.
  const tableRows = useMemo(() => {
    const q = search.trim().toUpperCase()
    const rows = scopedRows.filter(
      (r) =>
        !excluded.has(r.symbol.trim()) &&
        (!q || r.symbol.toUpperCase().includes(q)),
    )
    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'realized_pnl') cmp = num(a.realized_pnl) - num(b.realized_pnl)
      else if (sortKey === 'symbol') cmp = a.symbol.localeCompare(b.symbol)
      else cmp = a.closed_at.localeCompare(b.closed_at)
      return sortDesc ? -cmp : cmp
    })
    return rows
  }, [scopedRows, excluded, search, sortKey, sortDesc])

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const toggleTicker = (t: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  const setSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc((d) => !d)
    else {
      setSortKey(key)
      setSortDesc(true)
    }
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = tableRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  // Equity curve geometry (0-seeded cumulative series).
  const curve = useMemo(() => {
    const values = [0, ...detail.equitySeries.map((p) => p.cumulative)]
    if (values.length < 2) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const line = linePath(values, CURVE_W, CURVE_H, 12, min, max)
    const zeroY =
      0 >= min && 0 <= max
        ? CURVE_H -
          12 -
          ((0 - min) / (max - min || 1)) * (CURVE_H - 24)
        : null
    return {
      line,
      area: `${line} L${CURVE_W},${CURVE_H} L0,${CURVE_H} Z`,
      zeroY,
    }
  }, [detail.equitySeries])

  const pf = detail.profitFactor === null ? '∞' : detail.profitFactor.toFixed(2)
  const winners = detail.byAsset.filter((a) => a.totalPnl > 0)
  const losers = detail.byAsset.filter((a) => a.totalPnl < 0).reverse()
  const dowMax = Math.max(1, ...detail.byDayOfWeek.map((d) => Math.abs(d.pnl)))
  const monthMax = Math.max(1, ...detail.byMonth.map((m) => Math.abs(m.pnl)))
  const assetMax = Math.max(1, ...detail.byAsset.map((a) => Math.abs(a.totalPnl)))

  const hasTrades = detail.totalTrades > 0

  if (!data) {
    return (
      <DashboardLayout title="Strategy Analysis">
        <DataState loading={loading} error={error} onRetry={reload} label="strategy" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Strategy Analysis">
      <div className="sd">
        {/* header */}
        <div className="sd-head" data-aos="fade-up">
          <div className="sd-head__left">
            <Link to="/dashboard/analytics" className="sd-back" aria-label="Back to analytics">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="sd-head__title">{decodedKey}</h1>
              <p className="sd-head__sub">
                {detail.totalTrades} closed trade
                {detail.totalTrades === 1 ? '' : 's'} · Binance
              </p>
            </div>
          </div>
          <div className="sd-head__badges">
            <span className={`sd-badge ${detail.totalPnl < 0 ? 'is-neg' : 'is-pos'}`}>
              <span className="sd-badge__label">Total P&L</span>
              <span className="sd-badge__value mono">
                {fmtSignedMoney(detail.totalPnl)}
              </span>
            </span>
            <span className="sd-badge">
              <span className="sd-badge__label">Win Rate</span>
              <span className="sd-badge__value mono">
                {detail.winrate.toFixed(1)}%
              </span>
            </span>
            <span className="sd-badge">
              <span className="sd-badge__label">Sharpe</span>
              <span className="sd-badge__value mono">
                {detail.sharpe.toFixed(2)}
              </span>
            </span>
          </div>
        </div>

        {!hasTrades ? (
          <div className="dcard sd-empty" data-aos="fade-up">
            No trades for this strategy{dateFrom || dateTo ? ' in this date range' : ''}.
          </div>
        ) : (
          <>
            {/* filters */}
            <div className="dcard sd-filters" data-aos="fade-up">
              <div className="sd-filters__dates">
                <label className="sd-field">
                  <span>From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className="sd-field">
                  <span>To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    className="sd-clear"
                    onClick={() => {
                      setDateFrom('')
                      setDateTo('')
                    }}
                  >
                    Clear dates
                  </button>
                )}
              </div>
              {detail.tickers.length > 0 && (
                <div className="sd-tickers">
                  <span className="sd-tickers__label mono">TICKERS</span>
                  {detail.tickers.map((t) => {
                    const off = excluded.has(t)
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`sd-ticker${off ? ' sd-ticker--off' : ''}`}
                        aria-pressed={off}
                        title={off ? 'Click to include' : 'Click to exclude'}
                        onClick={() => toggleTicker(t)}
                      >
                        {displaySymbol(t)}
                      </button>
                    )
                  })}
                  {excluded.size > 0 && (
                    <button
                      type="button"
                      className="sd-clear"
                      onClick={() => setExcluded(new Set())}
                    >
                      Include all
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* metrics grid */}
            <div className="ptiles ptiles--4" data-aos="fade-up">
              <MetricTile
                icon={<TrendingUp size={13} />}
                label="Total P&L"
                value={fmtSignedMoney(detail.totalPnl)}
                tone={detail.totalPnl >= 0 ? 'pos' : 'neg'}
                sub={`Gross win +${fmtMoney(detail.grossWin).slice(1)}`}
              />
              <MetricTile
                icon={<Percent size={13} />}
                label="Win Rate"
                value={`${detail.winrate.toFixed(1)}%`}
                sub={`${detail.wins}W / ${detail.losses}L`}
              />
              <MetricTile
                icon={<Zap size={13} />}
                label="Sharpe"
                value={detail.sharpe.toFixed(2)}
                tone={detail.sharpe >= 1 ? 'pos' : detail.sharpe < 0 ? 'neg' : undefined}
                sub={sharpeLabel(detail.sharpe)}
              />
              <MetricTile
                icon={<Target size={13} />}
                label="Profit Factor"
                value={pf}
                tone={detail.profitFactor === null || detail.profitFactor >= 1 ? 'pos' : 'neg'}
                sub={`Gross loss -${fmtMoney(detail.grossLoss).slice(1)}`}
              />
              <MetricTile
                icon={<TrendingDown size={13} />}
                label="Max Drawdown"
                value={`-${fmtMoney(detail.maxDrawdown).slice(1)}`}
                tone="neg"
                sub={`Worst trade -${fmtMoney(Math.abs(detail.worstTrade)).slice(1)}`}
              />
              <MetricTile
                icon={<BarChart3 size={13} />}
                label="Avg Win / Loss"
                value={`+${fmtMoney(detail.avgWin).slice(1)}`}
                tone="pos"
                sub={`Avg loss -${fmtMoney(detail.avgLoss).slice(1)}`}
              />
              <MetricTile
                icon={<Trophy size={13} />}
                label="Best Trade"
                value={`+${fmtMoney(detail.bestTrade).slice(1)}`}
                tone="pos"
                sub={`Max win streak ${detail.maxWinStreak}`}
              />
              <MetricTile
                icon={<Target size={13} />}
                label="Expectancy"
                value={fmtSignedMoney(detail.expectancy)}
                tone={detail.expectancy >= 0 ? 'pos' : 'neg'}
                sub={`Max loss streak ${detail.maxLossStreak}`}
              />
            </div>

            {/* equity curve + win/loss */}
            <div className="sd-row2" data-aos="fade-up">
              <section className="dcard">
                <div className="dcard__title-row">
                  <div>
                    <div className="dcard__title">Equity Curve</div>
                    <div className="dcard__sub">Cumulative realized P&L over time</div>
                  </div>
                </div>
                {curve ? (
                  <svg
                    viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
                    preserveAspectRatio="none"
                    className="sd-curve"
                  >
                    <defs>
                      <linearGradient id="sdFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity=".28" />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={curve.area} fill="url(#sdFill)" />
                    <path
                      d={curve.line}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {curve.zeroY !== null && (
                      <line
                        x1="0"
                        y1={curve.zeroY}
                        x2={CURVE_W}
                        y2={curve.zeroY}
                        stroke="var(--muted)"
                        strokeWidth="1"
                        strokeDasharray="5 4"
                      />
                    )}
                  </svg>
                ) : (
                  <p className="sd-muted">Not enough trades to plot a curve.</p>
                )}
              </section>

              <section className="dcard sd-winloss">
                <div className="dcard__title-row">
                  <div>
                    <div className="dcard__title">Win / Loss</div>
                    <div className="dcard__sub">{detail.winrate.toFixed(1)}% win rate</div>
                  </div>
                </div>
                <WinLossDonut wins={detail.wins} losses={detail.losses} />
                <div className="sd-wl-tiles">
                  <div className="sd-wl-tile">
                    <span className="sd-wl-tile__label">Avg Win</span>
                    <span className="sd-wl-tile__value mono is-pos">
                      +{fmtMoney(detail.avgWin).slice(1)}
                    </span>
                  </div>
                  <div className="sd-wl-tile">
                    <span className="sd-wl-tile__label">Avg Loss</span>
                    <span className="sd-wl-tile__value mono is-neg">
                      -{fmtMoney(detail.avgLoss).slice(1)}
                    </span>
                  </div>
                  <div className="sd-wl-tile">
                    <span className="sd-wl-tile__label">Win Streak</span>
                    <span className="sd-wl-tile__value mono">{detail.maxWinStreak}</span>
                  </div>
                  <div className="sd-wl-tile">
                    <span className="sd-wl-tile__label">Loss Streak</span>
                    <span className="sd-wl-tile__value mono">{detail.maxLossStreak}</span>
                  </div>
                </div>
              </section>
            </div>

            {/* seasonality */}
            <div className="sd-row2" data-aos="fade-up">
              <section className="dcard">
                <div className="dcard__title-row">
                  <div>
                    <div className="dcard__title">By Day of Week</div>
                    <div className="dcard__sub">Realized P&L per weekday</div>
                  </div>
                </div>
                <div className="sd-bars">
                  {DOW.map(({ i, label }) => {
                    const b = detail.byDayOfWeek[i]
                    const pos = b.pnl >= 0
                    return (
                      <div className="sd-bar" key={label}>
                        <div className="sd-bar__track">
                          <div
                            className={`sd-bar__fill ${pos ? 'is-pos' : 'is-neg'}`}
                            style={{ height: `${(Math.abs(b.pnl) / dowMax) * 100}%` }}
                            title={fmtSignedMoney(b.pnl)}
                          />
                        </div>
                        <span className="sd-bar__label mono">{label}</span>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="dcard">
                <div className="dcard__title-row">
                  <div>
                    <div className="dcard__title">By Month</div>
                    <div className="dcard__sub">Realized P&L per month</div>
                  </div>
                </div>
                {detail.byMonth.length > 0 ? (
                  <div className="sd-bars">
                    {detail.byMonth.map((m) => {
                      const pos = m.pnl >= 0
                      const label = new Date(`${m.ym}-01T00:00:00`).toLocaleDateString(
                        'en-US',
                        { month: 'short' },
                      )
                      return (
                        <div className="sd-bar" key={m.ym}>
                          <div className="sd-bar__track">
                            <div
                              className={`sd-bar__fill ${pos ? 'is-pos' : 'is-neg'}`}
                              style={{ height: `${(Math.abs(m.pnl) / monthMax) * 100}%` }}
                              title={fmtSignedMoney(m.pnl)}
                            />
                          </div>
                          <span className="sd-bar__label mono">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="sd-muted">No monthly data.</p>
                )}
              </section>
            </div>

            {/* per-asset */}
            <section className="dcard" data-aos="fade-up">
              <div className="dcard__title-row">
                <div>
                  <div className="dcard__title">Asset Breakdown</div>
                  <div className="dcard__sub">
                    How this strategy performs per ticker
                  </div>
                </div>
              </div>

              <div className="sd-assets">
                {detail.byAsset.map((a) => {
                  const pos = a.totalPnl >= 0
                  return (
                    <div className="sd-asset" key={a.ticker}>
                      <div className="sd-asset__name">{displaySymbol(a.ticker)}</div>
                      <div className="sd-asset__track">
                        <div
                          className={`sd-asset__fill ${pos ? 'is-pos' : 'is-neg'}`}
                          style={{ width: `${(Math.abs(a.totalPnl) / assetMax) * 100}%` }}
                        />
                      </div>
                      <div className="sd-asset__meta mono">
                        {a.trades}t · {a.winrate.toFixed(0)}% WR
                      </div>
                      <div className={`sd-asset__pnl mono ${pos ? 'is-pos' : 'is-neg'}`}>
                        {fmtSignedMoney(a.totalPnl)}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="sd-wl-tables">
                <AssetMiniTable title="Top Winners" rows={winners} />
                <AssetMiniTable title="Top Losers" rows={losers} />
              </div>
            </section>

            {/* past positions table */}
            <section className="dcard" data-aos="fade-up">
              <div className="sd-table-head">
                <div>
                  <div className="dcard__title">Past Positions</div>
                  <div className="dcard__sub">
                    {tableRows.length} trade{tableRows.length === 1 ? '' : 's'}
                  </div>
                </div>
                <label className="sd-search">
                  <Search size={14} />
                  <input
                    type="search"
                    placeholder="Filter by ticker…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                  />
                </label>
              </div>

              <div className="sd-table-wrap">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th className="sd-table__num">#</th>
                      <th>
                        <button type="button" className="sd-th-btn" onClick={() => setSort('symbol')}>
                          Asset
                        </button>
                      </th>
                      <th>Side</th>
                      <th className="sd-table__right">
                        <button type="button" className="sd-th-btn" onClick={() => setSort('realized_pnl')}>
                          P&L
                        </button>
                      </th>
                      <th className="sd-table__right">Exit Price</th>
                      <th className="sd-table__right">
                        <button type="button" className="sd-th-btn" onClick={() => setSort('closed_at')}>
                          Closed
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => {
                      const pnl = num(r.realized_pnl)
                      const short = r.position_side === 'SHORT'
                      return (
                        <tr key={r.id}>
                          <td className="sd-table__num mono">
                            {(safePage - 1) * PAGE_SIZE + i + 1}
                          </td>
                          <td className="sd-table__asset">{displaySymbol(r.symbol)}</td>
                          <td>
                            <span className={`sd-side ${short ? 'is-short' : 'is-long'}`}>
                              {r.position_side}
                            </span>
                          </td>
                          <td className={`sd-table__right mono ${pnl < 0 ? 'is-neg' : 'is-pos'}`}>
                            {fmtSignedMoney(pnl)}
                          </td>
                          <td className="sd-table__right mono sd-muted">
                            {r.exit_price ? fmtMoney(num(r.exit_price)) : '—'}
                          </td>
                          <td className="sd-table__right mono sd-muted">
                            {fmtMediumDate(r.closed_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="sd-pager">
                  <span className="sd-muted">
                    Page {safePage} of {totalPages}
                  </span>
                  <div className="sd-pager__btns">
                    <button
                      type="button"
                      className="sd-pager__btn"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="sd-pager__btn"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

/** One metric tile (reuses the Analytics .ptile primitive). */
function MetricTile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  tone?: 'pos' | 'neg'
}) {
  return (
    <div className="ptile">
      <div className="ptile__head">
        <span className="ptile__icon">{icon}</span>
        <span className="ptile__label">{label}</span>
      </div>
      <div
        className={`ptile__value${tone === 'pos' ? ' is-pos' : tone === 'neg' ? ' is-neg' : ''}`}
      >
        {value}
      </div>
      <div className="ptile__sub">{sub}</div>
    </div>
  )
}

interface AssetRow {
  ticker: string
  trades: number
  winrate: number
  totalPnl: number
}

/** Winners / losers mini table. */
function AssetMiniTable({ title, rows }: { title: string; rows: AssetRow[] }) {
  return (
    <div className="sd-mini">
      <div className="sd-mini__title mono">{title}</div>
      {rows.length === 0 ? (
        <p className="sd-muted sd-mini__empty">None.</p>
      ) : (
        <div className="sd-mini__rows">
          {rows.slice(0, 5).map((a) => (
            <div className="sd-mini__row" key={a.ticker}>
              <span className="sd-mini__sym">{displaySymbol(a.ticker)}</span>
              <span className="sd-mini__wr mono">{a.winrate.toFixed(0)}%</span>
              <span
                className={`sd-mini__pnl mono ${a.totalPnl < 0 ? 'is-neg' : 'is-pos'}`}
              >
                {fmtSignedMoney(a.totalPnl)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
