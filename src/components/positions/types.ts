import type { FeeSource } from '../../types/dashboard'
import type { CloseSource } from '../../types/admin'
import type { TradeSide } from '../../lib/tradeSide'

export type Exchange = 'Binance' | 'Bybit' | 'MEXC'
export type ExchangeFilter = 'all' | Exchange

export const EXCHANGES: Exchange[] = ['Binance', 'Bybit', 'MEXC']

/** Venues with tables behind them. All three since 2026-09-24. */
export const AVAILABLE_EXCHANGES: Exchange[] = ['Binance', 'Bybit', 'MEXC']

export interface ActivePosition {
  ticker: string
  /** LONG / SHORT; null when the row carries neither a side nor a size. */
  side: TradeSide | null
  /** Open size in coins (unsigned on screen). */
  qty: number | null
  /** The exchange's average entry; null when not reported. */
  entryPrice: number | null
  /** Where the price is now; null until the poller has written a mark. */
  markPrice: number | null
  exchange: Exchange
  unrealizedPnl: number
  pnlPct: number
  increments: number
}

export interface ClosedTrade {
  ticker: string
  /** The trade's direction — never the closing order (a short closes with a BUY). */
  side: TradeSide | null
  /** Closed size in coins. */
  qty: number | null
  /** Null when the close never recorded its entry — shown as "—", not $0. */
  entryPrice: number | null
  exitPrice: number | null
  strategy: string
  exchange: Exchange
  /** Net of `fee` — matches what the exchange's own app shows for the trade. */
  pnl: number
  pnlPct: number
  /** Exchange commission + funding deducted from this trade; null when not yet known. */
  fee: number | null
  /** Estimate or the exchange's receipts — decides the "est." tag beside `fee`. */
  feeSource: FeeSource
  positions: number
  closedAt: string
  /**
   * Admin only: who closed it. The trader pages never set it, so the
   * "Closed outside the bot" chip never shows to a customer.
   */
  closeSource?: CloseSource
}
