import { apiFetch, API_URL, ApiError } from './api'
import { getToken } from '../lib/session'
import { mapApiInvoice, type ApiInvoice, type Invoice } from '../lib/billing'
import type {
  AdminAsset,
  AdminPositionsData,
  AdminUser,
  AssetInput,
  DailyPnlMap,
  MasterStats,
  SandboxPositionInput,
  SandboxUser,
  StrategiesData,
  TestUserInput,
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
