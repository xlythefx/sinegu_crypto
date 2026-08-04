import {
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Radio,
  ShieldX,
  SkipForward,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import MetricTile from '../../analytics/MetricTile'
import {
  CARD,
  CARD_SUB,
  CARD_TITLE,
  HEAD,
  HEAD_L,
  ICON_CHIP,
  NOTE_EMPTY,
  NOTE_WARN,
} from './classes'
import type { EngineHealth } from '../../../types/admin'

const POLLER_CHIP =
  'inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface2 py-[5px] px-2.5 font-mono text-[11.5px] font-semibold text-muted'

/** "12s" under a minute, "1m 12s" above — dash when the engine didn't say. */
function fmtCacheAge(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const s = Math.max(0, Math.round(seconds))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

/** rate_limited_until may arrive as an epoch number or a preformatted string. */
function fmtRateLimit(value: string | number): string {
  if (typeof value === 'number') {
    const d = new Date(value > 1e12 ? value : value * 1000)
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
  }
  return value
}

interface EngineHealthCardProps {
  health: EngineHealth | null
  available: boolean
}

/** Live /health counters: metric tiles, poller chips, cache ages, rate limit. */
export default function EngineHealthCard({
  health,
  available,
}: EngineHealthCardProps) {
  const m = health?.metrics ?? {}
  const n = (v: number | undefined) => v ?? 0
  const pollers = health?.pollers ?? []

  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay="100">
      <div className={HEAD}>
        <div className={HEAD_L}>
          <span className={ICON_CHIP}>
            <HeartPulse size={16} />
          </span>
          <div>
            <div className={CARD_TITLE}>Engine health</div>
            <div className={CARD_SUB}>
              Live counters reported by the engine's /health endpoint
            </div>
          </div>
        </div>
      </div>

      {health === null ? (
        <div className={NOTE_EMPTY}>
          {available
            ? 'Engine unreachable — no health data. It may be starting up or down.'
            : 'Engine health is reported on the prod server only.'}
        </div>
      ) : (
        <>
          {health.rate_limited_until != null && (
            <div className={`${NOTE_WARN} mb-3.5`}>
              <AlertTriangle size={15} className="flex-none mt-px" />
              <span>
                Rate limited by the exchange until{' '}
                {fmtRateLimit(health.rate_limited_until)}. Trading resumes
                automatically.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 mb-4">
            <MetricTile
              label="Signals received"
              value={n(m.received).toLocaleString()}
              icon={Radio}
            />
            <MetricTile
              label="Rejected"
              value={n(m.rejected).toLocaleString()}
              icon={ShieldX}
              sub="filtered out signals"
            />
            <MetricTile
              label="Jobs done"
              value={n(m.jobs_done).toLocaleString()}
              icon={CheckCircle2}
              sub={`of ${n(m.jobs_dispatched).toLocaleString()} dispatched`}
            />
            <MetricTile
              label="Accounts traded"
              value={n(m.accounts_traded).toLocaleString()}
              icon={TrendingUp}
              tone={n(m.accounts_traded) > 0 ? 'pos' : ''}
            />
            <MetricTile
              label="Accounts failed"
              value={n(m.accounts_failed).toLocaleString()}
              icon={XCircle}
              tone={n(m.accounts_failed) > 0 ? 'neg' : ''}
              iconTone={n(m.accounts_failed) > 0 ? 'neg' : 'accent'}
            />
            <MetricTile
              label="Accounts skipped"
              value={n(m.accounts_skipped).toLocaleString()}
              icon={SkipForward}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-faint">
                Pollers
              </span>
              {pollers.length > 0 ? (
                pollers.map((p) => (
                  <span key={p} className={POLLER_CHIP}>
                    <i className="w-1.5 h-1.5 flex-none rounded-full bg-green" />
                    {p}
                  </span>
                ))
              ) : (
                <span className="text-[12px] text-muted">none reported</span>
              )}
            </div>
            <div className="font-mono text-[12px] text-muted">
              Cache age: accounts {fmtCacheAge(health.accounts_cache_age)} ·
              assets {fmtCacheAge(health.assets_cache_age)}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
