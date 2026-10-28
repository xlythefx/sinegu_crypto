import { BarChart3 } from 'lucide-react'
import { EmptyNote, InsightCard } from '../insights/parts'
import { fmtShortDate } from '../../../lib/format'
import type { VisitorSummary } from '../../../types/visitors'

/** Above this many bars the per-bar numbers would collide; the hover keeps them. */
const LABEL_BARS_MAX = 16

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

/**
 * Visitors per day (per week for a long period) as bars, with the day's
 * sign-ups as a green count above its bar. Every bucket of the period is
 * drawn, empty ones as a hairline, so the x axis is the calendar and a quiet
 * day is visible as quiet.
 */
export default function VisitorChart({ summary }: { summary: VisitorSummary }) {
  const { series, bucket } = summary
  const weekly = bucket === 'week'
  const max = Math.max(1, ...series.map((b) => b.visitors))
  const anything = series.some((b) => b.visitors > 0 || b.signups > 0)
  const showNumbers = series.length <= LABEL_BARS_MAX

  return (
    <InsightCard
      icon={BarChart3}
      title={weekly ? 'Visitors per week' : 'Visitors per day'}
      subtitle="Bars are visitors; the green number above a bar is that day's sign-ups (UTC days)"
    >
      {!anything ? (
        <EmptyNote>No visitors in this period yet.</EmptyNote>
      ) : (
        <>
          <div
            role="img"
            aria-label={`${plural(summary.totals.visitors, 'visitor', 'visitors')} and ${plural(summary.totals.signups, 'sign-up', 'sign-ups')} over ${plural(series.length, weekly ? 'week' : 'day', weekly ? 'weeks' : 'days')}`}
            className={`flex h-[180px] items-end ${series.length > 45 ? 'gap-px' : 'gap-1'}`}
          >
            {series.map((b) => (
              <div
                key={b.start}
                title={`${weekly ? 'Week of ' : ''}${fmtShortDate(b.start)}: ${plural(b.visitors, 'visitor', 'visitors')} · ${plural(b.views, 'page view', 'page views')} · ${plural(b.signups, 'sign-up', 'sign-ups')}`}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              >
                {b.signups > 0 && (
                  <span className="rounded-pill bg-green/15 px-1 font-mono text-[10px] font-bold leading-[1.5] text-green">
                    {b.signups}
                  </span>
                )}
                {showNumbers && b.visitors > 0 && (
                  <span className="font-mono text-[10.5px] text-muted">{b.visitors}</span>
                )}
                <div
                  className={`w-full rounded-t-[4px] ${b.visitors > 0 ? 'bg-accent' : 'bg-border'}`}
                  // 80% at most, so the numbers above the tallest bar stay inside the card.
                  style={{ height: `${(b.visitors / max) * 80}%`, minHeight: b.visitors ? 4 : 1 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-faint">
            <span>{fmtShortDate(series[0]?.start ?? '')}</span>
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[2px] bg-accent" aria-hidden="true" /> Visitors
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" /> Sign-ups
              </span>
            </span>
            <span>{fmtShortDate(series[series.length - 1]?.start ?? '')}</span>
          </div>
        </>
      )}
    </InsightCard>
  )
}
