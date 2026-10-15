import { useEffect, useRef, useState } from 'react'
import CopyState from '../../ui/CopyState'

interface CopyButtonProps {
  /** Exactly what lands on the clipboard. */
  text: string
  label?: string
  /** Screen-reader name when the visible label alone is ambiguous ("Copy"). */
  ariaLabel?: string
  /** `primary` for the one main action of a block (copy the alert message). */
  variant?: 'ghost' | 'primary'
}

const BASE =
  'inline-flex min-h-9 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-btn border px-3 text-[12px] font-bold transition-[border-color,color,filter] duration-150'
const VARIANT = {
  ghost: 'border-border bg-surface text-text hover:border-accent',
  primary: 'border-transparent bg-accent text-on-accent hover:brightness-[1.06]',
}

/**
 * A copy button with "Copied" feedback — the same CopyState swap every copy
 * button in the app uses. At least 36px tall, so it is a comfortable tap on a
 * phone. If the clipboard is blocked nothing breaks: the text it copies is
 * always on screen and selectable.
 */
export default function CopyButton({ text, label = 'Copy', ariaLabel, variant = 'ghost' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Clipboard blocked — the text is selectable beside the button. */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={ariaLabel}
      className={`${BASE} ${VARIANT[variant]}`}
    >
      <CopyState
        copied={copied}
        label={label}
        checkClassName={variant === 'ghost' ? 'text-green' : undefined}
      />
    </button>
  )
}
