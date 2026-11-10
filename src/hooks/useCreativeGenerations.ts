import { useCallback, useEffect, useRef, useState } from 'react'
import { usePoll } from './usePoll'
import { creativeErrorMessage, DOWNLOAD_FRESH_MS, isPollingGeneration } from '../lib/creatives'
import { getCreativeGeneration, getCreativeGenerations } from '../services/creatives'
import type { CreativeGeneration } from '../types/creatives'

const PAGE_SIZE = 30
/** How often a list with something still generating is re-read. */
const POLL_MS = 5000

export interface CreativeGenerationsState {
  generations: CreativeGeneration[] | null
  hasMore: boolean
  loading: boolean
  error: unknown
  reload: () => void
  /** Re-read the newest page without blanking the list (after a refused submit left a row). */
  refresh: () => void
  loadMore: () => Promise<void>
  loadingMore: boolean
  moreError: string | null
  /** A generation an action returned (created, cancelled) — shown at once. */
  upsert: (generation: CreativeGeneration) => void
  /** Something is still with Higgsfield, so the list is being re-read every 5 s. */
  pending: boolean
  /** A download URL path that still works — re-read when the one on screen is old. */
  freshDownloadPath: (generation: CreativeGeneration, index: number) => Promise<string | null>
}

/**
 * Newest-first page of the head merged over the older pages already loaded:
 * the head replaces every row it covers, older rows below it stay.
 */
function mergeHead(prev: CreativeGeneration[] | null, head: CreativeGeneration[]): CreativeGeneration[] {
  if (!prev || head.length === 0) return head
  const lowest = Math.min(...head.map((g) => g.id))
  return [...head, ...prev.filter((g) => g.id < lowest)]
}

/**
 * The Studio gallery: newest first, "Load more" through `before_id`, and a
 * 5-second re-read while anything is queued or generating — only while the
 * tab is visible (usePoll), and never two reads at once. The server checks
 * Higgsfield for pending rows on each read, so the re-read is what moves a
 * card from "Generating" to "Ready".
 */
export function useCreativeGenerations(): CreativeGenerationsState {
  const [generations, setGenerations] = useState<CreativeGeneration[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  const mounted = useRef(true)
  const inFlight = useRef(false)
  /** Older pages were loaded, so has_more belongs to the tail, not the head. */
  const paged = useRef(false)
  /** When each row was last read — its download path's age. */
  const readAt = useRef(new Map<number, number>())

  const stamp = (rows: CreativeGeneration[]) => {
    const t = Date.now()
    for (const g of rows) readAt.current.set(g.id, t)
  }

  const fetchHead = useCallback(async (quiet: boolean) => {
    if (inFlight.current) return
    inFlight.current = true
    if (!quiet) {
      setLoading(true)
      setError(null)
    }
    try {
      const page = await getCreativeGenerations({ limit: PAGE_SIZE })
      if (!mounted.current) return
      stamp(page.generations)
      setGenerations((prev) => mergeHead(prev, page.generations))
      if (!paged.current) setHasMore(page.has_more)
      setError(null)
    } catch (err) {
      // A failed background re-read keeps what is on screen; the next tick retries.
      if (mounted.current && !quiet) setError(err)
    } finally {
      inFlight.current = false
      if (mounted.current && !quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void fetchHead(false)
    return () => {
      mounted.current = false
    }
  }, [fetchHead])

  // A row stuck in a pending state for hours does not keep the list polling.
  const pending = generations?.some((g) => isPollingGeneration(g, Date.now())) ?? false
  usePoll(() => void fetchHead(true), POLL_MS, { paused: !pending })

  const reload = useCallback(() => {
    paged.current = false
    setGenerations(null)
    void fetchHead(false)
  }, [fetchHead])

  const refresh = useCallback(() => void fetchHead(true), [fetchHead])

  const loadMore = useCallback(async () => {
    const last = generations?.[generations.length - 1]
    if (!last) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await getCreativeGenerations({ beforeId: last.id, limit: PAGE_SIZE })
      if (!mounted.current) return
      stamp(page.generations)
      paged.current = true
      setGenerations((prev) => {
        const have = new Set((prev ?? []).map((g) => g.id))
        return [...(prev ?? []), ...page.generations.filter((g) => !have.has(g.id))]
      })
      setHasMore(page.has_more)
    } catch (err) {
      if (mounted.current) setMoreError(creativeErrorMessage(err, 'Could not load older generations.'))
    } finally {
      if (mounted.current) setLoadingMore(false)
    }
  }, [generations])

  const upsert = useCallback((generation: CreativeGeneration) => {
    readAt.current.set(generation.id, Date.now())
    setGenerations((prev) => {
      const list = prev ?? []
      return list.some((g) => g.id === generation.id)
        ? list.map((g) => (g.id === generation.id ? generation : g))
        : [generation, ...list].sort((a, b) => b.id - a.id)
    })
  }, [])

  const freshDownloadPath = useCallback(
    async (generation: CreativeGeneration, index: number): Promise<string | null> => {
      const current = generation.outputs[index]?.download_path ?? null
      const age = Date.now() - (readAt.current.get(generation.id) ?? 0)
      if (current && age < DOWNLOAD_FRESH_MS) return current
      const fresh = await getCreativeGeneration(generation.id)
      if (!fresh) return null
      upsert(fresh)
      return fresh.outputs[index]?.download_path ?? null
    },
    [upsert],
  )

  return {
    generations,
    hasMore,
    loading,
    error,
    reload,
    refresh,
    loadMore,
    loadingMore,
    moreError,
    upsert,
    pending,
    freshDownloadPath,
  }
}
