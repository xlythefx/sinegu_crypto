import { useState } from 'react'
import { Calendar as CalendarIcon, Filter } from 'lucide-react'
import { useApiData } from '../../hooks/useApiData'
import { getAdminPerformance } from '../../services/admin'
import { displaySymbol, linePath } from '../../lib/chart'
import type { PerformanceFilters } from '../../types/admin'

type Period = NonNullable<PerformanceFilters['period']>

const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'all', label: 'All' },
]

const VIEW_W = 900
const VIEW_H = 260

const filterBtn =
  'flex items-center gap-1.5 h-[34px] px-3 rounded-field border border-border bg-surface text-text text-[12.5px] font-semibold cursor-pointer hover:border-accent-line hover:bg-accent-soft'
const pop =
  'absolute left-0 top-[calc(100%+6px)] z-30 flex min-w-[220px] max-h-[300px] overflow-y-auto flex-col gap-2.5 rounded-row border border-border bg-surface p-[14px] shadow-[0_20px_50px_rgba(0,0,0,0.25)]'
const clearBtn =
  'self-start border-0 bg-transparent py-0.5 text-[12px] font-bold text-accent cursor-pointer'

/**
 * Turn a series bucket key into an axis label.
 * Buckets are `YYYY-MM-DD` (daily), `YYYY-Www` (weekly) or `YYYY-MM` (monthly/all).
 */
function bucketLabel(bucket: string): string {
  const weekly = bucket.match(/^(\d{4})-W(\d{2})$/)
  if (weekly) return `W${weekly[2]}`

  const parts = bucket.split('-')
  const month = Number(parts[1])
  if (!month) return bucket
  const name = new Date(2000, month - 1, 1).toLocaleString('en', { month: 'short' })
  return parts.length === 3 ? `${name} ${Number(parts[2])}` : name
}

/** Evenly sample up to `max` axis labels so they never overlap. */
function axisLabels(buckets: string[], max = 6): string[] {
  if (buckets.length <= max) return buckets.map(bucketLabel)
  const step = (buckets.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) =>
    bucketLabel(buckets[Math.round(i * step)]),
  )
}

/** Filters row + cumulative master P&L chart card, live from /admin/performance. */
export default function AdminPerformanceChart() {
  const [period, setPeriod] = useState<Period>('monthly')
  const [showDates, setShowDates] = useState(false)
  const [showTickers, setShowTickers] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const excludeKey = [...excluded].sort().join(',')

  const { data, loading, error } = useApiData(
    () =>
      getAdminPerformance({
        period,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        exclude: excludeKey ? excludeKey.split(',') : undefined,
      }),
    [period, dateFrom, dateTo, excludeKey],
  )

  const toggleTicker = (t: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  const series = data?.series ?? []
  const tickers = data?.tickers ?? []
  const path = linePath(
    series.map((p) => p.cumulative),
    VIEW_W,
    VIEW_H,
    18,
  )
  const labels = axisLabels(series.map((p) => p.bucket))

  const chartKey = `${period}-${dateFrom}-${dateTo}-${excludeKey}`

  return (
    <div
      className="flex min-w-0 grow-[2] basis-[480px] flex-col gap-3"
      data-aos="fade-up"
      data-aos-delay="150"
    >
      <div className="flex gap-2">
        <div className="relative">
          <button
            type="button"
            className={filterBtn}
            onClick={() => {
              setShowDates((v) => !v)
              setShowTickers(false)
            }}
          >
            <CalendarIcon size={14} />
            Date Range
          </button>
          {showDates && (
            <div className={pop}>
              <label className="flex flex-col gap-[5px] text-[12px] font-semibold text-muted">
                From
                <input
                  type="date"
                  className="h-9 rounded-btn border border-border bg-surface2 px-2.5 text-[12.5px] text-text outline-none"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-[5px] text-[12px] font-semibold text-muted">
                To
                <input
                  type="date"
                  className="h-9 rounded-btn border border-border bg-surface2 px-2.5 text-[12.5px] text-text outline-none"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  className={clearBtn}
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            className={filterBtn}
            onClick={() => {
              setShowTickers((v) => !v)
              setShowDates(false)
            }}
          >
            <Filter size={14} />
            Tickers
          </button>
          {showTickers && (
            <div className={pop}>
              {tickers.length === 0 && (
                <span className="text-[12px] text-muted">No traded symbols yet.</span>
              )}
              {tickers.map((t) => (
                <label
                  className="flex cursor-pointer flex-row items-center gap-2 text-[12px] font-semibold text-text"
                  key={t}
                >
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={!excluded.has(t)}
                    onChange={() => toggleTicker(t)}
                  />
                  {displaySymbol(t)}
                </label>
              ))}
              {excluded.size > 0 && (
                <button
                  type="button"
                  className={clearBtn}
                  onClick={() => setExcluded(new Set())}
                >
                  Include All
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-card border border-border bg-surface p-card flex flex-1 flex-col">
        <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Master Cumulative P&L
            </div>
            <div className="text-[12px] text-muted mt-px">
              Platform performance from the master account
            </div>
          </div>
          <div className="flex gap-[3px] bg-surface2 border border-hair rounded-seg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`font-body py-[5px] px-2.5 text-[11.5px] rounded-btn border ${
                  period === p.key
                    ? 'bg-surface border-border text-text font-bold'
                    : 'border-transparent bg-transparent text-muted font-semibold'
                }`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {series.length === 0 ? (
          <div className="grid flex-1 min-h-[240px] place-items-center px-4 text-center text-[13px] text-muted">
            {loading
              ? 'Loading performance…'
              : error
                ? 'Could not load performance data.'
                : 'No closed trades yet for the master account.'}
          </div>
        ) : (
          <div
            key={chartKey}
            className="flex flex-1 flex-col animate-[fadeup_0.35s_ease-out]"
          >
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              className="block h-60 w-full flex-1"
            >
              <defs>
                <linearGradient id="admFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity=".3" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g stroke="var(--hair)" strokeWidth="1">
                <line x1="0" y1="65" x2={VIEW_W} y2="65" />
                <line x1="0" y1="130" x2={VIEW_W} y2="130" />
                <line x1="0" y1="195" x2={VIEW_W} y2="195" />
              </g>
              <path
                d={`${path} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`}
                fill="url(#admFill)"
              />
              <path
                d={path}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1000}
                strokeDasharray="1000"
                strokeDashoffset="1000"
                className="animate-[draw_2.2s_ease_0.2s_forwards]"
              />
            </svg>
            <div className="mt-1.5 flex font-mono text-[10.5px] text-faint">
              {labels.map((label, i) => (
                <span key={`${label}-${i}`} className="flex-1 text-center">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
