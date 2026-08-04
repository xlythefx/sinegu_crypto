import { EXCHANGE_META, EXCHANGE_ORDER } from '../../exchanges/meta'
import type { ExchangeKind } from '../../../types/exchanges'

export type ExchangePillValue = 'all' | ExchangeKind

interface ExchangeFilterPillProps {
  value: ExchangePillValue
  onChange: (value: ExchangePillValue) => void
}

const PILL_BTN =
  'inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-pill px-3.5 text-[12px] font-semibold cursor-pointer transition-colors duration-150'

/**
 * All / Binance / Bybit / MEXC filter pill (mother's broker pill, adapted).
 * Unavailable exchanges (Bybit, MEXC) render disabled with a "Coming soon" tip.
 */
export default function ExchangeFilterPill({
  value,
  onChange,
}: ExchangeFilterPillProps) {
  const options = [
    { key: 'all' as const, label: 'All', color: 'var(--accent)', available: true },
    ...EXCHANGE_ORDER.map((k) => ({
      key: k,
      label: EXCHANGE_META[k].label,
      color: EXCHANGE_META[k].color,
      available: EXCHANGE_META[k].available,
    })),
  ]

  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-pill border border-hair bg-surface2 p-1"
      role="group"
      aria-label="Filter by exchange"
    >
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            disabled={!opt.available}
            title={opt.available ? undefined : 'Coming soon'}
            aria-pressed={active}
            className={`${PILL_BTN} border ${
              active
                ? 'bg-surface border-border text-text font-bold'
                : 'border-transparent bg-transparent text-muted hover:text-text'
            } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted`}
            onClick={() => opt.available && onChange(opt.key)}
          >
            <span
              className="h-1.5 w-1.5 flex-none rounded-full"
              style={{ background: opt.color }}
            />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
