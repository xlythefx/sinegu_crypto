import { apiFetch, API_URL, ApiError } from './api'
import { getToken } from '../lib/session'
import { mapApiInvoice, type ApiInvoice, type Invoice } from '../lib/billing'
import { sortSteps } from '../lib/streakSizing'
import type {
  AdminApiKey,
  AdminApiKeyCounts,
  AdminApiKeysData,
  AdminApiKeyUpdateInput,
  AdminAsset,
  AdminEngineStatus,
  AdminExchangeScope,
  ApiKeyRef,
  LedgerPlan,
  AdminPastTradeUpdate,
  AdminPerformance,
  AdminPositionsData,
  AdminPositionUpdate,
  AdminUser,
  AdminUserCreateInput,
  AdminUserDetail,
  AdminUserSummary,
  AdminTronAmountMismatch,
  AdminTronAttributeRequest,
  AdminTronCounts,
  AdminTronNetwork,
  AdminTronNetworkMismatch,
  AdminTronTransfer,
  AdminTronTransfersData,
  AdminUserUpdateInput,
  AssetHistoryPage,
  AssetInput,
  AssetStreakSize,
  AssetStreakSizingInput,
  AssetStreaks,
  BinanceSizingCheckData,
  PositionLimitData,
  BulkKeyDeleteResult,
  CacheClearResult,
  ClearInvoicesResult,
  DailyPnlMap,
  DatabaseTablesData,
  DbRow,
  EngineLogsData,
  EngineRestartResult,
  KeyIssueAccount,
  KeyIssuesData,
  KeyRecheckResult,
  InvoiceScenario,
  MasterStats,
  PerformanceFilters,
  PurgeKeyResult,
  RecapKind,
  RecapPreviewDay,
  RecapPreviewResult,
  SandboxPositionInput,
  SandboxUser,
  ScenarioRun,
  ScenarioRunInput,
  SqlQueryInput,
  SqlQueryResult,
  StrategiesData,
  StrategyScope,
  TableRowsData,
  TableRowsParams,
  TableStructure,
  TestUserInput,
  UserReferralRow,
  TimelineEvent,
  CustomerSignals,
} from '../types/admin'
import type { AdminSignupInfo } from '../types/signupInfo'
import type { VsMasterData } from '../types/vsMaster'

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

/**
 * Coerce the streak-sizing fields so every reader can rely on them: an API
 * that predates the feature sends neither, a step with no `kind` is a loss
 * step (the only kind there used to be), and the ladder is always loss steps
 * then win steps, each shallowest first — the order `lib/streakSizing.ts`
 * and the editor read in. The kill-switch fields get the same treatment: an
 * API without them reads as "no kill switch, never tripped".
 */
function leverageOf(raw: unknown): number | null {
  const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 125 ? n : null
}

function normalizeAsset(asset: AdminAsset): AdminAsset {
  if (!asset) return asset
  const raw: Partial<AssetStreakSize>[] = Array.isArray(asset.streak_sizes)
    ? asset.streak_sizes
    : []
  const steps = raw
    .map(
      (s): AssetStreakSize => ({
        kind: s.kind === 'win' ? 'win' : 'loss',
        streak: Number(s.streak),
        size: Number(s.size),
      }),
    )
    .filter((s) => Number.isFinite(s.streak) && Number.isFinite(s.size))
  const kill =
    asset.kill_switch_losses === null || asset.kill_switch_losses === undefined
      ? null
      : Number(asset.kill_switch_losses)
  const pending = asset.pending_sizing
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
  return {
    ...asset,
    streak_sizing_enabled: Boolean(asset.streak_sizing_enabled),
    streak_sizes: sortSteps(steps),
    kill_switch_losses: kill !== null && Number.isInteger(kill) && kill > 0 ? kill : null,
    // An API older than the column sends none: "not set", the alert's leverage applies.
    leverage: leverageOf(asset.leverage),
    killed_at: asset.killed_at || null,
    killed_reason: asset.killed_reason || null,
    kill_switch_armed_at: asset.kill_switch_armed_at || null,
    pending_sizing: pending
      ? {
          base_size: Number(pending.base_size),
          max_increments: Number(pending.max_increments),
          streak_sizing_enabled: Boolean(pending.streak_sizing_enabled),
          streak_sizes: sortSteps(
            (Array.isArray(pending.streak_sizes) ? pending.streak_sizes : []).map(
              (s): AssetStreakSize => ({
                kind: s.kind === 'win' ? 'win' : 'loss',
                streak: Number(s.streak),
                size: Number(s.size),
              }),
            ),
          ),
          since: pending.since || null,
          by_name: pending.by_name || null,
          waits_for: pending.waits_for ?? null,
        }
      : null,
    main_account: {
      balance: num(asset.main_account?.balance),
      price: num(asset.main_account?.price),
    },
  }
}

