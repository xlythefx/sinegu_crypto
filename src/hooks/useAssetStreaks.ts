import { useCallback, useEffect, useRef, useState } from 'react'
import { getAssetStreaks } from '../services/admin'
import type { AssetStreaks } from '../types/admin'

export interface AssetStreaksEntry {
  data: AssetStreaks | null
  loading: boolean
  failed: boolean
}

/**
 * "Right now" run counts for a set of assets, one request per asset, held
 * ABOVE the cards: the Streak Sizing Settings grid re-mounts its cards on
 * every search keystroke (the filter-switch reveal), and per-card fetching
 * would re-request every asset each time. Each asset is fetched once when it
 * first appears; `refresh(id)` re-asks after a save (the depth may change).
 * An asset with no entry yet is loading.
 */
export function useAssetStreaks(assetIds: readonly number[]) {
  const [entries, setEntries] = useState<Record<number, AssetStreaksEntry>>({})
  const requested = useRef(new Set<number>())
  // Latest request per asset: a slow first answer must not overwrite a
  // refresh that was sent after it.
  const sequence = useRef<Record<number, number>>({})

  const fetchOne = useCallback((id: number) => {
    const seq = (sequence.current[id] ?? 0) + 1
    sequence.current[id] = seq
    getAssetStreaks(id).then(
      (data) => {
        if (sequence.current[id] !== seq) return
        setEntries((all) => ({ ...all, [id]: { data, loading: false, failed: false } }))
      },
      () => {
        if (sequence.current[id] !== seq) return
        setEntries((all) => ({
          ...all,
          [id]: { data: all[id]?.data ?? null, loading: false, failed: true },
        }))
      },
    )
  }, [])

  const idsKey = assetIds.join(',')
  useEffect(() => {
    if (!idsKey) return
    for (const id of idsKey.split(',').map(Number)) {
      if (requested.current.has(id)) continue
      requested.current.add(id)
      fetchOne(id)
    }
  }, [idsKey, fetchOne])

  const refresh = useCallback(
    (id: number) => {
      setEntries((all) => ({
        ...all,
        [id]: { data: all[id]?.data ?? null, loading: true, failed: false },
      }))
      fetchOne(id)
    },
    [fetchOne],
  )

  return { entries, refresh }
}
