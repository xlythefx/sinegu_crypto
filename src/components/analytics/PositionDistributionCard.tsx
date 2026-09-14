import { Target } from 'lucide-react'
import { displaySymbol, seriesColor } from '../../lib/chart'
import { fmtSignedMoney } from '../../lib/format'
import type { SymbolStat } from '../../types/analytics'
import PnlBreakdown from '../ui/PnlBreakdown'

const R = 80
const CIRCUMFERENCE = 2 * Math.PI * R

interface PositionDistributionCardProps {
  bySymbol: SymbolStat[]
}

/** "Position Distribution by Asset" — donut of trades per ticker + legend. */
export default function PositionDistributionCard({
  bySymbol,
}: PositionDistributionCardProps) {
  const totalTrades = bySymbol.reduce((sum, s) => sum + s.trades, 0)
  const segments = bySymbol.map((s, i) => ({
    name: displaySymbol(s.symbol),
    color: seriesColor(s.symbol, i),
    trades: s.trades,
    pct: totalTrades > 0 ? (s.trades / totalTrades) * 100 : 0,
    pnl: s.realized_pnl,
    pnlNet: s.realized_pnl_net,
  }))

  let offset = 0

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
      data-aos-delay="300"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Target size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Position Distribution by Asset
          </div>
          <div className="text-[12px] text-muted mt-px">
            Distribution of trades by ticker symbol · P&L before fees
          </div>
        </div>
      </div>

      <div className="flex items-center gap-[22px] flex-wrap">
        <div className="relative w-[200px] flex-none mx-auto">
          <svg viewBox="0 0 220 220" className="w-full block">
            <g transform="rotate(-90 110 110)">
              {totalTrades === 0 && (
                <circle
                  cx="110"
                  cy="110"
                  r={R}
                  fill="none"
                  stroke="var(--hair)"
                  strokeWidth="32"
                />
              )}
              {segments.map((s) => {
                const len = (s.pct / 100) * CIRCUMFERENCE
                const dashOffset = -offset
                offset += len
                return (
                  <circle
                    key={s.name}
                    cx="110"
                    cy="110"
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="32"
                    strokeDasharray={`${Math.max(0, len - 2.5)} ${CIRCUMFERENCE - Math.max(0, len - 2.5)}`}
                    strokeDashoffset={dashOffset}
                  />
                )
              })}
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-mono text-[26px] font-extrabold tracking-[-0.5px]">
              {totalTrades}
            </span>
            <span className="text-[10.5px] font-bold tracking-[0.6px] text-faint uppercase">
              trades
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-[220px] flex flex-col gap-2">
          {segments.length === 0 && (
            <div className="text-[10.5px] text-muted font-semibold">
              No closed trades yet
            </div>
          )}
          {segments.map((s) => (
            <div
              className="flex items-center gap-2.5 py-[9px] px-[11px] rounded-nav bg-surface2 border border-hair"
              key={s.name}
            >
              <span
                className="w-2.5 h-2.5 rounded-[3px] flex-none"
                style={{ background: s.color }}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[12.5px] font-extrabold">{s.name}</span>
                <span className="text-[10.5px] text-muted font-semibold">
                  {s.trades} trades · {s.pct.toFixed(1)}%
                </span>
              </div>
              <PnlBreakdown gross={s.pnl} net={s.pnlNet} heading={s.name} className="flex-none">
                <span
                  className={`font-mono text-[12px] font-bold ${s.pnl < 0 ? 'text-red' : 'text-green'}`}
                >
                  {fmtSignedMoney(s.pnl)}
                </span>
              </PnlBreakdown>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
