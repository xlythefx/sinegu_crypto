import type { AssetStreakSize, AssetStreaks, StreakKind } from '../types/admin'
import { fmtQty } from './format'

/**
 * Streak sizing — the client half (no React).
 *
 * An account's CURRENT run on a coin decides its next entry's size: after N
 * losses in a row the deepest LOSS step with a streak ≤ N applies, after N
 * wins in a row the deepest WIN step with a streak ≤ N applies, and with no
 * such step (or no run yet) it is the asset's base size. A win ends a losing
 * run and a loss ends a winning one. The engine applies it; the API
 * (`App\Services\Assets\StreakSizing`) stores it and counts the runs. This
 * file only previews it, so every figure here must match what those two do.
 */

/** Deepest step per kind the API accepts — 1 to 10 losses, 1 to 10 wins. */
export const MAX_STREAK = 10

/** Most steps a ladder can hold: every count once per kind. */
export const MAX_STEPS = MAX_STREAK * 2

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

const KIND_ORDER: Record<StreakKind, number> = { loss: 0, win: 1 }

/**
 * Loss steps first, then win steps, each shallowest first — the order the
 * API returns and every summary reads in. Stable, so ties keep their order.
 */
export function sortSteps<T extends AssetStreakSize>(steps: readonly T[]): T[] {
  return [...steps].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.streak - b.streak,
  )
}

/** Deepest configured step of one kind, or 0 when it has none. */
export function deepestStreak(steps: readonly AssetStreakSize[], kind: StreakKind): number {
  return steps.reduce((max, s) => (s.kind === kind ? Math.max(max, s.streak) : max), 0)
}

/**
 * The step an account on `run` trades with — `run` signed like the API's
 * (−3 = three losses in a row, +2 = two wins, 0 = no run). null = normal size:
 * no run, or a run shorter than the first step of its kind.
 */
export function stepForRun(
  steps: readonly AssetStreakSize[],
  run: number,
): AssetStreakSize | null {
  if (!Number.isFinite(run) || run === 0) return null
  const kind: StreakKind = run < 0 ? 'loss' : 'win'
  const length = Math.abs(run)
  let best: AssetStreakSize | null = null
  for (const s of steps) {
    if (s.kind === kind && s.streak <= length && (!best || s.streak > best.streak)) best = s
  }
  return best
}

/**
 * What one entry of `size` becomes on an account holding `balance` USDT.
 *
 * Mirrors trading-flask `routes/webhook.py::_scale_qty` operation for
 * operation (same float steps, same floor, same 10-dp round), with the
 * reference balance of 1000: below it the size is used as-is; coarse tickers
 * (BTCUSDT) step in whole multiples per 1,000 USDT; everything else scales in
 * tenths of the size, floored. A streak step scales exactly like base size.
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
 * One editor row, exactly as typed. `id` is a stable React key: rows can be
 * removed from the middle and re-sorted, so neither the index nor the
 * (kind, count) pair — which the admin is editing — can serve.
 */
export interface StreakRow {
  id: number
  kind: StreakKind
  /** The count as typed; valid once it is a whole number 1–10. */
  streak: string
  /** The size as typed; blank = this row is not saved. */
  size: string
}

let rowSeq = 0

export function newRow(kind: StreakKind, streak: number | string, size = ''): StreakRow {
  rowSeq += 1
  return { id: rowSeq, kind, streak: String(streak), size }
}

/** Editor rows from a saved ladder, in display order. */
export function rowsFromSteps(steps: readonly AssetStreakSize[]): StreakRow[] {
  return sortSteps(steps).map((s) => newRow(s.kind, s.streak, String(s.size)))
}

/** A typed count as a step count, or null when it is not a whole number 1–10. */
export function parseStreak(value: string): number | null {
  const text = value.trim()
  if (!/^\d+$/.test(text)) return null
  const n = Number(text)
  return n >= 1 && n <= MAX_STREAK ? n : null
}

/**
 * Display order: loss rows by count, then win rows by count. A row whose
 * count is not valid yet sinks to the end of its kind; ties keep their order.
 * Applied when focus LEAVES a row (and on add), never per keystroke — a row
 * that jumped while its count was being typed would take the caret with it.
 */
export function sortRows(rows: readonly StreakRow[]): StreakRow[] {
  const rank = (row: StreakRow) => parseStreak(row.streak) ?? Number.POSITIVE_INFINITY
  return [...rows].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || rank(a) - rank(b),
  )
}

/** True when two row lists hold the same rows in the same order. */
export function sameOrder(a: readonly StreakRow[], b: readonly StreakRow[]): boolean {
  return a.length === b.length && a.every((row, i) => row.id === b[i].id)
}

