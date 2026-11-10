import { useEffect, useState } from 'react'
import { CircleAlert, Lightbulb, LoaderCircle, PlugZap } from 'lucide-react'
import { Segmented, type SegmentedOption } from '../../../ui/filters'
import { BTN_GHOST, BTN_PRIMARY, FIELD, HINT, LABEL } from '../../../settings/formClasses'
import { useCreativeAiCall } from '../../../../hooks/useCreativeAiCall'
import { creativeErrorMessage, fmtCost, PLATFORM_KEYS, PLATFORM_LABEL } from '../../../../lib/creatives'
import {
  AI_COST_HINT,
  AI_FOCUS_MAX,
  AI_IDEA_COUNT_DEFAULT,
  AI_IDEA_COUNTS,
  AI_NOT_CONNECTED,
  aiBudgetWarning,
} from '../../../../lib/creativesAi'
import { createCreativePlan, suggestCreativeIdeas } from '../../../../services/creatives'
import type {
  CreativeAiIdea,
  CreativeAiMeta,
  CreativeBudget,
  CreativePlan,
  CreativePlatform,
} from '../../../../types/creatives'
import CreativeModal from '../CreativeModal'
import { NOTICE, TEXTAREA } from '../creativeClasses'
import AiWorking from './AiWorking'
import IdeaCard, { type IdeaSaveState } from './IdeaCard'

interface IdeasModalProps {
  open: boolean
  ai: CreativeAiMeta
  budget: CreativeBudget
  /** The planner's platform filter — the first choice here. */
  defaultPlatform: CreativePlatform | null
  onBudget: (budget: CreativeBudget) => void
  onClose: () => void
  /** An idea was filed as a plan. */
  onAdded: (plan: CreativePlan) => void
  /** Open a new plan, ready for Claude to draft this idea in full. */
  onWrite: (idea: CreativeAiIdea) => void
}

type PlatformChoice = 'any' | CreativePlatform

const PLATFORM_OPTIONS: SegmentedOption<PlatformChoice>[] = [
  { value: 'any', label: 'Either', tone: 'neutral' },
  ...PLATFORM_KEYS.map((k) => ({ value: k, label: PLATFORM_LABEL[k] })),
]
const COUNT_OPTIONS: SegmentedOption[] = AI_IDEA_COUNTS.map((n) => ({ value: n, label: n }))

/**
 * "Suggest ideas": Claude proposes a handful of posts (title, hook, why). The
 * list stays here while the page is open — closing the window, or leaving it
 * through "Write it", never throws a paid answer away; only asking again does.
 */
