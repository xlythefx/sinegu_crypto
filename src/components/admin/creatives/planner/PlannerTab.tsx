import { useMemo, useState } from 'react'
import { CircleAlert, Plus, SquareKanban } from 'lucide-react'
import DataState from '../../../dashboard/DataState'
import { FilterGroup, Segmented, type SegmentedOption } from '../../../ui/filters'
import { BTN_PRIMARY } from '../../../settings/formClasses'
import { useCreativePlans } from '../../../../hooks/useCreativePlans'
import { useIsMobile } from '../../../../hooks/useIsMobile'
import { useUrlFilters } from '../../../../hooks/useUrlFilters'
import { creativeErrorMessage, PLAN_STAGES, PLATFORM_KEYS, PLATFORM_LABEL, STAGE_KEYS } from '../../../../lib/creatives'
import { updateCreativePlan } from '../../../../services/creatives'
import type { CreativePlan, CreativePlanStatus, CreativePlatform } from '../../../../types/creatives'
import SectionHeader from '../SectionHeader'
import { NOTICE, SECTION } from '../creativeClasses'
import { STAGE_ICON } from '../creativeIcons'
import PlanBoard from './PlanBoard'
import PlanList from './PlanList'
import PlanModal, { type PlanDefaults } from './PlanModal'

interface PlannerTabProps {
  /** Open Studio with this plan picked. */
  onGenerate: (planId: number) => void
}

const FILTER_DEFAULTS = { platform: 'all', stage: 'all' }
const FILTER_ALLOWED = {
  platform: ['all', ...PLATFORM_KEYS],
  stage: ['all', ...STAGE_KEYS],
}

type Editing = { plan: CreativePlan | null; defaults?: PlanDefaults } | null

/**
 * Content plans on a board, Idea → Posted. From 1024px every stage is a
 * column; on a phone or tablet a stage picker and one list take their place.
 * Filters live in the URL and sit outside the re-keyed board, so changing one
 * replays the reveal without remounting the controls.
 */
export default function PlannerTab({ onGenerate }: PlannerTabProps) {
  const { plans, loading, error, reload, upsert, remove } = useCreativePlans()
  const { filters, set } = useUrlFilters(FILTER_DEFAULTS, { allowed: FILTER_ALLOWED })
  const wide = !useIsMobile(1024)
  const [editing, setEditing] = useState<Editing>(null)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  const list = useMemo(() => plans ?? [], [plans])
  const onPlatform = useMemo(
    () => (filters.platform === 'all' ? list : list.filter((p) => p.platform === filters.platform)),
    [list, filters.platform],
  )
  const inStage = filters.stage === 'all' ? onPlatform : onPlatform.filter((p) => p.status === filters.stage)

  const platformOptions: SegmentedOption[] = [
    { value: 'all', label: 'All', tone: 'neutral', count: list.length },
    ...PLATFORM_KEYS.map((k) => ({
      value: k,
      label: PLATFORM_LABEL[k],
      count: list.filter((p) => p.platform === k).length,
    })),
  ]
  const stageOptions: SegmentedOption[] = [
    { value: 'all', label: 'All', tone: 'neutral', count: onPlatform.length },
    ...PLAN_STAGES.map((s) => ({
      value: s.key,
      label: s.label,
      icon: STAGE_ICON[s.key],
      count: onPlatform.filter((p) => p.status === s.key).length,
    })),
  ]

  const newPlan = (status?: CreativePlanStatus) =>
    setEditing({
      plan: null,
      defaults: {
        // The stage picker only exists below 1024px; on the board a column's + names it.
        status: status ?? (!wide && filters.stage !== 'all' ? (filters.stage as CreativePlanStatus) : undefined),
        platform: filters.platform !== 'all' ? (filters.platform as CreativePlatform) : undefined,
      },
    })

  const move = async (plan: CreativePlan, status: CreativePlanStatus) => {
    setMovingId(plan.id)
    setMoveError(null)
    try {
      upsert(await updateCreativePlan(plan.id, { status }))
    } catch (err) {
      setMoveError(creativeErrorMessage(err, `Could not move “${plan.title}”.`))
    } finally {
      setMovingId(null)
    }
  }

  const stageLabel = PLAN_STAGES.find((s) => s.key === filters.stage)?.label
  const emptyText =
    list.length === 0
      ? 'No plans yet. Start with “New plan” — an idea is enough.'
      : stageLabel
        ? `Nothing in ${stageLabel}${filters.platform !== 'all' ? ` for ${PLATFORM_LABEL[filters.platform as CreativePlatform]}` : ''}.`
        : 'No plans for this platform yet.'

  return (
    <section className={SECTION} data-aos="fade-up" aria-labelledby="creatives-plans">
      <SectionHeader
        icon={SquareKanban}
        id="creatives-plans"
        title="Content plan"
        subtitle="Every X and TikTok post from first idea to posted. Open a card to write its hook, script and caption."
        actions={
          <button type="button" className={`${BTN_PRIMARY} max-sm:w-full`} onClick={() => newPlan()}>
            <Plus size={15} aria-hidden="true" />
            New plan
          </button>
        }
      />

      <div className="flex flex-col gap-3 rounded-row border border-hair bg-surface2/60 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:px-4">
        <FilterGroup label="Platform">
          <Segmented
            value={filters.platform}
            onChange={(v) => set('platform', v)}
            options={platformOptions}
            ariaLabel="Platform"
            size="sm"
          />
        </FilterGroup>
        {!wide && (
          <FilterGroup label="Stage">
            <Segmented
              value={filters.stage}
              onChange={(v) => set('stage', v)}
              options={stageOptions}
              ariaLabel="Stage"
              size="sm"
            />
          </FilterGroup>
        )}
      </div>

      {moveError && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {moveError}
        </p>
      )}

      {!plans ? (
        <DataState loading={loading} error={error} onRetry={reload} label="content plans" />
      ) : (
        <div
          key={`${wide ? 'board' : 'list'}-${filters.platform}-${wide ? '' : filters.stage}`}
          className="animate-[fadeup_0.35s_ease-out]"
        >
          {wide ? (
            <PlanBoard
              plans={onPlatform}
              movingId={movingId}
              onOpen={(plan) => setEditing({ plan })}
              onNew={newPlan}
              onGenerate={(plan) => onGenerate(plan.id)}
              onMove={(plan, status) => void move(plan, status)}
            />
          ) : (
            <PlanList
              plans={inStage}
              mixedStages={filters.stage === 'all'}
              movingId={movingId}
              emptyText={emptyText}
              onOpen={(plan) => setEditing({ plan })}
              onGenerate={(plan) => onGenerate(plan.id)}
              onMove={(plan, status) => void move(plan, status)}
            />
          )}
        </div>
      )}

      <PlanModal
        open={editing !== null}
        plan={editing?.plan ?? null}
        defaults={editing?.defaults}
        onClose={() => setEditing(null)}
        onSaved={upsert}
        onDeleted={remove}
        onGenerate={(id) => {
          setEditing(null)
          onGenerate(id)
        }}
      />
    </section>
  )
}
