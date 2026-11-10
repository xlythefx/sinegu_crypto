import { useCallback, useEffect, useState } from 'react'
import {
  createCreativeMemory,
  deleteCreativeMemory,
  getCreativeMemories,
  updateCreativeMemory,
} from '../services/creativesAgent'
import type { CreativeMemory, CreativeMemoryInput } from '../types/creatives'

export interface CreativeMemoriesState {
  memories: CreativeMemory[] | null
  loading: boolean
  error: unknown
  reload: () => void
  /** Each throws on failure, so the form that called it can say why. */
  add: (input: CreativeMemoryInput) => Promise<CreativeMemory>
  update: (id: number, patch: Partial<CreativeMemoryInput>) => Promise<CreativeMemory>
  remove: (id: number) => Promise<void>
}

/** Newest first — the API's order, kept for notes added or edited here. */
const byNewest = (list: CreativeMemory[]) =>
  [...list].sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : b.id - a.id))

/**
 * The team's memory notes. Kept locally after the first read so an add, edit
 * or delete shows at once. `reloadSignal` goes up when the agent saved or
 * changed a note in the chat — the list re-reads without blanking.
 */
export function useCreativeMemories(reloadSignal = 0): CreativeMemoriesState {
  const [memories, setMemories] = useState<CreativeMemory[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getCreativeMemories()
      .then((list) => {
        if (!cancelled) setMemories(byNewest(list))
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tick, reloadSignal])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const put = (memory: CreativeMemory) =>
    setMemories((prev) => byNewest([memory, ...(prev ?? []).filter((m) => m.id !== memory.id)]))

  const add = useCallback(async (input: CreativeMemoryInput) => {
    const memory = await createCreativeMemory(input)
    put(memory)
    return memory
  }, [])

  const update = useCallback(async (id: number, patch: Partial<CreativeMemoryInput>) => {
    const memory = await updateCreativeMemory(id, patch)
    put(memory)
    return memory
  }, [])

  const remove = useCallback(async (id: number) => {
    await deleteCreativeMemory(id)
    setMemories((prev) => (prev ? prev.filter((m) => m.id !== id) : prev))
  }, [])

  return { memories, loading, error, reload, add, update, remove }
}
