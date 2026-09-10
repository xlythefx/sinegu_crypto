/** One plotted point, in viewBox units. */
export interface LinePoint {
  x: number
  y: number
  /** Index into the ORIGINAL values array (a single value is drawn twice). */
  index: number
}

/**
 * Plot values into a viewBox and return the points.
 *
 * Shares its geometry with {@link linePath} on purpose: a hover crosshair that
 * computes its own coordinates drifts off the line it is supposed to be reading.
 *
 * `xs` gives each point an explicit horizontal position as a fraction of the
 * width (0..1) — pass it when the points are events at uneven times, or the
 * even index spacing renders a busy day as wide as a quiet week. Omit it and
 * points are spaced evenly, which is right for one-per-period series.
 */
export function linePoints(
  values: number[],
  width: number,
  height: number,
  pad = 10,
  yMin?: number,
  yMax?: number,
  xs?: number[],
): LinePoint[] {
  if (values.length === 0) return []
  const pts = values.length === 1 ? [values[0], values[0]] : values
  const min = yMin ?? Math.min(...pts)
  const max = yMax ?? Math.max(...pts)
  const span = max - min || 1
  const stepX = width / (pts.length - 1)
  const at = xs?.length === pts.length ? xs : null
  return pts.map((v, i) => ({
    x: at ? at[i] * width : i * stepX,
    y: height - pad - ((v - min) / span) * (height - pad * 2),
    index: Math.min(i, values.length - 1),
  }))
}

/**
 * Build an SVG polyline path from values, scaled to a viewBox.
 * See {@link linePoints} for the arguments.
 */
export function linePath(
  values: number[],
  width: number,
  height: number,
  pad = 10,
  yMin?: number,
  yMax?: number,
  xs?: number[],
): string {
  return linePoints(values, width, height, pad, yMin, yMax, xs)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
}

// Deliberately finer than the classic [1, 2, 5]: on a percentage axis a step of
// 4 (0/4/8/12 for a +11.4% record) fills the plot far better than 5 would
// (0/5/10/15) while still reading as a round number.
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5]

/**
 * Exactly four evenly spaced, round-numbered ticks covering `lo`..`hi`
 * (ascending). Four is fixed because the callers draw one gridline per tick and
 * position their axis labels off the same list. Pass a range that already
 * includes 0 if the chart needs a zero baseline inside the plot area.
 */
export function axisTicks4(lo: number, hi: number): number[] {
  const span = Math.max(hi - lo, 1e-6)
  const startExp = Math.floor(Math.log10(span / 3)) - 1

  for (let exp = startExp; exp <= startExp + 8; exp++) {
    for (const multiple of NICE_STEPS) {
      const step = multiple * 10 ** exp
      const min = Math.floor(lo / step) * step
      // Tolerate float drift so a hi that lands exactly on a tick still fits.
      if (min + 3 * step >= hi - step * 1e-9) {
        return [0, 1, 2, 3].map((i) => min + i * step)
      }
    }
  }

  const step = span / 3 // unreachable in practice — even split as a backstop
  return [0, 1, 2, 3].map((i) => lo + i * step)
}

const SYMBOL_COLORS: Record<string, string> = {
  BTCUSDT: '#f7931a',
  ETHUSDT: '#627eea',
  SOLUSDT: '#14b8a6',
  XRPUSDT: '#8b94a3',
  BNBUSDT: '#f0b90b',
}

const FALLBACK_PALETTE = [
  'var(--accent)',
  '#627eea',
  '#14b8a6',
  '#e879f9',
  '#8b94a3',
  '#f0b90b',
]

export function seriesColor(id: string, index: number): string {
  return SYMBOL_COLORS[id] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]
}

/** "BTCUSDT" → "BTC/USDT" for display. */
export function displaySymbol(symbol: string): string {
  for (const quote of ['USDT', 'BUSD', 'USDC', 'USD']) {
    if (symbol.endsWith(quote) && symbol.length > quote.length) {
      return `${symbol.slice(0, -quote.length)}/${quote}`
    }
  }
  return symbol
}
