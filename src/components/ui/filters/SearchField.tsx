import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  /** How long typing must pause before `onChange` fires. */
  delayMs?: number
  className?: string
}

/**
 * Free-text narrowing (customer, account, id). The box shows every keystroke
 * at once but only reports once typing pauses, so a URL-backed filter is not
 * rewritten — and a list not refetched — per letter. Emptying the box (✕,
 * Escape, or deleting the text) reports '' immediately.
 *
 * Reports the TRIMMED text. A change to `value` from outside (Clear all, a
 * chip, back/forward) replaces what is typed and cancels a pending report;
 * its own trimmed value echoing back does not, so a space typed between two
 * words survives the round trip.
 */
export default function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  delayMs = 300,
  className = '',
}: SearchFieldProps) {
  const [text, setText] = useState(value)
  const textRef = useRef(value)
  const timer = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  // The timer fires after later renders; it must call the newest handler,
  // not the one captured on the keystroke that armed it.
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (textRef.current.trim() === value.trim()) return
    window.clearTimeout(timer.current)
    textRef.current = value
    setText(value)
  }, [value])

  const update = (next: string) => {
    textRef.current = next
    setText(next)
    window.clearTimeout(timer.current)
    const query = next.trim()
    if (query === '') {
      onChangeRef.current('')
      return
    }
    timer.current = window.setTimeout(() => onChangeRef.current(query), delayMs)
  }

  const hasText = text !== ''

  return (
    <label
      className={`flex h-9 w-full min-w-0 items-center gap-2 rounded-field border border-border bg-surface2 pl-3 text-faint transition-[border-color,box-shadow] duration-150 hover:border-accent-line focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_16%,transparent)] sm:w-[260px] ${
        hasText ? 'pr-1' : 'pr-3'
      } ${className}`}
    >
      <Search size={14} aria-hidden="true" className="flex-none" />
      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && hasText) {
            e.preventDefault()
            e.stopPropagation()
            update('')
          }
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-[12.5px] font-medium text-text outline-none placeholder:font-normal placeholder:text-faint focus-visible:outline-none"
      />
      {hasText && (
        <button
          type="button"
          aria-label="Clear the search"
          // Keep the caret in the box: mousedown would otherwise blur it first.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            update('')
            inputRef.current?.focus()
          }}
          className="grid h-7 w-7 flex-none place-items-center rounded-full text-faint transition-colors hover:bg-surface hover:text-text"
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </label>
  )
}
