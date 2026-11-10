import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SECTION_ICON, SECTION_SUB, SECTION_TITLE } from './creativeClasses'

interface SectionHeaderProps {
  icon: LucideIcon
  /** The heading's id, for the section's aria-labelledby. */
  id: string
  title: string
  subtitle?: ReactNode
  /** Right side on wide screens, under the title on a phone. */
  actions?: ReactNode
}

/** Icon chip + title + one plain line, with optional actions — every card on this page. */
export default function SectionHeader({ icon: Icon, id, title, subtitle, actions }: SectionHeaderProps) {
  return (
    <header className="flex flex-wrap items-start gap-3">
      <span className={SECTION_ICON} aria-hidden="true">
        <Icon size={17} />
      </span>
      <div className="min-w-[180px] flex-1">
        <h2 id={id} className={SECTION_TITLE}>
          {title}
        </h2>
        {subtitle && <p className={SECTION_SUB}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 max-sm:w-full">{actions}</div>}
    </header>
  )
}
