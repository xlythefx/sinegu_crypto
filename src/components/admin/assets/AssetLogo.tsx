import { useState } from 'react'
import ExchangeLogo from '../../exchanges/ExchangeLogo'
import { displaySymbol } from '../../../lib/chart'
import type { ExchangeKind } from '../../../types/exchanges'

interface AssetLogoProps {
  ticker: string
  /** `assets.asset_image` — an uploaded file's URL or a site path like `/litecoin-logo.jpg`. */
  image: string | null
  /** Pins the exchange's tile to the corner, so LTC on Binance and LTC on MEXC never look alike. */
  exchange?: ExchangeKind | null
  /** Grey the coin out (the asset is off). The exchange tile keeps its colour. */
  dimmed?: boolean
}

/**
 * A coin's round logo, 40px, with the exchange it trades on as a small tile
 * on its corner. No image, or one that fails to load, falls back to the
 * ticker's first letter.
 */
export default function AssetLogo({
  ticker,
  image,
  exchange = null,
  dimmed = false,
}: AssetLogoProps) {
  // Keyed on the URL, so picking a new image after a failed one tries again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(image) && image !== failedSrc
  const coin = displaySymbol(ticker).split('/')[0] || ticker

  return (
    <span className="relative inline-flex h-10 w-10 flex-none">
      {showImage && image ? (
        <img
          src={image}
          width={40}
          height={40}
          alt={coin}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(image)}
          className={`h-10 w-10 rounded-full border border-border bg-surface2 object-cover ${
            dimmed ? 'grayscale' : ''
          }`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full font-mono text-[15px] font-bold ${
            dimmed ? 'bg-surface2 text-faint' : 'bg-accent-soft text-accent'
          }`}
        >
          {(ticker[0] ?? '?').toUpperCase()}
        </span>
      )}
      {exchange && (
        <ExchangeLogo
          kind={exchange}
          size={18}
          className="absolute -bottom-1 -right-1 ring-2 ring-surface"
        />
      )}
    </span>
  )
}
