import type { ExchangeKind } from './exchanges'
import type { TradeAction, TradeKindWord, TradeSideWord } from './tradeLogs'

/** Which feed's signal reached us first; `tie` = within 0.1 s. */
export type FeedLead = 'main' | 'test' | 'tie'

/**
 * What the side's account did with the signal. `absent` = the account was not
 * in the fan-out at all; `rejected` = the engine refused the whole signal.
 */
export type FeedSideOutcome = 'filled' | 'skipped' | 'failed' | 'rejected' | 'absent' | 'unknown'

/** One feed's half of a comparison row — the signal and its account's fill. */
export interface FeedSide {
  /** The Signal Log row (trade_logs id). */
  id: number
  /** When the signal reached us, to the millisecond (to the second before 26 Oct 2026). */
  receivedAt: string
  /** When the provider says it fired; null when its payload carries no `sent_at`. */
  sentAt: string | null
  /** receivedAt − sentAt. */
  transitMs: number | null
  strategy: string | null
  /** The MASTER on the main feed, the tester that filled on the test feed. */
  account: string | null
  outcome: FeedSideOutcome
  reason: string | null
  fillPrice: number | null
  /** The account trades on a testnet; null when unknown. */
  demo: boolean | null
}

/** A signal both feeds sent (`pair`), or one only one of them sent. */
export interface FeedCompareRow {
  kind: 'pair' | 'main_only' | 'test_only'
  exchange: ExchangeKind
  ticker: string
  action: TradeAction
  side: TradeSideWord
  type: TradeKindWord
  /** The first arrival. */
  at: string
  /** test − main arrival; positive = TradingView was first. Pairs only. */
  gapMs: number | null
  first: FeedLead | null
  /** (test − main) / main, in percent. */
  priceDiffPct: number | null
  betterPrice: 'main' | 'test' | 'same' | null
  /** Both sides filled on real money — only then is the price gap meaningful. */
  pricesComparable: boolean
  main: FeedSide | null
  test: FeedSide | null
}

export interface FeedCompareSummary {
  pairs: number
  mainFirst: number
  testFirst: number
  ties: number
  /** Signed like `gapMs`. */
  avgGapMs: number | null
  medianGapMs: number | null
  worst: { gapMs: number; ticker: string; action: TradeAction; at: string } | null
  mainOnly: number
  testOnly: number
  /** Signals on coins only one feed sends in the window — counted, not listed. */
  notCompared: { main: number; test: number }
  /** How long each feed's signals were on the way, over pairs that carried a fire time. */
  avgTransitMs: { main: number | null; test: number | null }
  prices: { compared: number; mainBetter: number; testBetter: number; same: number; demo: number }
}

export interface FeedCompareData {
  /** How far apart two arrivals may be and still be one signal. */
  matchSeconds: number
  /** The dates read; `to` null = up to now. */
  window: { from: string; to: string | null }
  summary: FeedCompareSummary
  rows: FeedCompareRow[]
}
