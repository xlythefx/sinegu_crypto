import { useRef, type KeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'

export type SegmentedTone = 'neutral' | 'green' | 'red' | 'accent'

export interface SegmentedOption<V extends string = string> {
  value: V
  label: string
  /** Rows this choice would show — a small mono number after the label. */
  count?: number
  /** Tint when selected (default accent): green/red for outcomes, neutral for "All". */
  tone?: SegmentedTone
  icon?: LucideIcon
}

interface SegmentedProps<V extends string> {
  value: V
  onChange: (value: V) => void
  options: SegmentedOption<V>[]
  ariaLabel: string
  size?: 'sm' | 'md'
}

const TONE_ON: Record<SegmentedTone, string> = {
  accent: 'border-accent-line bg-accent-soft text-accent',
  green:
    'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-green',
  red: 'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-red',
  // Lifted onto the panel colour so "All" still reads as picked on the track.
  neutral: 'border-border bg-surface text-text shadow-[0_1px_2px_rgba(0,0,0,0.16)]',
}

const TONE_OFF = 'border-transparent bg-transparent text-muted hover:text-text'

const SIZE: Record<'sm' | 'md', string> = {
  sm: 'min-h-8 gap-1.5 px-2.5 text-[12px]',
  md: 'min-h-9 gap-2 px-3.5 text-[12.5px]',
}

/**
 * Single-choice pills on one track — for facets with a handful of choices
 * (exchange, side, outcome, date preset). Wraps onto a second row rather than
 * scrolling, so every choice stays visible on a phone.
 *
 * A real radio group: Tab lands on the picked option, arrow keys (and
 * Home / End) move the choice, wrapping at the ends.
 */
export default function Segmented<V extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
}: SegmentedProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  // Roving tab stop: the picked option, or the first when none matches.
  const focusIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1
    let next: number
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = index === last ? 0 : index + 1
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = index === 0 ? last : index - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }
    e.preventDefault()
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-[12px] border border-hair bg-surface2 p-1"
    >
      {options.map((option, i) => {
        const on = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-btn border font-semibold leading-none transition-[color,background-color,border-color] duration-150 ${SIZE[size]} ${
              on ? TONE_ON[option.tone ?? 'accent'] : TONE_OFF
            }`}
          >
            {Icon && <Icon size={size === 'sm' ? 12 : 13} aria-hidden="true" className="flex-none" />}
            {option.label}
            {option.count !== undefined && (
              <span
                className={`font-mono text-[10.5px] font-medium tabular-nums ${
                  on ? 'opacity-75' : 'text-faint'
                }`}
              >
                {option.count.toLocaleString()}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
