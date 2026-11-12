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
    payment_provider: paid && fee > 0 ? ['tron', 'stripe', 'manual'][id % 3] : null,
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
  // One overdue, so Outstanding and "Mark paid" have something to show.
  { ...invoice(31, 'Liam Becker', '2026-10', 12.4), status: 'pending', is_overdue: true, paid_date: null, payment_provider: null },
]
const charged = INVOICES.filter((i) => i.total_fee > 0)
const unpaid = charged.filter((i) => i.status !== 'paid')
const INVOICES_BODY = {
  success: true,
  invoices: INVOICES,
  summary: {
    total_collected: Math.round(charged.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total_fee, 0) * 100) / 100,
    count_total: INVOICES.length, count_paid: charged.length - unpaid.length, count_pending: unpaid.length,
    count_no_fee: INVOICES.length - charged.length,
    outstanding_amount: Math.round(unpaid.reduce((s, i) => s + i.total_fee, 0) * 100) / 100,
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
function visitorSummary(_user, _path, query) {
  const from = query?.get('from') ?? ''
  if (from && from === query?.get('to')) return visitorDay(from)
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
/** One clicked day (from = to): a smaller, different mix, so the narrowing shows. */
function visitorDay(day) {
  const v = visitorSeries().find((b) => b.start === day)?.visitors || 12
  return {
    success: true, range: { from: day, to: day }, since: day, ip_days: 90,
    totals: { visitors: v, views: Math.round(v * 1.8), signups: 1, signup_rate: r2((1 / v) * 100), live_now: 0 },
    bucket: 'day', series: [{ start: day, visitors: v, views: Math.round(v * 1.8), signups: 1 }],
    funnel: [
      { key: 'visited', count: v }, { key: 'opened_signup', count: 4 }, { key: 'signed_up', count: 1 },
      { key: 'verified', count: 1 }, { key: 'approved', count: 1 }, { key: 'connected', count: 0 },
    ],
    pages: [
      { path: '/', views: Math.round(v * 1.1), visitors: v }, { path: '/binance-offer', views: 9, visitors: 7 },
      { path: '/auth', views: 6, visitors: 4 }, { path: '/docs/binance', views: 5, visitors: 3 },
    ],
    sources: [
      { label: 't.me', direct: false, hosts: ['t.me'], visitors: Math.ceil(v * 0.6) },
      { label: 'Direct', direct: true, hosts: [], visitors: Math.floor(v * 0.4) },
    ],
    referral_codes: [], campaigns: [], heard_about: [{ slug: 'telegram', label: 'Telegram', count: 1 }],
    countries: [{ value: 'IL', visitors: Math.ceil(v * 0.5) }, { value: 'TH', visitors: Math.floor(v * 0.5) }],
    devices: [{ value: 'mobile', visitors: Math.ceil(v * 0.7) }, { value: 'desktop', visitors: Math.floor(v * 0.3) }],
    browsers: [{ value: 'Chrome', visitors: v }], systems: [{ value: 'Android', visitors: Math.ceil(v * 0.7) }, { value: 'Windows', visitors: Math.floor(v * 0.3) }],
    filtered: { bot: 1, foreign: 0, unknown_page: 0, team: 2, flood: 0, repeat: 1, suspicious: 0 },
  }
}
const VISITOR_LOG_BODY = {
  success: true, range: { from: '2026-10-01', to: '2026-10-31' }, rows: [],
  pagination: { total: 0, limit: 25, offset: 0 }, options: { pages: [], countries: [] }, ip_detail: null,
}

// ---------------------------------------------------------------- Admin Dashboard → Customers
function customerInsights() {
  const monday = new Date()
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  const counts = [0, 0, 1, 0, 5, 3, 1, 3, 1, 0, 1, 0]
  const signups_weekly = counts.map((n, i) => ({
    week: new Date(monday.getTime() - (11 - i) * 7 * 86400000).toISOString().slice(0, 10), signups: n,
  }))
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = `${today.slice(0, 8)}01`
  const lastMonthEnd = new Date(Date.parse(`${firstOfMonth}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const row = (uni_id, name, pnl, pct, trades, feeShare = 0.18) => {
    const fees = r2(Math.abs(pnl) * feeShare + trades * 0.4)
    return { uni_id, name, pnl, pnl_gross: r2(pnl + fees), fees, pct, trades }
  }
  return {
    success: true, min_deposit: 1000,
    funnel: [
      { key: 'signed_up', count: 14 }, { key: 'approved', count: 12 }, { key: 'connected', count: 7 },
      { key: 'funded', count: 6 }, { key: 'traded_7d', count: 5 },
    ],
    active: { today: 4, d7: 5, d30: 6 },
    status: { pending: 1, active: 11, suspended: 2 },
    stopped_30d: { disconnected: 1, disabled: 1, key_blocked: 1 },
    signups_weekly,
    by_exchange: [
      { exchange: 'binance', live: 6, demo: 1, capital: 21430.5 },
      { exchange: 'mexc', live: 1, demo: 1, capital: 1210 },
      { exchange: 'bybit', live: 0, demo: 0, capital: 0 },
    ],
    top_capital: [
      { uni_id: 'u-daniel', name: 'Daniel Moreau', value: 9820.4 }, { uni_id: 'u-noah', name: 'Noah Klein', value: 5410.1 },
      { uni_id: 'u-sofia', name: 'Sofia Ramos', value: 2050.2 }, { uni_id: 'u-liam', name: 'Liam Becker', value: 1030.8 },
      { uni_id: 'u-emma', name: 'Emma Duarte', value: 990.5 },
    ],
    profit: {
      this_month: {
        from: firstOfMonth, to: today,
        master: row('m', 'Master', 182.4, 1.42, 9),
        customers: [
          row('u-sofia', 'Sofia Ramos', 31.2, 1.55, 9), row('u-noah', 'Noah Klein', 72.6, 1.38, 9),
          row('u-daniel', 'Daniel Moreau', 120.5, 1.27, 8), row('u-liam', 'Liam Becker', -2.4, -0.23, 6),
        ],
      },
      last_month: {
        from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd,
        master: row('m', 'Master', -610.3, -4.8, 31),
        customers: [
          row('u-sofia', 'Sofia Ramos', -0.9, -0.05, 30), row('u-liam', 'Liam Becker', -46.1, -4.6, 31),
          row('u-noah', 'Noah Klein', -262.4, -4.9, 31), row('u-daniel', 'Daniel Moreau', -511.7, -5.1, 24),
        ],
      },
    },
    most_missed_7d: [
      { uni_id: 'u-emma', name: 'Emma Duarte', missed: 12, top_reason: 'deposit below minimum' },
      { uni_id: 'u-liam', name: 'Liam Becker', missed: 4, top_reason: 'api key blocked' },
    ],
  }
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
      key_status: 'ok', key_error_reason: null, key_blocked_at: null,
      trading: { state: 'trading', label: 'Trading', invoice_id: null, since: null },
    }],
    standing: {
      trading: { state: 'trading', label: 'Trading', exchange: 'binance', invoice_id: null, since: null },
      key_problem: false, owes: { amount: 0, count: 0, overdue: false },
      last_payment: { invoice_id: 22, amount: invoices[2].total_fee, paid_at: '2026-11-10T08:43:50Z', kind: 'card', label: 'Stripe' },
      pnl_month: 41.25,
    },
    referred_by: { uni_id: 'u-liam', name: 'Liam Becker' },
    contacts: { telegram: 'daniel_trades', discord: 'danielm', discord_linked: true },
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
      month_estimate: 8.25,
      month_estimate_note: 'If the month ended now: 20% of the profit after fees, only above the high-water mark.',
      last_invoice: { id: 22, month_year: '2026-10', total_fee: invoices[2].total_fee, status: 'paid', paid_at: '2026-11-10T08:43:50Z', kind: 'card' },
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
    case 'timeline': return { success: true, events: sampleTimeline() }
    case 'signals': return { success: true, ...sampleSignals() }
    default: return undefined
  }
}

// ---------------------------------------------------------------- one invoice's page
// /admin/invoices/{id}: the invoice + its customer + how it was paid. Invented
// references only (a made-up Stripe session id and tx hash).
function samplePayment(inv) {
  if (inv.status !== 'paid' || inv.total_fee <= 0) return null
  const base = { paid_amount: inv.total_fee, paid_at: `${inv.paid_date}T08:43:50Z`, network: null, explorer_url: null, received: null }
  const n = Number(inv.id)
  if (n % 3 === 0) {
    const hash = `${String(n).repeat(6)}c0ffee`.padEnd(64, 'a').slice(0, 64)
    return {
      ...base, provider: 'tron', kind: 'crypto', label: 'USDT (TRC-20)', test: false, reference: hash, network: 'mainnet',
      explorer_url: `https://tronscan.org/#/transaction/${hash}`,
      received: { amount: (inv.total_fee - 0.02).toFixed(6), asset: 'USDT' },
    }
  }
  if (n % 3 === 1) return { ...base, provider: 'stripe', kind: 'card', label: 'Card (Stripe)', test: false, reference: `cs_live_a1SAMPLE${n}xYzSampleSessionId0000` }
  return {
    ...base, provider: 'manual', kind: 'manual', label: 'Bank transfer (marked paid by an admin)', test: false, reference: null,
    manual_method: 'bank_transfer', note: 'Wise transfer from the customer, ref 4471', marked_by: { uni_id: 'sample-admin', name: 'Sample Admin' },
  }
}

// ---------------------------------------------------------------- the customer's timeline + signals
const ago = (days, h = 10) => new Date(Date.now() - days * 86400000 - h * 3600000).toISOString()
function sampleTimeline() {
  const e = (at, kind, tone, title, detail = null, by = null, invoice_id = null, note_id = null) => ({ at, kind, tone, title, detail, by, invoice_id, note_id })
  return [
    e(ago(0, 2), 'note', 'note', 'Note', 'Asked about raising his deposit to $5,000 next month.', 'Sample Admin', null, 3),
    e('2026-11-10T08:43:50Z', 'payment', 'good', 'Paid the October 2026 invoice: $34.70', 'Card (Stripe)', null, 22),
    e('2026-11-01T09:00:00Z', 'invoice', 'info', 'October 2026 invoice issued: $34.70', 'Due Nov 4, 2026', null, 22),
    e('2026-10-21T07:12:00Z', 'admin', 'neutral', 'Changed the fees: realized 25% → 20%', null, 'Sample Admin'),
    e('2026-10-03T11:20:00Z', 'payment', 'good', 'Paid the September 2026 invoice: $6.96', 'USDT (TRC-20)', null, 21),
    e('2026-09-02T15:05:00Z', 'payment', 'good', 'Paid the August 2026 invoice: $28.11', 'Bank transfer (marked paid by an admin) · "Wise transfer from the customer, ref 4471"', 'Sample Admin', 20),
    e('2026-08-03T13:40:00Z', 'trade', 'good', 'First closed trade', 'On Binance'),
    e('2026-07-28T06:10:00Z', 'account', 'good', 'Connected the Binance account "Main"'),
    e('2026-07-21T04:00:00Z', 'admin', 'good', 'Approved Daniel Moreau', null, 'Sample Admin'),
    e('2026-07-20T09:12:00Z', 'signup', 'info', 'Signed up', 'daniel@example.test'),
  ]
}
function sampleSignals() {
  const row = (i, action, ticker, status, reason) => ({
    log_id: 900 - i, at: ago(i * 0.6, 3), exchange: 'binance', feed: 'main', action, ticker, account: 'Main', status, reason,
  })
  const normal = (key, label) => ({ key, label, severity: 'normal' })
  return {
    signals: [
      row(0, 'EXIT_LONG', 'LTCUSDT', 'filled', null),
      row(1, 'BUY', 'LTCUSDT', 'filled', null),
      row(2, 'BUY', 'LTCUSDT', 'skipped', normal('maxed', 'Stack already full')),
      row(3, 'SELL', 'RENDERUSDT', 'filled', null),
      row(4, 'EXIT_SHORT', 'RENDERUSDT', 'filled', null),
      row(5, 'SELL', 'SOLUSDT', 'skipped', normal('main_full', 'Main account already full')),
    ],
    last_7_days: { filled: 14, skipped: 3, failed: 0 },
  }
}

// ---------------------------------------------------------------- User Management list
function sampleUser(name, trading, extra = {}) {
  const first = name.split(' ')[0].toLowerCase()
  return {
    uni_id: `u-${first}`, name, email: `${first}@example.test`, status: 'active', type: 'user', email_verified: true,
    realized_percentage: 20, unrealized_percentage: 6, created_at: '2026-08-02T10:00:00Z', last_activity: ago(2),
    accounts: [{
      id: first.length, name: 'Main', exchange: 'binance', api_key: 'abcd •••• wxyz', demo: false,
      enabled: trading.state !== 'paused_unpaid', balance: 2400, unrealized_pnl: 3.1, currency_type: 'USDT',
      key_status: trading.state === 'key_blocked' ? 'blocked' : 'ok', key_blocked_at: null, deleted_at: null,
    }],
    trading, key_problem: trading.state === 'key_blocked', owes: { amount: 0, count: 0, overdue: false }, last_payment: null, pnl_month: 0,
    ...extra,
  }
}
const T = (state, label, invoice_id = null) => ({ state, label, exchange: 'binance', invoice_id, since: null })
const pay = (invoice_id, amount, paid_at, kind, label) => ({ invoice_id, amount, paid_at, kind, label })
const USERS_BODY = {
  success: true,
  users: [
    sampleUser('Daniel Moreau', T('trading', 'Trading'), { last_payment: pay(22, 34.7, '2026-11-10T08:43:50Z', 'card', 'Stripe'), pnl_month: 41.25 }),
    sampleUser('Liam Becker', T('paused_unpaid', 'Paused · unpaid invoice', 31), {
      owes: { amount: 12.4, count: 1, overdue: true }, last_payment: pay(11, 12.4, '2026-10-03T11:20:00Z', 'crypto', 'USDT'), pnl_month: -6.1,
    }),
    sampleUser('Sofia Ramos', T('key_blocked', 'Key blocked'), { last_payment: pay(12, 2.44, '2026-10-02T09:00:00Z', 'manual', 'Bank transfer') }),
    sampleUser('Noah Klein', T('trading', 'Trading'), {
      owes: { amount: 5.12, count: 1, overdue: false }, last_payment: pay(13, 5.12, '2026-10-04T09:00:00Z', 'card', 'Stripe'), pnl_month: 18.9,
    }),
    sampleUser('Emma Duarte', T('below_min', 'Below the $1,000 minimum deposit')),
    { ...sampleUser('Lucas Petit', T('no_exchange', 'No exchange')), accounts: [], last_activity: null },
  ],
}

function invoiceView(path) {
  const id = path.split('/')[3]
  const inv = [...INVOICES, ...PROFILE.invoices].find((i) => i.id === id)
  if (!inv) return undefined
  return { success: true, invoice: { ...inv, payment: samplePayment(inv) } }
}

// ---------------------------------------------------------------- Creatives (v2: videos, styles, context)
// Sample clips are public CC0 test videos (MDN), never a Higgsfield file.
const SAMPLE_CLIP_A = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
const SAMPLE_CLIP_B = 'https://interactive-examples.mdn.mozilla.net/media/examples/friday.mp4'
const soon = (days) => new Date(Date.now() + days * 86400000).toISOString()

const CREATIVE_BUDGET = {
  month: new Date().toISOString().slice(0, 7), cap_usd: 100, spent_usd: 18.42, reserved_usd: 1.32, remaining_usd: 81.58,
  generations: 23, ai_usd: 2.1, ai_calls: 31,
  by_person: [{ uni_id: 'sample-admin', name: 'Sample Admin', spent_usd: 18.42, generations: 23, ai_calls: 31 }],
  updated_by_name: 'Sample Admin', updated_at: ago(9),
}

const CREATIVES_META = {
  success: true, configured: true, ai: { configured: true, model: 'claude-opus-5-5', weekly_recap: true },
  retention_days: 7, max_references: 8, budget: CREATIVE_BUDGET, can_edit_budget: true,
  models: [
    { key: 'soul-image', label: 'Soul v2 image', kind: 'image', description: 'A still image.', uses_references: false, needs_source: false, price_hint: 'about $0.004', params: [] },
    { key: 'kling-animate', label: 'Kling 2.5 Turbo Pro', kind: 'video', description: 'Animates one still.', uses_references: false, needs_source: true, price_hint: 'about $0.26 for 5 s', params: [] },
    { key: 'seedance-text-video', label: 'Seedance 2.5 text-to-video', kind: 'video', description: 'A clip with its own sound, no character pictures.', uses_references: false, requires_character: false, needs_source: false, price_hint: 'about $1.32 for 5 s', params: [] },
  ],
}

function sampleGeneration(id, url, daysLeft, label = 'Kling 2.5 Turbo Pro') {
  return {
    id, plan_id: null, plan_title: null, kind: 'video', model: 'kling-animate', model_label: label,
    prompt: 'Slow push-in on a glowing trading screen in a dark room, neon reflections', params: { duration: 5 },
    used_character: false, status: 'completed', error: null,
    outputs: [{ type: 'video', url, download_path: `/api/creatives/generations/${id}/download/0?signature=sample` }],
    estimated_usd: 0.27, charged_usd: 0.27, expires_at: soon(daysLeft), completed_at: ago(1), created_at: ago(1), created_by_name: 'Sample Admin',
  }
}

const STEP = (label, model_label, usd, status, generation = null) => ({ label, model: 'kling-animate', model_label, usd, status, generation, error: null })

const VIDEO_JOB = {
  id: 41, title: 'Week 46 recap — 2 scenes', status: 'running', plan_id: null, plan_title: null, estimated_usd: 1.6,
  steps: [
    STEP('Hook — the still', 'Soul v2 image', 0.004, 'completed'),
    STEP('Hook — the clip', 'Kling 2.5 Turbo Pro', 0.26, 'completed', sampleGeneration(301, SAMPLE_CLIP_A, 6)),
    STEP('The city at night', 'Seedance 2.5 text-to-video', 1.32, 'running', { ...sampleGeneration(303, SAMPLE_CLIP_B, 7), status: 'in_progress', outputs: [], charged_usd: 1.32 }),
  ],
  approved_by_name: 'Sample Admin', created_at: ago(0, 0.2), expires_at: null, video_id: 1, editor_path: '/admin/creatives/editor/1',
}

function sampleScene(id, position, extra) {
  return {
    id, position, kind: 'clip', label: 'Scene', prompt: null, engine: 'kling', engine_label: 'Kling · silent', with_character: false,
    seconds: 5, template: null, generation: null, output_index: 0, agent_job_id: 41, step_index: null,
    trim_in_ms: null, trim_out_ms: null, duration_ms: 5000, status: 'ready', error: null, ...extra,
  }
}

function sampleVideo() {
  return {
    id: 1, title: 'Week 46 recap', plan_id: null, plan_title: null, style: { id: 2, slug: 'pixel-arcade', name: 'Pixel arcade' },
    platform: 'tiktok', aspect: '9:16', max_seconds: 30, fps: 30, status: 'draft', exported_at: null, exported_by_name: null,
    export_seconds: null, export_bytes: null, created_by_name: 'Sample Admin', updated_by_name: 'Sample Admin',
    created_at: ago(1), updated_at: ago(0, 0.1), duration_ms: 19000,
    timeline: {
      version: 1, caption_style: 'pixel',
      captions: [
        { id: 'cap1', text: 'This week: +3.1%', start_ms: 0, end_ms: 2600, style: 'hook', position: 'top' },
        { id: 'cap2', text: '12 trades, LTC on top', start_ms: 5200, end_ms: 9000, style: 'body', position: 'bottom' },
        { id: 'cap3', text: 'Past performance does not guarantee future results.', start_ms: 16000, end_ms: 19000, style: 'disclaimer', position: 'bottom' },
      ],
      look: { pixel_size: 0, scanlines: true },
      music: { source: 'chiptune', preset: 'arcade-upbeat', seed: 4242, volume: 0.6, fade_out_ms: 1500 },
      voiceover: null,
      sfx: [{ id: 'sfx1', sound: 'coin', at_ms: 1200, volume: 0.8 }, { id: 'sfx2', sound: 'levelup', at_ms: 10200, volume: 0.8 }],
      clip_audio_volume: 1, ducking: { enabled: true, music_under_voice: 0.25 },
    },
    scenes: [
      sampleScene(11, 1, { label: 'Hook — trading screen', prompt: 'Slow push-in on a glowing trading screen', generation: sampleGeneration(301, SAMPLE_CLIP_A, 6), step_index: 1 }),
      sampleScene(12, 2, { kind: 'template', label: 'High score', engine: null, engine_label: null, agent_job_id: null, seconds: 4, duration_ms: 4000, template: { key: 'pixel-scoreboard', title: 'HIGH SCORE', value: '+3.1%', subtitle: 'THIS WEEK · 12 TRADES' } }),
      sampleScene(13, 3, { label: 'The city at night', engine: 'seedance', engine_label: 'Seedance · with sound', prompt: 'Neon city at night, 8-bit chiptune music', status: 'generating', step_index: 2 }),
      sampleScene(14, 4, { label: 'Pixel waves goodbye', with_character: true, prompt: 'Pixel waves at the camera', generation: sampleGeneration(302, SAMPLE_CLIP_B, 0.6), trim_out_ms: 4000, duration_ms: 4000 }),
    ],
    jobs: [VIDEO_JOB],
  }
}

const SAMPLE_STYLES = [
  ['data-recap', 'Data recap', 'Clean charts and numbers, stat cards, calm confident b-roll.', 'tiktok', '9:16', 'none', 'kling', 'bold', 'clean', 'none', false],
  ['pixel-arcade', 'Pixel arcade', '8-bit arcade world, HIGH SCORE card for the week’s %, chiptune and coin sounds.', 'tiktok', '9:16', 'cameo', 'seedance', 'pixel', 'pixel', 'arcade-upbeat', true],
  ['pixel-storytime', 'Pixel storytime', 'Pixel tells a tiny story in 3–4 scenes.', 'tiktok', '9:16', 'lead', 'seedance', 'bold', 'pixel', 'arcade-chill', false],
  ['cinematic-broll', 'Cinematic b-roll', 'Moody city and market b-roll, slow camera moves, one strong line per scene.', 'x', '16:9', 'cameo', 'seedance', 'clean', 'clean', 'none', false],
  ['fast-cut', 'Fast cut', '5-second scenes, punchy captions, music-driven.', 'tiktok', '9:16', 'none', 'kling', 'bold', 'clean', 'arcade-boss', false],
].map(([slug, name, summary, default_platform, default_aspect, pixel_default, default_engine, caption_style, template_family, music_default, pixel_look], i) => ({
  id: i + 1, slug, name, summary, markdown: `## Look\n- ${summary}\n\n## Scenes\n- Open with a hook in the first two seconds.`,
  default_platform, default_aspect, pixel_default, default_engine, caption_style, template_family, music_default, pixel_look,
  enabled: i !== 4, sort: i, updated_by_name: i === 1 ? 'Sample Admin' : null, updated_at: ago(2),
}))

const PLAYBOOK_MD = '# Purpose\nShort videos that show what the bot did, honestly.\n\n## Anatomy\n- A hook in the first 2 seconds\n- 3–6 scenes, 30 seconds at most\n- Numbers go on template cards, never inside a generated clip\n- End with the disclaimer card when a % is cited\n\n## Pixel is a guest\n- Off by default; a cameo is one scene\n\n## Engines\n- Kling: silent and cheaper — the music carries it\n- Seedance: comes with its own sound'

const CREATIVE_CONTEXT = {
  success: true,
  context: {
    system: 'You are the Pixel Alpha content agent.\n\nTwo kinds of figures: query_data is for understanding; only get_week_results figures go into anything posted.\nFollow the PLAYBOOK and the chosen STYLE. Pixel is off by default.',
    tools: [
      { name: 'ask_choices', description: 'Ask a question with buttons. The turn ends after it.', input_schema: { type: 'object', properties: { question: { type: 'string' } } } },
      { name: 'get_week_results', description: 'The public results for a window, per exchange and coin.', input_schema: { type: 'object', properties: { days: { type: 'integer' } } } },
      { name: 'create_video', description: 'Create a video project and its scenes.', input_schema: { type: 'object', properties: { title: { type: 'string' } } } },
    ],
    playbook: { version: 3, markdown: PLAYBOOK_MD },
    brief: { version: 5, markdown: '# Who we are\nPixel Alpha runs a trading bot. Plain, friendly, never hype.' },
    memory: { version: 2, text: '- TikTok hooks with a number do best.\n- Keep captions to six words.' },
    styles: SAMPLE_STYLES.filter((s) => s.enabled).map(({ slug, name, summary }) => ({ slug, name, summary })),
    context_block: '[Context]\n{"today":"2026-11-12","mode":"generate","styles":[{"slug":"pixel-arcade","name":"Pixel arcade"}],"videos_in_progress":[{"id":1,"title":"Week 46 recap","scenes_ready":2,"scenes_total":4}]}\n\nPLAYBOOK (version 3, in full)\n…',
  },
}

const VIDEO_LIST = {
  success: true,
  videos: [
    { id: 1, title: 'Week 46 recap', platform: 'tiktok', aspect: '9:16', style_name: 'Pixel arcade', status: 'draft', scenes_total: 4, scenes_ready: 3, scenes_generating: 1, duration_ms: 19000, created_by_name: 'Sample Admin', updated_at: ago(0, 0.1) },
    { id: 2, title: 'How the bot trades', platform: 'x', aspect: '16:9', style_name: 'Cinematic b-roll', status: 'exported', scenes_total: 5, scenes_ready: 5, scenes_generating: 0, duration_ms: 27500, created_by_name: 'Sample Admin', updated_at: ago(3) },
    { id: 3, title: 'LTC spotlight', platform: 'tiktok', aspect: '9:16', style_name: null, status: 'draft', scenes_total: 0, scenes_ready: 0, scenes_generating: 0, duration_ms: 0, created_by_name: 'Sample Admin', updated_at: ago(5) },
  ],
}

const AUDIO_LIST = {
  success: true,
  audio: [
    { id: 1, kind: 'music', label: 'Upbeat synth loop', mime: 'audio/mpeg', bytes: 2_400_000, duration_ms: 31000, url: '/api/creatives/audio/1/file?signature=sample', created_by_name: 'Sample Admin', created_at: ago(4) },
    { id: 2, kind: 'voiceover', label: 'Week 46 voiceover', mime: 'audio/webm', bytes: 380_000, duration_ms: 14200, url: '/api/creatives/audio/2/file?signature=sample', created_by_name: 'Sample Admin', created_at: ago(1) },
  ],
}

const AGENT_SESSION = () => ({
  success: true,
  session: { id: 'sample-session', mode: 'generate' },
  budget: CREATIVE_BUDGET,
  jobs: [VIDEO_JOB],
  messages: [
    { id: 1, kind: 'user', text: 'Make a 20-second video of this week’s results', mode: 'generate', created_at: ago(0, 0.5) },
    { id: 2, kind: 'activity', activity: { tool: 'get_week_results', label: 'Read the public results', ok: true }, created_at: ago(0, 0.5) },
    { id: 3, kind: 'choices', choices: { question: 'Which platform is it for?', options: [{ label: 'TikTok', value: 'TikTok' }, { label: 'X', value: 'X' }], allow_other: false }, created_at: ago(0, 0.5) },
    { id: 4, kind: 'user', text: 'TikTok', mode: 'generate', created_at: ago(0, 0.45) },
    { id: 5, kind: 'choices', choices: { question: 'Which style?', options: [{ label: 'Pixel arcade', value: 'pixel-arcade' }, { label: 'Data recap', value: 'data-recap' }, { label: 'Fast cut', value: 'fast-cut' }], allow_other: true }, created_at: ago(0, 0.4) },
    { id: 6, kind: 'user', text: 'pixel-arcade', mode: 'generate', created_at: ago(0, 0.35) },
    { id: 7, kind: 'assistant', text: 'Here is the plan — four scenes, 19 seconds, Pixel in the last one only.', created_at: ago(0, 0.3) },
    { id: 8, kind: 'video', video_id: 1, text: 'Week 46 recap', created_at: ago(0, 0.3) },
    { id: 9, kind: 'job', job_id: 41, created_at: ago(0, 0.3) },
  ],
})


// Admin → Trading Assets editor (SAMPLE figures): one Binance coin, its
// Binance check and the position-limit check (POST, answered in answer()).
const SAMPLE_ASSET = {
  asset_id: 11, ticker: 'SANTOSUSDT', type: 'Cryptocurrency', broker: 'Binance', side: 'ALL', asset_image: null,
  max_increments: 1200, base_size: 400, leverage: 10, enabled: true, streak_sizing_enabled: false, streak_sizes: [],
  kill_switch_losses: 4, killed_at: null, killed_reason: null, kill_switch_armed_at: ago(3),
  created_at: ago(16), updated_at: ago(0, 0.5), pending_sizing: null,
}
const BINANCE_CHECK = {
  success: true, ticker: 'SANTOSUSDT', symbol: 'SANTOSUSDT',
  binance: { listed: true, status: 'TRADING', price: 0.38, step_size: '1', min_qty: 1, min_notional: 5 },
  binance_error: null,
  accounts: { count: 6, smallest_balance: 1020, smallest_name: 'Sample Customer F', demo_only: false },
  leverage: { value: 25, source: 'coin' }, min_deposit: 1000, checked_at: new Date().toISOString(),
}
const limitRow = (name, balance, isMaster = false) => {
  const entry = balance < 1000 ? 400 : Math.floor((400 * balance) / 1000 / 40) * 40
  const full = entry * 3
  return {
    name, is_master: isMaster, balance, entry_qty: entry, entry_usd: +(entry * 0.38).toFixed(2), full_qty: full,
    full_usd: +(full * 0.38).toFixed(2), over: full * 0.38 > 10000, used_pct: +((full * 0.38) / 100).toFixed(1),
  }
}
const POSITION_LIMIT = {
  success: true, exchange: 'binance', ticker: 'SANTOSUSDT', mark_price: 0.38, leverage: 10, leverage_assumed: false,
  max_leverage: 10, cap_usd: 10000, leverage_allowed: true,
  brackets: [
    { leverage: 10, floor_usd: 0, cap_usd: 10000 }, { leverage: 5, floor_usd: 10000, cap_usd: 60000 },
    { leverage: 4, floor_usd: 60000, cap_usd: 70000 },
  ],
  entries: 3,
  accounts: [
    limitRow('Sample Master', 17028, true), limitRow('Sample Customer A', 10146), limitRow('Sample Customer B', 6213),
    limitRow('Sample Customer C', 2027), limitRow('Sample Customer D', 1026), limitRow('Sample Customer F', 1020),
  ],
  over_count: 0, safe_balance: 21929.82, price_headroom_pct: 29,
}
const ASSET_GET = {
  '/admin/assets/binance-check': BINANCE_CHECK,
  '/admin/assets/history': { success: true, changes: [], has_more: false },
  '/admin/assets': { success: true, assets: [SAMPLE_ASSET] },
}

const CREATIVE_GET = {
  '/admin/creatives': CREATIVES_META,
  '/admin/creatives/budget': { success: true, budget: CREATIVE_BUDGET },
  '/admin/creatives/agent/session': AGENT_SESSION,
  '/admin/creatives/agent/context': CREATIVE_CONTEXT,
  '/admin/creatives/playbook': { success: true, playbook: { markdown: PLAYBOOK_MD, updated_by_name: 'Sample Admin', updated_at: ago(2) } },
  '/admin/creatives/brief': { success: true, brief: { markdown: '# Who we are\nPixel Alpha runs a trading bot.', updated_by_name: null, updated_at: null } },
  '/admin/creatives/styles': { success: true, styles: SAMPLE_STYLES },
  '/admin/creatives/videos': VIDEO_LIST,
  '/admin/creatives/videos/': () => ({ success: true, video: sampleVideo() }),
  '/admin/creatives/audio': AUDIO_LIST,
  '/admin/creatives/memory': { success: true, memories: [] },
  '/admin/creatives/plans': { success: true, plans: [] },
  '/admin/creatives/generations': () => ({ success: true, generations: [sampleGeneration(301, SAMPLE_CLIP_A, 6), sampleGeneration(302, SAMPLE_CLIP_B, 0.6)], has_more: false }),
  '/admin/creatives/character': { success: true, character: { id: 1, name: 'Pixel', look: null, style_prompt: null, rules: null, refs: [], updated_by_name: null, updated_at: null } },
}

// ---------------------------------------------------------------- router
/** Longest matching prefix wins; values may be functions (fresh dates per call). */
const GET = {
  '/admin/users/': (_user, path) => userProfile(path),
  '/admin/invoices/': (_user, path) => invoiceView(path),
  '/admin/affiliate/users/': { success: true, referrals: [] },
  '/admin/users': USERS_BODY,
  '/auth/me': (user) => ({ success: true, user }),
  '/admin/invoices': INVOICES_BODY,
  '/admin/tron-transfers': TRANSFERS_BODY,
  '/admin/insights/overview': OVERVIEW_BODY,
  '/admin/visitors/summary': visitorSummary,
  '/admin/insights/customers': customerInsights,
  '/admin/visitors/log': VISITOR_LOG_BODY,
  ...CREATIVE_GET,
  ...ASSET_GET,
}

export function answer(method, path, user, query = new URLSearchParams()) {
  if (path.startsWith('/public/visits')) return null
  if (method === 'POST' && path === '/admin/assets/position-limit') return POSITION_LIMIT
  if (method !== 'GET') return undefined
  const key = Object.keys(GET).filter((k) => path.startsWith(k)).sort((a, b) => b.length - a.length)[0]
  if (!key) return undefined
  const value = GET[key]
  return typeof value === 'function' ? value(user, path, query) : value
}

/** What the skill captures when it is given no route. */
export const DEFAULT_ROUTES = [
  '/admin?view=attention',
  '/admin/invoices',
  '/admin/tron-transfers',
  '/admin/visitors',
]
