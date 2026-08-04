import { apiFetch } from './api'
import type { TradableAsset } from '../types/assets'

/** Enabled assets the bot trades. Sizing is never part of this payload. */
export async function getTradableAssets(): Promise<TradableAsset[]> {
  const res = await apiFetch<{ success: boolean; assets: TradableAsset[] }>(
    '/assets',
    { auth: true },
  )
  return res.assets
}
