/** GET /admin/insights/vs-master — Customers vs master (2026-11-23). */

/** One owner's result over the window (UTC days, after fees first). */
export interface VsMasterFigures {
  /** After fees. */
  pnl: number
  pnl_gross: number
  fees: number
  /** Each day's P&L over the capital that day started with, the days added up. Null = a day had no capital on record. */
  pct: number | null
  trades: number
  wins: number
  win_rate: number | null
  best_day: number | null
  worst_day: number | null
}

export interface VsMasterRow extends VsMasterFigures {
  rank: number
  uni_id: string
  name: string
  exchanges: string[]
  /** False when every account of theirs is disconnected. */
  connected: boolean
  balance: number | null
  /** Their return minus the master's, in percentage points. */
  gap: number | null
  /** Null when either return is unknown. */
  gap_parts: VsGapParts | null
  /** Master closes they also closed (same coin + side, ≤ 15 min). */
  followed: number
  missed: number
  /** Master closes that happened while they had an account on that exchange. */
  master_closes: number
  /** Their closes with no master partner. */
  extra: number
  days_ahead: number
  days_behind: number
}

export interface VsMasterData {
  from: string
  to: string
  exchange: string | null
  master: (VsMasterFigures & { balance: number }) | null
  customers: VsMasterRow[]
}

/**
 * Where a customer's gap to the master comes from, in percentage points —
 * the parts add up to `gap` (give or take the daily rounding).
 */
export interface VsGapParts {
  /** On the trades both took: their result minus the master's. */
  same: number
  /** Minus the master's result on trades they could have taken and did not. */
  missed: number
  /** Their own closes with no master partner. */
  extra: number
  /** Minus the master's result while they had no account there yet. */
  before: number
}

/** GET /admin/insights/vs-master/{uniId} — both sides' daily %, for the head-to-head chart. */
export interface VsDay {
  date: string
  pct: number | null
  pnl: number
  trades: number
}

export interface VsHeadToHead {
  uni_id: string
  name: string
  from: string
  to: string
  master: VsDay[]
  customer: VsDay[]
}
