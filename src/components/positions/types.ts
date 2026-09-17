import type { FeeSource } from '../../types/dashboard'

export type Exchange = 'Binance' | 'Bybit' | 'MEXC'
export type ExchangeFilter = 'all' | Exchange

export const EXCHANGES: Exchange[] = ['Binance', 'Bybit', 'MEXC']

/** Venues with tables behind them — Bybit stays disabled in the facet. */
export const AVAILABLE_EXCHANGES: Exchange[] = ['Binance', 'MEXC']

export interface ActivePosition {
  ticker: string
  avgPrice: string
  exchange: Exchange
  unrealizedPnl: number
  pnlPct: number
  increments: number
}

export interface ClosedTrade {
  ticker: string
  price: string
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
}
