import type { ExchangeKind } from '../../types/exchanges'
import { EXCHANGE_META } from '../exchanges/meta'

/** Small brand-colored pill naming the exchange an invoice belongs to. */
export default function ExchangeBadge({ exchange }: { exchange: ExchangeKind }) {
  const meta = EXCHANGE_META[exchange]
  return (
    <span
      className="font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] px-[7px] py-0.5 rounded-pill border leading-[1.5]"
      style={{
        color: meta.color,
        borderColor: meta.color,
        background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
      }}
    >
      {meta.label}
    </span>
  )
}
