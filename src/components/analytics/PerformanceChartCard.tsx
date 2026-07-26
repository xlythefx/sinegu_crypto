import { useMemo, useState } from 'react'
import { LineChart, MoreVertical } from 'lucide-react'
import {
  fmtMediumDate,
  fmtMoney,
  fmtNum,
  fmtShortDate,
  fmtSignedMoney,
  fmtSignedPct,
} from '../../lib/format'

type Tab = 'cumulative' | 'daily' | 'range'
type Period = 'Daily' | 'Weekly' | 'Monthly' | 'All Time'

const PERIODS: Period[] = ['Daily', 'Weekly', 'Monthly', 'All Time']

/** How many trailing buckets each period keeps ('All Time' keeps everything). */
const PERIOD_LIMIT: Record<Period, number> = {
  Daily: 30,
  Weekly: 26,
  Monthly: Infinity,
  'All Time': Infinity,
}

const W = 600
const H = 240
const PAD_TOP = 26
const PAD_BOTTOM = 16

interface Bucket {
  key: string
  pnl: number
}

/** Aggregate ascending [date, pnl] entries into period buckets. */
function bucketize(entries: [string, number][], period: Period): Bucket[] {
  const buckets: Bucket[] = []
  for (const [date, pnl] of entries) {
    let key = date
    if (period === 'Monthly') {
      key = date.slice(0, 7)
    } else if (period === 'Weekly') {
      // Week starts Monday
      const d = new Date(`${date}T00:00:00`)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const last = buckets[buckets.length - 1]
    if (last && last.key === key) last.pnl += pnl
    else buckets.push({ key, pnl })
  }
  return buckets
}

function bucketLabel(key: string, period: Period): string {
  if (period === 'Monthly') {
    return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
    })
  }
  return fmtShortDate(key)
}

/** Evenly sample up to `count` axis labels from the buckets. */
function axisLabels(buckets: Bucket[], period: Period, count = 6): string[] {
  const n = Math.min(count, buckets.length)
  const labels: string[] = []
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (buckets.length - 1)) / Math.max(1, n - 1))
    labels.push(bucketLabel(buckets[idx].key, period))
  }
  return labels
}

interface PerformanceChartCardProps {
  /** Realized P&L per day keyed by 'YYYY-MM-DD', ascending. */
  dailyPnl: Record<string, number>
  baseline: number
}

/** "Performance Analytics" — cumulative / daily P&L charts plus a date-range
 *  summary, with a time-period filter menu. */
