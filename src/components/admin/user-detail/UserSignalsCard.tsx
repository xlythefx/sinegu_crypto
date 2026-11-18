import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Radio } from 'lucide-react'
import { useApiData } from '../../../hooks/useApiData'
import { getAdminUserSignals } from '../../../services/admin'
import { fmtDateTime } from '../../../lib/format'
import { EXCHANGE_META } from '../../exchanges/meta'
import type { CustomerSignal } from '../../../types/admin'
import type { ExchangeKind } from '../../../types/exchanges'

const ACTION: Record<string, string> = {
  BUY: 'Long entry',
  SELL: 'Short entry',
  EXIT_LONG: 'Long exit',
  EXIT_SHORT: 'Short exit',
}

const PILL = 'inline-block rounded-pill py-[2px] px-[8px] text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap'

function outcome(s: CustomerSignal): { label: string; cls: string } {
  if (s.status === 'filled') return { label: 'Filled', cls: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green' }
  // A "normal" skip is the rules working (stack full, deposit below the
  // minimum); a "problem" needs someone (key refused, order rejected).
  const problem = s.status === 'failed' || s.reason?.severity === 'problem'
  return {
    label: s.status === 'failed' ? 'Failed' : 'Skipped',
    cls: problem
      ? 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red'
      : 'bg-surface2 text-muted',
  }
}

/**
 * Is the bot trading for this customer? The last signals that reached their
 * accounts — filled, or skipped / failed and WHY, in the Signal Log's own
 * plain words — and a 7-day tally (the admin audit, 2026-11-11). Full admins.
 */
export default function UserSignalsCard({ uniId, name }: { uniId: string; name: string }) {
  const fetchSignals = useCallback(() => getAdminUserSignals(uniId, 8), [uniId])
  const { data, loading, error } = useApiData(fetchSignals, [fetchSignals])
  const tally = data?.last_7_days

  return (
    <section className="rounded-card border border-border bg-surface p-card">
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <Radio size={15} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">Last signals</div>
            <div className="mt-px text-[12px] text-muted">What the bot did on this customer’s accounts, and why it skipped</div>
          </div>
        </div>
        <Link
          to={`/admin/trade-logs?account=${encodeURIComponent(name)}`}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline"
        >
          Open in Signal Log <ArrowUpRight size={13} />
        </Link>
      </div>

      {tally && (
        <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
          <span className="text-muted">Last 7 days:</span>
          <span className="font-semibold text-green">{tally.filled} filled</span>
          <span className="text-muted">·</span>
          <span className="font-semibold text-text">{tally.skipped} skipped</span>
          <span className="text-muted">·</span>
          <span className={`font-semibold ${tally.failed > 0 ? 'text-red' : 'text-text'}`}>{tally.failed} failed</span>
        </div>
      )}

      {!data ? (
        <p className="py-6 text-center text-[13px] text-muted">
          {loading ? 'Loading signals…' : error ? 'Could not load the signals.' : ''}
        </p>
      ) : data.signals.length === 0 ? (
        <p className="rounded-row border border-dashed border-border bg-surface2 px-4 py-6 text-center text-[13px] text-muted">
          No signal has reached this customer’s accounts recently.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-hair">
          {data.signals.map((s, i) => {
            const o = outcome(s)
            const venue = EXCHANGE_META[s.exchange as ExchangeKind]?.label ?? s.exchange
            return (
              <li key={`${s.log_id}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[12.5px]">
                <span className="w-[118px] flex-none font-mono text-[11.5px] text-faint">
                  {s.at ? fmtDateTime(s.at) : '—'}
                </span>
                <span className="min-w-0 flex-1 basis-[160px]">
                  <span className="font-semibold text-text">{ACTION[s.action] ?? s.action}</span>{' '}
                  <span className="text-muted">
                    {s.ticker} · {venue}
                    {s.feed === 'test' ? ' · test feed' : s.feed === 'submaster' ? ' · sub-master feed' : ''}
                  </span>
                  {s.reason && <span className="block text-[11.5px] text-muted">{s.reason.label}</span>}
                </span>
                <span className={`${PILL} ${o.cls}`}>{o.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
