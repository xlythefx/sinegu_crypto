import { ShieldCheck } from 'lucide-react'
import { fmtMediumDate } from '../../../lib/format'
import { VISIT_FILTER_LABELS } from '../../../lib/visitorLabels'
import type { VisitFilterReason, VisitorSummary } from '../../../types/visitors'

const ORDER: (VisitFilterReason | 'suspicious')[] = [
  'bot',
  'repeat',
  'suspicious',
  'flood',
  'foreign',
  'unknown_page',
  'team',
]

/**
 * What the spam filter kept OUT of the numbers in this period, one chip per
 * reason (hover for what it means), so the counts above can be trusted
 * without taking them on faith. Only reasons that caught something are
 * shown.
 */
export default function SpamFilterStrip({ summary }: { summary: VisitorSummary }) {
  const caught = ORDER.filter((r) => summary.filtered[r] > 0)

  return (
    <section className="flex flex-col gap-2.5 rounded-card border border-border bg-surface px-card py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex flex-none items-center gap-2">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <ShieldCheck size={15} />
        </span>
        <span className="text-[13px] font-semibold">Not counted</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {caught.length === 0 ? (
          <span className="text-[12.5px] text-muted">Nothing filtered out in this period.</span>
        ) : (
          caught.map((reason) => (
            <span
              key={reason}
              title={VISIT_FILTER_LABELS[reason].hint}
              className="inline-flex cursor-help items-center gap-1.5 rounded-pill border border-hair bg-surface2 px-2.5 py-[3px] text-[12px] text-muted"
            >
              {VISIT_FILTER_LABELS[reason].label}
              <span className="font-mono font-bold text-text">{summary.filtered[reason].toLocaleString()}</span>
            </span>
          ))
        )}
      </div>

      <p className="m-0 flex-none text-[11.5px] text-faint sm:max-w-[260px] sm:text-right">
        {summary.since ? `Counting since ${fmtMediumDate(summary.since)}. ` : 'Nothing counted yet. '}
        IP addresses are deleted after {summary.ip_days} days.
      </p>
    </section>
  )
}
