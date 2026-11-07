import { isKilled } from './killSwitch'
import type { AdminAsset } from '../types/admin'

/** Trading Assets' status filter. "attention" = stopped by the kill switch, or a size change waiting for a close. */
export const ASSET_STATUSES = ['all', 'on', 'off', 'attention'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export function needsAttention(a: AdminAsset): boolean {
  return isKilled(a) || Boolean(a.pending_sizing)
}

export function matchesStatus(a: AdminAsset, status: AssetStatus): boolean {
  switch (status) {
    case 'on':
      return a.enabled
    case 'off':
      return !a.enabled
    case 'attention':
      return needsAttention(a)
    default:
      return true
  }
}

/** Search on the ticker as typed or as shown ("LTC/USDT"), and the type. */
export function matchesQuery(a: AdminAsset, query: string): boolean {
  const q = query.trim().toLowerCase().replace('/', '')
  if (!q) return true
  return a.ticker.toLowerCase().includes(q) || (a.type ?? '').toLowerCase().includes(q)
}

export function statusCounts(assets: AdminAsset[]): Record<AssetStatus, number> {
  return {
    all: assets.length,
    on: assets.filter((a) => a.enabled).length,
    off: assets.filter((a) => !a.enabled).length,
    attention: assets.filter(needsAttention).length,
  }
}
