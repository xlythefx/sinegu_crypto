import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { EmptyNote, InsightCard } from '../insights/parts'
import { fmtShortDate } from '../../../lib/format'
import { fromTrackingStart, niceScale } from '../../../lib/visitorChart'
import type { VisitorSummary } from '../../../types/visitors'

/** Above this many bars the per-bar numbers would collide; the scale and the tap line keep them. */
const LABEL_BARS_MAX = 16
/** Room above the plot for the tallest bar's number and sign-up badge. */
const HEADROOM = 'pt-9'

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

/**
 * Visitors per day (per week for a long period) as bars on a labelled scale,
 * with the day's sign-ups as a green count above its bar. Every bucket from
 * the day counting began is drawn, empty ones as a hairline, so the x axis is
 * the calendar and a quiet day reads as quiet.
 *
 * Hover, focus or tap a bar and its numbers show under the chart — the one
 * reading that works on a phone, where a `title` tooltip never appears.
 */
export default function VisitorChart({ summary }: { summary: VisitorSummary }) {
  const weekly = summary.bucket === 'week'
  const { series, trimmed } = fromTrackingStart(summary.series, summary.since, summary.bucket)
  const [active, setActive] = useState<number | null>(null)

  const { top, ticks } = niceScale(Math.max(0, ...series.map((b) => b.visitors)))
  const anything = series.some((b) => b.visitors > 0 || b.signups > 0)
  const showNumbers = series.length <= LABEL_BARS_MAX
  const busiest = series.reduce<(typeof series)[number] | null>(
    (best, b) => (b.visitors > (best?.visitors ?? 0) ? b : best),
    null,
  )
  const picked = active === null ? null : series[active] ?? null
  const describe = (b: (typeof series)[number]) =>
    `${weekly ? 'Week of ' : ''}${fmtShortDate(b.start)}: ${plural(b.visitors, 'visitor', 'visitors')} · ${plural(b.views, 'page view', 'page views')} · ${plural(b.signups, 'sign-up', 'sign-ups')}`

  return (
    <InsightCard
      icon={BarChart3}
      title={weekly ? 'Visitors per week' : 'Visitors per day'}
      subtitle="Bars are visitors (scale on the left); the green number above a bar is that day's sign-ups. UTC days."
    >
      {!anything ? (
        <EmptyNote>No visitors in this period yet.</EmptyNote>
      ) : (
        <>
          <div className="flex gap-2">
            {/* Scale: same headroom as the plot, so a label sits on its gridline. */}
            <div className={`relative h-[200px] w-7 flex-none ${HEADROOM}`} aria-hidden="true">
              <div className="relative h-full">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute right-0 translate-y-1/2 font-mono text-[10px] leading-none text-faint"
                    style={{ bottom: `${(t / top) * 100}%` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div
              className={`relative h-[200px] min-w-0 flex-1 ${HEADROOM}`}
              onMouseLeave={() => setActive(null)}
              role="group"
              aria-label={`${plural(summary.totals.visitors, 'visitor', 'visitors')} and ${plural(summary.totals.signups, 'sign-up', 'sign-ups')} over ${plural(series.length, weekly ? 'week' : 'day', weekly ? 'weeks' : 'days')}`}
            >
              <div className="relative h-full">
                {/* 1px fills, not borders: the app loads no Tailwind preflight,
                    so a dashed border drew 3px on every side (a zipper). */}
                {ticks.map((t) => (
                  <div
                    key={t}
                    aria-hidden="true"
                    className={`absolute inset-x-0 h-px ${t === 0 ? 'bg-border' : 'bg-hair'}`}
                    style={{ bottom: `${(t / top) * 100}%` }}
                  />
                ))}
                <div className={`absolute inset-0 flex items-end ${series.length > 45 ? 'gap-px' : 'gap-1'}`}>
                  {series.map((b, i) => {
                    const pct = (b.visitors / top) * 100
                    const dim = active !== null && active !== i
                    return (
                      <button
                        key={b.start}
                        type="button"
                        aria-label={describe(b)}
                        title={describe(b)}
                        onMouseEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        onClick={() => setActive(i)}
                        className="relative h-full min-w-0 flex-1 cursor-pointer rounded-t-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <span
                          className={`absolute inset-x-0 bottom-0 rounded-t-[4px] transition-opacity duration-150 ${
                            b.visitors > 0 ? 'bg-accent' : 'bg-border'
                          } ${dim ? 'opacity-35' : ''}`}
                          style={{ height: `${pct}%`, minHeight: b.visitors ? 4 : 1 }}
                        />
                        {(b.signups > 0 || (showNumbers && b.visitors > 0)) && (
                          <span
                            className="absolute inset-x-0 flex flex-col items-center gap-0.5"
                            style={{ bottom: `calc(${pct}% + 3px)` }}
                          >
                            {b.signups > 0 && (
                              <span className="rounded-pill bg-green/15 px-1 font-mono text-[10px] font-bold leading-[1.5] text-green">
                                {b.signups}
                              </span>
                            )}
                            {showNumbers && b.visitors > 0 && (
                              <span className="font-mono text-[10.5px] leading-none text-muted">{b.visitors}</span>
                            )}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-1.5 flex justify-between gap-3 pl-9 text-[11px] text-faint">
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

          {/* The tapped / hovered bar's numbers; otherwise the busiest day. */}
          <p className="mt-3 min-h-[38px] rounded-row border border-border bg-surface2 px-3 py-2 text-[12.5px] text-muted" aria-live="polite">
            {picked ? (
              <span className="text-text">{describe(picked)}</span>
            ) : busiest ? (
              <>
                Busiest {weekly ? 'week' : 'day'}:{' '}
                <span className="text-text">{describe(busiest)}</span>
                <span className="text-faint"> · tap or hover a bar for its numbers</span>
              </>
            ) : (
              'Tap or hover a bar for its numbers.'
            )}
          </p>

          {trimmed && summary.since && (
            <p className="mt-2 text-[11.5px] text-faint">
              Visitor counting started on {fmtShortDate(summary.since)}, so the chart starts there. Sign-ups from
              before that are still in the totals above.
            </p>
          )}
        </>
      )}
    </InsightCard>
  )
}
