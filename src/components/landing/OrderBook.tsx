import { Fragment, useState } from 'react'
import { useApiData } from '../../hooks/useApiData'
import { usePoll } from '../../hooks/usePoll'
import { getOrderBook, ORDER_BOOK_REFRESH_MS } from '../../services/market'
import { fmtNum, fmtSignedPct } from '../../lib/format'
import { bookIsLive, buildBookModel, fmtCompactUsd } from '../../lib/orderBook'

// `h-full` so this face fills the shared grid cell HeroCard stacks it in —
// both faces are the same height, and the card never resizes mid-turn.
const CARD =
  'h-full relative bg-surface border border-border rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.18)]'
const ROW = 'flex justify-between py-[3px] relative'
const SIZE = 'text-muted'
const COLUMN_HEAD = 'text-faint text-[10px] flex justify-between mb-2'

/** Prices move by cents here, so the ladder needs its decimals. */
const priceOf = (price: number): string => fmtNum(price, price >= 1 ? 2 : 6)

/**
 * The hero's live order book — the top of Binance's BTC perpetual book, read
 * through `/public/order-book` and refreshed every few seconds.
 *
 * Everything on the card is the venue's own data. It used to carry a strategy
 * name ("Z-Score Reversion #2") and a fixed ±0.5% depth caption; both are
 * gone. The first was a claim about what we run, on a card that is really just
 * showing a market, and the second was unmeetable — the published depth covers
 * a sliver of a percent of the book at any sane weight, so the footer now
 * states the band it actually reached.
 *
 * The rows transition rather than snap, so a book that changes by one level
 * reads as movement instead of a flicker.
 */
export default function OrderBook() {
  const { data, reload } = useApiData(getOrderBook)
  const [now, setNow] = useState(() => Date.now())

  usePoll(() => {
    setNow(Date.now())
    reload()
  }, ORDER_BOOK_REFRESH_MS)

  const book = data ? buildBookModel(data.bids, data.asks) : null
  const live = bookIsLive(data?.book_at ?? null, now)

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between py-4 px-5 border-b border-hair flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-base">{data?.label ?? 'BTC-PERP'}</span>
          <span className="font-mono text-[13px] text-green">
            {data?.price == null ? '—' : priceOf(data.price)}
          </span>
          {data?.change_pct != null && (
            <span
              className={`font-mono text-[10px] border py-0.5 px-2 rounded-pill ${
                data.change_pct < 0
                  ? 'text-red border-[rgba(255,90,90,0.35)] bg-[rgba(255,90,90,0.08)]'
                  : 'text-green border-[rgba(47,214,122,0.35)] bg-[rgba(47,214,122,0.08)]'
              }`}
            >
              {fmtSignedPct(data.change_pct, 2)} 24h
            </span>
          )}
        </div>
        <div className="font-mono text-[11px] text-faint flex gap-3.5">
          {data?.quote_volume != null && (
            <span>24h Vol {fmtCompactUsd(data.quote_volume)}</span>
          )}
          {/* Tied to the EXCHANGE's stamp on the book, not to our own clock —
              a dot that says "live" because a timer fired says nothing. */}
          <span className={live ? 'text-accent' : ''}>
            {live ? '● live' : '○ reconnecting'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 font-mono text-xs">
        <div className="py-3.5 px-5 border-r border-hair">
          <div className={COLUMN_HEAD}>
            <span>PRICE</span>
            <span>SIZE</span>
          </div>
          {(book?.bids ?? []).map((row) => (
            <div className={ROW} key={row.price}>
              <span className="text-green">{priceOf(row.price)}</span>
              <span className={SIZE}>{fmtNum(row.size, 3)}</span>
              <span
                className="absolute top-0 bottom-0 right-0 bg-[rgba(47,214,122,0.1)] transition-[width] duration-500 ease-out"
                style={{ width: `${row.depthPct}%` }}
              />
            </div>
          ))}
        </div>
        <div className="py-3.5 px-5">
          <div className={COLUMN_HEAD}>
            <span>PRICE</span>
            <span>SIZE</span>
          </div>
          {(book?.asks ?? []).map((row) => (
            <div className={ROW} key={row.price}>
              <span className="text-red">{priceOf(row.price)}</span>
              <span className={SIZE}>{fmtNum(row.size, 3)}</span>
              <span
                className="absolute top-0 bottom-0 left-0 bg-[rgba(255,90,90,0.1)] transition-[width] duration-500 ease-out"
                style={{ width: `${row.depthPct}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-hair py-4 px-5">
        <div className="flex items-end gap-1 h-[74px]">
          {(book?.bars ?? []).map((bar, i, bars) => (
            <Fragment key={`${bar.side}-${i}`}>
              {/* The mid is a marker, not a bar: nothing rests there, and a
                  bar drawn at it would be decoration among measurements. */}
              {bar.side === 'ask' && bars[i - 1]?.side === 'bid' && (
                <span className="w-px self-stretch bg-accent opacity-60 shrink-0" />
              )}
              <div
                className={`flex-1 rounded-t-[4px] transition-[height] duration-500 ease-out ${
                  bar.side === 'bid' ? 'bg-green' : 'bg-red'
                }`}
                // A floor so an empty slice still reads as a slice rather than
                // a gap in the chart.
                style={{ height: `${Math.max(bar.heightPct, 2)}%` }}
              />
            </Fragment>
          ))}
        </div>
        <div className="flex justify-between font-mono text-[10px] text-faint mt-2">
          <span>{book ? `−${book.bandPct.toFixed(3)}% depth` : 'depth'}</span>
          <span>{book ? `MID ${priceOf(book.mid)}` : 'MID —'}</span>
          <span>{book ? `+${book.bandPct.toFixed(3)}% depth` : 'depth'}</span>
        </div>
      </div>
    </div>
  )
}
