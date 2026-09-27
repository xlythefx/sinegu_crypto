import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, type LucideIcon } from 'lucide-react'

interface InsightCardProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  /** Where the admin acts on what this card shows. */
  link?: { to: string; label: string }
  className?: string
  children: ReactNode
}

/** Card shell shared by every dashboard tab: icon + title, optional "open" link. */
export function InsightCard({
  icon: Icon,
  title,
  subtitle,
  link,
  className = '',
  children,
}: InsightCardProps) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-card border border-border bg-surface p-card ${className}`}
    >
      <div className="mb-3.5 flex items-start gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] font-extrabold">{title}</div>
          {subtitle && (
            <div className="mt-px text-[12px] text-muted">{subtitle}</div>
          )}
        </div>
        {link && (
          <Link
            to={link.to}
            className="inline-flex flex-none items-center gap-1 rounded-btn px-2 py-1 text-[12px] font-semibold text-accent hover:bg-accent-soft"
          >
            {link.label}
            <ArrowRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** Muted placeholder inside a card that has nothing to show. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[90px] flex-1 place-items-center rounded-row border border-dashed border-border bg-surface2 px-4 py-5 text-center text-[13px] text-muted">
      {children}
    </div>
  )
}

/** Horizontal bar with a label and a count — for reason / funnel breakdowns. */
export function BarRow({
  label,
  value,
  max,
  display,
  tone = 'accent',
}: {
  label: ReactNode
  value: number
  max: number
  display?: string
  tone?: 'accent' | 'red' | 'green'
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  const fill = tone === 'red' ? 'bg-red' : tone === 'green' ? 'bg-green' : 'bg-accent'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="min-w-0 truncate text-text">{label}</span>
        <span className="flex-none font-mono font-bold">{display ?? value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-pill bg-surface2">
        <div className={`h-full rounded-pill ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** Grid for card rows: stacks on a phone, 2 columns on tablet, `cols` on desktop. */
export const GRID_2 = 'grid grid-cols-2 gap-stack items-stretch max-[1100px]:grid-cols-1'
export const GRID_3 =
  'grid grid-cols-3 gap-stack items-stretch max-[1300px]:grid-cols-2 max-[800px]:grid-cols-1'
export const TILES =
  'grid grid-cols-4 gap-2.5 max-[1300px]:grid-cols-2 max-[480px]:grid-cols-1'
