import { CalendarDays, Sparkles } from 'lucide-react'
import { fmtDateTime, fmtMediumDate } from '../../../../lib/format'
import { isPlanLate, stageMeta } from '../../../../lib/creatives'
import type { CreativePlan, CreativePlanStatus } from '../../../../types/creatives'
import { FormatPill, PlatformPill } from '../PlatformPill'
import TonePill from '../TonePill'
import AiDraftPill from '../ai/AiDraftPill'
import { STAGE_ICON } from '../creativeIcons'
import PlanQuickMenu from './PlanQuickMenu'

interface PlanCardProps {
  plan: CreativePlan
  /** The list view mixes stages, so it names the card's own. */
  showStage?: boolean
  moving: boolean
  onOpen: (plan: CreativePlan) => void
  onGenerate: (plan: CreativePlan) => void
  onMove: (plan: CreativePlan, status: CreativePlanStatus) => void
}

/**
 * One content plan: title, platform, format, planned date and how many
 * generations it has — plus "AI draft" when its words came from Claude. The whole card opens the editor; the ⋯ button moves it
 * to another stage without opening anything.
 */
export default function PlanCard({ plan, showStage = false, moving, onOpen, onGenerate, onMove }: PlanCardProps) {
  const stage = stageMeta(plan.status)
  const late = isPlanLate(plan)

  return (
    <article
      onClick={() => onOpen(plan)}
      className={`flex min-w-0 cursor-pointer flex-col gap-2.5 rounded-row border border-border bg-surface2 p-3.5 transition-[border-color,transform] duration-150 hover:border-accent-line ${
        moving ? 'opacity-70' : ''
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen(plan)
          }}
          className="min-w-0 flex-1 cursor-pointer break-words text-left text-[13.5px] font-bold leading-[1.4] text-text"
        >
          {plan.title}
        </button>
        <PlanQuickMenu
          plan={plan}
          moving={moving}
          onEdit={() => onOpen(plan)}
          onGenerate={() => onGenerate(plan)}
          onMove={(status) => onMove(plan, status)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {showStage && (
          <TonePill tone={stage.tone} icon={STAGE_ICON[plan.status]}>
            {stage.label}
          </TonePill>
        )}
        <PlatformPill platform={plan.platform} />
        <FormatPill format={plan.format} />
        {plan.ai_drafted_at && (
          <AiDraftPill title={`Written with the AI writer (${fmtDateTime(plan.ai_drafted_at)}) — check it before posting`} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] text-muted">
        <span className={`inline-flex items-center gap-1 ${late ? 'font-semibold text-red' : ''}`}>
          <CalendarDays size={12} aria-hidden="true" className="flex-none" />
          {plan.planned_for ? fmtMediumDate(plan.planned_for) : 'No date yet'}
          {late && ' · late'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles size={12} aria-hidden="true" className="flex-none" />
          {plan.generations_count === 1 ? '1 generation' : `${plan.generations_count} generations`}
        </span>
      </div>
    </article>
  )
}
