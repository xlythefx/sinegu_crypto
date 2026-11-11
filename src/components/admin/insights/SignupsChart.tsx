import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { EmptyNote, InsightCard } from './parts'
import { fmtShortDate } from '../../../lib/format'
import { niceScale } from '../../../lib/visitorChart'

interface Week {
  week: string
  signups: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** "Sep 21 – 27" / "Sep 28 – Oct 4" for the Monday a week starts on (UTC). */
function weekSpan(start: string): string {
  const end = new Date(Date.parse(`${start.slice(0, 10)}T00:00:00Z`) + 6 * DAY_MS).toISOString().slice(0, 10)
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  return `${fmtShortDate(start)} – ${sameMonth ? Number(end.slice(8, 10)) : fmtShortDate(end)}`
}

const plural = (n: number) => `${n} ${n === 1 ? 'sign-up' : 'sign-ups'}`

/**
 * Customer sign-ups per week (Monday–Sunday, UTC), last 12 weeks.
 *
 * 2026-11-11 (Dima: "not accurate the dates, it's hard to read"): the counts
 * were right but the bars had no dates, no scale, and their numbers only
 * showed on a mouse hover — nothing on a phone. Now: a scale, a date under
 * every other bar (every one would collide at this card's width), the
 * current week drawn lighter as "so far", and a readout line that a tap,
 * hover or keyboard focus fills with the week's exact dates.
 */
export default function SignupsChart({ weeks }: { weeks: Week[] }) {
  const [active, setActive] = useState<number | null>(null)
  const total = weeks.reduce((s, w) => s + w.signups, 0)
  const { top, ticks } = niceScale(Math.max(0, ...weeks.map((w) => w.signups)))
  const last = weeks.length - 1
  const busiest = weeks.reduce<Week | null>((b, w) => (w.signups > (b?.signups ?? 0) ? w : b), null)
  const describe = (i: number) =>
    i === last
      ? `This week (${weekSpan(weeks[i].week)}, so far): ${plural(weeks[i].signups)}`
      : `Week of ${weekSpan(weeks[i].week)}: ${plural(weeks[i].signups)}`

  return (
    <InsightCard
      icon={UserPlus}
      title="New sign-ups"
      subtitle="Per week (Monday to Sunday, UTC), last 12 weeks"
      link={{ to: '/admin/visitors', label: 'Per day' }}
    >
      {weeks.length === 0 ? (
        <EmptyNote>No sign-ups yet.</EmptyNote>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative h-[150px] w-5 flex-none pt-5" aria-hidden="true">
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
              className="relative h-[150px] min-w-0 flex-1 pt-5"
              onMouseLeave={() => setActive(null)}
              role="group"
              aria-label={`${plural(total)} over ${weeks.length} weeks`}
            >
              <div className="relative h-full">
                {/* 1px fills, not borders: no Tailwind preflight in this app. */}
                {ticks.map((t) => (
                  <div
                    key={t}
                    aria-hidden="true"
                    className={`absolute inset-x-0 h-px ${t === 0 ? 'bg-border' : 'bg-hair'}`}
                    style={{ bottom: `${(t / top) * 100}%` }}
                  />
                ))}
                <div className="absolute inset-0 flex items-end gap-1">
                  {weeks.map((w, i) => {
                    const pct = (w.signups / top) * 100
                    const current = i === last
                    const dim = active !== null && active !== i
                    return (
                      <button
                        key={w.week}
                        type="button"
                        aria-label={describe(i)}
                        onMouseEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        onClick={() => setActive(i)}
                        className="relative h-full min-w-0 flex-1 cursor-pointer rounded-t-[4px] border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <span
                          className={`absolute inset-x-0 bottom-0 rounded-t-[4px] transition-opacity duration-150 ${
                            w.signups === 0 ? 'bg-border' : current ? 'bg-accent/45' : 'bg-accent'
                          } ${dim ? 'opacity-35' : ''}`}
                          style={{ height: `${pct}%`, minHeight: w.signups ? 4 : 1 }}
                        />
                        {w.signups > 0 && (
                          <span
                            className="absolute inset-x-0 text-center font-mono text-[10.5px] leading-none text-muted"
                            style={{ bottom: `calc(${pct}% + 4px)` }}
                          >
                            {w.signups}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Dates under the bars: every other week, counted back from this one. */}
          <div className="mt-1.5 flex gap-1 pl-7" aria-hidden="true">
            {weeks.map((w, i) => (
              <span key={w.week} className="relative h-3.5 min-w-0 flex-1">
                {(last - i) % 2 === 0 && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-faint">
                    {i === last ? 'Now' : fmtShortDate(w.week)}
                  </span>
                )}
              </span>
            ))}
          </div>

          <p
            className="mt-3 min-h-[38px] rounded-row border border-border bg-surface2 px-3 py-2 text-[12.5px] text-muted"
            aria-live="polite"
          >
            {active !== null ? (
              <span className="text-text">{describe(active)}</span>
            ) : (
              <>
                <span className="text-text">{plural(total)}</span> in 12 weeks
                {busiest && (
                  <>
                    {' '}· busiest: week of {weekSpan(busiest.week)} ({busiest.signups})
                  </>
                )}
                <span className="text-faint"> · tap a bar for its dates</span>
              </>
            )}
          </p>
        </>
      )}
    </InsightCard>
  )
}
