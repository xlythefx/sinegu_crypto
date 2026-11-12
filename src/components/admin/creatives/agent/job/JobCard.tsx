import { useState } from 'react'
import { CircleAlert, Clapperboard, Clock, Film, Images, OctagonX, Play, SquareKanban, TriangleAlert } from 'lucide-react'
import ConfirmModal from '../../../../ui/ConfirmModal'
import { BTN_GHOST } from '../../../../settings/formClasses'
import { fmtBudget, fmtTimeLeft } from '../../../../../lib/creatives'
import { effectiveJobStatus, fmtJobUsd, JOB_STATUS, jobMsLeft, stepCount } from '../../../../../lib/creativesAgent'
import type { AgentJobAction } from '../../../../../hooks/useCreativeAgent'
import type { CreativeAgentJob, CreativeBudget, CreativeGeneration } from '../../../../../types/creatives'
import TonePill from '../../TonePill'
import { BTN_SOFT, BTN_SOFT_DANGER, FACT_LABEL, NOTICE } from '../../creativeClasses'
import JobStepRow from './JobStepRow'

interface JobCardProps {
  job: CreativeAgentJob
  budget: CreativeBudget
  now: number
  retentionDays: number
  /** Higgsfield is connected on this server — without it nothing can start. */
  configured: boolean
  busy: AgentJobAction | undefined
  error: string | undefined
  onApprove: (job: CreativeAgentJob) => void
  onCancel: (job: CreativeAgentJob) => void
  onOpenPlan: (planId: number) => void
  onOpenGallery: () => void
  onDownload: (generation: CreativeGeneration, index: number) => Promise<string | null>
  /** Shown as "Open in the editor" when the job fills a video project (left out inside the editor itself). */
  onOpenEditor?: (path: string) => void
  /** Inside the editor: the Gallery button is not offered. */
  hideGallery?: boolean
}

/** The one button in the chat that spends money — big, gold, and it says the price. */
const GO_BTN =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-field border border-transparent bg-accent px-6 font-body text-[15px] font-extrabold text-on-accent shadow-[0_12px_28px_var(--glow)] transition-[filter,opacity] duration-150 hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

/**
 * A job the agent proposed: its paid steps with model and price, the total,
 * and ONE "Go" for the whole job. The card IS the confirmation — it shows the
 * total and what is left this month — so Go has no extra dialog. Stopping a
 * job that is already running does ask first. Once running, each step shows
 * where it is and, when ready, its result with Download and the countdown to
 * Higgsfield deleting it.
 */
