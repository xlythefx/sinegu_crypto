import { intendedSizing } from './assetSizing'
import { maxFor, multipleOf, type MaxMultiple } from './binanceSizingCheck'
import { killDraftError, killDraftFrom, killDraftValue, type KillSwitchDraft } from './killSwitch'
import { ladderHasErrors, rowsFromSteps, sameLadder, stepsFromRows, type StreakRow } from './streakSizing'
import type { AdminAsset, AssetInput, AssetSide } from '../types/admin'

/**
 * The create / edit asset page's form state, and everything derived from it.
 * Pure — `hooks/useAssetDraft` holds it in React state.
 *
 * Numbers stay STRINGS while they are being typed (an empty box is not 0), and
 * become numbers only in `draftToInput`. On Binance the max position is picked
 * as a multiple of the base size (1× / 2× / 3×, owner's request) and DERIVED
 * from it; 'custom' types it — so a base-size edit can never leave a stale max.
 */

export const ASSET_TYPES = ['Cryptocurrency', 'Stocks', 'Forex', 'CFD'] as const
export const ASSET_BROKERS = ['Binance', 'Bybit', 'MEXC'] as const

export interface AssetDraft {
  ticker: string
  type: string | null
  broker: string | null
  side: AssetSide
  enabled: boolean
  baseSize: string
  /** Typed max position; read only when the picker is 'custom' or the venue is not Binance. */
  maxPosition: string
  maxMultiple: MaxMultiple | 'custom'
  streakEnabled: boolean
  streakRows: StreakRow[]
  kill: KillSwitchDraft
}

/**
 * The form a page opens on. Editing opens on the sizing the admin last SET —
 * a change waiting for a close, if there is one: opening on the live values
 * would make an unrelated save put them back and drop the waiting change.
 */
export function draftFrom(asset: AdminAsset | null, defaultBroker: string | null): AssetDraft {
  if (!asset) {
    return {
      ticker: '',
      type: 'Cryptocurrency',
      broker: defaultBroker ?? 'Binance',
      side: 'ALL',
      enabled: true,
      baseSize: '0.001',
      maxPosition: '0.003',
      maxMultiple: 3,
      streakEnabled: false,
      streakRows: [],
      kill: killDraftFrom(null),
    }
  }
  const sizing = intendedSizing(asset)
  return {
    ticker: asset.ticker,
    type: asset.type,
    broker: asset.broker,
    side: asset.side,
    enabled: asset.enabled,
    baseSize: String(sizing.base_size),
    maxPosition: String(sizing.max_increments),
    // A max that is not exactly 1×/2×/3× the base opens on Custom, untouched.
    maxMultiple: multipleOf(sizing.max_increments, sizing.base_size) ?? 'custom',
    streakEnabled: sizing.streak_sizing_enabled,
    streakRows: rowsFromSteps(sizing.streak_sizes),
    kill: killDraftFrom(asset.kill_switch_losses),
  }
}

export const isBinanceDraft = (d: Pick<AssetDraft, 'broker'>): boolean => d.broker === 'Binance'

/** The base size as a number; NaN while the box is empty or not a number. */
export const draftBase = (d: AssetDraft): number => (d.baseSize.trim() === '' ? NaN : Number(d.baseSize))

/** The max position the page will save — derived from the base on a Binance multiple. */
export function draftMax(d: AssetDraft): number {
  if (isBinanceDraft(d) && d.maxMultiple !== 'custom') {
    const base = draftBase(d)
    return Number.isFinite(base) && base > 0 ? maxFor(base, d.maxMultiple) : NaN
  }
  return d.maxPosition.trim() === '' ? NaN : Number(d.maxPosition)
}

/** Entries that fit in the max position — what the engine enforces. null until both sizes are valid. */
export function draftEntries(d: AssetDraft): number | null {
  const max = draftMax(d)
  const base = draftBase(d)
  if (!(max > 0) || !(base > 0)) return null
  return Math.max(1, Math.round(max / base))
}

/** One entry may never be bigger than the whole position (the API refuses it too). */
export function maxBelowBase(d: AssetDraft): boolean {
  const max = draftMax(d)
  const base = draftBase(d)
  return max > 0 && base > 0 && max < base
}

/** What the form would send. */
export function draftToInput(d: AssetDraft): AssetInput {
  return {
    ticker: d.ticker.trim().toUpperCase(),
    type: d.type,
    broker: d.broker,
    side: d.side,
    enabled: d.enabled,
    base_size: draftBase(d),
    max_increments: draftMax(d),
    streak_sizing_enabled: d.streakEnabled,
    streak_sizes: stepsFromRows(d.streakRows),
    kill_switch_losses: killDraftValue(d.kill),
  }
}

/** Where a problem lives, so the page can scroll to it and open its section. */
export type DraftSection = 'identity' | 'sizing' | 'streak'

export interface DraftProblem {
  section: DraftSection
  message: string
}

/** Every reason the draft cannot be saved yet, in page order. Empty = savable. */
export function draftProblems(d: AssetDraft): DraftProblem[] {
  const out: DraftProblem[] = []
  if (d.ticker.trim() === '') out.push({ section: 'identity', message: 'Enter the ticker symbol.' })
  if (!(draftBase(d) > 0)) out.push({ section: 'sizing', message: 'Base size must be more than 0.' })
  if (!(draftMax(d) > 0)) out.push({ section: 'sizing', message: 'Max position must be more than 0.' })
  else if (maxBelowBase(d)) {
    out.push({ section: 'sizing', message: 'Max position is smaller than one entry (the base size).' })
  }
  if (ladderHasErrors(d.streakRows)) {
    out.push({ section: 'streak', message: 'Fix the streak steps marked in red.' })
  }
  if (killDraftError(d.kill) || killDraftValue(d.kill) === undefined) {
    out.push({ section: 'streak', message: 'Fix the kill switch count.' })
  }
  return out
}

/**
 * Whether the draft differs from the one the page opened on — compared on what
 * would be SAVED, so retyping "0.10" as "0.1" is not a change.
 */
export function draftChanged(initial: AssetDraft, current: AssetDraft): boolean {
  const a = draftToInput(initial)
  const b = draftToInput(current)
  return (
    a.ticker !== b.ticker ||
    a.type !== b.type ||
    a.broker !== b.broker ||
    a.side !== b.side ||
    a.enabled !== b.enabled ||
    !sameNumber(a.base_size, b.base_size) ||
    !sameNumber(a.max_increments, b.max_increments) ||
    a.streak_sizing_enabled !== b.streak_sizing_enabled ||
    !sameLadder(a.streak_sizes ?? [], b.streak_sizes ?? []) ||
    a.kill_switch_losses !== b.kill_switch_losses
  )
}

const sameNumber = (a: number | undefined, b: number | undefined) =>
  a === b || (Number.isNaN(a) && Number.isNaN(b))

/** The edit changes the sizing it opened with — the confirm then says a size may wait for a close. */
export function changesSizing(asset: AdminAsset, input: AssetInput): boolean {
  const now = intendedSizing(asset)
  return (
    (input.base_size !== undefined && input.base_size !== now.base_size) ||
    (input.max_increments !== undefined && input.max_increments !== now.max_increments) ||
    (input.streak_sizing_enabled !== undefined && input.streak_sizing_enabled !== now.streak_sizing_enabled) ||
    (input.streak_sizes !== undefined && !sameLadder(input.streak_sizes, now.streak_sizes))
  )
}
