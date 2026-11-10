import { useCallback, useState } from 'react'
import { useApiData } from './useApiData'
import { getCreativesMeta } from '../services/creatives'
import type { CreativeAiMeta, CreativeBudget, CreativesMeta } from '../types/creatives'

export interface CreativesMetaState {
  meta: CreativesMeta | null
  /** The freshest budget seen — every generate, cancel and cap change returns one. */
  budget: CreativeBudget | null
  setBudget: (budget: CreativeBudget) => void
  /** The AI writer's state — the weekly-recap switch hands back the saved one. */
  ai: CreativeAiMeta | null
  setAi: (ai: CreativeAiMeta) => void
  loading: boolean
  error: unknown
  reload: () => void
}

/**
 * Admin → Creatives' page-level data: whether Higgsfield and Claude are
 * connected, the model presets, the budget and who may change it. The budget
 * and the AI settings are kept separately so a tab can hand back the newer
 * figure an action returned without re-reading the whole meta.
 */
export function useCreativesMeta(): CreativesMetaState {
  const { data, loading, error, reload: reloadMeta } = useApiData(getCreativesMeta)
  const [budget, setBudgetState] = useState<CreativeBudget | null>(null)
  const [ai, setAiState] = useState<CreativeAiMeta | null>(null)

  const setBudget = useCallback((next: CreativeBudget) => setBudgetState(next), [])
  const setAi = useCallback((next: CreativeAiMeta) => setAiState(next), [])
  const reload = useCallback(() => {
    setBudgetState(null)
    setAiState(null)
    reloadMeta()
  }, [reloadMeta])

  return {
    meta: data,
    budget: budget ?? data?.budget ?? null,
    setBudget,
    ai: ai ?? data?.ai ?? null,
    setAi,
    loading,
    error,
    reload,
  }
}
