import { useMemo, useState, type MouseEvent } from 'react'
import { linePath } from '../../lib/chart'
import { fmtMediumDate, fmtShortDate, fmtSignedMoney } from '../../lib/format'
import type { AssetEquityPoint } from '../../types/dashboard'
import './AssetEquityChart.css'

const W = 600
const H = 220
const PAD = 14

/** Rank-tinted stroke, matching the mother dashboard's medal colors. */
function strokeFor(rank: number): string {
  if (rank === 1) return '#d97706'
  if (rank === 2) return '#64748b'
  if (rank === 3) return '#c2410c'
  return 'var(--accent)'
}

interface AssetEquityChartProps {
  points: AssetEquityPoint[]
  rank: number
}

/** Per-asset cumulative-P&L line chart with a nearest-point hover tooltip. */
export default function AssetEquityChart({
  points,
  rank,
}: AssetEquityChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  const { path, yMin, yMax, coords } = useMemo(() => {
    const values = points.map((p) => p.cumulative)
    const padded = values.length === 1 ? [values[0], values[0]] : values
    const min = Math.min(0, ...padded)
    const max = Math.max(0, ...padded)
    const span = max - min || 1
    const stepX = W / (padded.length - 1)
    return {
      path: linePath(values, W, H, PAD, min, max),
      yMin: min,
      yMax: max,
      coords: padded.map((v, i) => ({
        x: i * stepX,
        y: H - PAD - ((v - min) / span) * (H - PAD * 2),
      })),
    }
  }, [points])

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const idx = Math.round(ratio * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, idx)))
  }

  const hovered = hover !== null ? points[hover] : null
  const hoveredCoord = hover !== null ? coords[hover] : null

  return (
    <div className="aeq">
      <div className="aeq__frame">
        <span className="aeq__y aeq__y--max mono">{fmtSignedMoney(yMax, 0)}</span>
        <span className="aeq__y aeq__y--min mono">{fmtSignedMoney(yMin, 0)}</span>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="aeq__svg"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <g stroke="var(--hair)" strokeWidth="1">
            <line x1="0" y1={H * 0.25} x2={W} y2={H * 0.25} />
            <line x1="0" y1={H * 0.5} x2={W} y2={H * 0.5} />
            <line x1="0" y1={H * 0.75} x2={W} y2={H * 0.75} />
          </g>
          {path && (
            <path
              d={path}
              fill="none"
              stroke={strokeFor(rank)}
              strokeWidth={rank <= 3 ? 3 : 2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {hoveredCoord && (
            <>
              <line
                x1={hoveredCoord.x}
                y1="0"
                x2={hoveredCoord.x}
                y2={H}
                stroke="var(--muted)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={hoveredCoord.x}
                cy={hoveredCoord.y}
                r="4.5"
                fill={strokeFor(rank)}
                stroke="var(--surface)"
                strokeWidth="2"
              />
            </>
          )}
        </svg>
        {hovered && hoveredCoord && (
          <div
            className="aeq__tooltip"
            style={{
              left: `${(hoveredCoord.x / W) * 100}%`,
              top: `${(hoveredCoord.y / H) * 100}%`,
            }}
          >
            <span className="aeq__tooltip-date">
              {fmtMediumDate(hovered.date)}
            </span>
            <span
              className={`aeq__tooltip-value mono ${hovered.cumulative < 0 ? 'is-neg' : 'is-pos'}`}
            >
              {fmtSignedMoney(hovered.cumulative)}
            </span>
          </div>
        )}
      </div>
      {points.length > 0 && (
        <div className="aeq__axis mono">
          <span>{fmtShortDate(points[0].date)}</span>
          {points.length > 2 && (
            <span>{fmtShortDate(points[Math.floor((points.length - 1) / 2)].date)}</span>
          )}
          <span>{fmtShortDate(points[points.length - 1].date)}</span>
        </div>
      )}
    </div>
  )
}
