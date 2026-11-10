import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataState from '../../../dashboard/DataState'
import { useApiData } from '../../../../hooks/useApiData'
import { useCreativePlans } from '../../../../hooks/useCreativePlans'
import { getCreativeCharacter } from '../../../../services/creatives'
import type { CreativeBudget, CreativeCharacter, CreativesMeta } from '../../../../types/creatives'
import StudioWorkspace from './StudioWorkspace'

interface StudioTabProps {
  meta: CreativesMeta
  budget: CreativeBudget
  onBudget: (budget: CreativeBudget) => void
  onOpenCharacter: () => void
}

/**
 * Loads what the Studio form needs before it mounts: the plans (so a plan
 * picked in the Planner arrives with its platform's shape already set) and
 * the character (whether it has reference images yet). A failed plan list
 * never blocks generating — the form just has no plans to pick.
 */
export default function StudioTab({ meta, budget, onBudget, onOpenCharacter }: StudioTabProps) {
  const { plans, loading, error } = useCreativePlans()
  const characterState = useApiData(getCreativeCharacter)
  const [characterOverride, setCharacter] = useState<CreativeCharacter | null>(null)
  const [params] = useSearchParams()

  if (!plans && loading) {
    return <DataState loading error={null} onRetry={() => {}} label="the studio" />
  }

  const planId = Number(params.get('plan'))
  const initialPlan = plans?.find((p) => p.id === planId) ?? null

  return (
    <StudioWorkspace
      meta={meta}
      budget={budget}
      onBudget={onBudget}
      plans={plans ?? []}
      plansFailed={Boolean(error) && !plans}
      initialPlan={initialPlan}
      character={characterOverride ?? characterState.data}
      onCharacter={setCharacter}
      onOpenCharacter={onOpenCharacter}
    />
  )
}
