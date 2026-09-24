import { apiFetch } from './api'
import type { MarketTicker } from '../types/market'

/**
 * How often the landing strip re-reads the quotes. The API caches its upstream
 * read for 30s, so anything faster only costs a round trip to our own box.
 */
export const MARKET_REFRESH_MS = 30_000

/**
 * Live prices for the pairs the product trades, plus the traded pair's funding
 * rate — `GET /api/public/market-ticker`.
 *
 * Unauthenticated, like the track record. It is proxied through our API rather
 * than called from the browser on purpose: Binance geo-blocks some regions and
 * ad-blockers eat a direct request, so a browser-side call would leave the
 * strip blank for a slice of visitors and we would never hear about it.
 */
export async function getMarketTicker(): Promise<MarketTicker> {
  const res = await apiFetch<MarketTicker>('/public/market-ticker')

  return {
    available: Boolean(res.available),
    // Guard the shape: an absent list means "nothing to show", never a crash
    // on the marketing page.
    quotes: Array.isArray(res.quotes) ? res.quotes : [],
    funding: res.funding ?? null,
    updated_at: res.updated_at,
  }
}
