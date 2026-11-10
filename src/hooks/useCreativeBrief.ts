import { useCallback, useState } from 'react'
import { useApiData } from './useApiData'
import { getCreativeBrief, updateCreativeBrief } from '../services/creativesAgent'
import type { CreativeBrief } from '../types/creatives'

export interface CreativeBriefState {
  brief: CreativeBrief | null
  loading: boolean
  error: unknown
  reload: () => void
  /** Saves and keeps the saved copy; throws on failure (the panel says why). */
  save: (markdown: string) => Promise<CreativeBrief>
}

/** The brand brief: read once, and the saved copy replaces it after every save. */
export function useCreativeBrief(): CreativeBriefState {
  const { data, loading, error, reload: reloadData } = useApiData(getCreativeBrief)
  const [saved, setSaved] = useState<CreativeBrief | null>(null)

  const save = useCallback(async (markdown: string) => {
    const next = await updateCreativeBrief(markdown)
    setSaved(next)
    return next
  }, [])

  const reload = useCallback(() => {
    setSaved(null)
    reloadData()
  }, [reloadData])

  return { brief: saved ?? data, loading, error, reload, save }
}