export default function IdeasModal({
  open,
  ai,
  budget,
  defaultPlatform,
  onBudget,
  onClose,
  onAdded,
  onWrite,
}: IdeasModalProps) {
  const call = useCreativeAiCall(suggestCreativeIdeas, { onBudget, fallback: 'Could not get ideas.' })
  const [focus, setFocus] = useState('')
  const [count, setCount] = useState<string>(AI_IDEA_COUNT_DEFAULT)
  const [platform, setPlatform] = useState<PlatformChoice>(defaultPlatform ?? 'any')
  const [saves, setSaves] = useState<Record<number, IdeaSaveState>>({})

  // A fresh start follows the planner's platform filter; a list already here keeps its choice.
  useEffect(() => {
    if (open && !call.result && !call.busy) setPlatform(defaultPlatform ?? 'any')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const busy = call.busy
  const adding = Object.values(saves).some((s) => s.status === 'saving')
  const ideas = call.result?.ideas ?? []
  const budgetWarning = aiBudgetWarning(budget)

  const suggest = () => {
    if (busy || adding || !ai.configured) return
    setSaves({})
    const text = focus.trim()
    void call.run({
      count: Number(count),
      ...(text ? { focus: text } : {}),
      platform: platform === 'any' ? null : platform,
    })
  }

  const add = async (idea: CreativeAiIdea, index: number) => {
    setSaves((s) => ({ ...s, [index]: { status: 'saving' } }))
    try {
      const plan = await createCreativePlan({
        title: idea.title.trim().slice(0, 160),
        status: 'idea',
        platform: idea.platform,
        format: idea.format,
        planned_for: null,
        hook: idea.hook.trim() || null,
        script: null,
        caption: null,
        hashtags: null,
        notes: null,
        posted_url: null,
        video_prompt: null,
        ai_drafted: true,
      })
      onAdded(plan)
      setSaves((s) => ({ ...s, [index]: { status: 'added' } }))
    } catch (err) {
      setSaves((s) => ({
        ...s,
        [index]: { status: 'failed', message: creativeErrorMessage(err, 'Could not add it to the planner.') },
      }))
    }
  }

  const addedCount = Object.values(saves).filter((s) => s.status === 'added').length

  return (
    <CreativeModal
      open={open}
      title="Suggest ideas"
      subtitle="Claude suggests posts for X and TikTok with Pixel. Add the ones you like to the planner, or have it write one in full."
      onClose={onClose}
      maxWidth={760}
    >
      <div className="flex flex-col gap-4">
        {!ai.configured && (
          <p className={NOTICE.info} role="status">
            <PlugZap size={15} aria-hidden="true" />
            {AI_NOT_CONNECTED}, so it cannot suggest anything here.
          </p>
        )}

        <fieldset
          disabled={busy || !ai.configured}
          className={`m-0 flex min-w-0 flex-col gap-4 border-0 p-0 transition-opacity duration-150 ${busy ? 'opacity-60' : ''}`}
        >
          <label className={FIELD}>
            <span className={LABEL}>What should they be about? (optional)</span>
            <textarea
              className={`${TEXTAREA} min-h-[64px]`}
              rows={2}
              value={focus}
              maxLength={AI_FOCUS_MAX}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. how the 20% fee works, this week’s results, why trade-only keys are safe"
            />
            <span className={`${HINT} text-right`}>
              {focus.trim().length} / {AI_FOCUS_MAX}
            </span>
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={FIELD}>
              <span className={LABEL}>Platform</span>
              <Segmented value={platform} onChange={setPlatform} options={PLATFORM_OPTIONS} ariaLabel="Platform" />
            </div>
            <div className={FIELD}>
              <span className={LABEL}>How many</span>
              <Segmented value={count} onChange={setCount} options={COUNT_OPTIONS} ariaLabel="How many ideas" />
            </div>
          </div>
        </fieldset>

        {ai.configured && budgetWarning && (
          <p className={NOTICE.warn} role="status">
            <CircleAlert size={15} aria-hidden="true" />
            {budgetWarning}
          </p>
        )}

        <div className="flex flex-col gap-2.5 border-t border-hair pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="min-w-0 text-[12px] leading-[1.5] text-muted">{AI_COST_HINT}</p>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <button type="button" className={BTN_GHOST} onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={suggest}
              disabled={busy || adding || !ai.configured}
              aria-busy={busy}
            >
              {busy ? (
                <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Lightbulb size={15} aria-hidden="true" />
              )}
              {busy ? 'Thinking…' : call.result ? 'Suggest again' : 'Suggest ideas'}
            </button>
          </div>
        </div>

        <AiWorking busy={busy} elapsed={call.elapsed} label="Claude is thinking of ideas." />

        {call.error && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {call.error}
          </p>
        )}

        {call.result && !busy && (
          <div key={call.seq} className="flex flex-col gap-3 animate-[fadeup_0.35s_ease-out]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[13px] font-bold text-text">
                {ideas.length === 1 ? '1 idea' : `${ideas.length} ideas`}
                {addedCount > 0 && (
                  <span className="font-semibold text-green"> · {addedCount} added to the planner</span>
                )}
              </p>
              <span className="font-mono text-[11.5px] text-muted">Cost {fmtCost(call.result.cost_usd)}</span>
            </div>
            {ideas.length === 0 ? (
              <p className="rounded-row border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
                Claude came back without ideas this time. Try again, or tell it what they should be about.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ideas.map((idea, i) => (
                  <IdeaCard
                    key={`${call.seq}-${i}`}
                    idea={idea}
                    save={saves[i]}
                    locked={busy}
                    onAdd={() => void add(idea, i)}
                    onWrite={() => onWrite(idea)}
                  />
                ))}
              </div>
            )}
            <p className={HINT}>
              Ideas are a starting point — nothing is posted. They stay here until you ask again or leave the page.
            </p>
          </div>
        )}
      </div>
    </CreativeModal>
  )
}
