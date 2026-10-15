import { apiFetch } from './api'
import type {
  MasterOutcome,
  ReasonCount,
  ReasonSeverity,
  SignalFeed,
  SignalHealth,
  SignalHealthStatus,
  SignalIssue,
  SizingDecision,
  TradeLogDetail,
  TradeLogFilters,
  OutsideCloseRow,
  TradeLogClose,
  TradeLogIssuesData,
  TradeLogItem,
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
  streak_run?: number | null
  streak_known?: boolean | null
  streak_kind?: 'loss' | 'win' | null
  streak_step?: number | null
  streak_size?: number | null
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
  close?: {
    quantity: number
    entry_price: number | null
    exit_price: number | null
    realized_pnl: number | null
    exchange_fee: number | null
    closed_at: string | null
  } | null
  increment?: number | null
  max_increments?: number | null
  sizing: ApiSizing | null
  reason_key?: string | null
  reason_label?: string | null
  severity?: ReasonSeverity | null
  is_master?: boolean | null
  match?: boolean
}

interface ApiRetry {
  id: number
  success: boolean
  filled: number
  failed: number
  skipped: number
  details: ApiDetail[]
  ts: string | null
}

interface ApiOutsideClose {
  kind: 'outside_close'
  id: string
  exchange: OutsideCloseRow['exchange']
  ticker: string
  side: OutsideCloseRow['side']
  account: string | null
  uni_id: string | null
  user_name: string | null
  demo: boolean
  quantity: number
  entry_price: number | null
  exit_price: number | null
  realized_pnl: number | null
  exchange_fee: number | null
  ts: string | null
}

interface ApiLog {
  kind?: 'signal'
  feed?: SignalFeed
  side?: TradeLogRow['side']
  type?: TradeLogRow['type']
  retries?: ApiRetry[]
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
  master?: MasterOutcome | null
  problems?: number
  normal_skips?: number
}

interface ApiIssue {
  key: string
  reason_key: string
  label: string
  severity: ReasonSeverity
  account: string | null
  uni_id: string | null
  user_name: string | null
  is_master: boolean
  exchange: SignalIssue['exchange']
  tickers: string[]
  count: number
  first_at: string | null
  last_at: string | null
  last_message: string | null
  fix: { label: string; href: string } | null
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
    streakRun: s.streak_run ?? null,
    streakKnown: s.streak_known ?? null,
    streakKind: s.streak_kind ?? null,
    streakStep: s.streak_step ?? null,
    streakSize: s.streak_size ?? null,
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
    close: mapClose(d.close),
    increment: d.increment ?? null,
    maxIncrements: d.max_increments ?? null,
    sizing: mapSizing(d.sizing),
    reasonKey: d.reason_key ?? null,
    reasonLabel: d.reason_label ?? null,
    severity: d.severity ?? null,
    isMaster: d.is_master ?? null,
    match: d.match ?? true,
  }
}

function mapClose(c: ApiDetail['close']): TradeLogClose | null {
  if (!c) return null
  return {
    quantity: c.quantity,
    entryPrice: c.entry_price,
    exitPrice: c.exit_price,
    realizedPnl: c.realized_pnl,
    exchangeFee: c.exchange_fee,
    closedAt: c.closed_at,
  }
}

function mapOutside(o: ApiOutsideClose): OutsideCloseRow {
  return {
    kind: 'outside_close',
    id: o.id,
    exchange: o.exchange,
    ticker: o.ticker,
    side: o.side,
    type: 'exit',
    account: o.account,
    uniId: o.uni_id,
    userName: o.user_name,
    demo: Boolean(o.demo),
    quantity: o.quantity,
    entryPrice: o.entry_price,
    exitPrice: o.exit_price,
    realizedPnl: o.realized_pnl,
    exchangeFee: o.exchange_fee,
    ts: o.ts,
  }
}

function mapItem(item: ApiLog | ApiOutsideClose): TradeLogItem {
  return item.kind === 'outside_close' ? mapOutside(item) : mapLog(item)
}

function mapLog(l: ApiLog): TradeLogRow {
  const exit = l.action === 'EXIT_LONG' || l.action === 'EXIT_SHORT'
  return {
    kind: 'signal',
    id: l.id,
    exchange: l.exchange,
    // An API older than the test feed: every signal it logged was main.
    feed: l.feed === 'test' ? 'test' : 'main',
    action: l.action,
    // An API older than the side/type words: derive them from the action.
    side: l.side ?? (l.action === 'SELL' || l.action === 'EXIT_SHORT' ? 'SHORT' : 'LONG'),
    type: l.type ?? (exit ? 'exit' : 'entry'),
    retries: (l.retries ?? []).map((r) => ({
      id: r.id,
      success: r.success,
      filled: r.filled,
      failed: r.failed,
      skipped: r.skipped,
      details: (r.details ?? []).map(mapDetail),
      ts: r.ts,
    })),
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
    master: l.master ?? null,
    // An API older than the normal/problem split sends neither count: its
    // failures are still problems, and its skips read as skips, not alarms.
    problems: l.problems ?? l.failed,
    normalSkips: l.normal_skips ?? l.skipped,
  }
}

