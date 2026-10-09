import { Pencil, Trash2, TrendingDown } from 'lucide-react'
import { displaySymbol } from '../../lib/chart'
import { fmtMediumDate, fmtQty } from '../../lib/format'
import { ladderShortText } from '../../lib/lossSizing'
import type { AdminAsset } from '../../types/admin'

interface AssetCardProps {
  asset: AdminAsset
  busy: boolean
  onToggle: (asset: AdminAsset) => void
  onEdit: (asset: AdminAsset) => void
  onDelete: (asset: AdminAsset) => void
}

const SIDE_TONE: Record<AdminAsset['side'], string> = {
  LONG: 'text-green border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)]',
  SHORT:
    'text-red border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]',
  ALL: 'text-muted border-border bg-surface2',
}

const ICON_BTN_BASE =
  'inline-flex h-8 w-8 items-center justify-center rounded-btn border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-50'

/** One number with its caption and the unit that makes it mean something. */
function Metric({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string
  value: string
  hint: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-row border px-3 py-2.5 ${
        accent ? 'border-accent-line bg-accent-soft' : 'border-border bg-surface2'
      }`}
    >
      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
      <p
        className={`mt-1 truncate font-mono text-[17px] font-extrabold leading-none ${
          accent ? 'text-accent' : 'text-text'
        }`}
        title={value}
      >
        {value}
      </p>
      <span className="mt-1 block text-[10.5px] leading-tight text-muted">{hint}</span>
    </div>
  )
}

/**
 * One tradable instrument, as a card.
 *
 * Replaced a 9-column table that only fit on a desktop and buried the two
 * numbers that actually get edited — base size and the stack cap — among
 * timestamps. Both are surfaced here with the unit they are measured in,
 * because "8,500.000" means nothing without "per 1,000 USDT of balance".
 */
export default function AssetCard({
  asset,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: AssetCardProps) {
  const meta = [asset.broker, asset.type].filter(Boolean).join(' · ') || '—'

  return (
    <article
      className={`flex flex-col gap-3.5 rounded-card border bg-surface p-4 transition-[border-color] duration-150 hover:border-accent ${
        asset.enabled ? 'border-border' : 'border-hair'
      }`}
    >
      <header className="flex items-start gap-3">
        {asset.asset_image ? (
          <img
            className={`h-10 w-10 flex-none rounded-full border border-border bg-surface2 object-cover ${
              asset.enabled ? '' : 'grayscale'
            }`}
            src={asset.asset_image}
            alt=""
          />
        ) : (
          <span
            className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-full font-mono text-[15px] font-bold ${
              asset.enabled
                ? 'bg-accent-soft text-accent'
                : 'bg-surface2 text-faint'
            }`}
          >
            {asset.ticker[0]}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[15px] font-extrabold tracking-[-0.01em]">
            {displaySymbol(asset.ticker)}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">{meta}</p>
        </div>

        <span
          className={`flex-none rounded-pill border px-2.5 py-[3px] font-mono text-[10px] font-semibold tracking-[0.06em] ${SIDE_TONE[asset.side]}`}
          title={
            asset.side === 'ALL'
              ? 'Both directions allowed'
              : `${asset.side} entries only`
          }
        >
          {asset.side}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <Metric
          label="Base size"
          value={fmtQty(asset.base_size)}
          hint="per 1,000 USDT"
          accent
        />
        {/*
          `max_increments` is a max position SIZE, not a count — the column name
          is inherited from the mother schema (whose migration comments it as
          "Max position size"). Labelling it "Max stack / entries per position"
          is what led to sizes being read as counts: LTCUSDT's 42 meant "3 stacks
          of 14", and the engine understood "42 entries", so the cap never fired.
          Show the raw size, and derive the entry count beside it.
        */}
        <Metric
          label="Max position size"
          value={fmtQty(asset.max_increments)}
          hint={
            asset.base_size > 0
              ? `= ${Math.max(1, Math.round(asset.max_increments / asset.base_size))} entries max`
              : 'set a base size first'
          }
        />
      </div>

      {/* Loss-streak sizing changes what the Base size tile above means after
          a losing run, so the card says so where the size is read. The ladder
          itself is edited on the Loss-streak sizing tab or in the form. */}
      {asset.loss_sizing_enabled && asset.loss_sizes.length > 0 && (
        <div
          className="-mt-1 flex min-w-0 items-center gap-2 rounded-row border border-accent-line bg-accent-soft px-3 py-2"
          title="After losses in a row, the next entry uses these sizes. One win goes back to Base size."
        >
          <TrendingDown size={13} className="flex-none text-accent" aria-hidden="true" />
          <span className="flex-none text-[11px] font-bold text-accent">Streak sizing on</span>
          <span className="min-w-0 truncate font-mono text-[11px] text-muted">
            {ladderShortText(asset.loss_sizes)}
          </span>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-pill bg-transparent py-1 pr-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onToggle(asset)}
          disabled={busy}
          aria-label={`${asset.enabled ? 'Disable' : 'Enable'} ${asset.ticker}`}
        >
          <span
            className={`relative inline-block h-5 w-9 flex-none rounded-pill border transition-[background,border-color] duration-150 ${
              asset.enabled
                ? 'border-accent bg-accent-soft'
                : 'border-border bg-surface2'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full transition-[transform,background] duration-150 ${
                asset.enabled ? 'translate-x-4 bg-accent' : 'bg-muted'
              }`}
            />
          </span>
          <span
            className={`text-[12.5px] font-semibold ${
              asset.enabled ? 'text-green' : 'text-muted'
            }`}
          >
            {asset.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </button>

        <div className="flex flex-none gap-1.5">
          <button
            type="button"
            className={`${ICON_BTN_BASE} hover:border-accent hover:text-text`}
            onClick={() => onEdit(asset)}
            disabled={busy}
            aria-label={`Edit ${asset.ticker}`}
            title="Edit asset"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className={`${ICON_BTN_BASE} hover:border-red hover:text-red`}
            onClick={() => onDelete(asset)}
            disabled={busy}
            aria-label={`Delete ${asset.ticker}`}
            title="Delete asset"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <p className="text-[10.5px] leading-tight text-faint">
        {asset.updated_at ? `Updated ${fmtMediumDate(asset.updated_at)}` : 'Never updated'}
        {asset.created_at && ` · Created ${fmtMediumDate(asset.created_at)}`}
      </p>
    </article>
  )
}
