import { fmtMoney, fmtQty } from './format'
import { fmtSize, ladderShortText, sameLadder, scalePreview } from './streakSizing'
import type { AdminAsset, AssetStreakSize, PendingHolder } from '../types/admin'

/**
 * Pure helpers for a coin's sizing (Admin → Trading Assets): the size change
 * waiting for a close (API PendingSizing) and the "one entry for the main
 * account" preview.
 */

export interface AssetSizing {
  base_size: number
  max_increments: number
  streak_sizing_enabled: boolean
  streak_sizes: AssetStreakSize[]
}

/**
 * What the admin last set: the waiting change when there is one, else what
 * is live. The asset form and the streak card edit THIS, so re-saving an
 * unrelated field keeps a waiting change waiting instead of cancelling it.
 */
export function intendedSizing(asset: AdminAsset): AssetSizing {
  const p = asset.pending_sizing
  return p
    ? {
        base_size: p.base_size,
        max_increments: p.max_increments,
        streak_sizing_enabled: p.streak_sizing_enabled,
        streak_sizes: p.streak_sizes,
      }
    : {
        base_size: asset.base_size,
        max_increments: asset.max_increments,
        streak_sizing_enabled: asset.streak_sizing_enabled,
        streak_sizes: asset.streak_sizes,
      }
}

/** "LTC" from LTCUSDT / LTC_USDT — the unit a size is counted in. */
export function baseCoin(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/[_-]?(USDT|USDC|BUSD|USD)$/, '') || ticker
}

/** Entries a max position size allows at a base size — the engine's derivation. null = not derivable. */
export function entriesFor(max: number, base: number): number | null {
  if (!Number.isFinite(max) || !Number.isFinite(base) || max <= 0 || base <= 0) return null
  return Math.max(1, Math.round(max / base))
}

/** "Base 60 → 120 · Max 180 → 360 · Streak steps L1 40 → L1 30" — the waiting change against what is live. */
export function pendingChangeLines(asset: AdminAsset): string[] {
  const p = asset.pending_sizing
  if (!p) return []
  const lines: string[] = []
  if (p.base_size !== asset.base_size) {
    lines.push(`Base size ${fmtSize(asset.base_size)} → ${fmtSize(p.base_size)}`)
  }
  if (p.max_increments !== asset.max_increments) {
    lines.push(`Max position ${fmtSize(asset.max_increments)} → ${fmtSize(p.max_increments)}`)
  }
  if (p.streak_sizing_enabled !== asset.streak_sizing_enabled) {
    lines.push(`Streak sizing ${p.streak_sizing_enabled ? 'on' : 'off'}`)
  }
  if (!sameLadder(p.streak_sizes, asset.streak_sizes)) {
    lines.push(`Streak steps: ${p.streak_sizes.length ? ladderShortText(p.streak_sizes) : 'none'}`)
  }
  return lines
}

/** "the main account's LTC short" / "the 2 open LTC positions". */
export function holderText(ticker: string, holder: PendingHolder | null): string {
  const coin = baseCoin(ticker)
  if (!holder) return `the ${coin} position`
  if (holder.who === 'main') return `the main account’s ${coin} ${holder.side.toLowerCase()}`
  return holder.accounts === 1 ? `the open ${coin} position` : `the ${holder.accounts} open ${coin} positions`
}

export interface EntryPreview {
  /** Coins in one entry for the main account. */
  quantity: number
  /** quantity × last signal price; null with no price on record. */
  notional: number | null
  balance: number
}

/**
 * What one entry of `size` is on the main account, sized exactly as the
 * engine sizes it (scalePreview mirrors `_scale_qty`). null when there is no
 * main account on this exchange or the size is not a number yet.
 */
export function mainEntryPreview(asset: AdminAsset, size: number): EntryPreview | null {
  const balance = asset.main_account.balance
  if (balance === null || !Number.isFinite(size) || size <= 0) return null
  const quantity = scalePreview(asset.ticker, size, balance)
  const price = asset.main_account.price
  return { quantity, notional: price === null ? null : quantity * price, balance }
}

/** "Main account (17,829 USDT): one entry ≈ 2,136 RENDER ≈ $4,656". */
export function mainEntryText(asset: AdminAsset, size: number): string | null {
  const preview = mainEntryPreview(asset, size)
  if (!preview) return null
  const coins = `${fmtQty(preview.quantity, 0, 6)} ${baseCoin(asset.ticker)}`
  const money = preview.notional === null ? '' : ` ≈ ${fmtMoney(preview.notional, 0)}`
  return `Main account (${fmtQty(preview.balance, 0, 0)} USDT): one entry ≈ ${coins}${money}`
}
