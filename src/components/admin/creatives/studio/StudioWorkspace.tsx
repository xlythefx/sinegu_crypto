import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, CircleAlert, WandSparkles } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import { useCreativeGenerations } from '../../../../hooks/useCreativeGenerations'
import { useNow } from '../../../../hooks/useNow'
import { useStudioDraft } from '../../../../hooks/useStudioDraft'
import { creativeErrorMessage, fmtCost, startSignedDownload } from '../../../../lib/creatives'
import { addCharacterRefFromGeneration, cancelGeneration } from '../../../../services/creatives'
import type {
  CreativeBudget,
  CreativeCharacter,
  CreativeGeneration,
  CreativePlan,
  CreativesMeta,
} from '../../../../types/creatives'
import { NOTICE } from '../creativeClasses'
import GenerateForm from './GenerateForm'
import GenerationGallery from './GenerationGallery'

interface StudioWorkspaceProps {
  meta: CreativesMeta
  budget: CreativeBudget
  onBudget: (budget: CreativeBudget) => void
  plans: CreativePlan[]
  plansFailed: boolean
  /** Preselected from `?plan=` (Planner's "Generate for this plan" / "Make the video"). */
  initialPlan: CreativePlan | null
  character: CreativeCharacter | null
  onCharacter: (character: CreativeCharacter) => void
  onOpenCharacter: () => void
  /**
   * 'page' = form and gallery side by side from 1280px. 'panel' = the chat
   * workspace's Gallery panel: one column, the form folded under "Make it
   * yourself" above the gallery (opened by `makeOpen`, by Animate, or by a plan).
   */
  variant?: 'page' | 'panel'
  /** Panel only: start with "Make it yourself" open. */
  makeOpen?: boolean
  /** Goes up when something outside (the agent's jobs) made new generations — the gallery re-reads. */
  reloadSignal?: number
}

/**
 * Studio: the form and the gallery, side by side from 1280px and stacked
 * below. The two talk through the draft: "Animate" on a picture switches the
 * form to the animate model with that picture and scrolls back up to it.
 * A plan with a video prompt (the AI writes one) fills the prompt box when it
 * is picked — never over something typed.
 */