/**
 * GET /admin/assets/binance-check — for the asset form, before saving: the
 * coin's order minimums and mark price on Binance, the smallest account the
 * engine would trade it on, and the leverage the signals carry.
 */
export async function getBinanceSizingCheck(ticker: string): Promise<BinanceSizingCheckData> {
  return apiFetch<BinanceSizingCheckData & { success: boolean }>(
    `/admin/assets/binance-check?ticker=${encodeURIComponent(ticker)}`,
    { auth: true },
  )
}

/**
 * POST /admin/assets/position-limit — a proposed base / max size and leverage
 * against Binance's position limit, for every real-money account (the engine
 * works it out with the same sizing the next signal uses).
 */
export async function checkPositionLimit(input: {
  ticker: string
  baseSize: number
  maxPosition: number
  leverage: number | null
}): Promise<PositionLimitData> {
  return apiFetch<PositionLimitData>('/admin/assets/position-limit', {
    method: 'POST',
    auth: true,
    body: {
      ticker: input.ticker,
      base_size: input.baseSize,
      max_increments: input.maxPosition,
      leverage: input.leverage,
    },
  })
}

export async function getAdminAssets(): Promise<AdminAsset[]> {
  const res = await apiFetch<{ success: boolean; assets: AdminAsset[] }>(
    '/admin/assets',
    { auth: true },
  )
  return res.assets.map(normalizeAsset)
}

/**
 * PUT /admin/assets/{id}/streak-sizing — the Streak Sizing Settings tab's
 * save. Replaces the switch and the whole ladder (an empty list clears it);
 * 422 when a streak is outside 1–10, a (kind, streak) pair repeats, or a size
 * is not above zero. `kill_switch_losses` rides along only when the caller
 * sends it (absent = unchanged, null = off).
 */
export async function saveAssetStreakSizing(
  assetId: number,
  input: AssetStreakSizingInput,
): Promise<AdminAsset> {
  const res = await apiFetch<{ success: boolean; message: string; asset: AdminAsset }>(
    `/admin/assets/${assetId}/streak-sizing`,
    { method: 'PUT', body: input, auth: true },
  )
  return normalizeAsset(res.asset)
}

/**
 * GET /admin/assets/{id}/streaks — accounts on each run right now. `run` is
 * signed (negative = losses in a row, positive = wins, 0 = no run yet).
 */
