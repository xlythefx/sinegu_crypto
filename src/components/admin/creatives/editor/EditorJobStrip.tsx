import { useState } from 'react'
import { CircleAlert, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import type { CreativeAgentJob } from '../../../../types/creatives'
import { BTN_SOFT_DANGER, NOTICE } from '../creativeClasses'

interface EditorJobStripProps {
  job: CreativeAgentJob
  busy: boolean
  error: string | undefined
  onCancel: (job: CreativeAgentJob) => void
}

/**
 * A job that is already running, as one slim line in the editor: the clips
 * show up in their slots on the timeline, so the full card (with every
 * step's preview) is not repeated here. Stop asks first. A job that finished
 * with failed scenes says so once.
 */
export default function EditorJobStrip({ job, busy, error, onCancel }: EditorJobStripProps) {
  const [confirm, setConfirm] = useState(false)
  const done = job.steps.filter((s) => s.status === 'completed').length
  const running = job.steps.filter((s) => s.status === 'running').length
  const failed = job.steps.filter((s) => s.status === 'failed').length

  if (job.status !== 'running') {
    return (
      <p className={NOTICE.warn} role="status">
        <TriangleAlert size={15} aria-hidden="true" />
        {failed > 0
          ? `“${job.title}” finished, but ${failed === 1 ? 'one step' : `${failed} steps`} failed — those cost nothing. Open the red scene and choose Regenerate.`
          : `“${job.title}” stopped. Open a red scene and choose Regenerate.`}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-row border border-accent-line bg-accent-soft px-3.5 py-2.5">
        <LoaderCircle size={16} aria-hidden="true" className="flex-none animate-spin text-accent" />
        <p className="min-w-[200px] flex-1 text-[13px] leading-[1.5] text-text">
          <strong className="font-bold">Making the clips</strong> — {done} of {job.steps.length} steps done
          {running > 0 ? `, ${running} at once` : ''}. Each clip appears in its slot when it is ready.
        </p>
        <button type="button" className={BTN_SOFT_DANGER} onClick={() => setConfirm(true)} disabled={busy}>
          <OctagonX size={14} aria-hidden="true" />
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
