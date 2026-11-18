import { ShieldAlert } from 'lucide-react'
import { FEED_NAME } from '../../../lib/feeds'
import { plural } from '../../../lib/signalHealth'
import type { SignalFeed, TradeLogBreach } from '../../../types/tradeLogs'

/**
 * The high-risk proof on a Signal Log row: accounts that FILLED an entry on
 * this signal's feed although their owner's role belongs to another feed
 * (a customer filling on the sub-master feed, a tester on the main one). The
 * feeds are meant to be disjoint, so this is always red and always visible —
 * never folded inside the expanded row.
 */
export default function FeedBreachStrip({
  feed,
  breach,
}: {
  feed: SignalFeed
  breach: TradeLogBreach[]
}) {
  return (
    <div
      role="alert"
      className="mx-card mb-card flex items-start gap-3 rounded-field border border-[color-mix(in_srgb,var(--red)_42%,transparent)] bg-[color-mix(in_srgb,var(--red)_9%,transparent)] px-3.5 py-3 max-[480px]:mx-3.5 max-[480px]:mb-3.5"
    >
      <ShieldAlert size={17} className="mt-px flex-none text-red" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-red">Wrong accounts filled</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">
          {plural(breach.length, 'account', 'accounts')} filled this entry on the{' '}
          {FEED_NAME[feed]} feed although {breach.length === 1 ? 'it belongs' : 'they belong'} to
          another feed.
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {breach.map((b) => (
            <li
              key={`${b.uniId}-${b.account ?? ''}`}
              className="text-[12.5px] leading-snug text-text break-words"
            >
              <span className="font-semibold">{b.owner ?? b.uniId}</span>
              {b.account && <span className="text-muted"> · {b.account}</span>}
              <span className="text-muted">
                {' '}
                — role {b.role ?? 'unknown'}, belongs to the {FEED_NAME[b.expectedFeed]} feed
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
