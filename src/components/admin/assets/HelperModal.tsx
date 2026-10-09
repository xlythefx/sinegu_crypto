import { useEffect, useId, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'

/*
 * The frame the two step helpers share ("Work out this size", "Build steps
 * for me"), plus the small controls they are built from.
 *
 * Portaled to <body>: the editor sits inside AOS cards (transformed) and
 * inside the asset form's own fixed overlay, either of which would trap or
 * clip a `position: fixed` child. Escape is caught in the CAPTURE phase and
 * stopped there, because the asset form underneath also closes on Escape —
 * one key press must close this window only.
 */

interface HelperModalProps {
  title: string
  subtitle?: string
  icon: ReactNode
  onClose: () => void
  /** Enter in a text field runs this (the primary button's action). */
  onEnter?: () => void
  /** The buttons, right-aligned. */
  footer: ReactNode
  children: ReactNode
}

export default function HelperModal({
  title,
  subtitle,
  icon,
  onClose,
  onEnter,
  footer,
  children,
}: HelperModalProps) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // Not a <form>: through the portal a submit would bubble to the asset form
  // this window can sit in, and save the whole asset.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && onEnter && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault()
      onEnter()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex justify-center overflow-y-auto bg-[rgba(0,0,0,0.55)] p-4 backdrop-blur-[3px] animate-[fadeup_0.2s_ease_both] sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="my-auto flex w-full max-w-[460px] flex-col rounded-[20px] border border-border bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-start gap-3 border-b border-hair px-5 pb-4 pt-5 sm:px-6">
          <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
            {icon}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id={titleId}
              className="font-display text-[17px] font-extrabold leading-snug tracking-[-0.01em] text-text"
            >
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-[12.5px] leading-[1.5] text-faint">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-btn border border-border text-muted transition-colors duration-150 hover:text-text"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">{children}</div>

        <div className="flex flex-wrap justify-end gap-2.5 border-t border-hair px-5 py-4 sm:px-6">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------- controls -- */

export const HELPER_BTN =
  'inline-flex min-h-10 items-center justify-center rounded-pill px-5 text-[13px] font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45'
export const HELPER_BTN_SECONDARY = `${HELPER_BTN} border border-border bg-surface2 text-text hover:border-accent`
export const HELPER_BTN_PRIMARY = `${HELPER_BTN} border-0 bg-accent text-on-accent shadow-[0_10px_24px_var(--glow)] disabled:shadow-none`

/** A number box in the helpers. */
export const HELPER_INPUT =
  'h-10 rounded-field border bg-surface2 px-3 font-mono text-[13.5px] text-text outline-none placeholder:font-body placeholder:text-faint focus:border-accent'

type SegmentTone = 'accent' | 'loss' | 'win'

const SEGMENT_ON: Record<SegmentTone, string> = {
  accent: 'bg-accent text-on-accent',
  loss: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red',
  win: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
}

/** A two- or three-way choice as one pill: "Decrease | Increase". */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly { value: T; label: string; tone?: SegmentTone }[]
  onChange: (value: T) => void
  /** Read by screen readers: what the choice is about. */
  label: string
}) {
  return (
    <div
      className="inline-flex flex-none rounded-pill border border-border bg-surface2 p-0.5"
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={`min-h-[34px] rounded-pill px-3.5 text-[12.5px] font-bold transition-colors duration-150 ${
              on ? SEGMENT_ON[o.tone ?? 'accent'] : 'text-muted hover:text-text'
            }`}
            onClick={() => {
              if (!on) onChange(o.value)
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * One labelled line of a helper form: the label above the controls on a
 * phone, beside them from `sm` up. `hint` sits under the controls.
 */
export function HelperField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[108px_minmax(0,1fr)] sm:items-center sm:gap-x-3">
      <span className="text-[12.5px] font-semibold text-muted">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {hint && (
        <p className="text-[11.5px] leading-[1.5] text-faint sm:col-start-2">{hint}</p>
      )}
    </div>
  )
}

/** The rule both helpers state: what they save is a plain number, not a formula. */
export function HelperNote() {
  return (
    <p className="flex items-start gap-2 rounded-row border border-hair bg-surface2 px-3.5 py-3 text-[11.5px] leading-[1.55] text-muted">
      <Info size={13} className="mt-[2px] flex-none text-faint" aria-hidden="true" />
      <span>
        Worked out once and saved as plain numbers — if you change the normal (Base) size later,
        rebuild the steps.
      </span>
    </p>
  )
}