/** The counts of one kind already taken by rows with a valid count. */
function usedCounts(rows: readonly StreakRow[], kind: StreakKind): Set<number> {
  const used = new Set<number>()
  for (const row of rows) {
    const n = row.kind === kind ? parseStreak(row.streak) : null
    if (n !== null) used.add(n)
  }
  return used
}

/** Next free count of a kind: one past the deepest, else the first gap; null when all 10 are taken. */
function nextFreeCount(rows: readonly StreakRow[], kind: StreakKind): number | null {
  const used = usedCounts(rows, kind)
  const deepest = Math.max(0, ...used)
  if (deepest < MAX_STREAK) return deepest + 1
  for (let n = 1; n <= MAX_STREAK; n++) if (!used.has(n)) return n
  return null
}

/**
 * The row "+ Add step" appends: a loss step at the next free loss count, or
 * — once all ten loss counts are taken — a win step. null when the ladder is full.
 */
export function nextRow(rows: readonly StreakRow[]): StreakRow | null {
  if (rows.length >= MAX_STEPS) return null
  const loss = nextFreeCount(rows, 'loss')
  if (loss !== null) return newRow('loss', loss)
  const win = nextFreeCount(rows, 'win')
  return win === null ? null : newRow('win', win)
}

/** What a row would save, and what is wrong with it. */
export interface RowCheck {
  /** The count's problem — blocks saving. */
  countError: string | null
  /** The size's problem — blocks saving. */
  sizeError: string | null
  /** Worth a second look, never blocks. */
  warn: string | null
  /** The step this row saves; null when the size is blank or anything is wrong. */
  step: AssetStreakSize | null
}

/** What is wrong with one typed size. Blank is fine (the row is just not saved). */
function sizeError(value: string): string | null {
  if (value.trim() === '') return null
  const size = Number(value)
  if (!Number.isFinite(size) || size <= 0) return 'Size must be more than 0'
  if (Number(size.toFixed(MAX_DECIMALS)) !== size) return `Use ${MAX_DECIMALS} decimals or fewer`
  return null
}

/**
 * Every row checked against the others and against base size. A count that
 * repeats within its kind is flagged on the LATER row, so the step already
 * standing keeps reading as fine. Pass base = NaN to skip the size advice.
 */
export function checkRows(rows: readonly StreakRow[], base: number): RowCheck[] {
  const seen: Record<StreakKind, Set<number>> = { loss: new Set(), win: new Set() }
  const baseOk = Number.isFinite(base) && base > 0
  return rows.map((row) => {
    const n = parseStreak(row.streak)
    let countError: string | null = null
    if (n === null) {
      countError =
        row.streak.trim() === ''
          ? `Type how many in a row (1–${MAX_STREAK})`
          : `Use a whole number from 1 to ${MAX_STREAK}`
    } else if (seen[row.kind].has(n)) {
      countError = `Already used for ${row.kind === 'loss' ? 'losses' : 'wins'}`
    } else {
      seen[row.kind].add(n)
    }

    const sizeProblem = sizeError(row.size)
    const blank = row.size.trim() === ''
    const size = Number(row.size)
    let warn: string | null = null
    // Allowed, but worth a second look: a losing run then trades LARGER, or a
    // winning run trades SMALLER — usually a typo in the kind or the size.
    if (!sizeProblem && !blank && baseOk) {
      if (row.kind === 'loss' && size > base) warn = 'Bigger than the normal size'
      if (row.kind === 'win' && size < base) warn = 'Smaller than the normal size'
    }

    const step =
      countError || sizeProblem || blank || n === null ? null : { kind: row.kind, streak: n, size }
    return { countError, sizeError: sizeProblem, warn, step }
  })
}

/** True when any row would be refused by the API. */
export function ladderHasErrors(rows: readonly StreakRow[]): boolean {
  return checkRows(rows, NaN).some((c) => c.countError !== null || c.sizeError !== null)
}

/**
 * The ladder a set of editor rows saves: valid rows with a size, sorted.
 * Fix `ladderHasErrors` first — a refused row is simply left out here.
 */
export function stepsFromRows(rows: readonly StreakRow[]): AssetStreakSize[] {
  return sortSteps(checkRows(rows, NaN).flatMap((c) => (c.step ? [c.step] : [])))
}

const stepKey = (s: { kind: StreakKind; streak: number }) => `${s.kind}:${s.streak}`

/** Same steps at the same sizes (order-independent). */
export function sameLadder(
  a: readonly AssetStreakSize[],
  b: readonly AssetStreakSize[],
): boolean {
  if (a.length !== b.length) return false
  const byKey = new Map(b.map((s) => [stepKey(s), s.size]))
  return a.every((s) => byKey.get(stepKey(s)) === s.size)
}

