/**
 * Pure derivations behind the landing hero's live order book — turns the raw
 * levels `/public/order-book` publishes into a readable ladder and a depth
 * histogram. No React.
 *
 * The one thing worth knowing here: a raw book is not a ladder. Five
 * consecutive BTCUSDT levels span about forty cents, so printing them gives
 * five prices differing in their last digit and five tiny sizes. Every
 * exchange UI solves this the same way — it GROUPS levels into price buckets
 * and lets you pick the grouping — and that is what `bucketSize` does, derived
 * from the band the payload actually covers rather than hardcoded per symbol.
 */

import type { BookLevel } from '../types/market'

/** Ladder rows per side. */
export const BOOK_ROWS = 5

/** Histogram bars per side; the centre is a divider, not a bar. */
export const BOOK_BARS = 4

/** One bucketed ladder row. */
export interface BookRow {
  price: number
  size: number
  /** Share of the largest row on the card, 0–100 — the depth bar's width. */
  depthPct: number
}

/** One histogram bar: summed size in a slice of the book. */
export interface BookBar {
  side: 'bid' | 'ask'
  /** Height as a share of the tallest bar, 0–100. */
  heightPct: number
}

export interface BookModel {
  bids: BookRow[]
  asks: BookRow[]
  mid: number
  /** Best-ask minus best-bid, as a percent of mid. */
  spreadPct: number
  /** The grouping the ladder is bucketed at, in quote currency. */
  bucket: number
  bars: BookBar[]
  /** How far from mid the histogram reaches, in percent — what the footer
   *  labels itself with. The published depth only ever covers a sliver of the
   *  book, so a fixed "±0.5%" caption would be a claim we cannot meet. */
  bandPct: number
}

/** The smallest of 1/2/5 × 10^k that is at least `value`. */
function niceStep(value: number): number {
  if (!(value > 0)) return 0
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 5]) {
    if (step * magnitude >= value) return step * magnitude
  }
  return 10 * magnitude
}

/**
 * A grouping that makes `BOOK_ROWS` rows cover about half the fetched band —
 * wide enough that each row aggregates real size, narrow enough that the
 * ladder stays inside the levels we were actually sent.
 */
function bucketSize(bids: BookLevel[], asks: BookLevel[], mid: number): number {
  const band = Math.min(mid - bids[bids.length - 1][0], asks[asks.length - 1][0] - mid)
  const bucket = niceStep(band / (BOOK_ROWS * 2))
  if (bucket > 0) return bucket

  // A book too thin to measure: fall back to its own tick, then to a cent.
  const tick = Math.abs((bids[0]?.[0] ?? 0) - (bids[1]?.[0] ?? 0))
  return tick > 0 ? tick : 0.01
}

/**
 * Sum `levels` into `count` buckets of `bucket` width, walking away from mid.
 * Bids round down and asks round up so a bucket is named by the price a taker
 * would actually meet.
 */
function bucketRows(
  levels: BookLevel[],
  bucket: number,
  count: number,
  side: 'bid' | 'ask',
): { price: number; size: number }[] {
  const totals = new Map<number, number>()

  for (const [price, size] of levels) {
    const key =
      side === 'bid'
        ? Math.floor(price / bucket) * bucket
        : Math.ceil(price / bucket) * bucket
    totals.set(key, (totals.get(key) ?? 0) + size)
  }

  return [...totals.entries()]
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => (side === 'bid' ? b.price - a.price : a.price - b.price))
    .slice(0, count)
}

/**
 * Depth either side of mid, in `BOOK_BARS` equal slices per side, built from
 * EVERY level in the payload rather than the ladder's few — the histogram is
 * the part that says how much is resting out there.
 *
 * Bids run outermost-first and asks innermost-first, so the bars rise into the
 * middle and fall away again.
 */
function depthBars(
  bids: BookLevel[],
  asks: BookLevel[],
  mid: number,
  band: number,
): BookBar[] {
  const width = band / BOOK_BARS
  const sums = { bid: new Array(BOOK_BARS).fill(0), ask: new Array(BOOK_BARS).fill(0) }

  const fill = (levels: BookLevel[], side: 'bid' | 'ask') => {
    for (const [price, size] of levels) {
      const distance = Math.abs(price - mid)
      if (distance > band) continue
      const slot = Math.min(BOOK_BARS - 1, Math.floor(distance / width))
      sums[side][slot] += size
    }
  }

  fill(bids, 'bid')
  fill(asks, 'ask')

  const tallest = Math.max(...sums.bid, ...sums.ask, 0)
  const scale = (value: number) => (tallest > 0 ? (value / tallest) * 100 : 0)

  return [
    ...[...sums.bid].reverse().map((v): BookBar => ({ side: 'bid', heightPct: scale(v) })),
    ...sums.ask.map((v): BookBar => ({ side: 'ask', heightPct: scale(v) })),
  ]
}

/**
 * The whole card's geometry, or null when there is no two-sided book to draw.
 * Null rather than an empty model: a book with one side is not a book, and the
 * card shows its unavailable state instead of half a ladder.
 */
export function buildBookModel(bids: BookLevel[], asks: BookLevel[]): BookModel | null {
  if (bids.length === 0 || asks.length === 0) return null

  const bestBid = bids[0][0]
  const bestAsk = asks[0][0]
  const mid = (bestBid + bestAsk) / 2
  if (!(mid > 0)) return null

  const bucket = bucketSize(bids, asks, mid)
  const bidRows = bucketRows(bids, bucket, BOOK_ROWS, 'bid')
  const askRows = bucketRows(asks, bucket, BOOK_ROWS, 'ask')

  // One scale across both sides, so a bar's width compares like for like.
  const largest = Math.max(...bidRows.map((r) => r.size), ...askRows.map((r) => r.size), 0)
  const withDepth = (row: { price: number; size: number }): BookRow => ({
    ...row,
    depthPct: largest > 0 ? (row.size / largest) * 100 : 0,
  })

  const band = Math.min(mid - bids[bids.length - 1][0], asks[asks.length - 1][0] - mid)

  return {
    bids: bidRows.map(withDepth),
    asks: askRows.map(withDepth),
    mid,
    spreadPct: ((bestAsk - bestBid) / mid) * 100,
    bucket,
    bars: depthBars(bids, asks, mid, band),
    bandPct: (band / mid) * 100,
  }
}

/**
 * How long a book may go unrefreshed before the card stops calling itself
 * live. Generous against the 5s poll: one missed tick is a slow network, not a
 * stale book.
 */
const LIVE_WITHIN_MS = 30_000

/** Whether `book_at` is recent enough to claim the book is live. */
export function bookIsLive(bookAt: string | null, now: number): boolean {
  if (!bookAt) return false
  const stamped = new Date(bookAt).getTime()

  return Number.isFinite(stamped) && now - stamped < LIVE_WITHIN_MS
}

/** "2.9B" / "412.5M" / "83.1K" — 24h quote volume, in the card's width. */
export function fmtCompactUsd(value: number): string {
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]
  for (const [size, suffix] of units) {
    if (Math.abs(value) >= size) return `${(value / size).toFixed(1)}${suffix}`
  }

  return value.toFixed(0)
}
