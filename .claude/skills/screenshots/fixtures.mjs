// Sample answers for the screenshot skill. EVERY name, email and amount here
// is invented — this repo is public, and a screenshot must never depend on
// (or show) a real customer. Add an entry when a page you capture reports an
// "unanswered" endpoint in the gallery.
//
// answer(method, path, url) → a JSON body, `null` for 204, or undefined when
// there is no sample (the page then gets a 404 and the gallery lists it).

export const ADMIN_USER = {
  uni_id: 'sample-admin', name: 'Sample Admin', email: 'admin@example.test', status: 'active',
  type: 'admin', email_verified: true, has_exchange_account: false, has_password: true,
}

export const TRADER_USER = {
  ...ADMIN_USER, uni_id: 'sample-trader', name: 'Sample Trader', email: 'trader@example.test', type: 'user',
  has_exchange_account: true,
}

// ---------------------------------------------------------------- invoices
function invoice(id, name, month, fee, paid = null) {
  const [y, m] = month.split('-').map(Number)
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const due = new Date(Date.UTC(y, m, 4)).toISOString().slice(0, 10)
  return {
    id: String(id), user_id: `u-${name}`, exchange: 'binance', formatted_id: `INV-${y}-${String(id).padStart(4, '0')}`,
    account_name: 'Main', month_year: month, month_label: label, invoice_date: `${due.slice(0, 8)}01`, due_date: due,
    paid_date: paid, status: 'paid', is_overdue: false, total_fee: fee, fee_source: 'pnl', currency: 'USD',
    performance_gain: fee * 5, current_balance: 2000, hwm_before: 1800, hwm_after: 1900, realized_pnl: fee * 5,
    unrealized_pnl: 0, fee_realized: fee, fee_unrealized: 0, deposit_amount: 0, capital_flow: 0,
    performance_equity: 1900, realized_pnl_gross: fee * 5, exchange_fees: 0, is_first_invoice: false,
    reference_label: 'High-water mark', reference_value: 1800,
    user_name: name, user_email: `${name.split(' ')[0].toLowerCase()}@example.test`,
  }
}
const INVOICES = [
  invoice(15, 'Daniel Moreau', '2026-10', 24.04, '2026-11-10'),
  invoice(16, 'Liam Becker', '2026-10', 0), invoice(17, 'Sofia Ramos', '2026-10', 0),
  invoice(18, 'Noah Klein', '2026-10', 0), invoice(19, 'Emma Duarte', '2026-10', 0),
  invoice(10, 'Daniel Moreau', '2026-09', 35.03, '2026-10-02'), invoice(11, 'Liam Becker', '2026-09', 12.4, '2026-10-03'),
  invoice(12, 'Sofia Ramos', '2026-09', 2.44, '2026-10-02'), invoice(13, 'Noah Klein', '2026-09', 5.12, '2026-10-04'),
  invoice(14, 'Emma Duarte', '2026-09', 3.0, '2026-10-02'), invoice(6, 'Daniel Moreau', '2026-08', 3.5, '2026-09-30'),
  invoice(7, 'Liam Becker', '2026-08', 1.28, '2026-09-03'), invoice(8, 'Sofia Ramos', '2026-08', 0.88, '2026-09-02'),
]
const charged = INVOICES.filter((i) => i.total_fee > 0)
const INVOICES_BODY = {
  success: true,
  invoices: INVOICES,
  summary: {
    total_collected: Math.round(charged.reduce((s, i) => s + i.total_fee, 0) * 100) / 100,
    count_total: INVOICES.length, count_paid: charged.length, count_pending: 0,
    count_no_fee: INVOICES.length - charged.length, outstanding_amount: 0,
  },
}

// ---------------------------------------------------------------- crypto transfers
const WALLET = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKLxmGkn' // a test-fixture address, not ours
function transfer(id, units, daysAgo, invoiceId) {
  const ts = Date.now() - daysAgo * 86400000
  const hash = `${String(id).repeat(8)}abcdef`.padEnd(64, '0')
  return {
    id, network: 'mainnet', tx_hash: hash, explorer_url: `https://tronscan.org/#/transaction/${hash}`,
    from_address: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKsN8FyA', to_address: WALLET, contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    contract_trusted: true, token_symbol_reported: 'USDT', amount: (units / 1e6).toFixed(6), amount_usd: units / 1e6,
    value_raw: String(units), block_timestamp: ts, seen_at: new Date(ts).toISOString(), confirmed: true,
    status: 'settled', reject_reason: null, intent_id: id, invoice_id: invoiceId, settled_by: 'watcher',
    settled_at: new Date(ts + 60000).toISOString(), note: null, attributable: false,
    attribution_blocked_reason: 'Already settled.', suggestions: [], candidate_invoice_ids: [], claims: [], disputed: false,
  }
}
const TRANSFERS_BODY = {
  success: true,
  networks: [{
    name: 'mainnet', configured: true, address: WALLET, address_valid: true, contract_valid: true,
    label: 'TRC-20 (TRON)', last_scan_at: new Date(Date.now() - 40000).toISOString(), scan_stale: false,
    budget_exhausted_at: null, last_transfer_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  }],
  counts: { all: 3, unmatched: 0, settled: 3, ignored: 0, rejected: 0, disputed: 0 },
  transfers: [transfer(5, 35030000, 9, 10), transfer(4, 3000000, 9.2, 14), transfer(3, 3500000, 11, 6)],
}

