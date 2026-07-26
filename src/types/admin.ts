export type UserStatus = 'pending' | 'active' | 'suspended'
export type UserRole = 'user' | 'admin' | 'master'

/** Exchange account row nested under an admin user (API keys pre-masked). */
export interface AdminUserAccount {
  id: number
  name: string
  exchange: string
  api_key: string | null
  demo: boolean
  enabled: boolean
  balance: number
  unrealized_pnl: number
  currency_type: string | null
  deleted_at: string | null
}

/** One user_credentials row as returned by GET /admin/users. */
export interface AdminUser {
  uni_id: string
  name: string
  email: string
  status: UserStatus
  type: UserRole
  realized_percentage: number
  unrealized_percentage: number
  created_at: string | null
  last_activity: string | null
  accounts: AdminUserAccount[]
}

import type { StrategyTrade } from '../lib/strategyStats'

/** GET /admin/strategies — global toggle map + tagged closed trades. */
export interface StrategiesData {
  /** strategy_key → enabled; a missing key means enabled. */
  enabled: Record<string, boolean>
  trades: StrategyTrade[]
}

/** One closed trade inside a calendar day. */
export interface DailyPnlTrade {
  symbol: string
  position_side: string
  position_amt: number
  realized_pnl: number
  side: string
  strategy: string | null
  closed_at: string
}

/** One day's aggregate + its trades. */
export interface DailyPnlDay {
  total: number
  wins: number
  losses: number
  trades: DailyPnlTrade[]
}

/** GET /admin/daily-pnl — master account closed P&L keyed by YYYY-MM-DD. */
export type DailyPnlMap = Record<string, DailyPnlDay>

/** One open position from GET /admin/positions. */
export interface AdminOpenPosition {
  id: number
  account_id: number | null
  account_name: string | null
  account_balance: number
  symbol: string
  position_side: string
  position_amt: number
  price: number
  unrealized_pnl: number
  broker: string
}

/** One closed trade from GET /admin/positions. */
export interface AdminPastTrade {
  id: number
  account_id: number | null
  account_name: string | null
  account_balance: number
  symbol: string
  price: number
  realized_pnl: number
  side: string
  strategy: string | null
  closed_at: string
  position_amt: number
  broker: string
}

/** GET /admin/positions — open positions + closed trades across all accounts. */
export interface AdminPositionsData {
  positions: AdminOpenPosition[]
  trades: AdminPastTrade[]
}

export type AssetSide = 'ALL' | 'LONG' | 'SHORT'

/** One assets row as returned by GET /admin/assets. */
export interface AdminAsset {
  asset_id: number
  ticker: string
  type: string | null
  broker: string | null
  side: AssetSide
  asset_image: string | null
  max_increments: number
  base_size: number
  enabled: boolean
  created_at: string | null
  updated_at: string | null
}

/** Payload for creating / updating an asset. */
export interface AssetInput {
  ticker: string
  type: string | null
  broker: string | null
  side: AssetSide
  max_increments: number
  base_size: number
  enabled: boolean
}

/** One sandbox (test-tagged) user row as returned by GET /admin/sandbox/users. */
export interface SandboxUser {
  uni_id: string
  name: string
  email: string
  status: UserStatus
  type: UserRole
  created_at: string | null
  positions_count: number
}

/** Payload for creating a test user (blank fields are auto-generated server-side). */
export interface TestUserInput {
  name?: string
  email?: string
  password?: string
  status?: UserStatus
  type?: UserRole
}

/** A single fabricated past-position row (the template for inserts). */
export interface SandboxPositionField {
  symbol: string
  position_side: 'LONG' | 'SHORT'
  position_amt: number
  entry_price: number
  exit_price: number
  realized_pnl: number
  side?: 'BUY' | 'SELL'
  strategy: string
  closed_at: string // 'YYYY-MM-DD'
}

/** Payload for POST /admin/sandbox/positions. */
export interface SandboxPositionInput {
  uni_id: string
  count: number
  randomize: boolean
  position?: SandboxPositionField
}

/** GET /admin/master-stats — the master account + its trading statistics. */
export interface MasterStats {
  master: {
    uni_id: string
    name: string
    email: string
    account: {
      id: number
      name: string
      api_key: string | null
      demo: boolean
      enabled: boolean
      currency_type: string | null
    } | null
  }
  stats: {
    balance: number
    unrealized_pnl: number
    total_closed_pnl: number
    trades_executed: number
    active_positions: number
    closed_positions: number
    last_trade_at: string | null
  }
}