export async function getAssetStreaks(assetId: number): Promise<AssetStreaks> {
  const res = await apiFetch<
    { success: boolean; master_run?: number | null } & Omit<AssetStreaks, 'masterRun'>
  >(`/admin/assets/${assetId}/streaks`, { auth: true })
  const runs = Array.isArray(res.runs) ? res.runs : []
  const masterRun = res.master_run === null || res.master_run === undefined ? null : Number(res.master_run)
  return {
    exchange: res.exchange ?? null,
    symbol: res.symbol,
    depth: Number(res.depth) || 0,
    masterRun: masterRun !== null && Number.isFinite(masterRun) ? masterRun : null,
    accounts: res.accounts ?? 0,
    runs: runs
      .map((r) => ({ run: Number(r.run), accounts: Number(r.accounts) }))
      .filter((r) => Number.isFinite(r.run) && Number.isFinite(r.accounts))
      .sort((a, b) => a.run - b.run),
  }
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
  // Sizing rides along only when the caller owns it: absent = unchanged on
  // the API, which is what the on/off switch needs. Re-sending the live
  // sizes would cancel a size change that is waiting for a close.
  if (input.max_increments !== undefined) form.append('max_increments', String(input.max_increments))
  if (input.base_size !== undefined) form.append('base_size', String(input.base_size))
  form.append('enabled', input.enabled ? '1' : '0')
  // The ladder rides along ONLY when the caller owns it. Absent = "leave it
  // as it is" on the API, which is what the card's enable/disable toggle
  // needs; present with no steps = "no steps".
  if (input.streak_sizing_enabled !== undefined) {
    form.append('streak_sizing_enabled', input.streak_sizing_enabled ? '1' : '0')
    ;(input.streak_sizes ?? []).forEach((step, i) => {
      form.append(`streak_sizes[${i}][kind]`, step.kind)
      form.append(`streak_sizes[${i}][streak]`, String(step.streak))
      form.append(`streak_sizes[${i}][size]`, String(step.size))
    })
  }
  // Same rule for the kill switch: absent = unchanged, '' = off, '1'..'10' = on.
  if (input.kill_switch_losses !== undefined) {
    form.append(
      'kill_switch_losses',
      input.kill_switch_losses === null ? '' : String(input.kill_switch_losses),
    )
  }
  // And for the coin's leverage: absent = unchanged, '' = not set (the alert's applies).
  if (input.leverage !== undefined) {
    form.append('leverage', input.leverage === null ? '' : String(input.leverage))
  }
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
  return normalizeAsset((data as { asset: AdminAsset }).asset)
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

/**
 * Switch one asset on or off and change NOTHING else: the identifying fields
 * are re-posted as they are, and the sizing, the streak ladder and the kill
 * switch are left out so the API keeps them, including a size change that is
 * waiting for a close. Turning a coin the kill switch stopped back on goes
 * through here: the API clears the kill and starts counting again.
 */
export function setAssetEnabled(asset: AdminAsset, enabled: boolean): Promise<AdminAsset> {
  return updateAsset(asset.asset_id, {
    ticker: asset.ticker,
    type: asset.type,
    broker: asset.broker,
    side: asset.side,
    enabled,
  })
}

/** POST /admin/assets/{id}/pending-sizing/apply: put the waiting size live now, without waiting for the close. */
export async function applyPendingSizing(assetId: number): Promise<AdminAsset> {
  const res = await apiFetch<{ success: boolean; asset: AdminAsset }>(
    `/admin/assets/${assetId}/pending-sizing/apply`,
    { method: 'POST', auth: true },
  )
  return normalizeAsset(res.asset)
}

/** DELETE /admin/assets/{id}/pending-sizing: drop the waiting size change; the live size stays. */
export async function cancelPendingSizing(assetId: number): Promise<AdminAsset> {
  const res = await apiFetch<{ success: boolean; asset: AdminAsset }>(
    `/admin/assets/${assetId}/pending-sizing`,
    { method: 'DELETE', auth: true },
  )
  return normalizeAsset(res.asset)
}

/**
 * GET /admin/assets/history: every change to asset settings, newest first.
 * `assetId` narrows to one coin card, `broker` to one exchange; `beforeId`
 * pages back.
 */
export async function getAssetHistory(
  opts: { assetId?: number; broker?: string; beforeId?: number; limit?: number } = {},
): Promise<AssetHistoryPage> {
  const params = new URLSearchParams()
  if (opts.assetId) params.set('asset_id', String(opts.assetId))
  if (opts.broker) params.set('broker', opts.broker)
  if (opts.beforeId) params.set('before_id', String(opts.beforeId))
  if (opts.limit) params.set('limit', String(opts.limit))
  const qs = params.toString()
  const res = await apiFetch<{ success: boolean } & AssetHistoryPage>(
    qs ? `/admin/assets/history?${qs}` : '/admin/assets/history',
    { auth: true },
  )
  return {
    changes: Array.isArray(res.changes) ? res.changes : [],
    has_more: Boolean(res.has_more),
  }
}

export async function deleteAsset(assetId: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/assets/${assetId}`, {
    method: 'DELETE',
    auth: true,
  })
}

/**
 * Tagged closed trades from every exchange. `scope`:
 * `master` = the master account alone (the strategy's true result),
 * `customers` = every customer pooled (both real money only), `all`
 * (default) = both plus tester accounts' test-feed trades (demo included).
 */
export async function getStrategies(
  scope: StrategyScope = 'all',
  exchange: AdminExchangeScope = 'all',
): Promise<StrategiesData> {
  const params = new URLSearchParams()
  if (scope !== 'all') params.set('scope', scope)
  if (exchange !== 'all') params.set('exchange', exchange)
  const qs = params.toString()
  const res = await apiFetch<{ success: boolean } & StrategiesData>(
    qs ? `/admin/strategies?${qs}` : '/admin/strategies',
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

/** Ask the engine to read every account's open positions now (poller: 300 s). */
export async function refreshAdminPositions(): Promise<void> {
  await apiFetch<{ success: boolean }>('/admin/positions/refresh', { method: 'POST', auth: true })
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

/** Correct one open position row. The poller overwrites it on the account's
 *  next sync — this fixes what is displayed, not what Binance holds. */
export async function updateAdminPosition(
  id: number,
  input: AdminPositionUpdate,
): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/positions/${id}`, {
    method: 'PUT',
    body: input,
    auth: true,
  })
}

