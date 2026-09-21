import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CheckCircle2, CircleDashed, ListTodo, RefreshCw, Scale } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import TodoItemCard from '../../components/admin/todo/TodoItemCard'
import { useApiData } from '../../hooks/useApiData'
import { ADMIN_TODOS, adminTodoFeatures } from '../../lib/adminTodos'
import { getAdminTodoStates, updateAdminTodo } from '../../services/adminTodos'
import { ApiError, getApiErrorMessage } from '../../services/api'
import type { AdminTodo, AdminTodoStates } from '../../types/adminTodos'

const TITLE = 'To be Done'
const SUBTITLE =
  'Everything only you can do or decide — registrations, keys to paste, choices to make. Each feature adds its own items here.'

type Kind = 'all' | 'action' | 'decision'
const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'action', label: 'Actions' },
  { key: 'decision', label: 'Decisions' },
]

const STAT_ICON =
  'w-10 h-10 flex-shrink-0 grid place-items-center rounded-[11px] bg-surface2 border border-border'
const CHIP_BASE =
  'border rounded-pill py-[7px] px-3.5 text-[12px] font-semibold cursor-pointer transition-[border-color,color] duration-150'
const CHIP_OFF = 'border-border bg-surface2 text-muted hover:text-text hover:border-accent'
const CHIP_ON = 'bg-accent border-accent text-on-accent'

/**
 * Admin → To be Done. The items are code (`lib/adminTodos.ts`); what the
 * owner did about each — ticked, by whom, the note — comes from the API so a
 * phone and a laptop agree. Open items first, done ones folded underneath.
 */
export default function AdminTodo() {
  const [feature, setFeature] = useState('all')
  const [kind, setKind] = useState<Kind>('all')
  const [showDone, setShowDone] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Local copy of the states so a tick is reflected without a refetch.
  const [overrides, setOverrides] = useState<AdminTodoStates>({})

  const { data, loading, error, reload } = useApiData(getAdminTodoStates)

  const states = useMemo<AdminTodoStates>(() => ({ ...(data ?? {}), ...overrides }), [data, overrides])
  const features = useMemo(() => adminTodoFeatures(), [])

  const filtered = useMemo(
    () =>
      ADMIN_TODOS.filter(
        (item) => (feature === 'all' || item.feature === feature) && (kind === 'all' || item.kind === kind),
      ),
    [feature, kind],
  )
  const isDone = (item: AdminTodo) => Boolean(states[item.id]?.done_at)
  const openItems = filtered.filter((i) => !isDone(i))
  const doneItems = filtered.filter(isDone)

  const totals = {
    open: ADMIN_TODOS.filter((i) => !isDone(i)).length,
    decisions: ADMIN_TODOS.filter((i) => i.kind === 'decision' && !isDone(i)).length,
    done: ADMIN_TODOS.filter(isDone).length,
  }

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <AdminLayout title={TITLE} subtitle={SUBTITLE}>
        <DataState loading={loading} error={error} onRetry={reload} label="to-do list" />
      </AdminLayout>
    )
  }

  const apply = async (slug: string, patch: { done?: boolean; note?: string | null }) => {
    setBusy(slug)
    setActionError(null)
    try {
      const state = await updateAdminTodo(slug, patch)
      setOverrides((o) => ({ ...o, [slug]: state }))
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not save that change.'))
      throw err
    } finally {
      setBusy(null)
    }
  }

  const renderItem = (item: AdminTodo) => (
    <TodoItemCard
      key={item.id}
      item={item}
      state={states[item.id]}
      busy={busy === item.id}
      onToggleDone={(done) => void apply(item.id, { done }).catch(() => undefined)}
      onSaveNote={(note) => apply(item.id, { note: note.trim() === '' ? null : note })}
    />
  )

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      <div
        className="grid grid-cols-3 gap-[14px] mb-[18px] max-[900px]:grid-cols-3 max-[640px]:grid-cols-1"
        data-aos="fade-up"
      >
        <StatCard icon={<CircleDashed size={18} />} tone="text-accent" label="Waiting on you" value={totals.open} />
        <StatCard icon={<Scale size={18} />} tone="text-accent" label="Decisions pending" value={totals.decisions} />
        <StatCard icon={<CheckCircle2 size={18} />} tone="text-green" label="Done" value={totals.done} />
      </div>

      <section
        className="rounded-card border border-border bg-surface p-[18px] max-[520px]:p-3.5"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        <div className="flex items-center justify-between flex-wrap gap-2.5 mb-3">
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              className={`${CHIP_BASE} ${feature === 'all' ? CHIP_ON : CHIP_OFF}`}
              onClick={() => setFeature('all')}
            >
              All features
            </button>
            {features.map((f) => (
              <button
                key={f}
                type="button"
                className={`${CHIP_BASE} ${feature === f ? CHIP_ON : CHIP_OFF}`}
                onClick={() => setFeature(f)}
              >
                {f}
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
        <div className="flex gap-1.5 flex-wrap mb-4">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={`${CHIP_BASE} ${kind === k.key ? CHIP_ON : CHIP_OFF}`}
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>

        {actionError && (
          <p
            className="mb-3 rounded-[10px] border border-[rgba(255,90,90,0.35)] bg-[rgba(255,90,90,0.08)] px-3.5 py-2.5 text-[12.5px] font-semibold text-red"
            role="alert"
          >
            {actionError}
          </p>
        )}

        <div key={`${feature}-${kind}`} className="flex flex-col gap-2.5 animate-[fadeup_0.35s_ease-out]">
          {openItems.length === 0 ? (
            <p className="flex items-center justify-center gap-2 text-center text-muted py-[34px] text-[13px]">
              <ListTodo size={16} />
              {filtered.length === 0 ? 'Nothing matches these filters.' : 'Nothing waiting on you here. 🎉'}
            </p>
          ) : (
            openItems.map(renderItem)
          )}
        </div>

        {doneItems.length > 0 && (
          <div className="mt-5 border-t border-hair pt-4">
            <button
              type="button"
              className="mb-3 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-faint hover:text-text"
              onClick={() => setShowDone((s) => !s)}
              aria-expanded={showDone}
            >
              <CheckCircle2 size={14} className="text-green" />
              {doneItems.length} done {showDone ? '— hide' : '— show'}
            </button>
            {showDone && (
              <div className="flex flex-col gap-2.5 animate-[fadeup_0.35s_ease-out]">{doneItems.map(renderItem)}</div>
            )}
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
        <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]">{label}</p>
        <p className="text-[19px] font-bold text-text leading-[1.1] font-mono">{value}</p>
      </div>
    </div>
  )
}
