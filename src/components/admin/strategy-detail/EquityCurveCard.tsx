import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { fmtShortDate } from '../../../lib/format'
import type { EquityPoint } from '../../../lib/strategyStats'

const W = 600
const H = 260
const PAD_TOP = 16
const PAD_BOTTOM = 16

/** Cumulative-P&L area chart for the strategy (SVG, our design tokens). */
export default function EquityCurveCard({
  equitySeries,
}: {
  equitySeries: EquityPoint[]
}) {
  const curve = useMemo(() => {
    const values = [0, ...equitySeries.map((p) => p.cumulative)]
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (min === max) {
      min -= 1
      max += 1
    }
    const yOf = (v: number) =>
      H - PAD_BOTTOM - ((v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM)
    const step = W / Math.max(1, values.length - 1)
    const pts = values.map(
      (v, i) => `${(i * step).toFixed(1)},${yOf(v).toFixed(1)}`,
    )
    const labels: string[] = []
    const n = Math.min(6, equitySeries.length)
    for (let i = 0; i < n; i++) {
      const idx = Math.round((i * (equitySeries.length - 1)) / Math.max(1, n - 1))
      labels.push(fmtShortDate(equitySeries[idx].date))
    }
    return {
      line: `M${pts.join(' L')}`,
      area: `M${pts.join(' L')} L${W},${H} L0,${H} Z`,
      zeroY: 0 >= min && 0 <= max ? yOf(0) : null,
      labels,
    }
  }, [equitySeries])

  return (
    <section className="dcard asd-equity" data-aos="fade-up">
      <div className="dcard__title-row">
        <span className="dchip">
          <TrendingUp size={16} />
        </span>
        <div>
          <div className="dcard__title">Equity Curve</div>
          <div className="dcard__sub">Cumulative P&L over time</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="asd-equity__svg"
      >
        <defs>
          <linearGradient id="asdEquityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity=".3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g stroke="var(--hair)" strokeWidth="1">
          <line x1="0" y1="65" x2={W} y2="65" />
          <line x1="0" y1="130" x2={W} y2="130" />
          <line x1="0" y1="195" x2={W} y2="195" />
        </g>
        <path d={curve.area} fill="url(#asdEquityGrad)" />
        <path
          d={curve.line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {curve.zeroY !== null && (
          <line
            x1="0"
            y1={curve.zeroY}
            x2={W}
            y2={curve.zeroY}
            stroke="var(--muted)"
            strokeWidth="1.2"
            strokeDasharray="5 4"
          />
        )}
      </svg>
      <div className="asd-equity__axis mono">
        {curve.labels.map((l, i) => (
          <span key={`${l}-${i}`}>{l}</span>
        ))}
      </div>
    </section>
  )
}
