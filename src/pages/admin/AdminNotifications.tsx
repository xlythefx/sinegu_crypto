import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Info, MailWarning } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import NoticeCard from '../../components/admin/notifications/NoticeCard'
import { useApiData } from '../../hooks/useApiData'
import { getAdminNotifications } from '../../services/admin'
import { ApiError } from '../../services/api'
import type { TeamNotice } from '../../types/activity'

const GROUPS: { key: TeamNotice['group']; title: string; blurb: string }[] = [
  { key: 'Customers', title: 'Customers', blurb: 'New people and new exchange accounts.' },
  { key: 'Billing', title: 'Billing', blurb: 'Money in, and payments that need a look.' },
  { key: 'Trading', title: 'Trading', blurb: 'The bot: coins switched off, refused orders, serious faults.' },
]

/**
 * Admin → Notifications (Dima, 2026-11-23: "a notification area so I can opt
 * in and add emails… manage it by myself"): every TEAM email, switched on or
 * off, and who receives it. Customer emails (invoices, approvals, codes) are
 * not here — those always go to the customer.
 */
export default function AdminNotifications() {
  const { data, loading, error, reload } = useApiData(() => getAdminNotifications(), [])
  // Each card's saved answer replaces its row without refetching the page.
  const [saved, setSaved] = useState<Record<string, TeamNotice>>({})

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const replace = (n: TeamNotice) => setSaved((prev) => ({ ...prev, [n.slug]: n }))

  return (
    <AdminLayout title="Notifications" subtitle="Choose which team emails are sent, and to whom.">
      {!data ? (
        <DataState loading={loading} error={error} onRetry={reload} label="notifications" />
      ) : (
        <div className="mt-2 flex flex-col gap-7">
          {!data.delivers && (
            <div className="flex items-start gap-2.5 rounded-card border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-4 py-3 text-[12.5px] text-text">
              <MailWarning size={16} className="mt-0.5 flex-none text-red" />
              <span>This server does not deliver email (it only writes it to its log), so nothing below reaches an inbox here.</span>
            </div>
          )}
          {GROUPS.map((g, gi) => {
            const notices = data.notices.map((n) => saved[n.slug] ?? n).filter((n) => n.group === g.key)
            if (notices.length === 0) return null
            return (
              <section key={g.key} data-aos="fade-up" data-aos-delay={gi * 60}>
                <div className="mb-3">
                  <h2 className="m-0 font-display text-[17px] font-extrabold">{g.title}</h2>
                  <p className="mt-0.5 text-[12.5px] text-muted">{g.blurb}</p>
                </div>
                <div className="grid grid-cols-2 items-start gap-4 max-[1000px]:grid-cols-1">
                  {notices.map((n) => (
                    <NoticeCard key={n.slug} notice={n} onSaved={replace} />
                  ))}
                </div>
              </section>
            )
          })}
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
            <Info size={14} className="mt-0.5 flex-none text-faint" />
            <span>
              Every change saves at once and is recorded on Admin → Activity. A notice nobody has changed uses the
              server’s default list. The two “Always on” alerts cannot be switched off or left without an address,
              because they report a position that may still be open or a serious fault on the bot.
            </span>
          </p>
        </div>
      )}
    </AdminLayout>
  )
}
