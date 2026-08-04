import { useCallback, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SkipForward,
  XCircle,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import TradeLogCard from '../../components/admin/tradeLogs/TradeLogCard'
import { useApiData } from '../../hooks/useApiData'
import { getTradeLogs } from '../../services/tradeLogs'
import { ApiError } from '../../services/api'

const TITLE = 'Signal Log'
const SUBTITLE =
  'Every signal the engine processed, with the sizing decision it made per account.'
const PER_PAGE = 25

const ACTIONS = ['all', 'BUY', 'SELL', 'EXIT_LONG', 'EXIT_SHORT'] as const
const RESULTS = [
  { key: 'all', label: 'All' },
  { key: 'success', label: 'Clean' },
  { key: 'problem', label: 'Had issues' },
] as const

const STAT_ICON =
  'w-10 h-10 flex-shrink-0 grid place-items-center rounded-[11px] bg-surface2 border border-border'
const CHIP_BASE =
  'border rounded-pill py-[7px] px-3.5 text-[12px] font-semibold cursor-pointer transition-[border-color,color] duration-150'
const CHIP_OFF =
  'border-border bg-surface2 text-muted hover:text-text hover:border-accent'
const CHIP_ON = 'bg-accent border-accent text-on-accent'
const SELECT =
  'h-[38px] border border-border rounded-[12px] bg-surface2 text-text px-3 text-[12.5px] font-body cursor-pointer'
const PAG_BTN =
  'grid place-items-center w-8 h-8 border border-border bg-surface2 text-text rounded-[9px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

export default function AdminTradeLogs() {
  const [action, setAction] = useState<string>('all')
  const [result, setResult] = useState<string>('all')
  const [ticker, setTicker] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)

  const offset = (page - 1) * PER_PAGE

  const fetcher = useCallback(
    () =>
      getTradeLogs({ action, result, ticker, from, to, limit: PER_PAGE, offset }),
    [action, result, ticker, from, to, offset],
  )
  const { data, loading, error, reload } = useApiData(fetcher, [
    action,
    result,
    ticker,
    from,
    to,
    offset,
  ])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.pagination.total ?? 0) / PER_PAGE)),
    [data],
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <AdminLayout title={TITLE} subtitle={SUBTITLE}>
        <DataState loading={loading} error={error} onRetry={reload} label="signal log" />
      </AdminLayout>
    )
  }

  // Changing a filter must always land back on page 1, or an out-of-range
  // offset silently returns an empty page.
  const setFilter = (fn: () => void) => {
    fn()
    setPage(1)
    setExpanded(null)
  }

  const { summary, logs, options } = data

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      <div
        className="grid grid-cols-4 gap-[14px] mb-[18px] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1"
        data-aos="fade-up"
      >
        <StatCard icon={<Activity size={18} />} label="Signals" value={summary.signals} />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          tone="text-green"
          label="Orders filled"
          value={summary.filled}
        />
        <StatCard
          icon={<SkipForward size={18} />}
          tone="text-accent"
          label="Accounts skipped"
          value={summary.skipped}
        />
        <StatCard
          icon={<XCircle size={18} />}
          tone="text-red"
          label="Accounts failed"
          value={summary.failed}
        />
      </div>

      <section
        className="rounded-card border border-border bg-surface p-[18px]"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4">
          <div className="flex gap-1.5 flex-wrap">
            {ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                className={`${CHIP_BASE} ${action === a ? CHIP_ON : CHIP_OFF}`}
                onClick={() => setFilter(() => setAction(a))}
              >
                {a === 'all' ? 'All actions' : a.replace('_', ' ')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-[6px] rounded-[9px] py-[7px] px-3 text-[12px] font-semibold cursor-pointer border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 disabled:opacity-50 enabled:hover:text-text enabled:hover:border-accent"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap mb-4">
          <div className="flex gap-1.5 flex-wrap">
            {RESULTS.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`${CHIP_BASE} ${result === r.key ? CHIP_ON : CHIP_OFF}`}
                onClick={() => setFilter(() => setResult(r.key))}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            className={SELECT}
            value={ticker}
            onChange={(e) => setFilter(() => setTicker(e.target.value))}
            aria-label="Filter by ticker"
          >
            <option value="all">All tickers</option>
            {options.tickers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[12px] text-faint">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFilter(() => setFrom(e.target.value))}
              className={SELECT}
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-faint">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setFilter(() => setTo(e.target.value))}
              className={SELECT}
            />
          </label>
        </div>

        <div
          key={`${action}-${result}-${ticker}-${from}-${to}-${page}`}
          className="flex flex-col gap-2.5 animate-[fadeup_0.35s_ease-out]"
        >
          {logs.length === 0 ? (
            <p className="text-center text-muted py-[34px] text-[13px]">
              {summary.signals === 0
                ? 'No signals logged yet. The engine writes a row here every time TradingView fires.'
                : 'No signals match your filters.'}
            </p>
          ) : (
            logs.map((log) => (
              <TradeLogCard
                key={log.id}
                log={log}
                expanded={expanded === log.id}
                onToggle={() => setExpanded(expanded === log.id ? null : log.id)}
              />
            ))
          )}
        </div>

        {data.pagination.total > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-2.5 mt-4 pt-3.5 border-t border-hair">
            <span className="text-[12px] text-faint">
              Showing {offset + 1}–{Math.min(offset + logs.length, data.pagination.total)} of{' '}
              {data.pagination.total}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className={PAG_BTN}
                onClick={() => { setPage((p) => Math.max(1, p - 1)); setExpanded(null) }}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-[12.5px] text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={PAG_BTN}
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); setExpanded(null) }}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>
    </AdminLayout>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone = 'text-muted',
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-card flex items-center gap-[13px]">
      <span className={`${STAT_ICON} ${tone}`}>{icon}</span>
      <div>
        <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]">
          {label}
        </p>
        <p className="text-[19px] font-bold text-text leading-[1.1] font-mono">{value}</p>
      </div>
    </div>
  )
}
