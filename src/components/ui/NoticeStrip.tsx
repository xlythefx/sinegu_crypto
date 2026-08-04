import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface NoticeStripProps {
  /** Lucide icon, size ~16, rendered flex-none before the message. */
  icon?: ReactNode
  message: string
  /** Optional pill link pushed to the right (wraps below on narrow screens). */
  cta?: { label: string; to: string }
  /** warn = accent (default), danger = red. */
  tone?: 'warn' | 'danger'
}

const TONES = {
  warn: 'text-accent border-accent-line bg-accent-soft',
  danger: 'text-red border-[rgba(255,90,90,0.35)] bg-[rgba(255,90,90,0.08)]',
} as const

/**
 * Persistent caution strip shown above page content (e.g. "account pending
 * approval", "connect an exchange"). One-shot CSS fadeup, no AOS — it is
 * layout chrome and must not re-animate on every navigation.
 */
export default function NoticeStrip({
  icon,
  message,
  cta,
  tone = 'warn',
}: NoticeStripProps) {
  return (
    <div
      className={`flex items-center flex-wrap gap-2.5 py-2.5 px-3.5 border rounded-field text-[12.5px] font-semibold leading-[1.45] mb-stack animate-[fadeup_0.3s_ease_both] [&>svg]:flex-none ${TONES[tone]}`}
      role="status"
    >
      {icon}
      <span>{message}</span>
      {cta && (
        <Link
          to={cta.to}
          className="ml-auto rounded-pill border border-accent-line px-3 py-1 text-[11.5px] font-bold whitespace-nowrap transition-colors hover:bg-accent hover:text-on-accent max-[700px]:ml-0"
        >
          {cta.label}
        </Link>
      )}
    </div>
  )
}
