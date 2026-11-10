import type { CreativePlan, CreativePlanStatus } from '../../../../types/creatives'
import PlanCard from './PlanCard'

interface PlanListProps {
  plans: CreativePlan[]
  /** The stage filter is on "All", so each card names its own stage. */
  mixedStages: boolean
  movingId: number | null
  emptyText: string
  onOpen: (plan: CreativePlan) => void
  onGenerate: (plan: CreativePlan) => void
  onMove: (plan: CreativePlan, status: CreativePlanStatus) => void
}

/** Phone and tablet: one list for the picked stage, two cards a row from 640px. */
export default function PlanList({ plans, mixedStages, movingId, emptyText, onOpen, onGenerate, onMove }: PlanListProps) {
  if (plans.length === 0) {
    return (
      <p className="rounded-row border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
        {emptyText}
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          showStage={mixedStages}
          moving={movingId === plan.id}
          onOpen={onOpen}
          onGenerate={onGenerate}
          onMove={onMove}
        />
      ))}
    </div>
  )
}
