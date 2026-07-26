import { useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Activity, Layers } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import StrategyCard from '../../components/admin/StrategyCard'
import { useApiData } from '../../hooks/useApiData'
import { getStrategies, setStrategyEnabled } from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import {
  computeStrategyStats,
  groupTradesByStrategy,
} from '../../lib/strategyStats'
import './AdminStrategies.css'

export default function AdminStrategies() {
  const { data, loading, error, reload } = useApiData(getStrategies)

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
      <div className="astrat-header" data-aos="fade-up">
        <div className="astrat-header__left">
          <span className="astrat-header__icon">
            <Layers size={18} />
          </span>
          <div>
            <div className="astrat-header__title">Strategy Overview</div>
            <div className="astrat-header__desc">
              Performance breakdown per trading strategy
            </div>
          </div>
        </div>
        {strategies.length > 0 && (
          <span className="astrat-count">
            <Activity size={13} />
            <b>{strategies.length}</b>
            {strategies.length === 1 ? 'strategy' : 'strategies'}
          </span>
        )}
      </div>

      {actionError && (
        <p className="astrat-error" role="alert">
          {actionError}
        </p>
      )}

      {strategies.length === 0 ? (
        <div className="astrat-empty" data-aos="fade-up" data-aos-delay="100">
          No trades with strategy information found yet.
        </div>
      ) : (
        <>
          {/* strategy filter */}
          <div className="astrat-filter" data-aos="fade-up" data-aos-delay="100">
            <p className="astrat-filter__label">FILTER BY STRATEGY</p>
            <div className="astrat-filter__grid">
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

          {/* strategy cards */}
          <div className="astrat-cards">
            {visible.map((s) => (
              <StrategyCard
                key={s.key}
                stats={s}
                enabled={isEnabled(s.key)}
                saving={savingKey === s.key}
                excluded={new Set(excluded[s.key] ?? [])}
                onToggle={() =>
                  setConfirmTarget({ key: s.key, next: !isEnabled(s.key) })
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
        open={confirmTarget !== null}
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
      className={`astrat-filter-btn${active ? ' astrat-filter-btn--active' : ''}`}
    >
      {children}
    </button>
  )
}
