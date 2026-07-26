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
import './StrategyCard.css'

const W = 600
const H = 220
const PAD_TOP = 16
const PAD_BOTTOM = 16

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
      className={`astcard${enabled ? '' : ' astcard--paused'}`}
      data-aos="fade-up"
    >
      {/* header */}
      <div className="astcard__header">
        <div>
          <Link
            to={`/admin/strategies/${encodeURIComponent(stats.key)}`}
            className="astcard__name astcard__name--link"
          >
            {stats.key}
            <ArrowUpRight size={16} />
          </Link>
          <div className="astcard__meta">
            {stats.totalTrades} trades · {stats.winrate.toFixed(1)}% WR · PF {pf}{' '}
            · Binance
          </div>
        </div>
        <div className="astcard__toggle-box">
          <div className="astcard__toggle-status">
            <span
              className={`astcard__toggle-state${enabled ? ' astcard__toggle-state--on' : ''}`}
            >
              {enabled ? 'Active' : 'Paused'}
            </span>
            <span className="astcard__toggle-sub">
              {saving ? 'Saving…' : 'Global'}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={`Toggle ${stats.key}`}
            className={`astcard__toggle${enabled ? ' astcard__toggle--on' : ''}`}
            disabled={saving}
            onClick={onToggle}
          >
            <span
              className={`astcard__knob${enabled ? ' astcard__knob--on' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* exclude tickers */}
      {stats.tickers.length > 0 && (
        <div className="astcard__exclude">
          <div className="astcard__exclude-head">
            <span className="astcard__exclude-label">
              EXCLUDE TICKERS
              {excluded.size > 0 && (
                <em className="astcard__exclude-count">
                  {excluded.size} excluded
                </em>
              )}
            </span>
            {excluded.size > 0 && (
              <button
                type="button"
                className="astcard__clear"
                onClick={onClearExcluded}
              >
                Clear
              </button>
            )}
          </div>
          <div className="astcard__chips">
            {stats.tickers.map((ticker) => {
              const off = excluded.has(ticker)
              return (
                <button
                  key={ticker}
                  type="button"
                  className={`astcard__chip${off ? ' astcard__chip--off' : ''}`}
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

      <div className="astcard__body">
        {/* metric tiles */}
        <div className="astcard__metrics">
          <p className="astcard__section-label">PERFORMANCE METRICS</p>
          <div className="astcard__metrics-grid">
            <div
              className={`astcard__tile ${stats.totalPnl >= 0 ? 'astcard__tile--pos' : 'astcard__tile--neg'}`}
            >
              <span className="astcard__tile-label">
                <TrendingUp size={11} />
                Total P&L
              </span>
              <span
                className={`astcard__tile-value ${stats.totalPnl >= 0 ? 'is-pos' : 'is-neg'}`}
              >
                {fmtSignedMoney(stats.totalPnl)}
              </span>
            </div>
            <div className="astcard__tile">
              <span className="astcard__tile-label">
                <Zap size={11} />
                Sharpe
              </span>
              <span
                className={`astcard__tile-value ${stats.sharpe >= 1 ? 'is-pos' : stats.sharpe >= 0 ? '' : 'is-neg'}`}
              >
                {stats.sharpe.toFixed(2)}
              </span>
            </div>
            <div className="astcard__tile">
              <span className="astcard__tile-label">
                <TrendingDown size={11} />
                Max DD
              </span>
              <span className="astcard__tile-value is-neg">
                −{fmtMoney(stats.maxDrawdown).slice(1)}
              </span>
            </div>
            <div className="astcard__tile">
              <span className="astcard__tile-label">
                <Target size={11} />
                Prof. Factor
              </span>
              <span
                className={`astcard__tile-value ${stats.profitFactor === null || stats.profitFactor >= 1 ? 'is-pos' : 'is-neg'}`}
              >
                {pf}
              </span>
            </div>
            <div className="astcard__tile">
              <span className="astcard__tile-label">
                <BarChart3 size={11} />W / L
              </span>
              <span className="astcard__tile-value">
                {stats.wins}W / {stats.losses}L
              </span>
            </div>
            <div className="astcard__tile">
              <span className="astcard__tile-label">
                <Percent size={11} />
                Winrate
                <em
                  className={`astcard__winrate-pct ${stats.winrate >= 50 ? 'is-pos' : 'is-neg'}`}
                >
                  {stats.winrate.toFixed(1)}%
                </em>
              </span>
              <span className="astcard__bar">
                <span
                  className={`astcard__bar-fill ${stats.winrate >= 50 ? 'astcard__bar-fill--pos' : 'astcard__bar-fill--neg'}`}
                  style={{ width: `${Math.min(100, stats.winrate)}%` }}
                />
              </span>
              <span className="astcard__winrate-avg">
                Avg: +{fmtMoney(stats.avgWin).slice(1)} / −
                {fmtMoney(stats.avgLoss).slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* equity curve */}
        <div className="astcard__chart-col">
          <p className="astcard__section-label">EQUITY CURVE</p>
          <div className="astcard__chart-box">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="astcard__chart-svg"
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
            <div className="astcard__chart-labels">
              {curve.labels.map((l, i) => (
                <span key={`${l}-${i}`}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Link
        to={`/admin/strategies/${encodeURIComponent(stats.key)}`}
        className="astcard__details"
      >
        View in-depth details
        <ArrowUpRight size={15} />
      </Link>
    </section>
  )
}
