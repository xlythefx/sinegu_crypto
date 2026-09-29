/**
 * GET /admin/insights/* — the admin dashboard's tabs
 * (sinegutrade-api AdminInsightsController + App\Services\Admin\AdminInsights).
 * Customer figures exclude staff, demo, sandbox and SBXINV- scenario accounts.
 */
import type { ExchangeKind } from './exchanges'

export interface BlockedKeyRow {
  id: number
  exchange: ExchangeKind
  account: string
  uni_id: string
  owner: string
  demo: boolean
  /** Days until the daily sweep disconnects it; ≤0 = due on the next run. */
  days_left: number | null
}

/**
 * Keys marked optional are ABSENT for a read-only collaborator (the API's
 * AdminInsightsController::LIMITED_HIDDEN_OVERVIEW_KEYS): billing and key
 * health are admin business.
 */
export interface OverviewInsights {
  attention: {
    blocked_keys?: BlockedKeyRow[]
    blocked_keys_count?: number
    pending_users: { uni_id: string; name: string; email: string; created_at: string | null }[]
    pending_users_count: number
    overdue_invoices?: { count: number; amount: number }
    unpaid_invoices?: { count: number; amount: number }
    unmatched_transfers?: number
    signals_today: {
      signals: number
      with_problems: number
      filled: number
      skipped: number
      failed: number
      /** Engine skip reason (or "order failed") → accounts. */
      reasons: Record<string, number>
    }
    paused_for_payment?: number
  }
  headline: {
    /** null = no real master account on record. */
    master_balance: number | null
    master_today_pnl: number
    master_today_trades: number
    active_traders_today: number
    customers_live: number
    collected_this_month?: number
  }
}

export type FunnelKey = 'signed_up' | 'approved' | 'connected' | 'funded' | 'traded_7d'

export interface RankedUser {
  uni_id: string
  name: string
  value: number
}

export interface CustomerInsights {
  min_deposit: number
  funnel: { key: FunnelKey; count: number }[]
  active: { today: number; d7: number; d30: number }
  status: { pending: number; active: number; suspended: number }
  stopped_30d: { disconnected: number; disabled: number; key_blocked: number }
  signups_weekly: { week: string; signups: number }[]
  by_exchange: { exchange: ExchangeKind; live: number; demo: number; capital: number }[]
  top_capital: RankedUser[]
  top_pnl_30d: RankedUser[]
  most_missed_7d: { uni_id: string; name: string; missed: number; top_reason: string | null }[]
}

/** Live balances on connected accounts — the Money tab's and the Platform view's card. */
export interface UnderManagement {
  customers: number
  customer_accounts: number
  master: number
  /** Deposits/withdrawals of the accounts in scope, last 30 days. */
  deposits_30d: number
  withdrawals_30d: number
}

export interface MoneyInsights {
  monthly: { month: string; invoiced: number; collected: number; outstanding: number; count: number }[]
  totals: { invoiced: number; collected: number; outstanding: number }
  avg_days_to_pay: number | null
  /** Percent of paid invoices paid by their due date. */
  on_time_share: number | null
  overdue: {
    id: number
    uni_id: string
    name: string
    exchange: ExchangeKind
    month: string
    amount: number
    due_date: string | null
    days_late: number
  }[]
  under_management: UnderManagement
  transfers: { unmatched: number; ignored: number; settled: number }
  forecast: InvoiceForecast
}

/**
 * "Future invoice": the running month's REALIZED fee if it were billed now —
 * the invoice's own math (InvoiceService::computeForAccount), nothing written.
 */
export interface InvoiceForecast {
  /** YYYY-MM being forecast. */
  month: string
  as_of: string
  total: number
  realized_pnl: number
  billable_accounts: number
  accounts: {
    uni_id: string
    name: string
    account: string
    exchange: ExchangeKind
    realized_pnl: number
    /** The customer's realized fee percentage (e.g. 20). */
    rate: number
    hwm: number
    equity: number
    fee: number
    /** below_hwm = a profitable month, but equity is not above the high-water mark. */
    status: 'billable' | 'below_hwm' | 'no_profit'
  }[]
  /** Customer accounts on a venue invoicing cannot read yet (MEXC, Bybit). */
  not_supported: { exchange: ExchangeKind; accounts: number }[]
}

export interface SystemInsights {
  venues: {
    exchange: ExchangeKind
    last_signal_at: string | null
    last_close_synced_at: string | null
    last_key_check_at: string | null
    signals_today: number
    failed_today: number
    keys_blocked_today: number
    errors_today: { message: string; count: number }[]
  }[]
  payment_watcher: {
    name: string
    label: string
    configured: boolean
    last_scan_at: string | null
    scan_stale: boolean
  }[]
}

export interface StrategyReliability {
  signals: number
  rejected: number
  /** Every targeted account filled. */
  full: number
  /** Some filled, some skipped or failed. */
  partial: number
  /** Nobody filled. */
  missed: number
  account_fills: number
  account_skips: number
  account_fails: number
  reasons: Record<string, number>
  last_signal_at: string | null
}

export interface CompareStats {
  win_rate: number | null
  pnl: number
  /** P&L over today's balance — a like-for-like comparison, not a track record. */
  return_pct: number | null
}

export interface StrategyCompare {
  master: CompareStats & { trades: number }
  customers_avg: {
    customers: number
    win_rate: number | null
    return_pct: number | null
    participation: number | null
  }
  /** Lowest participation first — the customers furthest from the master. */
  customers: (CompareStats & {
    uni_id: string
    name: string
    trades: number
    /** Their trades as a share of the master's, capped at 100. */
    participation: number | null
  })[]
}

export interface StrategyInsights {
  reliability: Record<string, StrategyReliability>
  compare: Record<string, StrategyCompare>
}

/** Whose money the Overview's Platform view pools. */
export type PlatformScope = 'all' | 'customers' | 'master'

/** One realized-P&L window: after fees (`net`), before fees and the fees between. */
export interface PnlWindow {
  net: number
  gross: number
  fees: number
  trades: number
}

/** GET /admin/insights/platform?scope= — live real-money accounts pooled. */
export interface PlatformInsights {
  scope: PlatformScope
  under_management: UnderManagement & {
    balance: number
    unrealized: number
    equity: number
    by_exchange: { exchange: ExchangeKind; accounts: number; balance: number }[]
  }
  pnl: { today: PnlWindow; d7: PnlWindow; month: PnlWindow; all: PnlWindow }
  /** Percent of closes in profit after fees; null with no closes. */
  win_rate: number | null
  accounts_live: number
  owners: number
  traders_today: number
}
