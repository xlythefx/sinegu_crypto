import { displaySymbol } from '../../lib/chart'
import { fmtDateTime, fmtSignedPct } from '../../lib/format'
import { SOCIAL_LINKS } from '../../lib/company'
import type { RecentClose } from '../../types/publicStats'
import { CONTAINER, H2, LANDING_IDS, LEAD } from './layout'

/** Squares in the widest result's bar. */
const BAR_CELLS = 10

const CHANNEL_URL = SOCIAL_LINKS.find((s) => s.id === 'telegram')?.href ?? null

interface RecentClosesProps {
  closes: RecentClose[]
  loading: boolean
  error: unknown
}

/** How many lit squares a result gets — the biggest move fills the bar. */
function cellsFor(pct: number, widest: number): number {
  if (widest <= 0) return 0
  return Math.max(1, Math.round((Math.abs(pct) / widest) * BAR_CELLS))
}

function PixelBar({ cells, positive }: { cells: number; positive: boolean }) {
  return (
    <svg
      width={BAR_CELLS * 7}
      height={6}
      viewBox={`0 0 ${BAR_CELLS * 7} 6`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="max-[560px]:hidden"
    >
      {Array.from({ length: BAR_CELLS }, (_, i) => (
        <rect
          key={i}
          x={i * 7}
          y={0}
          width={6}
          height={6}
          fill={i < cells ? (positive ? 'var(--green)' : 'var(--red)') : 'var(--hair)'}
        />
      ))}
    </svg>
  )
}

const ROW =
  'grid grid-cols-[1.3fr_1fr_0.8fr_1.4fr] items-center gap-4 py-3.5 px-5 max-[560px]:grid-cols-[1fr_auto] max-[560px]:gap-y-1 max-[560px]:px-4'

/**
 * The latest closes of the published record — the trades themselves, so a
 * visitor sees results before any claim about them. Percentages only, from
 * the public track record (`recent_closes`), each measured the way the
 * Telegram channel measures its exit message.
 */
export default function RecentCloses({ closes, loading, error }: RecentClosesProps) {
  const widest = Math.max(0, ...closes.map((c) => Math.abs(c.pct)))
  const empty = loading
    ? null
    : error
      ? 'The latest trades cannot be loaded right now.'
      : 'No closed trades to show yet.'

  return (
    <section id={LANDING_IDS.latestTrades} className="scroll-mt-6 border-t border-hair">
      <div className={`${CONTAINER} py-16 grid grid-cols-[0.8fr_1.2fr] gap-12 items-start max-[960px]:grid-cols-1 max-[960px]:gap-8`} data-aos="fade-up">
        <div>
          <h2 className={`${H2} mb-4`}>The strategy&rsquo;s latest closed trades</h2>
          <p className={LEAD}>
            What our own account made or lost on each trade, after exchange
            fees, as a share of its balance that day. Losing trades are listed
            exactly like winning ones.
          </p>
          {CHANNEL_URL && (
            <p className="text-sm text-muted mt-4">
              Every close is also posted on{' '}
              <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
                our Telegram channel
              </a>{' '}
              as it happens.
            </p>
          )}
        </div>

        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className={`${ROW} border-b border-hair font-mono text-[11px] uppercase tracking-[0.06em] text-faint max-[560px]:hidden`}>
            <span>Closed</span>
            <span>Market</span>
            <span>Side</span>
            <span className="text-right">Result</span>
          </div>
          {loading && closes.length === 0 ? (
            <div aria-busy="true" aria-label="Loading the latest trades">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={`${ROW} border-b border-hair last:border-b-0`}>
                  <span className="h-3.5 w-28 rounded bg-surface2 animate-pulse" />
                  <span className="h-3.5 w-20 rounded bg-surface2 animate-pulse max-[560px]:hidden" />
                  <span className="h-3.5 w-12 rounded bg-surface2 animate-pulse max-[560px]:hidden" />
                  <span className="h-3.5 w-16 rounded bg-surface2 animate-pulse justify-self-end" />
                </div>
              ))}
            </div>
          ) : closes.length === 0 ? (
            <p className="py-10 px-5 text-center text-muted text-sm">{empty}</p>
          ) : (
            <ul>
              {closes.map((c) => {
                const positive = c.pct >= 0
                return (
                  <li key={`${c.exchange}-${c.closed_at}-${c.symbol}`} className={`${ROW} border-b border-hair last:border-b-0`}>
                    <span className="font-mono text-[13px] text-muted max-[560px]:order-3 max-[560px]:text-[12px]">
                      {fmtDateTime(c.closed_at)}
                    </span>
                    <span className="font-semibold text-[15px] max-[560px]:order-1">
                      {displaySymbol(c.symbol)}
                      <span className="hidden max-[560px]:inline font-mono text-[11px] text-faint ml-2">
                        {c.side ?? ''}
                      </span>
                    </span>
                    <span className="max-[560px]:hidden">
                      {c.side && (
                        <span
                          className={`font-mono text-[11px] font-semibold py-1 px-2 rounded-[4px] border ${
                            c.side === 'LONG'
                              ? 'text-green border-[color-mix(in_srgb,var(--green)_35%,transparent)]'
                              : 'text-red border-[color-mix(in_srgb,var(--red)_35%,transparent)]'
                          }`}
                        >
                          {c.side}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center justify-end gap-3 max-[560px]:order-2">
                      <PixelBar cells={cellsFor(c.pct, widest)} positive={positive} />
                      <span className={`font-mono text-[15px] font-semibold tabular-nums ${positive ? 'text-green' : 'text-red'}`}>
                        {fmtSignedPct(c.pct, 2)}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
