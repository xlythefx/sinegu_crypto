import { Link } from 'react-router-dom'
import { Filter, Globe2, Link2, Megaphone } from 'lucide-react'
import { BarRow, EmptyNote, InsightCard } from '../insights/parts'
import { SIGNUP_SOURCE_LABELS } from '../../../lib/signupSources'
import { VISIT_FUNNEL_LABELS } from '../../../lib/visitorLabels'
import type { VisitorSummary } from '../../../types/visitors'

/** From a visit to a connected exchange: where people drop off in this period. */
export function FunnelCard({ funnel }: { funnel: VisitorSummary['funnel'] }) {
  const top = Math.max(1, ...funnel.map((s) => s.count))
  return (
    <InsightCard
      icon={Filter}
      title="From visit to trading"
      subtitle="This period's visitors, then how far this period's sign-ups have got"
    >
      <div className="flex flex-col gap-3.5">
        {funnel.map((step, i) => {
          const prev = i > 0 ? funnel[i - 1].count : null
          const kept = prev ? Math.round((step.count / prev) * 100) : null
          return (
            <BarRow
              key={step.key}
              label={
                <>
                  {VISIT_FUNNEL_LABELS[step.key]}
                  {kept !== null && (
                    <span className="ml-2 text-[11.5px] text-muted">{kept}% of previous step</span>
                  )}
                </>
              }
              value={step.count}
              max={top}
              tone={i >= 2 ? 'green' : 'accent'}
            />
          )
        })}
      </div>
    </InsightCard>
  )
}

/** The site that sent each visit (first page only), Google's many domains as one. */
export function SourcesCard({ sources }: { sources: VisitorSummary['sources'] }) {
  const max = Math.max(1, ...sources.map((s) => s.visitors))
  return (
    <InsightCard icon={Globe2} title="Where they came from" subtitle="The site that sent them to us">
      {sources.length === 0 ? (
        <EmptyNote>No visits in this period yet.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((s) => (
            <BarRow
              key={s.label}
              label={
                <span title={s.hosts.length ? s.hosts.join(', ') : undefined}>
                  {s.label}
                  {s.direct && <span className="ml-2 text-[11.5px] text-muted">typed in, bookmark or app</span>}
                </span>
              }
              value={s.visitors}
              max={max}
            />
          ))}
        </div>
      )}
    </InsightCard>
  )
}

/** Invite links (`?ref=`) with whose code it is, and tagged campaign links (`utm_*`). */
export function InvitesCard({
  codes,
  campaigns,
}: {
  codes: VisitorSummary['referral_codes']
  campaigns: VisitorSummary['campaigns']
}) {
  return (
    <InsightCard icon={Link2} title="Invite & campaign links" subtitle="Visitors who arrived through a tracked link">
      {codes.length === 0 && campaigns.length === 0 ? (
        <EmptyNote>No one came through an invite or campaign link in this period.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-4">
          {codes.length > 0 && (
            <ul className="flex flex-col divide-y divide-hair">
              {codes.map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate font-mono font-semibold">{c.code}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {c.owner ? (
                        <>
                          Invite link of{' '}
                          <Link to={`/admin/users/${c.owner.uni_id}`} className="font-semibold text-text hover:text-accent">
                            {c.owner.name ?? 'a user'}
                          </Link>
                        </>
                      ) : (
                        'Invite link'
                      )}
                    </span>
                  </span>
                  <span className="flex-none font-mono font-bold">{c.visitors.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
          {campaigns.length > 0 && (
            <ul className="flex flex-col divide-y divide-hair">
              {campaigns.map((c) => (
                <li
                  key={`${c.source ?? ''}|${c.campaign ?? ''}`}
                  className="flex items-center justify-between gap-3 py-2 text-[13px]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.campaign ?? 'No campaign name'}</span>
                    <span className="block truncate text-[12px] text-muted">Campaign · source: {c.source ?? 'not set'}</span>
                  </span>
                  <span className="flex-none font-mono font-bold">{c.visitors.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </InsightCard>
  )
}

/** "Where did you hear about us?" as this period's sign-ups answered it (any number of tiles each). */
export function HeardAboutCard({ answers }: { answers: VisitorSummary['heard_about'] }) {
  const max = Math.max(1, ...answers.map((a) => a.count))
  return (
    <InsightCard
      icon={Megaphone}
      title="What new sign-ups told us"
      subtitle="“Where did you hear about us?” — one person can tick several"
    >
      {answers.length === 0 ? (
        <EmptyNote>No sign-up in this period answered it.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-3">
          {answers.map((a) => (
            <BarRow
              key={a.slug}
              label={SIGNUP_SOURCE_LABELS[a.slug] ?? a.slug}
              value={a.count}
              max={max}
              tone="green"
            />
          ))}
        </div>
      )}
    </InsightCard>
  )
}
