import { useCallback, useState } from 'react'
import { useApiData } from './useApiData'
import { getCreativesMeta } from '../services/creatives'
import type { CreativeBudget, CreativesMeta } from '../types/creatives'

export interface CreativesMetaState {
  meta: CreativesMeta | null
  /** The freshest budget seen — every generate, cancel and cap change returns one. */
  budget: CreativeBudget | null
  setBudget: (budget: CreativeBudget) => void
  loading: boolean
  error: unknown
  reload: () => void
}

/**
 * Admin → Creatives' page-level data: whether Higgsfield is connected, the
 * model presets, the budget and who may change it. The budget is kept
 * separately so a tab can hand back the newer figure an action returned
 * without re-reading the whole meta.
 */
export function useCreativesMeta(): CreativesMetaState {
  const { data, loading, error, reload: reloadMeta } = useApiData(getCreativesMeta)
  const [budget, setBudgetState] = useState<CreativeBudget | null>(null)

  const setBudget = useCallback((next: CreativeBudget) => setBudgetState(next), [])
  const reload = useCallback(() => {
    setBudgetState(null)
    reloadMeta()
  }, [reloadMeta])

  return { meta: data, budget: budget ?? data?.budget ?? null, setBudget, loading, error, reload }
}
