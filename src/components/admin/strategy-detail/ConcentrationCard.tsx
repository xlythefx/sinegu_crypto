import { Target } from 'lucide-react'
import { fmtSignedMoney } from '../../../lib/format'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

const CARD = 'rounded-card border border-border bg-surface p-card'
const TITLE_ROW = 'flex items-center gap-2.5 mb-3.5'
const CHIP =
  'w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'
const EMPTY =
  'py-[30px] px-4 border border-dashed border-border rounded-row bg-surface2 text-center text-[13px] text-muted'

/** Share-of-P&L-by-instrument bars; flags over-reliance on one ticker. */
export default function ConcentrationCard({
  stats,
}: {
  stats: StrategyDetailStats
}) {
  const top = stats.concentration[0] ?? null
  const highConcentration =
    stats.top3Share >= 80 && stats.concentration.length > 3

  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay="50">
      <div className={TITLE_ROW}>
        <span className={CHIP}>
          <Target size={16} />
        </span>
        <div>
          <div className={CARD_TITLE}>Concentration</div>
          <div className={CARD_SUB}>Share of P&L by instrument</div>
        </div>
      </div>

      {stats.concentration.length === 0 ? (
        <div className={EMPTY}>No trades in this view.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mb-3 text-[12.5px]">
            {top && (
              <span>
                Top: <b>{top.display}</b>{' '}
                <em className={top.pnl >= 0 ? 'text-green' : 'text-red'}>
                  ({fmtSignedMoney(top.pnl)})
                </em>
              </span>
            )}
            <span className="text-muted">
              Top 3 = {stats.top3Share.toFixed(0)}% of activity
            </span>
            {highConcentration && (
              <span className="py-0.5 px-[9px] border border-accent-line rounded-pill text-[11px] font-bold text-accent bg-accent-soft">
                High concentration
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto">
            {stats.concentration.map((i) => (
              <div
                className="grid grid-cols-[92px_1fr_84px_40px] items-center gap-2.5"
                key={i.ticker}
              >
                <span className="text-[12px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                  {i.display}
                </span>
                <span className="h-2 rounded-[4px] bg-surface2 overflow-hidden">
                  <span
                    className={`block h-full rounded-[4px] ${i.pnl >= 0 ? 'bg-green' : 'bg-red'}`}
                    style={{ width: `${Math.max(2, i.pctAbs)}%` }}
                  />
                </span>
                <span
                  className={`text-right text-[12px] font-bold font-mono ${i.pnl >= 0 ? 'text-green' : 'text-red'}`}
                >
                  {fmtSignedMoney(i.pnl)}
                </span>
                <span className="text-right text-[11px] text-faint font-mono">
                  {i.pctAbs.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
