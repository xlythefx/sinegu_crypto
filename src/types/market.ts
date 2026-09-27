/**
 * Types for `GET /api/public/market-ticker` — the landing page's quote strip.
 *
 * This is Binance's OWN market data for the USDⓈ-M perpetuals the product
 * trades, proxied and cached by the API. Nothing here is ours, so the
 * percentages-and-counts-only rule that governs the track record does not
 * apply — but the empty-vs-unavailable one does: a quote the API could not
 * read is absent from the list, never a price of zero.
 */

/** One pair's line in the strip. */
export interface MarketQuote {
  /** Canonical exchange symbol, e.g. `LTCUSDT`. */
  symbol: string
  /** What the strip prints — `LTC/USDT`. The quote asset is named, not
   *  assumed to be dollars: a USDT perpetual is what these prices quote. */
  label: string
  price: number
  /** 24h move in percent. Null when the API had a price but no change — a
   *  missing change is not a flat one, so the strip prints nothing. */
  change_pct: number | null
}

/** The traded pair's funding rate and when it is next charged. */
export interface MarketFunding {
  symbol: string
  label: string
  /** Already a percent (Binance reports a fraction; the API multiplies). */
  rate_pct: number
  /** ISO-8601 Zulu, or null when the venue did not name the next charge. */
  next_at: string | null
}

/**
 * `available: false` with no quotes means every upstream read failed and
 * nothing good was cached — the strip renders the rest of its items rather
 * than zeros. `updated_at` is how stale the payload is: on a failed fetch the
 * API serves the last good one WITHOUT restamping it.
 */
export interface MarketTicker {
  available: boolean
  quotes: MarketQuote[]
  funding: MarketFunding | null
  updated_at: string
}

/** One price level as the exchange publishes it: `[price, size]`. */
export type BookLevel = [number, number]

/**
 * `GET /api/public/order-book` — the landing hero's live book.
 *
 * Levels arrive RAW (100 a side) and are bucketed on the client, because how a
 * book is grouped is a display choice: five consecutive BTCUSDT levels span
 * about forty cents, which is true and unreadable as a ladder. `lib/orderBook`
 * owns that derivation.
 */
export interface OrderBook {
  available: boolean
  symbol: string
  /** What the card prints — `BTC-PERP`. Server-configured. */
  label: string
  bids: BookLevel[]
  asks: BookLevel[]
  /** Last traded price, 24h move and 24h quote volume. Null when that read
   *  failed — the card drops those lines and still draws the book. */
  price: number | null
  change_pct: number | null
  quote_volume: number | null
  /** The EXCHANGE's own stamp for this book, which is what the live dot
   *  answers to. Null when the venue sent none. */
  book_at: string | null
  updated_at: string
}
