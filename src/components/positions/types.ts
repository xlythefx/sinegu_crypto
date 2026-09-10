export type Exchange = 'Binance' | 'Bybit' | 'MEXC'
export type ExchangeFilter = 'all' | Exchange

export const EXCHANGES: Exchange[] = ['Binance', 'Bybit', 'MEXC']

/** Only Binance is integrated for now — Bybit / MEXC are disabled in the UI. */
export const AVAILABLE_EXCHANGES: Exchange[] = ['Binance']

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
  /** Exchange commission deducted from this trade; null when not yet known. */
  fee: number | null
  positions: number
  closedAt: string
}
