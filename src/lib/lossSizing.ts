import type { AssetLossSize, AssetLossStreaks } from '../types/admin'
import { fmtQty } from './format'

/**
 * Loss-streak sizing — the client half (no React).
 *
 * After N losing trades in a row on a coin, an account's next entry uses the
 * size typed for step N instead of the asset's base size. A blank step
 * carries the step above it (or base size when there is none), the deepest
 * step keeps applying however long the streak runs, and one win puts the
 * account straight back on base size. The engine applies it; the API
 * (`App\Services\Assets\LossSizing`) stores it and counts the streaks. This
 * file only previews it, so every figure here must match what those two do.
 */

/** Deepest step the API accepts (`LossSizing::MAX_STEPS`). */
export const MAX_LOSS_STEPS = 10

/**
 * Balance that earns exactly one base size — trading-flask
 * `hooks.REFERENCE_BALANCE` (env-driven, default 1000).
 */
export const REFERENCE_BALANCE = 1000

/**
 * Tickers that scale in WHOLE multiples of the size — trading-flask
 * `hooks.COARSE_STEP_TICKERS` (env-driven, default BTCUSDT).
 */
export const COARSE_STEP_TICKERS: readonly string[] = ['BTCUSDT']

/** Sizes are stored as decimal(20, 6) — more decimals would be rounded silently. */
const MAX_DECIMALS = 6

/** Deepest configured step, or 0 when the ladder is empty. */
export function deepestStep(steps: readonly AssetLossSize[]): number {
  return steps.reduce((max, s) => Math.max(max, s.losses), 0)
}

/**
 * The size an entry uses at each streak, index 0 → `depth`.
 * Index 0 (no losses / after a win) is `base`; every later index takes the
 * step configured for it, or carries the previous index when it is blank.
 * The last index therefore reads "this many losses or more".
 */
export function resolveLadder(
  base: number,
  steps: readonly AssetLossSize[],
  depth: number,
): number[] {
  const bySteps = new Map(steps.map((s) => [s.losses, s.size]))
  const sizes = [base]
  let current = base
  for (let n = 1; n <= depth; n++) {
    const size = bySteps.get(n)
    if (size !== undefined) current = size
    sizes.push(current)
  }
  return sizes
}

/**
 * What one entry of `size` becomes on an account holding `balance` USDT.
 *
 * Mirrors trading-flask `routes/webhook.py::_scale_qty` operation for
 * operation (same float steps, same floor, same 10-dp round), with the
 * reference balance of 1000: below it the size is used as-is; coarse tickers
 * (BTCUSDT) step in whole multiples per 1,000 USDT; everything else scales in
 * tenths of the size, floored. A ladder step scales exactly like base size.
 */
export function scalePreview(ticker: string, size: number, balance: number): number {
  if (!Number.isFinite(size) || !Number.isFinite(balance) || size <= 0) return 0
  if (balance < REFERENCE_BALANCE) return size
  if (COARSE_STEP_TICKERS.includes(ticker.trim().toUpperCase())) {
    return Math.floor(balance / REFERENCE_BALANCE) * size
  }
  const step = size / 10
  const scaled = size * (balance / REFERENCE_BALANCE)
  return Number((Math.floor(scaled / step) * step).toFixed(10))
}

/* ---------------------------------------------------------------- editor -- */

/**
 * Editor rows from a saved ladder: index i is step i + 1, one row per step
 * down to the deepest, blank where no size is configured.
 */
export function valuesFromSteps(steps: readonly AssetLossSize[]): string[] {
  const bySteps = new Map(steps.map((s) => [s.losses, s.size]))
  return Array.from({ length: deepestStep(steps) }, (_, i) => {
    const size = bySteps.get(i + 1)
    return size === undefined ? '' : String(size)
  })
}

/**
 * The ladder a set of editor rows saves: the non-blank rows only. A row that
 * fails `stepIssue` must be fixed before this is sent — the API 422s it.
 */
export function stepsFromValues(values: readonly string[]): AssetLossSize[] {
  return values.flatMap((value, i) =>
    value.trim() === '' ? [] : [{ losses: i + 1, size: Number(value) }],
  )
}

export interface StepIssue {
  /** error blocks saving; warn is advice only. */
  kind: 'error' | 'warn'
  text: string
}

/** What is wrong (or worth a second look) with one typed size. Blank is fine. */
export function stepIssue(value: string, base: number): StepIssue | null {
  if (value.trim() === '') return null
  const size = Number(value)
  if (!Number.isFinite(size) || size <= 0) {
    return { kind: 'error', text: 'Must be more than 0' }
  }
  if (Number(size.toFixed(MAX_DECIMALS)) !== size) {
    return { kind: 'error', text: `Use ${MAX_DECIMALS} decimals or fewer` }
  }
  // Allowed, but worth a second look: losing streaks then trade LARGER, and
  // the engine still caps a stack at max position size in normal entries.
  if (Number.isFinite(base) && base > 0 && size > base) {
    return { kind: 'warn', text: 'Bigger than the normal size' }
  }
  return null
}

