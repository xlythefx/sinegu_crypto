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
import { displaySymbol } from '../lib/chart'
import type { PastPosition } from '../types/dashboard'
import EquityCurveCard from '../components/admin/strategy-detail/EquityCurveCard'
import PnlBreakdown from '../components/ui/PnlBreakdown'

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

// Shared class strings (migrated from .dcard / .sd-* primitives).
const CARD = 'rounded-card border border-border bg-surface p-card'
const TITLE_ROW = 'flex items-center gap-2.5 mb-3.5'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'
const MUTED = 'text-muted text-[13px]'
const CLEAR = 'h-10 border-0 bg-transparent text-accent text-[12px] font-bold cursor-pointer font-body'
const TICKER_BASE =
  'font-mono text-[11px] font-semibold py-1 px-2.5 rounded-pill border cursor-pointer'
const BAR = 'flex-1 min-w-0 flex flex-col items-center gap-[7px] h-full'
const BAR_TRACK = 'flex-1 w-full max-w-10 flex items-end justify-center'
const BAR_FILL = 'w-full min-h-[3px] rounded-t-[6px] rounded-b-[3px]'
const BAR_LABEL = 'font-mono text-[10.5px] font-bold text-faint'
const WL_TILE =
  'border border-hair bg-surface2 rounded-field py-[9px] px-[11px] flex flex-col gap-0.5'
const WL_LABEL = 'text-[9.5px] font-extrabold tracking-[0.4px] text-faint uppercase'
const WL_VALUE = 'font-mono text-[14px] font-extrabold'
const TH =
  'text-left font-mono text-[10px] tracking-[0.08em] uppercase text-faint font-semibold py-2.5 px-3 border-b border-border whitespace-nowrap'
const TD = 'py-[11px] px-3 border-b border-hair whitespace-nowrap align-middle'
const THBTN = 'bg-transparent border-0 p-0 text-inherit cursor-pointer hover:text-text'
const SIDE_BASE =
  'font-mono text-[10px] font-semibold tracking-[0.06em] py-0.5 px-2 rounded-pill border'
