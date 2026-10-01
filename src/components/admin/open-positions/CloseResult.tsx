import { AlertTriangle, CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react'
import { fmtQty } from '../../../lib/format'
import type { CloseDetail, ClosePositionsResponse } from '../../../types/openPositions'

export interface CloseOutcome {
  ok: boolean
  message: string
  response: ClosePositionsResponse | null
}

const STATUS: Record<string, { Icon: typeof CheckCircle2; cls: string; text: (d: CloseDetail) => string }> = {
  filled: { Icon: CheckCircle2, cls: 'text-green', text: (d) => `Closed ${d.closed_quantity != null ? fmtQty(d.closed_quantity) : ''}`.trim() },
  skipped: { Icon: MinusCircle, cls: 'text-muted', text: (d) => (d.reason ? `Nothing to close (${d.reason})` : 'Nothing to close') },
  failed: { Icon: XCircle, cls: 'text-red', text: (d) => d.error ?? 'Failed' },
}

/**
 * The close, in words: one line per account the engine touched. The raw JSON
 * sits below on the page; this is the part a person reads first.
 */
export default function CloseResult({ outcome }: { outcome: CloseOutcome }) {
  const jobs = outcome.response?.engine_response?.jobs ?? []

  return (
    <div
      className={`rounded-row border px-4 py-3.5 ${
        outcome.ok ? 'border-green/40 bg-green/10' : 'border-red/40 bg-red/10'
      }`}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        {outcome.ok ? (
          <CheckCircle2 size={17} className="mt-px flex-none text-green" />
        ) : (
          <AlertTriangle size={17} className="mt-px flex-none text-red" />
        )}
        <div className="min-w-0 flex-1 text-[13px] font-semibold text-text">{outcome.message}</div>
      </div>

      {jobs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          {jobs.map((job) => (
            <li key={`${job.exchange}-${job.symbol}-${job.side}`} className="text-[12.5px]">
              <div className="font-mono font-bold text-text">
                {job.symbol} {job.side} <span className="font-sans font-normal text-muted">· {job.exchange}</span>
              </div>
              {job.status === 'running' && (
                <div className="mt-1 flex items-center gap-1.5 text-muted">
                  <Clock size={13} /> Still running on the engine — check the Signal Log in a minute.
                </div>
              )}
              {job.status === 'crashed' && (
                <div className="mt-1 flex items-center gap-1.5 text-red">
                  <XCircle size={13} /> {job.error ?? 'The close job crashed.'}
                </div>
              )}
              {(job.details ?? []).map((d, i) => {
                const s = STATUS[d.status] ?? STATUS.failed
                return (
                  <div key={`${d.uni_id ?? i}`} className="mt-1 flex items-start gap-1.5">
                    <s.Icon size={13} className={`mt-px flex-none ${s.cls}`} />
                    <span className="min-w-0">
                      <span className="font-semibold text-text">{d.account ?? d.uni_id}</span>
                      <span className={`${s.cls}`}> — {s.text(d)}</span>
                    </span>
                  </div>
                )
              })}
              {job.status === 'done' && (job.details ?? []).length === 0 && (
                <div className="mt-1 text-muted">The engine had no tradeable account for this — nothing was sent.</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
