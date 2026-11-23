import { Link } from 'react-router-dom'
import { CreditCard, KeyRound, LogIn, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import { fmtDateTime } from '../../../lib/format'
import type { ActivityArea, ActivityItem } from '../../../types/activity'

const AREA: Record<ActivityArea, { icon: LucideIcon; tint: string }> = {
  account: { icon: UserRound, tint: 'text-muted bg-surface2 border-border' },
  exchange: { icon: KeyRound, tint: 'text-accent bg-accent-soft border-accent-line' },
  billing: {
    icon: CreditCard,
    tint: 'text-green bg-[color-mix(in_srgb,var(--green)_12%,transparent)] border-[color-mix(in_srgb,var(--green)_35%,transparent)]',
  },
  signin: { icon: LogIn, tint: 'text-[#60a5fa] bg-[rgba(96,165,250,0.12)] border-[rgba(96,165,250,0.35)]' },
}

const WHO: Record<ActivityItem['source'], string> = {
  customer: 'Their action',
  signin: 'Sign-in',
  admin: 'Admin',
}

/** One row per entry: when, who it is about, what happened, and who did it. */
export default function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface px-card py-10 text-center text-[13px] text-muted">
        Nothing matches these filters.
      </div>
    )
  }

  return (
    <ol className="m-0 list-none overflow-hidden rounded-card border border-border bg-surface p-0">
      {items.map((it) => {
        const { icon: Icon, tint } = it.source === 'admin' ? { icon: ShieldCheck, tint: AREA.account.tint } : AREA[it.area]
        const where = [it.detail, it.country, it.ip ? `IP ${it.ip}` : null].filter(Boolean).join(' · ')
        const staff = it.subject?.type && it.subject.type !== 'user'
        return (
          <li key={it.key} className="flex items-start gap-3 border-b border-hair px-4 py-3 last:border-b-0 sm:px-5">
            <span className={`mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-[10px] border ${tint}`}>
              <Icon size={15} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                {it.subject ? (
                  <Link
                    to={`/admin/users/${it.subject.uni_id}?tab=timeline`}
                    className="max-w-full truncate text-[13px] font-bold text-text hover:text-accent"
                  >
                    {it.subject.name ?? 'Deleted user'}
                  </Link>
                ) : (
                  <span className="text-[13px] font-bold text-text">Team setting</span>
                )}
                {staff && (
                  <span className="rounded-pill border border-border px-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-faint">
                    {it.subject?.type}
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">{WHO[it.source]}</span>
                <span className="ml-auto font-mono text-[11px] text-faint max-[560px]:ml-0 max-[560px]:w-full">
                  {fmtDateTime(it.at)}
                </span>
              </div>
              <p className="mt-0.5 break-words text-[13px] text-text">{it.title}</p>
              {(it.actor || where) && (
                <p className="mt-0.5 break-words text-[12px] text-muted">
                  {it.actor && <>by {it.actor.name}</>}
                  {it.actor && where && ' · '}
                  {where}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
