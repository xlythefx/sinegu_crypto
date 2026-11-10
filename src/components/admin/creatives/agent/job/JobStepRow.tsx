import { Ban, Check, LoaderCircle, X } from 'lucide-react'
import { fmtJobUsd, STEP_STATUS } from '../../../../../lib/creativesAgent'
import type { CreativeAgentJobStep, CreativeGeneration } from '../../../../../types/creatives'
import TonePill from '../../TonePill'
import StepPreview from './StepPreview'

interface JobStepRowProps {
  step: CreativeAgentJobStep
  index: number
  /** Proposed: price list only. Afterwards each step shows where it is and what it made. */
  started: boolean
  now: number
  retentionDays: number
  onDownload: (generation: CreativeGeneration, index: number) => Promise<string | null>
}

/** The number badge turns into the step's state once the job runs. */
function StepBadge({ step, index, started }: { step: CreativeAgentJobStep; index: number; started: boolean }) {
  const base = 'grid h-7 w-7 flex-none place-items-center rounded-full border font-mono text-[11.5px] font-semibold'
  if (started && step.status === 'completed') {
    return (
      <span className={`${base} border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-green`}>
        <Check size={14} aria-hidden="true" />
      </span>
    )
  }
  if (started && step.status === 'running') {
    return (
      <span className={`${base} border-accent-line bg-accent-soft text-accent`}>
        <LoaderCircle size={14} aria-hidden="true" className="animate-spin" />
      </span>
    )
  }
  if (started && step.status === 'failed') {
    return (
      <span className={`${base} border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red`}>
        <X size={14} aria-hidden="true" />
      </span>
    )
  }
  if (started && step.status === 'canceled') {
    return (
      <span className={`${base} border-border bg-surface text-faint`}>
        <Ban size={13} aria-hidden="true" />
      </span>
    )
  }
  return <span className={`${base} border-border bg-surface text-muted`}>{index + 1}</span>
}

/**
 * One paid step of a job: what it makes, with which model, for how much.
 * Once the job runs it carries its state and, when ready, its result.
 */
export default function JobStepRow({ step, index, started, now, retentionDays, onDownload }: JobStepRowProps) {
  const meta = STEP_STATUS[step.status] ?? STEP_STATUS.waiting
  const g = step.generation
  // A finished step shows what it really cost; a refused or cancelled one cost nothing.
  const price =
    started && g && !['submitting', 'queued', 'in_progress'].includes(g.status)
      ? g.charged_usd > 0
        ? fmtJobUsd(g.charged_usd)
        : 'Not charged'
      : fmtJobUsd(step.usd)

  return (
    <li className="flex min-w-0 flex-col gap-3 px-3.5 py-3 sm:px-4">
      <div className="flex min-w-0 items-start gap-3">
        <StepBadge step={step} index={index} started={started} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13.5px] font-semibold leading-[1.45] text-text">{step.label}</p>
          <p className="mt-0.5 text-[12px] leading-[1.45] text-muted">{step.model_label}</p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <span className="font-mono text-[13px] font-semibold tabular-nums text-text">{price}</span>
          {started && (
            <TonePill tone={meta.tone} title={meta.label}>
              {meta.label}
            </TonePill>
          )}
        </div>
      </div>

      {started && step.error && (
        <p className="break-words pl-10 text-[12px] leading-[1.5] text-red">{step.error}</p>
      )}
      {started && g && (
        <div className="min-w-0 sm:pl-10">
          <StepPreview generation={g} now={now} retentionDays={retentionDays} onDownload={onDownload} />
        </div>
      )}
    </li>
  )
}
