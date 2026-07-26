/** Build an SVG polyline path from values, scaled to a viewBox. */
export function linePath(
  values: number[],
  width: number,
  height: number,
  pad = 10,
  yMin?: number,
  yMax?: number,
): string {
  if (values.length === 0) return ''
  const pts = values.length === 1 ? [values[0], values[0]] : values
  const min = yMin ?? Math.min(...pts)
  const max = yMax ?? Math.max(...pts)
  const span = max - min || 1
  const stepX = width / (pts.length - 1)
  return pts
    .map((v, i) => {
      const x = i * stepX
      const y = height - pad - ((v - min) / span) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
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
