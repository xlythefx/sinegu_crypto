import { useState, type FormEvent, type Ref } from 'react'
import { CircleAlert, CircleCheck, Info, Sparkles, UserRound, WandSparkles } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import { BTN_GHOST, BTN_PRIMARY, FIELD, HINT, LABEL, SELECT } from '../../../settings/formClasses'
import type { StudioDraft } from '../../../../hooks/useStudioDraft'
import {
  creativeErrorMessage,
  errorBudget,
  fmtBudget,
  fmtCost,
  paramProblem,
  PLATFORM_LABEL,
} from '../../../../lib/creatives'
import { createGeneration, estimateGeneration } from '../../../../services/creatives'
import type {
  CreativeBudget,
  CreativeCharacter,
  CreativeEstimate,
  CreativeGeneration,
  CreativeModelPreset,
  CreativePlan,
} from '../../../../types/creatives'
import SectionHeader from '../SectionHeader'
import { NOTICE, SECTION, TEXTAREA } from '../creativeClasses'
import ModelPicker from './ModelPicker'
import ParamField from './ParamField'
import SourcePicker from './SourcePicker'

const PROMPT_MIN = 3
const PROMPT_MAX = 2000

interface GenerateFormProps {
  configured: boolean
  retentionDays: number
  budget: CreativeBudget
  onBudget: (budget: CreativeBudget) => void
  draft: StudioDraft
  models: CreativeModelPreset[]
  plans: CreativePlan[]
  /** The plan list could not be read — the picker says so instead of looking empty. */
  plansFailed: boolean
  /** null while loading or when it could not be read. */
  character: CreativeCharacter | null
  /** The gallery's rows — the animate model picks its picture from them. */
  generations: CreativeGeneration[]
  now: number
  onPlanChange: (planId: number | null) => void
  /** The picked plan's video prompt ('' when none) — the box says when it holds exactly that. */
  planPrompt?: string
  onCreated: (generation: CreativeGeneration) => void
  /** A refused submit may still have left a (failed) row — re-read the gallery. */
  onSubmitFailed: () => void
  onOpenCharacter: () => void
  formRef?: Ref<HTMLElement>
}

/**
 * Studio's form: plan, model, prompt, the model's own settings, the
 * character switch and — for "Animate" — the picture. "Check price" asks
 * Higgsfield what it would cost (free); Generate always shows that price and
 * what is left of the month's budget in a confirmation first, because it
 * spends real money the moment it is accepted.
 */
