export type ExchangeKind = 'binance' | 'bybit' | 'mexc'

/**
 * Row from /exchange/accounts (binance_accounts table).
 * Decimals arrive as strings from MySQL; secret_key is never returned.
 */
export interface ExchangeAccount {
  id: number
  uni_id: string
  api_key: string
  name: string
  balance: string | null
  unrealized_pnl: string | null
  initial_deposit: string | null
  currency_type: string
  demo: boolean
  enabled: boolean
  created_at: string
}
