import { apiFetch } from './api'
import type { TrackRecord } from '../types/publicStats'

/**
 * The master account's verified track record — daily percentage returns and the
 * headline stats behind the landing page's "See every trade, verified" section.
 *
 * Unauthenticated (no `auth: true`): it is the marketing site's only API call,
 * and the backend caches it for 5 minutes.
 */
export async function getTrackRecord(): Promise<TrackRecord> {
  const res = await apiFetch<{ success: boolean } & TrackRecord>(
    '/public/track-record',
  )
  return {
    available: res.available,
    stats: res.stats,
    // PHP serializes an empty list as [] either way, but guard the shape.
    series: Array.isArray(res.series) ? res.series : [],
  }
}
