import type { ExchangeKind } from './exchanges'

export type TradeAction = 'BUY' | 'SELL' | 'EXIT_LONG' | 'EXIT_SHORT'
export type FanoutStatus = 'filled' | 'skipped' | 'failed'

/**
 * The engine's balance-proportional sizing decision for one account, recorded
 * at signal time. Present on entries only — exits close whatever is open, and
 * a rejected signal never reaches an account.
 *
 * The rule: below `referenceBalance` every account gets exactly one `baseSize`.
 * Above it, coarse-step tickers (BTCUSDT) step in whole `baseSize` multiples
 * per reference block; everything else steps in tenths, floored.
 */
export interface SizingDecision {
  balance: number | null
  /**
   * Deposit gate. An account blocked by it carries only these two plus
   * `balance` — every other field stays null, so never assume a full block.
   */
  totalDeposit: number | null
  minDeposit: number | null
  baseSize: number | null
  referenceBalance: number | null
  coarseStep: boolean
  quantity: number | null
  sizeMultiple: number | null
  stacksNow: number | null
  maxIncrements: number | null
  /**
   * Streak sizing — null unless the asset had a ladder at signal time.
   * `streakRun` is signed (-3 = three losses in a row, +2 = two wins);
   * `streakKind`/`streakStep` name the step applied (step 0 = base size);
   * `streakSize` is the size the multiple was applied to; `streakKnown: false`
   * means the history read failed and base size was used.
   */
  streakRun: number | null
  streakKnown: boolean | null
  streakKind: 'loss' | 'win' | null
  streakStep: number | null
  streakSize: number | null
}

/** One account's outcome inside a signal's fan-out. */
export interface TradeLogDetail {
  account: string | null
  uniId: string | null
  userName: string | null
  status: FanoutStatus | null
  reason: string | null
  error: string | null
  retryable: boolean | null
  quantity: number | null
  fillPrice: number | null
  closedQuantity: number | null
  sizing: SizingDecision | null
}

/** One append-only row per signal the engine processed. */
export interface TradeLogRow {
  id: number
  exchange: ExchangeKind
  action: TradeAction
  ticker: string
  success: boolean
  price: number | null
  strategy: string | null
  leverage: number | null
  category: string | null
  targetCount: number
  filled: number
  failed: number
  skipped: number
  details: TradeLogDetail[]
  ts: string | null
}

export interface TradeLogSummary {
  signals: number
  cleanSignals: number
  filled: number
  failed: number
  skipped: number
}

export interface TradeLogFilters {
  exchange?: string
  action?: string
  ticker?: string
  category?: string
  strategy?: string
  /** 'success' = clean signals only, 'problem' = anything that did not fill cleanly. */
  result?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface TradeLogsData {
  logs: TradeLogRow[]
  summary: TradeLogSummary
  pagination: { limit: number; offset: number; total: number }
  /** Distinct values across the whole table — drives the filter selects. */
  options: { tickers: string[]; strategies: string[] }
}