/** Correct one closed trade row — permanent, and read by invoicing. */
export async function updateAdminPastTrade(
  id: number,
  input: AdminPastTradeUpdate,
): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/past-positions/${id}`, {
    method: 'PUT',
    body: input,
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

/**
 * The `?exchange=` every per-user read takes — the detail page's exchange
 * pill. 'all' is the server default, so it sends nothing.
 */
function exchangeQuery(exchange: AdminExchangeScope): string {
  return exchange === 'all' ? '' : `?exchange=${exchange}`
}

export async function getAdminUserDetail(
  uniId: string,
): Promise<AdminUserDetail> {
  const res = await apiFetch<{ success: boolean; user: AdminUserDetail }>(
    `/admin/users/${uniId}`,
    { auth: true },
  )
  return res.user
}

/**
 * How a user signed up and every sign-in since: where they heard about us,
 * their Telegram / Discord, and the IP / country / device of each visit.
 * Readable by every staff role, collaborators included.
 */
export function getAdminUserSignupInfo(uniId: string): Promise<AdminSignupInfo> {
  return apiFetch<AdminSignupInfo>(`/admin/users/${uniId}/signup-info`, { auth: true })
}

export async function getAdminUserSummary(
  uniId: string,
  exchange: AdminExchangeScope = 'all',
): Promise<AdminUserSummary> {
  const res = await apiFetch<{ success: boolean; summary: AdminUserSummary }>(
    `/admin/users/${uniId}/summary${exchangeQuery(exchange)}`,
    { auth: true },
  )
  return res.summary
}

export async function getAdminUserDailyPnl(
  uniId: string,
  exchange: AdminExchangeScope = 'all',
): Promise<DailyPnlMap> {
  const res = await apiFetch<{ success: boolean; days: DailyPnlMap }>(
    `/admin/users/${uniId}/daily-pnl${exchangeQuery(exchange)}`,
    { auth: true },
  )
  // PHP serializes an empty map as [] — normalize to an object
  return Array.isArray(res.days) ? {} : res.days
}

export async function getAdminUserPositions(
  uniId: string,
  exchange: AdminExchangeScope = 'all',
): Promise<AdminPositionsData> {
  const res = await apiFetch<{ success: boolean } & AdminPositionsData>(
    `/admin/users/${uniId}/positions${exchangeQuery(exchange)}`,
    { auth: true },
  )
  return { positions: res.positions, trades: res.trades }
}

export async function getAdminUserInvoices(
  uniId: string,
  exchange: AdminExchangeScope = 'all',
): Promise<Invoice[]> {
  const res = await apiFetch<{ success: boolean; invoices: ApiInvoice[] }>(
    `/admin/users/${uniId}/invoices${exchangeQuery(exchange)}`,
    { auth: true },
  )
  return res.invoices.map(mapApiInvoice)
}

/** Everything that happened to this customer, newest first (admin only). */
export async function getAdminUserTimeline(uniId: string): Promise<TimelineEvent[]> {
  const res = await apiFetch<{ success: boolean; events: TimelineEvent[] }>(
    `/admin/users/${uniId}/timeline`,
    { auth: true },
  )
  return res.events
}

export async function addAdminUserNote(uniId: string, body: string): Promise<void> {
  await apiFetch(`/admin/users/${uniId}/notes`, { method: 'POST', body: { body }, auth: true })
}

export async function deleteAdminUserNote(uniId: string, noteId: number): Promise<void> {
  await apiFetch(`/admin/users/${uniId}/notes/${noteId}`, { method: 'DELETE', auth: true })
}

/** The bot's last signals for this customer and why it skipped (admin only). */
export async function getAdminUserSignals(uniId: string, limit = 8): Promise<CustomerSignals> {
  const res = await apiFetch<{ success: boolean } & CustomerSignals>(
    `/admin/users/${uniId}/signals?limit=${limit}`,
    { auth: true },
  )
  return { signals: res.signals, last_7_days: res.last_7_days }
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

/** Create an account from the admin side. Returns it with no exchange accounts. */
export async function createAdminUser(
  input: AdminUserCreateInput,
): Promise<Omit<AdminUserDetail, 'accounts'>> {
  const res = await apiFetch<{
    success: boolean
    user: Omit<AdminUserDetail, 'accounts'>
  }>('/admin/users', { method: 'POST', body: input, auth: true })
  return res.user
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

/** Permanently delete a suspended user with nothing on record. */
export async function deleteAdminUser(uniId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/users/${uniId}`, { method: 'DELETE', auth: true })
}

