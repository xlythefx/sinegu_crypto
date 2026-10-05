import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { ArrowLeftRight, ChevronRight, LineChart, MoreVertical, X } from 'lucide-react'
import {
  fmtMediumDate,
  fmtMoney,
  fmtNum,
  fmtShortDate,
  fmtSignedMoney,
  fmtSignedPct,
} from '../../lib/format'
import PnlBreakdown from '../ui/PnlBreakdown'
import RangePresetMenu from './RangePresetMenu'
import TransferSegmentsModal from './TransferSegmentsModal'
import PeriodReturnModal from './PeriodReturnModal'
import Sheen, { Shimmer } from '../ui/Sheen'
import { useTween } from '../../hooks/useTween'
import {
  quickPresets,
  transferSegments,
  type RangePreset,
} from '../../lib/rangePresets'
import { periodReturn } from '../../lib/periodReturn'
import type { DailyReturn } from '../../types/analytics'

type Tab = 'cumulative' | 'daily' | 'capital' | 'range'
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
  /** Capital tab only: the day's net transfer and the running total after it. */
  delta?: number
  total?: number
}

/** One bar per transfer day, built from the transfer days alone. */
interface CapitalView {
  bars: { x: number; w: number; y: number; h: number; deposit: boolean }[]
  zeroY: number
  marks: Mark[]
  labels: string[]
  deposits: number
  withdrawals: number
  net: number
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
  /** Net transfer per day, signed; only days that moved money. */
  dailyFlows: Record<string, number>
  /** Balance each walked day closed on; absent on an older API. */
  dailyBalance?: Record<string, number>
  /** Estimated fees on pre-cutoff trades, per day — already inside
   *  `dailyBalance`; absent on an older API. */
  dailyUnrecordedFees?: Record<string, number>
  /** Capital held before any recorded transfer; absent on an older API. */
  initialDeposit?: number
  /** The SAVED per-day % (the calendar's figure) the Period Return adds up;
   *  absent on an older API, which then falls back to the same formula. */
  dailyReturns?: Record<string, DailyReturn>
  /** A ticker/strategy chip is active — saved days hold every trade, so the
   *  filtered trades are measured instead. */
  filtered?: boolean
  /** The payload is being refetched (a filter change) — tiles shimmer. */
  refreshing?: boolean
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
  dailyFlows,
  dailyBalance,
  dailyUnrecordedFees,
  initialDeposit,
  dailyReturns,
  filtered = false,
  refreshing = false,
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

  // The range the tab opens on (the 30 days up to the last trade), kept so
  // the clear button returns to exactly it.
  const [defaultRange] = useState(() => {
    const last = entries[entries.length - 1]?.[0] ?? todayIso()
    const d = new Date(`${last}T00:00:00`)
    d.setDate(d.getDate() - 30)
    return { from: d.toISOString().slice(0, 10), to: last }
  })
  const [fromDate, setFromDate] = useState(defaultRange.from)
  const [toDate, setToDate] = useState(defaultRange.to)

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

    // ----- daily (per-bucket P&L) BARS, zero at the centre -----
    // The scale is symmetric (±the largest absolute move) rather than
    // min..max, so the zero line sits exactly halfway and a bar's direction
    // is readable on its own: up is a green profit, down is a red loss. A
    // min..max scale would put zero wherever the data happened to land and
    // draw an all-winning month as if half of it had lost.
    let bars: { x: number; w: number; y: number; h: number; pos: boolean }[] = []
    let dailyMarks: Mark[] = []
    const top = PAD_TOP
    const bottom = H - PAD_BOTTOM
    const zeroY = (top + bottom) / 2
    if (windowed.length > 0) {
      const bound = Math.max(1e-9, ...windowed.map((b) => Math.abs(b.pnl)))
      const half = (bottom - top) / 2
      const yOf = (v: number) => zeroY - (v / bound) * half
      const slot = W / windowed.length
      const barW = Math.max(2, Math.min(16, slot * 0.6))
      bars = windowed.map((b, i) => {
        const y = yOf(b.pnl)
        return {
          x: i * slot + (slot - barW) / 2,
          w: barW,
          y: Math.min(y, zeroY),
          // 1px floor so a flat day is still a visible tick on the axis
          // rather than a gap that reads as a day with no trades.
          h: Math.max(1, Math.abs(zeroY - y)),
          pos: b.pnl >= 0,
        }
      })
      dailyMarks = windowed.map((b, i) => ({
        xFrac: (i * slot + slot / 2) / W,
        yFrac: yOf(b.pnl) / H,
        label: bucketLabel(b.key, period),
        cum: series[i + 1],
        cumNet: seriesNet[i + 1],
        pnl: b.pnl,
        pnlNet: b.pnlNet,
      }))
    }

