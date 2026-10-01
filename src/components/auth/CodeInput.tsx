import {
  useEffect,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'
import { isCompleteCode, VERIFY_CODE_LENGTH } from '../../lib/emailVerification'

interface CodeInputProps {
  /**
   * Controlled value: one character per box, a space for an empty box
   * (trailing spaces trimmed). A finished code is six digits — test it with
   * {@link isCompleteCode}. The parent clears it by passing `''`.
   */
  value: string
  onChange: (value: string) => void
  /** Fired with the six digits whenever an edit leaves every box filled. */
  onComplete?: (code: string) => void
  disabled?: boolean
  /**
   * Marks the row as refused: red borders plus one shake. The shake replays
   * each time this goes false → true, so clear it as soon as the user types
   * again.
   */
  error?: boolean
  autoFocus?: boolean
}

const BOX =
  'h-14 w-full min-w-0 rounded-[12px] border bg-surface2 p-0 text-center font-mono text-[22px] font-semibold text-text caret-accent outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_var(--glowAuth)] disabled:cursor-not-allowed disabled:opacity-60'

function toSlots(value: string): string[] {
  return Array.from({ length: VERIFY_CODE_LENGTH }, (_, i) => {
    const ch = value[i] ?? ''
    return /\d/.test(ch) ? ch : ''
  })
}

function fromSlots(slots: string[]): string {
  return slots.map((s) => s || ' ').join('').trimEnd()
}

const onlyDigits = (s: string) => s.replace(/\D/g, '')

/**
 * Six one-digit boxes for an emailed code (sign-up verification, password
 * reset). Typing advances, Backspace on an empty box steps back and clears
 * it, the arrow keys move, and a paste fills from the box it lands in — a
 * whole six-digit paste fills every box wherever it lands. The first box
 * carries `autocomplete="one-time-code"`, so a phone's code autofill (which
 * types the whole code into one field) is spread across the row too.
 */
export default function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false,
}: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const slots = toSlots(value)

  const focusBox = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(VERIFY_CODE_LENGTH - 1, i))]
    el?.focus()
    el?.select()
  }

  // A refused code is cleared by the parent; put the cursor back at the start.
  // (Waits for `disabled` to lift — a disabled box cannot take focus.)
  useEffect(() => {
    if (error && !disabled) refs.current[0]?.focus()
  }, [error, disabled])

  const commit = (next: string[]) => {
    const nextValue = fromSlots(next)
    onChange(nextValue)
    if (isCompleteCode(nextValue)) onComplete?.(nextValue)
  }

  /** Writes `digits` into consecutive boxes from `start`, then focuses after them. */
  const fillFrom = (start: number, digits: string) => {
    const next = [...slots]
    const chars = digits.slice(0, VERIFY_CODE_LENGTH - start).split('')
    chars.forEach((d, k) => {
      next[start + k] = d
    })
    commit(next)
    focusBox(start + chars.length)
  }

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const digits = onlyDigits(e.target.value)
    if (digits === '') {
      // Non-digit typed, or the box was emptied (e.g. cut).
      if (e.target.value === '' && slots[i]) {
        const next = [...slots]
        next[i] = ''
        commit(next)
      }
      return
    }
    // A full code arriving in one box (autofill) fills the whole row.
    if (digits.length >= VERIFY_CODE_LENGTH) {
      fillFrom(0, digits)
      return
    }
    // The box's text is selected on focus, so a keystroke replaces it; if the
    // browser appended instead, the new digit is the last one.
    if (digits.length === 2 && slots[i]) {
      fillFrom(i, digits.slice(-1))
      return
    }
    fillFrom(i, digits)
  }

  const handlePaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    const digits = onlyDigits(e.clipboardData.getData('text'))
    e.preventDefault()
    if (digits === '') return
    fillFrom(digits.length >= VERIFY_CODE_LENGTH ? 0 : i, digits)
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (slots[i]) {
        e.preventDefault()
        const next = [...slots]
        next[i] = ''
        commit(next)
      } else if (i > 0) {
        e.preventDefault()
        const next = [...slots]
        next[i - 1] = ''
        commit(next)
        focusBox(i - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusBox(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusBox(i + 1)
    }
  }

  return (
    <div
      className={`grid grid-cols-6 gap-2 sm:gap-3 ${error ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
      role="group"
      aria-label="Verification code"
    >
      {slots.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          // Room for a whole autofilled / pasted code; handleChange spreads it.
          maxLength={i === 0 ? VERIFY_CODE_LENGTH : 2}
          aria-label={`Digit ${i + 1} of ${VERIFY_CODE_LENGTH}`}
          aria-invalid={error || undefined}
          className={`${BOX} ${error ? 'border-[#ef4444]' : 'border-border'}`}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleChange(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      ))}
    </div>
  )
}
