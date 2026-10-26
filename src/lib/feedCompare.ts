/**
 * Pure wording for the Signal Log's "TradingView vs QuantLab" view — the same
 * signal from the main feed and the test feed, side by side.
 */

import { fmtDuration } from './signalDelivery'
import type { SignalFeed } from '../types/feeds'
import type { FeedCompareRow, FeedSide } from '../types/feedCompare'

/**
 * Who sends each feed today: TradingView alerts post to the main webhooks,
 * QuantLab to the test ones. The one place the page names them, so another
 * provider on the test feed is a one-line change.
 */
export const FEED_SOURCE: Record<SignalFeed, string> = { main: 'TradingView', test: 'QuantLab' }

/** Whose fill each side shows: the master on the main feed, a tester on the test feed. */
export const FEED_ACCOUNT_ROLE: Record<SignalFeed, string> = { main: 'Master', test: 'Tester' }

/** Arrival times keep milliseconds from this day on; earlier rows have whole seconds. */
export const MS_PRECISION_SINCE = '2026-10-26'

/** "6.4 s", "850 ms" — a gap without its sign. */
export function fmtGap(ms: number): string {
  return fmtDuration(Math.abs(ms))
}

/** "QuantLab first by 6.4 s" / "Same time" / "Only TradingView sent it". */
export function leadLine(row: FeedCompareRow): string {
  if (row.kind === 'main_only') return `Only ${FEED_SOURCE.main} sent it`
  if (row.kind === 'test_only') return `Only ${FEED_SOURCE.test} sent it`
  if (row.first === null || row.first === 'tie' || row.gapMs === null) return 'Same time (within 0.1 s)'
  return `${FEED_SOURCE[row.first]} first by ${fmtGap(row.gapMs)}`
}

/** "QuantLab 4.2 s earlier on average" — from the summary's signed average. */
export function averageLine(avgGapMs: number | null): string | null {
  if (avgGapMs === null) return null
  if (Math.abs(avgGapMs) < 100) return 'About the same time on average'
  return `${FEED_SOURCE[avgGapMs > 0 ? 'main' : 'test']} earlier on average`
}

/** An exchange fill price: 2 decimals at least, more for small prices. */
export function fmtFillPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: price >= 1000 ? 2 : price >= 1 ? 4 : 6,
  })
}

/**
 * The price verdict, worded — or null when one side has no fill. A testnet
 * fill is a different market, so a pair with a demo side is shown but never
 * called better or worse.
 */
export function priceLine(row: FeedCompareRow): { text: string; good: boolean } | null {
  if (row.betterPrice === null || row.priceDiffPct === null) return null
  if (!row.pricesComparable) return { text: 'Prices not compared — one side trades on demo', good: false }
  if (row.betterPrice === 'same') return { text: 'Same price', good: false }
  return {
    text: `${FEED_SOURCE[row.betterPrice]} got the better price by ${Math.abs(row.priceDiffPct).toFixed(3)}%`,
    good: true,
  }
}

/** What the side's account did: "Filled at 92.41" / "Skipped — maxed sizing". */
export function outcomeText(side: FeedSide, feed: SignalFeed): string {
  switch (side.outcome) {
    case 'filled':
      return side.fillPrice !== null ? `Filled at ${fmtFillPrice(side.fillPrice)}` : 'Filled'
    case 'skipped':
      return side.reason ? `Skipped — ${side.reason}` : 'Skipped'
    case 'failed':
      return side.reason ? `Failed — ${side.reason}` : 'Failed'
    case 'rejected':
      return 'Signal rejected — no account traded'
    case 'absent':
      return `No ${FEED_ACCOUNT_ROLE[feed].toLowerCase()} account in this signal`
    default:
      return '—'
  }
}
