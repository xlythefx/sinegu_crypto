import { apiFetch, API_URL, ApiError } from './api'
import { getToken } from '../lib/session'
import { mapApiInvoice, type ApiInvoice, type Invoice } from '../lib/billing'
import type {
  AdminAsset,
  AdminEngineStatus,
  AdminPerformance,
  AdminPositionsData,
  AdminUser,
  AdminUserDetail,
  AdminUserSummary,
  AdminUserUpdateInput,
  AssetInput,
  CacheClearResult,
  ClearInvoicesResult,
  DailyPnlMap,
  DatabaseTablesData,
  DbRow,
  EngineLogsData,
  EngineRestartResult,
  InvoiceScenario,
  MasterStats,
  PerformanceFilters,
  SandboxPositionInput,
  SandboxUser,
  ScenarioRun,
  ScenarioRunInput,
  SqlQueryInput,
  SqlQueryResult,
  StrategiesData,
  TableRowsData,
  TableRowsParams,
  TableStructure,
  TestUserInput,
  UserReferralRow,
} from '../types/admin'

export async function getMasterStats(): Promise<MasterStats> {
  const res = await apiFetch<{ success: boolean } & MasterStats>(
    '/admin/master-stats',
    { auth: true },
  )
  return { master: res.master, stats: res.stats }
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await apiFetch<{ success: boolean; users: AdminUser[] }>(
    '/admin/users',
    { auth: true },
  )
  return res.users
}

export async function getAdminDailyPnl(): Promise<DailyPnlMap> {
  const res = await apiFetch<{ success: boolean; days: DailyPnlMap }>(
    '/admin/daily-pnl',
    { auth: true },
  )
  // PHP serializes an empty map as [] — normalize to an object
  return Array.isArray(res.days) ? {} : res.days
}

/**
 * Cumulative master P&L + the fixed daily/weekly/monthly snapshots.
 * `filters` narrow the series only — `breakdown` and `tickers` always come
 * back unfiltered so excluded symbols can still be re-enabled.
 */
export async function getAdminPerformance(
  filters: PerformanceFilters = {},
): Promise<AdminPerformance> {
  const params = new URLSearchParams()
  if (filters.period) params.set('period', filters.period)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.exclude?.length) params.set('exclude', filters.exclude.join(','))

  const qs = params.toString()
  const res = await apiFetch<{ success: boolean } & AdminPerformance>(
    `/admin/performance${qs ? `?${qs}` : ''}`,
    { auth: true },
  )
  return {
    period: res.period,
    series: res.series ?? [],
    breakdown: res.breakdown,
    tickers: res.tickers ?? [],
  }
}

export async function getAdminAssets(): Promise<AdminAsset[]> {
  const res = await apiFetch<{ success: boolean; assets: AdminAsset[] }>(
    '/admin/assets',
    { auth: true },
  )
  return res.assets
}

/** Optional image mutation attached to a create/update. */
export interface AssetImageChange {
  /** A newly picked file to upload, or null for no change. */
  file?: File | null
  /** When true, clear the existing image (ignored if `file` is set). */
  remove?: boolean
}

/** Build the multipart body shared by create + update. */
function buildAssetForm(input: AssetInput, image?: AssetImageChange): FormData {
  const form = new FormData()
  form.append('ticker', input.ticker)
  if (input.type) form.append('type', input.type)
  if (input.broker) form.append('broker', input.broker)
  form.append('side', input.side)
  form.append('max_increments', String(input.max_increments))
  form.append('base_size', String(input.base_size))
  form.append('enabled', input.enabled ? '1' : '0')
  if (image?.file) form.append('asset_image', image.file)
  else if (image?.remove) form.append('remove_image', '1')
  return form
}

/**
 * Send a multipart asset payload. `spoofMethod` uses POST + _method=PUT for
 * updates, since PHP only parses multipart bodies on POST requests.
 */
async function sendAssetForm(
  path: string,
  form: FormData,
  spoofMethod?: 'PUT',
): Promise<AdminAsset> {
  if (spoofMethod) form.append('_method', spoofMethod)
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the API running?')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message ?? `Request failed (${res.status})`,
      data.error_code,
      data.errors,
    )
  }
  return (data as { asset: AdminAsset }).asset
}

export function createAsset(
  input: AssetInput,
  image?: AssetImageChange,
): Promise<AdminAsset> {
  return sendAssetForm('/admin/assets', buildAssetForm(input, image))
}