export default function JobCard({
  job,
  budget,
  now,
  retentionDays,
  configured,
  busy,
  error,
  onApprove,
  onCancel,
  onOpenPlan,
  onOpenGallery,
  onDownload,
  onOpenEditor,
  hideGallery = false,
}: JobCardProps) {
  const [confirmStop, setConfirmStop] = useState(false)
  const status = effectiveJobStatus(job, now)
  // A status this page does not know yet reads neutrally — Go only ever shows for an exact 'proposed'.
  const meta = JOB_STATUS[status] ?? { label: String(status), tone: 'muted' as const }
  const proposed = status === 'proposed'
  const started = job.status !== 'proposed' && job.status !== 'expired' && !(job.status === 'canceled' && !job.approved_by_name)
  const left = jobMsLeft(job, now)
  const over = proposed && job.estimated_usd > budget.remaining_usd
  const doneSteps = job.steps.filter((s) => s.status === 'completed').length
  const currentStep = job.steps.findIndex((s) => s.status === 'running')
  const hasResult = job.steps.some((s) => s.generation && s.generation.outputs.length > 0)

  const forVideo = !!job.video_id
  const runningSteps = job.steps.filter((s) => s.status === 'running').length
  const by = job.approved_by_name ? ` · started by ${job.approved_by_name}` : ''
  const footer: string | null =
    status === 'running'
      ? forVideo
        ? `${doneSteps} of ${job.steps.length} steps done, ${runningSteps} being made at once${by}. Clips land in the editor in their place as they finish.`
        : `Step ${currentStep >= 0 ? currentStep + 1 : Math.min(doneSteps + 1, job.steps.length)} of ${job.steps.length}${by}. This chat checks every 5 seconds.`
      : status === 'completed'
        ? forVideo
          ? `Done${by}. Every clip is on the video’s timeline, and in the Gallery too.`
          : `Done${by}. Everything is in the Gallery too — download what you want to keep.`
        : status === 'completed_with_failures'
          ? 'Finished, but some scenes failed — they cost nothing. The others landed; regenerate the failed ones in the editor.'
        : status === 'failed'
          ? 'It stopped at the step that failed. The steps after it never started, so they cost nothing.'
          : status === 'canceled'
            ? job.approved_by_name
              ? 'Stopped. Nothing more is spent; what already finished stays in the Gallery.'
              : 'Not made. Nothing was spent.'
            : status === 'expired'
              ? 'It waited more than an hour for its Go, so it expired and nothing was spent. Ask the agent to propose it again.'
              : null

  return (
    <article
      aria-label={`Job: ${job.title}`}
      className={`flex min-w-0 flex-col gap-4 rounded-card border p-4 sm:p-5 ${
        proposed
          ? 'border-accent-line bg-[linear-gradient(165deg,var(--accentSoft),var(--surface)_55%)] shadow-[0_18px_44px_var(--glow)]'
          : 'border-border bg-surface'
      }`}
    >
      <header className="flex min-w-0 flex-wrap items-start gap-3">
        <span
          className="grid h-10 w-10 flex-none place-items-center rounded-[12px] border border-accent-line bg-accent-soft text-accent"
          aria-hidden="true"
        >
          <Clapperboard size={18} />
        </span>
        <div className="min-w-[160px] flex-1">
          <p className={FACT_LABEL}>Job · {stepCount(job.steps.length)}</p>
          <h3 className="mt-0.5 break-words font-display text-[17px] font-extrabold leading-[1.3] tracking-[-0.01em] text-text">
            {job.title}
          </h3>
          {job.plan_id !== null && (
            <button
              type="button"
              onClick={() => onOpenPlan(job.plan_id as number)}
              className="mt-1.5 inline-flex max-w-full cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-muted transition-colors duration-150 hover:text-accent"
            >
              <SquareKanban size={13} aria-hidden="true" className="flex-none text-accent" />
              <span className="truncate">For “{job.plan_title ?? `plan #${job.plan_id}`}”</span>
            </button>
          )}
        </div>
        <TonePill tone={meta.tone}>{meta.label}</TonePill>
      </header>

      <ol className="flex flex-col divide-y divide-hair overflow-hidden rounded-row border border-hair bg-surface2/70">
        {job.steps.map((step, i) => (
          <JobStepRow
            key={i}
            step={step}
            index={i}
            started={started}
            now={now}
            retentionDays={retentionDays}
            onDownload={onDownload}
          />
        ))}
      </ol>

      {proposed ? (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <p className={FACT_LABEL}>Total for the whole job</p>
              <p className="mt-1 font-display text-[30px] font-extrabold leading-none tracking-[-0.02em] text-text tabular-nums">
                {fmtJobUsd(job.estimated_usd)}
              </p>
            </div>
            <div className="flex flex-col gap-1 text-[12px] leading-[1.5] text-muted sm:items-end sm:text-right">
              <span>
                <strong className="font-semibold text-text">{fmtBudget(budget.remaining_usd)}</strong> left this month
              </span>
              {left !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={12} aria-hidden="true" className="flex-none" />
                  Go within {fmtTimeLeft(left)}
                </span>
              )}
            </div>
          </div>

          <p className="text-[12.5px] leading-[1.55] text-muted">
            Nothing is spent until you press Go. Each step is charged when Higgsfield takes it; one that fails is given
            back. Results are kept for {retentionDays} days.
          </p>

          {over && (
            <p className={NOTICE.warn} role="status">
              <TriangleAlert size={15} aria-hidden="true" />
              This is more than the {fmtBudget(budget.remaining_usd)} left this month, so it will probably be refused.
              Ask the agent for something cheaper, or a full admin can raise the cap.
            </p>
          )}
          {!configured && (
            <p className={NOTICE.warn} role="status">
              <TriangleAlert size={15} aria-hidden="true" />
              Higgsfield isn’t connected on this server, so this job can’t start here.
            </p>
          )}
          {error && (
            <p className={NOTICE.error} role="alert">
              <CircleAlert size={15} aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className={`${BTN_GHOST} min-h-12 disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={() => onCancel(job)}
              disabled={busy !== undefined}
            >
              {busy === 'cancel' ? 'Dropping…' : 'Not now'}
            </button>
            <button
              type="button"
              className={GO_BTN}
              onClick={() => onApprove(job)}
              disabled={busy !== undefined || !configured}
            >
              <Play size={16} aria-hidden="true" className="fill-current" />
              {busy === 'approve' ? 'Starting…' : `Go · ${fmtJobUsd(job.estimated_usd)}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t border-hair pt-3.5">
          {footer && <p className="text-[12.5px] leading-[1.55] text-muted">{footer}</p>}
          {error && (
            <p className={NOTICE.error} role="alert">
              <CircleAlert size={15} aria-hidden="true" />
              {error}
            </p>
          )}
          {(status === 'running' || hasResult || (onOpenEditor && job.editor_path)) && (
            <div className="flex flex-wrap gap-2">
              {onOpenEditor && job.editor_path && (
                <button type="button" className={BTN_SOFT} onClick={() => onOpenEditor(job.editor_path as string)}>
                  <Film size={14} aria-hidden="true" />
                  Open in the editor
                </button>
              )}
              {hasResult && !hideGallery && (
                <button type="button" className={BTN_SOFT} onClick={onOpenGallery}>
                  <Images size={14} aria-hidden="true" />
                  Open the Gallery
                </button>
              )}
              {status === 'running' && (
                <button
                  type="button"
                  className={BTN_SOFT_DANGER}
                  onClick={() => setConfirmStop(true)}
                  disabled={busy !== undefined}
                >
                  <OctagonX size={14} aria-hidden="true" />
                  {busy === 'cancel' ? 'Stopping…' : 'Stop this job'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmStop}
        title="Stop this job?"
        message="No further steps start. A step still waiting in Higgsfield’s queue is cancelled and given back; one Higgsfield has already started finishes and is charged. What is already made stays in the Gallery."
        confirmLabel="Stop the job"
        cancelLabel="Keep going"
        danger
        onConfirm={() => {
          setConfirmStop(false)
          onCancel(job)
        }}
        onCancel={() => setConfirmStop(false)}
      />
    </article>
  )
}
