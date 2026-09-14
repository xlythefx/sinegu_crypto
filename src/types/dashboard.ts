/**
 * BASIS. The trading dashboard and Performance Analytics lead with P&L
 * BEFORE exchange fees — the strategy's result — and every money figure
 * carries its after-fees twin (`*_net`, `equity` beside `equity_gross`,
 * `cum_net` beside `cum`) for the three-line hover breakdown
 * (`components/ui/PnlBreakdown`). Trades before the net-of-fees cutoff have
 * no fee on record, so for them before == after; `FeeSummary` says how many.
 */
export interface FeeSummary {
  /** Exchange fees (commission + funding) we know of, summed. */
  total: number
  trades_with_fee: number
  /** Closed before the fee ledger existed — same figure before and after. */
  trades_without_fee: number
  /** 'YYYY-MM-DD' the ledger starts. */
  since: string
}

export interface EquityPoint {
  date: string
  /** Full event timestamp (ISO 8601). Optional — older responses send only
   *  `date`, and the chart falls back to that day's local midnight. */
  at?: string
  /** After fees: ends on the balance the exchange reports. */
  equity: number
  /** Before fees: the same walk with each day's fees added back, so it ends
   *  at balance + fees. Absent only on the single-point "nothing closed yet"
   *  curve of an older response. */
  equity_gross?: number
}

export interface CumPoint {
  date: string
  /** Cumulative P&L before fees. */
  cum: number
  /** ...and after. */
  cum_net: number
}

/** One asset or strategy series from /dashboard/summary. */
export interface GroupSeries {
  id: string
  /** Before fees. */
  total: number
  total_net: number
  fees: number
  trades: number
  win_rate: number | null
  profit_factor: number | null
  curve: CumPoint[]
}

export interface DashboardMetrics {
  /** Realized + unrealized, after fees. */
  net_pnl: number
  /** Realized + unrealized, before fees — the rail's headline. */
  gross_pnl: number
  fees: number
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
  /** After fees — the figure beside a list of trades (Positions page). */
  realized_pnl: number
  /** Before fees — the dashboard's headline. */
  realized_pnl_gross: number
  unrealized_pnl: number
  total_pnl: number
  total_pnl_gross: number
  fees: FeeSummary
  net_deposits: number
  /** Base for percentage displays (net deposits, falling back to equity). */
  pct_base: number
  equity_curve: EquityPoint[]
  metrics: DashboardMetrics
  /** Realized P&L per day, keyed by YYYY-MM-DD (after fees). */
  daily_pnl: Record<string, number>
  daily_pnl_gross: Record<string, number>
  by_asset: GroupSeries[]
  by_strategy: GroupSeries[]
  hwm: number
  commissions: { total: number; month: string; rows: CommissionRow[] }
  /** Today / 7d / month-to-date, before fees… */
  pnl_breakdown: PnlBreakdown
  /** …after fees, and the fees themselves, same keys. */
  pnl_breakdown_net: PnlBreakdown
  pnl_breakdown_fees: PnlBreakdown
}

/** One point of a per-asset cumulative-P&L curve. */
export interface AssetEquityPoint {
  date: string
  /** Before fees. */
  cumulative: number
  cumulative_net: number
}

/** Per-asset metrics row from /dashboard/asset-performance. */
export interface AssetPerformanceRow {
  ticker: string
  total_trades: number
  wins: number
  losses: number
  winrate: number
  /** Before fees. */
  total_pnl: number
  total_pnl_net: number
  fees: number
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

/**
 * Where a closed trade's `exchange_fee` came from.
 *  - `null`        nothing was taken out of `realized_pnl` (a gross row —
 *                  closed before the net-of-fees cutoff, or fee still unknown)
 *  - `'estimated'` the API's flat-rate estimate; the exchange's receipts have
 *                  not been matched yet (minutes, normally), or cannot be
 *  - `'actual'`    commission + funding summed from the exchange's receipts
 *  - `'manual'`    an admin typed the P&L by hand; automatic updates stop
 * Customers see only the amount and an "est." tag while `'estimated'`; the
 * other words are admin-only.
 */
export type FeeSource = 'estimated' | 'actual' | 'manual' | null

/** One closed trade within a calendar day (from /dashboard/daily-pnl). */
export interface DayTrade {
  /** `binance_pastpositions.id` — names the row for an admin correction. */
  id: number
  symbol: string
  position_side: string
  position_amt: number
  realized_pnl: number
  /** Already deducted from `realized_pnl`; null on a gross row. */
  exchange_fee: number | null
  fee_source: FeeSource
  exit_price: number | null
  side: string
  strategy: string | null
  closed_at: string
}

/** One day's aggregate + its trades. The calendar keeps AFTER fees as its
 *  headline — a cell is what landed that day — with before fees on hover. */
export interface DayPnl {
  /** After fees. */
  total: number
  total_gross: number
  fees: number
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
  /** Commission + funding already deducted from `realized_pnl`; an estimate
   *  until `fee_source` is `'actual'`. */
  exchange_fee: string | null
  fee_source: FeeSource
  side: string
  order_id: number | null
  closed_at: string
  strategy: string | null
}
