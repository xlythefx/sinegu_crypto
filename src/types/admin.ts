import type { AssetSide } from './assets'
import type { FeeSource } from './dashboard'
import type { ExchangeKind } from './exchanges'
import type { ApiInvoice } from '../lib/billing'

// Single source of truth — admin tables render the same roles the session
// carries, so these must never drift apart. Imported as well as re-exported:
// the types below use them, and a bare `export … from` binds no local name.
import type { UserRole, UserStatus } from './auth'

export type { UserRole, UserStatus }

/**
 * The address of one exchange account. Accounts live in one table per
 * exchange and ids collide across them, so an id alone names a different row
 * on every venue — every admin write carries both.
 */
export interface ApiKeyRef {
  exchange: ExchangeKind
  id: number
}

/** The `?exchange=` scope an admin read runs under. */
export type AdminExchangeScope = 'all' | ExchangeKind

/** Exchange account row nested under an admin user (API keys pre-masked). */
export interface AdminUserAccount {
  id: number
  name: string
  /** Which exchange's table the row lives in (ids repeat across tables). */
  exchange: ExchangeKind
  api_key: string | null
  demo: boolean
  enabled: boolean
  balance: number
  unrealized_pnl: number
  currency_type: string | null
  deleted_at: string | null
}

/** One user_credentials row as returned by GET /admin/users. */
export interface AdminUser {
  uni_id: string
  name: string
  email: string
  status: UserStatus
  type: UserRole
  realized_percentage: number
  unrealized_percentage: number
  created_at: string | null
  last_activity: string | null
  accounts: AdminUserAccount[]
}

import type { StrategyTrade } from '../lib/strategyStats'

/** GET /admin/strategies — global toggle map + tagged closed trades. */
export interface StrategiesData {
  /** strategy_key → enabled; a missing key means enabled. */
  enabled: Record<string, boolean>
  trades: StrategyTrade[]
}

