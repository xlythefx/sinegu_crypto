/**
 * Pure derivations behind the landing page's verified track record — turns the
 * `/public/track-record` daily series into stat-card strings and SVG chart
 * geometry. No React.
 */

import { axisTicks4, linePath } from './chart'
import { fmtShortDate, fmtShortMonth, fmtSignedPct } from './format'
import type { TrackRecordPoint, TrackRecordStats } from '../types/publicStats'

export type ChartMode = 'cumulative' | 'daily' | 'monthly'

/**
 * Which of the master's markets the landing page publishes (2026-09-18:
 * LTC/USDT alone — the strategy the product is sold on; the other assets the
 * master trades are experiments and are not the pitch). The API filters the
 * trades and echoes the list back, and the section labels itself from that
 * echo, so a page that shows one strategy never claims the whole account.
 * Empty = every trade. The Telegram recaps are NOT filtered: the channel
 * announces every asset's entries and exits, so its recap covers every asset.
 */
export const LANDING_TRACK_RECORD_SYMBOLS: readonly string[] = ['LTCUSDT']

/**
 * The three views and the basis each one is measured on — printed under the
 * chart, because the views deliberately do NOT share a denominator:
 *
 *  - Cumulative draws `roc`, realized P&L to date over ALL capital invested.
 *    That is the dashboard's equity curve expressed as a percentage (the
 *    dollar curve divided by one constant), so the two rise and fall
 *    together, and it ends on the Return on Capital card above the chart.
 *  - Daily and monthly stay on the capital the account HELD at the time (the
 *    compounded, time-weighted basis) because those are the figures the
 *    Telegram recaps post — the site and the channel must show one number
 *    for the same day.
 *
 * The compounded cumulative (`cumulative` / `total_pnl_pct`) is still
 * published, just no longer drawn: on this account most of the capital
 * arrived after the losing early months, so chaining measured those losses
 * against ~1k and every later gain against ~6k, and the curve fell to −17%
 * while the dashboard's equity climbed. Naming the basis on each view is
 * what keeps a −13% day on the daily view and a −2% dip on the cumulative
 * view from reading as a contradiction.
 */
/**
 * How each view is DRAWN, and why the two are not interchangeable:
 *
 *  - Cumulative is a LEVEL that carries forward — day two's figure contains
 *    day one's — so the line between two points means something.
 *  - Daily and monthly are SEPARATE signed quantities, one per period; nothing
 *    connects one day's return to the next. Drawn as a line they read as a
 *    continuous track record that dipped, when in fact each bar is its own
 *    result, and a losing day is a red bar below break-even rather than a
 *    downward slope that could equally be a smaller gain.
 */
export const CHART_KIND: Record<ChartMode, 'line' | 'bar'> = {
  cumulative: 'line',
  daily: 'bar',
  monthly: 'bar',
}

export const CHART_MODES: { id: ChartMode; label: string; note: string }[] = [
  {
    id: 'cumulative',
    label: 'Cumulative P&L',
    note: 'Realized P&L to date as a share of all capital invested — the same basis as Return on Capital above.',
  },
  {
    id: 'daily',
    label: 'Daily P&L',
    note: "Each trading day's return on the capital the account held that day.",
  },
  {
    id: 'monthly',
    label: 'Monthly P&L',
    note: "Each month's trading days compounded.",
  },
]

/** The cumulative view's value for a point; an older payload has no `roc`. */
const cumulativeOf = (point: TrackRecordPoint): number =>
  point.roc ?? point.cumulative

/**
 * SVG viewBox geometry. The plot is inset by `X0` on the left (room for the
 * axis labels) and by `PAD_Y` top and bottom, so the outermost gridlines land
 * exactly on the first and last axis tick.
 */
export const VB_W = 1200
export const VB_H = 360
export const X0 = 48
export const PLOT_W = 1104
const PAD_Y = 40
const PLOT_BOTTOM = VB_H - PAD_Y

