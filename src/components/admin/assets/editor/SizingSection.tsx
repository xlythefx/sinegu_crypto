import { useId, useState } from 'react'
import { Hourglass, Scale } from 'lucide-react'
import ChoiceGroup, { type Choice } from './ChoiceGroup'
import EditorSection from './EditorSection'
import { FIELD, FIELD_ERROR, FIELD_HINT, FIELD_LABEL, FIELD_NOTE, NUMBER_CONTROL } from './editorClasses'
import {
  draftBase,
  draftEntries,
  draftMax,
  isBinanceDraft,
  maxBelowBase,
  type AssetDraft,
} from '../../../../lib/assetDraft'
import { baseCoin, holderText } from '../../../../lib/assetSizing'
import { MAX_MULTIPLES, type MaxMultiple } from '../../../../lib/binanceSizingCheck'
import { fmtQty } from '../../../../lib/format'
import type { AdminAsset } from '../../../../types/admin'

interface SizingSectionProps {
  draft: AssetDraft
  update: (patch: Partial<AssetDraft>) => void
  /** The asset being edited (null = new): carries a waiting size change. */
  asset: AdminAsset | null
  showErrors: boolean
}

const MULTIPLES: Choice<MaxMultiple | 'custom'>[] = [
  ...MAX_MULTIPLES.map((m) => ({ value: m, label: `${m}×`, hint: `${m} entr${m === 1 ? 'y' : 'ies'}` })),
  { value: 'custom' as const, label: 'Custom', hint: 'type it' },
]

/**
 * Section 2 — how much one entry is and how far a position may stack.
 *
 * The max position is a SIZE that the engine turns into an entry count
 * (size ÷ base size). Showing that count live is the point: typing "3" means
 * three coins, not three entries, and the difference is invisible until a
 * position stacks further than it should.
 */
export default function SizingSection({ draft, update, asset, showErrors }: SizingSectionProps) {
  const ids = { base: useId(), max: useId(), multiple: useId() }
  const [left, setLeft] = useState({ base: false, max: false })
  const binance = isBinanceDraft(draft)
  const coin = baseCoin(draft.ticker || 'COIN')
  const entries = draftEntries(draft)
  const max = draftMax(draft)
  const baseBad = !(draftBase(draft) > 0) && (left.base || showErrors)
  const maxBad = (!(max > 0) && (left.max || showErrors)) || maxBelowBase(draft)
  const waiting = asset?.pending_sizing ?? null

  const entriesLine =
    entries === null
      ? 'Set a base size to see how many entries fit.'
      : `= ${fmtQty(max)} ${coin} · up to ${entries} entr${entries === 1 ? 'y' : 'ies'} per position`

  return (
    <EditorSection
      id="asset-sizing"
      Icon={Scale}
      title="Sizing"
      description="One entry for every 1,000 USDT an account holds, and the most a position may stack to."
    >
      {asset && waiting && (
        <div className="flex items-start gap-2.5 rounded-row border border-accent-line bg-accent-soft px-3.5 py-3">
          <Hourglass size={15} className="mt-[2px] flex-none text-accent" aria-hidden="true" />
          <p className="text-[12.5px] leading-[1.55] text-text">
            A size change is waiting for {holderText(asset.ticker, waiting.waits_for)} to close. These fields show the{' '}
            <b>waiting</b> sizes: saving keeps it waiting (or replaces it). To drop it, use <b>Cancel change</b> on the
            coin&rsquo;s card.
          </p>
        </div>
      )}

      <div className={FIELD}>
        <label htmlFor={ids.base} className={FIELD_LABEL}>
          Base size <span className="font-normal text-faint">· {coin} per entry</span>
        </label>
        <input
          id={ids.base}
          type="number"
          inputMode="decimal"
          className={NUMBER_CONTROL}
          value={draft.baseSize}
          onChange={(e) => update({ baseSize: e.target.value })}
          onBlur={() => setLeft((l) => ({ ...l, base: true }))}
          min="0.000001"
          step="any"
          aria-invalid={baseBad}
          aria-describedby={`${ids.base}-hint`}
        />
        <p id={`${ids.base}-hint`} className={baseBad ? FIELD_ERROR : FIELD_HINT}>
          {baseBad
            ? 'Base size must be more than 0.'
            : 'An account under 1,000 USDT trades exactly this; a bigger one scales up with its balance.'}
        </p>
      </div>

      <div className={FIELD}>
        <span id={ids.multiple} className={FIELD_LABEL}>
          Max position
        </span>
        {binance && (
          <ChoiceGroup
            labelId={ids.multiple}
            value={draft.maxMultiple}
            options={MULTIPLES}
            onChange={(maxMultiple) => update({ maxMultiple })}
            columns={4}
          />
        )}
        {(!binance || draft.maxMultiple === 'custom') && (
          <input
            id={ids.max}
            type="number"
            inputMode="decimal"
            className={NUMBER_CONTROL}
            value={draft.maxPosition}
            onChange={(e) => update({ maxPosition: e.target.value })}
            onBlur={() => setLeft((l) => ({ ...l, max: true }))}
            min="0.001"
            step="any"
            aria-label={`Max position in ${coin}`}
            aria-invalid={maxBad}
            placeholder={`Max position in ${coin}`}
          />
        )}
        {maxBad ? (
          <p className={FIELD_ERROR} role="alert">
            {maxBelowBase(draft)
              ? 'Smaller than the base size: one entry would already be over the limit.'
              : 'Max position must be more than 0.'}
          </p>
        ) : (
          <p className={FIELD_NOTE}>{entriesLine}</p>
        )}
      </div>
    </EditorSection>
  )
}
