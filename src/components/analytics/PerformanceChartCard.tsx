import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { LineChart, MoreVertical } from 'lucide-react'
import {
  fmtMediumDate,
  fmtMoney,
  fmtNum,
  fmtShortDate,
  fmtSignedMoney,
  fmtSignedPct,
} from '../../lib/format'
import PnlBreakdown from '../ui/PnlBreakdown'

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
  /** Before fees. */
  pnl: number
  /** After fees. */
  pnlNet: number
}

/** One day's figures, before and after fees. */
type Entry = [date: string, pnl: number, pnlNet: number]

/** Aggregate ascending entries into period buckets. */
function bucketize(entries: Entry[], period: Period): Bucket[] {
  const buckets: Bucket[] = []
  for (const [date, pnl, pnlNet] of entries) {
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
    if (last && last.key === key) {
      last.pnl += pnl
      last.pnlNet += pnlNet
    } else buckets.push({ key, pnl, pnlNet })
  }
  return buckets
}

/** A hoverable point: where it sits (fractions of the plot box) and what to say. */
interface Mark {
  xFrac: number
  yFrac: number
  label: string
  /** Cumulative level before / after fees (cumulative tab). */
  cum: number
  cumNet: number
  /** The bucket's own P&L before / after fees; null on the seed point. */
  pnl: number | null
  pnlNet: number | null
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
  /** Realized P&L per day keyed by 'YYYY-MM-DD', ascending — before fees… */
  dailyPnl: Record<string, number>
  /** …and after, same keys. */
  dailyPnlNet: Record<string, number>
  /** Capital traded on per day — the period return's denominator. */
  dailyCapital: Record<string, number>
  baseline: number
  /** Set when some of the days carry no fee on record. */
  feesSince: string | null
}

/** "Performance Analytics" — cumulative / daily P&L charts plus a date-range
 *  summary, with a time-period filter menu. Drawn BEFORE exchange fees;
 *  hovering a point reads out the after-fees figure beside it. */
