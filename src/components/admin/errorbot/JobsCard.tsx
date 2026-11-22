import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { Pill, type PillTone } from '../../ui/Pill'
import { fmtDateTime } from '../../../lib/format'
import type { DevBotJob, DevBotJobStatus } from '../../../types/adminDevBot'

const CARD = 'flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5'
const BTN =
  'inline-flex min-h-9 cursor-pointer items-center rounded-[9px] border border-border bg-surface2 px-3 text-[12px] font-semibold text-text transition-[border-color] duration-150 disabled:opacity-50 enabled:hover:border-accent'

const STATUS: Record<DevBotJobStatus, [PillTone, string]> = {
  queued: ['muted', 'Waiting'],
  working: ['accent', 'Working'],
  done: ['green', 'Done'],
  failed: ['red', 'Failed'],
  cancelled: ['muted', 'Cancelled'],
}

const SOURCE: Record<string, string> = { message: 'Typed to the bot', button: 'Investigate button', deploy: 'Deploy' }

interface JobsCardProps {
  jobs: DevBotJob[]
  onCancel: (id: number) => Promise<void>
  onRetry: (id: number) => Promise<void>
}

/** The PC agent's last 30 jobs: what was asked, what it answered, its links. */
export default function JobsCard({ jobs, onCancel, onRetry }: JobsCardProps) {
  const [confirm, setConfirm] = useState<{ job: DevBotJob; act: 'cancel' | 'retry' } | null>(null)
  const [busy, setBusy] = useState(false)

  const act = async () => {
    if (!confirm) return
    const { job, act: which } = confirm
    setConfirm(null)
    setBusy(true)
    try {
      await (which === 'cancel' ? onCancel(job.id) : onRetry(job.id))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay={120} aria-labelledby="errorbot-jobs">
      <header>
        <h2 id="errorbot-jobs" className="font-display text-[16px] font-extrabold text-text">PC agent jobs</h2>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
          Everything you typed to the bot, every Investigate tap and every deploy, newest first.
        </p>
      </header>

      {jobs.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
          No jobs yet. Type a question to the bot, or tap Investigate under a problem.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((j) => {
            const [tone, label] = STATUS[j.status] ?? ['muted', j.status]
            const isDeploy = j.source === 'deploy'
            return (
              <li key={j.id} className="flex flex-col gap-2 rounded-[10px] border border-border px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] font-bold text-text">#{j.id}</span>
                  <Pill tone={tone}>{label}</Pill>
                  <span className="text-[12px] text-muted">{SOURCE[j.source] ?? j.source}</span>
                  {j.created_at && <span className="ml-auto text-[12px] text-muted">{fmtDateTime(j.created_at)}</span>}
                </div>
                <p className="break-words text-[13px] leading-[1.5] text-text">{j.prompt}</p>
                {j.summary && (
                  <details className="group">
                    <summary className="cursor-pointer text-[12.5px] font-semibold text-accent">The agent’s answer</summary>
                    <p className="mt-2 whitespace-pre-wrap break-words text-[12.5px] leading-[1.55] text-muted">{j.summary}</p>
                  </details>
                )}
                {(j.links.length > 0 || j.status === 'queued' || ['done', 'failed', 'cancelled'].includes(j.status)) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {j.links.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline">
                        {l.label} <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    ))}
                    <span className="ml-auto flex gap-2">
                      {j.status === 'queued' && (
                        <button type="button" className={BTN} disabled={busy} onClick={() => setConfirm({ job: j, act: 'cancel' })}>
                          Cancel
                        </button>
                      )}
                      {['done', 'failed', 'cancelled'].includes(j.status) && (
                        <button type="button" className={BTN} disabled={busy} onClick={() => setConfirm({ job: j, act: 'retry' })}>
                          {isDeploy ? 'Deploy again' : 'Run again'}
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmModal
        open={confirm !== null}
        title={confirm?.act === 'cancel' ? `Cancel job #${confirm?.job.id}?` : confirm?.job.source === 'deploy' ? 'Deploy again?' : `Run job #${confirm?.job.id} again?`}
        message={
          confirm?.act === 'cancel'
            ? 'The PC agent will not start it.'
            : confirm?.job.source === 'deploy'
              ? 'This updates the live site at pixel-alpha.com again, from what is on your PC now (backup first).'
              : 'A new job with the same request is queued for the PC agent.'
        }
        confirmLabel={confirm?.act === 'cancel' ? 'Cancel job' : confirm?.job.source === 'deploy' ? 'Deploy' : 'Run again'}
        danger={confirm?.act === 'retry' && confirm?.job.source === 'deploy'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void act()}
      />
    </section>
  )
}
