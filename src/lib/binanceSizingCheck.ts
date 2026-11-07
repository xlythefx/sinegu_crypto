import { REFERENCE_BALANCE, scalePreview } from './streakSizing'
import { baseCoin, entriesFor } from './assetSizing'
import type { BinanceCoinRules } from '../types/admin'

/**
 * The asset form's Binance check: Binance's minimum order, the base size and the
 * full position in dollars, and whether the smallest trading account can hold the
 * full position. Pure — the API supplies the coin's rules, its mark price and the
 * smallest balance once per ticker (GET /admin/assets/binance-check); everything
 * here re-runs on each keystroke.
 *
 * Mirrors the engine: one entry is `scalePreview` (= `_scale_qty`), a position
 * holds `entriesFor(max, base)` entries, quantities are floored to the step size.
 */

/** Max position = base size × one of these (the form's 1× / 2× / 3× picker). */
export const MAX_MULTIPLES = [1, 2, 3] as const
export type MaxMultiple = (typeof MAX_MULTIPLES)[number]

/**
 * The most of the smallest account's balance one coin's FULL position may tie up
 * as margin before the check warns and suggests a smaller base size. Accounts hold
 * several coins at once, so one coin must leave room for the others.
 */
export const FULL_STACK_MARGIN_BUDGET = 0.25

/** Assumed when no Binance signal has carried a leverage yet (QuantLab sends 25×). */
export const FALLBACK_SIGNAL_LEVERAGE = 25

/** A base size under this many times Binance's minimum is one price drop from refused orders. */
const NEAR_MINIMUM_RATIO = 1.25

/** The 1× / 2× / 3× a max position is, or null when it is none of them. */
export function multipleOf(max: number, base: number): MaxMultiple | null {
  if (!(max > 0) || !(base > 0)) return null
  const ratio = max / base
  return MAX_MULTIPLES.find((m) => Math.abs(ratio - m) < 1e-6) ?? null
}

/** base × multiple at the 3 decimals `assets.max_increments` stores. */
export function maxFor(base: number, multiple: number): number {
  return Math.round(base * multiple * 1000) / 1000
}

function stepDecimals(step: string): number {
  const s = step.includes('e-') ? Number(step).toFixed(12).replace(/0+$/, '') : step
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : s.length - dot - 1
}

/** Floor to a multiple of the coin's step size (what the engine sends). */
export function floorToStep(qty: number, step: string | null): number {
  const s = Number(step)
  if (!step || !(s > 0)) return qty
  return Number((Math.floor(qty / s + 1e-9) * s).toFixed(stepDecimals(step)))
}

function ceilToStep(qty: number, step: string | null): number {
  const s = Number(step)
  if (!step || !(s > 0)) return qty
  return Number((Math.ceil(qty / s - 1e-9) * s).toFixed(stepDecimals(step)))
}

/** Two significant figures, rounded down: 12.71 → 12, 0.0234 → 0.023, 2345 → 2300. */
function niceFloor(x: number): number {
  if (!(x > 0)) return 0
  const unit = Math.pow(10, Math.floor(Math.log10(x)) - 1)
  return Number((Math.floor(x / unit + 1e-9) * unit).toPrecision(12))
}

/** Smallest quantity Binance accepts on one market order at today's price. */
export function minOrderQty(rules: BinanceCoinRules): number | null {
  const byQty = rules.min_qty ?? 0
  const byValue =
    rules.min_notional && rules.price ? ceilToStep(rules.min_notional / rules.price, rules.step_size) : 0
  const min = Math.max(byQty, byValue)
  return min > 0 ? min : null
}

export type CheckStatus = 'ok' | 'warn' | 'bad'

export interface SizingCheck {
  coin: string
  price: number | null
  minOrder: { qty: number; usd: number | null } | null
  base: {
    qty: number
    usd: number | null
    /** Base size ÷ Binance's minimum; null when the minimum is unknown. */
    timesMinimum: number | null
    status: CheckStatus
    /** What the engine sends when the base size is not a multiple of the step. */
    sentAs: number | null
    /** A base size comfortably above Binance's minimum, when this one is under or near it. */
    raiseTo: number | null
  }
  stack: {
    entries: number
    leverage: number
    /** One entry on the smallest account, sized as the engine sizes it. */
    entryQty: number
    fullQty: number
    fullUsd: number
    margin: number
    /** margin ÷ the smallest account's balance. */
    share: number
    status: CheckStatus
  } | null
  /** A smaller base size that keeps the full position inside FULL_STACK_MARGIN_BUDGET. */
  suggestedBase: number | null
  /** Even Binance's minimum order is over the budget at this many entries. */
  minimumTooBig: boolean
  /** The smallest account's share at Binance's minimum (set with minimumTooBig). */
  shareAtMinimum: number | null
}

/** The whole check from the form's values; null until there is a listed coin and a base size. */
export function checkSizing(input: {
  ticker: string
  baseSize: number
  maxPosition: number
  leverage: number
  rules: BinanceCoinRules | null
  smallestBalance: number | null
}): SizingCheck | null {
  const { ticker, baseSize, maxPosition, leverage, rules, smallestBalance } = input
  if (!rules || !rules.listed || !(baseSize > 0)) return null

  const price = rules.price
  const minQty = minOrderQty(rules)
  const sent = floorToStep(baseSize, rules.step_size)
  const timesMinimum = minQty ? sent / minQty : null
  const baseStatus: CheckStatus =
    timesMinimum === null ? 'ok' : timesMinimum < 1 - 1e-9 ? 'bad' : timesMinimum < NEAR_MINIMUM_RATIO ? 'warn' : 'ok'

  const entries = entriesFor(maxPosition, baseSize)
  let stack: SizingCheck['stack'] = null
  let suggestedBase: number | null = null
  let minimumTooBig = false
  let shareAtMinimum: number | null = null

  if (entries && price && smallestBalance && smallestBalance > 0 && leverage > 0) {
    const entryQty = scalePreview(ticker, baseSize, smallestBalance)
    const fullQty = entryQty * entries
    const fullUsd = fullQty * price
    const margin = fullUsd / leverage
    const share = margin / smallestBalance
    const status: CheckStatus = share > 1 ? 'bad' : share > FULL_STACK_MARGIN_BUDGET ? 'warn' : 'ok'
    stack = { entries, leverage, entryQty, fullQty, fullUsd, margin, share, status }

    if (status !== 'ok') {
      // An entry is at most base × min(balance, 1000) / 1000 of the balance, so this
      // base keeps the share at or under the budget (the engine floors, never rounds up).
      const reference = Math.min(smallestBalance, REFERENCE_BALANCE)
      const target = (FULL_STACK_MARGIN_BUDGET * reference * leverage) / (entries * price)
      const nice = floorToStep(niceFloor(target), rules.step_size)
      if (minQty !== null && nice < minQty) {
        minimumTooBig = true
        shareAtMinimum = (share * minQty) / baseSize
      } else if (nice > 0 && nice < baseSize) {
        suggestedBase = nice
      }
    }
  }

  return {
    coin: baseCoin(ticker),
    price,
    minOrder: minQty === null ? null : { qty: minQty, usd: price ? minQty * price : null },
    base: {
      qty: baseSize,
      usd: price ? sent * price : null,
      timesMinimum,
      status: baseStatus,
      sentAs: Math.abs(sent - baseSize) > 1e-12 ? sent : null,
      raiseTo: baseStatus !== 'ok' && minQty ? ceilToStep(minQty * NEAR_MINIMUM_RATIO, rules.step_size) : null,
    },
    stack,
    suggestedBase,
    minimumTooBig,
    shareAtMinimum,
  }
}
