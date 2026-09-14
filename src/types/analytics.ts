/**
 * Payload of GET /api/analytics.
 *
 * BASIS: every P&L figure is BEFORE exchange fees (the strategy's result);
 * each carries its after-fees twin (`*_net`) for the hover breakdown, and
 * `fees` is the cost of trading as its own number. See `FeeSummary`.
 */

import type { FeeSummary } from './dashboard'

export interface DayExtreme {
  date: string
  /** Before fees. */
  pnl: number
  pnl_net: number
}

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export interface DayOfWeekStat {
  pnl: number
  pnl_net: number
  trades: number
}

export interface MonthlyStat {
  /** 'YYYY-MM', ascending. */
  month: string
  /** Before fees. */
  pnl: number
  pnl_net: number
  fees: number
  trades: number
  win_rate: number
}

export interface SymbolStat {
  symbol: string
  trades: number
  /** Before fees. */
  realized_pnl: number
  realized_pnl_net: number
  fees: number
}

export interface ExchangeStat {
  exchange: string
  balance: number
  unrealized: number
}

export interface FlowTransaction {
  type: string
  amount: number
  date: string
}

export interface CapitalFlows {
  deposits: number
  withdrawals: number
  net_flow: number
  /** Newest first. */
  recent: FlowTransaction[]
}

export interface TradeQuality {
  wins: number
  losses: number
  win_rate: number
  profit_factor: number | null
  avg_win: number
  avg_loss: number
  largest_win: number
  largest_loss: number
  expectancy: number
}

export interface RiskStats {
  max_drawdown_abs: number
  max_drawdown_pct: number | null
  best_streak: number
  worst_streak: number
  sharpe: number | null
  sortino: number | null
  /** Annualized, already in percent units (e.g. 18.42 = 18.42%). */
  volatility: number | null
  /** 0–100 composite, higher = better; null when sharpe is null. */
  risk_score: number | null
}

/**
 * Realized P&L measured against the money actually paid in — the flip side of
 * Total Return. Withdrawals are ignored (the denominator is gross deposits),
 * and it stays all-time no matter the date range, though it does honor the
 * symbol / strategy chips.
 */
export interface ReturnOnDeposit {
  /** null when nothing has been deposited yet. */
  pct: number | null
  /** Before fees. */
  realized: number
  realized_net: number
  deposits: number
  trades: number
}

export type ChipMode = 'include' | 'exclude'

export interface AnalyticsFilterMeta {
  /** True once any symbol / strategy chip is picked. */
  filtered: boolean
  /** Every symbol in the current exchange + date scope, chips included. */
  available_symbols: string[]
  /** Same, by strategy tag; untagged trades bucket into 'Untagged'. */
  available_strategies: string[]
}

export interface Analytics {
  baseline: number
  current_capital: number
  total_unrealized: number
  /** Before fees. */
  total_realized: number
  total_realized_net: number
  fees: FeeSummary
  total_return_abs: number
  total_return_abs_net: number
  total_return_pct: number | null
  return_on_deposit: ReturnOnDeposit
  filters: AnalyticsFilterMeta
  trading_days: number
  avg_daily_pnl: number | null
  avg_daily_pnl_net: number | null
  best_day: DayExtreme | null
  worst_day: DayExtreme | null
  /** Realized P&L per day keyed by 'YYYY-MM-DD', ascending — before fees… */
  daily_pnl: Record<string, number>
  /** …and after. */
  daily_pnl_net: Record<string, number>
  day_of_week: Record<Weekday, DayOfWeekStat>
  monthly: MonthlyStat[]
  by_symbol: SymbolStat[]
  by_exchange: ExchangeStat[]
  flows: CapitalFlows
  quality: TradeQuality
  risk: RiskStats
}
