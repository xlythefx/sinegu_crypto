import type { ExchangeKind } from './exchanges'

/** One open position row from `GET /admin/open-positions` (any venue). */
export interface AdminOpenPosition {
  /** Row id in that venue's `{exchange}_positions` table — repeats across venues. */
  id: number
  exchange: ExchangeKind
  uni_id: string
  account_id: number | null
  account_name: string | null
  owner_name: string
  owner_type: string | null
  /** Testnet / demo-trading account: closing it moves no real money. */
  demo: boolean
  key_blocked: boolean
  symbol: string
  side: 'LONG' | 'SHORT'
  /** Absolute size in coins. */
  size: number
  entry_price: number | null
  mark_price: number | null
  unrealized_pnl: number | null
  updated_at: string | null
  /** Whether the engine trades this account at all; false → `blocked_reason`. */
  closable: boolean
  blocked_reason: string | null
}

export interface OpenPositionsRefreshState {
  last_at: string | null
  cooldown_seconds: number
  /** Seconds until the next forced fetch is allowed (0 = now). */
  retry_after: number
}

/** An account the engine trades (master excluded) — present even when flat. */
export interface TradedAccount {
  exchange: ExchangeKind
  uni_id: string
  owner_name: string
  account_name: string | null
  demo: boolean
}

export interface AdminOpenPositionsData {
  positions: AdminOpenPosition[]
  /** Venues the master has an account on — the only ones a user can be compared on. */
  master_exchanges: ExchangeKind[]
  accounts: TradedAccount[]
  refresh: OpenPositionsRefreshState
}

/** What the browser sends — rows are named, never described. */
export interface ClosePositionsRequest {
  positions: { exchange: ExchangeKind; id: number }[]
}

/** One account's outcome inside an engine close job. */
export interface CloseDetail {
  account?: string
  uni_id?: string
  exchange?: string
  status: 'filled' | 'failed' | 'skipped' | string
  closed_quantity?: number
  reason?: string
  error?: string
}

export interface CloseJob {
  exchange: string
  symbol: string
  side: 'LONG' | 'SHORT'
  action: string
  uni_ids: string[]
  status: 'done' | 'running' | 'crashed'
  filled?: number
  failed?: number
  skipped?: number
  error?: string
  details?: CloseDetail[]
}

export interface ClosePositionsResponse {
  success: boolean
  message: string
  engine_request?: { positions: { exchange: string; uni_id: string; symbol: string; side: string }[] }
  engine_status?: number | null
  engine_response?: {
    success?: boolean
    jobs?: CloseJob[]
    filled?: number
    failed?: number
    skipped?: number
    running?: number
    error?: string
    message?: string
  } | null
}