export function updateAsset(
  assetId: number,
  input: AssetInput,
  image?: AssetImageChange,
): Promise<AdminAsset> {
  return sendAssetForm(
    `/admin/assets/${assetId}`,
    buildAssetForm(input, image),
    'PUT',
  )
}

export async function deleteAsset(assetId: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/assets/${assetId}`, {
    method: 'DELETE',
    auth: true,
  })
}

export async function getStrategies(): Promise<StrategiesData> {
  const res = await apiFetch<{ success: boolean } & StrategiesData>(
    '/admin/strategies',
    { auth: true },
  )
  return { enabled: res.enabled, trades: res.trades }
}

export async function setStrategyEnabled(
  key: string,
  enabled: boolean,
): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `/admin/strategies/${encodeURIComponent(key)}`,
    { method: 'PUT', body: { enabled }, auth: true },
  )
}

export async function getAdminPositions(): Promise<AdminPositionsData> {
  const res = await apiFetch<{ success: boolean } & AdminPositionsData>(
    '/admin/positions',
    { auth: true },
  )
  return { positions: res.positions, trades: res.trades }
}

export async function deleteAdminPosition(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/positions/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

export async function deleteAdminPastTrade(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/past-positions/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

export async function acceptUser(uniId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/users/${uniId}/accept`, {
    method: 'POST',
    auth: true,
  })
}

