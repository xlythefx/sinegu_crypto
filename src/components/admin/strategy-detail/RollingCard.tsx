import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import { fmtShortDate } from '../../../lib/format'
import type { RollingPoint } from '../../../lib/strategyStats'

const W = 600
const H = 240
const PAD = 18

const CARD = 'rounded-card border border-border bg-surface p-card'
const TITLE_ROW = 'flex items-center gap-2.5 mb-3.5'
const CHIP =
  'w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'
const EMPTY =
  'py-[30px] px-4 border border-dashed border-border rounded-row bg-surface2 text-center text-[13px] text-muted'

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
    <section className={CARD} data-aos="fade-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className={TITLE_ROW}>
          <span className={CHIP}>
            <Activity size={16} />
          </span>
          <div>
            <div className={CARD_TITLE}>Rolling Performance</div>
            <div className={CARD_SUB}>
              20-trade rolling win rate &amp; Sharpe
            </div>
          </div>
        </div>
        {chart && (
          <div className="flex gap-3.5 text-[11.5px] font-semibold text-muted">
            <span className="inline-flex items-center gap-1.5">
              <i
                className="w-[9px] h-[9px] rounded-full"
                style={{ background: 'var(--green)' }}
              />
              Win rate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i
                className="w-[9px] h-[9px] rounded-full"
                style={{ background: '#6366f1' }}
              />
              Sharpe
            </span>
          </div>
        )}
      </div>

      {!chart ? (
        <div className={EMPTY}>
          Need at least 20 closed trades to chart rolling metrics.
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-[240px] block"
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
          <div className="flex text-[10.5px] text-faint mt-1.5 font-mono">
            {chart.labels.map((l, i) => (
              <span key={`${l}-${i}`} className="flex-1 text-center">
                {l}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
