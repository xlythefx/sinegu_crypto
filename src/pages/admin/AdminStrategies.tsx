import { useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Activity, Layers } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import StrategyCard from '../../components/admin/StrategyCard'
import { useApiData } from '../../hooks/useApiData'
import { useSessionUser } from '../../hooks/useSessionUser'
import { isCollaborator } from '../../lib/roles'
import { getStrategies, setStrategyEnabled } from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import {
  computeStrategyStats,
  groupTradesByStrategy,
} from '../../lib/strategyStats'

export default function AdminStrategies() {
  const { data, loading, error, reload } = useApiData(getStrategies)
  // Read-only collaborator: the Active/Paused state shows, the switch does not.
  const readOnly = isCollaborator(useSessionUser()?.type)

  const [selected, setSelected] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<Record<string, string[]>>({})
  const [enabledOverride, setEnabledOverride] = useState<
    Record<string, boolean>
  >({})
  const [confirmTarget, setConfirmTarget] = useState<{
    key: string
    next: boolean
  } | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const grouped = useMemo(
    () => groupTradesByStrategy(data?.trades ?? []),
    [data],
  )

  // Per-strategy stats, ranked by total P&L (recomputed on ticker exclusion).
  const strategies = useMemo(() => {
    const list = Array.from(grouped.entries()).map(([key, trades]) =>
      computeStrategyStats(key, trades, new Set(excluded[key] ?? [])),
    )
    list.sort((a, b) => b.totalPnl - a.totalPnl)
    return list
  }, [grouped, excluded])

  const visible = selected
    ? strategies.filter((s) => s.key === selected)
    : strategies

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const isEnabled = (key: string) =>
    enabledOverride[key] ?? data?.enabled[key] ?? true

  const toggleTicker = (key: string, ticker: string) => {
    setExcluded((prev) => {
      const current = prev[key] ?? []
      const next = current.includes(ticker)
        ? current.filter((t) => t !== ticker)
        : [...current, ticker]
      return { ...prev, [key]: next }
    })
  }

  const runToggle = async () => {
    if (!confirmTarget) return
    const { key, next } = confirmTarget
    setConfirmTarget(null)
    setSavingKey(key)
    setActionError(null)
    try {
      await setStrategyEnabled(key, next)
      setEnabledOverride((prev) => ({ ...prev, [key]: next }))
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Failed to save strategy state.'))
    } finally {
      setSavingKey(null)
    }
  }

  if (!data) {
    return (
      <AdminLayout title="Strategies" subtitle="Performance per trading strategy.">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="strategies"
        />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Strategies" subtitle="Performance per trading strategy.">
      {/* header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3.5 mb-4 p-card border border-accent-line rounded-card bg-[linear-gradient(to_bottom_right,var(--accentSoft),var(--surface))]"
        data-aos="fade-up"
      >
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-[42px] h-[42px] border border-accent-line rounded-row bg-accent-soft text-accent">
            <Layers size={18} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Strategy Overview
            </div>
            <div className="mt-px text-[12px] text-muted">
              Performance breakdown per trading strategy
            </div>
          </div>
        </div>
        {strategies.length > 0 && (
          <span className="flex items-center gap-[7px] py-[7px] px-3.5 border border-border rounded-pill bg-surface2 text-[12.5px] text-muted">
            <Activity size={13} />
            <b className="text-text">{strategies.length}</b>
            {strategies.length === 1 ? 'strategy' : 'strategies'}
          </span>
        )}
      </div>

      {actionError && (
        <p
          className="mb-3.5 py-[9px] px-3 border border-[color-mix(in_srgb,var(--red)_30%,transparent)] rounded-field bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-[12.5px] text-red"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {strategies.length === 0 ? (
        <div
          className="py-11 px-5 border border-dashed border-border rounded-card bg-surface2 text-center text-[13px] text-muted"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          No trades with strategy information found yet.
        </div>
      ) : (
        <>
          {/* strategy filter */}
          <div
            className="mb-[18px] p-card border border-border rounded-card bg-surface"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            <p className="mb-[11px] font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
              FILTER BY STRATEGY
            </p>
            <div className="grid grid-cols-3 gap-[9px] max-[640px]:grid-cols-2">
              <StrategyFilterBtn
                active={selected === null}
                onClick={() => setSelected(null)}
              >
                All strategies
              </StrategyFilterBtn>
              {strategies.map((s) => (
                <StrategyFilterBtn
                  key={s.key}
                  title={s.key}
                  active={selected === s.key}
                  onClick={() =>
                    setSelected((prev) => (prev === s.key ? null : s.key))
                  }
                >
                  {s.key}
                </StrategyFilterBtn>
              ))}
            </div>
          </div>

          {/* strategy cards — re-mounts on filter change to replay the reveal */}
          <div
            key={selected ?? 'all'}
            className="grid grid-cols-3 gap-[18px] items-start max-[1200px]:grid-cols-2 max-[760px]:grid-cols-1 animate-[fadeup_0.35s_ease-out]"
          >
            {visible.map((s) => (
              <StrategyCard
                key={s.key}
                stats={s}
                enabled={isEnabled(s.key)}
                saving={savingKey === s.key}
                excluded={new Set(excluded[s.key] ?? [])}
                onToggle={
                  readOnly
                    ? undefined
                    : () => setConfirmTarget({ key: s.key, next: !isEnabled(s.key) })
                }
                onToggleTicker={(t) => toggleTicker(s.key, t)}
                onClearExcluded={() =>
                  setExcluded((prev) => ({ ...prev, [s.key]: [] }))
                }
              />
            ))}
          </div>
        </>
      )}

      <ConfirmModal
        open={!readOnly && confirmTarget !== null}
        title={
          confirmTarget?.next
            ? `Activate ${confirmTarget?.key}?`
            : `Pause ${confirmTarget?.key}?`
        }
        message={
          confirmTarget?.next
            ? 'The strategy will resume opening positions globally, for every user.'
            : 'The strategy will stop opening new positions globally, for every user. Open positions are not affected.'
        }
        confirmLabel={confirmTarget?.next ? 'Yes, activate' : 'Yes, pause'}
        cancelLabel="No"
        danger={confirmTarget?.next === false}
        onConfirm={runToggle}
        onCancel={() => setConfirmTarget(null)}
      />
    </AdminLayout>
  )
}

interface StrategyFilterBtnProps {
  active: boolean
  title?: string
  onClick: () => void
  children: ReactNode
}

/** One button in the strategy filter grid. */
function StrategyFilterBtn({
  active,
  title,
  onClick,
  children,
}: StrategyFilterBtnProps) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[58px] min-w-0 [overflow-wrap:break-word] py-2.5 px-3 border rounded-strip text-[12.5px] leading-[1.35] cursor-pointer transition-[background,border-color,color] duration-150 ${
        active
          ? 'bg-accent border-accent text-on-accent font-bold hover:bg-accent hover:border-accent'
          : 'border-border bg-surface2 text-text font-semibold hover:border-accent-line hover:bg-accent-soft'
      }`}
    >
      {children}
    </button>
  )
}
