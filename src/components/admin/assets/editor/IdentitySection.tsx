import { useId, useState } from 'react'
import { BadgeInfo, ImagePlus, X } from 'lucide-react'
import ChoiceGroup, { type Choice } from './ChoiceGroup'
import EditorSection from './EditorSection'
import { CONTROL, FIELD, FIELD_ERROR, FIELD_HINT, FIELD_LABEL, SELECT, SMALL_BTN } from './editorClasses'
import ExchangeLogo from '../../../exchanges/ExchangeLogo'
import { exchangeFromBroker } from '../../../exchanges/meta'
import { ASSET_BROKERS, ASSET_TYPES, type AssetDraft } from '../../../../lib/assetDraft'
import type { useAssetImage } from '../../../../hooks/useAssetImage'
import type { AssetSide } from '../../../../types/admin'

interface IdentitySectionProps {
  draft: AssetDraft
  update: (patch: Partial<AssetDraft>) => void
  image: ReturnType<typeof useAssetImage>
  /** Show the empty-ticker error even before the box was left (a save was tried). */
  showErrors: boolean
}

const SIDES: Choice<AssetSide>[] = [
  { value: 'ALL', label: 'Both', hint: 'long & short' },
  { value: 'LONG', label: 'Long', hint: 'buys only' },
  { value: 'SHORT', label: 'Short', hint: 'sells only' },
]

const EXCHANGES: Choice<string>[] = ASSET_BROKERS.map((b) => {
  const kind = exchangeFromBroker(b)
  return { value: b, label: b, icon: kind ? <ExchangeLogo kind={kind} size={22} /> : undefined }
})

/** Section 1 — what the coin is and where it trades. */
export default function IdentitySection({ draft, update, image, showErrors }: IdentitySectionProps) {
  const ids = { ticker: useId(), exchange: useId(), side: useId(), type: useId() }
  const [tickerLeft, setTickerLeft] = useState(false)
  const tickerMissing = draft.ticker.trim() === '' && (tickerLeft || showErrors)
  const unknownBroker = !ASSET_BROKERS.includes(draft.broker as (typeof ASSET_BROKERS)[number])
  const letter = (draft.ticker.trim()[0] ?? '?').toUpperCase()

  return (
    <EditorSection
      id="asset-identity"
      Icon={BadgeInfo}
      title="Coin"
      description="The ticker exactly as the exchange names it, and where the bot trades it."
    >
      {/* Image: optional, so it sits beside the ticker rather than leading the form. */}
      <div className="flex items-center gap-3.5">
        <span
          className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-full border border-border bg-accent-soft"
          aria-hidden="true"
        >
          {image.shown ? (
            <img src={image.shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-mono text-[22px] font-bold text-accent">{letter}</span>
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SMALL_BTN} onClick={() => image.inputRef.current?.click()}>
              <ImagePlus size={14} aria-hidden="true" />
              {image.shown ? 'Change image' : 'Upload image'}
            </button>
            {image.shown && (
              <button type="button" className={`${SMALL_BTN} text-red hover:border-red`} onClick={image.clear}>
                <X size={14} aria-hidden="true" />
                Remove
              </button>
            )}
          </div>
          <p className={FIELD_HINT}>Optional · PNG, JPG, GIF, WEBP or SVG up to 2 MB. Without one, the card shows the first letter.</p>
          {image.error && (
            <p className={FIELD_ERROR} role="alert">
              {image.error}
            </p>
          )}
        </div>
        <input
          ref={image.inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => image.pick(e.target.files?.[0])}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className={FIELD}>
          <label htmlFor={ids.ticker} className={FIELD_LABEL}>
            Ticker symbol
          </label>
          <input
            id={ids.ticker}
            type="text"
            className={`${CONTROL} font-mono uppercase placeholder:normal-case`}
            value={draft.ticker}
            onChange={(e) => update({ ticker: e.target.value.toUpperCase() })}
            onBlur={() => setTickerLeft(true)}
            placeholder="e.g. LTCUSDT"
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={tickerMissing}
            aria-describedby={`${ids.ticker}-hint`}
          />
          <p id={`${ids.ticker}-hint`} className={tickerMissing ? FIELD_ERROR : FIELD_HINT}>
            {tickerMissing ? 'Enter the ticker symbol.' : 'Same name as on the exchange, no separator (BTCUSDT).'}
          </p>
        </div>

        <div className={FIELD}>
          <label htmlFor={ids.type} className={FIELD_LABEL}>
            Type
          </label>
          <select
            id={ids.type}
            className={SELECT}
            value={draft.type ?? ''}
            onChange={(e) => update({ type: e.target.value || null })}
          >
            <option value="">None</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={FIELD}>
        <span id={ids.exchange} className={FIELD_LABEL}>
          Exchange
        </span>
        <ChoiceGroup
          labelId={ids.exchange}
          value={draft.broker ?? ''}
          options={EXCHANGES}
          onChange={(broker) => update({ broker })}
        />
        <p className={FIELD_HINT}>
          {unknownBroker
            ? 'No exchange set: the bot does not trade this coin until one is picked.'
            : 'The same coin is a separate asset on each exchange, with its own sizes.'}
        </p>
      </div>

      <div className={FIELD}>
        <span id={ids.side} className={FIELD_LABEL}>
          Trade direction
        </span>
        <ChoiceGroup labelId={ids.side} value={draft.side} options={SIDES} onChange={(side) => update({ side })} />
        <p className={FIELD_HINT}>A signal in a blocked direction is refused; exits always go through.</p>
      </div>
    </EditorSection>
  )
}
