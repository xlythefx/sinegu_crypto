import { useEffect, useState } from 'react'
import { NUM } from './editorClasses'

interface SecondsInputProps {
  /** Milliseconds. */
  valueMs: number
  onCommit: (ms: number) => void
  min?: number
  max?: number
  ariaLabel?: string
  disabled?: boolean
}

/**
 * A seconds box (one decimal) that commits on blur or Enter, so typing "1."
 * on the way to "1.5" is not reformatted under the cursor.
 */
export default function SecondsInput({ valueMs, onCommit, min = 0, max, ariaLabel, disabled }: SecondsInputProps) {
  const shown = (valueMs / 1000).toFixed(1)
  const [text, setText] = useState(shown)
  useEffect(() => setText(shown), [shown])

  const commit = () => {
    const n = Number(text.replace(',', '.'))
    if (!Number.isFinite(n)) {
      setText(shown)
      return
    }
    const clamped = Math.max(min, max === undefined ? n : Math.min(max, n))
    onCommit(Math.round(clamped * 1000))
    setText((clamped).toFixed(1))
  }

  return (
    <input
      className={NUM}
      inputMode="decimal"
      value={text}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}
