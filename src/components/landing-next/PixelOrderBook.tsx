import { Fragment } from 'react'
import { useOrderBook } from '../../hooks/useOrderBook'
import { fmtNum, fmtSignedPct } from '../../lib/format'
import { BOOK_BARS, BOOK_ROWS, fmtCompactUsd, litCells, type BookRow } from '../../lib/orderBook'

/** Each corner loses one square of this size: the pixel-art box. */
const NOTCH = 6

function notched(s: number): string {
  const r = `calc(100% - ${s}px)`
  return `polygon(${s}px 0, ${r} 0, ${r} ${s}px, 100% ${s}px, 100% ${r}, ${r} ${r}, ${r} 100%, ${s}px 100%, ${s}px ${r}, 0 ${r}, 0 ${s}px, ${s}px ${s}px)`
}

const CLIP = { clipPath: notched(NOTCH) }

/** Blocks per ladder meter. */
const LADDER_CELLS = 16
/** The histogram: blocks per bar, stacked, and columns per bar (the last
 *  column is dropped on a phone so eight bars still fit the card). */
const DEPTH_ROWS = 8
const DEPTH_COLS = 4

/** A dotted pixel rule. Not a dashed border: with no preflight here, a
 *  dashed border draws on every side of the element. */
const RULE = 'h-[2px] bg-[repeating-linear-gradient(90deg,var(--border)_0_4px,transparent_4px_8px)]'

/** Prices move by cents here, so the ladder needs its decimals. */
const priceOf = (price: number): string => fmtNum(price, price >= 1 ? 2 : 6)

/** How much of a ladder column a full meter may cover, in percent. Blocks
 *  are a share of the column, so they shrink on a phone instead of running
 *  under the prices. */
const METER_SPAN = 58

/** One ladder row: price and size over a meter of blocks. The meter grows
 *  from the middle of the card outwards, like the classic card's bars. */
function LadderRow({ row, side }: { row: BookRow | null; side: 'bid' | 'ask' }) {
  const lit = row ? litCells(row.depthPct, LADDER_CELLS) : 0
  const color = side === 'bid' ? 'bg-green' : 'bg-red'
  return (
    <div className="relative flex items-center justify-between h-[22px]">
      <span
        aria-hidden="true"
        className={`absolute inset-y-[3px] flex gap-[2px] ${side === 'bid' ? 'right-0 flex-row-reverse' : 'left-0'}`}
        style={{ width: `${(lit / LADDER_CELLS) * METER_SPAN}%` }}
      >
        {Array.from({ length: lit }, (_, i) => (
          // The outermost block is brighter: the meter's tip.
          <span key={i} className={`flex-1 ${color} ${i === lit - 1 ? 'opacity-40' : 'opacity-[0.16]'}`} />
        ))}
      </span>
      <span className={`relative ${side === 'bid' ? 'text-green' : 'text-red'}`}>{row ? priceOf(row.price) : '—'}</span>
      <span className="relative text-muted">{row ? fmtNum(row.size, 3) : '—'}</span>
    </div>
  )
}

/** One histogram bar as a stack of blocks; unlit blocks stay faintly drawn,
 *  so the grid reads as a meter even when a slice of the book is thin. */
