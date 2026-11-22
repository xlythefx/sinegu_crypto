import { Coins, Rocket } from 'lucide-react'
import { Pill, type PillTone } from '../../ui/Pill'
import { fmtDateTime } from '../../../lib/format'
import type { DevBotActionRow } from '../../../types/adminDevBot'

const CARD = 'flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5'

const STATUS: Record<string, [PillTone, string]> = {
  open: ['accent', 'Waiting for you'],
  applied: ['green', 'Done'],
  skipped: ['muted', 'Skipped'],
  already_added: ['muted', 'Already added'],
  failed: ['red', 'Failed'],
}

/** What the bot's buttons did: coins added from Telegram and deploys offered after a merge. */
export default function ActionsCard({ actions }: { actions: DevBotActionRow[] }) {
  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay={160} aria-labelledby="errorbot-actions">
      <header>
        <h2 id="errorbot-actions" className="font-display text-[16px] font-extrabold text-text">Button history</h2>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
          Coins offered for adding, and deploys offered after a merge, with who answered.
        </p>
      </header>
      {actions.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
          Nothing yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
          {actions.map((a) => {
            const [tone, label] = STATUS[a.status] ?? ['muted', a.status]
            const Icon = a.kind === 'deploy' ? Rocket : Coins
            return (
              <li key={a.id} className="flex items-start gap-3 px-3.5 py-3">
                <Icon size={16} className="mt-0.5 flex-none text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-bold text-text">{a.subject}</span>
                    <Pill tone={tone}>{label}</Pill>
                    {a.occurrences > 1 && <span className="text-[12px] text-muted">refused {a.occurrences}×</span>}
                    {a.created_at && <span className="ml-auto text-[12px] text-muted">{fmtDateTime(a.created_at)}</span>}
                  </div>
                  {a.result && <p className="mt-1 break-words text-[12.5px] leading-[1.5] text-muted">{a.result}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
