import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { TrendingUp } from 'lucide-react'
import { fmtMediumDate, fmtNum, fmtShortDate, fmtSignedMoney } from '../../../lib/format'
import type { EquityPoint } from '../../../lib/strategyStats'

const W = 600
const H = 260
const PAD_TOP = 16
const PAD_BOTTOM = 16

const CARD = 'rounded-card border border-border bg-surface p-card'
const TITLE_ROW = 'flex items-center gap-2.5 mb-3.5'
const CHIP =
  'w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'

interface Mark {
  xFrac: number
  yFrac: number
  date: string
  cumulative: number
  cumulativeNet: number
}

/** Cumulative-P&L area chart for the strategy (SVG, our design tokens).
 *  Drawn BEFORE exchange fees — the strategy's own result; hovering a point
 *  reads out the after-fees figure beside it. */
export default function EquityCurveCard({
  equitySeries,
}: {
  equitySeries: EquityPoint[]
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)

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
    const marks: Mark[] = equitySeries.map((p, i) => ({
      xFrac: ((i + 1) * step) / W,
      yFrac: yOf(p.cumulative) / H,
      date: p.date,
      cumulative: p.cumulative,
      cumulativeNet: p.cumulativeNet,
    }))
    return {
      line: `M${pts.join(' L')}`,
      area: `M${pts.join(' L')} L${W},${H} L0,${H} Z`,
      zeroY: 0 >= min && 0 <= max ? yOf(0) : null,
      labels,
      marks,
    }
  }, [equitySeries])

  const hovered = hoverIdx !== null ? (curve.marks[hoverIdx] ?? null) : null

  const trackPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || curve.marks.length === 0) return
    const ratio = (e.clientX - rect.left) / rect.width
    let best = 0
    let bestGap = Infinity
    for (let i = 0; i < curve.marks.length; i++) {
      const gap = Math.abs(curve.marks[i].xFrac - ratio)
      if (gap < bestGap) {
        bestGap = gap
        best = i
      }
    }
    setHoverIdx(best)
  }

  return (
    <section className={CARD} data-aos="fade-up">
      <div className={TITLE_ROW}>
        <span className={CHIP}>
          <TrendingUp size={16} />
        </span>
        <div>
          <div className={CARD_TITLE}>Equity Curve</div>
          <div className={CARD_SUB}>Cumulative P&L over time · before fees</div>
        </div>
      </div>

      <div
        ref={plotRef}
        className="relative touch-pan-y"
        onPointerMove={trackPointer}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-[260px] block"
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

        {hovered && (
          <>
            <span
              className="pointer-events-none absolute inset-y-0 w-px bg-[var(--accent)] opacity-40"
              style={{ left: `${hovered.xFrac * 100}%` }}
            />
            <span
              className="pointer-events-none absolute h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-[0_0_0_4px_var(--glow)]"
              style={{ left: `${hovered.xFrac * 100}%`, top: `${hovered.yFrac * 100}%` }}
            />
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-card border border-border bg-surface2/97 px-3 py-2 backdrop-blur-sm"
              style={{
                left: `${hovered.xFrac * 100}%`,
                transform: `translateX(${
                  hovered.xFrac > 0.7 ? 'calc(-100% - 12px)' : hovered.xFrac < 0.3 ? '12px' : '-50%'
                })`,
              }}
            >
              <div className="font-mono text-[10.5px] tracking-[0.4px] text-faint whitespace-nowrap">
                {fmtMediumDate(hovered.date)}
              </div>
              <div
                className={`font-mono text-[15px] font-extrabold whitespace-nowrap ${
                  hovered.cumulative < 0 ? 'text-red' : 'text-green'
                }`}
              >
                {fmtSignedMoney(hovered.cumulative)}
                <span className="ml-1.5 text-[10.5px] font-semibold text-faint">before fees</span>
              </div>
              <div className="font-mono text-[11px] text-muted whitespace-nowrap">
                {fmtSignedMoney(hovered.cumulativeNet)} after fees
                {hovered.cumulative !== hovered.cumulativeNet && (
                  <span className="text-faint">
                    {' '}· fees ${fmtNum(hovered.cumulative - hovered.cumulativeNet)}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex text-[10.5px] text-faint mt-1.5 font-mono">
        {curve.labels.map((l, i) => (
          <span key={`${l}-${i}`} className="flex-1 text-center">
            {l}
          </span>
        ))}
      </div>
    </section>
  )
}
