import { useState } from 'react'
import { Calculator } from 'lucide-react'
import HelperModal, {
  HELPER_BTN_PRIMARY,
  HELPER_BTN_SECONDARY,
  HELPER_INPUT,
  HelperField,
  HelperNote,
  Segmented,
} from './HelperModal'
import {
  applySizeChange,
  defaultDirection,
  fmtSize,
  runLabel,
  sizeText,
  stepPhrase,
  type SizeChangeMode,
  type SizeDirection,
} from '../../../lib/streakSizing'
import type { AssetStreakSize, StreakKind } from '../../../types/admin'

type From = 'normal' | 'previous'

interface StepCalculatorModalProps {
  kind: StreakKind
  /** The row's count; null while what is typed there is not a valid count. */
  streak: number | null
  /** The normal (Base) size — NaN while the asset form has no valid one. */
  base: number
  /** The configured step of the same kind just shallower than this one, if any. */
  previous: AssetStreakSize | null
  /** The worked-out size, as the size box should hold it. */
  onApply: (size: string) => void
  onClose: () => void
}

/** "25" / "12.5" — a percent as typed, without a forced decimal. */
const fmtPercent = (n: number) => `${fmtSize(n)}%`

/**
 * "Work out this size" — beside every step's size box. The admin says what
 * they mean ("decrease by 25% from the normal size") and gets the number; the
 * number is what fills the box and what gets saved.
 *
 * "Previous step" is the step of the same kind just shallower than this one
 * (so a ladder can be built one step at a time). It is offered only when it
 * differs from the normal size, where it would be the same answer twice.
 */
export default function StepCalculatorModal({
  kind,
  streak,
  base,
  previous,
  onApply,
  onClose,
}: StepCalculatorModalProps) {
  const baseOk = Number.isFinite(base) && base > 0
  const previousOffered = previous !== null && previous.size !== base

  const [direction, setDirection] = useState<SizeDirection>(defaultDirection(kind))
  const [mode, setMode] = useState<SizeChangeMode>('amount')
  const [value, setValue] = useState('')
  const [from, setFrom] = useState<From>(previousOffered ? 'previous' : 'normal')

  const fromPrevious = from === 'previous' && previousOffered && previous !== null
  const fromSize = fromPrevious ? previous.size : base
  const typed = value.trim()
  const amount = typed === '' ? NaN : Number(typed)
  const result = applySizeChange(fromSize, { direction, mode, value: amount })

  let problem: string | null = null
  let prompt: string | null = null
  if (!fromPrevious && !baseOk) problem = 'Set a Base size first.'
  else if (typed === '') prompt = 'Type how much to change the size by.'
  else if (!(Number.isFinite(amount) && amount > 0)) problem = 'Type a number above 0.'
  else if (!(result > 0)) problem = 'That comes to 0 or less. A size must be more than 0.'
  const ok = problem === null && prompt === null

  const apply = () => {
    if (ok) onApply(sizeText(result))
  }

  const title = streak === null ? `Size for this ${kind} step` : `Size ${stepPhrase(kind, streak, false)}`
  const sign = direction === 'decrease' ? '−' : '+'
  const working = `${fmtSize(fromSize)} ${sign} ${mode === 'amount' ? fmtSize(amount) : fmtPercent(amount)}`
  const percentPart =
    mode === 'percent' && ok ? ` (${fmtSize(Math.abs(result - fromSize))})` : ''

  const fromOptions: { key: From; title: string; size: number; disabled: boolean }[] = [
    { key: 'normal', title: 'Normal size', size: base, disabled: !baseOk },
  ]
  if (previousOffered && previous) {
    fromOptions.push({
      key: 'previous',
      title: `Previous step · after ${runLabel(kind, previous.streak)}`,
      size: previous.size,
      disabled: false,
    })
  }

  return (
    <HelperModal
      title={title}
      subtitle="Say how the size should change, and this works out the number for you."
      icon={<Calculator size={17} aria-hidden="true" />}
      onClose={onClose}
      onEnter={apply}
      footer={
        <>
          <button type="button" className={HELPER_BTN_SECONDARY} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={HELPER_BTN_PRIMARY} onClick={apply} disabled={!ok}>
            Use this size
          </button>
        </>
      }
    >
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
          className={`${HELPER_INPUT} w-[112px] ${problem && typed !== '' ? 'border-red' : 'border-border'}`}
          value={value}
          placeholder={mode === 'amount' ? 'e.g. 0.25' : 'e.g. 25'}
          onChange={(e) => setValue(e.target.value)}
          aria-label={mode === 'amount' ? 'Change the size by this amount' : 'Change the size by this percent'}
          autoFocus
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

      <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[108px_minmax(0,1fr)] sm:items-start sm:gap-x-3">
        <span className="text-[12.5px] font-semibold text-muted sm:pt-2.5">From</span>
        {fromOptions.length === 1 ? (
          <p className="flex min-h-10 items-center justify-between gap-3 rounded-row border border-border bg-surface2 px-3.5 text-[12.5px] font-semibold text-text">
            Normal size
            <span className="font-mono text-[13px] font-bold">{baseOk ? fmtSize(base) : '—'}</span>
          </p>
        ) : (
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Work it out from">
            {fromOptions.map((o) => {
              const on = from === o.key
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={o.disabled}
                  onClick={() => setFrom(o.key)}
                  className={`flex min-h-10 items-center justify-between gap-3 rounded-row border px-3.5 py-2 text-left text-[12.5px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                    on
                      ? 'border-accent bg-accent-soft text-text'
                      : 'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'
                  }`}
                >
                  <span className="min-w-0">{o.title}</span>
                  <span className="flex-none font-mono text-[13px] font-bold text-text">
                    {Number.isFinite(o.size) ? fmtSize(o.size) : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div
        className={`rounded-row border px-4 py-3.5 ${
          problem
            ? 'border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]'
            : 'border-accent-line bg-accent-soft'
        }`}
        aria-live="polite"
      >
        <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint">
          New size
        </p>
        {ok ? (
          <>
            <p className="mt-1 font-mono text-[22px] font-extrabold leading-tight text-accent">
              = {fmtSize(result)}
            </p>
            <p className="mt-1 font-mono text-[11.5px] text-muted">
              {working}
              {percentPart}
              {baseOk && (
                <span className="font-body text-faint">
                  {' · '}
                  {Math.round((result / base) * 100)}% of the normal size
                </span>
              )}
            </p>
          </>
        ) : (
          <p className={`mt-1 text-[12.5px] leading-[1.5] ${problem ? 'font-semibold text-red' : 'text-muted'}`}>
            {problem ?? prompt}
          </p>
        )}
      </div>

      <HelperNote />
    </HelperModal>
  )
}
