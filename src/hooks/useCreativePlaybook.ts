import { useCallback, useState } from 'react'
import { useApiData } from './useApiData'
import { getCreativePlaybook, updateCreativePlaybook } from '../services/creativesAgent'
import type { CreativePlaybook } from '../types/creatives'

export interface CreativePlaybookState {
  playbook: CreativePlaybook | null
  loading: boolean
  error: unknown
  reload: () => void
  /** Saves and keeps the saved copy; throws on failure (the panel says why). */
  save: (markdown: string) => Promise<CreativePlaybook>
}

/** The video playbook: read once, and the saved copy replaces it after every save (like the brief). */
export function useCreativePlaybook(): CreativePlaybookState {
  const { data, loading, error, reload: reloadData } = useApiData(getCreativePlaybook)
  const [saved, setSaved] = useState<CreativePlaybook | null>(null)

  const save = useCallback(async (markdown: string) => {
    const next = await updateCreativePlaybook(markdown)
    setSaved(next)
    return next
  }, [])

  const reload = useCallback(() => {
    setSaved(null)
    reloadData()
  }, [reloadData])

  return { playbook: saved ?? data, loading, error, reload, save }
}
