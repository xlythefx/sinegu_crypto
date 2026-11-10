import { Ban, CheckCircle2, Clock } from 'lucide-react'
import StatusChip from '../webhooks/StatusChip'
import { fmtAgo, fmtDateTime } from '../../../lib/format'
import type { AiAccessKey } from '../../../types/aiAccess'

interface KeyRowProps {
  aiKey: AiAccessKey
  onRevoke: (key: AiAccessKey) => void
  busy: boolean
}

function StateChip({ state }: { state: AiAccessKey['state'] }) {
  if (state === 'active') return <StatusChip tone="good" icon={CheckCircle2}>Active</StatusChip>
  if (state === 'expired') return <StatusChip tone="neutral" icon={Clock}>Expired</StatusChip>
  return <StatusChip tone="bad" icon={Ban}>Revoked</StatusChip>
}

const FACT_LABEL = 'font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-faint'
const FACT_VALUE = 'mt-0.5 text-[12.5px] text-text'

/** One key: what it is called, its state, who made it, when it was last used and from where. */
export default function KeyRow({ aiKey, onRevoke, busy }: KeyRowProps) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-row border border-border bg-surface2 p-3.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-text">{aiKey.name}</span>
        <code className="font-mono text-[12px] text-muted">{aiKey.prefix}…</code>
        <StateChip state={aiKey.state} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        <div>
          <dt className={FACT_LABEL}>Made</dt>
          <dd className={FACT_VALUE}>
            {aiKey.created_at ? fmtDateTime(aiKey.created_at) : '—'}
            {aiKey.created_by_name ? <span className="text-muted"> · {aiKey.created_by_name}</span> : null}
          </dd>
        </div>
        <div>
          <dt className={FACT_LABEL}>{aiKey.state === 'revoked' ? 'Revoked' : 'Expires'}</dt>
          <dd className={FACT_VALUE}>
            {aiKey.state === 'revoked'
              ? `${aiKey.revoked_at ? fmtDateTime(aiKey.revoked_at) : '—'}${aiKey.revoked_by_name ? ` · ${aiKey.revoked_by_name}` : ''}`
              : aiKey.expires_at
                ? fmtDateTime(aiKey.expires_at)
                : 'Never · until revoked'}
          </dd>
        </div>
        <div>
          <dt className={FACT_LABEL}>Last used</dt>
          <dd className={FACT_VALUE}>{aiKey.last_used_at ? fmtAgo(aiKey.last_used_at) : 'Not yet'}</dd>
        </div>
        <div>
          <dt className={FACT_LABEL}>From</dt>
          <dd className={`${FACT_VALUE} break-all font-mono text-[12px]`}>{aiKey.last_used_ip ?? '—'}</dd>
        </div>
      </dl>
      {aiKey.state === 'active' && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => onRevoke(aiKey)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-field border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-transparent px-3 text-[12px] font-bold text-red transition-[background] duration-150 hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Ban size={13} aria-hidden="true" />
            Revoke
          </button>
        </div>
      )}
    </li>
  )
}