/* ------------------------------------------------------------------ copy -- */

/** A size as the admin typed it: no forced decimals, thousands grouped. */
export function fmtSize(size: number): string {
  return Number.isFinite(size) ? fmtQty(size, 0, 8) : '—'
}

/** "1 loss" / "3 losses" / "1 win" / "2 wins". */
export function runLabel(kind: StreakKind, n: number): string {
  const word = kind === 'loss' ? (n === 1 ? 'loss' : 'losses') : n === 1 ? 'win' : 'wins'
  return `${n} ${word}`
}

/** The plural noun of a kind: "losses" / "wins". */
export function kindPlural(kind: StreakKind): string {
  return kind === 'loss' ? 'losses' : 'wins'
}

/** "after 2 losses in a row"; the deepest step reads "after 5 or more losses in a row". */
export function stepPhrase(kind: StreakKind, n: number, deepest: boolean): string {
  return deepest
    ? `after ${n} or more ${kindPlural(kind)} in a row`
    : `after ${runLabel(kind, n)} in a row`
}

/** "2L" / "3W"; the deepest step of its kind reads "5L+" / "3W+". */
export function shortStepLabel(step: { kind: StreakKind; streak: number }, deepest: boolean): string {
  return `${step.streak}${step.kind === 'loss' ? 'L' : 'W'}${deepest ? '+' : ''}`
}

export interface LadderStop {
  key: string
  /** "5L+", "2L", "Normal", "3W+". */
  label: string
  /** The label spelled out: "After 5 or more losses in a row", "Normal size". */
  title: string
  size: number
  tone: StreakKind | 'normal'
}

/**
 * The ladder as stops, deepest loss → Normal → deepest win — the source of
 * every summary line. Only configured steps and Normal are listed: a gap
 * carries the step below it, so it adds no information.
 */
export function ladderStops(base: number, steps: readonly AssetStreakSize[]): LadderStop[] {
  const deepLoss = deepestStreak(steps, 'loss')
  const deepWin = deepestStreak(steps, 'win')
  const toStop = (s: AssetStreakSize): LadderStop => {
    const deepest = s.streak === (s.kind === 'loss' ? deepLoss : deepWin)
    const phrase = stepPhrase(s.kind, s.streak, deepest)
    return {
      key: stepKey(s),
      label: shortStepLabel(s, deepest),
      title: phrase[0].toUpperCase() + phrase.slice(1),
      size: s.size,
      tone: s.kind,
    }
  }
  const sorted = sortSteps(steps)
  const losses = sorted.filter((s) => s.kind === 'loss').reverse().map(toStop)
  const wins = sorted.filter((s) => s.kind === 'win').map(toStop)
  const normal: LadderStop = {
    key: 'normal',
    label: 'Normal',
    title: 'Normal size',
    size: base,
    tone: 'normal',
  }
  return [...losses, normal, ...wins]
}

/** "←" pointing out to the losses, "→" out to the wins — the separator before `stops[i]`. */
export function stopArrow(stops: readonly LadderStop[], i: number): '←' | '→' {
  const normal = stops.findIndex((s) => s.tone === 'normal')
  return i <= normal ? '←' : '→'
}

/** "5L+ 2 ← 2L 3 ← Normal 5 → 3W+ 7". */
export function ladderSummaryText(base: number, steps: readonly AssetStreakSize[]): string {
  const stops = ladderStops(base, steps)
  return stops
    .map((stop, i) => `${i > 0 ? `${stopArrow(stops, i)} ` : ''}${stop.label} ${fmtSize(stop.size)}`)
    .join(' ')
}

/** Configured steps only, for the asset card: "2L 3 · 5L+ 2 · 3W+ 7". */
export function ladderShortText(steps: readonly AssetStreakSize[]): string {
  const deepLoss = deepestStreak(steps, 'loss')
  const deepWin = deepestStreak(steps, 'win')
  return sortSteps(steps)
    .map(
      (s) =>
        `${shortStepLabel(s, s.streak === (s.kind === 'loss' ? deepLoss : deepWin))} ${fmtSize(s.size)}`,
    )
    .join(' · ')
}

export interface LadderState {
  enabled: boolean
  steps: readonly AssetStreakSize[]
}

/** Unsaved edits to one asset's ladder: the switch plus the raw editor rows. */
export interface StreakSizingDraft {
  enabled: boolean
  rows: StreakRow[]
}

const rowsText = (rows: readonly StreakRow[]) =>
  rows.map((r) => `${r.kind}:${r.streak.trim()}:${r.size.trim()}`).join('|')

