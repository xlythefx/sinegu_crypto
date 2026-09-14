import type { ReactNode } from 'react'

/**
 * The house status pill — one shape, four tones, color-mix token backgrounds
 * (idiom shared with AdminInvoiceHistory and the referrals status pills).
 * Renders whatever label it is handed; nothing here decides what a status
 * means. `size="xs"` is for a tag beside a number in a table cell.
 */

const BASE =
  'inline-block font-bold uppercase tracking-[0.05em] rounded-pill whitespace-nowrap'

const SIZE = {
  sm: 'text-[10px] py-[3px] px-[9px]',
  xs: 'text-[9.5px] py-px px-1.5 leading-[14px]',
} as const

const TONE = {
  green: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
  accent: 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent',
  red: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red',
  muted: 'bg-[color-mix(in_srgb,var(--muted)_14%,transparent)] text-muted',
} as const

export type PillTone = keyof typeof TONE

export function Pill({
  tone,
  size = 'sm',
  title,
  children,
}: {
  tone: PillTone
  size?: keyof typeof SIZE
  title?: string
  children: ReactNode
}) {
  return (
    <span className={`${BASE} ${SIZE[size]} ${TONE[tone]}`} title={title}>
      {children}
    </span>
  )
}
