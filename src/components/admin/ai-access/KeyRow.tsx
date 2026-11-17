import { Ban, CheckCircle2, Clock, Palette } from 'lucide-react'
import StatusChip from '../webhooks/StatusChip'
import { fmtAgo, fmtDateTime } from '../../../lib/format'
import type { AiAccessKey } from '../../../types/aiAccess'

interface KeyRowProps {
  aiKey: AiAccessKey
  onRevoke: (key: AiAccessKey) => void
  /** Ask to switch "May create in Creatives" on or off (confirmed by the card). */
  onCreate: (key: AiAccessKey, on: boolean) => void
  /** What this key's Grok generations cost (today / this month), if any. */
  spent: { today_usd: number; month_usd: number; generations: number } | null
  busy: boolean
}

const usd = (n: number) => `$${n.toFixed(n > 0 && n < 0.1 ? 3 : 2)}`

function StateChip({ state }: { state: AiAccessKey['state'] }) {
  if (state === 'active') return <StatusChip tone="good" icon={CheckCircle2}>Active</StatusChip>
  if (state === 'expired') return <StatusChip tone="neutral" icon={Clock}>Expired</StatusChip>
  return <StatusChip tone="bad" icon={Ban}>Revoked</StatusChip>
}

const FACT_LABEL = 'font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-faint'
const FACT_VALUE = 'mt-0.5 text-[12.5px] text-text'

/** One key: what it is called, its state, who made it, when it was last used and from where. */
export default function KeyRow({ aiKey, onRevoke, onCreate, spent, busy }: KeyRowProps) {
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
      {(aiKey.state === 'active' || aiKey.can_create) && (
        <div
          className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-row border px-3 py-2.5 ${
            aiKey.can_create ? 'border-accent-line bg-accent-soft' : 'border-hair bg-surface'
          }`}
        >
          <Palette size={15} aria-hidden="true" className="flex-none text-accent" />
          <div className="min-w-[180px] flex-1">
            <p className="text-[12.5px] font-bold text-text">
              {aiKey.can_create ? 'May create in Creatives' : 'Reads only'}
            </p>
            <p className="text-[11.5px] leading-[1.5] text-muted">
              {aiKey.can_create
                ? `Makes images and clips (labelled “Grok”) and saves post ideas.${aiKey.can_create_changed_by_name ? ` Switched on by ${aiKey.can_create_changed_by_name}.` : ''}`
                : 'Switch on to let its AI make images and clips and save post ideas in Creatives.'}
              {spent && spent.generations > 0 && ` Spent ${usd(spent.today_usd)} today, ${usd(spent.month_usd)} this month.`}
            </p>
          </div>
          {aiKey.state === 'active' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCreate(aiKey, !aiKey.can_create)}
              aria-pressed={aiKey.can_create}
              className="inline-flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-field border border-border bg-surface px-3 text-[12px] font-bold text-text transition-[border-color,background] duration-150 hover:border-accent-line hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiKey.can_create ? 'Switch off' : 'Allow creating'}
            </button>
          )}
        </div>
      )}
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
