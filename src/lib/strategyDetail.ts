/** In-depth per-strategy analytics — pure, no React. Builds on strategyStats.ts
 *  with the richer metrics the strategy DETAIL page needs (streaks, best/worst,
 *  expectancy, per-asset, and seasonality breakdowns). */

import type { PastPosition } from '../types/dashboard'
import {
  computeStrategyStats,
  tradePnl,
  type StrategyStats,
  type StrategyTrade,
} from './strategyStats'

export interface AssetBreakdown {
  ticker: string
  trades: number
  wins: number
  losses: number
  winrate: number
  totalPnl: number
  /** null = no losing trades yet ("∞"). */
  profitFactor: number | null
}

export interface DowBucket {
  /** 0 = Sunday … 6 = Saturday (JS getDay). */
  day: number
  pnl: number
  trades: number
  wins: number
  losses: number
}

export interface MonthBucket {
  /** "YYYY-MM" */
  ym: string
  pnl: number
  trades: number
}

export interface StrategyDetail extends StrategyStats {
  bestTrade: number
  worstTrade: number
  maxWinStreak: number
  maxLossStreak: number
  /** Average P&L per trade. */
  expectancy: number
  byAsset: AssetBreakdown[]
  /** 7 buckets, index 0 = Sunday … 6 = Saturday. */
  byDayOfWeek: DowBucket[]
  byMonth: MonthBucket[]
}

/** Parse a MySQL datetime ("2026-06-11 14:30:00") into a Date safely. */
function parseClosedAt(closedAt: string): Date {
  return new Date(closedAt.replace(' ', 'T'))
}

/**
 * Map the user's raw closed positions to StrategyTrade rows, bucketing a
 * null/empty strategy tag as "Manual", sorted ascending by close date so the
 * cumulative equity curve reads left→right.
 */
export function pastPositionsToStrategyTrades(
  rows: PastPosition[],
): StrategyTrade[] {
  return rows
    .map((r) => ({
      strategy: (r.strategy ?? '').trim() || 'Manual',
      symbol: r.symbol,
      realized_pnl: r.realized_pnl ?? 0,
      exchange_fee: r.exchange_fee,
      closed_at: r.closed_at,
    }))
    .sort((a, b) => a.closed_at.localeCompare(b.closed_at))
}

/**
 * Full detail stats for one strategy. `allTrades` should already be this
 * strategy's trades (ascending). Excluded tickers are dropped from every
 * metric, mirroring computeStrategyStats.
 */
export function computeStrategyDetail(
  key: string,
  allTrades: StrategyTrade[],
  excluded: Set<string>,
): StrategyDetail {
  const base = computeStrategyStats(key, allTrades, excluded)

  const trades = excluded.size
    ? allTrades.filter((t) => !excluded.has(t.symbol.trim()))
    : allTrades

  let bestTrade = 0
  let worstTrade = 0
  let curWin = 0
  let curLoss = 0
  let maxWinStreak = 0
  let maxLossStreak = 0

  interface AssetAcc {
    trades: number
    wins: number
    losses: number
    grossWin: number
    grossLoss: number
    totalPnl: number
  }
  const assetMap = new Map<string, AssetAcc>()
  const dow: DowBucket[] = Array.from({ length: 7 }, (_, day) => ({
    day,
    pnl: 0,
    trades: 0,
    wins: 0,
    losses: 0,
  }))
  const monthMap = new Map<string, MonthBucket>()

  for (const t of trades) {
    const pnl = tradePnl(t)
    const win = pnl >= 0
    bestTrade = Math.max(bestTrade, pnl)
    worstTrade = Math.min(worstTrade, pnl)

    if (win) {
      curWin += 1
      curLoss = 0
      maxWinStreak = Math.max(maxWinStreak, curWin)
    } else {
      curLoss += 1
      curWin = 0
      maxLossStreak = Math.max(maxLossStreak, curLoss)
    }

    // per-asset
    const ticker = t.symbol.trim()
    const acc =
      assetMap.get(ticker) ??
      { trades: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0, totalPnl: 0 }
    acc.trades += 1
    acc.totalPnl += pnl
    if (win) {
      acc.wins += 1
      acc.grossWin += pnl
    } else {
      acc.losses += 1
      acc.grossLoss += Math.abs(pnl)
    }
    assetMap.set(ticker, acc)

    // seasonality
    const d = parseClosedAt(t.closed_at)
    if (!Number.isNaN(d.getTime())) {
      const b = dow[d.getDay()]
      b.pnl += pnl
      b.trades += 1
      if (win) b.wins += 1
      else b.losses += 1
    }
    const ym = t.closed_at.slice(0, 7)
    const m = monthMap.get(ym) ?? { ym, pnl: 0, trades: 0 }
    m.pnl += pnl
    m.trades += 1
    monthMap.set(ym, m)
  }

  const byAsset: AssetBreakdown[] = Array.from(assetMap.entries())
    .map(([ticker, a]) => ({
      ticker,
      trades: a.trades,
      wins: a.wins,
      losses: a.losses,
      winrate: a.trades > 0 ? (a.wins / a.trades) * 100 : 0,
      totalPnl: a.totalPnl,
      profitFactor: a.grossLoss > 0 ? a.grossWin / a.grossLoss : null,
    }))
    .sort((x, y) => y.totalPnl - x.totalPnl)

  const byMonth = Array.from(monthMap.values()).sort((a, b) =>
    a.ym.localeCompare(b.ym),
  )

  return {
    ...base,
    bestTrade,
    worstTrade,
    maxWinStreak,
    maxLossStreak,
    expectancy: base.totalTrades > 0 ? base.totalPnl / base.totalTrades : 0,
    byAsset,
    byDayOfWeek: dow,
    byMonth,
  }
}
