import { apiFetch } from './api'
import type {
  SizingDecision,
  TradeLogDetail,
  TradeLogFilters,
  TradeLogRow,
  TradeLogsData,
} from '../types/tradeLogs'

/* ---- wire shapes (snake_case straight from AdminTradeLogController) ---- */

interface ApiSizing {
  balance: number | null
  total_deposit: number | null
  min_deposit: number | null
  base_size: number | null
  reference_balance: number | null
  coarse_step: boolean
  quantity: number | null
  size_multiple: number | null
  stacks_now: number | null
  max_increments: number | null
}

interface ApiDetail {
  account: string | null
  uni_id: string | null
  user_name: string | null
  status: TradeLogDetail['status']
  reason: string | null
  error: string | null
  retryable: boolean | null
  quantity: number | null
  fill_price: number | null
  closed_quantity: number | null
  sizing: ApiSizing | null
}

interface ApiLog {
  id: number
  exchange: TradeLogRow['exchange']
  action: TradeLogRow['action']
  ticker: string
  success: boolean
  price: number | null
  strategy: string | null
  leverage: number | null
  category: string | null
  target_count: number
  filled: number
  failed: number
  skipped: number
  details: ApiDetail[]
  ts: string | null
}

function mapSizing(s: ApiSizing | null): SizingDecision | null {
  if (!s) return null
  return {
    balance: s.balance,
    totalDeposit: s.total_deposit,
    minDeposit: s.min_deposit,
    baseSize: s.base_size,
    referenceBalance: s.reference_balance,
    coarseStep: s.coarse_step,
    quantity: s.quantity,
    sizeMultiple: s.size_multiple,
    stacksNow: s.stacks_now,
    maxIncrements: s.max_increments,
  }
}

function mapDetail(d: ApiDetail): TradeLogDetail {
  return {
    account: d.account,
    uniId: d.uni_id,
    userName: d.user_name,
    status: d.status,
    reason: d.reason,
    error: d.error,
    retryable: d.retryable,
    quantity: d.quantity,
    fillPrice: d.fill_price,
    closedQuantity: d.closed_quantity,
    sizing: mapSizing(d.sizing),
  }
}

function mapLog(l: ApiLog): TradeLogRow {
  return {
    id: l.id,
    exchange: l.exchange,
    action: l.action,
    ticker: l.ticker,
    success: l.success,
    price: l.price,
    strategy: l.strategy,
    leverage: l.leverage,
    category: l.category,
    targetCount: l.target_count,
    filled: l.filled,
    failed: l.failed,
    skipped: l.skipped,
    details: (l.details ?? []).map(mapDetail),
    ts: l.ts,
  }
}

/**
 * GET /admin/trade-logs — the engine's signal log. Filtering and paging happen
 * server-side (the table is append-only and grows forever, so the page never
 * pulls the whole thing down to filter in the browser).
 */
export async function getTradeLogs(
  filters: TradeLogFilters = {},
): Promise<TradeLogsData> {
  const qs = new URLSearchParams()
  const put = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '' && value !== 'all') {
      qs.set(key, String(value))
    }
  }
  put('exchange', filters.exchange)
  put('action', filters.action)
  put('ticker', filters.ticker)
  put('category', filters.category)
  put('strategy', filters.strategy)
  put('result', filters.result)
  put('from', filters.from)
  put('to', filters.to)
  put('limit', filters.limit)
  put('offset', filters.offset)
  const query = qs.toString() ? `?${qs.toString()}` : ''

  const res = await apiFetch<{
    success: boolean
    logs: ApiLog[]
    summary: {
      signals: number
      clean_signals: number
      filled: number
      failed: number
      skipped: number
    }
    pagination: { limit: number; offset: number; total: number }
    filters: { tickers: string[]; strategies: string[] }
  }>(`/admin/trade-logs${query}`, { auth: true })

  return {
    logs: res.logs.map(mapLog),
    summary: {
      signals: res.summary.signals,
      cleanSignals: res.summary.clean_signals,
      filled: res.summary.filled,
      failed: res.summary.failed,
      skipped: res.summary.skipped,
    },
    pagination: res.pagination,
    options: {
      tickers: res.filters?.tickers ?? [],
      strategies: res.filters?.strategies ?? [],
    },
  }
}
