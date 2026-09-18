/** Types for the unauthenticated marketing endpoints (`/api/public/*`). */

/**
 * One symbol's share of a trading day's return — the day's assets ranked, best
 * first. `pct` is measured on the same capital as the day's own `pct`, so the
 * shares of one day add up to it. Tickers are public already (every entry is
 * announced by ticker); this is still percentages and counts only.
 */
export interface TrackRecordAsset {
  symbol: string
  pct: number
  trades: number
}

/** One trading day of the master account's verified record. */
export interface TrackRecordPoint {
  /** YYYY-MM-DD */
  date: string
  /** That day's return, in percent of the capital it started the day with —
   *  the daily view's bar, and the figure the Telegram daily recap posts. */
  pct: number
  /** Compounded (time-weighted) return up to and including this day.
   *  Published, no longer drawn: the cumulative view plots `roc`. */
  cumulative: number
  /**
   * Return on capital invested as of this day: realized P&L to date over
   * `initial_deposit + (deposits − withdrawals)` — the dashboard's equity
   * curve as a percentage, and what the cumulative view plots. A different
   * question from `cumulative`, and a different number whenever capital
   * arrived unevenly. Null on a payload predating the field (the chart then
   * falls back to `cumulative`).
   */
  roc?: number | null
  trades: number
  /** The day's symbols, best first. Absent on a payload predating the field. */
  assets?: TrackRecordAsset[]
}

/**
 * Headline figures behind the landing page's stat cards. Percentages only —
 * the endpoint never publishes balances or USD amounts.
 */
export interface TrackRecordStats {
  /**
   * What every dollar invested has returned so far — the headline figure, the
   * one the Telegram recap quotes, and where the cumulative curve ends. Null
   * if no capital was ever recorded.
   */
  return_on_capital_pct: number | null
  /**
   * The COMPOUNDED (time-weighted) return — what the series' `cumulative`
   * points build to. Kept beside the headline rather than in place of it: the
   * two diverge when capital arrived unevenly, so each is labelled where it
   * appears instead of being shown as a bare percentage.
   */
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
  /**
   * The ticker filter the record was computed under, canonical (`LTCUSDT`);
   * empty when it covers every trade. What the page labels its scope from —
   * a section that shows one strategy must say so.
   */
  symbols: string[]
}
