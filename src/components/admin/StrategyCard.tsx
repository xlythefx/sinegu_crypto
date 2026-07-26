import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BarChart3,
  Percent,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { fmtMoney, fmtShortDate, fmtSignedMoney } from '../../lib/format'
import type { StrategyStats } from '../../lib/strategyStats'

const W = 600
const H = 220
const PAD_TOP = 16
const PAD_BOTTOM = 16

const SECTION_LABEL =
  'mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-faint'
const TILE =
  'flex flex-col gap-1 py-2.5 px-3 border border-hair rounded-row bg-surface2'
const TILE_LABEL =
  'flex items-center gap-[5px] text-[10px] font-semibold uppercase tracking-[0.07em] text-muted'
const TILE_VALUE = 'font-mono text-[17px] font-bold'

interface StrategyCardProps {
  stats: StrategyStats
  enabled: boolean
  saving: boolean
  excluded: Set<string>
  onToggle: () => void
  onToggleTicker: (ticker: string) => void
  onClearExcluded: () => void
}

/** One strategy: header + toggle, exclude-ticker chips, metric tiles, equity curve. */
export default function StrategyCard({
  stats,
  enabled,
  saving,
  excluded,
  onToggle,
  onToggleTicker,
  onClearExcluded,
}: StrategyCardProps) {
  const curve = useMemo(() => {
    const values = [0, ...stats.equitySeries.map((p) => p.cumulative)]
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (min === max) {
      min -= 1
      max += 1
    }
    const yOf = (v: number) =>
      H - PAD_BOTTOM - ((v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM)
    const step = W / Math.max(1, values.length - 1)
    const pts = values.map(
      (v, i) => `${(i * step).toFixed(1)},${yOf(v).toFixed(1)}`,
    )
    const labels: string[] = []
    const series = stats.equitySeries
    const n = Math.min(6, series.length)
    for (let i = 0; i < n; i++) {
      const idx = Math.round((i * (series.length - 1)) / Math.max(1, n - 1))
      labels.push(fmtShortDate(series[idx].date))
    }
    return {
      line: `M${pts.join(' L')}`,
      area: `M${pts.join(' L')} L${W},${H} L0,${H} Z`,
      zeroY: 0 >= min && 0 <= max ? yOf(0) : null,
      labels,
    }
  }, [stats.equitySeries])

  const pf = stats.profitFactor === null ? '∞' : stats.profitFactor.toFixed(2)
  const gradId = `admst-grad-${stats.key.replace(/[^a-zA-Z0-9]/g, '-')}`

  return (
    <section
      className={`flex flex-col gap-4 p-card border border-border rounded-card bg-surface transition-opacity duration-150${enabled ? '' : ' opacity-[0.65]'}`}
      data-aos="fade-up"
    >
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3.5 pb-3.5 border-b border-hair">
        <div>
          <Link
            to={`/admin/strategies/${encodeURIComponent(stats.key)}`}
            className="group inline-flex items-center gap-[5px] font-display text-[19px] font-extrabold tracking-[-0.02em] text-text no-underline transition-colors duration-150 hover:text-accent"
          >
            {stats.key}
            <ArrowUpRight
              size={16}
              className="text-faint transition-[color,transform] duration-150 group-hover:text-accent group-hover:translate-x-px group-hover:-translate-y-px"
            />
          </Link>
          <div className="mt-[3px] text-[12.5px] text-muted">
            {stats.totalTrades} trades · {stats.winrate.toFixed(1)}% WR · PF {pf}{' '}
            · Binance
          </div>
        </div>
        <div className="flex items-center gap-3 py-2 px-3.5 border border-border rounded-strip bg-surface2">
          <div className="flex flex-col gap-px">
            <span
              className={`text-[12px] font-extrabold ${enabled ? 'text-green' : 'text-muted'}`}
            >
              {enabled ? 'Active' : 'Paused'}
            </span>
            <span className="text-[10px] text-faint">
              {saving ? 'Saving…' : 'Global'}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={`Toggle ${stats.key}`}
            className={`relative w-10 h-[22px] border rounded-pill cursor-pointer transition-[background,border-color] duration-150 disabled:opacity-[0.55] disabled:cursor-not-allowed ${enabled ? 'border-accent bg-accent' : 'border-border bg-surface'}`}
            disabled={saving}
            onClick={onToggle}
          >
            <span
              className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-pill transition-[transform,background] duration-150 ${enabled ? 'translate-x-[18px] bg-on-accent' : 'bg-muted'}`}
            />
          </button>
        </div>
      </div>

      {/* exclude tickers */}
      {stats.tickers.length > 0 && (
        <div className="py-3 px-3.5 border border-hair rounded-strip bg-surface2">
          <div className="flex items-center justify-between gap-2.5 mb-[9px]">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
              EXCLUDE TICKERS
              {excluded.size > 0 && (
                <em className="ml-2 not-italic tracking-[0.02em] text-accent">
                  {excluded.size} excluded
                </em>
              )}
            </span>
            {excluded.size > 0 && (
              <button
                type="button"
                className="border-0 bg-transparent text-[11px] font-bold text-muted cursor-pointer transition-colors duration-150 hover:text-text"
                onClick={onClearExcluded}
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.tickers.map((ticker) => {
              const off = excluded.has(ticker)
              return (
                <button
                  key={ticker}
                  type="button"
                  className={`py-[3px] px-2.5 border rounded-pill font-mono text-[11px] font-semibold cursor-pointer transition-[background,border-color,color] duration-150 ${
                    off
                      ? 'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red line-through'
                      : 'border-border bg-surface text-text hover:border-accent-line hover:bg-accent-soft'
                  }`}
                  aria-pressed={off}
                  title={off ? 'Click to include' : 'Click to exclude'}
                  onClick={() => onToggleTicker(ticker)}
                >
                  {ticker}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col items-stretch gap-[18px]">
        {/* metric tiles */}
        <div className="w-full">
          <p className={SECTION_LABEL}>PERFORMANCE METRICS</p>
          <div className="grid grid-cols-2 gap-[9px]">
            <div
              className={`${TILE} ${stats.totalPnl >= 0 ? 'bg-[linear-gradient(150deg,color-mix(in_srgb,var(--green)_8%,var(--surface2)),var(--surface2))]' : 'bg-[linear-gradient(150deg,rgba(255,90,90,0.08),var(--surface2))]'}`}
            >
              <span className={TILE_LABEL}>
                <TrendingUp size={11} />
                Total P&L
              </span>
              <span
                className={`${TILE_VALUE} ${stats.totalPnl >= 0 ? 'text-green' : 'text-red'}`}
              >
                {fmtSignedMoney(stats.totalPnl)}
              </span>
            </div>
            <div className={TILE}>
              <span className={TILE_LABEL}>
                <Zap size={11} />
                Sharpe
              </span>
              <span
                className={`${TILE_VALUE} ${stats.sharpe >= 1 ? 'text-green' : stats.sharpe >= 0 ? '' : 'text-red'}`}
              >
                {stats.sharpe.toFixed(2)}
              </span>
            </div>
            <div className={TILE}>
              <span className={TILE_LABEL}>
                <TrendingDown size={11} />
                Max DD
              </span>
              <span className={`${TILE_VALUE} text-red`}>
                −{fmtMoney(stats.maxDrawdown).slice(1)}
              </span>
            </div>
            <div className={TILE}>
              <span className={TILE_LABEL}>
                <Target size={11} />
                Prof. Factor
              </span>
              <span
                className={`${TILE_VALUE} ${stats.profitFactor === null || stats.profitFactor >= 1 ? 'text-green' : 'text-red'}`}
              >
                {pf}
              </span>
            </div>
            <div className={TILE}>
              <span className={TILE_LABEL}>
                <BarChart3 size={11} />W / L
              </span>
              <span className={TILE_VALUE}>
                {stats.wins}W / {stats.losses}L
              </span>
            </div>
            <div className={TILE}>
              <span className={TILE_LABEL}>
                <Percent size={11} />
                Winrate
                <em
                  className={`ml-auto not-italic font-mono text-[11px] font-bold ${stats.winrate >= 50 ? 'text-green' : 'text-red'}`}
                >
                  {stats.winrate.toFixed(1)}%
                </em>
              </span>
              <span className="block h-1.5 overflow-hidden rounded-pill bg-surface">
                <span
                  className={`block h-full rounded-pill transition-[width] duration-[600ms] ease-out ${stats.winrate >= 50 ? 'bg-green' : 'bg-red'}`}
                  style={{ width: `${Math.min(100, stats.winrate)}%` }}
                />
              </span>
              <span className="font-mono text-[10px] text-muted">
                Avg: +{fmtMoney(stats.avgWin).slice(1)} / −
                {fmtMoney(stats.avgLoss).slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* equity curve */}
        <div className="flex flex-col flex-1 min-w-0">
          <p className={SECTION_LABEL}>EQUITY CURVE</p>
          <div className="flex flex-col flex-1 pt-2.5 px-3 pb-2 border border-hair rounded-strip bg-surface2">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="w-full h-40 flex-1"
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity=".3" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g stroke="var(--hair)" strokeWidth="1">
                <line x1="0" y1="55" x2={W} y2="55" />
                <line x1="0" y1="110" x2={W} y2="110" />
                <line x1="0" y1="165" x2={W} y2="165" />
              </g>
              <path d={curve.area} fill={`url(#${gradId})`} />
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
                  x2={W}
                  y2={curve.zeroY}
                  stroke="var(--muted)"
                  strokeWidth="1.2"
                  strokeDasharray="5 4"
                />
              )}
            </svg>
            <div className="flex justify-between pt-1.5 font-mono text-[10px] text-faint">
              {curve.labels.map((l, i) => (
                <span key={`${l}-${i}`}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Link
        to={`/admin/strategies/${encodeURIComponent(stats.key)}`}
        className="group flex items-center justify-center gap-1.5 p-[11px] border border-accent-line rounded-row bg-accent-soft text-accent text-[13px] font-bold no-underline transition-[background,border-color] duration-150 hover:bg-accent hover:border-accent hover:text-on-accent"
      >
        View in-depth details
        <ArrowUpRight
          size={15}
          className="transition-transform duration-150 group-hover:translate-x-px group-hover:-translate-y-px"
        />
      </Link>
    </section>
  )
}
