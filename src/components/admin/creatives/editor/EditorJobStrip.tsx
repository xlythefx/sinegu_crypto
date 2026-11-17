import { useState } from 'react'
import { CircleAlert, Clapperboard, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import { useSessionUser } from '../../../../hooks/useSessionUser'
import { fmtJobUsd, stepCount } from '../../../../lib/creativesAgent'
import type { CreativeAgentJob } from '../../../../types/creatives'
import { NOTICE } from '../creativeClasses'

interface EditorJobStripProps {
  job: CreativeAgentJob
  busy: boolean
  error: string | undefined
  onCancel: (job: CreativeAgentJob) => void
  /** A PROPOSED job: open its full card (the steps, the total, what is left this month, and Go). */
  onReview?: (job: CreativeAgentJob) => void
}

const STRIP = 'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-row border px-3 py-1.5'
const STRIP_BTN =
  'inline-flex min-h-8 flex-none cursor-pointer items-center gap-1.5 rounded-field border px-2.5 text-[12px] font-bold transition-[background,border-color,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * A job as one slim line in the editor. Running: the clips show up in their
 * slots on the timeline, so the full card (with every step's preview) is not
 * repeated here; Stop asks first. Proposed: the price and "Review and Go",
 * which opens the full job card — that card is the confirmation (steps,
 * total, what is left), as everywhere else. A job that finished with failed
 * scenes says so once.
 */
export default function EditorJobStrip({ job, busy, error, onCancel, onReview }: EditorJobStripProps) {
  const [confirm, setConfirm] = useState(false)
  const me = useSessionUser()?.name ?? null
  const done =job.steps.filter((s) => s.status === 'completed').length
  const running = job.steps.filter((s) => s.status === 'running').length
  const failed = job.steps.filter((s) => s.status === 'failed').length

  if (job.status === 'proposed') {
    return (
      <div className={`${STRIP} border-accent-line bg-[linear-gradient(100deg,var(--accentSoft),var(--surface))]`}>
        <Clapperboard size={15} aria-hidden="true" className="flex-none text-accent" />
        <p className="min-w-[180px] flex-1 truncate text-[12.5px] leading-[1.5] text-text" title={job.title}>
          <strong className="font-bold">{job.title}</strong>
          <span className="text-muted"> — {stepCount(job.steps.length)}, {fmtJobUsd(job.estimated_usd)}. Nothing is spent until Go.</span>
        </p>
        <button
          type="button"
          className={`${STRIP_BTN} border-transparent bg-accent text-on-accent hover:brightness-[1.06]`}
          onClick={() => onReview?.(job)}
          disabled={busy}
        >
          Review and Go
        </button>
      </div>
    )
  }

  if (job.status !== 'running') {
    return (
      <p className={`${NOTICE.warn} py-1.5`} role="status">
        <TriangleAlert size={15} aria-hidden="true" />
        {failed > 0
          ? `“${job.title}” finished, but ${failed === 1 ? 'one step' : `${failed} steps`} failed — those cost nothing. Open the red scene and choose Regenerate or Improve with AI.`
          : `“${job.title}” stopped. Open a red scene and choose Regenerate or Improve with AI.`}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${STRIP} border-accent-line bg-accent-soft`}>
        <LoaderCircle size={15} aria-hidden="true" className="flex-none animate-spin text-accent" />
        <p className="min-w-[180px] flex-1 text-[12.5px] leading-[1.5] text-text">
          {/* The editor is shared: everyone is told who is generating; nobody is blocked. */}
          <strong className="font-bold">
            {!job.approved_by_name ? 'Making the clips' : job.approved_by_name === me ? 'You are generating' : `${job.approved_by_name} is generating`}
          </strong>{' '}
          — {done} of {job.steps.length} steps done
          {running > 0 ? `, ${running} at once` : ''}. Each lands in its slot when ready.
        </p>
        <button
          type="button"
          className={`${STRIP_BTN} border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-transparent text-red hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)]`}
          onClick={() => setConfirm(true)}
          disabled={busy}
        >
          <OctagonX size={13} aria-hidden="true" />
          {busy ? 'Stopping…' : 'Stop'}
        </button>
      </div>
      {error && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {error}
        </p>
      )}
      <ConfirmModal
        open={confirm}
        title="Stop making these clips?"
        message="No further steps start. A step still waiting in Higgsfield’s queue is cancelled and given back; one Higgsfield has already started finishes and is charged. Clips already made stay on the timeline."
        confirmLabel="Stop"
        cancelLabel="Keep going"
        danger
        onConfirm={() => {
          setConfirm(false)
          onCancel(job)
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
