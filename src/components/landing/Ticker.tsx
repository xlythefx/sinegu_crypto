import { useEffect, useState } from 'react'
import { useApiData } from '../../hooks/useApiData'
import { getMarketTicker, MARKET_REFRESH_MS } from '../../services/market'
import { fmtNum, fmtSignedPct } from '../../lib/format'
import { trailingReturnPct } from '../../lib/trackRecord'
import type { TrackRecordPoint, TrackRecordStats } from '../../types/publicStats'

/** How many CALENDAR days the trailing-return item covers. */
const TRAILING_DAYS = 30

type Tone = 'up' | 'down' | 'accent' | ''

const DELTA_TONE: Record<string, string> = {
  up: 'text-green',
  down: 'text-red',
  accent: 'text-accent',
}

interface Item {
  label: string
  value: string
  /** The small trailing note. Null prints nothing rather than a placeholder. */
  delta: string | null
  tone: Tone
}

const signTone = (n: number): Tone => (n < 0 ? 'down' : 'up')

/** Two decimals down to a dollar, six below it — these are perp prices. */
const fmtPrice = (price: number): string => fmtNum(price, price >= 1 ? 2 : 6)

/**
 * "in 3h 12m" until funding is next charged. Null when the venue named no next
 * charge; "due now" once it is past, since the strip only re-reads every 30s.
 */
function untilLabel(iso: string | null, now: number): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now
  if (!Number.isFinite(ms)) return null
  if (ms <= 0) return 'due now'

  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)

  return hours > 0 ? `in ${hours}h ${minutes % 60}m` : `in ${minutes % 60}m`
}

interface TickerProps {
  /**
   * The landing page's verified record, fetched by the PAGE and passed down.
   *
   * Not fetched here on purpose: the record is narrowed to one strategy
   * (`LANDING_TRACK_RECORD_SYMBOLS`), so a second call from this component
   * would be a second set of arguments and could put a different return on the
   * same page as the track-record section 800px below it. One fetch, one
   * number. Omitted (Landing v2 has no performance section) simply drops the
   * two performance items.
   */
  stats?: TrackRecordStats | null
  series?: TrackRecordPoint[]
}

/**
 * The landing page's quote strip — live prices for the pairs the product
 * trades, the traded pair's funding rate, and the published record's returns.
 *
 * Every figure here is real. The invented ones it used to carry (a user count,
 * an "avg ROI") are gone: a marketing strip sits beside a verified track
 * record, and one made-up number next to it puts the rest in question.
 *
 * An item whose source could not be read is DROPPED, never printed as zero —
 * the same empty-vs-unavailable rule the engine's pollers follow. The bar keeps
 * its height either way so nothing below it moves.
 */
export default function Ticker({ stats = null, series = [] }: TickerProps) {
  const { data, reload } = useApiData(getMarketTicker)
  const [now, setNow] = useState(() => Date.now())

  // One interval does both jobs: re-read the quotes and advance the funding
  // countdown. A second timer would only make them disagree.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      reload()
    }, MARKET_REFRESH_MS)

    return () => clearInterval(id)
  }, [reload])

  const items: Item[] = []

  for (const quote of data?.quotes ?? []) {
    items.push({
      label: quote.label,
      value: fmtPrice(quote.price),
      delta: quote.change_pct === null ? null : fmtSignedPct(quote.change_pct, 2),
      tone: quote.change_pct === null ? '' : signTone(quote.change_pct),
    })
  }

  const funding = data?.funding ?? null
  if (funding) {
    items.push({
      // "LTC FUNDING" — the pair is already named by its own quote above.
      label: `${funding.label.split('/')[0]} FUNDING`,
      value: fmtSignedPct(funding.rate_pct, 4),
      delta: untilLabel(funding.next_at, now),
      // Deliberately not green/red: a positive funding rate is not good news
      // or bad news until you know which side the position is on.
      tone: 'accent',
    })
  }

  const trailing = trailingReturnPct(series, TRAILING_DAYS)
  if (trailing !== null) {
    items.push({
      label: `${TRAILING_DAYS}D RETURN`,
      value: fmtSignedPct(trailing, 2),
      delta: 'compounded',
      tone: signTone(trailing),
    })
  }

  if (stats?.return_on_capital_pct != null) {
    items.push({
      // Scope-free by design: the section below names no pair either (owner's
      // call, 2026-09-23), and this figure is that section's headline card.
      label: 'STRATEGY ROC',
      value: fmtSignedPct(stats.return_on_capital_pct, 2),
      delta: 'on capital invested',
      tone: signTone(stats.return_on_capital_pct),
    })
  }

  // Row duplicated once and translated -50% for a seamless infinite loop
  const row = [...items, ...items]

  return (
    <div className="border-b border-hair bg-surface2 overflow-hidden whitespace-nowrap">
      {/* The non-breaking space holds the bar's height before the first
          payload lands, so nothing below it jumps when the quotes arrive. */}
      <div className="inline-flex gap-9 py-[9px] font-mono text-[12.5px] tabular-nums animate-[tick_42s_linear_infinite] will-change-transform">
        {items.length === 0 ? (
          <span>&nbsp;</span>
        ) : (
          row.map((item, i) => (
            <span className="text-faint" key={`${item.label}-${i}`}>
              {item.label} <b className="text-text font-medium">{item.value}</b>
              {item.delta && (
                <>
                  {' '}
                  <span className={DELTA_TONE[item.tone]}>{item.delta}</span>
                </>
              )}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
