import { fmtSignedMoney } from '../../../lib/format'

export interface BarDatum {
  label: string
  pnl: number
}

const W = 600
const H = 200
const TOP = 26
const BOTTOM = 26

/** Reusable signed (green/red) bar chart with a zero baseline and value labels.
 *  Used for both seasonality panels and the per-asset P&L chart. */
export default function SignedBars({
  data,
  barMax = 56,
}: {
  data: BarDatum[]
  barMax?: number
}) {
  const max = Math.max(...data.map((d) => d.pnl), 0)
  const min = Math.min(...data.map((d) => d.pnl), 0)
  const span = max - min || 1
  const plot = H - TOP - BOTTOM
  const yOf = (v: number) => TOP + ((max - v) / span) * plot
  const zeroY = yOf(0)
  const slot = W / Math.max(1, data.length)
  const barW = Math.min(barMax, slot * 0.62)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="asd-bars">
      <line
        x1="0"
        y1={zeroY}
        x2={W}
        y2={zeroY}
        stroke="var(--muted)"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      {data.map((d, i) => {
        const x = i * slot + (slot - barW) / 2
        const pos = d.pnl >= 0
        const y = pos ? yOf(d.pnl) : zeroY
        const h = Math.abs(yOf(d.pnl) - zeroY)
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 1)}
              rx="5"
              fill={pos ? 'var(--green)' : 'var(--red)'}
              opacity=".85"
            />
            {d.pnl !== 0 && (
              <text
                x={x + barW / 2}
                y={pos ? y - 6 : y + h + 12}
                textAnchor="middle"
                className={`asd-bars__val ${pos ? 'asd-bars__val--pos' : 'asd-bars__val--neg'}`}
              >
                {fmtSignedMoney(d.pnl, 0)}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={H - 8}
              textAnchor="middle"
              className="asd-bars__label"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
