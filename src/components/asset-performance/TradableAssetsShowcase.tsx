import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { displaySymbol, seriesColor } from '../../lib/chart'
import { EXCHANGE_META } from '../exchanges/meta'
import { getApiErrorMessage } from '../../services/api'
import type { ExchangeKind } from '../../types/exchanges'
import type { AssetSide, TradableAsset } from '../../types/assets'

interface TradableAssetsShowcaseProps {
  assets: TradableAsset[] | null
  loading: boolean
  error: unknown
  onRetry: () => void
  /** Tickers the trader has closed trades on — marks a tile as already traded. */
  tradedTickers?: Set<string>
}

const SIDE_LABEL: Record<AssetSide, string> = {
  ALL: 'Long & Short',
  LONG: 'Long only',
  SHORT: 'Short only',
}

const SIDE_TONE: Record<AssetSide, string> = {
  ALL: 'text-muted border-border',
  LONG: 'text-green border-[color-mix(in_srgb,var(--green)_32%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)]',
  SHORT:
    'text-red border-[color-mix(in_srgb,var(--red)_32%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]',
}

const SIDE_ICON: Record<AssetSide, typeof ArrowUpDown> = {
  ALL: ArrowUpDown,
  LONG: ArrowUpRight,
  SHORT: ArrowDownRight,
}

/** Horizontal snap track: native touch/trackpad swipe, no visible scrollbar. */
const TRACK =
  'flex gap-3.5 overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
const SLIDE = 'snap-start shrink-0 w-[210px] max-[420px]:w-[78%]'
const ARROW =
  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface2 text-muted transition-[color,border-color,opacity] duration-150 hover:border-accent hover:text-text disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted'

/** "BTCUSDT" → "BTC" — the base leg, used for the monogram. */
function baseSymbol(ticker: string): string {
  const pretty = displaySymbol(ticker)
  return pretty.includes('/') ? pretty.split('/')[0] : pretty
}

/** Brand meta for the asset's broker, when it is one of our three exchanges. */
function exchangeMeta(broker: string | null) {
  const key = (broker ?? '').trim().toLowerCase() as ExchangeKind
  return EXCHANGE_META[key] ?? null
}

