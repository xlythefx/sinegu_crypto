/** Pure formatting helpers — no React. */

/** "2025-03-14T09:21:00Z" → "March 14, 2025" (falls back to the raw string). */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** "12,822.73" */
export function fmtNum(n: number, dp = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })
}

/**
 * Thousands-grouped quantity, "1,000.000" style — comma thousands, dot decimal.
 * Trailing zeros beyond `minDp` are trimmed up to `maxDp` (so 0.000001 keeps its
 * precision while 1000 reads as "1,000.000"). Defaults to a fixed 3 decimals.
 */
export function fmtQty(n: number, minDp = 3, maxDp = 6): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: minDp,
    maximumFractionDigits: Math.max(minDp, maxDp),
  })
}

/** "$12,822.73" (absolute value). */
export function fmtMoney(n: number, dp = 2): string {
  return `$${fmtNum(Math.abs(n), dp)}`
}

/** "+1,842.10" / "−112.40" (typographic minus, matching the design). */
export function fmtSigned(n: number, dp = 2): string {
  const sign = n < 0 ? '−' : '+'
  return `${sign}${fmtNum(Math.abs(n), dp)}`
}

/** "+$1,842.10" / "−$112.40" */
export function fmtSignedMoney(n: number, dp = 2): string {
  const sign = n < 0 ? '−' : '+'
  return `${sign}$${fmtNum(Math.abs(n), dp)}`
}

/** "+15.9%" of the given base ("—" when the base is not positive). */
export function fmtPctOf(n: number, base: number, dp = 1): string {
  if (base <= 0) return '—'
  const pct = (n / base) * 100
  const sign = pct < 0 ? '−' : '+'
  return `${sign}${Math.abs(pct).toFixed(dp)}%`
}

/** "+17.7%" / "−6.4%" from an already-computed percentage. */
export function fmtSignedPct(pct: number, dp = 1): string {
  const sign = pct < 0 ? '−' : '+'
  return `${sign}${Math.abs(pct).toFixed(dp)}%`
}

/** "Jul 12, 2026" from an ISO date or datetime (falls back to the raw string). */
export function fmtMediumDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Jul 21" from "2026-07-21". */
export function fmtShortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** "Jul '26" from "2026-07-21" (or "2026-07"). */
export function fmtShortMonth(iso: string): string {
  const date = new Date(`${iso.slice(0, 7)}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.toLocaleDateString('en-US', { month: 'short' })} '${iso.slice(2, 4)}`
}

/** "July 2026" from "2026-07-21" (or "2026-07"). */
export function fmtLongMonth(iso: string): string {
  const date = new Date(`${iso.slice(0, 7)}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Previous calendar month as 'YYYY-MM' — the period invoices bill for.
 * Sets the day to 1 before stepping back so the 31st cannot skip a month.
 */
export function prevMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * "Jul 21, 02:30 PM" from a MySQL datetime, in the READER's timezone.
 *
 * The API runs on `'timezone' => 'UTC'`, so every datetime it stores and returns
 * is UTC. A bare "2026-09-09 04:30:22" has no zone designator, though, and the
 * Date constructor reads a zoneless datetime as LOCAL — so the UTC digits were
 * being printed unchanged and labelled as the reader's own time. A trade the
 * exchange app showed at 11:30 read as 04:30 here, seven hours adrift, which
 * looked like the two systems disagreeing about which trade this even was.
 *
 * Appending the 'Z' is what converts rather than relabels. Only when the string
 * carries no zone of its own: an ISO timestamp that already ends in 'Z' or
 * carries a ±hh:mm offset is correct as it stands, and stamping a second zone
 * onto it would break the ones that are right.
 */
export function fmtDateTime(dt: string): string {
  const iso = dt.replace(' ', 'T')
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`
  const date = new Date(zoned)
  if (Number.isNaN(date.getTime())) return dt
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
