import { useId, useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import {
  fmtSize,
  ladderStops,
  MAX_LOSS_STEPS,
  resolveLadder,
  scalePreview,
  stepIssue,
  stepRowLabel,
  stepsFromValues,
  type LadderStop,
} from '../../../lib/lossSizing'
import { fmtQty } from '../../../lib/format'

/** Example balances for the scaling preview — 1,000 is the size as typed. */
const PREVIEW_BALANCES = [1000, 3000, 10000] as const

/*
 * Rows are laid out against the EDITOR's width (container query), not the
 * viewport: the same editor sits in a full-width phone card, a half-width
 * desktop card and a 480px modal. Narrow (< @sm, 384px): the label takes its
 * own line and the hint sits beside the input below it. Wide: label + hint
 * stacked on the left, input and remove button centred on the right.
 */
const ROW =
  'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 rounded-row border border-border bg-surface2 py-2 pl-3 pr-2 @sm:gap-x-2.5 @sm:gap-y-0.5'
const ROW_LABEL =
  'col-span-3 row-start-1 block text-[12.5px] font-semibold leading-snug text-text @sm:col-span-1'
const ROW_HINT = 'col-start-1 row-start-2 block text-[11px] leading-snug'
const ROW_SIDE = 'row-start-2 @sm:row-span-2 @sm:row-start-1'
const VALUE_BOX =
  'h-9 w-[76px] flex-none rounded-field px-2.5 text-right font-mono text-[13px] @sm:w-[116px]'
const CAPTION = 'font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint'
const HINT_TONE = { error: 'text-red', warn: 'text-accent', info: 'text-faint' } as const

type Hint = { tone: keyof typeof HINT_TONE; text: string }

/** One ladder row: label, optional hint, the value control and a trailing action slot. */
function StepRow({
  label,
  labelFor,
  hint,
  hintId,
  control,
  action,
}: {
  label: string
  /** Input id — omitted for the read-only Normal row. */
  labelFor?: string
  hint: Hint | null
  hintId?: string
  control: ReactNode
  action?: ReactNode
}) {
  // With no hint the label spans both rows on a wide editor, so it centres
  // against the input instead of riding above it.
  const labelClass = `${ROW_LABEL} ${hint ? '' : '@sm:row-span-2'}`
  return (
    <div className={ROW}>
      {labelFor ? (
        <label htmlFor={labelFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      {hint && (
        <span id={hintId} className={`${ROW_HINT} ${HINT_TONE[hint.tone]}`}>
          {hint.text}
        </span>
      )}
      <div className={`col-start-2 ${ROW_SIDE}`}>{control}</div>
      <div className={`col-start-3 ${ROW_SIDE}`}>
        {action ?? <span className="block w-8" aria-hidden="true" />}
      </div>
    </div>
  )
}

interface LossSizingFieldsProps {
  /** Decides the scaling rule in the preview (BTCUSDT steps in whole sizes). */
  ticker: string
  /** The asset's Base size — NaN while a form has no valid one yet. */
  base: number
  /** One string per step, index i = "after i + 1 losses"; '' = blank. */
  values: string[]
  onChange: (values: string[]) => void
  /** Second line under the read-only Normal row (where Base size is edited). */
  baseNote?: string
  /** Sizing is switched off: dim the editor but keep it editable. */
  muted?: boolean
}

/** One ladder as pills: "Win 50 → 1L 40 → 2L+ 25". */
function Stops({ stops, label }: { stops: LadderStop[]; label: string }) {
  return (
    <ol className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1.5" aria-label={label}>
      {stops.map((stop, i) => (
        <li key={stop.label} className="flex items-center gap-1">
          {i > 0 && (
            <span className="text-[11px] text-faint" aria-hidden="true">
              →
            </span>
          )}
          <span
            className={`inline-flex items-baseline gap-1 rounded-pill border px-2 py-[3px] font-mono text-[11.5px] ${
              i === 0 ? 'border-accent-line bg-accent-soft' : 'border-border bg-surface'
            }`}
          >
            <span className="text-faint">{stop.label}</span>
            <span className="font-semibold text-text">{fmtSize(stop.size)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The loss-streak ladder editor, shared by the Loss-streak sizing tab and the
 * asset form. Controlled: the caller owns the rows (strings, blank allowed)
 * and the Base size they read against.
 *
 * Every row says what it will actually trade — a blank one names the size it
 * carries — and the summary below restates the whole ladder, then the same
 * ladder at an example balance, because "40" only means something once you
 * see it is 80% of the normal size and 120 on a 3,000 USDT account.
 */
export default function LossSizingFields({
  ticker,
  base,
  values,
  onChange,
  baseNote = 'Base size',
  muted = false,
}: LossSizingFieldsProps) {
  const id = useId()
  const [balance, setBalance] = useState<number>(3000)

  const baseOk = Number.isFinite(base) && base > 0
  const depth = values.length
  // A row that fails validation previews as blank rather than as NaN.
  const steps = stepsFromValues(values).filter(
    (s) => stepIssue(values[s.losses - 1], NaN)?.kind !== 'error',
  )
  const resolved = resolveLadder(base, steps, depth)
  const stops = ladderStops(base, steps, depth)
  const scaledStops = stops.map((stop) => ({
    ...stop,
    size: Number.isFinite(stop.size) ? scalePreview(ticker, stop.size, balance) : NaN,
  }))

  const setAt = (index: number, value: string) =>
    onChange(values.map((v, i) => (i === index ? value : v)))
  const addStep = () => {
    if (values.length < MAX_LOSS_STEPS) onChange([...values, ''])
  }
  const removeDeepest = () => onChange(values.slice(0, -1))

  /** The second line under a step: its problem, what a blank carries, or its share of base. */
  const hintFor = (index: number): Hint | null => {
    const value = values[index]
    const issue = stepIssue(value, base)
    if (issue) return { tone: issue.kind, text: issue.text }
    const n = index + 1
    if (value.trim() === '') {
      const carriesStep = steps.some((s) => s.losses < n)
      return {
        tone: 'info',
        text: carriesStep
          ? `same as previous → ${fmtSize(resolved[n])}`
          : `same as base → ${baseOk ? fmtSize(base) : '—'}`,
      }
    }
    if (!baseOk) return null
    return { tone: 'info', text: `${Math.round((Number(value) / base) * 100)}% of the normal size` }
  }

  return (
    <div
      className={`@container flex flex-col gap-3 transition-opacity duration-150 ${
        muted ? 'opacity-60 focus-within:opacity-100 hover:opacity-100' : ''
      }`}
    >
      <div className="flex flex-col gap-2">
        {/* Streak 0 — read-only: it IS the asset's Base size. */}
        <StepRow
          label="Normal (after a win)"
          hint={{ tone: 'info', text: baseNote }}
          control={
            <span
              className={`${VALUE_BOX} inline-flex items-center justify-end border border-dashed border-border text-muted`}
              title="Base size"
            >
              {baseOk ? fmtSize(base) : '—'}
            </span>
          }
        />

        {values.map((value, index) => {
          const n = index + 1
          const deepest = n === depth
          const hint = hintFor(index)
          const inputId = `${id}-step-${n}`
          const hintId = `${id}-hint-${n}`
          const invalid = hint?.tone === 'error'
          return (
            <StepRow
              key={n}
              label={stepRowLabel(n, deepest)}
              labelFor={inputId}
              hint={hint}
              hintId={hintId}
              control={
                <input
                  id={inputId}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className={`${VALUE_BOX} block border bg-surface text-text outline-none placeholder:text-faint focus:border-accent ${
                    invalid ? 'border-red' : 'border-border'
                  }`}
                  value={value}
                  placeholder="blank"
                  onChange={(e) => setAt(index, e.target.value)}
                  aria-invalid={invalid}
                  aria-describedby={hint ? hintId : undefined}
                />
              }
              action={
                deepest ? (
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-btn border border-border bg-surface text-muted transition-colors duration-150 hover:border-red hover:text-red"
                    onClick={removeDeepest}
                    aria-label={`Remove the step for ${n}+ losses`}
                    title="Remove this step"
                  >
                    <X size={14} />
                  </button>
                ) : undefined
              }
            />
          )
        })}
      </div>

      {depth === 0 && (
        <p className="rounded-row border border-dashed border-border px-3.5 py-3 text-[12px] leading-[1.5] text-muted">
          No steps yet, so every entry uses the normal size. Add a step to set
          the size used after the first loss.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-dashed border-border bg-transparent px-3.5 text-[12px] font-semibold text-text transition-colors duration-150 hover:border-accent disabled:cursor-not-allowed disabled:opacity-45"
          onClick={addStep}
          disabled={values.length >= MAX_LOSS_STEPS}
        >
          <Plus size={13} />
          Add step
        </button>
        <span className="text-[11px] text-faint">
          {values.length} of {MAX_LOSS_STEPS} steps
        </span>
      </div>

      {depth > 0 && (
        <div className="flex flex-col gap-3.5 rounded-row border border-hair bg-surface2 p-3.5">
          <div>
            <p className={CAPTION}>
              Size by streak
              <span className="ml-1.5 normal-case tracking-normal">· L = losses in a row</span>
            </p>
            <Stops stops={stops} label="Size by losing streak" />
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
              label={`Size by losing streak at ${fmtQty(balance, 0, 0)} USDT`}
            />
          </div>
        </div>
      )}
    </div>
  )
}
