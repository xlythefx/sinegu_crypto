import { useEffect, useId, useState, type FocusEvent } from 'react'
import { Plus, X } from 'lucide-react'
import {
  checkRows,
  deepestStreak,
  fmtSize,
  kindPlural,
  ladderStops,
  MAX_STREAK,
  nextRow,
  parseStreak,
  sameOrder,
  scalePreview,
  sortRows,
  sortSteps,
  stepPhrase,
  stopArrow,
  type LadderStop,
  type RowCheck,
  type StreakRow,
} from '../../../lib/streakSizing'
import { fmtQty } from '../../../lib/format'
import type { StreakKind } from '../../../types/admin'

/** Example balances for the scaling preview — 1,000 is the size as typed. */
const PREVIEW_BALANCES = [1000, 3000, 10000] as const

/*
 * Rows are laid out against the EDITOR's width (container query), not the
 * viewport: the same editor sits in a full-width phone card, a half-width
 * desktop card and a 480px modal.
 *   Narrow (< @lg, 512px): Loss|Win + "After [n] losses in a row" on the
 *   first line; the hint, the size and × on the second.
 *   Wide: Loss|Win, the sentence with its hint below it, then the size and ×
 *   centred on the right.
 * Four columns either way: selector · text · size · action.
 */
const ROW =
  'grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-2 rounded-row border border-border bg-surface2 py-2 pl-2.5 pr-2 @lg:gap-x-2.5 @lg:gap-y-1'
const STEP_SENTENCE =
  'col-span-3 col-start-2 row-start-1 block text-[12.5px] font-semibold leading-snug text-text @lg:col-span-1'
const STEP_HINT =
  'col-span-2 col-start-1 row-start-2 block text-[11px] leading-snug @lg:col-span-1 @lg:col-start-2'
const NORMAL_LABEL =
  'col-span-4 col-start-1 row-start-1 block text-[12.5px] font-semibold leading-snug text-text @lg:col-span-2'
const NORMAL_HINT = 'col-span-2 col-start-1 row-start-2 block text-[11px] leading-snug'
const ROW_SIDE = 'row-start-2 @lg:row-span-2 @lg:row-start-1'
const VALUE_BOX =
  'h-9 w-[76px] flex-none rounded-field px-2.5 text-right font-mono text-[13px] @lg:w-[100px]'
const COUNT_BOX =
  'mx-1 inline-block h-8 w-12 rounded-field border bg-surface px-1 text-center align-middle font-mono text-[13px] font-semibold text-text outline-none focus:border-accent'
const CAPTION = 'font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint'
const HINT_TONE = { error: 'text-red', warn: 'text-accent', info: 'text-faint' } as const
const REMOVE_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-btn border border-border bg-surface text-muted transition-colors duration-150 hover:border-red hover:text-red'

/** The selected half of the Loss | Win switch — red for losses, green for wins. */
const KIND_ON: Record<StreakKind, string> = {
  loss: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red',
  win: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
}
const STOP_TONE: Record<LadderStop['tone'], string> = {
  loss: 'text-red',
  win: 'text-green',
  normal: 'text-faint',
}

type Hint = { tone: keyof typeof HINT_TONE; text: string }

/** Loss | Win — which kind of run this step answers. */
function KindSwitch({
  kind,
  onChange,
  label,
}: {
  kind: StreakKind
  onChange: (kind: StreakKind) => void
  label: string
}) {
  return (
    <div
      className="inline-flex rounded-pill border border-border bg-surface p-0.5"
      role="radiogroup"
      aria-label={label}
    >
      {(['loss', 'win'] as const).map((k) => {
        const on = k === kind
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            className={`min-h-[28px] rounded-pill px-2.5 text-[11.5px] font-bold transition-colors duration-150 ${
              on ? KIND_ON[k] : 'text-muted hover:text-text'
            }`}
            onClick={() => {
              if (!on) onChange(k)
            }}
          >
            {k === 'loss' ? 'Loss' : 'Win'}
          </button>
        )
      })}
    </div>
  )
}

