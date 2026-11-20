import { fmtSignedPct } from './format'

/**
 * What a Daily P&L Calendar cell prints and how strongly it is tinted —
 * shared by the trader's calendar and the admin one, so the $ / % switch
 * reads the same on both.
 */

/** Tint (background alpha) at or above which tone-coloured text stops being
 *  readable on the cell, so the figures switch to the theme's text colour. */
export const STRONG_TINT = 0.5

/** "+$42" / "−$9" — whole dollars; a cell has no room for cents. */
export function cellAmount(pnl: number): string {
  if (pnl === 0) return '—'
  return `${pnl > 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(0)}`
}

/** The figure the switch asked for leads; the other sits under it. A day with
 *  no capital on record has no % and keeps its $ alone, in either mode. */
export function cellFigures(
  pnl: number,
  pct: number | null,
  showPct: boolean,
  pctDp: number,
): { lead: string; second: string | null } {
  if (pnl === 0) return { lead: '—', second: null }
  if (pct === null) return { lead: cellAmount(pnl), second: null }
  return showPct
    ? { lead: fmtSignedPct(pct, pctDp), second: cellAmount(pnl) }
    : { lead: cellAmount(pnl), second: fmtSignedPct(pct, pctDp) }
}

interface TintDay {
  total: number
  pct: number | null
}

/**
 * Background alpha for every day, scaled by the biggest move in view. In %
 * mode the tint measures the percentage, so a big day after a withdrawal reads
 * as big; a day with no capital on record keeps its $ tint. 0 = no tint.
 */
export function cellTints(days: (TintDay | null)[], showPct: boolean): number[] {
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d?.total ?? 0)))
  const maxPct = Math.max(0.01, ...days.map((d) => Math.abs(d?.pct ?? 0)))
  return days.map((d) => {
    if (!d || d.total === 0) return 0
    const ratio =
      showPct && d.pct !== null ? Math.abs(d.pct) / maxPct : Math.abs(d.total) / maxAbs
    return 0.16 + Math.min(0.6, ratio * 0.6)
  })
}

/** The cell's background for a tint: green for a gain, red for a loss. */
export function tintBackground(pnl: number, tint: number): string | undefined {
  if (pnl === 0 || tint === 0) return undefined
  return pnl > 0
    ? `rgba(47, 214, 122, ${tint.toFixed(3)})`
    : `rgba(255, 90, 90, ${tint.toFixed(3)})`
}
