import type { ExchangeKind } from './exchanges'
import type { SignalFeed } from './feeds'

/** How many tradeable accounts one webhook reaches, by kind of money. */
export interface WebhookReceivers {
  /** Real-money accounts. */
  live: number
  /** Testnet / demo-trading accounts. */
  demo: number
}

/** One engine webhook — one per exchange × feed, from `GET /admin/webhooks`. */
export interface AdminWebhook {
  exchange: ExchangeKind
  feed: SignalFeed
  /** Path on the engine, e.g. `/binance_abcd_webhook`; the base URL is per box. */
  path: string
  /**
   * Whether this exchange is switched on in the engine (`BINANCE_ABCD_EXCHANGES`).
   * null = the engine did not answer: UNKNOWN, never "off".
   */
  venue_live: boolean | null
  /**
   * Whether the engine accepts signals on this webhook — for the test feed,
   * whether its test secret is set. null = unknown (engine silent).
   */
  enabled: boolean | null
  receivers: WebhookReceivers
}

export interface AdminWebhooksData {
  engine: {
    reachable: boolean
    /** The engine has its test-feed secret. null = unknown. */
    test_feed_enabled: boolean | null
  }
  /** Where the engine is reached from outside: `prod` (via nginx) and `local`. */
  bases: { prod: string; local: string }
  /**
   * Whether the API holds each feed's secret (it signs the Manual Trade
   * console's signals with it). Presence only — a secret is never sent.
   */
  secrets: { main_set: boolean; test_set: boolean }
  webhooks: AdminWebhook[]
}