/** One ladder as pills: "5L+ 2 ← 2L 3 ← Normal 5 → 3W+ 7". */
function Stops({ stops, label }: { stops: LadderStop[]; label: string }) {
  return (
    <ol className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1.5" aria-label={label}>
      {stops.map((stop, i) => (
        <li key={stop.key} className="flex items-center gap-1">
          {i > 0 && (
            <span className="text-[11px] text-faint" aria-hidden="true">
              {stopArrow(stops, i)}
            </span>
          )}
          <span
            className={`inline-flex items-baseline gap-1 rounded-pill border px-2 py-[3px] font-mono text-[11.5px] ${
              stop.tone === 'normal' ? 'border-accent-line bg-accent-soft' : 'border-border bg-surface'
            }`}
            title={stop.title}
          >
            <span className={STOP_TONE[stop.tone]} aria-hidden="true">
              {stop.label}
            </span>
            <span className="sr-only">{stop.title}:</span>
            <span className="font-semibold text-text">{fmtSize(stop.size)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** The second line under a step: its problem, its advice, or its share of base. */
function hintFor(row: StreakRow, check: RowCheck, base: number): Hint | null {
  if (check.countError) return { tone: 'error', text: check.countError }
  if (check.sizeError) return { tone: 'error', text: check.sizeError }
  if (check.warn) return { tone: 'warn', text: check.warn }
  if (row.size.trim() === '') return { tone: 'info', text: 'No size yet: this step is not saved' }
  if (!(Number.isFinite(base) && base > 0)) return null
  return {
    tone: 'info',
    text: `${Math.round((Number(row.size) / base) * 100)}% of the normal size`,
  }
}

interface StreakSizingFieldsProps {
  /** Decides the scaling rule in the preview (BTCUSDT steps in whole sizes). */
  ticker: string
  /** The asset's Base size — NaN while a form has no valid one yet. */
  base: number
  /** The rows as typed, in the order shown. */
  rows: StreakRow[]
  onChange: (rows: StreakRow[]) => void
  /** Second line under the read-only Normal row (where Base size is edited). */
  baseNote?: string
  /** Sizing is switched off: dim the editor but keep it editable. */
  muted?: boolean
}

/**
 * The streak ladder editor, shared by the Streak Sizing Settings tab and the
 * asset form. Controlled: the caller owns the rows (strings as typed) and the
 * Base size they read against.
 *
 * Every row says what it will actually trade — its share of the normal size,
 * or why it will not be saved — and the summary below restates the whole
 * ladder in both directions, then the same ladder at an example balance,
 * because "3" only means something once you see it is 60% of the normal size
 * and 9 on a 3,000 USDT account.
 *
 * Rows are put in order (losses, then wins, each by count) only when focus
 * leaves the editor or a step is added — never while a count is being typed,
 * which would move the row out from under the caret.
 */
export default function StreakSizingFields({
  ticker,
  base,
  rows,
  onChange,
  baseNote = 'Base size, edited on the Assets tab',
  muted = false,
}: StreakSizingFieldsProps) {
  const id = useId()
  const [balance, setBalance] = useState<number>(3000)
  // The row just added: its size box takes focus once it is on screen.
  const [focusRow, setFocusRow] = useState<number | null>(null)

  useEffect(() => {
    if (focusRow === null) return
    document.getElementById(`${id}-size-${focusRow}`)?.focus()
    setFocusRow(null)
  }, [focusRow, id])

  const baseOk = Number.isFinite(base) && base > 0
  const checks = checkRows(rows, base)
  // Rows that fail validation (or have no size) preview as absent, not as NaN.
  const steps = sortSteps(checks.flatMap((c) => (c.step ? [c.step] : [])))
  const deepest: Record<StreakKind, number> = {
    loss: deepestStreak(steps, 'loss'),
    win: deepestStreak(steps, 'win'),
  }
  const stops = ladderStops(base, steps)
  const scaledStops = stops.map((stop) => ({
    ...stop,
    size: Number.isFinite(stop.size) ? scalePreview(ticker, stop.size, balance) : NaN,
  }))
  const lossRows = rows.filter((r) => r.kind === 'loss').length
  const winRows = rows.length - lossRows
  const next = nextRow(rows)

  const setRow = (rowId: number, patch: Partial<StreakRow>) =>
    onChange(rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  const removeRow = (rowId: number) => onChange(rows.filter((r) => r.id !== rowId))
  const addRow = () => {
    if (!next) return
    onChange(sortRows([...rows, next]))
    setFocusRow(next.id)
  }
  // Focus left the editor altogether: nothing in it is being typed, so the
  // rows can take their display order without moving anything under a caret.
  const settle = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    const sorted = sortRows(rows)
    if (!sameOrder(sorted, rows)) onChange(sorted)
  }

  return (
    <div
      className={`@container flex flex-col gap-3 transition-opacity duration-150 ${
        muted ? 'opacity-60 focus-within:opacity-100 hover:opacity-100' : ''
      }`}
      onBlur={settle}
    >
      <div className="flex flex-col gap-2">
        {/* No run, or a run shorter than any step — read-only: it IS the asset's Base size. */}
        <div className={ROW}>
          <span className={NORMAL_LABEL}>Normal (no streak step)</span>
          <span className={`${NORMAL_HINT} text-faint`}>{baseNote}</span>
          <div className={`col-start-3 ${ROW_SIDE}`}>
            <span
              className={`${VALUE_BOX} inline-flex items-center justify-end border border-dashed border-border text-muted`}
              title="Base size"
            >
              {baseOk ? fmtSize(base) : '—'}
            </span>
          </div>
          <span className={`col-start-4 block w-8 ${ROW_SIDE}`} aria-hidden="true" />
        </div>

        {rows.map((row, index) => {
          const check = checks[index]
          const count = parseStreak(row.streak)
          const isDeepest = check.step !== null && check.step.streak === deepest[row.kind]
          const hint = hintFor(row, check, base)
          const hintId = `${id}-hint-${row.id}`
          const countInvalid = check.countError !== null
          const sizeInvalid = check.sizeError !== null
          const phrase =
            count === null
              ? `in this ${row.kind} step`
              : stepPhrase(row.kind, count, isDeepest)
          return (
            <div key={row.id} className={ROW}>
              <div className="col-start-1 row-start-1">
                <KindSwitch
                  kind={row.kind}
                  onChange={(kind) => setRow(row.id, { kind })}
                  label="Step counts losses or wins in a row"
                />
              </div>

              <label className={STEP_SENTENCE}>
                After
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_STREAK}
                  step={1}
                  className={`${COUNT_BOX} ${countInvalid ? 'border-red' : 'border-border'}`}
                  value={row.streak}
                  onChange={(e) => setRow(row.id, { streak: e.target.value })}
                  aria-invalid={countInvalid}
                  aria-describedby={hint ? hintId : undefined}
                />
                {isDeepest
                  ? `or more ${kindPlural(row.kind)}`
                  : count === 1
                    ? row.kind
                    : kindPlural(row.kind)}{' '}
                in a row
              </label>

              {hint && (
                <span id={hintId} className={`${STEP_HINT} ${HINT_TONE[hint.tone]}`}>
                  {hint.text}
                </span>
              )}

              <div className={`col-start-3 ${ROW_SIDE}`}>
                <input
                  id={`${id}-size-${row.id}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className={`${VALUE_BOX} block border bg-surface text-text outline-none placeholder:text-faint focus:border-accent ${
                    sizeInvalid ? 'border-red' : 'border-border'
                  }`}
                  value={row.size}
                  placeholder="size"
                  onChange={(e) => setRow(row.id, { size: e.target.value })}
                  aria-label={`Size ${phrase}`}
                  aria-invalid={sizeInvalid}
                  aria-describedby={hint ? hintId : undefined}
                />
              </div>

              <div className={`col-start-4 ${ROW_SIDE}`}>
                <button
                  type="button"
                  className={REMOVE_BTN}
                  onClick={() => removeRow(row.id)}
                  aria-label={`Remove the step ${phrase}`}
                  title="Remove this step"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {rows.length === 0 && (
        <p className="rounded-row border border-dashed border-border px-3.5 py-3 text-[12px] leading-[1.5] text-muted">
          No steps yet, so every entry uses the normal size. Add a step to set
          the size used after losses (or wins) in a row.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-dashed border-border bg-transparent px-3.5 text-[12px] font-semibold text-text transition-colors duration-150 hover:border-accent disabled:cursor-not-allowed disabled:opacity-45"
          onClick={addRow}
          disabled={!next}
        >
          <Plus size={13} />
          Add step
        </button>
        <span className="text-[11px] text-faint">
          {lossRows} loss · {winRows} win · up to {MAX_STREAK} each
        </span>
      </div>

      {steps.length > 0 && (
        <div className="flex flex-col gap-3.5 rounded-row border border-hair bg-surface2 p-3.5">
          <div>
            <p className={CAPTION}>
              Size by streak
              <span className="ml-1.5 normal-case tracking-normal">
                · L = losses in a row, W = wins in a row
              </span>
            </p>
            <Stops stops={stops} label="Size by streak" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className={CAPTION}>On an account with</span>
              <div
                className="inline-flex rounded-pill border border-border bg-surface p-0.5"
                role="radiogroup"
                aria-label="Example balance"
              >
                {PREVIEW_BALANCES.map((b) => {
                  const on = b === balance
                  return (
                    <button
                      key={b}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`min-h-[26px] rounded-pill px-2.5 font-mono text-[11px] font-semibold transition-colors duration-150 ${
                        on ? 'bg-accent text-on-accent' : 'text-muted hover:text-text'
                      }`}
                      onClick={() => setBalance(b)}
                    >
                      {fmtQty(b, 0, 0)}
                    </button>
                  )
                })}
              </div>
              <span className={CAPTION}>USDT</span>
            </div>
            <Stops
              stops={scaledStops}
              label={`Size by streak at ${fmtQty(balance, 0, 0)} USDT`}
            />
          </div>
        </div>
      )}
    </div>
  )
}
