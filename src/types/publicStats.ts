/** Types for the unauthenticated marketing endpoints (`/api/public/*`). */

/** One trading day of the master account's verified record. */
export interface TrackRecordPoint {
  /** YYYY-MM-DD */
  date: string
  /** That day's return, in percent of the capital it started the day with. */
  pct: number
  /** Running sum of `pct` up to and including this day. */
  cumulative: number
  trades: number
}

/**
 * Headline figures behind the landing page's stat cards. Percentages only —
 * the endpoint never publishes balances or USD amounts.
 */
export interface TrackRecordStats {
  total_pnl_pct: number
  /** Share of TRADING DAYS that closed green (not per-trade). */
  win_rate: number | null
  trades: number
  avg_daily_pct: number | null
  /** null until at least one winning (resp. losing) day exists. */
  avg_win_pct: number | null
  avg_loss_pct: number | null
  trading_days: number
  winning_days: number
  losing_days: number
  first_trade_at: string
  last_trade_at: string
}

/**
 * `available: false` means there is nothing to publish yet (no master account
 * or no closed trades) — `stats` is null and `series` empty, and the page shows
 * its empty state instead of inventing numbers.
 */
export interface TrackRecord {
  available: boolean
  stats: TrackRecordStats | null
  series: TrackRecordPoint[]
}
