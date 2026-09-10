export interface EquityPoint {
  date: string
  /** Full event timestamp (ISO 8601). Optional — older responses send only
   *  `date`, and the chart falls back to that day's local midnight. */
  at?: string
  equity: number
}

export interface CumPoint {
  date: string
  cum: number
}

/** One asset or strategy series from /dashboard/summary. */
export interface GroupSeries {
  id: string
  total: number
  trades: number
  win_rate: number | null
  profit_factor: number | null
  curve: CumPoint[]
}

export interface DashboardMetrics {
  net_pnl: number
  win_rate: number | null
  profit_factor: number | null
  expectancy: number | null
  avg_rr: number | null
  max_drawdown: number
  sharpe: number | null
  trades: number
}

export interface CommissionRow {
  exchange: string
  amount: number
}

export interface PnlBreakdown {
  daily: number
  weekly: number
  monthly: number
}

export interface DashboardSummary {
  equity: number
  balance: number
  realized_pnl: number
  unrealized_pnl: number
  total_pnl: number
  net_deposits: number
  /** Base for percentage displays (net deposits, falling back to equity). */
  pct_base: number
  equity_curve: EquityPoint[]
  metrics: DashboardMetrics
  /** Realized P&L per day, keyed by YYYY-MM-DD. */
  daily_pnl: Record<string, number>
  by_asset: GroupSeries[]
  by_strategy: GroupSeries[]
  hwm: number
  commissions: { total: number; month: string; rows: CommissionRow[] }
  pnl_breakdown: PnlBreakdown
}

/** One point of a per-asset cumulative-P&L curve. */
export interface AssetEquityPoint {
  date: string
  cumulative: number
}

/** Per-asset metrics row from /dashboard/asset-performance. */
export interface AssetPerformanceRow {
  ticker: string
  total_trades: number
  wins: number
  losses: number
  winrate: number
  total_pnl: number
  /** null = no losing trades yet ("Perfect"). */
  profit_factor: number | null
  max_drawdown: number
  avg_win: number
  avg_loss: number
  largest_win: number
  largest_loss: number
  max_win_streak: number
  equity_series: AssetEquityPoint[]
}

export interface AssetPerformanceData {
  balance: number
  assets: AssetPerformanceRow[]
}

/** One closed trade within a calendar day (from /dashboard/daily-pnl). */
export interface DayTrade {
  /** `binance_pastpositions.id` — names the row for an admin correction. */
  id: number
  symbol: string
  position_side: string
  position_amt: number
  realized_pnl: number
  exit_price: number | null
  side: string
  strategy: string | null
  closed_at: string
}

/** One day's aggregate + its trades. */
export interface DayPnl {
  total: number
  wins: number
  losses: number
  trades: DayTrade[]
}

/** GET /dashboard/daily-pnl — closed P&L keyed by YYYY-MM-DD. */
export type DailyPnlMap = Record<string, DayPnl>

/** Row from /binance/positions (decimals arrive as strings from MySQL). */
export interface OpenPosition {
  id: number
  api_key: string
  symbol: string
  position_side: string
  position_amt: string
  entry_price: string | null
  mark_price: string | null
  unrealized_profit: string | null
  notional: string | null
  update_time: number | null
}

/** Row from /binance/past-positions (decimals arrive as strings from MySQL). */
export interface PastPosition {
  id: number
  api_key: string
  symbol: string
  position_side: string
  position_amt: string
  entry_price: string | null
  exit_price: string | null
  /** NET of `exchange_fee` — the figure Binance's own Position History shows. */
  realized_pnl: string | null
  /** Estimated round-trip commission already deducted from `realized_pnl`. */
  exchange_fee: string | null
  side: string
  order_id: number | null
  closed_at: string
  strategy: string | null
}
