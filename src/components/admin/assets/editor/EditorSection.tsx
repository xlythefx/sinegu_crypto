import { useId, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EditorSectionProps {
  /** Anchor the page scrolls to when this section holds the first problem. */
  id: string
  Icon: LucideIcon
  title: string
  description?: ReactNode
  /** Right side of the header, e.g. a summary or a toggle. */
  aside?: ReactNode
  children: ReactNode
}

/** One numbered block of the asset page: icon, title, one line of why, then its fields. */
export default function EditorSection({ id, Icon, title, description, aside, children }: EditorSectionProps) {
  const headingId = useId()
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-6 rounded-card border border-border bg-surface p-4 sm:p-5"
    >
      <header className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-btn border border-accent-line bg-accent-soft text-accent">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="font-display text-[16px] font-extrabold leading-tight">
            {title}
          </h2>
          {description && <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">{description}</p>}
        </div>
        {aside && <div className="flex-none">{aside}</div>}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}
