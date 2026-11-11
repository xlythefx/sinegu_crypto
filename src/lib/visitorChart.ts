/**
 * Pure helpers for Admin → Visitors' bar chart (no React).
 *
 * 2026-11-11 (Dima: "this one not make sense"): the chart had no scale, so a
 * short bar beside a tall one carried no number; and visitor counting only
 * started on 28 Oct, so a period reaching back before it drew sign-ups over
 * empty days. These give it a readable scale and start it where counting began.
 */

export interface VisitorBucket {
  start: string
  visitors: number
  views: number
  signups: number
}

/**
 * A "nice" axis for a maximum: steps of 1, 2 or 5 × 10^n, at most four of them
 * above zero, and a top that is a whole number of steps at or above `max`.
 */
export function niceScale(max: number): { top: number; ticks: number[] } {
  const target = Math.max(1, max)
  let step = 1
  for (let magnitude = 1; ; magnitude *= 10) {
    const found = [1, 2, 5].map((m) => m * magnitude).find((s) => Math.ceil(target / s) <= 4)
    if (found !== undefined) {
      step = found
      break
    }
  }
  const top = Math.ceil(target / step) * step
  const ticks: number[] = []
  for (let t = 0; t <= top; t += step) ticks.push(t)
  return { top, ticks }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Drop the buckets that END before counting began (`since`, YYYY-MM-DD): they
 * could only ever be empty bars with sign-ups floating over them. A week that
 * contains `since` stays. Null `since` (nothing counted yet) keeps everything.
 */
export function fromTrackingStart(
  series: VisitorBucket[],
  since: string | null,
  bucket: 'day' | 'week',
): { series: VisitorBucket[]; trimmed: boolean } {
  if (!since) return { series, trimmed: false }
  const sinceMs = Date.parse(`${since.slice(0, 10)}T00:00:00Z`)
  const span = bucket === 'week' ? 7 * DAY_MS : DAY_MS
  const kept = series.filter((b) => Date.parse(`${b.start.slice(0, 10)}T00:00:00Z`) + span > sinceMs)
  return { series: kept, trimmed: kept.length < series.length }
}