/** How many x-axis labels at most; every other one is hidden on small screens. */
const MAX_X_LABELS = 17

/** Bar geometry. The width is a share of the period's slot, capped so five
 *  monthly bars read as a chart rather than as five blocks; the floor keeps a
 *  year of daily bars from thinning into hairlines. */
const BAR_SLOT_SHARE = 0.62
const BAR_MAX_W = 78
const BAR_MIN_W = 2.5
/** A flat period still gets a visible sliver — 0.00% is a result, not a gap. */
const BAR_MIN_H = 2

const DASH = '—'

export interface StatCard {
  label: string
  value: string
  hint: string
  tone: 'green' | 'red' | 'accent' | ''
}

/** Sign-driven tone; no tone at all while the value is unknown. */
const toneOf = (value: number | null | undefined): StatCard['tone'] =>
  value === null || value === undefined ? '' : value < 0 ? 'red' : 'green'

const pct = (value: number | null | undefined, dp: number): string =>
  value === null || value === undefined ? DASH : fmtSignedPct(value, dp)

/**
 * The six headline cards. Every figure is a percentage or a count — the API
 * never publishes balances, so there is nothing here to format as money.
 * A null (no winning day yet, no trades yet) renders as an em dash rather
 * than a misleading 0.00%.
 */
export function statCards(stats: TrackRecordStats | null): StatCard[] {
  return [
    {
      // Return on capital invested — the figure the cumulative view builds to,
      // so the card and the curve's endpoint are one number. The hint names
      // the base because the daily/monthly views are measured on a different
      // one (see CHART_MODES).
      label: 'Return on Capital',
      value: pct(stats?.return_on_capital_pct, 2),
      tone: toneOf(stats?.return_on_capital_pct),
      hint: 'On capital invested',
    },
    {
      label: 'Win Rate',
      value: stats?.win_rate == null ? DASH : `${stats.win_rate.toFixed(1)}%`,
      tone: 'accent',
      hint: 'Winning days',
    },
    {
      label: 'Total Trades',
      value: stats ? stats.trades.toLocaleString('en-US') : DASH,
      tone: '',
      hint: 'Executed trades',
    },
    {
      label: 'Avg Daily P&L',
      value: pct(stats?.avg_daily_pct, 2),
      tone: toneOf(stats?.avg_daily_pct),
      hint: 'Per trading day',
    },
    {
      label: 'Avg Win PNL',
      value: pct(stats?.avg_win_pct, 2),
      tone: 'green',
      hint: 'Per winning day',
    },
    {
      label: 'Avg Loss PNL',
      value: pct(stats?.avg_loss_pct, 2),
      tone: 'red',
      hint: 'Per losing day',
    },
  ]
}

/**
 * The record's return over the last `days` CALENDAR days, chained.
 *
 * Chained, not summed, for the same reason the headline total is: each day's
 * `pct` is measured on the capital that day started with, so multiplying the
 * daily factors is the only way the window means "what the capital did". A sum
 * would read high on a winning streak and could not be checked against a
 * balance.
 *
 * The window is anchored on the LAST day in the series, not on today: the
 * series buckets its days in Asia/Manila while the reader's clock is anywhere,
 * and anchoring on the reader would quietly clip a day off the window at some
 * longitudes. So this is "the 30 days ending on the most recent trading day",
 * which is exactly what the figure covers.
 *
 * Null when there is nothing to measure — never 0, which would read as a flat
 * month rather than an empty record.
 */