export default function StudioWorkspace({
  meta,
  budget,
  onBudget,
  plans,
  plansFailed,
  initialPlan,
  character,
  onCharacter,
  onOpenCharacter,
  variant = 'page',
  makeOpen = false,
  reloadSignal = 0,
}: StudioWorkspaceProps) {
  const draft = useStudioDraft({
    models: meta.models,
    initialPlanId: initialPlan?.id ?? null,
    initialPlatform: initialPlan?.platform ?? null,
    initialPrompt: initialPlan?.video_prompt ?? '',
  })
  const gallery = useCreativeGenerations()
  const now = useNow(60_000)
  const formRef = useRef<HTMLElement>(null)
  const [, setParams] = useSearchParams()
  const [cancelling, setCancelling] = useState<CreativeGeneration | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const panel = variant === 'panel'
  // A plan handed over ("Make the video") is something to make, so the form starts open.
  const [formOpen, setFormOpen] = useState(!panel || makeOpen || initialPlan !== null)

  // Only a change after mounting means something new — the first read is already on its way.
  const { refresh } = gallery
  const mountSignal = useRef(reloadSignal)
  useEffect(() => {
    if (reloadSignal !== mountSignal.current) refresh()
  }, [reloadSignal, refresh])

  const planPrompt = (id: number | null) => plans.find((p) => p.id === id)?.video_prompt ?? ''

  const onPlanChange = (id: number | null) => {
    const plan = plans.find((p) => p.id === id) ?? null
    // Swap in the new plan's prompt only over an empty box or the previous plan's own prompt.
    if (draft.prompt.trim() === '' || draft.prompt === planPrompt(draft.planId)) {
      draft.setPrompt(plan?.video_prompt ?? '')
    }
    draft.setPlan(plan?.id ?? null, plan?.platform ?? null)
    // Keep `?plan=` in step so a reload lands on the same choice.
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (plan) next.set('plan', String(plan.id))
        else next.delete('plan')
        return next
      },
      { replace: true },
    )
  }

  const onAnimate = (g: CreativeGeneration, index: number) => {
    draft.animate({ generation_id: g.id, index })
    setFormOpen(true)
    // The folded form mounts on this render — scroll once it is there.
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const onUseAsRef = async (g: CreativeGeneration, index: number) => {
    try {
      const updated = await addCharacterRefFromGeneration(g.id, index)
      onCharacter(updated)
      return {
        ok: true,
        message: `Added to ${updated.name}’s reference images (${updated.refs.length} of ${meta.max_references}).`,
      }
    } catch (err) {
      return { ok: false, message: creativeErrorMessage(err, 'Could not add it as a reference image.') }
    }
  }

  const onDownload = async (g: CreativeGeneration, index: number): Promise<string | null> => {
    try {
      const path = await gallery.freshDownloadPath(g, index)
      if (!path) return `Higgsfield has deleted this file — results are only kept for ${meta.retention_days} days.`
      startSignedDownload(path)
      return null
    } catch (err) {
      return creativeErrorMessage(err, 'Could not start the download.')
    }
  }

  const cancel = async () => {
    const target = cancelling
    setCancelling(null)
    if (!target) return
    setCancelError(null)
    try {
      const { generation, budget: next } = await cancelGeneration(target.id)
      gallery.upsert(generation)
      onBudget(next)
    } catch (err) {
      setCancelError(creativeErrorMessage(err, 'Could not cancel it.'))
      gallery.refresh()
    }
  }

  const form = (
    <GenerateForm
      formRef={formRef}
      configured={meta.configured}
      retentionDays={meta.retention_days}
      budget={budget}
      onBudget={onBudget}
      draft={draft}
      models={meta.models}
      plans={plans}
      plansFailed={plansFailed}
      character={character}
      generations={gallery.generations ?? []}
      now={now}
      onPlanChange={onPlanChange}
      planPrompt={planPrompt(draft.planId)}
      onCreated={gallery.upsert}
      onSubmitFailed={gallery.refresh}
      onOpenCharacter={onOpenCharacter}
    />
  )

  const galleryColumn = (
    <div className="flex min-w-0 flex-col gap-stack">
      {cancelError && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {cancelError}
        </p>
      )}
      <GenerationGallery
        state={gallery}
        now={now}
        retentionDays={meta.retention_days}
        onDownload={onDownload}
        onAnimate={onAnimate}
        onUseAsRef={onUseAsRef}
        onCancel={setCancelling}
        delay={60}
      />
    </div>
  )

  return (
    <>
      {panel ? (
        <div className="flex min-w-0 flex-col gap-stack">
          <div className="flex min-w-0 flex-col gap-stack">
            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              aria-expanded={formOpen}
              className="flex w-full cursor-pointer items-center gap-3 rounded-row border border-border bg-surface px-4 py-3.5 text-left transition-[border-color] duration-150 hover:border-accent-line"
            >
              <span
                className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-accent-line bg-accent-soft text-accent"
                aria-hidden="true"
              >
                <WandSparkles size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold text-text">Make it yourself</span>
                <span className="mt-0.5 block text-[12px] leading-[1.5] text-muted">
                  Pick a model and write the prompt. It shows the price before anything is spent.
                </span>
              </span>
              <ChevronDown
                size={17}
                aria-hidden="true"
                className={`flex-none text-muted transition-transform duration-200 ${formOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {formOpen && <div className="animate-[fadeup_0.3s_ease-out]">{form}</div>}
          </div>
          {galleryColumn}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-stack xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:items-start">
          {form}
          {galleryColumn}
        </div>
      )}

      <ConfirmModal
        open={cancelling !== null}
        title="Cancel this generation?"
        message={
          cancelling
            ? `Higgsfield has not started on it yet, so it stops here and nothing is charged — the ${fmtCost(
                cancelling.charged_usd || cancelling.estimated_usd,
              )} reserved goes back into this month’s budget.`
            : undefined
        }
        confirmLabel="Cancel it"
        cancelLabel="Keep it"
        danger
        onConfirm={() => void cancel()}
        onCancel={() => setCancelling(null)}
      />
    </>
  )
}