export async function rejectUser(uniId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/users/${uniId}/reject`, {
    method: 'POST',
    auth: true,
  })
}

/* ============ user detail (/admin/users/{uniId}) ============ */

export async function getAdminUserDetail(
  uniId: string,
): Promise<AdminUserDetail> {
  const res = await apiFetch<{ success: boolean; user: AdminUserDetail }>(
    `/admin/users/${uniId}`,
    { auth: true },
  )
  return res.user
}

export async function getAdminUserSummary(
  uniId: string,
): Promise<AdminUserSummary> {
  const res = await apiFetch<{ success: boolean; summary: AdminUserSummary }>(
    `/admin/users/${uniId}/summary`,
    { auth: true },
  )
  return res.summary
}

export async function getAdminUserDailyPnl(
  uniId: string,
): Promise<DailyPnlMap> {
  const res = await apiFetch<{ success: boolean; days: DailyPnlMap }>(
    `/admin/users/${uniId}/daily-pnl`,
    { auth: true },
  )
  // PHP serializes an empty map as [] — normalize to an object
  return Array.isArray(res.days) ? {} : res.days
}

export async function getAdminUserPositions(
  uniId: string,
): Promise<AdminPositionsData> {
  const res = await apiFetch<{ success: boolean } & AdminPositionsData>(
    `/admin/users/${uniId}/positions`,
    { auth: true },
  )
  return { positions: res.positions, trades: res.trades }
}

export async function getAdminUserInvoices(uniId: string): Promise<Invoice[]> {
  const res = await apiFetch<{ success: boolean; invoices: ApiInvoice[] }>(
    `/admin/users/${uniId}/invoices`,
    { auth: true },
  )
  return res.invoices.map(mapApiInvoice)
}

export async function getAdminUserReferrals(
  uniId: string,
): Promise<UserReferralRow[]> {
  const res = await apiFetch<{ success: boolean; referrals: UserReferralRow[] }>(
    `/admin/affiliate/users/${uniId}/referrals`,
    { auth: true },
  )
  return res.referrals
}

export async function updateAdminUser(
  uniId: string,
  input: AdminUserUpdateInput,
): Promise<Omit<AdminUserDetail, 'accounts'>> {
  const res = await apiFetch<{
    success: boolean
    user: Omit<AdminUserDetail, 'accounts'>
  }>(`/admin/users/${uniId}`, { method: 'PUT', body: input, auth: true })
  return res.user
}

/* ============ invoices ============ */

export interface AdminInvoiceRow extends Invoice {
  userName: string | null
  userEmail: string | null
}

export interface AdminInvoicesSummary {
  totalCollected: number
  countTotal: number
  countPaid: number
  countPending: number
  outstandingAmount: number
}

export interface AdminInvoicesData {
  invoices: AdminInvoiceRow[]
  summary: AdminInvoicesSummary
}

export interface AdminInvoiceFilters {
  status?: string
  exchange?: string
  search?: string
}

type AdminApiInvoice = ApiInvoice & {
  user_name: string | null
  user_email: string | null
}

export async function getAdminInvoices(
  filters: AdminInvoiceFilters = {},
): Promise<AdminInvoicesData> {
  const qs = new URLSearchParams()
  if (filters.status && filters.status !== 'all') qs.set('status', filters.status)
  if (filters.exchange && filters.exchange !== 'all') qs.set('exchange', filters.exchange)
  if (filters.search) qs.set('search', filters.search)
  const query = qs.toString() ? `?${qs.toString()}` : ''

  const res = await apiFetch<{
    success: boolean
    invoices: AdminApiInvoice[]
    summary: {
      total_collected: number
      count_total: number
      count_paid: number
      count_pending: number
      outstanding_amount: number
    }
  }>(`/admin/invoices${query}`, { auth: true })

  return {
    invoices: res.invoices.map((r) => ({
      ...mapApiInvoice(r),
      userName: r.user_name,
      userEmail: r.user_email,
    })),
    summary: {
      totalCollected: res.summary.total_collected,
      countTotal: res.summary.count_total,
      countPaid: res.summary.count_paid,
      countPending: res.summary.count_pending,
      outstandingAmount: res.summary.outstanding_amount,
    },
  }
}

export interface GenerateInvoiceInput {
  uni_id?: string
  account_id?: number
  exchange?: string
  month_year: string
  invoice_demo?: boolean
}

export async function generateInvoices(
  input: GenerateInvoiceInput,
): Promise<Invoice[]> {
  const res = await apiFetch<{ success: boolean; invoices: ApiInvoice[] }>(
    '/admin/invoices/generate',
    { method: 'POST', body: input, auth: true },
  )
  return res.invoices.map(mapApiInvoice)
}

export async function updateInvoice(
  id: string,
  body: { total_fee?: number; status?: string },
): Promise<Invoice> {
  const res = await apiFetch<{ success: boolean; invoice: ApiInvoice }>(
    `/admin/invoices/${id}`,
    { method: 'PUT', body, auth: true },
  )
  return mapApiInvoice(res.invoice)
}

export async function deleteInvoice(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/invoices/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

/* ============ bot engine ============ */

export async function getEngineStatus(): Promise<AdminEngineStatus> {
  const res = await apiFetch<{ success: boolean; engine: AdminEngineStatus }>(
    '/admin/engine/status',
    { auth: true },
  )
  return res.engine
}

export async function getEngineLogs(lines: number): Promise<EngineLogsData> {
  const res = await apiFetch<{ success: boolean } & EngineLogsData>(
    `/admin/engine/logs?lines=${lines}`,
    { auth: true },
  )
  return { available: res.available, lines: res.lines ?? [] }
}

/** Restart the systemd unit — may take a few seconds server-side. */
export async function restartEngine(): Promise<EngineRestartResult> {
  const res = await apiFetch<{ success: boolean } & EngineRestartResult>(
    '/admin/engine/restart',
    { method: 'POST', auth: true },
  )
  return { state: res.state ?? null }
}

/* ============ sandbox (testing) ============ */

export async function getSandboxUsers(): Promise<SandboxUser[]> {
  const res = await apiFetch<{ success: boolean; users: SandboxUser[] }>(
    '/admin/sandbox/users',
    { auth: true },
  )
  return res.users
}

export async function createTestUser(
  input: TestUserInput,
): Promise<SandboxUser> {
  const res = await apiFetch<{ success: boolean; user: SandboxUser }>(
    '/admin/sandbox/users',
    { method: 'POST', body: input, auth: true },
  )
  return res.user
}

export async function deleteSandboxUser(uniId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/sandbox/users/${uniId}`, {
    method: 'DELETE',
    auth: true,
  })
}

export async function clearSandboxPositions(uniId: string): Promise<number> {
  const res = await apiFetch<{ success: boolean; deleted: number }>(
    `/admin/sandbox/users/${uniId}/positions`,
    { method: 'DELETE', auth: true },
  )
  return res.deleted
}

export async function insertPastPositions(
  input: SandboxPositionInput,
): Promise<{ inserted: number; account: { api_key: string; name: string } }> {
  const res = await apiFetch<{
    success: boolean
    inserted: number
    account: { api_key: string; name: string }
  }>('/admin/sandbox/positions', { method: 'POST', body: input, auth: true })
  return { inserted: res.inserted, account: res.account }
}

/* ============ invoice scenario runner ============ */

/** The catalogue — read-only, safe to call without touching any data. */
export async function getInvoiceScenarios(): Promise<InvoiceScenario[]> {
  const res = await apiFetch<{ success: boolean; scenarios: InvoiceScenario[] }>(
    '/admin/sandbox/invoice-scenarios',
    { auth: true },
  )
  return res.scenarios
}

/**
 * Run the suite (or the given `keys`). Every write lands on a throwaway
 * `SBXINV-` account created under the user — real exchange accounts, their
 * trade history and their invoices are never touched.
 */