export function trailingReturnPct(
  series: TrackRecordPoint[],
  days: number,
): number | null {
  if (series.length === 0) return null

  const last = series[series.length - 1].date
  const cutoff = new Date(`${last.slice(0, 10)}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1))
  const from = cutoff.toISOString().slice(0, 10)

  const window = series.filter((point) => point.date.slice(0, 10) >= from)
  if (window.length === 0) return null

  const factor = window.reduce((acc, point) => acc * (1 + point.pct / 100), 1)

  return (factor - 1) * 100
}

/** One plotted period plus what the hover readout shows for it. */
export interface ChartMark {
  /** Position as a fraction of the FULL viewBox (X0 inset included), 0..1 —
   *  the overlay is plain HTML over a stretched SVG, so fractions are the only
   *  unit that lands on the line at any container width. */
  xFrac: number
  yFrac: number
  /** YYYY-MM-DD for a day, YYYY-MM for a month. */
  date: string
  /** The view's own figure for the period — see CHART_MODES for its basis. */
  value: number
  /** Closed increments in the period. */
  trades: number
}

/** One signed bar, in local coords (translate by X0). */
export interface ChartBar {
  x: number
  y: number
  width: number
  height: number
  /** Drives the colour; a flat period counts as positive (it is not a loss). */
  positive: boolean
}

export interface ChartModel {
  kind: 'line' | 'bar'
  /** Line view only — the curve, its zero-anchored fill and the end cap, all
   *  in local coords (translate by X0). */
  line: { path: string; areaPath: string; end: { x: number; y: number } } | null
  /** Bar view only, one per period in plot order — same order as `marks`. */
  bars: ChartBar[]
  /** Four gridlines / axis labels, top to bottom. */
  ticks: { value: number; label: string; topPct: number }[]
  /** The 0% baseline — "capital invested" on the cumulative view. */
  zeroY: number
  /** What that line means, printed on it — null on the bar views, where the
   *  bars stand on the line and are coloured by which side they fall, and the
   *  axis already prints 0.00% against it. A label there would only sit on top
   *  of the first bar. */
  baselineLabel: string | null
  /** x positions as a percentage of the full viewBox width. */
  labels: { key: string; text: string; leftPct: number }[]
  /** One per REAL period, in plot order — the cumulative view's synthetic
   *  leading 0% point is not a day and has no mark. */
  marks: ChartMark[]
}

interface PeriodPoint {
  date: string
  value: number
  trades: number
}

/**
 * Chain each month's daily percentages into one return per month — compounded,
 * not summed, so a month reads the same way the total does and the twelve
 * months of a year multiply back out to that year.
 */
function toMonthly(series: TrackRecordPoint[]): PeriodPoint[] {
  const months = new Map<string, { growth: number; trades: number }>()
  for (const point of series) {
    const key = point.date.slice(0, 7)
    const month = months.get(key) ?? { growth: 1, trades: 0 }
    month.growth *= Math.max(0, 1 + point.pct / 100)
    month.trades += point.trades
    months.set(key, month)
  }
  return [...months.entries()].map(([month, { growth, trades }]) => ({
    date: month,
    value: (growth - 1) * 100,
    trades,
  }))
}

/** Up to `max` evenly spaced items, always including the first and last. */
function sampleEvenly<T>(items: T[], max: number): { item: T; index: number }[] {
  if (items.length <= max) {
    return items.map((item, index) => ({ item, index }))
  }
  return Array.from({ length: max }, (_, i) => {
    const index = Math.round((i * (items.length - 1)) / (max - 1))
    return { item: items[index], index }
  })
}

/**
 * Chart geometry for one mode. Null when there is nothing to draw.
 *
 * The cumulative view gets a leading 0% point so the curve starts on the
 * baseline instead of jumping to day one's return; the daily and monthly views
 * draw each period's own return as a signed bar around a break-even line.
 *
 * Both kinds share the y scale, the ticks and the mark list, so only the
 * horizontal placement differs: a line point sits ON its label (evenly spaced,
 * first and last on the plot edges), a bar sits centred in its own slot.
 */
export function buildChartModel(
  series: TrackRecordPoint[],
  mode: ChartMode,
): ChartModel | null {
  if (series.length === 0) return null

  const points: PeriodPoint[] =
    mode === 'monthly'
      ? toMonthly(series)
      : series.map((p) => ({
          date: p.date,
          value: mode === 'cumulative' ? cumulativeOf(p) : p.pct,
          trades: p.trades,
        }))
  if (points.length === 0) return null

  const kind = CHART_KIND[mode]
  const withBaseline = mode === 'cumulative'
  const values = withBaseline ? [0, ...points.map((p) => p.value)] : points.map((p) => p.value)

  // 0 always sits inside the range so the baseline is visible and the bars (or
  // the fill) have something honest to anchor to.
  const ticks = axisTicks4(Math.min(0, ...values), Math.max(0, ...values))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const span = yMax - yMin || 1
  const yOf = (value: number) => PLOT_BOTTOM - ((value - yMin) / span) * (PLOT_BOTTOM - PAD_Y)
  const zeroY = yOf(0)

  const step = ticks[1] - ticks[0]
  const tickDp = step >= 10 ? 0 : step >= 1 ? 1 : 2

  const slot = PLOT_W / points.length
  const barW = Math.max(BAR_MIN_W, Math.min(slot * BAR_SLOT_SHARE, BAR_MAX_W))
  const offset = withBaseline ? 1 : 0
  const stepX = PLOT_W / Math.max(values.length - 1, 1)
  /** Where period `index` is drawn, in local coords. */
  const xOf = (index: number) =>
    kind === 'bar' ? slot * (index + 0.5) : (index + offset) * stepX

  let line: ChartModel['line'] = null
  if (kind === 'line') {
    const path = linePath(values, PLOT_W, VB_H, PAD_Y, yMin, yMax)
    line = {
      path,
      areaPath: `${path} L${PLOT_W},${zeroY.toFixed(1)} L0,${zeroY.toFixed(1)} Z`,
      end: { x: PLOT_W, y: yOf(values[values.length - 1]) },
    }
  }

  const bars: ChartBar[] =
    kind === 'bar'
      ? points.map((point, index) => {
          const positive = point.value >= 0
          const height = Math.max(Math.abs(yOf(point.value) - zeroY), BAR_MIN_H)
          return {
            x: xOf(index) - barW / 2,
            // Measured back off the baseline rather than from the value's own
            // y, so a bar held open by BAR_MIN_H still STANDS on break-even
            // instead of straddling it — a flat day must not look like a loss.
            y: positive ? zeroY - height : zeroY,
            width: barW,
            height,
            positive,
          }
        })
      : []

  const label = mode === 'monthly' ? fmtShortMonth : fmtShortDate

  return {
    kind,
    line,
    bars,
    ticks: [...ticks].reverse().map((value) => ({
      value,
      // Precision comes from the step, so every tick on one axis shows the
      // same number of decimals. The zero tick is a reference, not a gain —
      // it carries no sign.
      label: value === 0 ? `${(0).toFixed(tickDp)}%` : fmtSignedPct(value, tickDp),
      topPct: (yOf(value) / VB_H) * 100,
    })),
    zeroY,
    baselineLabel: kind === 'bar' ? null : 'Capital invested',
    labels: sampleEvenly(points, MAX_X_LABELS).map(({ item, index }) => ({
      key: item.date,
      text: label(item.date),
      leftPct: ((X0 + xOf(index)) / VB_W) * 100,
    })),
    // Same x as the labels, so the readout lines up with the period it names.
    marks: points.map((point, index) => ({
      xFrac: (X0 + xOf(index)) / VB_W,
      yFrac: yOf(point.value) / VB_H,
      date: point.date,
      value: point.value,
      trades: point.trades,
    })),
  }
}

/** Nearest mark to a horizontal position (0..1 of the plot box), or null. */
export function nearestMark(marks: ChartMark[], xFrac: number): number | null {
  let best: number | null = null
  let bestGap = Infinity
  marks.forEach((mark, i) => {
    const gap = Math.abs(mark.xFrac - xFrac)
    if (gap < bestGap) {
      bestGap = gap
      best = i
    }
  })
  return best
}
