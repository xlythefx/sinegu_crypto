/** Pure strategy-statistics helpers — no React. Mirrors the mother
 *  dashboard's AdminStrategies math over closed trades. */

import { displaySymbol, seriesColor } from './chart'

export interface StrategyTrade {
  strategy: string
  symbol: string
  realized_pnl: number | string
  closed_at: string
}

/** Robustly parse a MySQL datetime / ISO string to a Date (null on failure). */
export function parseTradeDate(raw: string): Date | null {
  if (!raw) return null
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

export interface EquityPoint {
  index: number
  date: string
  cumulative: number
}

export interface StrategyStats {
  key: string
  totalTrades: number
  wins: number
  losses: number
  winrate: number
  totalPnl: number
  grossWin: number
  grossLoss: number
  /** null = no losing trades yet ("∞"). */
  profitFactor: number | null
  maxDrawdown: number
  sharpe: number
  avgWin: number
  avgLoss: number
  equitySeries: EquityPoint[]
  tickers: string[]
}

/** Group trades by their raw strategy tag (assumed pre-filtered non-empty). */
export function groupTradesByStrategy(
  trades: StrategyTrade[],
): Map<string, StrategyTrade[]> {
  const map = new Map<string, StrategyTrade[]>()
  for (const t of trades) {
    const key = t.strategy.trim()
    if (!key) continue
    const list = map.get(key)
    if (list) list.push(t)
    else map.set(key, [t])
  }
  return map
}

/**
 * Compute per-strategy performance from its trades (ascending close date),
 * optionally excluding tickers. `tickers` always reflects ALL trades so the
 * exclude chips stay visible while excluded.
 */
export function computeStrategyStats(
  key: string,
  allTrades: StrategyTrade[],
  excluded: Set<string>,
): StrategyStats {
  const tickers = Array.from(
    new Set(allTrades.map((t) => t.symbol.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))

  const trades = excluded.size
    ? allTrades.filter((t) => !excluded.has(t.symbol.trim()))
    : allTrades

  let cumulative = 0
  let peak = 0
  let maxDrawdown = 0
  const equitySeries: EquityPoint[] = []
  const winPnls: number[] = []
  const lossPnls: number[] = []
  const pnlValues: number[] = []

  trades.forEach((t, idx) => {
    const pnl = Number(t.realized_pnl) || 0
    pnlValues.push(pnl)
    cumulative += pnl
    equitySeries.push({ index: idx + 1, date: t.closed_at, cumulative })
    peak = Math.max(peak, cumulative)
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative)
    if (pnl >= 0) winPnls.push(pnl)
    else lossPnls.push(Math.abs(pnl))
  })

  const totalTrades = trades.length
  const grossWin = winPnls.reduce((s, v) => s + v, 0)
  const grossLoss = lossPnls.reduce((s, v) => s + v, 0)
  const mean = pnlValues.reduce((s, v) => s + v, 0) / (pnlValues.length || 1)
  const variance =
    pnlValues.reduce((s, v) => s + (v - mean) ** 2, 0) / (pnlValues.length || 1)
  const std = Math.sqrt(variance)

  return {
    key,
    totalTrades,
    wins: winPnls.length,
    losses: lossPnls.length,
    winrate: totalTrades > 0 ? (winPnls.length / totalTrades) * 100 : 0,
    totalPnl: cumulative,
    grossWin,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    maxDrawdown,
    sharpe: std > 0 ? mean / std : 0,
    avgWin: winPnls.length ? grossWin / winPnls.length : 0,
    avgLoss: lossPnls.length ? grossLoss / lossPnls.length : 0,
    equitySeries,
    tickers,
  }
}

/* ============================================================================
 * Deep detail stats — everything the strategy detail page renders, computed
 * client-side from the same closed-trade set (mirrors the mother's
 * AdminStrategyDetails math). All figures derive from `trades`.
 * ==========================================================================*/

export interface DetailTrade {
  symbol: string
  pnl: number
  closed_at: string
}

export interface AssetStat {
  ticker: string
  display: string
  color: string
  trades: number
  wins: number
  losses: number
  winrate: number
  totalPnl: number
  avgPnl: number
  profitFactor: number | null
}

export interface DowStat {
  label: string
  pnl: number
  trades: number
  wins: number
  losses: number
}

export interface MonthStat {
  label: string
  pnl: number
  trades: number
}

export interface ConcentrationItem {
  ticker: string
  display: string
  pnl: number
  pctAbs: number
}

export interface RollingPoint {
  index: number
  date: string
  winRate: number
  sharpe: number
}

export interface StrategyDetailStats {
  key: string
  totalTrades: number
  wins: number
  losses: number
  winrate: number
  totalPnl: number
  grossWin: number
  grossLoss: number
  profitFactor: number | null
  maxDrawdown: number
  sharpe: number
  avgWin: number
  avgLoss: number
  bestTrade: number
  worstTrade: number
  maxWinStreak: number
  maxLossStreak: number
  equitySeries: EquityPoint[]
  daily: Record<string, number>
  byAsset: AssetStat[]
  dayOfWeek: DowStat[]
  months: MonthStat[]
  concentration: ConcentrationItem[]
  top3Share: number
  rolling: RollingPoint[]
  tickers: string[]
  trades: DetailTrade[]
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const ROLL_WINDOW = 20

/** Rolling-window win-rate + Sharpe over the ascending trade sequence. */
function computeRolling(pnls: number[], dates: string[]): RollingPoint[] {
  if (pnls.length < ROLL_WINDOW) return []
  const out: RollingPoint[] = []
  for (let i = ROLL_WINDOW - 1; i < pnls.length; i++) {
    const window = pnls.slice(i - ROLL_WINDOW + 1, i + 1)
    const wins = window.filter((p) => p >= 0).length
    const mean = window.reduce((s, v) => s + v, 0) / ROLL_WINDOW
    const variance =
      window.reduce((s, v) => s + (v - mean) ** 2, 0) / ROLL_WINDOW
    const std = Math.sqrt(variance)
    out.push({
      index: i + 1,
      date: dates[i],
      winRate: Number(((wins / ROLL_WINDOW) * 100).toFixed(1)),
      sharpe: Number((std > 0 ? mean / std : 0).toFixed(2)),
    })
  }
  return out
}

/** Full detail stats for one strategy from its closed trades. */
export function computeStrategyDetail(
  key: string,
  allTrades: StrategyTrade[],
): StrategyDetailStats {
  const sorted = [...allTrades].sort(
    (a, b) =>
      (parseTradeDate(a.closed_at)?.getTime() ?? 0) -
      (parseTradeDate(b.closed_at)?.getTime() ?? 0),
  )

  let cumulative = 0
  let peak = 0
  let maxDrawdown = 0
  let bestTrade = -Infinity
  let worstTrade = Infinity
  let maxWinStreak = 0
  let maxLossStreak = 0
  let curWin = 0
  let curLoss = 0
  const equitySeries: EquityPoint[] = []
  const winPnls: number[] = []
  const lossPnls: number[] = []
  const pnlValues: number[] = []
  const pnlDates: string[] = []

  const daily: Record<string, number> = {}
  const assetMap = new Map<string, DetailTrade[]>()
  const dow: DowStat[] = DOW_LABELS.map((label) => ({
    label, pnl: 0, trades: 0, wins: 0, losses: 0,
  }))
  const months: MonthStat[] = MONTH_LABELS.map((label) => ({
    label, pnl: 0, trades: 0,
  }))

  sorted.forEach((t, idx) => {
    const pnl = Number(t.realized_pnl) || 0
    const symbol = t.symbol.trim()
    pnlValues.push(pnl)
    pnlDates.push(t.closed_at)
    cumulative += pnl
    equitySeries.push({ index: idx + 1, date: t.closed_at, cumulative })
    peak = Math.max(peak, cumulative)
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative)
    bestTrade = Math.max(bestTrade, pnl)
    worstTrade = Math.min(worstTrade, pnl)

    if (pnl >= 0) {
      winPnls.push(pnl)
      curWin += 1
      curLoss = 0
      maxWinStreak = Math.max(maxWinStreak, curWin)
    } else {
      lossPnls.push(Math.abs(pnl))
      curLoss += 1
      curWin = 0
      maxLossStreak = Math.max(maxLossStreak, curLoss)
    }

    const list = assetMap.get(symbol)
    if (list) list.push({ symbol, pnl, closed_at: t.closed_at })
    else assetMap.set(symbol, [{ symbol, pnl, closed_at: t.closed_at }])

    const d = parseTradeDate(t.closed_at)
    if (d) {
      const iso = d.toISOString().slice(0, 10)
      daily[iso] = (daily[iso] ?? 0) + pnl
      dow[d.getDay()].pnl += pnl
      dow[d.getDay()].trades += 1
      if (pnl >= 0) dow[d.getDay()].wins += 1
      else dow[d.getDay()].losses += 1
      months[d.getMonth()].pnl += pnl
      months[d.getMonth()].trades += 1
    }
  })

  const totalTrades = sorted.length
  const grossWin = winPnls.reduce((s, v) => s + v, 0)
  const grossLoss = lossPnls.reduce((s, v) => s + v, 0)
  const mean = pnlValues.reduce((s, v) => s + v, 0) / (pnlValues.length || 1)
  const variance =
    pnlValues.reduce((s, v) => s + (v - mean) ** 2, 0) / (pnlValues.length || 1)
  const std = Math.sqrt(variance)

  // Per-asset breakdown, ranked by P&L
  const byAsset: AssetStat[] = Array.from(assetMap.entries())
    .map(([ticker, list], i) => {
      const wins = list.filter((t) => t.pnl >= 0)
      const losses = list.filter((t) => t.pnl < 0)
      const gWin = wins.reduce((s, t) => s + t.pnl, 0)
      const gLoss = losses.reduce((s, t) => s + Math.abs(t.pnl), 0)
      const totalPnl = list.reduce((s, t) => s + t.pnl, 0)
      return {
        ticker,
        display: displaySymbol(ticker),
        color: seriesColor(ticker, i),
        trades: list.length,
        wins: wins.length,
        losses: losses.length,
        winrate: list.length ? (wins.length / list.length) * 100 : 0,
        totalPnl,
        avgPnl: list.length ? totalPnl / list.length : 0,
        profitFactor: gLoss > 0 ? gWin / gLoss : null,
      }
    })
    .sort((a, b) => b.totalPnl - a.totalPnl)

  // Concentration: share of absolute P&L per ticker
  const sumAbs =
    byAsset.reduce((s, a) => s + Math.abs(a.totalPnl), 0) || 1
  const concentration: ConcentrationItem[] = byAsset.map((a) => ({
    ticker: a.ticker,
    display: a.display,
    pnl: a.totalPnl,
    pctAbs: (Math.abs(a.totalPnl) / sumAbs) * 100,
  }))
  const top3Share =
    (concentration
      .slice(0, 3)
      .reduce((s, i) => s + Math.abs(i.pnl), 0) /
      sumAbs) *
    100

  return {
    key,
    totalTrades,
    wins: winPnls.length,
    losses: lossPnls.length,
    winrate: totalTrades > 0 ? (winPnls.length / totalTrades) * 100 : 0,
    totalPnl: cumulative,
    grossWin,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    maxDrawdown,
    sharpe: std > 0 ? mean / std : 0,
    avgWin: winPnls.length ? grossWin / winPnls.length : 0,
    avgLoss: lossPnls.length ? grossLoss / lossPnls.length : 0,
    bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
    worstTrade: worstTrade === Infinity ? 0 : worstTrade,
    maxWinStreak,
    maxLossStreak,
    equitySeries,
    daily,
    byAsset,
    dayOfWeek: dow,
    months,
    concentration,
    top3Share,
    rolling: computeRolling(pnlValues, pnlDates),
    tickers: byAsset.map((a) => a.ticker).sort((a, b) => a.localeCompare(b)),
    trades: sorted.map((t) => ({
      symbol: t.symbol.trim(),
      pnl: Number(t.realized_pnl) || 0,
      closed_at: t.closed_at,
    })),
  }
}
