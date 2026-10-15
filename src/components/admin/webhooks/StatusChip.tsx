import type { LucideIcon } from 'lucide-react'

export type ChipTone = 'good' | 'bad' | 'neutral'

const TONE: Record<ChipTone, string> = {
  good: 'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-green',
  bad: 'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red',
  neutral: 'border-border bg-surface2 text-muted',
}

/** Small status pill on a webhook card ("Live on this engine", "Secret not set"). */
export default function StatusChip({
  tone,
  icon: Icon,
  children,
  title,
}: {
  tone: ChipTone
  icon: LucideIcon
  children: string
  title?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-[3px] text-[11.5px] font-semibold leading-[1.4] ${TONE[tone]}`}
      title={title}
    >
      <Icon size={12} aria-hidden="true" className="flex-none" />
      {children}
    </span>
  )
}
