import { useCallback, useMemo, useState } from 'react'
import {
  draftChanged,
  draftFrom,
  draftMax,
  draftProblems,
  isBinanceDraft,
  type AssetDraft,
} from '../lib/assetDraft'
import type { AdminAsset } from '../types/admin'

/**
 * The create / edit asset page's form state. Opened ONCE from `asset` (the page
 * mounts the editor keyed by asset id, so a different asset is a fresh draft);
 * everything derived lives in `lib/assetDraft`.
 */
export function useAssetDraft(asset: AdminAsset | null, defaultBroker: string | null) {
  const [initial] = useState(() => draftFrom(asset, defaultBroker))
  const [draft, setDraft] = useState<AssetDraft>(initial)

  const update = useCallback((patch: Partial<AssetDraft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch }
      // Leaving a Binance multiple for Custom starts the box on the value the
      // multiple gave, so the number on screen never jumps.
      if (patch.maxMultiple === 'custom' && d.maxMultiple !== 'custom' && isBinanceDraft(d)) {
        const max = draftMax(d)
        if (Number.isFinite(max)) next.maxPosition = String(max)
      }
      return next
    })
  }, [])

  const problems = useMemo(() => draftProblems(draft), [draft])
  const changed = useMemo(() => draftChanged(initial, draft), [initial, draft])

  return { draft, update, problems, changed }
}