    return {
      cumulative,
      cumMarks,
      bars,
      zeroY,
      dailyMarks,
      labels: axisLabels(windowed, period),
    }
  }, [entries, period, baseline])

  /**
   * Money in and out: one BAR per transfer day, deposits up in green,
   * withdrawals down in red, each as tall as the amount that moved that day.
   * The running total is in the hover readout and the net in the legend.
   *
   * Its own chart rather than a series on the P&L views, and that is the
   * point: the equity curves answer "what did trading do", so a withdrawal
   * must never be able to draw itself as a crash on them. Here a withdrawal
   * IS the subject, and reads as exactly what it was.
   *
   * One slot per transfer day (like the Daily P&L bars), not real time:
   * transfers cluster, and on a time axis two a day apart would draw as one.
   * The zero line sits where the data puts it (largest deposit above, largest
   * withdrawal below), so an account that only ever deposited uses the whole
   * height instead of leaving the lower half empty.
   */
  const capital: CapitalView = useMemo(() => {
    const flows = Object.entries(dailyFlows)
      .filter(([, amount]) => amount !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
    const empty: CapitalView = {
      bars: [], zeroY: 0, marks: [], labels: [],
      deposits: 0, withdrawals: 0, net: 0,
    }
    if (flows.length === 0) return empty

    let running = 0
    const totals = flows.map(([date, amount]) => {
      running += amount
      return { date, amount, total: running }
    })
    const up = Math.max(0, ...flows.map(([, a]) => a))
    const down = Math.max(0, ...flows.map(([, a]) => -a))
    const top = PAD_TOP
    const bottom = H - PAD_BOTTOM
    const scale = (bottom - top) / Math.max(1e-9, up + down)
    const zeroY = top + up * scale
    const yOf = (v: number) => zeroY - v * scale
    const slot = W / flows.length
    const barW = Math.max(2, Math.min(28, slot * 0.6))

    return {
      bars: totals.map((t, i) => {
        const y = yOf(t.amount)
        return {
          x: i * slot + (slot - barW) / 2,
          w: barW,
          y: Math.min(y, zeroY),
          h: Math.max(1, Math.abs(zeroY - y)),
          deposit: t.amount > 0,
        }
      }),
      zeroY,
      marks: totals.map((t, i) => ({
        xFrac: (i * slot + slot / 2) / W,
        yFrac: yOf(t.amount) / H,
        label: fmtMediumDate(t.date),
        cum: t.total,
        cumNet: t.total,
        pnl: null,
        pnlNet: null,
        delta: t.amount,
        total: t.total,
      })),
      labels: axisLabels(
        flows.map(([key, a]) => ({ key, pnl: a, pnlNet: a })),
        'Daily',
      ),
      deposits: flows.reduce((sum, [, a]) => sum + (a > 0 ? a : 0), 0),
      withdrawals: flows.reduce((sum, [, a]) => sum + (a < 0 ? -a : 0), 0),
      net: running,
    }
  }, [dailyFlows])

  /**
   * The window's figures. The percentage is the saved daily percentages
   * ADDED (owner's team, 2026-10-05): each day's P&L over the balance that
   * day started with — the P&L calendar's own cell — summed, so a +1% day and
   * a +4% day read +5%. `lib/periodReturn.ts` also compounds the same days
   * for the breakdown modal.
   *
   * Either way a transfer only changes the capital of the days after it, so a
   * September deposit can never move August's figure. The consequence to keep
   * in mind: this does not equal `realized / baseline`, so the two figures on
   * this card are a dollar total and a return, not one divided by the other.
   */
  const range = useMemo(() => {
    let inRange = 0
    let inRangeNet = 0
    let upToEnd = 0
    for (const [date, pnl, pnlNet] of entries) {
      if (date <= toDate) upToEnd += pnl
      if (date < fromDate || date > toDate) continue
      inRange += pnl
      inRangeNet += pnlNet
    }
    const period = periodReturn(
      entries,
      fromDate,
      toDate,
      dailyReturns,
      dailyCapital,
      filtered,
    )
    // Transfers that landed inside the window, and every one after it.
    let flowsInRange = 0
    let flowsAfter = 0
    for (const [date, amount] of Object.entries(dailyFlows)) {
      if (date > toDate) flowsAfter += amount
      else if (date >= fromDate) flowsInRange += amount
    }
    // Estimated commission on trades closed before fees were recorded. Those
    // trades keep their fee-free P&L, but the balance walk has the fee taken
    // off (it is what the exchange charged) — so it gets its own line, or the
    // "trading" figure silently carries it and disagrees with the realized
    // P&L beside it (−984 against −157 for August on the master).
    let unrecordedFees = 0
    for (const [date, fee] of Object.entries(dailyUnrecordedFees ?? {})) {
      if (date >= fromDate && date <= toDate) unrecordedFees += fee
    }

    // The balance on a day = the capital walk as that day closed: seed +
    // transfers up to it + P&L up to it. Nothing after the day may count —
    // this card used to print the all-time net flow + P&L to date, so a
    // range ending in August carried September's deposits and withdrawals.
    const balanceOn = (date: string): number | null => {
      if (!dailyBalance) return null
      let last: number | null = null
      for (const [day, value] of Object.entries(dailyBalance)) {
        if (day <= date) last = value
      }
      return last ?? initialDeposit ?? 0
    }
    const endBalance = balanceOn(toDate)
    const startBalance = balanceOn(dayBefore(fromDate))

    return {
      realized: inRange,
      realizedNet: inRangeNet,
      // Older API (no daily_balance): at least take the later transfers back
      // out. It still lacks initial_deposit, which only the API knows.
      endBalance: endBalance ?? baseline - flowsAfter + upToEnd,
      startBalance,
      flowsInRange,
      unrecordedFees,
      period,
    }
  }, [
    entries,
    fromDate,
    toDate,
    baseline,
    dailyCapital,
    dailyReturns,
    filtered,
    dailyFlows,
    dailyBalance,
    dailyUnrecordedFees,
    initialDeposit,
  ])

  // Display-only glides: a new range makes each figure travel to its value.
  const endBalanceShown = useTween(range.endBalance)
  const realizedShown = useTween(range.realizedNet)
  const returnShown = useTween(range.period.added ?? 0)
  const [returnOpen, setReturnOpen] = useState(false)
  // Re-keys the tiles' light sweep, so it replays on every range change.
  const sheenKey = `${fromDate}|${toDate}|${filtered ? 1 : 0}`

  const firstTradeDay = entries[0]?.[0] ?? null
  const presets = useMemo(() => {
    const today = todayIso()
    const firstFlow = Object.keys(dailyFlows).sort()[0] ?? null
    const firstDay =
      firstTradeDay && firstFlow
        ? firstTradeDay < firstFlow
          ? firstTradeDay
          : firstFlow
        : (firstTradeDay ?? firstFlow)
    return {
      quick: quickPresets(firstDay, today),
      segments: transferSegments(
        dailyFlows,
        firstTradeDay,
        today,
        fmtShortDate,
        fmtSignedMoney,
      ),
    }
  }, [dailyFlows, firstTradeDay])

  const applyPreset = (p: RangePreset) => {
    setFromDate(p.from)
    setToDate(p.to)
  }
  const isActive = (p: RangePreset) => p.from === fromDate && p.to === toDate
  const activeSegment = presets.segments.find(isActive)
  const [segmentsOpen, setSegmentsOpen] = useState(false)

  const marks =
    tab === 'cumulative'
      ? view.cumMarks
      : tab === 'daily'
        ? view.dailyMarks
        : tab === 'capital'
          ? capital.marks
          : []
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
        {tab === 'capital' ? (
          <>
            <div
              className={`font-mono text-[15px] font-extrabold whitespace-nowrap ${
                (hovered.delta ?? 0) < 0 ? 'text-red' : 'text-green'
              }`}
            >
              {fmtSignedMoney(hovered.delta ?? 0)}
              <span className="ml-1.5 text-[10.5px] font-semibold text-faint">
                {(hovered.delta ?? 0) < 0 ? 'withdrawn' : 'deposited'}
              </span>
            </div>
            <div className="font-mono text-[11px] text-muted whitespace-nowrap">
              ${fmtNum(hovered.total ?? 0)} in the account after it
            </div>
          </>
        ) : tab === 'cumulative' ? (
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
        {tab !== 'range' && (
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
        )}
      </div>

      <div className="mb-stack flex flex-wrap items-center justify-between gap-2.5">
      {/* Four tabs do not fit a phone in one row (Date Range was clipped off
          the edge) — there they sit as a 2×2 grid. */}
      <div className="self-start inline-flex gap-[3px] bg-surface2 border border-hair rounded-seg p-1 max-[640px]:grid max-[640px]:w-full max-[640px]:grid-cols-2">
        {(
          [
            ['cumulative', 'Cumulative P&L'],
            ['daily', 'Daily P&L'],
            ['capital', 'Deposits & Withdrawals'],
            ['range', 'Date Range'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`font-body py-[7px] px-[13px] text-[12.5px] rounded-btn border whitespace-nowrap transition-colors ${tab === key ? 'bg-surface border-border text-text font-bold' : 'border-transparent bg-transparent text-muted font-semibold'}`}
            onClick={() => {
              setTab(key)
              setHoverIdx(null)
            }}
          >
            {key === 'capital' ? (
              <>
                <span className="max-[640px]:hidden">{label}</span>
                <span className="hidden max-[640px]:inline">Transfers</span>
              </>
            ) : (
              label
            )}
          </button>
        ))}
      </div>
        {/* Range shortcuts live on the tab row, not above the dates, so the
            Date Range view stays two inputs and three figures. */}
        {tab === 'range' && (
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {presets.segments.length > 0 && (
              <button
                type="button"
                onClick={() => setSegmentsOpen(true)}
                className={`inline-flex h-[34px] items-center gap-1.5 rounded-btn border px-3 text-[12.5px] font-bold font-body cursor-pointer transition-colors ${
                  activeSegment
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-border bg-surface2 text-muted hover:text-text hover:border-accent-line'
                }`}
              >
                <ArrowLeftRight size={14} />
                {activeSegment ? activeSegment.label : 'Between transfers'}
              </button>
            )}
            <RangePresetMenu
              presets={presets.quick}
              activeId={presets.quick.find(isActive)?.id ?? null}
              onPick={applyPreset}
            />
            {(fromDate !== defaultRange.from || toDate !== defaultRange.to) && (
              <button
                type="button"
                aria-label="Clear the date range"
                title="Back to the last 30 days"
                onClick={() => {
                  setFromDate(defaultRange.from)
                  setToDate(defaultRange.to)
                }}
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-btn border border-border bg-surface2 text-muted cursor-pointer transition-colors hover:text-text hover:border-accent-line"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      <TransferSegmentsModal
        open={segmentsOpen}
        segments={presets.segments}
        activeId={activeSegment?.id ?? null}
        onPick={(p) => {
          applyPreset(p)
          setSegmentsOpen(false)
        }}
        onClose={() => setSegmentsOpen(false)}
      />

      {tab === 'cumulative' && (
        <div className="animate-[fadeup_0.35s_ease-out]">
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
        <div className="animate-[fadeup_0.35s_ease-out]">
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
            {view.bars.map((b, i) => (
              <rect
                key={i}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={Math.min(2, b.w / 2)}
                fill={b.pos ? 'var(--green)' : 'var(--red)'}
                opacity=".9"
              />
            ))}
            {/* Drawn last so it reads on top of the bars that cross it. */}
            <line
              x1="0"
              y1={view.zeroY}
              x2={W}
              y2={view.zeroY}
              stroke="var(--muted)"
              strokeWidth="1.2"
            />
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

      {tab === 'capital' && (
        <div className="animate-[fadeup_0.35s_ease-out]">
          {capital.bars.length === 0 ? (
            <p className="text-[13px] text-muted py-10 text-center">
              No deposits or withdrawals on record for the accounts in scope.
            </p>
          ) : (
            <>
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
                  {capital.bars.map((b, i) => (
                    <rect
                      key={i}
                      x={b.x}
                      y={b.y}
                      width={b.w}
                      height={b.h}
                      rx={Math.min(2, b.w / 2)}
                      fill={b.deposit ? 'var(--green)' : 'var(--red)'}
                      opacity=".9"
                    />
                  ))}
                  <line
                    x1="0"
                    y1={capital.zeroY}
                    x2={W}
                    y2={capital.zeroY}
                    stroke="var(--muted)"
                    strokeWidth="1.2"
                  />
                </svg>
                {readout}
              </div>
              <div className="flex gap-stack mt-2 text-[11px] font-semibold text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5 flex-wrap">
                <span>
                  <i className="w-2 h-2 rounded-full inline-block bg-green" /> Deposit ·{' '}
                  {fmtMoney(capital.deposits)}
                </span>
                <span>
                  <i className="w-2 h-2 rounded-full inline-block bg-red" /> Withdrawal ·{' '}
                  {fmtMoney(capital.withdrawals)}
                </span>
                <span className="ml-auto font-mono text-text">
                  Net {fmtSignedMoney(capital.net)}
                </span>
              </div>
              <div className="font-mono flex text-[10.5px] text-faint mt-1.5 [&>span]:flex-1 [&>span]:text-center">
                {capital.labels.map((m, i) => (
                  <span key={`${m}-${i}`}>{m}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'range' && (
        <div className="flex flex-col gap-3.5 animate-[fadeup_0.35s_ease-out]">
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

          <div className="relative overflow-hidden border border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))] rounded-rail py-[18px] px-5 animate-[fadeup_0.4s_ease-out_both]">
            <Sheen key={sheenKey} />
            {refreshing && <Shimmer />}
            <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
              Balance on {fmtMediumDate(toDate)}
            </span>
            <div className="font-mono text-[30px] font-extrabold tracking-[-0.6px] mt-1.5 tabular-nums">
              {fmtMoney(endBalanceShown)}
            </div>
            {/* The balance reconciled: where the range started and the money
                moved in or out inside it. What trading did is the Total
                Realized Gains tile below (after fees) — printing it here too
                was a second, differently-labelled copy of the same figure.
                Only with the API's balance walk — without it the start is
                unknown. */}
            {range.startBalance !== null && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[12px] text-muted">
                <span>
                  Start {fmtMoney(range.startBalance)}
                </span>
                <span>
                  Transfers{' '}
                  <span
                    className={
                      range.flowsInRange > 0
                        ? 'text-green'
                        : range.flowsInRange < 0
                          ? 'text-red'
                          : ''
                    }
                  >
                    {fmtSignedMoney(range.flowsInRange)}
                  </span>
                </span>
                {range.unrecordedFees >= 0.005 && (
                  <span title="Trades closed before exchange fees were recorded keep their fee-free P&L. The exchange still charged a fee on them, so an estimate is taken off the balance here.">
                    Est. fees{feesSince ? ` before ${fmtShortDate(feesSince)}` : ''}{' '}
                    <span className="text-red">
                      {fmtSignedMoney(-range.unrecordedFees)}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
            <div
              className={`relative overflow-hidden rounded-rail py-4 px-[18px] border animate-[fadeup_0.4s_ease-out_0.08s_both] ${
                range.realizedNet < 0
                  ? 'border-[rgba(240,80,80,0.3)] bg-[rgba(240,80,80,0.06)]'
                  : 'border-[rgba(47,214,122,0.3)] bg-[rgba(47,214,122,0.06)]'
              }`}
            >
              <Sheen key={sheenKey} delay={120} />
              {refreshing && <Shimmer />}
              <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                Total Realized Gains
              </span>
              <div
                className={`font-mono text-[24px] font-extrabold tracking-[-0.6px] mt-1.5 tabular-nums ${range.realizedNet < 0 ? 'text-red' : 'text-green'}`}
              >
                {/* AFTER fees (2026-09-28): the figure has to tie out to the
                    P&L calendar, whose cells are after fees — before fees it
                    read 376.87 against the calendar's 336.87 for the same
                    days. Before fees is still one hover away.
                    hoverOnly: the breakdown opens on hover, without the dotted
                    underline, so the card reads as clean numbers. */}
                <PnlBreakdown
                  gross={range.realized}
                  net={range.realizedNet}
                  feesSince={feesSince}
                  heading={`${fmtMediumDate(fromDate)} — ${fmtMediumDate(toDate)}`}
                  hoverOnly
                >
                  {fmtSignedMoney(realizedShown)}
                </PnlBreakdown>
              </div>
            </div>
            {/* The whole tile is the button into the breakdown: added vs
                compounded, and the day list both come from. */}
            <button
              type="button"
              onClick={() => setReturnOpen(true)}
              aria-haspopup="dialog"
              className="group relative overflow-hidden rounded-rail border border-hair bg-surface2 py-4 px-[18px] text-left font-body cursor-pointer transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent-line hover:shadow-[0_14px_34px_-16px_var(--glow)] focus-visible:outline-none focus-visible:border-accent-line focus-visible:shadow-[0_0_0_3px_var(--glow)] animate-[fadeup_0.4s_ease-out_0.16s_both]"
            >
              <Sheen key={sheenKey} delay={240} />
              {refreshing && <Shimmer />}
              <span className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase">
                  Period Return
                </span>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-muted transition-colors group-hover:text-accent">
                  Breakdown
                  <ChevronRight
                    size={13}
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </span>
              </span>
              <span
                className={`block font-mono text-[24px] font-extrabold tracking-[-0.6px] mt-1.5 mb-1 tabular-nums ${(range.period.added ?? 0) < 0 ? 'text-red' : 'text-accent'}`}
                title={
                  range.period.addedGross === null
                    ? undefined
                    : `Before exchange fees: ${fmtSignedPct(range.period.addedGross, 2)}`
                }
              >
                {/* After fees, like the gains tile beside it — one basis per
                    pair, or the two read as disagreeing. */}
                {range.period.added === null ? '—' : fmtSignedPct(returnShown, 2)}
              </span>
              <span className="block text-[11px] text-muted font-semibold">
                {range.period.unmeasured > 0
                  ? `${range.period.measured} of ${range.period.measured + range.period.unmeasured} trading days measured`
                  : range.period.measured > 0
                    ? `Sum of ${range.period.measured} daily return${range.period.measured === 1 ? '' : 's'}${filtered ? ' · filtered' : ''}`
                    : 'No closed trades in this range'}
              </span>
            </button>
          </div>

          <PeriodReturnModal
            open={returnOpen}
            onClose={() => setReturnOpen(false)}
            from={fromDate}
            to={toDate}
            result={range.period}
            filtered={filtered}
          />
        </div>
      )}
    </section>
  )
}

/** 'YYYY-MM-DD' of the day before, in UTC like every day key on this page. */
function dayBefore(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
