import { NavLink } from 'react-router-dom'
import type { EmailAudience, EmailTemplate } from '../../../types/emailTemplates'
import { AUDIENCE_LABEL } from './constants'
import { StatusPill } from './StatusPill'

const ITEM =
  'flex items-start justify-between gap-3 rounded-[10px] border px-3 py-2.5 transition-[border-color,background] duration-150'
const ITEM_ON = 'border-accent-line bg-accent-soft'
const ITEM_OFF = 'border-transparent hover:border-border hover:bg-surface2'

/** Desktop rail: every email, grouped by who receives it. */
export function EmailList({ emails }: { emails: EmailTemplate[] }) {
  return (
    <nav className="flex flex-col gap-5" aria-label="Email templates">
      {(Object.keys(AUDIENCE_LABEL) as EmailAudience[]).map((audience) => (
        <div key={audience}>
          <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted px-3 mb-2">
            {AUDIENCE_LABEL[audience]}
          </div>
          <ul className="flex flex-col gap-1">
            {emails
              .filter((e) => e.audience === audience)
              .map((e) => (
                <li key={e.slug}>
                  <NavLink
                    to={`/admin/sandbox/emails/${e.slug}`}
                    className={({ isActive }) => `${ITEM} ${isActive ? ITEM_ON : ITEM_OFF}`}
                  >
                    <span className="min-w-0 text-[13px] font-bold text-text leading-[1.4]">
                      {e.title}
                    </span>
                    <StatusPill live={e.live} />
                  </NavLink>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Mobile picker: the same list as a native select, which a phone renders well. */
export function EmailSelect({
  emails,
  value,
  onChange,
}: {
  emails: EmailTemplate[]
  value: string
  onChange: (slug: string) => void
}) {
  return (
    <select
      aria-label="Choose an email"
      value={value}
      onChange={(ev) => onChange(ev.target.value)}
      className="h-11 w-full rounded-[10px] border border-border bg-surface2 text-text px-3 text-[14px] font-bold outline-none focus:border-accent"
    >
      {(Object.keys(AUDIENCE_LABEL) as EmailAudience[]).map((audience) => (
        <optgroup key={audience} label={AUDIENCE_LABEL[audience]}>
          {emails
            .filter((e) => e.audience === audience)
            .map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.title}
                {e.live ? '' : ' — draft'}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}
