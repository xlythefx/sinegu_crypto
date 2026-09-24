import { Building2, TrendingUp } from 'lucide-react'
import { fmtSignedMoney } from '../../lib/format'
import type { ExchangeStat } from '../../types/analytics'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../exchanges/meta'

interface UnrealizedByExchangeCardProps {
  byExchange: ExchangeStat[]
  totalUnrealized: number
}

/** "Unrealized P&L by Exchange" — open exposure per connected exchange.
 *
 * Driven by the payload's `by_exchange`, never by a hardcoded row: until
 * 2026-09-24 this card printed Binance's figure and a fixed "Soon" beside
 * Bybit AND MEXC, so a MEXC position had been invisible here since MEXC went
 * live. A venue is "Soon" only when `meta.ts` says it is not wired. */
export default function UnrealizedByExchangeCard({
  byExchange,
  totalUnrealized,
}: UnrealizedByExchangeCardProps) {
  const figures = new Map(
    byExchange.map((e) => [e.exchange.toLowerCase(), e.unrealized]),
  )
  const rows = EXCHANGE_ORDER.map((kind) => {
    const meta = EXCHANGE_META[kind]
    return {
      kind,
      label: meta.label,
      color: meta.color,
      // A wired venue with no open position is a real 0.00, not "Soon".
      unrealized: meta.available ? (figures.get(kind) ?? 0) : null,
    }
  })

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
      data-aos-delay="150"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <TrendingUp size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Unrealized P&L by Exchange
          </div>
          <div className="text-[12px] text-muted mt-px">
            Open exposure across all your connected exchanges
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            className={`flex items-center justify-between py-2.5 px-0.5 border-b border-hair text-[13px] font-bold${
              row.unrealized === null ? ' opacity-45' : ''
            }`}
            key={row.kind}
          >
            <div className="flex items-center gap-[9px]">
              <span
                className="w-[26px] h-[26px] rounded-btn border bg-surface2 flex items-center justify-center flex-none"
                style={{ color: row.color, borderColor: `${row.color}55` }}
              >
                <Building2 size={14} />
              </span>
              {row.label}
            </div>
            {row.unrealized === null ? (
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                Soon
              </span>
            ) : (
              <span
                className={`font-mono ${row.unrealized < 0 ? 'text-red' : 'text-green'}`}
              >
                {fmtSignedMoney(row.unrealized)}
              </span>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 pb-0.5 px-0.5 mt-1 border-t-2 border-accent-line text-[13.5px] font-extrabold">
          <span>Total Unrealized</span>
          <span
            className={`font-mono text-[15px] ${totalUnrealized < 0 ? 'text-red' : 'text-green'}`}
          >
            {fmtSignedMoney(totalUnrealized)}
          </span>
        </div>
      </div>
    </section>
  )
}
