import { useState } from 'react'
import { EXCHANGE_META } from './meta'
import type { ExchangeKind } from '../../types/exchanges'

interface ExchangeLogoProps {
  kind: ExchangeKind
  /** Edge length in px (the tiles are square). */
  size?: number
  /** Extra classes — positioning, a ring when it overlaps something. */
  className?: string
}

/**
 * An exchange's brand tile (`EXCHANGE_META[kind].logo`), square, rounded and
 * cropped rather than stretched. The border keeps the black (Binance, Bybit)
 * and white (MEXC) tiles visible on either theme. If the file fails to load,
 * the label's initial on a brand tint takes its place.
 */
export default function ExchangeLogo({ kind, size = 32, className = '' }: ExchangeLogoProps) {
  const meta = EXCHANGE_META[kind]
  // Remember WHICH file failed, so a different kind on the same instance
  // gets its own try instead of inheriting the fallback.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const box = `${size >= 28 ? 'rounded-btn' : 'rounded-[5px]'} flex-none border border-border ${className}`
  const dims = { width: size, height: size }

  if (failedSrc === meta.logo) {
    return (
      <span
        role="img"
        aria-label={meta.label}
        className={`${box} inline-flex items-center justify-center font-display font-extrabold leading-none text-text`}
        style={{
          ...dims,
          fontSize: Math.max(9, Math.round(size * 0.45)),
          background: `color-mix(in srgb, ${meta.color} 24%, var(--surface2))`,
        }}
      >
        {meta.label[0]}
      </span>
    )
  }

  return (
    <img
      src={meta.logo}
      width={size}
      height={size}
      alt={meta.label}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(meta.logo)}
      className={`${box} bg-surface2 object-cover`}
      // Explicit, because the base img rule (height: auto) would otherwise
      // follow the file's own ratio — MEXC's is not square.
      style={dims}
    />
  )
}