/**
 * Read this user's connected accounts from their exchanges now (balance +
 * open positions). Resolves with the API's message; the caller re-reads.
 */
export async function refreshAdminUser(uniId: string): Promise<string> {
  const res = await apiFetch<{ success: boolean; message: string }>(
    `/admin/users/${uniId}/refresh`,
    { method: 'POST', auth: true },
  )
  return res.message
}

/* ============ invoices ============ */

export interface AdminInvoiceRow extends Invoice {
  userName: string | null
  userEmail: string | null
}

/**
 * How a paid invoice was paid (API `Billing\PaymentMethod` — the same words
 * the payment emails and the Telegram message use).
 */
export interface AdminInvoicePayment {
  /** stripe | tron | coinsbuy | manual; null = paid before the rail was recorded. */
  provider: string | null
  kind: 'card' | 'crypto' | 'manual' | 'unknown'
  /** "Card (Stripe)", "USDT (TRC-20)", "Marked paid by an admin", … */
  label: string
  /** A Stripe test session or USDT on the Nile testnet: not real money. */
  test: boolean
  /** Stripe's checkout session id, or the TRON transaction hash. */
  reference: string | null
  /** The invoice's own dollar figure, as settled. */
  paid_amount: number | null
  paid_at: string | null
  network: string | null
  /** TronScan, for a USDT payment. */
  explorer_url: string | null
  /** What actually arrived on chain (it can be short by an exchange's withdrawal fee). */
  received: { amount: string; asset: string } | null
  /** Marked paid BY HAND: how the money came (absent on an older API). */
  manual_method?: ManualPaymentMethod | null
  /** The admin's note on a hand-marked payment, or on a transfer matched by hand. */
  note?: string | null
  /** Which admin marked it paid / matched the transfer. */
  marked_by?: { uni_id: string; name: string } | null
}

/** How the money came, when an admin marks an invoice paid by hand (2026-11-11). */
export type ManualPaymentMethod = 'bank_transfer' | 'crypto_wallet' | 'cash' | 'other'

/** GET /admin/invoices/{id} — one invoice with its customer and its payment. */
export interface AdminInvoiceView extends AdminInvoiceRow {
  /** The customer's uni_id — the link to their profile. */
  userId: string | null
  payment: AdminInvoicePayment | null
}

export async function getAdminInvoice(id: string): Promise<AdminInvoiceView> {
  const res = await apiFetch<{
    success: boolean
    invoice: AdminApiInvoice & { payment?: AdminInvoicePayment | null }
  }>(`/admin/invoices/${encodeURIComponent(id)}`, { auth: true })
  return {
    ...mapApiInvoice(res.invoice),
    userName: res.invoice.user_name,
    userEmail: res.invoice.user_email,
    userId: res.invoice.user_id ?? null,
    payment: res.invoice.payment ?? null,
  }
}

