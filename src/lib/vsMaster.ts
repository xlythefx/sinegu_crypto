/**
 * Customers vs master — the page's pure helpers (sorting, the "show" filter,
 * the summary tiles). The API ranks and measures; nothing here recomputes a
 * return, it only reads the rows it was handed. No React.
 */
import type { VsMasterRow } from '../types/vsMaster'

export type VsSortKey = 'rank' | 'name' | 'gap' | 'pnl' | 'trades' | 'win_rate' | 'followed' | 'days' | 'balance'
export type VsShow = 'all' | 'ahead' | 'behind' | 'missed'

/** Share of the master's closes a customer also took, 0–100; null with none to take. */
export function followRate(r: VsMasterRow): number | null {
  return r.master_closes > 0 ? (r.followed / r.master_closes) * 100 : null
}

export function showRow(r: VsMasterRow, show: VsShow): boolean {
  switch (show) {
    case 'ahead':
      return r.gap !== null && r.gap >= 0
    case 'behind':
      return r.gap !== null && r.gap < 0
    case 'missed':
      return r.missed > 0
    default:
      return true
  }
}

const sortValue = (r: VsMasterRow, key: VsSortKey): number | string | null => {
  switch (key) {
    case 'name':
      return r.name.toLowerCase()
    case 'gap':
      return r.gap
    case 'pnl':
      return r.pnl
    case 'trades':
      return r.trades
    case 'win_rate':
      return r.win_rate
    case 'followed':
      return followRate(r)
    case 'days':
      return r.days_ahead + r.days_behind > 0 ? r.days_ahead / (r.days_ahead + r.days_behind) : null
    case 'balance':
      return r.balance
    default:
      return r.rank
  }
}

/** Sorted copy; a missing value always sorts last, whatever the direction. */
export function sortRows(rows: VsMasterRow[], key: VsSortKey, dir: 'asc' | 'desc'): VsMasterRow[] {
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    if (va === null && vb === null) return a.rank - b.rank
    if (va === null) return 1
    if (vb === null) return -1
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return (dir === 'asc' ? cmp : -cmp) || a.rank - b.rank
  })
}

export interface VsSummary {
  /** Customers with a comparable return. */
  compared: number
  ahead: number
  behind: number
  avgGap: number | null
  medianGap: number | null
  /** Σ followed ÷ Σ master closes they could have taken, 0–100. */
  followRate: number | null
  missed: number
  best: VsMasterRow | null
  worst: VsMasterRow | null
}

export function summarize(rows: VsMasterRow[]): VsSummary {
  const withGap = rows.filter((r) => r.gap !== null)
  const gaps = withGap.map((r) => r.gap as number).sort((a, b) => a - b)
  const mid = gaps.length >> 1
  const median = gaps.length === 0 ? null : gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2
  const closes = rows.reduce((s, r) => s + r.master_closes, 0)
  const followed = rows.reduce((s, r) => s + r.followed, 0)
  const byGap = [...withGap].sort((a, b) => (b.gap as number) - (a.gap as number))
  return {
    compared: withGap.length,
    ahead: withGap.filter((r) => (r.gap as number) >= 0).length,
    behind: withGap.filter((r) => (r.gap as number) < 0).length,
    avgGap: gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null,
    medianGap: median,
    followRate: closes > 0 ? (followed / closes) * 100 : null,
    missed: rows.reduce((s, r) => s + r.missed, 0),
    best: byGap[0] ?? null,
    worst: byGap.length > 1 ? byGap[byGap.length - 1] : null,
  }
}

/** "+1.20 pp" / "−0.35 pp" — a gap between two returns, never a return itself. */
export function fmtGap(gap: number, dp = 2): string {
  const sign = gap < 0 ? '−' : '+'
  return `${sign}${Math.abs(gap).toFixed(dp)} pp`
}
