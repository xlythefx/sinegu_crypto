import { Building2, TrendingUp } from 'lucide-react'
import { fmtSignedMoney } from '../../lib/format'
import type { ExchangeStat } from '../../types/analytics'

// Only Binance is integrated for now; Bybit / MEXC stay listed but disabled
// ("Soon") until those integrations exist.
const SOON_ROWS = [
  { exchange: 'Bybit', color: '#f7a600' },
  { exchange: 'MEXC', color: '#1972e2' },
]

interface UnrealizedByExchangeCardProps {
  byExchange: ExchangeStat[]
  totalUnrealized: number
}

/** "Unrealized P&L by Exchange" — open exposure per connected exchange. */
export default function UnrealizedByExchangeCard({
  byExchange,
  totalUnrealized,
}: UnrealizedByExchangeCardProps) {
  const binance = byExchange.find(
    (e) => e.exchange.toLowerCase() === 'binance',
  )
  const binanceUnrealized = binance?.unrealized ?? 0

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
        <div className="flex items-center justify-between py-2.5 px-0.5 border-b border-hair text-[13px] font-bold">
          <div className="flex items-center gap-[9px]">
            <span
              className="w-[26px] h-[26px] rounded-btn border bg-surface2 flex items-center justify-center flex-none"
              style={{ color: '#f0b90b', borderColor: '#f0b90b55' }}
            >
              <Building2 size={14} />
            </span>
            Binance
          </div>
          <span
            className={`font-mono ${binanceUnrealized < 0 ? 'text-red' : 'text-green'}`}
          >
            {fmtSignedMoney(binanceUnrealized)}
          </span>
        </div>
        {SOON_ROWS.map((row) => (
          <div
            className="flex items-center justify-between py-2.5 px-0.5 border-b border-hair text-[13px] font-bold opacity-45"
            key={row.exchange}
          >
            <div className="flex items-center gap-[9px]">
              <span
                className="w-[26px] h-[26px] rounded-btn border bg-surface2 flex items-center justify-center flex-none"
                style={{ color: row.color, borderColor: `${row.color}55` }}
              >
                <Building2 size={14} />
              </span>
              {row.exchange}
            </div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Soon
            </span>
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
