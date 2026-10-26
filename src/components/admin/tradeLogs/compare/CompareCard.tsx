import { Radio, TestTubeDiagonal, Trophy } from 'lucide-react'
import SideTypePill from '../SideTypePill'
import { EXCHANGE_META } from '../../../exchanges/meta'
import { fmtDateTimeSeconds, fmtTimeMillis } from '../../../../lib/format'
import { FEED_ACCOUNT_ROLE, FEED_SOURCE, fmtGap, leadLine, outcomeText, priceLine } from '../../../../lib/feedCompare'
import { LABEL_CHIP, TONE } from '../tradeLogClasses'
import type { SignalFeed } from '../../../../types/feeds'
import type { FeedCompareRow, FeedSide } from '../../../../types/feedCompare'

const FEED_ICON = { main: Radio, test: TestTubeDiagonal }
const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint'
const FIELD = 'flex flex-col gap-0.5 min-w-0'
const VALUE = 'font-mono text-[12.5px] text-text break-words'

/**
 * One signal in the comparison: a header (side, coin, venue, when), the
 * verdict chips (who was first, who got the better price), then one panel per
 * feed. The feed that arrived first is outlined; a feed that did not send the
 * signal reads as such instead of an empty box.
 */
export default function CompareCard({ row, matchSeconds }: { row: FeedCompareRow; matchSeconds: number }) {
  const price = priceLine(row)
  const pair = row.kind === 'pair'
  const venue = row.exchange in EXCHANGE_META ? EXCHANGE_META[row.exchange].label : row.exchange

  return (
    <article className="rounded-[14px] border border-border bg-surface p-3.5 max-[480px]:p-3">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SideTypePill side={row.side} type={row.type} />
          <span className="font-mono text-[13.5px] font-bold text-text">{row.ticker}</span>
          <span className="text-[12px] text-muted">{venue}</span>
        </div>
        <span className="font-mono text-[12px] text-muted">{fmtDateTimeSeconds(row.at)}</span>
      </header>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className={`${LABEL_CHIP} ${pair ? TONE.good : TONE.neutral}`}>
          {pair && row.first !== 'tie' && <Trophy size={12} aria-hidden="true" />}
          {leadLine(row)}
        </span>
        {price && <span className={`${LABEL_CHIP} ${price.good ? TONE.good : TONE.neutral}`}>{price.text}</span>}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <FeedPanel feed="main" side={row.main} first={row.first === 'main'} matchSeconds={matchSeconds} />
        <FeedPanel feed="test" side={row.test} first={row.first === 'test'} matchSeconds={matchSeconds} />
      </div>
    </article>
  )
}

function FeedPanel({
  feed,
  side,
  first,
  matchSeconds,
}: {
  feed: SignalFeed
  side: FeedSide | null
  first: boolean
  matchSeconds: number
}) {
  const Icon = FEED_ICON[feed]
  const title = (
    <p className={`mb-2.5 flex items-center gap-1.5 ${LABEL}`}>
      <Icon size={12} aria-hidden="true" />
      {FEED_SOURCE[feed]}
      {first && <span className="text-accent">· first</span>}
    </p>
  )

  if (!side) {
    return (
      <div className="rounded-[12px] border border-dashed border-border p-3">
        {title}
        <p className="text-[12.5px] leading-[1.55] text-muted">
          Did not send this signal within {matchSeconds / 60} minutes.
        </p>
      </div>
    )
  }

  const filled = side.outcome === 'filled'
  return (
    <div className={`rounded-[12px] border p-3 ${first ? 'border-accent-line bg-accent-soft' : 'border-hair bg-surface2'}`}>
      {title}
      <div className="flex flex-col gap-2.5">
        <div className={FIELD}>
          <span className={LABEL}>Reached us</span>
          <span className={`${VALUE} font-semibold`}>{fmtTimeMillis(side.receivedAt)}</span>
        </div>
        <div className={FIELD}>
          <span className={LABEL}>Fired</span>
          <span className={VALUE}>
            {side.sentAt ? (
              <>
                {fmtTimeMillis(side.sentAt)}
                {side.transitMs !== null && (
                  <span className="text-muted"> · {fmtGap(side.transitMs)} on the way</span>
                )}
              </>
            ) : (
              <span className="text-muted">not sent with the signal</span>
            )}
          </span>
        </div>
        <div className={FIELD}>
          <span className={LABEL}>
            {FEED_ACCOUNT_ROLE[feed]}
            {side.account ? ` · ${side.account}` : ''}
          </span>
          <span className={`flex flex-wrap items-center gap-1.5 ${VALUE} ${filled ? 'text-green' : 'text-muted'}`}>
            {outcomeText(side, feed)}
            {side.demo && <span className={`${LABEL_CHIP} ${TONE.neutral} font-body`}>Demo</span>}
          </span>
        </div>
        {side.strategy && (
          <div className={FIELD}>
            <span className={LABEL}>Strategy</span>
            <span className={VALUE}>{side.strategy}</span>
          </div>
        )}
      </div>
    </div>
  )
}