/** True when any row would be refused by the API. */
export function ladderHasErrors(values: readonly string[]): boolean {
  return values.some((v) => stepIssue(v, NaN)?.kind === 'error')
}

/** Same steps at the same sizes (order-independent). */
export function sameLadder(a: readonly AssetLossSize[], b: readonly AssetLossSize[]): boolean {
  if (a.length !== b.length) return false
  const bySteps = new Map(b.map((s) => [s.losses, s.size]))
  return a.every((s) => bySteps.get(s.losses) === s.size)
}

/* ------------------------------------------------------------------ copy -- */

/** A size as the admin typed it: no forced decimals, thousands grouped. */
export function fmtSize(size: number): string {
  return Number.isFinite(size) ? fmtQty(size, 0, 8) : '—'
}

/** "1 loss" / "3 losses". */
export function lossesLabel(n: number): string {
  return `${n} ${n === 1 ? 'loss' : 'losses'}`
}

/** "After 2 losses in a row"; the deepest row reads "After 3+ losses in a row". */
export function stepRowLabel(n: number, deepest: boolean): string {
  return deepest ? `After ${n}+ losses in a row` : `After ${lossesLabel(n)} in a row`
}

/** "2L"; the deepest step reads "3L+". */
export function shortStepLabel(n: number, deepest: boolean): string {
  return `${n}L${deepest ? '+' : ''}`
}

export interface LadderStop {
  /** "Win", "1L", "2L", … "3L+". */
  label: string
  size: number
}

/** The ladder as stops, streak 0 → depth — the source of every summary line. */
export function ladderStops(
  base: number,
  steps: readonly AssetLossSize[],
  depth: number = deepestStep(steps),
): LadderStop[] {
  return resolveLadder(base, steps, depth).map((size, i) => ({
    label: i === 0 ? 'Win' : shortStepLabel(i, i === depth),
    size,
  }))
}

/** "Win 50 → 1L 40 → 2L 40 → 3L+ 25". */
export function ladderSummaryText(base: number, steps: readonly AssetLossSize[]): string {
  return ladderStops(base, steps)
    .map((stop) => `${stop.label} ${fmtSize(stop.size)}`)
    .join(' → ')
}

/** Configured steps only, for the asset card: "1L 40 · 3L+ 25". */
export function ladderShortText(steps: readonly AssetLossSize[]): string {
  const deepest = deepestStep(steps)
  return [...steps]
    .sort((a, b) => a.losses - b.losses)
    .map((s) => `${shortStepLabel(s.losses, s.losses === deepest)} ${fmtSize(s.size)}`)
    .join(' · ')
}

export interface LadderState {
  enabled: boolean
  steps: readonly AssetLossSize[]
}

/** Unsaved edits to one asset's ladder: the switch plus the raw editor rows. */
export interface LossSizingDraft {
  enabled: boolean
  values: string[]
}

/** True when a draft differs from what is saved, as typed (so Reset has something to undo). */
export function draftTouched(saved: LadderState, draft: LossSizingDraft): boolean {
  return (
    draft.enabled !== saved.enabled ||
    draft.values.join('|') !== valuesFromSteps(saved.steps).join('|')
  )
}

/**
 * Before → after, one line per thing that changes — what a confirmation
 * reads back so the admin approves exactly what will be written.
 */
export function describeLadderChanges(before: LadderState, after: LadderState): string[] {
  const lines: string[] = []
  if (before.enabled !== after.enabled) {
    lines.push(after.enabled ? 'Turns streak sizing on' : 'Turns streak sizing off')
  }
  const was = new Map(before.steps.map((s) => [s.losses, s.size]))
  const now = new Map(after.steps.map((s) => [s.losses, s.size]))
  const depth = Math.max(deepestStep(before.steps), deepestStep(after.steps))
  for (let n = 1; n <= depth; n++) {
    const b = was.get(n)
    const a = now.get(n)
    if (b === a) continue
    lines.push(
      `After ${lossesLabel(n)}: ${b === undefined ? 'blank' : fmtSize(b)} → ${
        a === undefined ? 'blank' : fmtSize(a)
      }`,
    )
  }
  return lines
}

/**
 * "41 accounts normal · 3 after 1 loss · 1 at 3+ losses" — the streak
 * buckets, empty ones dropped (the first is always kept so the line never
 * reads as nothing). The last bucket is "depth or more".
 */
export function describeStreakCounts(streaks: AssetLossStreaks): string[] {
  return [...streaks.counts]
    .sort((a, b) => a.streak - b.streak)
    .flatMap(({ streak, accounts }) => {
      if (streak === 0) {
        return [`${accounts} ${accounts === 1 ? 'account' : 'accounts'} normal`]
      }
      if (accounts === 0) return []
      return streak >= streaks.depth
        ? [`${accounts} at ${streak}+ losses`]
        : [`${accounts} after ${lossesLabel(streak)}`]
    })
}
