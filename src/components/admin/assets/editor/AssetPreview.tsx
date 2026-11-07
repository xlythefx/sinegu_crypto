import { Eye, TrendingUpDown } from 'lucide-react'
import AssetLogo from '../AssetLogo'
import EntryPips from '../EntryPips'
import { EXCHANGE_META, exchangeFromBroker } from '../../../exchanges/meta'
import { draftBase, draftEntries, draftMax, type AssetDraft } from '../../../../lib/assetDraft'
import { mainEntryText } from '../../../../lib/assetSizing'
import { displaySymbol } from '../../../../lib/chart'
import { fmtQty } from '../../../../lib/format'
import { ladderShortText, stepsFromRows } from '../../../../lib/streakSizing'
import type { AdminAsset } from '../../../../types/admin'

interface AssetPreviewProps {
  draft: AssetDraft
  asset: AdminAsset | null
  image: string | null
}

const SIDE_TEXT = { ALL: 'BOTH', LONG: 'LONG', SHORT: 'SHORT' } as const
const SIDE_TONE = {
  LONG: 'text-green border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)]',
  SHORT: 'text-red border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]',
  ALL: 'text-muted border-border bg-surface2',
} as const

/**
 * The page's right column on a wide screen: the coin's card as it will look
 * after saving, redrawn on every keystroke, and what one entry is on the main
 * account. Nothing here is saved — it only reads the draft.
 */
export default function AssetPreview({ draft, asset, image }: AssetPreviewProps) {
  const exchange = exchangeFromBroker(draft.broker)
  const venue = exchange ? EXCHANGE_META[exchange].label : 'No exchange'
  const ticker = draft.ticker.trim() || 'TICKER'
  const base = draftBase(draft)
  const max = draftMax(draft)
  const entries = draftEntries(draft)
  const steps = stepsFromRows(draft.streakRows)
  const entryText = asset && base > 0 ? mainEntryText(asset, base) : null

  return (
    <section aria-labelledby="asset-preview-title" className="rounded-card border border-border bg-surface p-4 sm:p-5">
      <h2 id="asset-preview-title" className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-muted">
        <Eye size={14} aria-hidden="true" />
        Preview · how the card will look
      </h2>

      <article
        className={`flex flex-col gap-3 rounded-card border bg-bg p-4 ${draft.enabled ? 'border-accent-line' : 'border-hair'}`}
      >
        <header className="flex items-start gap-3">
          <AssetLogo key={image ?? 'none'} ticker={ticker} image={image} exchange={exchange} dimmed={!draft.enabled} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[15px] font-extrabold">{displaySymbol(ticker)}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted">
              <span className={exchange ? 'font-semibold text-text' : ''}>{venue}</span>
              {draft.type && ` · ${draft.type}`}
            </p>
          </div>
          <span
            className={`flex-none rounded-pill border px-2.5 py-[3px] font-mono text-[10px] font-semibold tracking-[0.06em] ${SIDE_TONE[draft.side]}`}
          >
            {SIDE_TEXT[draft.side]}
          </span>
        </header>

        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-row border border-accent-line bg-accent-soft px-3 py-2.5">
            <dt className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint">Base size</dt>
            <dd className="mt-1 truncate font-mono text-[17px] font-extrabold leading-none text-accent">
              {base > 0 ? fmtQty(base) : '—'}
            </dd>
            <dd className="mt-1 text-[10.5px] text-muted">per 1,000 USDT</dd>
          </div>
          <div className="rounded-row border border-border bg-surface2 px-3 py-2.5">
            <dt className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint">Max position</dt>
            <dd className="mt-1 truncate font-mono text-[17px] font-extrabold leading-none text-text">
              {max > 0 ? fmtQty(max) : '—'}
            </dd>
            <dd className="mt-1.5">
              <EntryPips entries={entries} />
            </dd>
          </div>
        </dl>

        {draft.streakEnabled && steps.length > 0 && (
          <p className="flex min-w-0 items-center gap-2 rounded-row border border-accent-line bg-accent-soft px-3 py-2">
            <TrendingUpDown size={13} className="flex-none text-accent" aria-hidden="true" />
            <span className="flex-none text-[11px] font-bold text-accent">Streak sizing</span>
            <span className="min-w-0 truncate font-mono text-[11px] text-muted">{ladderShortText(steps)}</span>
          </p>
        )}

        <p
          className={`flex items-center gap-2 border-t border-hair pt-2.5 text-[12px] font-semibold ${
            draft.enabled ? 'text-green' : 'text-muted'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${draft.enabled ? 'bg-green' : 'border border-muted'}`}
            aria-hidden="true"
          />
          {draft.enabled ? 'Trading on' : 'Trading off'}
        </p>
      </article>

      {/* "0.5" alone hides that it is 49.9 LTC on a 99,900 USDT account. */}
      {entryText && (
        <p className="mt-3 rounded-row border border-border bg-surface2 px-3 py-2.5 font-mono text-[11.5px] leading-[1.55] text-muted">
          {entryText}
        </p>
      )}
    </section>
  )
}
