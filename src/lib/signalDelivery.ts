/**
 * Pure helpers for the Signal Log's delivery proof — how long a signal took
 * from TradingView firing the alert to the engine answering it.
 *
 * TradingView gives up on a webhook after about 3 seconds and marks the alert
 * "failed — request took too long and timed out", even when the request is
 * still on its way. On 24 Oct 2026 the 14:15 UTC LTC entry fired at :01,
 * reached us at :09 and filled five accounts while TradingView said failed.
 */

import type { TradeLogDelivery, TradeLogRow } from '../types/tradeLogs'

/** "3 ms", "850 ms", "8.1 s". Below a millisecond reads "under 1 ms". */
export function fmtDuration(ms: number): string {
  if (ms < 1) return 'under 1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

/**
 * The transit, worded. TradingView's {{timenow}} has whole seconds and its
 * clock is not ours, so a sub-second (or slightly negative) figure reads as
 * "under a second" rather than a precise number it cannot back.
 */
export function transitLabel(delivery: TradeLogDelivery): string | null {
  if (delivery.transitMs === null) return null
  if (delivery.transitMs < 1000) return 'under a second later'
  return `${fmtDuration(delivery.transitMs)} later`
}

/** Accounts filled on the signal and its retries together. */
export function filledInAll(log: TradeLogRow): number {
  return log.filled + log.retries.reduce((n, r) => n + r.filled, 0)
}

/** "5 of 6 accounts filled" / "Rejected — no account was touched". */
export function outcomeLine(log: TradeLogRow): string {
  if (log.category === 'rejected') return 'Rejected — no account was touched'
  const filled = filledInAll(log)
  const of = log.targetCount > 0 ? ` of ${log.targetCount}` : ''
  return `${filled}${of} ${log.targetCount === 1 ? 'account' : 'accounts'} filled`
}