export default function GenerateForm({
  configured,
  retentionDays,
  budget,
  onBudget,
  draft,
  models,
  plans,
  plansFailed,
  character,
  generations,
  now,
  onPlanChange,
  planPrompt = '',
  onCreated,
  onSubmitFailed,
  onOpenCharacter,
  formRef,
}: GenerateFormProps) {
  const [estimate, setEstimate] = useState<{ key: string; result: CreativeEstimate } | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<CreativeEstimate | null>(null)

  const model = draft.model
  const name = character?.name || 'the character'
  const refsCount = character?.refs.length ?? 0
  const characterLocked = Boolean(model?.requires_character)
  const usingCharacter = draft.useCharacter || characterLocked
  const needsRefs = Boolean(model?.uses_references && usingCharacter && character && refsCount === 0)
  const current = estimate?.key === draft.key ? estimate.result : null
  const busy = checking || submitting
  const promptLength = draft.prompt.trim().length

  const problem = !model
    ? 'No model is available on this server.'
    : promptLength < PROMPT_MIN
      ? 'Describe what to make — at least a few words.'
      : promptLength > PROMPT_MAX
        ? `The prompt is too long — at most ${PROMPT_MAX.toLocaleString()} characters.`
        : model.needs_source && !draft.source
          ? 'Pick the picture to animate.'
          : needsRefs
            ? `This model needs pictures of ${name}. Add at least one reference image on the Character tab first.`
            : paramProblem(model, draft.params)

  const checkPrice = async (): Promise<CreativeEstimate | null> => {
    if (!draft.input) return null
    setChecking(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await estimateGeneration(draft.input)
      setEstimate({ key: draft.key, result })
      onBudget(result.budget)
      return result
    } catch (err) {
      setError(creativeErrorMessage(err, 'Could not get a price from Higgsfield.'))
      const b = errorBudget(err)
      if (b) onBudget(b)
      return null
    } finally {
      setChecking(false)
    }
  }

  const onCheck = () => {
    setAttempted(true)
    if (problem || !configured) return
    void checkPrice()
  }

  const onGenerate = async (e?: FormEvent) => {
    e?.preventDefault()
    setAttempted(true)
    if (problem || !configured) return
    const result = current ?? (await checkPrice())
    if (!result) return
    if (!result.allowed) {
      const b = result.budget
      setError(
        b.cap_usd <= 0
          ? 'Generating is switched off: this month’s cap is $0. A full admin can raise it on the Budget tab.'
          : `This costs ${fmtCost(result.usd)}, but only ${fmtBudget(b.remaining_usd)} of this month’s ${fmtBudget(b.cap_usd)} is left. Pick a cheaper setting, or ask a full admin to raise the cap.`,
      )
      return
    }
    setConfirm(result)
  }

  const submit = async () => {
    if (!draft.input) return
    setConfirm(null)
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const { generation, budget: next } = await createGeneration(draft.input)
      onCreated(generation)
      onBudget(next)
      setEstimate(null)
      setAttempted(false)
      setSuccess('Sent to Higgsfield. It is in the gallery now — this page checks on it every few seconds.')
    } catch (err) {
      setError(creativeErrorMessage(err, 'Could not start the generation.'))
      const b = errorBudget(err)
      if (b) onBudget(b)
      onSubmitFailed()
    } finally {
      setSubmitting(false)
    }
  }

  const characterHint = !model
    ? ''
    : characterLocked
      ? `This model always uses ${name}: it makes the video from ${name}’s reference images, and adds the look, style and rules to your prompt.`
      : model.uses_references
      ? `Sends ${name}’s ${refsCount === 1 ? 'reference image' : `${refsCount} reference images`} and adds the look, style and rules to your prompt, so the character looks the same every time.`
      : model.needs_source
        ? `Adds ${name}’s look, style and rules to your prompt. The picture you animate decides how it looks.`
        : `This model takes no pictures, so only ${name}’s look, style and rules are added to your prompt — good for designing first candidates.`

  return (
    <section ref={formRef} className={`${SECTION} scroll-mt-4`} data-aos="fade-up" aria-labelledby="creatives-studio">
      <SectionHeader
        icon={WandSparkles}
        id="creatives-studio"
        title="Make something"
        subtitle="Pick a model, describe the scene, check the price, then generate. Every generation is paid from this month’s budget."
      />

      {!configured && (
        <p className={NOTICE.info} role="status">
          <Info size={15} aria-hidden="true" />
          Higgsfield isn’t connected on this server, so generating is switched off here. Planning still works.
        </p>
      )}

      <form onSubmit={(e) => void onGenerate(e)} className="@container flex min-w-0 flex-col gap-4">
        <label className={FIELD}>
          <span className={LABEL}>For which plan</span>
          <select
            className={SELECT}
            value={draft.planId ?? ''}
            onChange={(e) => onPlanChange(e.target.value === '' ? null : Number(e.target.value))}
            disabled={busy}
          >
            <option value="">No plan — just trying something</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {PLATFORM_LABEL[p.platform]}
              </option>
            ))}
          </select>
          <span className={HINT}>
            {plansFailed
              ? 'The plans could not be loaded — you can still generate without one.'
              : 'Picking a plan sets the shape for its platform: 9:16 for TikTok, 16:9 for X.'}
          </span>
        </label>

        <div className={FIELD}>
          <span className={LABEL}>Model</span>
          <ModelPicker
            models={models}
            value={draft.modelKey}
            onChange={draft.setModel}
            disabled={busy}
          />
        </div>

        <label className={FIELD}>
          <span className={LABEL}>Prompt</span>
          <textarea
            className={`${TEXTAREA} min-h-[120px]`}
            rows={5}
            value={draft.prompt}
            maxLength={PROMPT_MAX}
            onChange={(e) => draft.setPrompt(e.target.value)}
            placeholder={
              model?.needs_source
                ? 'e.g. It waves at the camera while the charts behind it flicker, slow push-in'
                : `e.g. ${name} waves at the camera from a trading desk full of glowing charts, morning light`
            }
            disabled={busy}
          />
          <span className={`${HINT} flex justify-between gap-3`}>
            <span>
              {planPrompt.trim() !== '' && draft.prompt === planPrompt
                ? 'From the plan’s video prompt — change it as you like.'
                : ''}
            </span>
            <span className="flex-none">
              {promptLength.toLocaleString()} / {PROMPT_MAX.toLocaleString()}
            </span>
          </span>
        </label>

        {model && model.params.length > 0 && (
          <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
            {model.params.map((p) => (
              <ParamField
                key={`${model.key}-${p.name}`}
                param={p}
                value={draft.params[p.name]}
                onChange={(v) => draft.setParam(p.name, v)}
                disabled={busy}
              />
            ))}
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-row border border-border bg-surface2 px-3.5 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-[18px] w-[18px] flex-none cursor-pointer accent-[var(--accent)]"
            checked={usingCharacter}
            onChange={(e) => draft.setUseCharacter(e.target.checked)}
            disabled={busy || characterLocked}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-text">
              <UserRound size={14} aria-hidden="true" className="flex-none text-accent" />
              Use the character{character ? ` (${character.name})` : ''}
            </span>
            <span className="mt-0.5 block text-[12px] leading-[1.5] text-muted">{characterHint}</span>
          </span>
        </label>

        {needsRefs && (
          <div className={`${NOTICE.info} flex-wrap`} role="status">
            <Info size={15} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {name} has no reference images yet, and this model needs at least one.
            </span>
            <button
              type="button"
              onClick={onOpenCharacter}
              className="cursor-pointer rounded-pill border border-accent-line px-3 py-1 text-[11.5px] font-bold whitespace-nowrap transition-colors hover:bg-accent hover:text-on-accent"
            >
              Open the Character tab
            </button>
          </div>
        )}

        {model?.needs_source && (
          <SourcePicker
            generations={generations}
            refs={character?.refs ?? []}
            characterName={character?.name || 'The character'}
            value={draft.source}
            onChange={draft.setSource}
            now={now}
            disabled={busy}
          />
        )}

        {attempted && problem && !needsRefs && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {problem}
          </p>
        )}
        {error && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {error}
          </p>
        )}
        {success && (
          <p className={NOTICE.success} role="status">
            <CircleCheck size={15} aria-hidden="true" />
            {success}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-hair pt-4">
          {current ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-display text-[22px] font-extrabold text-text">{fmtCost(current.usd)}</span>
              <span className="text-[12.5px] text-muted">
                {fmtBudget(current.budget.remaining_usd)} left of this month’s {fmtBudget(current.budget.cap_usd)}
              </span>
              {!current.allowed && (
                <span className="text-[12.5px] font-semibold text-red">More than is left this month.</span>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] leading-[1.5] text-muted">
              This month: {fmtBudget(budget.spent_usd)} of {fmtBudget(budget.cap_usd)} spent ·{' '}
              <strong className="font-semibold text-text">{fmtBudget(budget.remaining_usd)} left</strong>. Checking
              the price is free.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button type="button" className={BTN_GHOST} onClick={onCheck} disabled={busy || !configured}>
              {checking ? 'Checking…' : 'Check price'}
            </button>
            <button type="submit" className={BTN_PRIMARY} disabled={busy || !configured}>
              <Sparkles size={15} aria-hidden="true" />
              {submitting ? 'Sending…' : 'Generate'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmModal
        open={confirm !== null}
        title={confirm ? `Generate for ${fmtCost(confirm.usd)}?` : ''}
        message={
          confirm
            ? `${model?.label ?? 'This model'}. It is charged as soon as Higgsfield accepts it and counts against this month’s budget: ${fmtBudget(confirm.budget.remaining_usd)} of ${fmtBudget(confirm.budget.cap_usd)} is left, about ${fmtBudget(Math.max(0, confirm.budget.remaining_usd - confirm.usd))} after this. Higgsfield deletes the result after ${retentionDays} days, so download what you want to keep.`
            : undefined
        }
        confirmLabel={confirm ? `Generate · ${fmtCost(confirm.usd)}` : 'Generate'}
        cancelLabel="Not now"
        onConfirm={() => void submit()}
        onCancel={() => setConfirm(null)}
      />
    </section>
  )
}
