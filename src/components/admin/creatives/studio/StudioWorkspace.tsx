import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import { useCreativeGenerations } from '../../../../hooks/useCreativeGenerations'
import { useNow } from '../../../../hooks/useNow'
import { useStudioDraft } from '../../../../hooks/useStudioDraft'
import { creativeErrorMessage, fmtCost, signedUrl } from '../../../../lib/creatives'
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
  /** Preselected from `?plan=` (Planner's "Generate for this plan"). */
  initialPlan: CreativePlan | null
  character: CreativeCharacter | null
  onCharacter: (character: CreativeCharacter) => void
  onOpenCharacter: () => void
}

/** Open a signed download in a new tab — an attachment downloads and the tab closes; an error never replaces this page. */
function startDownload(path: string): void {
  const a = document.createElement('a')
  a.href = signedUrl(path)
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Studio: the form and the gallery, side by side from 1280px and stacked
 * below. The two talk through the draft: "Animate" on a picture switches the
 * form to the animate model with that picture and scrolls back up to it.
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
}: StudioWorkspaceProps) {
  const draft = useStudioDraft({
    models: meta.models,
    initialPlanId: initialPlan?.id ?? null,
    initialPlatform: initialPlan?.platform ?? null,
  })
  const gallery = useCreativeGenerations()
  const now = useNow(60_000)
  const formRef = useRef<HTMLElement>(null)
  const [, setParams] = useSearchParams()
  const [cancelling, setCancelling] = useState<CreativeGeneration | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const onPlanChange = (id: number | null) => {
    const plan = plans.find((p) => p.id === id) ?? null
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
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      startDownload(path)
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

  return (
    <div className="grid grid-cols-1 gap-stack xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:items-start">
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
        onCreated={gallery.upsert}
        onSubmitFailed={gallery.refresh}
        onOpenCharacter={onOpenCharacter}
      />

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
    </div>
  )
}