export async function runInvoiceScenarios(
  input: ScenarioRunInput,
): Promise<ScenarioRun> {
  const res = await apiFetch<{ success: boolean } & ScenarioRun>(
    '/admin/sandbox/invoice-scenarios/run',
    { method: 'POST', body: input, auth: true },
  )
  return {
    month_year: res.month_year,
    rates: res.rates,
    cleaned_up: res.cleaned_up,
    account: res.account,
    passed: res.passed,
    failed: res.failed,
    results: res.results,
  }
}

/**
 * Delete a user's invoices. Settled ones are spared unless `includePaid` is
 * set; pass `accountId` to limit the wipe to a single exchange account.
 */
export async function clearUserInvoices(
  uniId: string,
  opts: { accountId?: number; includePaid?: boolean } = {},
): Promise<ClearInvoicesResult> {
  const params = new URLSearchParams()
  if (opts.accountId !== undefined) params.set('account_id', String(opts.accountId))
  if (opts.includePaid) params.set('include_paid', 'true')
  const query = params.toString() ? `?${params}` : ''

  const res = await apiFetch<{ success: boolean } & ClearInvoicesResult>(
    `/admin/sandbox/users/${uniId}/invoices${query}`,
    { method: 'DELETE', auth: true },
  )
  return { deleted: res.deleted, skipped_paid: res.skipped_paid }
}

/** Remove the scratch account a scenario run created, with everything it owns. */
export async function clearScenarioAccount(uniId: string): Promise<boolean> {
  const res = await apiFetch<{ success: boolean; deleted: boolean }>(
    `/admin/sandbox/users/${uniId}/scenario-account`,
    { method: 'DELETE', auth: true },
  )
  return res.deleted
}

/* ============ database browser ============ */

export async function getDatabaseTables(): Promise<DatabaseTablesData> {
  const res = await apiFetch<{ success: boolean } & DatabaseTablesData>(
    '/admin/database/tables',
    { auth: true },
  )
  return { database: res.database, driver: res.driver, tables: res.tables }
}

export async function getTableStructure(
  table: string,
): Promise<TableStructure> {
  return apiFetch<{ success: boolean } & TableStructure>(
    `/admin/database/tables/${encodeURIComponent(table)}/structure`,
    { auth: true },
  )
}

export async function getTableRows(
  table: string,
  params: TableRowsParams = {},
): Promise<TableRowsData> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.per_page) query.set('per_page', String(params.per_page))
  if (params.sort) query.set('sort', params.sort)
  if (params.direction) query.set('direction', params.direction)
  if (params.search) query.set('search', params.search)

  const qs = query.toString()
  return apiFetch<{ success: boolean } & TableRowsData>(
    `/admin/database/tables/${encodeURIComponent(table)}/rows${qs ? `?${qs}` : ''}`,
    { auth: true },
  )
}

export async function createTableRow(
  table: string,
  values: DbRow,
): Promise<DbRow | null> {
  const res = await apiFetch<{ success: boolean; row: DbRow | null }>(
    `/admin/database/tables/${encodeURIComponent(table)}/rows`,
    { method: 'POST', body: { values }, auth: true },
  )
  return res.row
}

export async function updateTableRow(
  table: string,
  key: DbRow,
  values: DbRow,
): Promise<DbRow | null> {
  const res = await apiFetch<{ success: boolean; row: DbRow | null }>(
    `/admin/database/tables/${encodeURIComponent(table)}/rows`,
    { method: 'PUT', body: { key, values }, auth: true },
  )
  return res.row
}

export async function deleteTableRow(
  table: string,
  key: DbRow,
): Promise<number> {
  const res = await apiFetch<{ success: boolean; deleted: number }>(
    `/admin/database/tables/${encodeURIComponent(table)}/rows`,
    { method: 'DELETE', body: { key }, auth: true },
  )
  return res.deleted
}

export async function runSqlQuery(
  input: SqlQueryInput,
): Promise<SqlQueryResult> {
  return apiFetch<{ success: boolean } & SqlQueryResult>(
    '/admin/database/query',
    { method: 'POST', body: input, auth: true },
  )
}

/**
 * Flush server-side caches: Laravel config/route/view plus the engine's
 * cached account + asset lists. Does not affect browser caching — nginx
 * serves index.html no-cache so clients always pick up a new build.
 */
export function clearServerCaches(): Promise<CacheClearResult> {
  return apiFetch<CacheClearResult>('/admin/cache/clear', {
    method: 'POST',
    auth: true,
  })
}
