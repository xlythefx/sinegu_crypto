import { useMemo, useState } from 'react'
import {
  Activity,
  Cpu,
  MemoryStick,
  Gauge,
  Server,
  FileText,
  HardDrive,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/ui/ConfirmModal'

/* ---- shared token-mapped class strings ---- */
const CARD = 'rounded-card border border-border bg-surface p-card'
const HEAD = 'flex flex-wrap items-start justify-between gap-3 mb-[18px]'
const HEAD_L = 'flex items-start gap-2.5'
const CHIP =
  'w-7 h-7 flex-none grid place-items-center rounded-[9px] bg-accent-soft border border-accent-line text-accent'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'
const INPUT =
  'h-[38px] rounded-field border border-border bg-surface2 px-3 text-[13px] text-text outline-none focus:border-accent [&>option]:bg-surface [&>option]:text-text'
const BTN_GHOST =
  'inline-flex items-center gap-1.5 h-[34px] rounded-pill border border-border bg-surface2 px-3.5 text-[12.5px] font-semibold text-text transition-[border-color,color] duration-150 hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_APPLY =
  'inline-flex items-center h-[38px] rounded-pill bg-accent px-4 text-[13px] font-bold text-on-accent'
const PAG_BTN =
  'rounded-pill border border-border bg-surface2 py-[7px] px-[15px] text-[12.5px] font-semibold text-text hover:border-accent disabled:opacity-45 disabled:cursor-not-allowed'
const TH =
  'border-b border-border py-2.5 px-3 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint whitespace-nowrap'
const TD = 'border-b border-hair py-[11px] px-3 align-middle whitespace-nowrap'
const TD_META = `${TD} text-[12.5px] text-muted`

/* ---- threshold → colour helpers (accent = moderate, green = ok, red = high) ---- */
type Tone = 'ok' | 'warn' | 'high'
const BAR_TONE: Record<Tone, string> = {
  ok: 'bg-green',
  warn: 'bg-accent',
  high: 'bg-red',
}
const TEXT_TONE: Record<Tone, string> = {
  ok: 'text-green',
  warn: 'text-accent',
  high: 'text-red',
}
const pctTone = (v: number): Tone => (v < 50 ? 'ok' : v < 75 ? 'warn' : 'high')
const msTone = (v: number): Tone => (v < 20 ? 'ok' : v < 50 ? 'warn' : 'high')

/* ============================ Resources Monitor ============================ */

interface Metric {
  key: string
  label: string
  icon: typeof Cpu
  value: number
  unit: string
  fill: number // 0–100 width
  tone: Tone
  note: string
}

function buildMetrics(cpu: number, ram: number, latency: number): Metric[] {
  return [
    {
      key: 'cpu',
      label: 'CPU Usage',
      icon: Cpu,
      value: cpu,
      unit: '%',
      fill: cpu,
      tone: pctTone(cpu),
      note:
        cpu < 50
          ? 'System running smoothly'
          : cpu < 75
            ? 'Moderate load detected'
            : 'High CPU usage — consider optimization',
    },
    {
      key: 'ram',
      label: 'RAM Usage',
      icon: MemoryStick,
      value: ram,
      unit: '%',
      fill: ram,
      tone: pctTone(ram),
      note:
        ram < 50
          ? 'Memory usage is optimal'
          : ram < 75
            ? 'Moderate memory consumption'
            : 'High memory usage — monitor closely',
    },
    {
      key: 'latency',
      label: 'Network Latency',
      icon: Gauge,
      value: latency,
      unit: 'ms',
      fill: Math.min(100, latency),
      tone: msTone(latency),
      note:
        latency < 20
          ? 'Excellent network response time'
          : latency < 50
            ? 'Good network performance'
            : 'Network latency is elevated',
    },
  ]
}

const LATENCY_LABEL: Record<Tone, string> = {
  ok: 'Excellent',
  warn: 'Good',
  high: 'High',
}

function ResourcesMonitor() {
  // static baseline; refresh applies a light local jitter so the UI feels live
  const [reading, setReading] = useState({ cpu: 34.2, ram: 61.8, latency: 18 })
  const [updatedAt, setUpdatedAt] = useState('2:34:12 PM')

  const metrics = useMemo(
    () => buildMetrics(reading.cpu, reading.ram, reading.latency),
    [reading],
  )

  const refresh = () => {
    const jitter = (base: number, spread: number, min: number, max: number) =>
      Math.min(max, Math.max(min, +(base + (Math.random() - 0.5) * spread).toFixed(1)))
    setReading({
      cpu: jitter(reading.cpu, 18, 6, 92),
      ram: jitter(reading.ram, 12, 20, 94),
      latency: Math.round(jitter(reading.latency, 20, 6, 80)),
    })
    setUpdatedAt(
      new Date().toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }),
    )
  }

  return (
    <section className={CARD} data-aos="fade-up">
      <div className={HEAD}>
        <div className={HEAD_L}>
          <span className={CHIP}>
            <Activity size={16} />
          </span>
          <div>
            <div className={CARD_TITLE}>System Resources Monitor</div>
            <div className={CARD_SUB}>
              Real-time system performance metrics from Main Server
              <span className="ml-1.5 text-faint">(Last updated: {updatedAt})</span>
            </div>
          </div>
        </div>
        <button type="button" className={BTN_GHOST} onClick={refresh}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {metrics.map((m) => (
          <div className="flex flex-col gap-3" key={m.key}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <m.icon size={18} className="text-accent" />
                <span className="text-[13px] font-semibold">{m.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-[17px] font-extrabold ${TEXT_TONE[m.tone]}`}
                >
                  {m.value.toFixed(m.unit === 'ms' ? 0 : 1)}
                  {m.unit}
                </span>
                {m.key === 'latency' && (
                  <span
                    className={`inline-flex items-center rounded-pill border py-[2px] px-2 font-mono text-[10.5px] font-semibold ${TEXT_TONE[m.tone]} border-current/40`}
                  >
                    {LATENCY_LABEL[m.tone]}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="h-3 w-full overflow-hidden rounded-pill bg-surface2 border border-hair">
                <div
                  className={`h-full rounded-pill transition-[width] duration-500 ease-out ${BAR_TONE[m.tone]}`}
                  style={{ width: `${m.fill}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10.5px] text-faint">
                <span>{m.unit === 'ms' ? '0ms' : '0%'}</span>
                <span>{m.unit === 'ms' ? '100ms' : '100%'}</span>
              </div>
            </div>
            <p className="text-[12px] text-muted">{m.note}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ============================== System Logs =============================== */

interface ApiLogRow {
  id: number
  api_name: string
  description: string
  action: string
  success: boolean
  created_at: string
}

// Static sample rows (no API yet) — mirrors the future `api_logs` table shape.
const SAMPLE_LOGS: ApiLogRow[] = [
  { id: 4821, api_name: 'users/login', description: 'Trader signed in', action: 'login', success: true, created_at: 'Jul 27, 2026 14:32:08' },
  { id: 4820, api_name: 'binance/sync_positions', description: 'Synced 3 open positions', action: 'fetch', success: true, created_at: 'Jul 27, 2026 14:31:50' },
  { id: 4819, api_name: 'invoice/settle', description: 'Invoice #182 marked paid', action: 'update', success: true, created_at: 'Jul 27, 2026 14:28:11' },
  { id: 4818, api_name: 'exchange/connect', description: 'Binance API key rejected — invalid signature', action: 'create', success: false, created_at: 'Jul 27, 2026 14:22:03' },
  { id: 4817, api_name: 'assets/update', description: 'BTCUSDT base size changed', action: 'update', success: true, created_at: 'Jul 27, 2026 14:19:47' },
  { id: 4816, api_name: 'binance/close_position', description: 'Closed ETHUSDT +$212.40', action: 'update', success: true, created_at: 'Jul 27, 2026 14:15:22' },
  { id: 4815, api_name: 'users/password', description: 'Password change failed — wrong current password', action: 'update', success: false, created_at: 'Jul 27, 2026 14:09:58' },
  { id: 4814, api_name: 'admin/users_list', description: 'Fetched 42 users', action: 'fetch', success: true, created_at: 'Jul 27, 2026 14:04:31' },
  { id: 4813, api_name: 'invoice/generate', description: 'Generated invoice for account #4', action: 'create', success: true, created_at: 'Jul 27, 2026 13:58:12' },
  { id: 4812, api_name: 'sandbox/delete_user', description: 'Removed sandbox user #77', action: 'delete', success: true, created_at: 'Jul 27, 2026 13:51:40' },
  { id: 4811, api_name: 'users/login', description: 'Login blocked — account suspended', action: 'login', success: false, created_at: 'Jul 27, 2026 13:44:19' },
  { id: 4810, api_name: 'binance/sync_positions', description: 'Synced 5 open positions', action: 'fetch', success: true, created_at: 'Jul 27, 2026 13:40:02' },
  { id: 4809, api_name: 'assets/delete', description: 'Removed asset SOLUSDT', action: 'delete', success: true, created_at: 'Jul 27, 2026 13:33:55' },
  { id: 4808, api_name: 'strategies/update', description: 'Updated Momentum strategy params', action: 'update', success: true, created_at: 'Jul 27, 2026 13:27:14' },
]

const ACTIONS = ['all', 'login', 'create', 'update', 'delete', 'fetch']
type SuccessFilter = 'all' | 'success' | 'failed'
const PAGE_SIZE = 8

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-pill border border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] py-[3px] px-2.5 text-[11px] font-bold text-green">
      <CheckCircle2 size={12} /> Success
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-pill border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] py-[3px] px-2.5 text-[11px] font-bold text-red">
      <XCircle size={12} /> Failed
    </span>
  )
}

