import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  Link2,
  Plus,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import ConfirmModal from '../components/ui/ConfirmModal'
import ExchangeAccountCard from '../components/exchanges/ExchangeAccountCard'
import RenameAccountModal from '../components/exchanges/RenameAccountModal'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../components/exchanges/meta'
import { useApiData } from '../hooks/useApiData'
import {
  deleteExchangeAccount,
  getExchangeAccountsWithMeta,
} from '../services/exchanges'
import { ApiError, getApiErrorMessage } from '../services/api'
import { updateStoredUser } from '../lib/session'
import type { ExchangeAccount, ExchangeKind } from '../types/exchanges'

type Filter = 'all' | ExchangeKind

const FILTER_ORDER: Filter[] = ['all', ...EXCHANGE_ORDER]

/** Rounded pill CTA — "Connect exchange". Links to the wizard page. */
const CONNECT_BTN =
  'inline-flex h-[38px] items-center gap-[7px] rounded-pill bg-accent px-4 text-[13px] font-bold text-on-accent shadow-[0_10px_24px_var(--glow)] transition-[filter] hover:brightness-[1.06]'

const EMPTY_FEATURES = [
  { icon: Link2, label: 'API connection' },
  { icon: Zap, label: 'Real-time data' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: ShieldCheck, label: 'Secure & encrypted' },
]

export default function Exchanges() {
  const { data, loading, error, reload } = useApiData(getExchangeAccountsWithMeta)

  const [filter, setFilter] = useState<Filter>('all')
  const [renameTarget, setRenameTarget] = useState<ExchangeAccount | null>(null)
  const [disconnectTarget, setDisconnectTarget] =
    useState<ExchangeAccount | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  /**
   * Rows updated in place by a manual balance refresh. Patched rather than
   * reloaded because `useApiData.reload()` flips `loading` back on, which would
   * swap the whole grid for skeletons just to change one number.
   */
  const [refreshed, setRefreshed] = useState<Record<number, ExchangeAccount>>({})

  // Every stored account is Binance for now — Bybit/MEXC land later.
  const accounts = useMemo(
    () => (data?.accounts ?? []).map((a) => refreshed[a.id] ?? a),
    [data, refreshed],
  )

  /** The address a user must allow-list when their key blocks us. */
  const serverIp = data?.serverIp ?? null

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      all: accounts.length,
      binance: accounts.length,
      bybit: 0,
      mexc: 0,
    }),
    [accounts],
  )

  const filtered = filter === 'all' || filter === 'binance' ? accounts : []

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const handleDisconnect = async () => {
    if (!disconnectTarget) return
    setDisconnecting(true)
    setActionError(null)
    try {
      await deleteExchangeAccount(disconnectTarget.id)
      // One account per user, so a disconnect means none remain — sync the
      // session flag so the onboarding nudges come back instantly.
      updateStoredUser({ has_exchange_account: false })
      setDisconnectTarget(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Unable to disconnect account.'))
      setDisconnectTarget(null)
    } finally {
      setDisconnecting(false)
    }
  }

  if (!data) {
    return (
      <DashboardLayout title="Exchange Accounts">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="exchange accounts"
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Exchange Accounts">
      <div
        className="mb-[18px] flex flex-wrap items-end justify-between gap-3"
        data-aos="fade-up"
      >
        <div>
          <p className="font-mono text-[11px] tracking-[0.12em] text-accent">
            CONNECTED EXCHANGES
          </p>
          <h1 className="mt-1 font-display text-[24px] font-extrabold tracking-[-0.02em]">
            Exchange Accounts
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Connect and manage your exchange accounts. Sensitive fields are
            hidden by default.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2.5 max-[700px]:w-full max-[700px]:items-start">
          <Link className={CONNECT_BTN} to="/dashboard/exchanges/connect">
            <Plus size={15} />
            Connect exchange
          </Link>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_ORDER.map((key) => {
              const label = key === 'all' ? 'All' : EXCHANGE_META[key].label
              const active = filter === key
              return (
                <button
                  key={key}
                  type="button"
                  className={`flex items-center gap-[7px] rounded-pill border px-3 py-1.5 text-[12px] transition-[border-color,background,color] duration-150 ${
                    active
                      ? 'border-accent-line bg-accent-soft font-bold text-accent'
                      : 'border-border bg-surface font-semibold text-muted hover:border-accent-line hover:text-text'
                  }`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                  <span
                    className={`inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-pill px-[5px] font-mono text-[10px] font-bold ${
                      active
                        ? 'bg-accent text-on-accent'
                        : 'bg-surface2 text-muted'
                    }`}
                  >
                    {counts[key]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {actionError && (
        <p
          className="mb-3.5 rounded-field border border-[rgba(255,90,90,0.3)] bg-[rgba(255,90,90,0.08)] px-3 py-[9px] text-[12.5px] text-red"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {/* Keyed CSS fadeup, not AOS: this region is swapped in place after a
          connect/disconnect reload, and AOS (once: true) never reveals nodes
          mounted after init — they'd stay stuck at opacity 0. */}
      <div
        key={`${filter}-${
          filtered.map((a) => `${a.id}:${a.name}`).join('.') || 'empty'
        }`}
        className="animate-[fadeup_0.35s_ease-out]"
      >
      {filtered.length === 0 ? (
        <div className="rounded-card border-2 border-dashed border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))] px-6 py-12 text-center">
          <div className="mx-auto mb-[18px] flex h-[76px] w-[76px] animate-[float_3s_ease-in-out_infinite] items-center justify-center rounded-[20px] border border-accent-line bg-accent-soft text-accent">
            <Building2 size={36} />
          </div>
          <h3 className="font-display text-[19px] font-extrabold">
            No accounts to show
          </h3>
          <p className="mx-auto mb-5 mt-2 max-w-[420px] text-[13px] leading-[1.6] text-muted">
            Connect an exchange to start tracking trades, viewing real-time
            PNL, and unlocking analytics.
          </p>
          <Link
            className={`${CONNECT_BTN} mx-auto`}
            to="/dashboard/exchanges/connect"
          >
            <Plus size={15} />
            Connect an exchange
          </Link>
          <div className="mt-7 flex flex-wrap justify-center gap-x-[22px] gap-y-3">
            {EMPTY_FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-[12px] text-muted"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
                  <Icon size={14} />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 max-[1000px]:grid-cols-1">
          {filtered.map((account) => (
            <ExchangeAccountCard
              key={account.id}
              account={account}
              exchange="binance"
              onRename={(a) => {
                setActionError(null)
                setRenameTarget(a)
              }}
              onDisconnect={(a) => setDisconnectTarget(a)}
              onBalanceRefreshed={(fresh) =>
                setRefreshed((prev) => ({ ...prev, [fresh.id]: fresh }))
              }
              serverIp={serverIp}
            />
          ))}
        </div>
      )}
      </div>

      <RenameAccountModal
        account={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRenamed={() => reload()}
      />

      <ConfirmModal
        open={disconnectTarget !== null}
        title={`Disconnect ${disconnectTarget?.name ?? 'account'}?`}
        message="Bots will stop trading on this account. You can reconnect it at any time with new API keys."
        confirmLabel={disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
        cancelLabel="No"
        danger
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectTarget(null)}
      />
    </DashboardLayout>
  )
}
