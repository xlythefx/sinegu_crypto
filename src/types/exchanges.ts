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
  /**
   * Whether the exchange still accepts this key FROM OUR SERVER. 'blocked'
   * means Binance refused it — almost always an IP allow-list on the key that
   * does not include us. A blocked account takes no new trades and is
   * disconnected automatically once `key_grace_ends_at` passes.
   */
  key_status?: 'ok' | 'blocked'
  /** Binance's own code, e.g. "-2015". */
  key_error_code?: string | null
  /** Our classification: IP_OR_PERMISSION | BAD_KEY_FORMAT | ... */
  key_error_reason?: string | null
  key_error_message?: string | null
  key_blocked_at?: string | null
  key_checked_at?: string | null
  /** ISO date the account gets disconnected if the key is not fixed. */
  key_grace_ends_at?: string | null
}
