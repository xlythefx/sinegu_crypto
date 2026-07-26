import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import { fmtShortDate } from '../../../lib/format'
import type { RollingPoint } from '../../../lib/strategyStats'

const W = 600
const H = 240
const PAD = 18

/** 20-trade rolling win-rate (%) + Sharpe — surfaces edge decay over time. */
export default function RollingCard({ rolling }: { rolling: RollingPoint[] }) {
  const chart = useMemo(() => {
    if (rolling.length < 2) return null
    const stepX = W / (rolling.length - 1)

    // Win rate on a fixed 0–100 scale
    const wrY = (v: number) => H - PAD - (v / 100) * (H - PAD * 2)
    const wrPath = rolling
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${wrY(p.winRate).toFixed(1)}`)
      .join(' ')

    // Sharpe on its own min/max scale
    const sh = rolling.map((p) => p.sharpe)
    let min = Math.min(...sh, 0)
    let max = Math.max(...sh, 0)
    if (min === max) {
      min -= 1
      max += 1
    }
    const shY = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2)
    const shPath = rolling
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${shY(p.sharpe).toFixed(1)}`)
      .join(' ')

    const labels: string[] = []
    const n = Math.min(6, rolling.length)
    for (let i = 0; i < n; i++) {
      const idx = Math.round((i * (rolling.length - 1)) / Math.max(1, n - 1))
      labels.push(fmtShortDate(rolling[idx].date))
    }
    return { wrPath, shPath, midY: wrY(50), labels }
  }, [rolling])

  return (
    <section className="dcard asd-rolling" data-aos="fade-up">
      <div className="asd-section-head">
        <div className="dcard__title-row">
          <span className="dchip">
            <Activity size={16} />
          </span>
          <div>
            <div className="dcard__title">Rolling Performance</div>
            <div className="dcard__sub">
              20-trade rolling win rate &amp; Sharpe
            </div>
          </div>
        </div>
        {chart && (
          <div className="asd-legend">
            <span>
              <i className="asd-legend__dot" style={{ background: 'var(--green)' }} />
              Win rate
            </span>
            <span>
              <i className="asd-legend__dot" style={{ background: '#6366f1' }} />
              Sharpe
            </span>
          </div>
        )}
      </div>

      {!chart ? (
        <div className="asd-empty">
          Need at least 20 closed trades to chart rolling metrics.
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="asd-rolling__svg"
          >
            <line
              x1="0"
              y1={chart.midY}
              x2={W}
              y2={chart.midY}
              stroke="var(--hair)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <path
              d={chart.wrPath}
              fill="none"
              stroke="var(--green)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={chart.shPath}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <div className="asd-rolling__axis mono">
            {chart.labels.map((l, i) => (
              <span key={`${l}-${i}`}>{l}</span>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