export interface AdminInvoicesSummary {
  totalCollected: number
  countTotal: number
  /** Paid invoices with a fee — a $0 month is not a payment. */
  countPaid: number
  /** Unpaid invoices with a fee. */
  countPending: number
  /** $0 months (stored paid, collected nothing). */
  countNoFee: number
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
      /** Absent on an API older than 2026-11-11. */
      count_no_fee?: number
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
      countNoFee: res.summary.count_no_fee ?? 0,
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
  /** Admin → Sandbox only: lets the master account be billed (it never is otherwise). */
  sandbox?: boolean
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

export interface ManualInvoiceInput {
  /** A binance_accounts id — manual invoices are Binance-only, like generate. */
  account_id: number
  month_year: string
  amount: number
  /** Admin → Sandbox only: lets the master account be billed (it never is otherwise). */
  sandbox?: boolean
}

/** One invoice at a typed fee; replaces that month's unpaid invoice, refuses a paid one. */
export async function createManualInvoice(input: ManualInvoiceInput): Promise<Invoice> {
  const res = await apiFetch<{ success: boolean; invoices: ApiInvoice[] }>(
    '/admin/invoices/manual',
    { method: 'POST', body: input, auth: true },
  )
  return mapApiInvoice(res.invoices[0])
}

export async function updateInvoice(
  id: string,
  /**
   * sandbox: a rehearsal — settling it is not announced to anyone.
   * method + note: REQUIRED to mark a real invoice paid by hand (how the
   * money came, and a short note), so "how was it paid" always has an answer.
   */
  body: {
    total_fee?: number
    status?: string
    sandbox?: boolean
    method?: ManualPaymentMethod
    note?: string
  },
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

/**
 * Accounts whose API key the exchange is refusing. Reads columns the engine
 * already wrote, so opening the page costs nothing at Binance.
 */
export async function getEngineKeyIssues(): Promise<KeyIssuesData> {
  const res = await apiFetch<{
    success: boolean
    grace_days: number
    server_ip: string | null
    accounts: KeyIssueAccount[]
  }>('/admin/engine/key-issues', { auth: true })

  return {
    graceDays: res.grace_days,
    serverIp: res.server_ip,
    accounts: res.accounts ?? [],
  }
}

/**
 * Re-test one account against its exchange from the admin side. Addressed by
 * (exchange, id): ids repeat across the per-exchange account tables.
 */
export async function recheckEngineKey(
  key: ApiKeyRef,
): Promise<KeyRecheckResult> {
  return apiFetch<KeyRecheckResult>(
    `/admin/engine/key-issues/${key.exchange}/${key.id}/recheck`,
    { method: 'POST', auth: true },
  )
}

/* ============ API-key inventory (/admin/api-keys) ============ */

/**
 * Every exchange account in the system with its owner, on every exchange,
 * soft-deleted ones included. Reads DB columns only — no exchange round trips.
 */
export async function getAdminApiKeys(): Promise<AdminApiKeysData> {
  const res = await apiFetch<{
    success: boolean
    grace_days: number
    server_ip: string | null
    counts: AdminApiKeyCounts
    keys: AdminApiKey[]
  }>('/admin/api-keys', { auth: true })

  return {
    graceDays: res.grace_days,
    serverIp: res.server_ip,
    counts: res.counts,
    keys: res.keys ?? [],
  }
}

/** Rename / enable / disable one account. */
export async function updateAdminApiKey(
  key: ApiKeyRef,
  input: AdminApiKeyUpdateInput,
): Promise<AdminApiKey> {
  const res = await apiFetch<{ success: boolean; key: AdminApiKey }>(
    `/admin/api-keys/${key.exchange}/${key.id}`,
    { method: 'PUT', body: input, auth: true },
  )
  return res.key
}

/** Disconnect one account (soft delete — the trade history survives). */
/**
 * Preview an account's transfer history from the exchange's own ledger. Writes
 * nothing, but spends exchange calls (made by the engine) — only on a click.
 */
export async function getAdminApiKeyLedger(key: ApiKeyRef): Promise<LedgerPlan> {
  const res = await apiFetch<{ success: boolean; plan: LedgerPlan }>(
    `/admin/api-keys/${key.exchange}/${key.id}/ledger`,
    { auth: true },
  )
  return res.plan
}

/**
 * Apply the previewed ledger. The server re-reads the exchange and refuses
 * (409 LEDGER_CHANGED) unless it still matches what was confirmed.
 */
export async function applyAdminApiKeyLedger(
  key: ApiKeyRef,
  plan: LedgerPlan,
): Promise<{ message: string; inserted: number; key: AdminApiKey }> {
  return apiFetch(`/admin/api-keys/${key.exchange}/${key.id}/ledger`, {
    method: 'POST',
    auth: true,
    body: {
      expected_initial: plan.initial_deposit.after,
      expected_missing: plan.transfers.filter((t) => !t.stored).map((t) => t.tran_id),
    },
  })
}

export async function deleteAdminApiKey(key: ApiKeyRef): Promise<void> {
  await apiFetch(`/admin/api-keys/${key.exchange}/${key.id}`, {
    method: 'DELETE',
    auth: true,
  })
}

/**
 * Erase one account and its market data from the database — the only hard
 * delete on the page. The server re-checks the guard (not-working keys only,
 * never one with invoices) and answers 422 if the row has since recovered.
 */
export async function purgeAdminApiKey(key: ApiKeyRef): Promise<PurgeKeyResult> {
  return apiFetch<PurgeKeyResult>(
    `/admin/api-keys/${key.exchange}/${key.id}/purge`,
    { method: 'DELETE', auth: true },
  )
}

/**
 * Disconnect several at once. The (exchange, id) pairs travel in the body,
 * so the server can only ever delete what the admin actually had on screen.
 */
export async function bulkDeleteAdminApiKeys(
  keys: ApiKeyRef[],
): Promise<BulkKeyDeleteResult> {
  return apiFetch<BulkKeyDeleteResult>('/admin/api-keys/bulk-delete', {
    method: 'POST',
    body: { keys: keys.map(({ exchange, id }) => ({ exchange, id })) },
    auth: true,
  })
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

/**
 * Render a recap as the scheduler would and send it to the ADMIN Telegram
 * group under a test banner — never the public channel. `on` picks the day
 * it is rendered "as of" (ISO date or 'yesterday'); null = right now.
 */
export async function previewRecap(
  kind: RecapKind,
  on: RecapPreviewDay = null,
): Promise<RecapPreviewResult> {
  const res = await apiFetch<{ success: boolean } & RecapPreviewResult>(
    '/admin/engine/reports/preview',
    { method: 'POST', auth: true, body: { kind, on } },
  )
  return {
    kind: res.kind,
    on: res.on ?? null,
    telegram: Boolean(res.telegram),
    messages: res.messages ?? [],
  }
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
 * Delete invoices. With `uniId` it clears that user's; without it, every
 * user's — a different URL, not a flag, so the global wipe cannot be reached
 * by accident. Settled invoices are spared unless `includePaid` is set; pass
 * `accountId` to limit the wipe to a single exchange account.
 */
export async function clearInvoices(
  opts: { uniId?: string; accountId?: number; includePaid?: boolean } = {},
): Promise<ClearInvoicesResult> {
  const params = new URLSearchParams()
  if (opts.accountId !== undefined) params.set('account_id', String(opts.accountId))
  if (opts.includePaid) params.set('include_paid', 'true')
  const query = params.toString() ? `?${params}` : ''
  const path = opts.uniId
    ? `/admin/sandbox/users/${opts.uniId}/invoices`
    : '/admin/sandbox/invoices'

  const res = await apiFetch<{ success: boolean } & ClearInvoicesResult>(
    `${path}${query}`,
    { method: 'DELETE', auth: true },
  )
  return {
    deleted: res.deleted,
    skipped_paid: res.skipped_paid,
    scope: res.scope,
    users: res.users,
  }
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

/* ── Admin → Crypto Transfers ─────────────────────────────────────────── */

/** GET /admin/tron-transfers — every USDT-TRC20 arrival, matched or not. */
export async function getAdminTronTransfers(): Promise<AdminTronTransfersData> {
  const res = await apiFetch<{
    success: boolean
    networks: AdminTronNetwork[]
    counts: AdminTronCounts
    transfers: AdminTronTransfer[]
  }>('/admin/tron-transfers', { auth: true })

  return {
    networks: res.networks ?? [],
    counts: res.counts,
    transfers: res.transfers ?? [],
  }
}

/** Error codes a 422 from `attributeTronTransfer` may carry. */
export const TRON_AMOUNT_MISMATCH = 'AMOUNT_MISMATCH'
export const TRON_NETWORK_MISMATCH = 'NETWORK_MISMATCH'

/**
 * Settle an invoice from a transfer the matcher could not place. The server
 * re-checks eligibility, so a 422 here means the world changed under the page.
 *
 * Three 422s: `ATTRIBUTION_REFUSED` and `NETWORK_MISMATCH` are final;
 * `AMOUNT_MISMATCH` is a confirm step — read it with
 * {@link readTronAmountMismatch} and call again with `acceptAmount: true`.
 * The key is sent only when true, so the ordinary request is unchanged.
 */
export async function attributeTronTransfer(
  id: number,
  invoiceId: number,
  options: { acceptAmount?: boolean } = {},
): Promise<{ settled: boolean; message: string }> {
  const body: AdminTronAttributeRequest = { invoice_id: invoiceId }
  if (options.acceptAmount) body.accept_amount = true

  const res = await apiFetch<{ success: boolean; settled: boolean; message: string }>(
    `/admin/tron-transfers/${id}/attribute`,
    { method: 'POST', auth: true, body },
  )
  return { settled: res.settled, message: res.message }
}

/**
 * The `AMOUNT_MISMATCH` detail off a failed attribute, or null for any other
 * failure. The figures are validated as numbers: a page that shows "$NaN"
 * beside an "Attribute anyway" button is worse than a plain error.
 */
export function readTronAmountMismatch(err: unknown): AdminTronAmountMismatch | null {
  if (!(err instanceof ApiError) || err.status !== 422 || err.errorCode !== TRON_AMOUNT_MISMATCH) {
    return null
  }
  const p = err.payload as Partial<AdminTronAmountMismatch> | undefined
  if (
    typeof p?.expected_usd !== 'number' ||
    typeof p.received_usdt !== 'number' ||
    typeof p.difference !== 'number'
  ) {
    return null
  }
  return {
    error_code: TRON_AMOUNT_MISMATCH,
    message: err.message,
    expected_usd: p.expected_usd,
    received_usdt: p.received_usdt,
    difference: p.difference,
    direction:
      p.direction === 'short' || p.direction === 'over'
        ? p.direction
        : p.difference < 0
          ? 'short'
          : 'over',
  }
}

/** The `NETWORK_MISMATCH` detail off a failed attribute, or null otherwise. */
export function readTronNetworkMismatch(err: unknown): AdminTronNetworkMismatch | null {
  if (!(err instanceof ApiError) || err.status !== 422 || err.errorCode !== TRON_NETWORK_MISMATCH) {
    return null
  }
  const p = err.payload as Partial<AdminTronNetworkMismatch> | undefined
  if (typeof p?.transfer_network !== 'string' || typeof p.invoice_network !== 'string') {
    return null
  }
  return {
    error_code: TRON_NETWORK_MISMATCH,
    message: err.message,
    transfer_network: p.transfer_network,
    invoice_network: p.invoice_network,
  }
}

/** Take a transfer out of the queue without pretending it never arrived. */
export async function ignoreTronTransfer(
  id: number,
  note?: string,
): Promise<{ message: string }> {
  const res = await apiFetch<{ success: boolean; message: string }>(
    `/admin/tron-transfers/${id}/ignore`,
    { method: 'POST', auth: true, body: { note } },
  )
  return { message: res.message }
}

/**
 * Close a "two customers claim the same payment" dispute, with a note saying
 * what was decided. Correcting the invoices is done with the existing tools;
 * this clears the alarm on the Admin Overview.
 */
export async function resolveTronClaim(
  claimId: number,
  note?: string,
): Promise<{ message: string }> {
  const res = await apiFetch<{ success: boolean; message: string }>(
    `/admin/tron-transfers/claims/${claimId}/resolve`,
    { method: 'POST', auth: true, body: { note } },
  )
  return { message: res.message }
}

/**
 * GET /admin/insights/vs-master — every customer's return beside the
 * master's over the same UTC days (full admins only). No dates = this month.
 */
export async function getVsMaster(params: {
  exchange?: string
  from?: string
  to?: string
}): Promise<VsMasterData> {
  const qs = new URLSearchParams()
  if (params.exchange && params.exchange !== 'all') qs.set('exchange', params.exchange)
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  const q = qs.toString()
  const res = await apiFetch<{ success: boolean } & VsMasterData>(
    q ? `/admin/insights/vs-master?${q}` : '/admin/insights/vs-master',
    { auth: true },
  )
  return { from: res.from, to: res.to, exchange: res.exchange, master: res.master, customers: res.customers }
}
