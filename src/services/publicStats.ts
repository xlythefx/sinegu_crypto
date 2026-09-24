import { apiFetch } from './api'
import { LANDING_TRACK_RECORD_SYMBOLS } from '../lib/trackRecord'
import type { TrackRecord } from '../types/publicStats'

/**
 * The master account's verified track record — daily percentage returns and the
 * headline stats behind the landing page's "See every trade, verified" section.
 *
 * Unauthenticated (no `auth: true`): it is the marketing site's only API call,
 * and the backend caches it for 5 minutes (per filter).
 *
 * `symbols` narrows the record to those tickers' trades — the API strips venue
 * punctuation, so `LTCUSDT` also matches MEXC's `LTC_USDT`. The capital base
 * stays the whole account's. Omit it for every trade.
 */
export async function getTrackRecord(symbols: readonly string[] = []): Promise<TrackRecord> {
  const query = symbols.length ? `?symbols=${encodeURIComponent(symbols.join(','))}` : ''
  const res = await apiFetch<{ success: boolean } & TrackRecord>(
    `/public/track-record${query}`,
  )
  return {
    available: res.available,
    stats: res.stats,
    // PHP serializes an empty list as [] either way, but guard the shape.
    series: Array.isArray(res.series) ? res.series : [],
    symbols: Array.isArray(res.symbols) ? res.symbols : [],
  }
}

/**
 * The record the landing page publishes, narrowed to the strategy it is sold
 * on. Fetched ONCE per page and handed to both the quote strip and the
 * track-record section: the filter is part of what the number means, so two
 * independent calls would be two sets of arguments and could put two different
 * returns on one page. Module-level so it is a stable `useApiData` fetcher.
 */
export const fetchLandingTrackRecord = (): Promise<TrackRecord> =>
  getTrackRecord(LANDING_TRACK_RECORD_SYMBOLS)