// ---------------------------------------------------------------- overview
const OVERVIEW_BODY = {
  success: true,
  attention: {
    blocked_keys: [], blocked_keys_count: 0, pending_users: [], pending_users_count: 0,
    overdue_invoices: { count: 0, amount: 0 }, unpaid_invoices: { count: 0, amount: 0 }, unmatched_transfers: 0,
    recent_payments: {
      count: 2, amount: 27.54, days: 7,
      latest: [
        { invoice_id: 15, uni_id: 'u-daniel', name: 'Daniel Moreau', exchange: 'binance', month_year: '2026-10', amount: 24.04, provider: 'stripe', paid_at: new Date(Date.now() - 5 * 3600000).toISOString() },
        { invoice_id: 21, uni_id: 'u-liam', name: 'Liam Becker', exchange: 'binance', month_year: '2026-10', amount: 3.5, provider: 'tron', paid_at: new Date(Date.now() - 4 * 86400000).toISOString() },
      ],
    },
    disputed_payments: 0, killed_assets: [],
    signals_today: { signals: 6, with_problems: 0, filled: 30, skipped: 2, failed: 0, reasons: { 'maxed sizing': 2 } },
    paused_for_payment: 0,
    outside_closes: {
      count: 1,
      latest: [{ id: 1, exchange: 'binance', uni_id: 'u-noah', account_name: 'Main', demo: false, symbol: 'LTCUSDT', side: 'short', realized_pnl: -4.2, closed_at: new Date(Date.now() - 86400000).toISOString() }],
    },
  },
  headline: {
    master_balance: 12456.2, master_today_pnl: 41.2, master_today_trades: 2,
    active_traders_today: 5, customers_live: 6, collected_this_month: 27.54,
  },
}

// ---------------------------------------------------------------- visitors
function visitorSeries() {
  const visitors = { 16: 2, 15: 5, 14: 3, 12: 41, 11: 6, 9: 18, 8: 7, 7: 17, 5: 12, 4: 33, 3: 16 }
  const signups = { 25: 3, 18: 1, 4: 1 }
  const out = []
  for (let back = 29; back >= 0; back--) {
    const day = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)
    const v = visitors[back] ?? 0
    out.push({ start: day, visitors: v, views: Math.round(v * 1.6), signups: signups[back] ?? 0 })
  }
  return out
}
function visitorSummary() {
  const series = visitorSeries()
  const total = series.reduce((s, b) => s + b.visitors, 0)
  return {
    success: true, range: { from: series[0].start, to: series.at(-1).start },
    since: new Date(Date.now() - 16 * 86400000).toISOString().slice(0, 10), ip_days: 90,
    totals: { visitors: total, views: Math.round(total * 1.6), signups: 5, signup_rate: 3.1, live_now: 1 },
    bucket: 'day', series,
    funnel: [
      { key: 'visited', count: total }, { key: 'opened_signup', count: 22 }, { key: 'signed_up', count: 5 },
      { key: 'verified', count: 4 }, { key: 'approved', count: 3 }, { key: 'connected', count: 2 },
    ],
    pages: [{ path: '/', views: 180, visitors: 120 }, { path: '/auth', views: 60, visitors: 40 }],
    sources: [{ label: 'Direct', direct: true, hosts: [], visitors: 90 }, { label: 't.me', direct: false, hosts: ['t.me'], visitors: 40 }],
    referral_codes: [], campaigns: [], heard_about: [],
    countries: [{ value: 'TH', visitors: 60 }, { value: 'PH', visitors: 35 }, { value: 'IL', visitors: 25 }],
    devices: [{ value: 'mobile', visitors: 80 }, { value: 'desktop', visitors: 40 }],
    browsers: [{ value: 'Chrome', visitors: 90 }, { value: 'Safari', visitors: 30 }],
    systems: [{ value: 'Android', visitors: 60 }, { value: 'iOS', visitors: 30 }, { value: 'Windows', visitors: 30 }],
    filtered: { bot: 3, foreign: 5, unknown_page: 0, team: 16, flood: 0, repeat: 5, suspicious: 0 },
  }
}
const VISITOR_LOG_BODY = {
  success: true, range: { from: '2026-10-01', to: '2026-10-31' }, rows: [],
  pagination: { total: 0, limit: 25, offset: 0 }, options: { pages: [], countries: [] }, ip_detail: null,
}

// ---------------------------------------------------------------- router
/** Longest matching prefix wins; values may be functions (fresh dates per call). */
const GET = {
  '/auth/me': (user) => ({ success: true, user }),
  '/admin/invoices': INVOICES_BODY,
  '/admin/tron-transfers': TRANSFERS_BODY,
  '/admin/insights/overview': OVERVIEW_BODY,
  '/admin/visitors/summary': visitorSummary,
  '/admin/visitors/log': VISITOR_LOG_BODY,
}

export function answer(method, path, user) {
  if (path.startsWith('/public/visits')) return null
  if (method !== 'GET') return undefined
  const key = Object.keys(GET).filter((k) => path.startsWith(k)).sort((a, b) => b.length - a.length)[0]
  if (!key) return undefined
  const value = GET[key]
  return typeof value === 'function' ? value(user) : value
}

/** What the skill captures when it is given no route. */
export const DEFAULT_ROUTES = [
  '/admin?view=attention',
  '/admin/invoices',
  '/admin/tron-transfers',
  '/admin/visitors',
]