const PAGER_BTN =
  'border border-border bg-surface2 text-text rounded-pill py-[7px] px-[15px] text-[12.5px] font-semibold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed enabled:hover:border-accent'

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
    <div className="relative w-40 mx-auto mt-1.5 mb-3.5">
      <svg viewBox="0 0 140 140" className="w-full block">
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
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[24px] font-extrabold tracking-[-0.5px]">{total}</span>
        <span className="text-[10px] font-bold tracking-[0.6px] text-faint uppercase">
          Trades
        </span>
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
      <div className="flex flex-col gap-stack">
        {/* header */}
        <div className="flex items-center justify-between gap-stack flex-wrap" data-aos="fade-up">
          <div className="flex items-center gap-[13px] min-w-0">
            <Link
              to="/dashboard/analytics"
              className="w-10 h-10 flex-none rounded-nav border border-border bg-surface text-text flex items-center justify-center transition-[border-color] duration-150 hover:border-accent hover:text-accent"
              aria-label="Back to analytics"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-display text-[23px] font-extrabold tracking-[-0.4px]">
                {decodedKey}
              </h1>
              <p className="text-[12.5px] text-muted mt-0.5">
                {detail.totalTrades} closed trade
                {detail.totalTrades === 1 ? '' : 's'} · Binance
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <span
              className={`flex flex-col gap-0.5 py-[9px] px-[15px] rounded-row border ${
                detail.totalPnl < 0
                  ? 'border-[rgba(255,90,90,0.3)] bg-[rgba(255,90,90,0.06)]'
                  : 'border-[rgba(47,214,122,0.3)] bg-[rgba(47,214,122,0.06)]'
              }`}
            >
              <span className="text-[9.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                Total P&L · before fees
              </span>
              <PnlBreakdown gross={detail.totalPnl} net={detail.totalPnlNet} heading={detail.key}>
                <span className="text-[16px] font-extrabold font-mono">
                  {fmtSignedMoney(detail.totalPnl)}
                </span>
              </PnlBreakdown>
            </span>
            <span className="flex flex-col gap-0.5 py-[9px] px-[15px] rounded-row border border-border bg-surface">
              <span className="text-[9.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                Win Rate
              </span>
              <span className="text-[16px] font-extrabold font-mono">
                {detail.winrate.toFixed(1)}%
              </span>
            </span>
            <span className="flex flex-col gap-0.5 py-[9px] px-[15px] rounded-row border border-border bg-surface">
              <span className="text-[9.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                Sharpe
              </span>
              <span className="text-[16px] font-extrabold font-mono">
                {detail.sharpe.toFixed(2)}
              </span>
            </span>
          </div>
        </div>

        {!hasTrades ? (
          <div
            className={`${CARD} py-8 px-5 text-center ${MUTED}`}
            data-aos="fade-up"
          >
            No trades for this strategy{dateFrom || dateTo ? ' in this date range' : ''}.
          </div>
        ) : (
          <>
            {/* filters */}
            <div className={`${CARD} flex flex-col gap-3.5`} data-aos="fade-up">
              <div className="flex items-end gap-3 flex-wrap">
                <label className="flex flex-col gap-[5px]">
                  <span className="text-[10px] font-extrabold tracking-[0.5px] text-faint uppercase">
                    From
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-10 border border-border rounded-field bg-surface2 text-text px-3 font-mono text-[12.5px] [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </label>
                <label className="flex flex-col gap-[5px]">
                  <span className="text-[10px] font-extrabold tracking-[0.5px] text-faint uppercase">
                    To
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-10 border border-border rounded-field bg-surface2 text-text px-3 font-mono text-[12.5px] [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </label>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    className={CLEAR}
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
                <div className="flex items-center flex-wrap gap-[7px]">
                  <span className="font-mono text-[10px] tracking-[0.12em] text-faint font-semibold mr-0.5">
                    TICKERS
                  </span>
                  {detail.tickers.map((t) => {
                    const off = excluded.has(t)
                    return (
                      <button
                        key={t}
                        type="button"
                        className={
                          off
                            ? `${TICKER_BASE} border-[rgba(255,90,90,0.4)] bg-[rgba(255,90,90,0.08)] text-red line-through`
                            : `${TICKER_BASE} border-border bg-surface text-text hover:border-accent-line hover:bg-accent-soft`
                        }
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
                      className={CLEAR}
                      onClick={() => setExcluded(new Set())}
                    >
                      Include all
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* metrics grid */}
            <div
              className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-[10px]"
              data-aos="fade-up"
            >
              <MetricTile
                icon={<TrendingUp size={13} />}
                label="Total P&L · before fees"
                value={fmtSignedMoney(detail.totalPnl)}
                tone={detail.totalPnl >= 0 ? 'pos' : 'neg'}
                sub={
                  detail.fees !== 0
                    ? `${fmtSignedMoney(detail.totalPnlNet)} after fees`
                    : `Gross win +${fmtMoney(detail.grossWin).slice(1)}`
                }
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
            <div
              className="grid grid-cols-[1.6fr_1fr] gap-stack items-stretch max-[900px]:grid-cols-1"
              data-aos="fade-up"
            >
              {/* Before fees, with the after-fees figure on hover — the same
                  card the admin strategy detail draws. */}
              {detail.equitySeries.length > 0 ? (
                <EquityCurveCard equitySeries={detail.equitySeries} />
              ) : (
                <section className={CARD}>
                  <div className={TITLE_ROW}>
                    <div>
                      <div className={CARD_TITLE}>Equity Curve</div>
                      <div className={CARD_SUB}>Cumulative realized P&L over time</div>
                    </div>
                  </div>
                  <p className={MUTED}>Not enough trades to plot a curve.</p>
                </section>
              )}

              <section className={`${CARD} flex flex-col`}>
                <div className={TITLE_ROW}>
                  <div>
                    <div className={CARD_TITLE}>Win / Loss</div>
                    <div className={CARD_SUB}>{detail.winrate.toFixed(1)}% win rate</div>
                  </div>
                </div>
                <WinLossDonut wins={detail.wins} losses={detail.losses} />
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <div className={WL_TILE}>
                    <span className={WL_LABEL}>Avg Win</span>
                    <span className={`${WL_VALUE} text-green`}>
                      +{fmtMoney(detail.avgWin).slice(1)}
                    </span>
                  </div>
                  <div className={WL_TILE}>
                    <span className={WL_LABEL}>Avg Loss</span>
                    <span className={`${WL_VALUE} text-red`}>
                      -{fmtMoney(detail.avgLoss).slice(1)}
                    </span>
                  </div>
                  <div className={WL_TILE}>
                    <span className={WL_LABEL}>Win Streak</span>
                    <span className={WL_VALUE}>{detail.maxWinStreak}</span>
                  </div>
                  <div className={WL_TILE}>
                    <span className={WL_LABEL}>Loss Streak</span>
                    <span className={WL_VALUE}>{detail.maxLossStreak}</span>
                  </div>
                </div>
              </section>
            </div>

            {/* seasonality */}
            <div
              className="grid grid-cols-[1.6fr_1fr] gap-stack items-stretch max-[900px]:grid-cols-1"
              data-aos="fade-up"
            >
              <section className={CARD}>
                <div className={TITLE_ROW}>
                  <div>
                    <div className={CARD_TITLE}>By Day of Week</div>
                    <div className={CARD_SUB}>Realized P&L per weekday</div>
                  </div>
                </div>
                <div className="flex items-end gap-2 h-[170px] pt-2">
                  {DOW.map(({ i, label }) => {
                    const b = detail.byDayOfWeek[i]
                    const pos = b.pnl >= 0
                    return (
                      <div className={BAR} key={label}>
                        <div className={BAR_TRACK}>
                          <div
                            className={`${BAR_FILL} ${pos ? 'bg-green' : 'bg-red'}`}
                            style={{ height: `${(Math.abs(b.pnl) / dowMax) * 100}%` }}
                            title={fmtSignedMoney(b.pnl)}
                          />
                        </div>
                        <span className={BAR_LABEL}>{label}</span>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className={CARD}>
                <div className={TITLE_ROW}>
                  <div>
                    <div className={CARD_TITLE}>By Month</div>
                    <div className={CARD_SUB}>Realized P&L per month</div>
                  </div>
                </div>
                {detail.byMonth.length > 0 ? (
                  <div className="flex items-end gap-2 h-[170px] pt-2">
                    {detail.byMonth.map((m) => {
                      const pos = m.pnl >= 0
                      const label = new Date(`${m.ym}-01T00:00:00`).toLocaleDateString(
                        'en-US',
                        { month: 'short' },
                      )
                      return (
                        <div className={BAR} key={m.ym}>
                          <div className={BAR_TRACK}>
                            <div
                              className={`${BAR_FILL} ${pos ? 'bg-green' : 'bg-red'}`}
                              style={{ height: `${(Math.abs(m.pnl) / monthMax) * 100}%` }}
                              title={fmtSignedMoney(m.pnl)}
                            />
                          </div>
                          <span className={BAR_LABEL}>{label}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className={MUTED}>No monthly data.</p>
                )}
              </section>
            </div>

            {/* per-asset */}
            <section className={CARD} data-aos="fade-up">
              <div className={TITLE_ROW}>
                <div>
                  <div className={CARD_TITLE}>Asset Breakdown</div>
                  <div className={CARD_SUB}>
                    How this strategy performs per ticker
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-[9px] mb-[18px]">
                {detail.byAsset.map((a) => {
                  const pos = a.totalPnl >= 0
                  return (
                    <div
                      className="grid grid-cols-[96px_1fr_auto_auto] items-center gap-3 max-[560px]:grid-cols-[76px_1fr_auto]"
                      key={a.ticker}
                    >
                      <div className="text-[12.5px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                        {displaySymbol(a.ticker)}
                      </div>
                      <div className="h-2 rounded-[4px] bg-surface2 overflow-hidden">
                        <div
                          className={`h-full rounded-[4px] ${pos ? 'bg-green' : 'bg-red'}`}
                          style={{ width: `${(Math.abs(a.totalPnl) / assetMax) * 100}%` }}
                        />
                      </div>
                      <div className="font-mono text-[11px] text-muted whitespace-nowrap max-[560px]:hidden">
                        {a.trades}t · {a.winrate.toFixed(0)}% WR
                      </div>
                      <div
                        className={`font-mono text-[12.5px] font-extrabold text-right min-w-[78px] ${pos ? 'text-green' : 'text-red'}`}
                      >
                        {fmtSignedMoney(a.totalPnl)}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                <AssetMiniTable title="Top Winners" rows={winners} />
                <AssetMiniTable title="Top Losers" rows={losers} />
              </div>
            </section>

            {/* past positions table */}
            <section className={CARD} data-aos="fade-up">
              <div className="flex items-start justify-between gap-3.5 flex-wrap mb-3.5">
                <div>
                  <div className={CARD_TITLE}>Past Positions</div>
                  <div className={CARD_SUB}>
                    {tableRows.length} trade{tableRows.length === 1 ? '' : 's'}
                  </div>
                </div>
                <label className="flex items-center gap-2 h-[38px] px-3 border border-border rounded-field bg-surface2 text-muted min-w-[200px]">
                  <Search size={14} />
                  <input
                    type="search"
                    placeholder="Filter by ticker…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                    className="flex-1 border-0 outline-none bg-transparent text-text text-[13px] min-w-0"
                  />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className={`${TH} w-11`}>#</th>
                      <th className={TH}>
                        <button type="button" className={THBTN} onClick={() => setSort('symbol')}>
                          Asset
                        </button>
                      </th>
                      <th className={TH}>Side</th>
                      <th className={`${TH} text-right`}>
                        <button type="button" className={THBTN} onClick={() => setSort('realized_pnl')}>
                          P&L
                        </button>
                      </th>
                      <th className={`${TH} text-right`}>Exit Price</th>
                      <th className={`${TH} text-right`}>
                        <button type="button" className={THBTN} onClick={() => setSort('closed_at')}>
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
                        <tr
                          key={r.id}
                          className="transition-colors hover:bg-surface2 last:[&>td]:border-b-0"
                        >
                          <td className={`${TD} text-faint w-11 font-mono`}>
                            {(safePage - 1) * PAGE_SIZE + i + 1}
                          </td>
                          <td className={`${TD} font-bold`}>{displaySymbol(r.symbol)}</td>
                          <td className={TD}>
                            <span
                              className={
                                short
                                  ? `${SIDE_BASE} text-red border-[rgba(255,90,90,0.35)] bg-[rgba(255,90,90,0.08)]`
                                  : `${SIDE_BASE} text-green border-[rgba(47,214,122,0.35)] bg-[rgba(47,214,122,0.08)]`
                              }
                            >
                              {r.position_side}
                            </span>
                          </td>
                          <td
                            className={`${TD} text-right font-mono ${pnl < 0 ? 'text-red' : 'text-green'}`}
                          >
                            {fmtSignedMoney(pnl)}
                          </td>
                          <td className={`${TD} text-right font-mono text-muted`}>
                            {r.exit_price ? fmtMoney(num(r.exit_price)) : '—'}
                          </td>
                          <td className={`${TD} text-right font-mono text-muted`}>
                            {fmtMediumDate(r.closed_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 mt-3.5 pt-3 border-t border-hair">
                  <span className={MUTED}>
                    Page {safePage} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={PAGER_BTN}
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className={PAGER_BTN}
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

/** One metric tile (mirrors the migrated Analytics MetricTile primitive). */
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
    <div className="bg-surface2 border border-hair rounded-row py-[13px] px-[14px] flex flex-col gap-[5px]">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="flex items-center flex-none text-accent">{icon}</span>
        <span className="text-[10px] font-extrabold tracking-[0.5px] text-faint uppercase min-w-0">
          {label}
        </span>
      </div>
      <div
        className={`font-mono text-[17px] font-extrabold tracking-[-0.2px]${tone === 'pos' ? ' text-green' : tone === 'neg' ? ' text-red' : ''}`}
      >
        {value}
      </div>
      <div className="text-[11px] font-semibold text-muted">{sub}</div>
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
    <div className="border border-hair rounded-row bg-surface2 py-3 px-3.5">
      <div className="font-mono text-[10px] tracking-[0.1em] text-faint font-semibold mb-2">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted text-[13px] my-1">None.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.slice(0, 5).map((a) => (
            <div
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5"
              key={a.ticker}
            >
              <span className="text-[12.5px] font-bold">{displaySymbol(a.ticker)}</span>
              <span className="font-mono text-[11px] text-muted">
                {a.winrate.toFixed(0)}%
              </span>
              <span
                className={`font-mono text-[12.5px] font-extrabold text-right min-w-[74px] ${a.totalPnl < 0 ? 'text-red' : 'text-green'}`}
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