export default function PerformanceChartCard({
  dailyPnl,
  baseline,
}: PerformanceChartCardProps) {
  const [tab, setTab] = useState<Tab>('cumulative')
  const [period, setPeriod] = useState<Period>('Daily')
  const [menuOpen, setMenuOpen] = useState(false)

  const entries = useMemo(
    () =>
      Object.entries(dailyPnl).sort(([a], [b]) => a.localeCompare(b)) as [
        string,
        number,
      ][],
    [dailyPnl],
  )

  const [fromDate, setFromDate] = useState(() => {
    const last = entries[entries.length - 1]?.[0] ?? todayIso()
    const d = new Date(`${last}T00:00:00`)
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(
    () => entries[entries.length - 1]?.[0] ?? todayIso(),
  )

  const view = useMemo(() => {
    const all = bucketize(entries, period)
    const windowed = all.slice(
      Math.max(0, all.length - PERIOD_LIMIT[period]),
    )
    // Seed the cumulative curve so windowed views stay continuous
    const skipped = all.length - windowed.length
    let seed = baseline
    for (let i = 0; i < skipped; i++) seed += all[i].pnl

    // ----- cumulative series -----
    let acc = seed
    const series = [seed, ...windowed.map((b) => (acc += b.pnl))]
    if (series.length === 1) series.push(seed) // flat line when no data
    let min = Math.min(...series)
    let max = Math.max(...series)
    if (min === max) {
      min -= 1
      max += 1
    }
    const yCum = (v: number) =>
      H - PAD_BOTTOM - ((v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM)
    const step = W / Math.max(1, series.length - 1)
    const points = series.map(
      (v, i) => `${(i * step).toFixed(1)},${yCum(v).toFixed(1)}`,
    )
    const cumulative = {
      line: `M${points.join(' L')}`,
      area: `M${points.join(' L')} L${W},${H} L0,${H} Z`,
      baselineY: baseline >= min && baseline <= max ? yCum(baseline) : null,
    }

    // ----- daily (per-bucket P&L) series -----
    let daily: { x: number; y: number; pos: boolean }[] = []
    if (windowed.length > 0) {
      const values = windowed.map((b) => b.pnl)
      let dMin = Math.min(...values)
      let dMax = Math.max(...values)
      if (dMin === dMax) {
        dMin -= 1
        dMax += 1
      }
      const yOf = (v: number) =>
        H -
        PAD_BOTTOM -
        ((v - dMin) / (dMax - dMin)) * (H - PAD_TOP - PAD_BOTTOM)
      const dStep = W / Math.max(1, windowed.length - 1)
      daily = windowed.map((b, i) => ({
        x: i * dStep,
        y: yOf(b.pnl),
        pos: b.pnl >= 0,
      }))
    }
    const dailyLine =
      daily.length > 1
        ? `M${daily.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`
        : ''

    return { cumulative, daily, dailyLine, labels: axisLabels(windowed, period) }
  }, [entries, period, baseline])

  const range = useMemo(() => {
    let inRange = 0
    let upToEnd = 0
    for (const [date, pnl] of entries) {
      if (date <= toDate) upToEnd += pnl
      if (date >= fromDate && date <= toDate) inRange += pnl
    }
    return {
      realized: inRange,
      wholeBalance: baseline + upToEnd,
      pct: baseline > 0 ? (inRange / baseline) * 100 : null,
    }
  }, [entries, fromDate, toDate, baseline])

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
      data-aos-delay="250"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <LineChart size={16} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Performance Analytics
            </div>
            <div className="text-[12px] text-muted mt-px">
              Profit and loss tracking · {period}
            </div>
          </div>
        </div>
        <div className="relative flex-none">
          <button
            type="button"
            className="w-8 h-8 rounded-[9px] border border-border bg-surface text-muted flex items-center justify-center cursor-pointer hover:text-text"
            aria-label="Time period filter"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-[140px] bg-surface border border-border rounded-row p-[5px] z-30 shadow-[0_12px_32px_rgba(0,0,0,0.25)] flex flex-col gap-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`text-left border-none bg-transparent text-[12.5px] py-2 px-2.5 rounded-btn cursor-pointer font-body ${period === p ? 'bg-accent-soft text-accent font-bold' : 'text-muted font-semibold hover:bg-surface2 hover:text-text'}`}
                  onClick={() => {
                    setPeriod(p)
                    setMenuOpen(false)
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-stack self-start inline-flex gap-[3px] bg-surface2 border border-hair rounded-seg p-1">
        {(
          [
            ['cumulative', 'Cumulative P&L'],
            ['daily', 'Daily P&L'],
            ['range', 'Date Range'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`font-body py-[7px] px-[13px] text-[12.5px] rounded-btn border ${tab === key ? 'bg-surface border-border text-text font-bold' : 'border-transparent bg-transparent text-muted font-semibold'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cumulative' && (
        <div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-[240px] block max-[640px]:h-[200px]"
          >
            <defs>
              <linearGradient id="pchartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".3" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g stroke="var(--hair)" strokeWidth="1">
              <line x1="0" y1="60" x2={W} y2="60" />
              <line x1="0" y1="120" x2={W} y2="120" />
              <line x1="0" y1="180" x2={W} y2="180" />
            </g>
            <path d={view.cumulative.area} fill="url(#pchartFill)" />
            <path
              d={view.cumulative.line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {view.cumulative.baselineY !== null && (
              <line
                x1="0"
                y1={view.cumulative.baselineY}
                x2={W}
                y2={view.cumulative.baselineY}
                stroke="var(--muted)"
                strokeWidth="1.2"
                strokeDasharray="5 4"
              />
            )}
          </svg>
          <div className="font-mono text-[10px] text-faint tracking-[0.4px] mt-1.5">
            Deposit amount · ${fmtNum(baseline)}
          </div>
          <div className="font-mono flex text-[10.5px] text-faint mt-1.5 [&>span]:flex-1 [&>span]:text-center">
            {view.labels.map((m, i) => (
              <span key={`${m}-${i}`}>{m}</span>
            ))}
          </div>
        </div>
      )}

      {tab === 'daily' && (
        <div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-[240px] block max-[640px]:h-[200px]"
          >
            <g stroke="var(--hair)" strokeWidth="1">
              <line x1="0" y1="60" x2={W} y2="60" />
              <line x1="0" y1="120" x2={W} y2="120" />
              <line x1="0" y1="180" x2={W} y2="180" />
            </g>
            {view.dailyLine && (
              <path
                d={view.dailyLine}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity=".85"
              />
            )}
            {view.daily.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="3"
                fill={p.pos ? 'var(--green)' : 'var(--red)'}
                stroke="var(--surface)"
                strokeWidth="1.4"
              />
            ))}
          </svg>
          <div className="flex gap-stack mt-2 text-[11px] font-semibold text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5">
            <span>
              <i className="w-2 h-2 rounded-full inline-block bg-green" /> Winning
              day
            </span>
            <span>
              <i className="w-2 h-2 rounded-full inline-block bg-red" /> Losing day
            </span>
          </div>
          <div className="font-mono flex text-[10.5px] text-faint mt-1.5 [&>span]:flex-1 [&>span]:text-center">
            {view.labels.map((m, i) => (
              <span key={`${m}-${i}`}>{m}</span>
            ))}
          </div>
        </div>
      )}

      {tab === 'range' && (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                From date
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-[42px] border border-border rounded-nav bg-surface2 text-text px-3 font-mono text-[13px] [color-scheme:dark] [[data-theme=light]_&]:[color-scheme:light]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                To date
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-[42px] border border-border rounded-nav bg-surface2 text-text px-3 font-mono text-[13px] [color-scheme:dark] [[data-theme=light]_&]:[color-scheme:light]"
              />
            </label>
          </div>

          <div className="border border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))] rounded-rail py-[18px] px-5">
            <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
              Whole Balance
            </span>
            <div className="font-mono text-[30px] font-extrabold tracking-[-0.6px] mt-1.5 mb-1">
              {fmtMoney(range.wholeBalance)}
            </div>
            <div className="text-[11px] text-muted font-semibold">
              Baseline + realized P&L
            </div>
            <div className="text-[11px] text-muted font-semibold">
              {fmtMediumDate(fromDate)} — {fmtMediumDate(toDate)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
            <div className="border border-[rgba(47,214,122,0.3)] bg-[rgba(47,214,122,0.06)] rounded-rail py-4 px-[18px]">
              <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                Total Realized Gains
              </span>
              <div
                className={`font-mono text-[24px] font-extrabold tracking-[-0.6px] mt-1.5 mb-1 ${range.realized < 0 ? 'text-red' : 'text-green'}`}
              >
                {fmtSignedMoney(range.realized)}
              </div>
            </div>
            <div className="border border-hair bg-surface2 rounded-rail py-4 px-[18px]">
              <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                Relative to Baseline
              </span>
              <div
                className={`font-mono text-[24px] font-extrabold tracking-[-0.6px] mt-1.5 mb-1 ${(range.pct ?? 0) < 0 ? 'text-red' : 'text-accent'}`}
              >
                {range.pct === null ? '—' : fmtSignedPct(range.pct, 2)}
              </div>
              <div className="text-[11px] text-muted font-semibold">
                Baseline: {fmtMoney(baseline)}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
