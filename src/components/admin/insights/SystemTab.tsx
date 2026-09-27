import { AlertTriangle, CheckCircle2, Clock, Server, Wallet } from 'lucide-react'
import DataState from '../../dashboard/DataState'
import EngineHealthCard from '../engine/EngineHealthCard'
import { EXCHANGE_META } from '../../exchanges/meta'
import { EmptyNote, GRID_3, InsightCard } from './parts'
import { useApiData } from '../../../hooks/useApiData'
import { useInterval } from '../../../hooks/useInterval'
import { getEngineStatus } from '../../../services/admin'
import { getSystemInsights } from '../../../services/adminInsights'
import { fmtAgo } from '../../../lib/format'

const REFRESH_MS = 30_000

function Freshness({ label, at, hint }: { label: string; at: string | null; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-[13px]" title={hint}>
      <span className="text-muted">{label}</span>
      <span className={`font-mono font-semibold ${at ? '' : 'text-faint'}`}>{fmtAgo(at)}</span>
    </div>
  )
}

/**
 * Is everything running? The engine's own counters, when each exchange last
 * produced something, the payment watcher's last scan, and what the exchanges
 * refused today. Restarting and logs stay on the Bot Engine page.
 */
export default function SystemTab() {
  const { data, loading, error, reload } = useApiData(getSystemInsights)
  const { data: engine, reload: reloadEngine } = useApiData(getEngineStatus)

  useInterval(() => {
    reload()
    reloadEngine()
  }, data ? REFRESH_MS : null)

  if (!data) {
    return <DataState loading={loading} error={error} onRetry={reload} label="system status" />
  }

  return (
    <div className="flex flex-col gap-stack">
      <InsightCard
        icon={Wallet}
        title="Payment watcher"
        subtitle="Checks the chain every minute for USDT payments. If it stops, invoices stop settling."
        link={{ to: '/admin/tron-transfers', label: 'Crypto Transfers' }}
      >
        {data.payment_watcher.length === 0 ? (
          <EmptyNote>No payment network is configured.</EmptyNote>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {data.payment_watcher.map((n) => {
              const bad = n.configured && n.scan_stale
              return (
                <div
                  key={n.name}
                  className={`flex min-w-[220px] flex-1 items-center gap-3 rounded-row border px-4 py-3 ${
                    bad ? 'border-red/50 bg-red/10' : 'border-border bg-surface2'
                  }`}
                >
                  {!n.configured ? (
                    <Clock size={17} className="flex-none text-faint" />
                  ) : bad ? (
                    <AlertTriangle size={17} className="flex-none text-red" />
                  ) : (
                    <CheckCircle2 size={17} className="flex-none text-green" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{n.label || n.name}</div>
                    <div className="text-[12px] text-muted">
                      {n.configured ? `Last scan ${fmtAgo(n.last_scan_at)}` : 'Not configured'}
                      {bad && ' — stalled'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </InsightCard>

      <div className={GRID_3}>
        {data.venues.map((v) => (
          <InsightCard
            key={v.exchange}
            icon={Server}
            title={EXCHANGE_META[v.exchange]?.label ?? v.exchange}
            subtitle={`${v.signals_today} signal${v.signals_today === 1 ? '' : 's'} today · ${v.failed_today} refused order${v.failed_today === 1 ? '' : 's'}`}
          >
            <div className="divide-y divide-hair">
              <Freshness label="Last signal" at={v.last_signal_at} hint="The last TradingView alert the engine processed for this exchange" />
              <Freshness label="Last closed trade synced" at={v.last_close_synced_at} hint="The last closed trade stored from this exchange" />
              <Freshness label="Last key check" at={v.last_key_check_at} hint="The last time the engine got an answer about any account's key" />
            </div>
            {v.keys_blocked_today > 0 && (
              <p className="mt-3 rounded-row bg-red/10 px-3 py-2 text-[12.5px] font-semibold text-red">
                {v.keys_blocked_today} key{v.keys_blocked_today === 1 ? '' : 's'} refused for the first time today
              </p>
            )}
            {v.errors_today.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.5px] text-faint">
                  Refusals today
                </div>
                <ul className="flex flex-col gap-1.5">
                  {v.errors_today.map((e) => (
                    <li key={e.message} className="flex items-start justify-between gap-3 text-[12px]">
                      <span className="min-w-0 break-words text-muted">{e.message}</span>
                      <span className="flex-none font-mono font-bold">×{e.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </InsightCard>
        ))}
      </div>

      {engine && <EngineHealthCard health={engine.health} available={engine.available} />}
    </div>
  )
}
