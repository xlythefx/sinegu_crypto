import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Monitor, Smartphone } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import EmailFrame from '../../components/admin/email-templates/EmailFrame'
import { EmailList, EmailSelect } from '../../components/admin/email-templates/EmailList'
import {
  AUDIENCE_LABEL,
  type FrameWidth,
} from '../../components/admin/email-templates/constants'
import { StatusPill } from '../../components/admin/email-templates/StatusPill'
import SendPreviewCard from '../../components/admin/email-templates/SendPreviewCard'
import {
  BTN,
  BTN_GHOST,
  BTN_SM,
  CARD,
  SEG,
  SEG_OFF,
  SEG_ON,
} from '../../components/admin/manual-trade/classes'
import { useApiData } from '../../hooks/useApiData'
import { ApiError } from '../../services/api'
import { getEmailTemplates } from '../../services/emailTemplates'

const TITLE = 'Email Templates'
const SUBTITLE = 'Every email Pixel Alpha sends, as the recipient sees it.'

/**
 * Admin → Sandbox → Email Templates. One email per URL
 * (`/admin/sandbox/emails/:slug`), rendered by the API from the real
 * templates with sample data — what is approved here is what gets sent.
 */
export default function AdminEmailTemplates() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApiData(getEmailTemplates)
  const [width, setWidth] = useState<FrameWidth>('desktop')

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const header = (
    <div className="flex items-center gap-3 mb-[18px]" data-aos="fade-up">
      <Link
        to="/admin/sandbox"
        aria-label="Back to Sandbox"
        className="grid place-items-center w-9 h-9 flex-none rounded-[10px] border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 hover:border-accent hover:text-text"
      >
        <ArrowLeft size={16} />
      </Link>
      <p className="text-[12.5px] text-muted leading-[1.5]">
        <strong className="text-text">Live</strong> emails are sent today.{' '}
        <strong className="text-text">Drafts</strong> are designed and waiting for approval —
        nothing sends them yet. Names and figures are sample data.
      </p>
    </div>
  )

  if (!data) {
    return (
      <AdminLayout title={TITLE} subtitle={SUBTITLE}>
        {header}
        <DataState loading={loading} error={error} onRetry={reload} label="email templates" />
      </AdminLayout>
    )
  }

  const { emails } = data
  const index = Math.max(0, emails.findIndex((e) => e.slug === slug))
  const email = emails[index]

  // A bare /admin/sandbox/emails (or an unknown slug) lands on the first email.
  if (!email) return null
  if (slug !== email.slug) {
    return <Navigate to={`/admin/sandbox/emails/${email.slug}`} replace />
  }

  const go = (to: string) => navigate(`/admin/sandbox/emails/${to}`)
  const prev = emails[index - 1]
  const next = emails[index + 1]

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      {header}

      <div className="grid grid-cols-[260px_minmax(0,1fr)_320px] max-[1280px]:grid-cols-[240px_minmax(0,1fr)] max-[980px]:grid-cols-1 gap-4 items-start">
        {/* ============ the list ============ */}
        <aside className={`${CARD} max-[980px]:hidden sticky top-4`} data-aos="fade-up">
          <EmailList emails={emails} />
        </aside>
        <div className="hidden max-[980px]:block" data-aos="fade-up">
          <EmailSelect emails={emails} value={email.slug} onChange={go} />
        </div>

        {/* ============ the preview ============ */}
        <section
          key={email.slug}
          className={`${CARD} min-w-0 animate-[fadeup_0.35s_ease-out]`}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div className="min-w-0">
              <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted mb-1">
                {AUDIENCE_LABEL[email.audience]}
              </div>
              <h2 className="font-display text-[18px] font-extrabold leading-[1.3] flex items-center gap-2 flex-wrap">
                {email.title}
                <StatusPill live={email.live} />
              </h2>
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Preview width">
              {(
                [
                  ['phone', 'Phone', <Smartphone key="p" size={14} />],
                  ['desktop', 'Desktop', <Monitor key="d" size={14} />],
                ] as const
              ).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={width === value}
                  onClick={() => setWidth(value)}
                  className={`${SEG} ${width === value ? SEG_ON : SEG_OFF} !px-3 !py-1.5 inline-flex items-center gap-1.5 text-[12px]`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-[90px_minmax(0,1fr)] max-[520px]:grid-cols-1 gap-x-3 gap-y-2 text-[13px] mb-5 rounded-[12px] border border-border bg-surface2 p-4">
            <dt className="text-muted font-bold">Subject</dt>
            <dd className="text-text font-bold break-words">{email.subject}</dd>
            <dt className="text-muted font-bold max-[520px]:mt-1">To</dt>
            <dd className="text-text break-words">{email.to}</dd>
            <dt className="text-muted font-bold max-[520px]:mt-1">Sent</dt>
            <dd className="text-text">{email.trigger}</dd>
            {email.note && (
              <>
                <dt className="text-muted font-bold max-[520px]:mt-1">Note</dt>
                <dd className="text-muted">{email.note}</dd>
              </>
            )}
          </dl>

          <EmailFrame html={email.html} title={email.title} width={width} />

          <div className="flex items-center justify-between gap-2 mt-4">
            <button
              type="button"
              className={`${BTN} ${BTN_GHOST} ${BTN_SM}`}
              disabled={!prev}
              onClick={() => prev && go(prev.slug)}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-[12px] text-muted">
              {index + 1} of {emails.length}
            </span>
            <button
              type="button"
              className={`${BTN} ${BTN_GHOST} ${BTN_SM}`}
              disabled={!next}
              onClick={() => next && go(next.slug)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </section>

        {/* ============ send a copy ============ */}
        <div className="max-[1280px]:col-start-2 max-[980px]:col-start-auto min-w-0">
          <SendPreviewCard
            current={email}
            total={emails.length}
            from={data.from}
            suggestions={data.team_recipients}
            delivers={data.delivers}
          />
        </div>
      </div>
    </AdminLayout>
  )
}
