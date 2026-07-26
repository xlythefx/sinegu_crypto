import { Activity } from 'lucide-react'
import './PerformanceBreakdown.css'

const PERIODS = [
  {
    title: 'Daily',
    range: 'Jul 23 – Jul 23',
    pnl: '+$412.60',
    trades: '18',
    negative: false,
  },
  {
    title: 'Weekly',
    range: 'Jul 19 – Jul 23',
    pnl: '+$2,148.90',
    trades: '94',
    negative: false,
  },
  {
    title: 'Monthly',
    range: 'Jul 1 – Jul 23',
    pnl: '+$8,964.20',
    trades: '402',
    negative: false,
  },
]

/** Daily / weekly / monthly snapshots for context. */
export default function PerformanceBreakdown() {
  return (
    <section
      className="dcard apbreak"
      data-aos="fade-up"
      data-aos-delay="200"
    >
      <div className="dcard__title-row">
        <span className="dchip">
          <Activity size={16} />
        </span>
        <div>
          <div className="dcard__title">Performance Breakdown</div>
          <div className="dcard__sub">
            Daily, weekly, and monthly snapshots for context.
          </div>
        </div>
      </div>

      <div className="apbreak__list">
        {PERIODS.map((p) => (
          <div className="apbreak__item" key={p.title}>
            <div className="apbreak__item-head">
              <span className="apbreak__item-title">{p.title}</span>
              <span className="apbreak__range">{p.range}</span>
            </div>
            <div className="apbreak__stats">
              <div className="apbreak__stat">
                <span className="apbreak__stat-label">P&L</span>
                <span
                  className={`apbreak__stat-val ${p.negative ? 'is-neg' : 'is-pos'}`}
                >
                  {p.pnl}
                </span>
              </div>
              <div className="apbreak__stat">
                <span className="apbreak__stat-label">Trades</span>
                <span className="apbreak__stat-val">{p.trades}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
