/** Pure admin-positions statistics — no React. Computes portfolio-wide
 *  performance across EVERY account's open positions + closed trades,
 *  mirroring the per-user Positions analytics but at the admin altitude. */

import type { AdminOpenPosition, AdminPastTrade } from '../types/admin'
import { parseTradeDate } from './strategyStats'

export interface AdminPositionMetrics {
  totalTrades: number
  wins: number
  losses: number
  /** null when there are no closed trades yet. */
  winRate: number | null
  grossWin: number
  grossLoss: number
  netPnl: number
  /** null when there are no losing trades ("∞"). */
  profitFactor: number | null
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  /** avg win ÷ avg loss; null when no losses yet. */
  avgRr: number | null
  /** expected P&L per trade; null when no trades. */
  expectancy: number | null
  /** peak-to-trough of cumulative realized P&L, in dollars. */
  maxDrawdown: number
  /** the same drawdown as a % of total equity across accounts. */
  maxDrawdownPct: number
  realized: number
  unrealized: number
  totalPnl: number
  /** distinct accounts currently holding an open position. */
  activeAccounts: number
  /** distinct accounts that have at least one closed trade. */
  tradingAccounts: number
  /** sum of each distinct account's balance — the % base. */
  equityBase: number
}

/** Everything the admin analytics grid + P&L overview needs, in one pass. */
export function computeAdminPositionMetrics(
  positions: AdminOpenPosition[],
  trades: AdminPastTrade[],
): AdminPositionMetrics {
  // total equity = sum of each distinct account's balance (the % base)
  const balanceByAccount = new Map<number, number>()
  for (const r of [...positions, ...trades]) {
    if (r.account_id != null) balanceByAccount.set(r.account_id, r.account_balance)
  }
  const equityBase = Array.from(balanceByAccount.values()).reduce((s, v) => s + v, 0)

  // ascending close date so the equity curve / drawdown is chronological
  const sorted = [...trades].sort(
    (a, b) =>
      (parseTradeDate(a.closed_at)?.getTime() ?? 0) -
      (parseTradeDate(b.closed_at)?.getTime() ?? 0),
  )

  let cumulative = 0
  let peak = 0
  let maxDrawdown = 0
  const winPnls: number[] = []
  const lossPnls: number[] = []

  for (const t of sorted) {
    const pnl = t.realized_pnl
    cumulative += pnl
    peak = Math.max(peak, cumulative)
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative)
    if (pnl >= 0) winPnls.push(pnl)
    else lossPnls.push(Math.abs(pnl))
  }

  const totalTrades = sorted.length
  const grossWin = winPnls.reduce((s, v) => s + v, 0)
  const grossLoss = lossPnls.reduce((s, v) => s + v, 0)
  const avgWin = winPnls.length ? grossWin / winPnls.length : 0
  const avgLoss = lossPnls.length ? grossLoss / lossPnls.length : 0
  const winFrac = totalTrades ? winPnls.length / totalTrades : 0

  const realized = trades.reduce((s, t) => s + t.realized_pnl, 0)
  const unrealized = positions.reduce((s, p) => s + p.unrealized_pnl, 0)

  return {
    totalTrades,
    wins: winPnls.length,
    losses: lossPnls.length,
    winRate: totalTrades ? winFrac * 100 : null,
    grossWin,
    grossLoss,
    netPnl: grossWin - grossLoss,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgWin,
    avgLoss,
    largestWin: winPnls.length ? Math.max(...winPnls) : 0,
    largestLoss: lossPnls.length ? Math.max(...lossPnls) : 0,
    avgRr: avgLoss > 0 ? avgWin / avgLoss : null,
    expectancy: totalTrades ? winFrac * avgWin - (1 - winFrac) * avgLoss : null,
    maxDrawdown,
    maxDrawdownPct: equityBase > 0 ? (maxDrawdown / equityBase) * 100 : 0,
    realized,
    unrealized,
    totalPnl: realized + unrealized,
    activeAccounts: new Set(positions.map((p) => p.account_id)).size,
    tradingAccounts: new Set(trades.map((t) => t.account_id)).size,
    equityBase,
  }
}