function DepthBar({ pct, side }: { pct: number; side: 'bid' | 'ask' }) {
  const lit = litCells(pct, DEPTH_ROWS)
  const color = side === 'bid' ? 'bg-green' : 'bg-red'
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: DEPTH_COLS }, (_, c) => (
        <div key={c} className={`flex flex-col-reverse gap-[2px] ${c === DEPTH_COLS - 1 ? 'max-[560px]:hidden' : ''}`}>
          {Array.from({ length: DEPTH_ROWS }, (_, r) => (
            <span
              key={r}
              className={`block h-[7px] w-[7px] transition-colors duration-300 ${
                r < lit ? `${color} ${r === lit - 1 ? '' : 'opacity-70'}` : 'bg-hair'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * The new home page's live price card: the same Binance BTC perpetual book
 * as the classic card (one hook, `useOrderBook`), drawn as pixel art —
 * notched corners and a hard offset shadow like the page's buttons, depth as
 * rows of blocks, the histogram as stacked blocks, a pixel face for the
 * figures. Every figure is still the exchange's own; only the drawing changed.
 */
export default function PixelOrderBook() {
  const { data, book, live } = useOrderBook()
  const up = (data?.change_pct ?? 0) >= 0
  const bids: (BookRow | null)[] = book?.bids ?? Array(BOOK_ROWS).fill(null)
  const asks: (BookRow | null)[] = book?.asks ?? Array(BOOK_ROWS).fill(null)
  const bars = book?.bars ?? [
    ...Array.from({ length: BOOK_BARS }, () => ({ side: 'bid' as const, heightPct: 0 })),
    ...Array.from({ length: BOOK_BARS }, () => ({ side: 'ask' as const, heightPct: 0 })),
  ]

  return (
    <div className="relative mr-2 mb-2">
      {/* The hard shadow: the same notched shape, one step down and right. */}
      <div aria-hidden="true" className="absolute inset-0 translate-x-2 translate-y-2 bg-accent-line" style={CLIP} />
      {/* Border, then the face inset by it: two notched boxes make the
          stepped outline a pixel-art frame has at its corners. */}
      <div className="relative bg-border p-[2px]" style={CLIP}>
        <div className="bg-surface" style={CLIP}>
          {/* pt-8, not pt-4: the band above the header is where Pixel's feet
              hang (HeroNext), so they never cover the label or LIVE. */}
          <div className="px-5 pt-8 pb-4 max-[560px]:px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-baseline gap-x-2.5 gap-y-1 min-w-0 flex-wrap">
                <span className="font-pixel text-[15px] font-bold text-text">{data?.label || 'BTC-PERP'}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Binance · live order book</span>
              </div>
              {/* Tied to the EXCHANGE's stamp on the book, not to our clock. */}
              <span className={`inline-flex items-center gap-1.5 font-pixel text-[11px] ${live ? 'text-accent' : 'text-faint'}`}>
                <span
                  aria-hidden="true"
                  className={`h-[7px] w-[7px] ${live ? 'bg-accent motion-safe:animate-[pxblink_1.2s_steps(1,end)_infinite]' : 'bg-faint'}`}
                />
                {live ? 'Live' : 'Reconnecting'}
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-x-4 gap-y-2 flex-wrap">
              <div className="flex items-center gap-3">
                <span className={`font-pixel text-[30px] leading-none max-[560px]:text-[24px] ${up ? 'text-green' : 'text-red'}`}>
                  {data?.price == null ? '—' : priceOf(data.price)}
                </span>
                {data?.change_pct != null && (
                  <span
                    className={`font-pixel text-[11px] py-1 px-2 border-2 ${
                      up ? 'text-green border-green bg-[rgba(47,214,122,0.08)]' : 'text-red border-red bg-[rgba(255,90,90,0.08)]'
                    }`}
                  >
                    {up ? '▲' : '▼'} {fmtSignedPct(data.change_pct, 2)}
                  </span>
                )}
              </div>
              {data?.quote_volume != null && (
                <span className="font-mono text-[11px] text-faint">24h vol {fmtCompactUsd(data.quote_volume)}</span>
              )}
            </div>
          </div>

          <div className={RULE} />

          <div className="grid grid-cols-2 font-mono text-xs">
            <div className="py-3.5 px-5 max-[560px]:px-4">
              <div className="flex justify-between mb-1.5 font-pixel text-[10px] text-faint">
                <span className="text-green">Bids</span>
                <span>Size</span>
              </div>
              {bids.map((row, i) => (
                <LadderRow key={row?.price ?? `b${i}`} row={row} side="bid" />
              ))}
            </div>
            <div className="py-3.5 px-5 max-[560px]:px-4 border-l-2 border-hair">
              <div className="flex justify-between mb-1.5 font-pixel text-[10px] text-faint">
                <span className="text-red">Asks</span>
                <span>Size</span>
              </div>
              {asks.map((row, i) => (
                <LadderRow key={row?.price ?? `a${i}`} row={row} side="ask" />
              ))}
            </div>
          </div>

          <div className={RULE} />

          <div className="py-4 px-5 max-[560px]:px-4">
            <div className="flex items-end justify-between">
              {bars.map((bar, i) => (
                <Fragment key={`${bar.side}-${i}`}>
                  {/* The mid is a marker, not a bar: nothing rests there. */}
                  {bar.side === 'ask' && bars[i - 1]?.side === 'bid' && (
                    <span
                      aria-hidden="true"
                      className="w-[2px] self-stretch bg-[repeating-linear-gradient(180deg,var(--accent)_0_4px,transparent_4px_8px)]"
                    />
                  )}
                  <DepthBar pct={bar.heightPct} side={bar.side} />
                </Fragment>
              ))}
            </div>
            <div className="flex justify-between font-mono text-[10px] text-faint mt-2.5">
              <span>{book ? `−${book.bandPct.toFixed(3)}%` : 'depth'}</span>
              <span className="font-pixel text-[10px]">{book ? `Mid ${priceOf(book.mid)}` : 'Mid —'}</span>
              <span>{book ? `+${book.bandPct.toFixed(3)}%` : 'depth'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