/** True when a draft differs from what is saved, as typed (so Reset has something to undo). */
export function draftTouched(saved: LadderState, draft: StreakSizingDraft): boolean {
  return (
    draft.enabled !== saved.enabled ||
    rowsText(draft.rows) !== rowsText(rowsFromSteps(saved.steps))
  )
}

/**
 * Before → after, one line per thing that changes — what a confirmation
 * reads back so the admin approves exactly what will be written:
 * "Loss 2 → 3 (was 4)", "Win 3 → 7 (new)", "Loss 5 removed".
 */
export function describeLadderChanges(before: LadderState, after: LadderState): string[] {
  const lines: string[] = []
  if (before.enabled !== after.enabled) {
    lines.push(after.enabled ? 'Turns streak sizing on' : 'Turns streak sizing off')
  }
  const was = new Map(before.steps.map((s) => [stepKey(s), s]))
  const now = new Map(after.steps.map((s) => [stepKey(s), s]))
  const keys = new Set([...was.keys(), ...now.keys()])
  const all = sortSteps([...keys].map((k) => (now.get(k) ?? was.get(k)) as AssetStreakSize))
  for (const step of all) {
    const b = was.get(stepKey(step))
    const a = now.get(stepKey(step))
    const name = `${step.kind === 'loss' ? 'Loss' : 'Win'} ${step.streak}`
    if (b && a && b.size === a.size) continue
    if (b && !a) lines.push(`${name} removed`)
    else if (a && !b) lines.push(`${name} → ${fmtSize(a.size)} (new)`)
    else if (a && b) lines.push(`${name} → ${fmtSize(a.size)} (was ${fmtSize(b.size)})`)
  }
  return lines
}

/**
 * The runs one step covers, as the "Right now" line names them: "after 2
 * losses", "after 2–4 losses" (up to the next step of its kind), or "after
 * 5+ losses" for the deepest.
 */
function stepRangeLabel(step: AssetStreakSize, steps: readonly AssetStreakSize[]): string {
  const next = steps
    .filter((s) => s.kind === step.kind && s.streak > step.streak)
    .reduce<number | null>((min, s) => (min === null ? s.streak : Math.min(min, s.streak)), null)
  if (next === null) return `after ${step.streak}+ ${kindPlural(step.kind)}`
  if (next - 1 === step.streak) return `after ${runLabel(step.kind, step.streak)}`
  return `after ${step.streak}–${next - 1} ${kindPlural(step.kind)}`
}

/** Prefix the first bucket with its noun: "3 accounts normal · 4 after 2+ losses". */
function withNoun(parts: { accounts: number; label: string }[]): string[] {
  return parts.map(({ accounts, label }, i) =>
    i === 0 ? `${accounts} ${accounts === 1 ? 'account' : 'accounts'} ${label}` : `${accounts} ${label}`,
  )
}

/**
 * Where the accounts sit right now, against a ladder: "3 accounts normal ·
 * 4 after 2+ losses · 1 after 3+ wins". A run of 0, or one shorter than the
 * first step of its kind, is normal. With no steps the raw runs are listed
 * instead ("2 after 1 loss · 1 after 10+ losses"), since that is what an
 * admin choosing the first step needs to see. |run| === depth reads "+".
 */
export function describeRuns(streaks: AssetStreaks, steps: readonly AssetStreakSize[]): string[] {
  const runs = [...streaks.runs].filter((r) => r.accounts > 0).sort((a, b) => a.run - b.run)

  if (steps.length === 0) {
    // Losses deepest-first would read backwards here; list normal, then each
    // kind shortest run first.
    const ordered = [
      ...runs.filter((r) => r.run === 0),
      ...runs.filter((r) => r.run < 0).reverse(),
      ...runs.filter((r) => r.run > 0),
    ]
    return withNoun(
      ordered.map(({ run, accounts }) => {
        if (run === 0) return { accounts, label: 'with no streak' }
        const kind: StreakKind = run < 0 ? 'loss' : 'win'
        const n = Math.abs(run)
        return {
          accounts,
          label: n >= streaks.depth ? `after ${n}+ ${kindPlural(kind)}` : `after ${runLabel(kind, n)}`,
        }
      }),
    )
  }

  const buckets = new Map<string, number>()
  for (const { run, accounts } of runs) {
    const step = stepForRun(steps, run)
    const key = step ? stepKey(step) : 'normal'
    buckets.set(key, (buckets.get(key) ?? 0) + accounts)
  }
  const parts: { accounts: number; label: string }[] = []
  const normal = buckets.get('normal')
  if (normal) parts.push({ accounts: normal, label: 'normal' })
  for (const step of sortSteps(steps)) {
    const accounts = buckets.get(stepKey(step))
    if (accounts) parts.push({ accounts, label: stepRangeLabel(step, steps) })
  }
  return withNoun(parts)
}
