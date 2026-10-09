import { useState } from 'react'
import { AlertTriangle, WandSparkles } from 'lucide-react'
import HelperModal, {
  HELPER_BTN_PRIMARY,
  HELPER_BTN_SECONDARY,
  HELPER_INPUT,
  HelperField,
  HelperNote,
  Segmented,
} from './HelperModal'
import {
  buildStreakSteps,
  defaultDirection,
  fmtSize,
  kindPlural,
  MAX_STREAK,
  parseStreak,
  stepPhrase,
  type SizeChangeMode,
  type SizeDirection,
} from '../../../lib/streakSizing'
import type { AssetStreakSize, StreakKind } from '../../../types/admin'

const COUNT_INPUT = `${HELPER_INPUT} w-[64px] text-center`

interface BuildStepsModalProps {
  /** The normal (Base) size — NaN while the asset form has no valid one. */
  base: number
  /** Rows of each kind already in the editor: what "Add these steps" replaces. */
  existing: Record<StreakKind, number>
  /** Replace every step of `kind` with these. */
  onApply: (kind: StreakKind, steps: AssetStreakSize[]) => void
  onClose: () => void
}

/** Why the generated list ends, in a sentence. */
function endNote(end: 'until' | 'zero' | 'limit', kind: StreakKind, until: number | null): string {
  if (end === 'until' && until !== null) return `It stops at ${fmtSize(until)}, the size you asked for.`
  if (end === 'zero') return 'It stops there: the next step would be 0 or less.'
  return `It stops at ${MAX_STREAK} ${kindPlural(kind)} in a row, the deepest step there can be.`
}

/**
 * "Build steps for me" — next to "+ Add step". The admin describes the whole
 * ladder the way they think about it ("every 2 losses, decrease by 0.25
 * until 0.5") and sees the steps it makes before adding them. The maths is
 * `buildStreakSteps` (lib/streakSizing.ts); this only collects the inputs
 * and shows its answer.
 *
 * Adding REPLACES every step of that kind (the other kind is left alone),
 * because a generated ladder mixed with old steps is two rules at once.
 */
