import type { ExchangeKind } from './exchanges'
import type { SignalFeed } from './feeds'

/** The four signals the trading engine understands. */
export type TradeAction = 'BUY' | 'SELL' | 'EXIT_LONG' | 'EXIT_SHORT'

/** Which configured engine the API proxies to. Keys only — never URLs. */
export type EngineTarget = 'local' | 'prod'

export type RecipientMode = 'all' | 'selected'

/** One user the engine would trade, as returned by GET /admin/manual-trade/targets. */
export interface ManualTradeTarget {
  uni_id: string
  display_name: string
  email: string | null
  exchange: ExchangeKind
  /** The feed this user's accounts follow — `test` for a tester. Absent on an older API = main. */
  feed?: SignalFeed
  account_count: number
  demo_count: number
  live_count: number
  balance: number
}

/** Payload the console sends — no secret: the API signs server-side. */
export interface ManualTradeInput {
  exchange: ExchangeKind
  target: EngineTarget
  /** Which webhook to fire: `test` reaches tester accounts only. Default main. */
  feed?: SignalFeed
  action: TradeAction
  symbol: string
  leverage?: number | null
  strategy?: string | null
  increments?: number
  target_uni_ids?: string[]
}

export interface ManualTradeResult {
  success: boolean
  sent: number
  failed: number
  increments: number
  url: string
  message: string
  responses: { status: number | null; body: unknown }[]
}

/** Engine /health as seen through the API proxy. */
export interface EngineStatus {
  reachable: boolean
  url: string
  error?: string
  /**
   * Middle-masked BINANCE_ENGINE_WEBHOOK_SECRET — preview only. The full token
   * never leaves the API; copy it from CLAUDE.md for TradingView alerts.
   */
  webhook_secret_masked?: string | null
  /**
   * Whether the engine has its test-feed secret set (so a test signal will be
   * accepted). null = the engine did not say — unknown, never "off". Absent
   * on an API older than the test feed.
   */
  test_feed_enabled?: boolean | null
  health?: {
    status?: string
    service?: string
    accounts_cache_age?: number | null
    retry_queue_depth?: number
    metrics?: Record<string, number>
    pollers?: string[]
  } | null
}
