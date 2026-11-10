import { Plus } from 'lucide-react'
import { PLAN_STAGES } from '../../../../lib/creatives'
import type { CreativePlan, CreativePlanStatus } from '../../../../types/creatives'
import { TONE_DOT } from '../creativeClasses'
import PlanCard from './PlanCard'

interface PlanBoardProps {
  plans: CreativePlan[]
  movingId: number | null
  onOpen: (plan: CreativePlan) => void
  onNew: (status: CreativePlanStatus) => void
  onGenerate: (plan: CreativePlan) => void
  onMove: (plan: CreativePlan, status: CreativePlanStatus) => void
}

/**
 * Wide screens: one column per stage, Idea → Posted, left to right. Six
 * columns are wider than most screens, so the board scrolls sideways rather
 * than squeezing the cards.
 */
export default function PlanBoard({ plans, movingId, onOpen, onNew, onGenerate, onMove }: PlanBoardProps) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
      <div className="flex min-w-max items-start gap-3">
        {PLAN_STAGES.map((stage) => {
          const column = plans.filter((p) => p.status === stage.key)
          return (
            <section
              key={stage.key}
              aria-label={`${stage.label}: ${column.length}`}
              className="flex w-[264px] flex-none flex-col gap-2.5 rounded-row border border-hair bg-bg/40 p-2.5"
            >
              <header className="flex min-h-9 items-center gap-2 px-1">
                <span className={`h-2 w-2 flex-none rounded-full ${TONE_DOT[stage.tone]}`} aria-hidden="true" />
                <h3 className="min-w-0 flex-1 truncate text-[12.5px] font-bold uppercase tracking-[0.06em] text-text">
                  {stage.label}
                </h3>
                <span className="font-mono text-[11px] text-faint">{column.length}</span>
                <button
                  type="button"
                  onClick={() => onNew(stage.key)}
                  aria-label={`New plan in ${stage.label}`}
                  className="inline-flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-btn text-muted transition-colors duration-150 hover:bg-surface hover:text-accent"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </header>
              {column.length === 0 ? (
                <p className="rounded-row border border-dashed border-border px-3 py-5 text-center text-[12px] text-faint">
                  {stage.empty}
                </p>
              ) : (
                column.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    moving={movingId === plan.id}
                    onOpen={onOpen}
                    onGenerate={onGenerate}
                    onMove={onMove}
                  />
                ))
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