export default function PerformanceChartCard({
  dailyPnl,
  dailyPnlNet,
  dailyCapital,
  baseline,
  feesSince,
}: PerformanceChartCardProps) {
  const [tab, setTab] = useState<Tab>('cumulative')
  const [period, setPeriod] = useState<Period>('Daily')
  const [menuOpen, setMenuOpen] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  const entries = useMemo(
    () =>
      Object.entries(dailyPnl)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, pnl]): Entry => [date, pnl, dailyPnlNet[date] ?? pnl]),
    [dailyPnl, dailyPnlNet],
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
    let seedNet = baseline
    for (let i = 0; i < skipped; i++) {
      seed += all[i].pnl
      seedNet += all[i].pnlNet
    }

    // ----- cumulative series (before fees drawn; after fees carried) -----
    let acc = seed
    let accNet = seedNet
    const series = [seed, ...windowed.map((b) => (acc += b.pnl))]
    const seriesNet = [seedNet, ...windowed.map((b) => (accNet += b.pnlNet))]
    if (series.length === 1) {
      series.push(seed) // flat line when no data
      seriesNet.push(seedNet)
    }
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
    const cumMarks: Mark[] =
      windowed.length === 0
        ? []
        : series.map((v, i) => ({
            xFrac: (i * step) / W,
            yFrac: yCum(v) / H,
            label: i === 0 ? 'Start' : bucketLabel(windowed[i - 1].key, period),
            cum: v,
            cumNet: seriesNet[i],
            pnl: i === 0 ? null : windowed[i - 1].pnl,
            pnlNet: i === 0 ? null : windowed[i - 1].pnlNet,
          }))

    // ----- daily (per-bucket P&L) series -----
    let daily: { x: number; y: number; pos: boolean }[] = []
    let dailyMarks: Mark[] = []
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
      dailyMarks = windowed.map((b, i) => ({
        xFrac: (i * dStep) / W,
        yFrac: yOf(b.pnl) / H,
        label: bucketLabel(b.key, period),
        cum: series[i + 1],
        cumNet: seriesNet[i + 1],
        pnl: b.pnl,
        pnlNet: b.pnlNet,
      }))
    }
    const dailyLine =
      daily.length > 1
        ? `M${daily.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`
        : ''

    return {
      cumulative,
      cumMarks,
      daily,
      dailyMarks,
      dailyLine,
      labels: axisLabels(windowed, period),
    }
  }, [entries, period, baseline])

  /**
   * The window's figures. The percentage is TIME-WEIGHTED: each day's P&L over
   * the capital that day started with, the daily factors chained.
   *
   * It used to be `window P&L / all-time baseline`, which meant a deposit made
   * in September changed the percentage August had already reported — a
   * finished month must not move. Chaining fixes that at the root: a transfer
   * only ever changes the capital of the days after it, and chaining ratios
   * never sees the flows between them. Same method the landing page track
   * record and the Telegram recaps use (on Manila days, where these are UTC).
   *
   * The consequence to keep in mind: this no longer equals
   * `realized / baseline`, so the two figures on this card are a dollar total
   * and a compounded return, not one divided by the other.
   */
  const range = useMemo(() => {
    let inRange = 0
    let inRangeNet = 0
    let upToEnd = 0
    let growth = 1
    let growthNet = 1
    let measured = 0
    let unmeasured = 0
    for (const [date, pnl, pnlNet] of entries) {
      if (date <= toDate) upToEnd += pnl
      if (date < fromDate || date > toDate) continue
      inRange += pnl
      inRangeNet += pnlNet

      const capital = dailyCapital[date]
      if (capital === undefined || capital <= 0) {
        // A day whose capital was never recorded (or had gone non-positive)
        // is left OUT of the chain rather than divided by a guess — and
        // counted, so the card can say the return covers part of the window.
        unmeasured++
        continue
      }
      // Floored at 0: a day losing more than the whole account must not
      // compound into a negative factor and flip every later day's sign.
      growth *= Math.max(0, 1 + pnl / capital)
      growthNet *= Math.max(0, 1 + pnlNet / capital)
      measured++
    }
    return {
      realized: inRange,
      realizedNet: inRangeNet,
      wholeBalance: baseline + upToEnd,
      pct: measured > 0 ? (growth - 1) * 100 : null,
      pctNet: measured > 0 ? (growthNet - 1) * 100 : null,
      measured,
      unmeasured,
    }
  }, [entries, fromDate, toDate, baseline, dailyCapital])

  const marks = tab === 'cumulative' ? view.cumMarks : tab === 'daily' ? view.dailyMarks : []
  const hovered = hoverIdx !== null ? (marks[hoverIdx] ?? null) : null

  /** Snap to the nearest plotted bucket horizontally — the readout only ever
   *  quotes figures that actually happened. */
  const trackPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || marks.length === 0) return
    const ratio = (e.clientX - rect.left) / rect.width
    let best = 0
    let bestGap = Infinity
    for (let i = 0; i < marks.length; i++) {
      const gap = Math.abs(marks[i].xFrac - ratio)
      if (gap < bestGap) {
        bestGap = gap
        best = i
      }
    }
    setHoverIdx(best)
  }

  /** The crosshair + readout shared by the two chart tabs. */
  const readout = hovered && (
    <>
      <span
        className="pointer-events-none absolute inset-y-0 w-px bg-[var(--accent)] opacity-40"
        style={{ left: `${hovered.xFrac * 100}%` }}
      />
      <span
        className="pointer-events-none absolute h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-[0_0_0_4px_var(--glow)]"
        style={{ left: `${hovered.xFrac * 100}%`, top: `${hovered.yFrac * 100}%` }}
      />
      <div
        className="pointer-events-none absolute top-2 z-10 rounded-card border border-border bg-surface2/97 px-3 py-2 backdrop-blur-sm"
        style={{
          left: `${hovered.xFrac * 100}%`,
          transform: `translateX(${
            hovered.xFrac > 0.7 ? 'calc(-100% - 12px)' : hovered.xFrac < 0.3 ? '12px' : '-50%'
          })`,
        }}
      >
        <div className="font-mono text-[10.5px] tracking-[0.4px] text-faint whitespace-nowrap">
          {hovered.label}
        </div>
        {tab === 'cumulative' ? (
          <>
            <div className="font-mono text-[15px] font-extrabold whitespace-nowrap">
              ${fmtNum(hovered.cum)}
              <span className="ml-1.5 text-[10.5px] font-semibold text-faint">before fees</span>
            </div>
            <div className="font-mono text-[11px] text-muted whitespace-nowrap">
              ${fmtNum(hovered.cumNet)} after fees
            </div>
          </>
        ) : (
          <>
            <div
              className={`font-mono text-[15px] font-extrabold whitespace-nowrap ${
                (hovered.pnl ?? 0) < 0 ? 'text-red' : 'text-green'
              }`}
            >
              {fmtSignedMoney(hovered.pnl ?? 0)}
              <span className="ml-1.5 text-[10.5px] font-semibold text-faint">before fees</span>
            </div>
            <div className="font-mono text-[11px] text-muted whitespace-nowrap">
              {fmtSignedMoney(hovered.pnlNet ?? 0)} after fees
            </div>
          </>
        )}
        {hovered.pnl !== null && hovered.pnlNet !== null && tab === 'cumulative' && (
          <div className="mt-1 border-t border-hair pt-1 font-mono text-[10.5px] text-faint whitespace-nowrap">
            {period === 'Daily' ? 'Day' : period === 'Weekly' ? 'Week' : 'Month'}:{' '}
            {fmtSignedMoney(hovered.pnl)} before · {fmtSignedMoney(hovered.pnlNet)} after
          </div>
        )}
      </div>
    </>
  )

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
              Profit and loss tracking · before fees · {period}
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
            onClick={() => {
              setTab(key)
              setHoverIdx(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cumulative' && (
        <div>
          <div
            ref={plotRef}
            className="relative touch-pan-y"
            onPointerMove={trackPointer}
            onPointerLeave={() => setHoverIdx(null)}
          >
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
          {readout}
          </div>
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
          <div
            ref={plotRef}
            className="relative touch-pan-y"
            onPointerMove={trackPointer}
            onPointerLeave={() => setHoverIdx(null)}
          >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
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
          {readout}
          </div>
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
                <PnlBreakdown
                  gross={range.realized}
                  net={range.realizedNet}
                  feesSince={feesSince}
                  heading={`${fmtMediumDate(fromDate)} — ${fmtMediumDate(toDate)}`}
                >
                  {fmtSignedMoney(range.realized)}
                </PnlBreakdown>
              </div>
              <div className="text-[11px] text-muted font-semibold">Before fees</div>
            </div>
            <div className="border border-hair bg-surface2 rounded-rail py-4 px-[18px]">
              <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                Period Return
              </span>
              <div
                className={`font-mono text-[24px] font-extrabold tracking-[-0.6px] mt-1.5 mb-1 ${(range.pct ?? 0) < 0 ? 'text-red' : 'text-accent'}`}
                title={
                  range.pctNet === null
                    ? undefined
                    : `After exchange fees: ${fmtSignedPct(range.pctNet, 2)}`
                }
              >
                {range.pct === null ? '—' : fmtSignedPct(range.pct, 2)}
              </div>
              <div className="text-[11px] text-muted font-semibold">
                Compounded daily · before fees
              </div>
              <div className="text-[11px] text-muted font-semibold">
                {range.unmeasured > 0
                  ? `${range.measured} of ${range.measured + range.unmeasured} trading days measured`
                  : 'Deposits & withdrawals excluded'}
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
