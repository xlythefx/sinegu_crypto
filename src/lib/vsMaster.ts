/**
 * Customers vs master — the page's pure helpers (sorting, the "show" filter,
 * the summary tiles). The API ranks and measures; nothing here recomputes a
 * return, it only reads the rows it was handed. No React.
 */
import type { VsGapParts, VsHeadToHead, VsMasterData, VsMasterRow } from '../types/vsMaster'

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

/* ---------------------------------------------------------------- why behind */

export type GapPart = keyof VsGapParts

export const GAP_PART_LABELS: Record<GapPart, string> = {
  same: 'Same trades',
  missed: 'Missed master trades',
  extra: 'Own extra closes',
  before: 'Before they joined',
}

/**
 * The part that moved a customer most: the most negative one when they are
 * behind the master, the most positive when ahead. Null when no part moved.
 */
export function mainReason(row: VsMasterRow): { part: GapPart; value: number } | null {
  if (!row.gap_parts || row.gap === null) return null
  const entries = Object.entries(row.gap_parts) as [GapPart, number][]
  const pick = entries.sort((a, b) => (row.gap! < 0 ? a[1] - b[1] : b[1] - a[1]))[0]
  if (!pick || pick[1] === 0 || (row.gap < 0 ? pick[1] > 0 : pick[1] < 0)) return null
  return { part: pick[0], value: pick[1] }
}

/* --------------------------------------------------------------- leaderboard */

export type LeaderBy = 'pnl' | 'pct'

export interface LeaderEntry {
  key: string
  name: string
  isMaster: boolean
  /** 1-based among customers; null for the master, who is pinned on top. */
  place: number | null
  pnl: number
  pnlGross: number
  pct: number | null
  trades: number
  uniId: string | null
}

/**
 * The P&L leaderboard: the master pinned first (the benchmark), then every
 * customer best first — by dollars after fees, or by return.
 */
export function leaderboard(
  rows: VsMasterRow[],
  master: VsMasterData['master'],
  by: LeaderBy,
): LeaderEntry[] {
  const score = (r: VsMasterRow) => (by === 'pnl' ? r.pnl : (r.pct ?? Number.NEGATIVE_INFINITY))
  const customers = [...rows]
    .sort((a, b) => score(b) - score(a) || b.pnl - a.pnl)
    .map((r, i) => ({
      key: r.uni_id,
      name: r.name,
      isMaster: false,
      place: i + 1,
      pnl: r.pnl,
      pnlGross: r.pnl_gross,
      pct: r.pct,
      trades: r.trades,
      uniId: r.uni_id,
    }))
  if (!master) return customers
  return [
    {
      key: 'master',
      name: 'Master',
      isMaster: true,
      place: null,
      pnl: master.pnl,
      pnlGross: master.pnl_gross,
      pct: master.pct,
      trades: master.trades,
      uniId: null,
    },
    ...customers,
  ]
}

/* ------------------------------------------------------------- head to head */

export interface DuelPoint {
  date: string
  /** Running total of the daily %, from the window's start. */
  master: number
  customer: number
}

/**
 * Both sides' running return over every day either of them traded — the
 * daily % added up, the same way the page's Return is. A day one side did
 * not trade adds 0 for it.
 */
export function duelSeries(h: Pick<VsHeadToHead, 'master' | 'customer'>): DuelPoint[] {
  const m = new Map(h.master.map((d) => [d.date, d.pct ?? 0]))
  const c = new Map(h.customer.map((d) => [d.date, d.pct ?? 0]))
  const dates = [...new Set([...m.keys(), ...c.keys()])].sort()
  let mt = 0
  let ct = 0
  return dates.map((date) => {
    mt += m.get(date) ?? 0
    ct += c.get(date) ?? 0
    return { date, master: Math.round(mt * 100) / 100, customer: Math.round(ct * 100) / 100 }
  })
}
