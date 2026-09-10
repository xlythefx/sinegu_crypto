/**
 * Pure derivations behind the landing page's verified track record — turns the
 * `/public/track-record` daily series into stat-card strings and SVG chart
 * geometry. No React.
 */

import { axisTicks4, linePath } from './chart'
import { fmtShortDate, fmtShortMonth, fmtSignedPct } from './format'
import type { TrackRecordPoint, TrackRecordStats } from '../types/publicStats'

export type ChartMode = 'cumulative' | 'daily' | 'monthly'

export const CHART_MODES: { id: ChartMode; label: string }[] = [
  { id: 'cumulative', label: 'Cumulative P&L' },
  { id: 'daily', label: 'Daily P&L' },
  { id: 'monthly', label: 'Monthly P&L' },
]

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

export interface ChartModel {
  /** Line and zero-baseline-anchored fill, in local coords (translate by X0). */
  path: string
  areaPath: string
  /** Four gridlines / axis labels, top to bottom. */
  ticks: { value: number; label: string; topPct: number }[]
  /** The 0% baseline — "starting capital" on the cumulative view. */
  zeroY: number
  baselineLabel: string
  /** x positions as a percentage of the full viewBox width. */
  labels: { key: string; text: string; leftPct: number }[]
  end: { x: number; y: number }
}

/**
 * Chain each month's daily percentages into one return per month — compounded,
 * not summed, so a month reads the same way the total does and the twelve
 * months of a year multiply back out to that year.
 */
function toMonthly(series: TrackRecordPoint[]): { date: string; value: number }[] {
  const months = new Map<string, number>()
  for (const point of series) {
    const key = point.date.slice(0, 7)
    months.set(key, (months.get(key) ?? 1) * Math.max(0, 1 + point.pct / 100))
  }
  return [...months.entries()].map(([month, growth]) => ({
    date: month,
    value: (growth - 1) * 100,
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
 * plot each period's own return around a break-even line.
 */
export function buildChartModel(
  series: TrackRecordPoint[],
  mode: ChartMode,
): ChartModel | null {
  if (series.length === 0) return null

  const points =
    mode === 'monthly'
      ? toMonthly(series)
      : series.map((p) => ({
          date: p.date,
          value: mode === 'cumulative' ? p.cumulative : p.pct,
        }))
  if (points.length === 0) return null

  const withBaseline = mode === 'cumulative'
  const values = withBaseline ? [0, ...points.map((p) => p.value)] : points.map((p) => p.value)

  // 0 always sits inside the range so the baseline is visible and the fill has
  // something honest to anchor to.
  const ticks = axisTicks4(Math.min(0, ...values), Math.max(0, ...values))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const span = yMax - yMin || 1
  const yOf = (value: number) => PLOT_BOTTOM - ((value - yMin) / span) * (PLOT_BOTTOM - PAD_Y)

  const path = linePath(values, PLOT_W, VB_H, PAD_Y, yMin, yMax)
  const zeroY = yOf(0)

  const step = ticks[1] - ticks[0]
  const tickDp = step >= 10 ? 0 : step >= 1 ? 1 : 2

  const offset = withBaseline ? 1 : 0
  const stepX = PLOT_W / Math.max(values.length - 1, 1)
  const label = mode === 'monthly' ? fmtShortMonth : fmtShortDate

  return {
    path,
    areaPath: `${path} L${PLOT_W},${zeroY.toFixed(1)} L0,${zeroY.toFixed(1)} Z`,
    ticks: [...ticks].reverse().map((value) => ({
      value,
      // Precision comes from the step, so every tick on one axis shows the
      // same number of decimals. The zero tick is a reference, not a gain —
      // it carries no sign.
      label: value === 0 ? `${(0).toFixed(tickDp)}%` : fmtSignedPct(value, tickDp),
      topPct: (yOf(value) / VB_H) * 100,
    })),
    zeroY,
    baselineLabel: withBaseline ? 'Starting capital' : 'Break-even',
    labels: sampleEvenly(points, MAX_X_LABELS).map(({ item, index }) => ({
      key: item.date,
      text: label(item.date),
      leftPct: ((X0 + (index + offset) * stepX) / VB_W) * 100,
    })),
    end: {
      x: PLOT_W,
      y: yOf(values[values.length - 1]),
    },
  }
}
