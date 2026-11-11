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

// ---------------------------------------------------------------- one user's admin profile
// /admin/users/u-daniel — an invented customer: $2,000 in before August, $1,000
// more mid-September, three months of closes, one invoice per month worked
// out from those closes (20% of the month's profit after exchange fees).
export const SAMPLE_USER_ID = 'u-daniel'
const ISO = (d) => d.toISOString().slice(0, 10)
const r2 = (n) => Math.round(n * 100) / 100

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SYMBOLS = [['LTCUSDT', 0.6], ['RENDERUSDT', 0.25], ['SOLUSDT', 0.15]]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildProfile() {
  const rand = seeded(7)
  const flows = { '2026-07-28': 2000, '2026-09-15': 1000 }
  const days = []
  let balance = 0
  const capital = {}
  const closing = {}
  for (let d = new Date(Date.UTC(2026, 6, 28)); d <= new Date(Date.UTC(2026, 9, 31)); d.setUTCDate(d.getUTCDate() + 1)) {
    const day = ISO(d)
    if (flows[day]) balance += flows[day]
    const trades = d.getUTCMonth() >= 7 && rand() < 0.55 ? 1 + Math.floor(rand() * 3) : 0
    if (!trades && !flows[day]) continue
    capital[day] = r2(balance)
    if (trades) {
      const gross = r2((rand() - 0.36) * 70)
      const fee = r2(0.6 * trades + rand() * 1.2)
      const net = r2(gross - fee)
      days.push({ day, trades, gross, fee, net, start: balance, wins: gross > 0 ? trades : 0 })
      balance += net
    }
    closing[day] = r2(balance)
  }

  const sum = (rows, k) => r2(rows.reduce((s, x) => s + x[k], 0))
  const monthly = ['2026-08', '2026-09', '2026-10'].map((month) => {
    const rows = days.filter((x) => x.day.startsWith(month))
    const trades = rows.reduce((s, x) => s + x.trades, 0)
    return { month, pnl: sum(rows, 'gross'), pnl_net: sum(rows, 'net'), fees: sum(rows, 'fee'), trades, win_rate: r2((rows.reduce((s, x) => s + x.wins, 0) / trades) * 100) }
  })
  const gross = sum(days, 'gross')
  const net = sum(days, 'net')
  const fees = sum(days, 'fee')
  const trades = days.reduce((s, x) => s + x.trades, 0)
  const winDays = days.filter((x) => x.gross > 0)
  const lossDays = days.filter((x) => x.gross <= 0)
  const unrealized = 12.4
  const byGross = [...days].sort((a, b) => b.gross - a.gross)
  const dow = Object.fromEntries(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => [w, { pnl: 0, pnl_net: 0, trades: 0 }]))
  for (const x of days) {
    const w = dow[WEEKDAYS[new Date(`${x.day}T00:00:00Z`).getUTCDay()]]
    w.pnl = r2(w.pnl + x.gross); w.pnl_net = r2(w.pnl_net + x.net); w.trades += x.trades
  }

  const analytics = {
    baseline: 3000, current_capital: r2(balance + unrealized), total_unrealized: unrealized,
    total_realized: gross, total_realized_net: net,
    fees: { total: fees, trades_with_fee: trades, trades_without_fee: 0, since: '2026-09-11' },
    total_return_abs: r2(gross + unrealized), total_return_abs_net: r2(net + unrealized),
    total_return_pct: r2(((gross + unrealized) / 3000) * 100),
    return_on_deposit: { pct: r2((gross / 3000) * 100), realized: gross, realized_net: net, deposits: 3000, trades },
    filters: { filtered: false, available_symbols: SYMBOLS.map(([s]) => s), available_strategies: ['ABCD-v1'] },
    trading_days: days.length,
    avg_daily_pnl: r2(gross / days.length), avg_daily_pnl_net: r2(net / days.length),
    best_day: { date: byGross[0].day, pnl: byGross[0].gross, pnl_net: byGross[0].net },
    worst_day: { date: byGross.at(-1).day, pnl: byGross.at(-1).gross, pnl_net: byGross.at(-1).net },
    daily_pnl: Object.fromEntries(days.map((x) => [x.day, x.gross])),
    daily_pnl_net: Object.fromEntries(days.map((x) => [x.day, x.net])),
    daily_capital: capital, daily_balance: closing, daily_unrecorded_fees: {}, daily_flows: flows,
    daily_returns: Object.fromEntries(days.map((x) => [x.day, {
      start_balance: r2(x.start), pnl: x.net, pnl_gross: x.gross,
      pct: r2((x.net / x.start) * 100), pct_gross: r2((x.gross / x.start) * 100), trades: x.trades,
    }])),
    initial_deposit: 0, day_of_week: dow, monthly,
    by_symbol: SYMBOLS.map(([symbol, share]) => ({
      symbol, trades: Math.round(trades * share), realized_pnl: r2(gross * share), realized_pnl_net: r2(net * share), fees: r2(fees * share),
    })),
    by_exchange: [{ exchange: 'binance', accounts: 1, balance: r2(balance), unrealized }],
    flows: {
      deposits: 3000, withdrawals: 0, net_flow: 3000, count: 2,
      recent: [
        { type: 'deposit', amount: 1000, currency: 'USDT', in_totals: true, date: '2026-09-15' },
        { type: 'deposit', amount: 2000, currency: 'USDT', in_totals: true, date: '2026-07-28' },
      ],
    },
    quality: {
      wins: winDays.reduce((s, x) => s + x.trades, 0), losses: lossDays.reduce((s, x) => s + x.trades, 0),
      win_rate: r2((winDays.reduce((s, x) => s + x.trades, 0) / trades) * 100),
      profit_factor: r2(sum(winDays, 'gross') / Math.abs(sum(lossDays, 'gross'))),
      avg_win: r2(sum(winDays, 'gross') / winDays.length), avg_loss: r2(sum(lossDays, 'gross') / lossDays.length),
      largest_win: byGross[0].gross, largest_loss: byGross.at(-1).gross, expectancy: r2(gross / trades),
    },
    risk: { max_drawdown_abs: 84.2, max_drawdown_pct: -3.1, best_streak: 5, worst_streak: 3, sharpe: 1.42, sortino: 2.05, volatility: 14.8, risk_score: 64 },
  }

  // One invoice per month, worked out the way InvoiceService does it.
  let hwm = 2000
  const paidOn = { '2026-08': '2026-09-02', '2026-09': '2026-10-03', '2026-10': '2026-11-10' }
  const invoices = monthly.map((m, i) => {
    const [y, mo] = m.month.split('-').map(Number)
    const flow = m.month === '2026-09' ? 1000 : 0
    const end = closing[Object.keys(closing).filter((d) => d.startsWith(m.month)).at(-1)]
    const performanceEquity = r2(end - flow)
    const fee = performanceEquity > hwm && m.pnl_net > 0 ? r2(m.pnl_net * 0.2) : 0
    const row = {
      ...invoice(20 + i, 'Daniel Moreau', m.month, fee, paidOn[m.month]),
      user_id: SAMPLE_USER_ID, current_balance: end, hwm_before: hwm, capital_flow: flow, deposit_amount: flow,
      performance_equity: performanceEquity, performance_gain: r2(performanceEquity - hwm),
      realized_pnl: m.pnl_net, realized_pnl_gross: m.pnl, exchange_fees: m.fees, fee_realized: fee,
      is_first_invoice: i === 0, reference_value: hwm,
      invoice_date: ISO(new Date(Date.UTC(y, mo, 1))),
    }
    hwm = r2(Math.max(hwm, performanceEquity) + flow)
    row.hwm_after = hwm
    return row
  })

  const dailyPnl = Object.fromEntries(days.map((x, i) => [x.day, {
    total: x.net, total_gross: x.gross, start_balance: r2(x.start), pct: r2((x.net / x.start) * 100),
    pct_gross: r2((x.gross / x.start) * 100), fees: x.fee, wins: x.gross > 0 ? 1 : 0, losses: x.gross > 0 ? 0 : 1,
    trades: [{
      id: 900 + i, symbol: 'LTCUSDT', position_side: x.gross > 0 ? 'LONG' : 'SHORT', position_amt: 14,
      realized_pnl: x.net, exchange_fee: x.fee, fee_source: 'actual', exit_price: 92.4, side: 'SELL',
      strategy: 'ABCD-v1', closed_at: `${x.day} 14:30:00`,
    }],
  }]))

  const detail = {
    uni_id: SAMPLE_USER_ID, name: 'Daniel Moreau', email: 'daniel@example.test', status: 'active', type: 'user',
    realized_percentage: 20, unrealized_percentage: 6, affiliate_percentage: 0, user_profile: null, user_banner: null,
    created_at: '2026-07-20T09:12:00Z', last_activity: '2026-11-10T08:40:00Z', referrals_count: 0, delete_blockers: ['Has invoices'],
    accounts: [{
      id: 11, name: 'Main', exchange: 'binance', api_key: 'abc123…wxyz', demo: false, enabled: true,
      balance: r2(balance), unrealized_pnl: unrealized, currency_type: 'USDT', deleted_at: null,
      realized_pnl: net, initial_deposit: 0, hwm,
    }],
  }

  const summary = {
    exchange: 'all', accounts: 1, balance: r2(balance), unrealized_pnl: unrealized, realized_pnl: net,
    total_pnl: r2(net + unrealized), equity: r2(balance + unrealized), net_deposits: 3000, pct_base: 3000, hwm,
    metrics: {
      total_trades: trades, wins: analytics.quality.wins, losses: analytics.quality.losses,
      win_rate: analytics.quality.win_rate, profit_factor: analytics.quality.profit_factor,
      max_win_streak_days: 5, max_loss_streak_days: 3,
    },
    capital_flow: {
      deposits: 3000, deposit_count: 2, withdrawals: 0, withdrawal_count: 0, net_flow: 3000, initial_deposit: 0, capital: 3000,
      transfers: [
        { id: 2, exchange: 'binance', type: 'deposit', amount: 1000, currency: 'USDT', at: '2026-09-15T06:00:00Z' },
        { id: 1, exchange: 'binance', type: 'deposit', amount: 2000, currency: 'USDT', at: '2026-07-28T06:00:00Z' },
      ],
    },
    commissions: {
      this_month: 0, all_time: r2(invoices.reduce((s, x) => s + x.total_fee, 0)),
      all_time_paid: r2(invoices.reduce((s, x) => s + x.total_fee, 0)),
    },
  }

  return { analytics, invoices, dailyPnl, detail, summary }
}
const PROFILE = buildProfile()

/** /admin/users/{id}[/part] — every part of the profile page. */
function userProfile(path) {
  const part = path.split('/')[4] ?? ''
  switch (part) {
    case '': return { success: true, user: PROFILE.detail }
    case 'summary': return { success: true, summary: PROFILE.summary }
    case 'daily-pnl': return { success: true, days: PROFILE.dailyPnl }
    case 'analytics': return { success: true, analytics: PROFILE.analytics }
    case 'invoices': return { success: true, invoices: PROFILE.invoices }
    case 'positions': return { success: true, positions: [], trades: [] }
    default: return undefined
  }
}

// ---------------------------------------------------------------- router
/** Longest matching prefix wins; values may be functions (fresh dates per call). */
const GET = {
  '/admin/users/': (_user, path) => userProfile(path),
  '/admin/affiliate/users/': { success: true, referrals: [] },
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
  return typeof value === 'function' ? value(user, path) : value
}

/** What the skill captures when it is given no route. */
export const DEFAULT_ROUTES = [
  '/admin?view=attention',
  '/admin/invoices',
  '/admin/tron-transfers',
  '/admin/visitors',
]