/** One closed trade inside a calendar day. */
export interface DailyPnlTrade {
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

/** One day's aggregate + its trades (after fees; before fees beside it). */
export interface DailyPnlDay {
  total: number
  total_gross: number
  fees: number
  wins: number
  losses: number
  trades: DailyPnlTrade[]
}

/** GET /admin/daily-pnl — master account closed P&L keyed by YYYY-MM-DD. */
export type DailyPnlMap = Record<string, DailyPnlDay>

/** One open position from GET /admin/positions. */
export interface AdminOpenPosition {
  id: number
  /** The table this row lives in — stamped by the per-user endpoint. */
  exchange?: ExchangeKind
  account_id: number | null
  account_name: string | null
  account_balance: number
  symbol: string
  position_side: string
  position_amt: number
  price: number
  unrealized_pnl: number
  broker: string
}

/** One closed trade from GET /admin/positions. */
export interface AdminPastTrade {
  id: number
  /** The table this row lives in — stamped by the per-user endpoint. */
  exchange?: ExchangeKind
  account_id: number | null
  account_name: string | null
  account_balance: number
  symbol: string
  price: number
  /** NET of `exchange_fee` — matches the trade in the exchange's own app. */
  realized_pnl: number
  /** Commission + funding already deducted; null on a gross row. */
  exchange_fee: number | null
  fee_source: FeeSource
  side: string
  strategy: string | null
  closed_at: string
  position_amt: number
  broker: string
}

/** GET /admin/positions — open positions + closed trades across all accounts. */
export interface AdminPositionsData {
  positions: AdminOpenPosition[]
  trades: AdminPastTrade[]
}

/** PUT /admin/positions/{id} — every field the admin may correct on an open
 *  row. Ownership (api_key / uni_id) is not among them by design. */
export interface AdminPositionUpdate {
  symbol: string
  position_side: string
  position_amt: number
  mark_price: number
  unrealized_profit: number
}

/** PUT /admin/past-positions/{id} — same, for a closed trade. */
export interface AdminPastTradeUpdate {
  symbol: string
  side: string
  position_amt: number
  exit_price: number
  realized_pnl: number
  strategy: string | null
  closed_at: string
}

/** Defined with the trader-facing asset types; re-exported for admin callers. */
export type { AssetSide } from './assets'

/** One assets row as returned by GET /admin/assets. */
export interface AdminAsset {
  asset_id: number
  ticker: string
  type: string | null
  broker: string | null
  side: AssetSide
  asset_image: string | null
  max_increments: number
  base_size: number
  enabled: boolean
  created_at: string | null
  updated_at: string | null
}

/** Payload for creating / updating an asset. */
export interface AssetInput {
  ticker: string
  type: string | null
  broker: string | null
  side: AssetSide
  max_increments: number
  base_size: number
  enabled: boolean
}

/** One sandbox (test-tagged) user row as returned by GET /admin/sandbox/users. */
export interface SandboxUser {
  uni_id: string
  name: string
  email: string
  status: UserStatus
  type: UserRole
  created_at: string | null
  positions_count: number
}

/** Payload for creating a test user (blank fields are auto-generated server-side). */
export interface TestUserInput {
  name?: string
  email?: string
  password?: string
  status?: UserStatus
  type?: UserRole
}

/** A single fabricated past-position row (the template for inserts). */
export interface SandboxPositionField {
  symbol: string
  position_side: 'LONG' | 'SHORT'
  position_amt: number
  entry_price: number
  exit_price: number
  realized_pnl: number
  side?: 'BUY' | 'SELL'
  strategy: string
  closed_at: string // 'YYYY-MM-DD'
}

/**
 * Payload for POST /admin/sandbox/positions.
 * `count` mode inserts `count` rows; `range` mode inserts exactly one row per
 * calendar day between date_from/date_to with a P&L rolled inside the bounds.
 */
export interface SandboxPositionInput {
  uni_id: string
  mode?: 'count' | 'range'
  count?: number
  randomize: boolean
  date_from?: string // 'YYYY-MM-DD' (range mode)
  date_to?: string // 'YYYY-MM-DD' (range mode)
  pnl_min?: number
  pnl_max?: number
  position?: SandboxPositionField
}

/* ---- invoice scenario runner (/admin/sandbox/invoice-scenarios) ---- */

/** The world a scenario builds before it invoices. */
export interface ScenarioSetup {
  initial_deposit: number
  balance: number
  unrealized: number
  /** Realized P&L of each closed trade seeded into the billing month. */
  trades: number[]
  /** Wallet deposits recorded inside the month (negative = withdrawal). */
  deposits: number[]
  /** Closing HWM of a seeded previous month, or null for a first invoice. */
  prior_hwm: number | null
}

/** One asserted column: what the rules say vs what the invoice came out as. */
export interface ScenarioCheck {
  field: string
  label: string
  expected: number | string
  actual: number | string
  pass: boolean
}

/** A scenario as advertised by GET /admin/sandbox/invoice-scenarios. */
export interface InvoiceScenario {
  key: string
  title: string
  summary: string
  /** Caveat or policy question the scenario exposes — worth reading. */
  note: string | null
  setup: ScenarioSetup
}

/** A scenario after it has actually been run. */
export interface ScenarioResult extends InvoiceScenario {
  /** Plain-language log of what the runner did, in order. */
  steps: string[]
  checks: ScenarioCheck[]
  pass: boolean
  invoice: ApiInvoice
}

export interface ScenarioRunInput {
  uni_id: string
  /** Omit to run the whole suite. */
  keys?: string[]
  month_year?: string // 'YYYY-MM'
  /** Delete the scratch account and its rows when the run finishes. */
  cleanup?: boolean
}

export interface ScenarioRun {
  month_year: string
  rates: { realized: number; unrealized: number }
  cleaned_up: boolean
  account: { id: number; name: string; api_key: string }
  passed: number
  failed: number
  results: ScenarioResult[]
}

/**
 * Outcome of DELETE /admin/sandbox/invoices — with a `{uniId}` segment for one
 * user, without it for every user.
 */
export interface ClearInvoicesResult {
  /** 'all' = every user's invoices, 'user' = the selected one only. */
  scope?: 'all' | 'user'
  /** How many distinct users the deleted invoices belonged to. */
  users?: number
  deleted: number
  /** Settled invoices left alone because `include_paid` was off. */
  skipped_paid: number
}

/** GET /admin/master-stats — the master account + its trading statistics. */
export interface MasterStats {
  master: {
    uni_id: string
    name: string
    email: string
    account: {
      id: number
      name: string
      api_key: string | null
      demo: boolean
      enabled: boolean
      currency_type: string | null
    } | null
  }
  stats: {
    /** null when the balance poller has not written a value yet. */
    balance: number | null
    unrealized_pnl: number
    total_closed_pnl: number
    trades_executed: number
    active_positions: number
    closed_positions: number
    last_trade_at: string | null
  }
}

/** One bucket of the admin cumulative P&L series. */
export interface PerformancePoint {
  /** `YYYY-MM-DD` (daily), `YYYY-Www` (weekly) or `YYYY-MM` (monthly / all). */
  bucket: string
  pnl: number
  cumulative: number
}

/** One fixed window of the Performance Breakdown card. */
export interface PerformanceWindow {
  from: string
  to: string
  pnl: number
  trades: number
}

/** GET /admin/performance — cumulative series + fixed period snapshots. */
export interface AdminPerformance {
  period: string
  series: PerformancePoint[]
  breakdown: {
    daily: PerformanceWindow
    weekly: PerformanceWindow
    monthly: PerformanceWindow
  }
  /** Every symbol the master account has traded — powers the ticker filter. */
  tickers: string[]
}

/** Filters accepted by GET /admin/performance (they apply to `series` only). */
export interface PerformanceFilters {
  period?: 'daily' | 'weekly' | 'monthly' | 'all'
  from?: string
  to?: string
  exclude?: string[]
}

/* ============ admin user detail (/admin/users/{uniId}) ============ */

/** Account row nested under GET /admin/users/{uniId} — list shape + P&L extras. */
export interface AdminUserDetailAccount extends AdminUserAccount {
  /** Lifetime realized P&L summed from the account's past positions. */
  realized_pnl: number
  initial_deposit: number
  /** Latest invoice high-water mark for the account (null = never invoiced). */
  hwm: number | null
}

/** GET /admin/users/{uniId} — one user with profile, fee shares and accounts. */
export interface AdminUserDetail {
  uni_id: string
  name: string
  email: string
  status: UserStatus
  type: UserRole
  realized_percentage: number
  unrealized_percentage: number
  affiliate_percentage: number
  user_profile: string | null
  user_banner: string | null
  created_at: string | null
  last_activity: string | null
  referrals_count: number
  accounts: AdminUserDetailAccount[]
}

/**
 * GET /admin/users/{uniId}/summary?exchange= — headline stats from LIVE
 * accounts only, on the exchange(s) the page's pill names.
 */
export interface AdminUserSummary {
  /** The scope these figures were computed for. */
  exchange: AdminExchangeScope
  /** Connected accounts inside that scope — 0 means nothing on that venue. */
  accounts: number
  balance: number
  unrealized_pnl: number
  realized_pnl: number
  total_pnl: number
  equity: number
  net_deposits: number
  /** Base for percentage displays (net deposits, falling back to equity). */
  pct_base: number
  hwm: number
  metrics: {
    total_trades: number
    wins: number
    losses: number
    win_rate: number | null
    /** null = no losing trades yet ("Perfect"). */
    profit_factor: number | null
    max_win_streak_days: number
    max_loss_streak_days: number
  }
  capital_flow: {
    deposits: number
    deposit_count: number
    withdrawals: number
    withdrawal_count: number
    net_flow: number
    initial_deposit: number
    /** Initial deposit + net flow. */
    capital: number
  }
  /** Sums of `invoices.total_fee` for this user. */
  commissions: {
    this_month: number
    all_time: number
    all_time_paid: number
  }
}

/** One row of GET /admin/affiliate/users/{uniId}/referrals. */
export interface UserReferralRow {
  referred_user_uni_id: string
  name: string
  email: string | null
  referral_code?: string
  referred_at: string | null
}

/**
 * Body of POST /admin/users — an account typed in by an admin rather than
 * self-registered. Name/email/password are required; the rest fall back to the
 * API's defaults (role `user`, status `active`, the standard fee percentages).
 */
export interface AdminUserCreateInput {
  name: string
  email: string
  password: string
  type?: UserRole
  status?: UserStatus
  realized_percentage?: number
  unrealized_percentage?: number
  affiliate_percentage?: number
}

/** Body of PUT /admin/users/{uniId} — every field optional. */
export interface AdminUserUpdateInput {
  realized_percentage?: number
  unrealized_percentage?: number
  affiliate_percentage?: number
  status?: 'active' | 'suspended'
  /** Role change. The API refuses self-changes and a second master. */
  type?: UserRole
}

/* ============ bot engine (/admin/engine/*) ============ */

/** systemd unit state; null when the service is unavailable (local dev). */
export type EngineState = 'active' | 'inactive' | 'failed' | 'activating'

/**
 * Signal/job counters from the engine's /health endpoint. Typed defensively —
 * the engine may add counters, so unknown keys are allowed too.
 */
export interface EngineMetrics extends Record<string, number | undefined> {
  received?: number
  rejected?: number
  jobs_dispatched?: number
  jobs_done?: number
  accounts_traded?: number
  accounts_failed?: number
  accounts_skipped?: number
}

/**
 * The engine's /health JSON. Every field is optional/nullable on purpose:
 * the engine is a separate deploy and may add or drop fields at any time.
 */
export interface EngineHealth {
  accounts_cache_age?: number | null
  assets_cache_age?: number | null
  metrics?: EngineMetrics | null
  pollers?: string[] | null
  /** Timestamp (epoch or preformatted string) while rate limited, else null. */
  rate_limited_until?: string | number | null
}

/** GET /admin/engine/status — systemd state + proxied engine health. */
export interface AdminEngineStatus {
  service: string
  /** false on local dev (no systemd) — restart + logs are hidden then. */
  available: boolean
  state: EngineState | null
  active_since: string | null
  /** null when the engine itself is unreachable. */
  health: EngineHealth | null
  /** Human note from the backend when something is off. */
  message: string | null
}

/**
 * One account the exchange is refusing. `error_reason` is our classification
 * of the exchange's code — IP_OR_PERMISSION is the common one (the key's
 * allow-list does not include our server).
 */
export interface KeyIssueAccount {
  id: number
  /** Which exchange's table the row lives in — the recheck is addressed by both. */
  exchange: ExchangeKind
  name: string
  uni_id: string
  /** First 6 and last 4 characters only — enough to find it on Binance. */
  api_key_hint: string
  owner_name: string | null
  owner_email: string | null
  owner_status: string | null
  demo: boolean
  enabled: boolean
  balance: number | null
  error_code: string | null
  error_reason: string | null
  error_message: string | null
  blocked_at: string | null
  checked_at: string | null
  grace_ends_at: string | null
  /** Days until the automatic disconnect; ≤0 means the sweep is due. */
  days_left: number | null
}

/** GET /admin/engine/key-issues */
export interface KeyIssuesData {
  graceDays: number
  serverIp: string | null
  accounts: KeyIssueAccount[]
}

/** POST /admin/engine/key-issues/{id}/recheck */
export interface KeyRecheckResult {
  success: boolean
  status?: string
  /** True when the exchange accepted the key this time. */
  cleared?: boolean
  message: string
}

/* ============ API-key inventory (/admin/api-keys) ============ */

/** The owner block joined onto every API-key row. */
export interface ApiKeyOwner {
  uni_id: string | null
  name: string | null
  email: string | null
  status: UserStatus | null
  type: UserRole | null
}

/**
 * One exchange account as the admin inventory sees it. Soft-deleted accounts
 * are included (`deleted_at` set) — the page is a history, not just a roster.
 */
export interface AdminApiKey {
  id: number
  /** Which exchange's table the row lives in — every write is addressed by both. */
  exchange: ExchangeKind
  name: string
  /** First 6 + last 4 characters. The full key never leaves the server. */
  api_key_hint: string
  demo: boolean
  enabled: boolean
  is_sandbox: boolean
  balance: number | null
  unrealized_pnl: number | null
  currency_type: string | null
  key_status: string
  /** True when the exchange is refusing these credentials from our server. */
  key_blocked: boolean
  error_code: string | null
  error_reason: string | null
  error_message: string | null
  blocked_at: string | null
  checked_at: string | null
  grace_ends_at: string | null
  /** Days until the automatic disconnect; ≤0 means the sweep is due. */
  days_left: number | null
  created_at: string | null
  deleted_at: string | null
  owner: ApiKeyOwner
  /** What a permanent delete would take with it. */
  usage: ApiKeyUsage
  /** True when this row may be erased from the database. */
  purgeable: boolean
  /** Why it may not be — null when `purgeable`. */
  purge_blocked_reason: string | null
}

/** Rows attached to one API key, counted server-side. */
export interface ApiKeyUsage {
  trades: number
  positions: number
  transactions: number
  invoices: number
}

/** DELETE /admin/api-keys/{id}/purge — what the hard delete removed. */
export interface PurgeKeyResult {
  message: string
  removed: { trades: number; positions: number; transactions: number }
}

/** The chip counts, computed server-side so every consumer agrees. */
export interface AdminApiKeyCounts {
  all: number
  connected: number
  faulty: number
  disabled: number
  disconnected: number
  sandbox: number
}

/** GET /admin/api-keys */
export interface AdminApiKeysData {
  graceDays: number
  serverIp: string | null
  counts: AdminApiKeyCounts
  keys: AdminApiKey[]
}

/** Body of PUT /admin/api-keys/{id} — key/secret/demo are not editable. */
export interface AdminApiKeyUpdateInput {
  name?: string
  enabled?: boolean
}

/** POST /admin/api-keys/bulk-delete */
export interface BulkKeyDeleteResult {
  deleted: number
  /** Ids that were already disconnected, or no longer exist. */
  skipped: number
  message: string
}

/** GET /admin/engine/logs — journal lines, oldest → newest. */
export interface EngineLogsData {
  available: boolean
  lines: string[]
}

/** POST /admin/engine/restart. */
export interface EngineRestartResult {
  state: EngineState | null
}

/* ============ database browser (/admin/database/*) ============ */

/** Scalar as it arrives from a MySQL row over JSON. */
export type DbValue = string | number | boolean | null

export type DbRow = Record<string, DbValue>

export type SqlKind = 'read' | 'write'

/** GET /admin/database/tables — one entry per table in the API's own schema. */
export interface DatabaseTable {
  name: string
  rows: number
  size_bytes: number | null
  engine: string | null
  comment: string | null
}

export interface DatabaseTablesData {
  database: string
  driver: string
  tables: DatabaseTable[]
}

/** A column as the server describes it (Schema::getColumns shape, verbatim). */
export interface DatabaseColumn {
  name: string
  /** Bare type, e.g. `varchar`. */
  type_name: string
  /** Full declaration, e.g. `varchar(36)`. */
  type: string
  collation: string | null
  nullable: boolean
  default: string | null
  auto_increment: boolean
  comment: string | null
  /** Non-null when the column is generated (and therefore not writable). */
  generation: { type: string; expression: string | null } | null
}

export interface DatabaseIndex {
  name: string
  columns: string[]
  type: string | null
  unique: boolean
  primary: boolean
}

export interface DatabaseForeignKey {
  name: string
  columns: string[]
  foreign_schema: string | null
  foreign_table: string
  foreign_columns: string[]
  on_update: string | null
  on_delete: string | null
}

/** Shape shared by the structure and rows endpoints so the UI has one contract. */
export interface DatabaseTableMeta {
  columns: DatabaseColumn[]
  /** Primary key (or a NOT NULL unique fallback). Empty = row editing disabled. */
  key_columns: string[]
  editable: boolean
  /** Values hidden server-side; submitting the mask back is refused. */
  masked_columns: string[]
  binary_columns: string[]
  /** Key, auto-increment and generated columns — never writable. */
  immutable_columns: string[]
}

/** GET /admin/database/tables/{table}/structure. */
export interface TableStructure extends DatabaseTableMeta {
  table: string
  indexes: DatabaseIndex[]
  foreign_keys: DatabaseForeignKey[]
}

export interface TableRowsParams {
  page?: number
  per_page?: number
  sort?: string
  direction?: 'asc' | 'desc'
  search?: string
}

/** GET /admin/database/tables/{table}/rows — hand-rolled paging envelope. */
export interface TableRowsData extends DatabaseTableMeta {
  table: string
  rows: DbRow[]
  page: number
  per_page: number
  total: number
  sort: string | null
  direction: 'asc' | 'desc'
}

/** POST /admin/database/query — the gated SQL console. */
export interface SqlQueryInput {
  sql: string
  /** Re-post an UPDATE/DELETE that has no WHERE clause after confirming. */
  confirm_unfiltered?: boolean
}

export interface SqlQueryResult {
  kind: SqlKind
  /** The normalized statement the server actually ran. */
  statement: string
  columns: string[]
  rows: DbRow[]
  /** Row count for writes; null for reads. */
  affected: number | null
  row_count: number
  truncated: boolean
  duration_ms: number
}

/** POST /admin/cache/clear — server-side cache flush result. */
export interface CacheClearResult {
  success: boolean
  /** Artisan commands that ran, e.g. ['optimize:clear', 'config:cache']. */
  cleared: string[]
  failed: string[]
  engine: {
    /** e.g. ['refresh-accounts', 'refresh-assets'] */
    refreshed: string[]
    error: string | null
  }
}

/* ── Admin → Crypto Transfers ─────────────────────────────────────────── */

/**
 * One incoming USDT-TRC20 transfer. Row fields stay snake_case, matching
 * {@link AdminApiKey} — admin services camelCase the envelope and pass rows
 * through as the API shaped them.
 */
export interface AdminTronTransfer {
  id: number
  network: string
  tx_hash: string
  explorer_url: string
  from_address: string
  to_address: string
  contract_address: string
  /** Server-computed: is this our token, or something that merely says it is? */
  contract_trusted: boolean
  token_symbol_reported: string | null
  amount: string | null
  amount_usd: number | null
  value_raw: string
  block_timestamp: number
  seen_at: string | null
  confirmed: boolean
  status: 'unmatched' | 'settled' | 'ignored' | 'rejected'
  reject_reason: string | null
  intent_id: number | null
  invoice_id: number | null
  settled_by: string | null
  settled_at: string | null
  note: string | null
  /** Server-computed, and re-checked when the action arrives. */
  attributable: boolean
  attribution_blocked_reason: string | null
  suggestions: AdminTronSuggestion[]
}

/**
 * An invoice this transfer plausibly pays — usually one whose reservation has
 * since expired, i.e. someone paid late. A hint for a human, never an
 * auto-settle.
 */
export interface AdminTronSuggestion {
  invoice_id: number
  intent_id: number
  intent_status: string
  expected: string
  expected_usd: number
  delta_usd: number
  invoice_status: string | null
  user_id: string
  why: string
  owner: { uni_id: string; name: string | null; email: string | null } | null
}

export interface AdminTronNetwork {
  name: string
  configured: boolean
  address: string | null
  address_valid: boolean
  contract_valid: boolean
  label: string
  last_scan_at: string | null
  /** The watcher has not run recently — payments are arriving unnoticed. */
  scan_stale: boolean
  last_transfer_at: string | null
}

export interface AdminTronCounts {
  all: number
  unmatched: number
  settled: number
  ignored: number
  rejected: number
}

export interface AdminTronTransfersData {
  networks: AdminTronNetwork[]
  counts: AdminTronCounts
  transfers: AdminTronTransfer[]
}
