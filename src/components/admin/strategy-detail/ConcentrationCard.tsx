import { Target } from 'lucide-react'
import { fmtSignedMoney } from '../../../lib/format'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

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
    <section className="dcard asd-conc" data-aos="fade-up" data-aos-delay="50">
      <div className="dcard__title-row">
        <span className="dchip">
          <Target size={16} />
        </span>
        <div>
          <div className="dcard__title">Concentration</div>
          <div className="dcard__sub">
            Share of P&L by instrument
          </div>
        </div>
      </div>

      {stats.concentration.length === 0 ? (
        <div className="asd-empty">No trades in this view.</div>
      ) : (
        <>
          <div className="asd-conc__summary">
            {top && (
              <span>
                Top: <b>{top.display}</b>{' '}
                <em className={top.pnl >= 0 ? 'is-pos' : 'is-neg'}>
                  ({fmtSignedMoney(top.pnl)})
                </em>
              </span>
            )}
            <span className="asd-conc__muted">
              Top 3 = {stats.top3Share.toFixed(0)}% of activity
            </span>
            {highConcentration && (
              <span className="asd-conc__flag">High concentration</span>
            )}
          </div>

          <div className="asd-conc__rows">
            {stats.concentration.map((i) => (
              <div className="asd-conc__row" key={i.ticker}>
                <span className="asd-conc__name">{i.display}</span>
                <span className="asd-conc__track">
                  <span
                    className={`asd-conc__fill ${i.pnl >= 0 ? 'is-bg-pos' : 'is-bg-neg'}`}
                    style={{ width: `${Math.max(2, i.pctAbs)}%` }}
                  />
                </span>
                <span
                  className={`asd-conc__pnl mono ${i.pnl >= 0 ? 'is-pos' : 'is-neg'}`}
                >
                  {fmtSignedMoney(i.pnl)}
                </span>
                <span className="asd-conc__pct mono">{i.pctAbs.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
