import { Users } from 'lucide-react'
import UserAvatar from '../../ui/UserAvatar'
import { RoleBadge, StatusBadge } from '../badges'
import { fmtMediumDate } from '../../../lib/format'
import type { AdminUserDetail } from '../../../types/admin'

interface UserProfileHeaderProps {
  user: AdminUserDetail
  /** Compact referrals stat pinned to the far right of the name panel. */
  referralsCount?: number
}

/**
 * Social-style profile header: gradient banner (user_banner if set) with an
 * overlapping avatar, then name / email / status inside a readable panel.
 */
export default function UserProfileHeader({
  user,
  referralsCount,
}: UserProfileHeaderProps) {
  return (
    <section
      className="mb-stack overflow-hidden rounded-card border border-border bg-surface"
      data-aos="fade-up"
    >
      <div
        className="h-32 w-full bg-[linear-gradient(120deg,var(--accentSoft),var(--surface2)_45%,var(--accentLine))] bg-cover bg-center sm:h-40"
        style={
          user.user_banner
            ? { backgroundImage: `url(${user.user_banner})` }
            : undefined
        }
        role="presentation"
      />
      <div className="relative -mt-11 px-5 pb-5 sm:-mt-[52px] sm:px-6 sm:pb-6">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-end">
          <span className="w-fit flex-none rounded-full ring-4 ring-surface shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
            <UserAvatar
              user={{ name: user.name, user_profile: user.user_profile }}
              size={92}
            />
          </span>
          <div className="min-w-0 flex-1 rounded-row border border-border bg-surface2 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-[220px]">
                <h1 className="truncate font-display text-[20px] font-extrabold tracking-[-0.4px] sm:text-[24px]">
                  {user.name || '—'}
                </h1>
                <p className="mt-0.5 break-all text-[13px] text-muted">
                  {user.email}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={user.status} />
                  <RoleBadge role={user.type} />
                  {user.created_at && (
                    <span className="font-mono text-[11px] text-faint">
                      Joined {fmtMediumDate(user.created_at)}
                    </span>
                  )}
                  {user.last_activity && (
                    <span className="font-mono text-[11px] text-faint">
                      · Last active {fmtMediumDate(user.last_activity)}
                    </span>
                  )}
                </div>
              </div>
              {referralsCount !== undefined && (
                <div className="flex flex-none items-center gap-2.5 rounded-row border border-border bg-surface px-3.5 py-2.5">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
                    <Users size={15} />
                  </span>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.07em] text-faint">
                      Referrals
                    </p>
                    <p className="font-mono text-[16px] font-extrabold leading-[1.15] tabular-nums">
                      {referralsCount}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