function mapIssue(i: ApiIssue): SignalIssue {
  return {
    key: i.key,
    reasonKey: i.reason_key,
    label: i.label,
    severity: i.severity,
    account: i.account,
    uniId: i.uni_id,
    userName: i.user_name,
    isMaster: i.is_master,
    exchange: i.exchange,
    tickers: i.tickers ?? [],
    count: i.count,
    firstAt: i.first_at,
    lastAt: i.last_at,
    lastMessage: i.last_message,
    fix: i.fix,
  }
}

/** Signal-level filters (shared by the list and the issues endpoint). */
function signalParams(filters: TradeLogFilters): URLSearchParams {
  const qs = new URLSearchParams()
  const put = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '' && value !== 'all') {
      qs.set(key, String(value))
    }
  }
  put('exchange', filters.exchange)
  put('feed', filters.feed)
  put('side', filters.side)
  put('type', filters.type)
  put('action', filters.action)
  put('ticker', filters.ticker)
  put('category', filters.category)
  put('strategy', filters.strategy)
  put('result', filters.result)
  put('from', filters.from)
  put('to', filters.to)
  return qs
}

function withQuery(path: string, qs: URLSearchParams): string {
  const query = qs.toString()
  return query ? `${path}?${query}` : path
}

/**
 * GET /admin/trade-logs — the engine's signal log. Filtering and paging happen
 * server-side (the table is append-only and grows forever, so the page never
 * pulls the whole thing down to filter in the browser). `outcome`, `reason`
 * and `account` look inside each signal's fan-out: a signal is listed when at
 * least one account matches, and every account row says whether it did.
 */
export async function getTradeLogs(
  filters: TradeLogFilters = {},
): Promise<TradeLogsData> {
  const qs = signalParams(filters)
  if (filters.outcome && filters.outcome !== 'all') qs.set('outcome', filters.outcome)
  if (filters.reason && filters.reason !== 'all') qs.set('reason', filters.reason)
  if (filters.account) qs.set('account', filters.account)
  if (filters.source && filters.source !== 'all') qs.set('source', filters.source)
  if (filters.limit !== undefined) qs.set('limit', String(filters.limit))
  if (filters.offset !== undefined) qs.set('offset', String(filters.offset))

  const res = await apiFetch<{
    success: boolean
    logs: (ApiLog | ApiOutsideClose)[]
    summary: {
      signals: number
      clean_signals: number
      filled: number
      failed: number
      skipped: number
      problem_accounts?: number
      normal_skips?: number
      outside_closes?: number
    }
    pagination: { limit: number; offset: number; total: number }
    filters: { tickers: string[]; exchanges?: string[]; strategies: string[]; reasons?: ReasonCount[] }
  }>(withQuery('/admin/trade-logs', qs), { auth: true })

  return {
    logs: res.logs.map(mapItem),
    summary: {
      signals: res.summary.signals,
      cleanSignals: res.summary.clean_signals,
      filled: res.summary.filled,
      failed: res.summary.failed,
      skipped: res.summary.skipped,
      problemAccounts: res.summary.problem_accounts ?? res.summary.failed,
      normalSkips: res.summary.normal_skips ?? 0,
      outsideCloses: res.summary.outside_closes ?? 0,
    },
    pagination: res.pagination,
    options: {
      tickers: res.filters?.tickers ?? [],
      exchanges: res.filters?.exchanges ?? [],
      strategies: res.filters?.strategies ?? [],
      reasons: res.filters?.reasons ?? [],
    },
  }
}

/**
 * GET /admin/trade-logs/health — the banner: is anything wrong right now.
 * Ignores the page's filters on purpose.
 */
export async function getTradeLogHealth(hours = 24): Promise<SignalHealth> {
  const res = await apiFetch<{
    success: boolean
    health: {
      status: SignalHealthStatus
      hours: number
      signals: number
      filled: number
      normal_skips: number
      problems: number
      master_missed: number
      last_signal_at: string | null
      issues: ApiIssue[]
      issues_total: number
    }
  }>(`/admin/trade-logs/health?hours=${hours}`, { auth: true })

  const h = res.health
  return {
    status: h.status,
    hours: h.hours,
    signals: h.signals,
    filled: h.filled,
    normalSkips: h.normal_skips,
    problems: h.problems,
    masterMissed: h.master_missed,
    lastSignalAt: h.last_signal_at,
    issues: (h.issues ?? []).map(mapIssue),
    issuesTotal: h.issues_total,
  }
}

/**
 * GET /admin/trade-logs/issues — every problem in the filtered window grouped
 * by cause, most recent first. Signal-level filters only (the account filters
 * are the list's); with no dates the API reads the last 7 days.
 */
export async function getTradeLogIssues(
  filters: TradeLogFilters = {},
): Promise<TradeLogIssuesData> {
  const res = await apiFetch<{
    success: boolean
    signals: number
    issues: ApiIssue[]
    normal: ReasonCount[]
  }>(withQuery('/admin/trade-logs/issues', signalParams(filters)), { auth: true })

  return {
    signals: res.signals,
    issues: (res.issues ?? []).map(mapIssue),
    normal: res.normal ?? [],
  }
}
