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
  pnl: number
  pnlPct: number
  positions: number
  closedAt: string
}
