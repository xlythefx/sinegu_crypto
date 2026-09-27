/** Pure helpers for the admin dashboard's Strategies tab — no React.
 *  Everything is BEFORE fees, like lib/strategyStats.ts it builds on. */

import {
  computeStrategyStats,
  groupTradesByStrategy,
  parseTradeDate,
  tradePnl,
  type StrategyStats,
  type StrategyTrade,
} from './strategyStats'

export type StrategyPeriod = 'all' | '365' | '90' | '30' | '7'

export const PERIODS: { key: StrategyPeriod; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '365', label: '12 months' },
  { key: '90', label: '90 days' },
  { key: '30', label: '30 days' },
  { key: '7', label: '7 days' },
]

/** 'YYYY-MM-DD' the period starts on (UTC), or undefined for all time. */
export function periodStart(period: StrategyPeriod, now: Date = new Date()): string | undefined {
  if (period === 'all') return undefined
  const d = new Date(now.getTime() - Number(period) * 86_400_000)
  return d.toISOString().slice(0, 10)
}

export function tradesSince(trades: StrategyTrade[], from?: string): StrategyTrade[] {
  if (!from) return trades
  return trades.filter((t) => t.closed_at.slice(0, 10) >= from)
}

export interface LeaderboardRow extends StrategyStats {
  /** Average P&L per closed trade — what one more trade is worth. */
  expectancy: number
  /** P&L this calendar month. */
  thisMonth: number
  /** Average P&L of the earlier months it traded in (null with no history). */
  avgMonth: number | null
  /** Up / flat / down: this month against its usual month. */
  form: 'up' | 'down' | 'flat' | null
  lastTradeAt: string | null
  exchanges: string[]
}

function monthKey(raw: string): string | null {
  const d = parseTradeDate(raw)
  return d ? d.toISOString().slice(0, 7) : null
}

/**
 * One row per strategy, best total first. `form` compares this month with
 * the average of the months before it, so a strategy that is quietly
 * getting worse shows before its all-time total does.
 */
export function buildLeaderboard(trades: StrategyTrade[], now: Date = new Date()): LeaderboardRow[] {
  const current = now.toISOString().slice(0, 7)
  const rows: LeaderboardRow[] = []

  for (const [key, list] of groupTradesByStrategy(trades)) {
    const stats = computeStrategyStats(key, list, new Set())
    const byMonth = new Map<string, number>()
    for (const t of list) {
      const m = monthKey(t.closed_at)
      if (m) byMonth.set(m, (byMonth.get(m) ?? 0) + tradePnl(t))
    }
    const thisMonth = byMonth.get(current) ?? 0
    const earlier = [...byMonth.entries()].filter(([m]) => m < current).map(([, v]) => v)
    const avgMonth = earlier.length ? earlier.reduce((s, v) => s + v, 0) / earlier.length : null
    let form: LeaderboardRow['form'] = null
    if (avgMonth !== null && byMonth.has(current)) {
      const band = Math.max(Math.abs(avgMonth) * 0.1, 1)
      form = thisMonth > avgMonth + band ? 'up' : thisMonth < avgMonth - band ? 'down' : 'flat'
    }

    rows.push({
      ...stats,
      expectancy: stats.totalTrades ? stats.totalPnl / stats.totalTrades : 0,
      thisMonth,
      avgMonth,
      form,
      lastTradeAt: list.length ? list[list.length - 1].closed_at : null,
      exchanges: [...new Set(list.map((t) => t.exchange).filter((e): e is string => !!e))].sort(),
    })
  }

  return rows.sort((a, b) => b.totalPnl - a.totalPnl)
}

export interface ExchangeSplit {
  exchange: string
  trades: number
  winrate: number
  totalPnl: number
  profitFactor: number | null
}

/** The same strategy's result on each exchange it traded on. */
export function splitByExchange(trades: StrategyTrade[]): ExchangeSplit[] {
  const groups = new Map<string, StrategyTrade[]>()
  for (const t of trades) {
    const ex = t.exchange ?? 'binance'
    const list = groups.get(ex)
    if (list) list.push(t)
    else groups.set(ex, [t])
  }
  return [...groups.entries()]
    .map(([exchange, list]) => {
      const s = computeStrategyStats(exchange, list, new Set())
      return {
        exchange,
        trades: s.totalTrades,
        winrate: s.winrate,
        totalPnl: s.totalPnl,
        profitFactor: s.profitFactor,
      }
    })
    .sort((a, b) => b.totalPnl - a.totalPnl)
}
