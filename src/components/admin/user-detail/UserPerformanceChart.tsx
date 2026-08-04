import { useMemo, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import SignedBars from '../strategy-detail/SignedBars'
import { linePath } from '../../../lib/chart'
import { fmtMoney } from '../../../lib/format'
import type { DailyPnlMap } from '../../../types/admin'

type Period = 'daily' | 'weekly' | 'monthly' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'all', label: 'All' },
]

/** How many trailing buckets each period shows ('all' shows everything). */
const WINDOW: Record<Period, number | null> = {
  daily: 30,
  weekly: 26,
  monthly: 12,
  all: null,
}

const VIEW_W = 900
const VIEW_H = 260
const PAD = 18

/** `YYYY-MM-DD` → ISO week key `YYYY-Www`. */
function isoWeekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  // Shift to the Thursday of this ISO week
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3,
  )
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Bucket key → short axis label (`Jul 4`, `W29`, `Jul`). */
function bucketLabel(key: string): string {
  const weekly = key.match(/^\d{4}-W(\d{2})$/)
  if (weekly) return `W${weekly[1]}`
  const parts = key.split('-')
  const month = Number(parts[1])
  if (!month) return key
  const name = new Date(2000, month - 1, 1).toLocaleString('en', {
    month: 'short',
  })
  return parts.length === 3 ? `${name} ${Number(parts[2])}` : name
}

/** Evenly sample up to `max` axis labels so they never overlap. */
function axisLabels(keys: string[], max = 6): string[] {
  if (keys.length <= max) return keys.map(bucketLabel)
  const step = (keys.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) =>
    bucketLabel(keys[Math.round(i * step)]),
  )
}

interface UserPerformanceChartProps {
  /** The user's daily P&L map (same shape the calendar consumes). */
  days: DailyPnlMap
  /** Reference level for the dashed line — the user's initial deposit. */
  initialDeposit: number
}

/**
 * Cumulative equity area (initial deposit + running P&L) with a dashed
 * initial-deposit reference line, plus signed per-bucket P&L bars below.
 * Pure-props — the page owns the daily-pnl fetch.
 */
export default function UserPerformanceChart({
  days,
  initialDeposit,
}: UserPerformanceChartProps) {
  const [period, setPeriod] = useState<Period>('monthly')

  const { series, startValue } = useMemo(() => {
    const entries = Object.entries(days)
      .map(([date, d]) => ({ date, pnl: d.total }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const keyOf = (date: string) =>
      period === 'daily'
        ? date
        : period === 'weekly'
          ? isoWeekKey(date)
          : date.slice(0, 7)

    const buckets: { key: string; pnl: number }[] = []
    for (const e of entries) {
      const k = keyOf(e.date)
      const last = buckets[buckets.length - 1]
      if (last && last.key === k) last.pnl += e.pnl
      else buckets.push({ key: k, pnl: e.pnl })
    }

    const window = WINDOW[period]
    const visible = window ? buckets.slice(-window) : buckets
    // Cumulative stays truthful when the window hides earlier buckets
    const before = buckets
      .slice(0, buckets.length - visible.length)
      .reduce((sum, b) => sum + b.pnl, 0)

    let cum = initialDeposit + before
    const series = visible.map((b) => {
      cum += b.pnl
      return { ...b, cumulative: cum }
    })
    return { series, startValue: initialDeposit + before }
  }, [days, initialDeposit, period])

  const values = [startValue, ...series.map((p) => p.cumulative)]
  let yMin = Math.min(...values, initialDeposit)
  let yMax = Math.max(...values, initialDeposit)
  if (yMin === yMax) {
    yMin -= 1
    yMax += 1
  }
  const path = linePath(values, VIEW_W, VIEW_H, PAD, yMin, yMax)
  const depositY =
    VIEW_H -
    PAD -
    ((initialDeposit - yMin) / (yMax - yMin)) * (VIEW_H - PAD * 2)
  const labels = axisLabels(series.map((p) => p.key))
  const bars = series
    .slice(-12)
    .map((b) => ({ label: bucketLabel(b.key), pnl: b.pnl }))

  return (
    <section className="rounded-card border border-border bg-surface p-card">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <TrendingUp size={16} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Cumulative Performance
            </div>
            <div className="mt-px text-[12px] text-muted">
              Equity vs the dashed initial deposit ({fmtMoney(initialDeposit)})
            </div>
          </div>
        </div>
        <div className="flex gap-[3px] rounded-seg border border-hair bg-surface2 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`font-body rounded-btn border py-[5px] px-2.5 text-[11.5px] ${
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
        <div className="grid min-h-[240px] place-items-center px-4 text-center text-[13px] text-muted">
          No closed trades yet for this user.
        </div>
      ) : (
        <div key={period} className="animate-[fadeup_0.35s_ease-out]">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="block h-60 w-full"
          >
            <defs>
              {/* unique id — must not clash with the dashboard's admFill */}
              <linearGradient id="audFill" x1="0" y1="0" x2="0" y2="1">
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
              fill="url(#audFill)"
            />
            {/* dashed initial-deposit reference line */}
            <line
              x1="0"
              y1={depositY}
              x2={VIEW_W}
              y2={depositY}
              stroke="var(--muted)"
              strokeWidth="1.2"
              strokeDasharray="6 5"
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

          <div className="mt-4 border-t border-hair pt-3.5">
            <div className="mb-1 text-[12px] font-bold text-muted">
              {period === 'daily'
                ? 'Daily'
                : period === 'weekly'
                  ? 'Weekly'
                  : 'Monthly'}{' '}
              P&L
              <span className="ml-1.5 font-normal text-faint">
                last {bars.length} bucket{bars.length === 1 ? '' : 's'}
              </span>
            </div>
            <SignedBars data={bars} />
          </div>
        </div>
      )}
    </section>
  )
}