function SystemLogs() {
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [action, setAction] = useState('all')
  const [status, setStatus] = useState<SuccessFilter>('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = applied.trim().toLowerCase()
    return SAMPLE_LOGS.filter((l) => {
      const matchesQ =
        !q ||
        l.api_name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
      const matchesAction = action === 'all' || l.action === action
      const matchesStatus =
        status === 'all' ||
        (status === 'success' ? l.success : !l.success)
      return matchesQ && matchesAction && matchesStatus
    })
  }, [applied, action, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)

  const applySearch = () => {
    setApplied(search)
    setPage(1)
  }

  return (
    <section className={CARD} data-aos="fade-up">
      <div className={HEAD}>
        <div className={HEAD_L}>
          <span className={CHIP}>
            <FileText size={16} />
          </span>
          <div>
            <div className={CARD_TITLE}>System Logs</div>
            <div className={CARD_SUB}>
              General API activity — login, exchange sync, edit, delete and other
              calls. (Sample data — no API yet.)
            </div>
          </div>
        </div>
        <button type="button" className={BTN_GHOST} onClick={() => setPage(1)}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          className={`${INPUT} min-w-[240px] grow max-w-[340px]`}
          placeholder="Search API name or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          aria-label="Search logs"
        />
        <select
          className={INPUT}
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by action"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a === 'all' ? 'All actions' : a[0].toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>
        <select
          className={INPUT}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as SuccessFilter)
            setPage(1)
          }}
          aria-label="Filter by status"
        >
          <option value="all">All</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        <button type="button" className={BTN_APPLY} onClick={applySearch}>
          Apply
        </button>
      </div>

      <div
        key={`${applied}-${action}-${status}-${safePage}`}
        className="overflow-x-auto animate-[fadeup_0.35s_ease-out]"
      >
        <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className={TH}>ID</th>
              <th className={TH}>API Name</th>
              <th className={TH}>Description</th>
              <th className={TH}>Action</th>
              <th className={TH}>Status</th>
              <th className={TH}>Time</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child_td]:border-0">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-9 px-3 text-center text-muted">
                  No logs match your filters.
                </td>
              </tr>
            )}
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-surface2">
                <td className={`${TD} font-mono text-[12.5px] text-muted`}>
                  {l.id}
                </td>
                <td className={`${TD} font-mono text-[12.5px]`}>{l.api_name}</td>
                <td className={`${TD} max-w-[280px] truncate`} title={l.description}>
                  {l.description || '—'}
                </td>
                <td className={TD}>
                  <span className="inline-flex items-center rounded-pill border border-border bg-surface2 py-[3px] px-2.5 text-[11px] font-semibold text-muted">
                    {l.action}
                  </span>
                </td>
                <td className={TD}>
                  <StatusBadge ok={l.success} />
                </td>
                <td className={TD_META}>{l.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="mt-3.5 flex items-center justify-between border-t border-hair pt-3">
          <span className="text-[12.5px] text-muted">
            Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={PAG_BTN}
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className={PAG_BTN}
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/* =========================== System Management =========================== */

interface CleanTarget {
  key: 'cache' | 'logs' | 'temp'
  label: string
  icon: typeof HardDrive
  value: string
  note: string
}

const CLEAN_TARGETS: CleanTarget[] = [
  {
    key: 'cache',
    label: 'Cache',
    icon: HardDrive,
    value: '124.5 MB',
    note: 'Application cache and temporary data',
  },
  {
    key: 'logs',
    label: 'Log Files',
    icon: FileText,
    value: '47 files',
    note: 'System and application log files',
  },
  {
    key: 'temp',
    label: 'Temp Files',
    icon: Clock,
    value: '89.2 MB',
    note: 'Temporary system files and downloads',
  },
]

function SystemManagement() {
  const [sizes, setSizes] = useState<Record<CleanTarget['key'], string>>({
    cache: '124.5 MB',
    logs: '47 files',
    temp: '89.2 MB',
  })
  const [confirm, setConfirm] = useState<CleanTarget | null>(null)

  const doClear = () => {
    if (!confirm) return
    setSizes((s) => ({
      ...s,
      [confirm.key]: confirm.key === 'logs' ? '0 files' : '0 MB',
    }))
    setConfirm(null)
  }

  return (
    <section className={CARD} data-aos="fade-up">
      <div className="flex items-start gap-2.5 mb-[18px]">
        <span className={CHIP}>
          <Server size={16} />
        </span>
        <div>
          <div className={CARD_TITLE}>System Management</div>
          <div className={CARD_SUB}>
            Manage system cache, logs, and temporary files. (No API yet — actions
            are local.)
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CLEAN_TARGETS.map((t) => (
          <div
            className="rounded-row border border-hair bg-surface2 p-4"
            key={t.key}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <t.icon size={16} className="text-accent" />
                <span className="text-[13px] font-semibold">{t.label}</span>
              </div>
              <span className="font-mono text-[13px] font-bold">
                {sizes[t.key]}
              </span>
            </div>
            <p className="mb-3.5 text-[12px] text-muted">{t.note}</p>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-btn border border-border bg-surface py-2 text-[12.5px] font-semibold text-text transition-[border-color,color] duration-150 hover:border-red hover:text-red"
              onClick={() => setConfirm(t)}
            >
              <Trash2 size={14} />
              Clear {t.label}
            </button>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={confirm !== null}
        title={`Clear ${confirm?.label.toLowerCase()}?`}
        message="This will free the listed space. This action cannot be undone."
        confirmLabel="Yes, clear"
        cancelLabel="No"
        danger
        onConfirm={doClear}
        onCancel={() => setConfirm(null)}
      />
    </section>
  )
}

/* ================================= Page ================================== */

export default function AdminResources() {
  return (
    <AdminLayout
      title="System Resources"
      subtitle="Monitor system resources, server status, and system logs"
    >
      <div className="flex flex-col gap-stack">
        <ResourcesMonitor />
        <SystemLogs />
        <SystemManagement />
      </div>
    </AdminLayout>
  )
}
