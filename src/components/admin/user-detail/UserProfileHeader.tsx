import { Link } from 'react-router-dom'
import { MessageCircle, Phone, Send, UserPlus, Users } from 'lucide-react'
import UserAvatar from '../../ui/UserAvatar'
import { RoleBadge, StatusBadge } from '../badges'
import TradingBadge from '../users/TradingBadge'
import { fmtMediumDate, fmtMoney } from '../../../lib/format'
import { formatWhatsapp, whatsappUrl } from '../../../lib/whatsapp'
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
                  {/* Written at sign-in only, so it is the last SIGN-IN, not activity. */}
                  {user.last_activity && (
                    <span className="font-mono text-[11px] text-faint" title="Updated when they sign in">
                      · Last sign-in {fmtMediumDate(user.last_activity)}
                    </span>
                  )}
                </div>
                {/* Trading and money at a glance (full admins; the admin audit, 2026-11-11). */}
                {user.standing && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <TradingBadge verdict={user.standing.trading} full />
                    {user.standing.owes.amount > 0 && (
                      <span
                        className={`rounded-pill px-[9px] py-[3px] text-[10.5px] font-bold ${
                          user.standing.owes.overdue
                            ? 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red'
                            : 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent'
                        }`}
                      >
                        Owes {fmtMoney(user.standing.owes.amount)}
                        {user.standing.owes.overdue ? ' · overdue' : ''}
                      </span>
                    )}
                  </div>
                )}
                {(user.referred_by || user.contacts?.telegram || user.contacts?.whatsapp || user.contacts?.discord) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
                    {user.referred_by && (
                      <span className="inline-flex items-center gap-1.5">
                        <UserPlus size={13} className="text-faint" />
                        Referred by{' '}
                        <Link to={`/admin/users/${user.referred_by.uni_id}`} className="font-semibold text-text hover:text-accent">
                          {user.referred_by.name}
                        </Link>
                      </span>
                    )}
                    {user.contacts?.telegram && (
                      <a
                        href={`https://t.me/${user.contacts.telegram.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-accent"
                        title="Telegram (typed by the customer)"
                      >
                        <Send size={13} className="text-faint" />@{user.contacts.telegram.replace(/^@/, '')}
                      </a>
                    )}
                    {user.contacts?.whatsapp && (
                      <a
                        href={whatsappUrl(user.contacts.whatsapp)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-accent"
                        title="WhatsApp (typed by the customer)"
                      >
                        <Phone size={13} className="text-faint" />
                        {formatWhatsapp(user.contacts.whatsapp)}
                      </a>
                    )}
                    {user.contacts?.discord && (
                      <span
                        className="inline-flex items-center gap-1.5"
                        title={user.contacts.discord_linked ? 'Discord (confirmed through Discord sign-in)' : 'Discord (typed by the customer)'}
                      >
                        <MessageCircle size={13} className="text-faint" />
                        {user.contacts.discord}
                      </span>
                    )}
                  </div>
                )}
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
