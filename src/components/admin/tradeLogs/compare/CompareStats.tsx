import type { ReactNode } from 'react'
import { GitCompareArrows, Radio, TestTubeDiagonal, Timer } from 'lucide-react'
import { fmtDateTime } from '../../../../lib/format'
import { FEED_SOURCE, averageLine, fmtGap } from '../../../../lib/feedCompare'
import { plural } from '../../../../lib/signalHealth'
import type { FeedCompareSummary } from '../../../../types/feedCompare'

const STAT_ICON =
  'w-10 h-10 flex-shrink-0 grid place-items-center rounded-[11px] bg-surface2 border border-border'
const NOTE = 'text-[12.5px] leading-[1.55] text-muted'
const NOTE_KEY = 'font-semibold text-text'

/**
 * The comparison's totals: how many signals paired, who arrived first how
 * often, and the average lead — then one line each for fills, time on the
 * way, the worst gap and what was left out.
 */
export default function CompareStats({
  summary,
  matchSeconds,
}: {
  summary: FeedCompareSummary | null
  matchSeconds: number
}) {
  const s = summary
  const oneSide = s ? s.mainOnly + s.testOnly : 0

  return (
    <div className="mb-[18px]" data-aos="fade-up">
      <div className="grid grid-cols-4 gap-[14px] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
        <StatCard
          icon={<GitCompareArrows size={18} />}
          label="Paired signals"
          value={s?.pairs ?? null}
          sub={s ? (oneSide > 0 ? `${oneSide} sent by one side only` : `within ${matchSeconds / 60} minutes`) : undefined}
        />
        <StatCard
          icon={<Radio size={18} />}
          label={`${FEED_SOURCE.main} first`}
          value={s?.mainFirst ?? null}
          sub={s && s.ties > 0 ? `${s.ties} tied` : undefined}
        />
        <StatCard
          icon={<TestTubeDiagonal size={18} />}
          label={`${FEED_SOURCE.test} first`}
          value={s?.testFirst ?? null}
        />
        <StatCard
          icon={<Timer size={18} />}
          tone="text-accent"
          label="Average lead"
          value={s?.avgGapMs != null ? fmtGap(s.avgGapMs) : null}
          sub={averageLine(s?.avgGapMs ?? null) ?? undefined}
        />
      </div>

      {s && s.pairs > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-card border border-hair bg-surface px-4 py-3">
          <p className={NOTE}>
            <span className={NOTE_KEY}>Fills: </span>
            {s.prices.compared > 0
              ? `${FEED_SOURCE.test} better ${s.prices.testBetter} · ${FEED_SOURCE.main} better ${s.prices.mainBetter}${
                  s.prices.same ? ` · same ${s.prices.same}` : ''
                } (real-money fills only)`
              : 'no pair where both the master and the tester filled on real money yet'}
            {s.prices.demo > 0 && ` · ${s.prices.demo} left out because one side trades on demo`}
          </p>
          <p className={NOTE}>
            <span className={NOTE_KEY}>On the way </span>(fired → reached us):{' '}
            {FEED_SOURCE.main} {s.avgTransitMs.main !== null ? fmtGap(s.avgTransitMs.main) : 'no fire time sent'} ·{' '}
            {FEED_SOURCE.test} {s.avgTransitMs.test !== null ? fmtGap(s.avgTransitMs.test) : 'no fire time sent'}
          </p>
          {s.worst && (
            <p className={NOTE}>
              <span className={NOTE_KEY}>Biggest gap: </span>
              {fmtGap(s.worst.gapMs)} — {s.worst.ticker} {s.worst.action.replace('_', ' ')},{' '}
              {fmtDateTime(s.worst.at)} ({FEED_SOURCE[s.worst.gapMs > 0 ? 'main' : 'test']} first)
            </p>
          )}
        </div>
      )}
      {s && (s.notCompared.main > 0 || s.notCompared.test > 0) && (
        <p className="mt-2.5 text-[12px] leading-[1.55] text-faint">
          Left out: {plural(s.notCompared.main + s.notCompared.test, 'signal', 'signals')} on coins only one side
          sent in these dates
          {s.notCompared.main > 0 && ` (${s.notCompared.main} ${FEED_SOURCE.main})`}
          {s.notCompared.test > 0 && ` (${s.notCompared.test} ${FEED_SOURCE.test})`} — there is nothing to compare
          them with.
        </p>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone = 'text-muted',
  sub,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  tone?: string
  sub?: string
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-card flex items-center gap-[13px]">
      <span className={`${STAT_ICON} ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]">{label}</p>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[19px] font-bold text-text leading-[1.1] font-mono">{value ?? '—'}</span>
          {sub && <span className="text-[12px] font-semibold text-faint">{sub}</span>}
        </p>
      </div>
    </div>
  )
}