function AssetTile({
  asset,
  index,
  traded,
}: {
  asset: TradableAsset
  index: number
  traded: boolean
}) {
  const tint = seriesColor(asset.ticker, index)
  const meta = exchangeMeta(asset.broker)
  const base = baseSymbol(asset.ticker)
  const SideIcon = SIDE_ICON[asset.side]

  return (
    <article
      className={`group relative overflow-hidden rounded-card border border-border bg-surface p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[color-mix(in_srgb,var(--tint)_55%,var(--border))] hover:shadow-[0_10px_22px_color-mix(in_srgb,var(--tint)_16%,transparent)] ${SLIDE}`}
      style={{ '--tint': tint } as CSSProperties}
      data-aos="fade-up"
      data-aos-delay={Math.min(index, 8) * 40}
    >
      {/* Soft brand wash — strengthens on hover, never competes with the text. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_srgb,var(--tint)_14%,transparent),transparent_62%)] opacity-70 transition-opacity duration-200 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-2">
        {asset.asset_image ? (
          <img
            src={asset.asset_image}
            alt=""
            className="h-11 w-11 flex-none rounded-full border border-border object-cover bg-surface2"
            loading="lazy"
          />
        ) : (
          <span
            className="grid h-11 w-11 flex-none place-items-center rounded-full border font-display text-[12.5px] font-extrabold tracking-[-0.02em]"
            style={{
              color: tint,
              borderColor: `color-mix(in srgb, ${tint} 45%, transparent)`,
              background: `color-mix(in srgb, ${tint} 12%, transparent)`,
            }}
          >
            {base.slice(0, 4)}
          </span>
        )}

        <span className="inline-flex flex-none items-center gap-1.5 rounded-pill border border-[color-mix(in_srgb,var(--green)_32%,transparent)] bg-[color-mix(in_srgb,var(--green)_9%,transparent)] px-2 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-green">
          <span className="relative flex h-[5px] w-[5px]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-70" />
            <span className="relative inline-flex h-[5px] w-[5px] rounded-full bg-green" />
          </span>
          Live
        </span>
      </div>

      <div className="relative mt-3.5">
        <h3 className="font-display text-[17px] font-extrabold tracking-[-0.01em] leading-tight">
          {displaySymbol(asset.ticker)}
        </h3>
        <p className="mt-1 truncate text-[12px] text-muted">
          {asset.type?.trim() || 'Perpetual futures'}
        </p>
      </div>

      <div className="relative mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-hair pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-[3px] text-[10.5px] font-semibold text-muted">
          <span
            className="h-[6px] w-[6px] flex-none rounded-full"
            style={{ background: meta?.color ?? 'var(--faint)' }}
          />
          {meta?.label ?? asset.broker ?? 'Exchange'}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-[3px] text-[10.5px] font-semibold ${SIDE_TONE[asset.side]}`}
        >
          <SideIcon size={11} />
          {SIDE_LABEL[asset.side]}
        </span>
        {traded && (
          <span className="rounded-pill border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2.5 py-[3px] font-mono text-[10px] font-semibold tracking-[0.06em] text-accent">
            TRADED
          </span>
        )}
      </div>
    </article>
  )
}

/**
 * Every asset currently enabled for the bot, as a side-scrolling carousel:
 * native swipe on touch, arrow buttons on desktop. Deliberately no
 * sizing/allocation figures — this answers *what* is traded, never *how big*.
 */
export default function TradableAssetsShowcase({
  assets,
  loading,
  error,
  onRetry,
  tradedTickers,
}: TradableAssetsShowcaseProps) {
  const count = assets?.length ?? 0
  const trackRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  /** Recompute which arrows are usable (also covers resize + content change). */
  const syncEdges = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft >= max - 1)
  }, [])

  useEffect(() => {
    syncEdges()
    const el = trackRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(syncEdges)
    ro.observe(el)
    return () => ro.disconnect()
  }, [syncEdges, count])

  const slide = (dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(210, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const scrollable = !(atStart && atEnd)

  return (
    <section className="mb-7" data-aos="fade-up">
      {count > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-pill border border-border bg-surface2 px-3 py-[6px] font-mono text-[11.5px] font-semibold text-muted">
            {count} live {count === 1 ? 'asset' : 'assets'}
          </span>
          {scrollable && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={ARROW}
                onClick={() => slide(-1)}
                disabled={atStart}
                aria-label="Previous assets"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className={ARROW}
                onClick={() => slide(1)}
                disabled={atEnd}
                aria-label="Next assets"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {loading && !assets && (
        <div className={TRACK}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className={`h-[172px] animate-pulse rounded-card border border-border bg-surface2 ${SLIDE}`}
            />
          ))}
        </div>
      )}

      {!loading && !assets && error != null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-[18px] py-3.5">
          <span className="text-[13px] text-muted">
            {getApiErrorMessage(error, 'Could not load the asset list.')}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface2 px-4 py-2 text-[12.5px] font-semibold text-text hover:border-accent"
            onClick={onRetry}
          >
            <RefreshCw size={13} />
            Try again
          </button>
        </div>
      )}

      {assets && assets.length === 0 && (
        <div className="rounded-card border border-dashed border-border bg-surface px-6 py-9 text-center text-[13.5px] text-muted">
          No assets are enabled for trading right now. New markets appear here
          as soon as they go live.
        </div>
      )}

      {assets && assets.length > 0 && (
        <div className="relative">
          <div ref={trackRef} onScroll={syncEdges} className={TRACK}>
            {assets.map((asset, i) => (
              <AssetTile
                key={asset.asset_id}
                asset={asset}
                index={i}
                traded={tradedTickers?.has(asset.ticker) ?? false}
              />
            ))}
          </div>
          {/* Edge fades hint that the row keeps going. */}
          {!atStart && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-[linear-gradient(to_right,var(--bg),transparent)]"
            />
          )}
          {!atEnd && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-[linear-gradient(to_left,var(--bg),transparent)]"
            />
          )}
        </div>
      )}
    </section>
  )
}