export default function BuildStepsModal({ base, existing, onApply, onClose }: BuildStepsModalProps) {
  const [kind, setKind] = useState<StreakKind>('loss')
  const [every, setEvery] = useState('2')
  const [direction, setDirection] = useState<SizeDirection>(defaultDirection('loss'))
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<SizeChangeMode>('amount')
  const [of, setOf] = useState<'previous' | 'normal'>('previous')
  const [until, setUntil] = useState('')

  const baseOk = Number.isFinite(base) && base > 0
  const typedValue = value.trim()
  const typedUntil = until.trim()
  const result = buildStreakSteps({
    kind,
    every: parseStreak(every) ?? NaN,
    direction,
    mode,
    value: typedValue === '' ? NaN : Number(typedValue),
    of,
    until: typedUntil === '' ? null : Number(typedUntil),
    base,
  })
  const untilNum = typedUntil === '' ? null : Number(typedUntil)

  // An empty "by" box is a prompt, not a mistake.
  const waiting = typedValue === '' && baseOk
  const problem =
    waiting
      ? null
      : (result.error ??
        (result.steps.length === 0
          ? 'The first step would already be 0 or less. Try a smaller change.'
          : null))
  const ready = !waiting && problem === null && result.steps.length > 0
  const replacing = existing[kind]
  const deepest = result.steps.length > 0 ? result.steps[result.steps.length - 1].streak : 0

  const changeKind = (next: StreakKind) => {
    setKind(next)
    // Smaller after losses, bigger after wins — the usual intent, still changeable.
    setDirection(defaultDirection(next))
  }

  const apply = () => {
    if (ready) onApply(kind, result.steps)
  }

  const pct = typedValue === '' ? 'X' : typedValue
  const ofHint =
    of === 'previous'
      ? `Each step is ${pct}% ${direction === 'decrease' ? 'smaller' : 'bigger'} than the one before it.`
      : `Each step ${direction === 'decrease' ? 'takes another' : 'adds another'} ${pct}% of the normal size.`

  return (
    <HelperModal
      title="Build steps for me"
      subtitle="Describe the pattern and the steps are worked out for you. Check them before adding."
      icon={<WandSparkles size={17} aria-hidden="true" />}
      onClose={onClose}
      onEnter={apply}
      footer={
        <>
          <button type="button" className={HELPER_BTN_SECONDARY} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={HELPER_BTN_PRIMARY} onClick={apply} disabled={!ready}>
            Add these steps
          </button>
        </>
      }
    >
      <p className="flex items-center justify-between gap-3 rounded-row border border-border bg-surface2 px-3.5 py-2.5 text-[12.5px] font-semibold text-muted">
        Starts from the normal size
        <span className="font-mono text-[13px] font-bold text-text">
          {baseOk ? fmtSize(base) : 'not set yet'}
        </span>
      </p>

      <HelperField label="Every">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_STREAK}
          step={1}
          className={`${COUNT_INPUT} ${parseStreak(every) === null ? 'border-red' : 'border-border'}`}
          value={every}
          onChange={(e) => setEvery(e.target.value)}
          aria-label="A new step every this many in a row"
          autoFocus
        />
        <Segmented
          value={kind}
          onChange={changeKind}
          label="Count losses or wins in a row"
          options={[
            { value: 'loss', label: 'Losses', tone: 'loss' },
            { value: 'win', label: 'Wins', tone: 'win' },
          ]}
        />
      </HelperField>

      <HelperField label="Change">
        <Segmented
          value={direction}
          onChange={setDirection}
          label="Make the size smaller or bigger"
          options={[
            { value: 'decrease', label: 'Decrease' },
            { value: 'increase', label: 'Increase' },
          ]}
        />
      </HelperField>

      <HelperField label="By">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          className={`${HELPER_INPUT} w-[112px] border-border`}
          value={value}
          placeholder={mode === 'amount' ? 'e.g. 0.25' : 'e.g. 25'}
          onChange={(e) => setValue(e.target.value)}
          aria-label={mode === 'amount' ? 'Change each step by this amount' : 'Change each step by this percent'}
        />
        <Segmented
          value={mode}
          onChange={setMode}
          label="An amount or a percent"
          options={[
            { value: 'amount', label: 'Amount' },
            { value: 'percent', label: '%' },
          ]}
        />
      </HelperField>

      {/* An amount gives the same steps from either starting point, so the
          choice only exists for a percent. */}
      {mode === 'percent' && (
        <HelperField label="Of the" hint={ofHint}>
          <Segmented
            value={of}
            onChange={setOf}
            label="Percent of the previous step or of the normal size"
            options={[
              { value: 'previous', label: 'Previous step' },
              { value: 'normal', label: 'Normal size' },
            ]}
          />
        </HelperField>
      )}

      <HelperField label="Until it reaches">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          className={`${HELPER_INPUT} w-[112px] border-border`}
          value={until}
          placeholder="no limit"
          onChange={(e) => setUntil(e.target.value)}
          aria-label="Stop when the size reaches this (optional)"
        />
        <span className="text-[11.5px] text-faint">optional</span>
      </HelperField>

      <div className="flex flex-col gap-2" aria-live="polite">
        <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint">
          Steps it will add
        </p>
        {ready ? (
          <>
            <ol className="overflow-hidden rounded-row border border-border">
              {result.steps.map((step, i) => {
                const phrase = stepPhrase(kind, step.streak, step.streak === deepest)
                return (
                  <li
                    key={step.streak}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${
                      i > 0 ? 'border-t border-hair' : ''
                    }`}
                  >
                    <span className="min-w-0 text-[12.5px] font-semibold text-text">
                      {phrase[0].toUpperCase() + phrase.slice(1)}
                    </span>
                    <span className="flex flex-none items-baseline gap-2">
                      <span className="text-[11px] text-faint">
                        {Math.round((step.size / base) * 100)}%
                      </span>
                      <span className="font-mono text-[14px] font-bold text-text">
                        {fmtSize(step.size)}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
            {result.end && (
              <p className="text-[11.5px] leading-[1.5] text-faint">
                {endNote(result.end, kind, untilNum)} The % is each size against the normal size.
              </p>
            )}
          </>
        ) : (
          <p
            className={`rounded-row border px-3.5 py-3 text-[12.5px] leading-[1.5] ${
              problem
                ? 'border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] font-semibold text-red'
                : 'border-dashed border-border text-muted'
            }`}
          >
            {problem ?? 'Type how much to change the size by to see the steps.'}
          </p>
        )}
      </div>

      {replacing > 0 && (
        <p className="flex items-start gap-2 rounded-row border border-accent-line bg-accent-soft px-3.5 py-2.5 text-[12px] leading-[1.5] text-accent">
          <AlertTriangle size={14} className="mt-[2px] flex-none" aria-hidden="true" />
          <span>
            Replaces your current {kind} steps ({replacing}). Your{' '}
            {kind === 'loss' ? 'win' : 'loss'} steps stay as they are.
          </span>
        </p>
      )}

      <HelperNote />
    </HelperModal>
  )
}
