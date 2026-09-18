import { useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  buildChartModel,
  nearestMark,
  VB_H,
  VB_W,
  X0,
  type ChartMode,
} from '../../lib/trackRecord'
import { fmtLongMonth, fmtMediumDate, fmtSignedPct } from '../../lib/format'
import type { TrackRecordPoint } from '../../types/publicStats'

interface TrackRecordChartProps {
  series: TrackRecordPoint[]
  mode: ChartMode
  /** Shown in place of the curve while loading or when nothing is published. */
  placeholder?: string
}

const AXIS_LABEL = 'font-mono text-[11px] max-[560px]:text-[10px] text-faint'
/** The plot and the axis-label column must share this height, or the
 * percentage-positioned tick labels drift off their gridlines. */
const PLOT_HEIGHT = 'h-[340px] max-[700px]:h-[240px]'

/** What the hovered figure IS on each view — the tooltip's caption, because
 *  the views are not on one basis (see CHART_MODES). */
const MARK_CAPTION: Record<ChartMode, string> = {
  cumulative: 'Return on capital',
  daily: 'Day return',
  monthly: 'Month return',
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * The master account's percentage curve. Percent axis by design: the endpoint
 * behind it publishes returns only, never balances, so there is no dollar
 * figure available to plot here — see PublicStatsController's privacy rule.
 * The hover readout is bound by the same rule: a percentage and a trade count
 * per day, never an amount.
 *
 * Axis labels are absolutely positioned off the same tick list that draws the
 * gridlines, so they stay aligned at any range (the SVG is stretched with
 * `preserveAspectRatio="none"`, which a flex column could not track). The
 * crosshair is HTML positioned by fractions for the same reason — an SVG
 * circle under that stretch would flatten into an ellipse.
 */
export default function TrackRecordChart({
  series,
  mode,
  placeholder,
}: TrackRecordChartProps) {
  const model = useMemo(() => buildChartModel(series, mode), [series, mode])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  /** Snap to the nearest plotted period rather than interpolate, so the
   *  readout only ever shows a figure that was actually published. */
  const trackPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || !model) return
    setHoverIdx(nearestMark(model.marks, (e.clientX - rect.left) / rect.width))
  }

  // Empty/loading frame: the grid and baseline only, so the card keeps its
  // height and never flashes a curve that isn't real.
  if (!model) {
    return (
      <div
        className={`${PLOT_HEIGHT} flex items-center justify-center border border-hair rounded-xl bg-surface2`}
      >
        <span className="text-[13px] text-muted text-center px-6">
          {placeholder ?? 'No verified history to show yet.'}
        </span>
      </div>
    )
  }

  const hovered = hoverIdx !== null ? (model.marks[hoverIdx] ?? null) : null

  return (
    <div className="flex gap-3.5 max-[560px]:gap-2">
      <div className={`relative w-16 max-[560px]:w-12 ${PLOT_HEIGHT} shrink-0`}>
        {model.ticks.map((tick) => (
          <span
            key={tick.value}
            className={`${AXIS_LABEL} absolute right-0 -translate-y-1/2 whitespace-nowrap`}
            style={{ top: `${tick.topPct}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div
          ref={plotRef}
          className="relative touch-pan-y"
          onPointerMove={trackPointer}
          onPointerLeave={() => setHoverIdx(null)}
        >
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className={`w-full ${PLOT_HEIGHT} block`}
            role="img"
            aria-label={`${mode} percentage return of the master account`}
          >
            <defs>
              <linearGradient id="trFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d9ad55" stopOpacity=".38" />
                <stop offset="100%" stopColor="#d9ad55" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g stroke="var(--hair)" strokeWidth="1">
              {model.ticks.map((tick) => (
                <line
                  key={tick.value}
                  x1={X0}
                  x2={VB_W - X0}
                  y1={(tick.topPct / 100) * VB_H}
                  y2={(tick.topPct / 100) * VB_H}
                />
              ))}
            </g>
            <line
              x1={X0}
              x2={VB_W - X0}
              y1={model.zeroY}
              y2={model.zeroY}
              stroke="var(--muted)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity=".7"
            />
            <g transform={`translate(${X0},0)`}>
              <path d={model.areaPath} fill="url(#trFill)" />
              <path
                d={model.path}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1000}
                strokeDasharray="1000"
                strokeDashoffset="1000"
                className="animate-[draw_2.6s_ease_0.2s_forwards]"
              />
              <circle
                cx={model.end.x}
                cy={model.end.y}
                r="5"
                fill="var(--accent)"
                opacity="0"
                className="animate-[fadeup_0.4s_ease_2.6s_forwards]"
              />
            </g>
            <text
              x={X0 + 8}
              y={model.zeroY - 8}
              fontFamily="'IBM Plex Mono',monospace"
              fontSize="12"
              fill="var(--muted)"
            >
              {model.baselineLabel}
            </text>
          </svg>

          {hovered && (
            <>
              <span
                className="pointer-events-none absolute inset-y-0 w-px bg-[var(--accent)] opacity-40"
                style={{ left: `${hovered.xFrac * 100}%` }}
              />
              <span
                className="pointer-events-none absolute h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-[0_0_0_4px_var(--glow)]"
                style={{
                  left: `${hovered.xFrac * 100}%`,
                  top: `${hovered.yFrac * 100}%`,
                }}
              />
              <div
                className="pointer-events-none absolute top-2 z-10 rounded-card border border-border bg-surface2/97 px-3 py-2 backdrop-blur-sm"
                style={{
                  left: `${hovered.xFrac * 100}%`,
                  transform: `translateX(${
                    hovered.xFrac > 0.75
                      ? 'calc(-100% - 12px)'
                      : hovered.xFrac < 0.25
                        ? '12px'
                        : '-50%'
                  })`,
                }}
              >
                <div className="font-mono text-[10.5px] tracking-[0.4px] text-faint whitespace-nowrap">
                  {mode === 'monthly'
                    ? fmtLongMonth(hovered.date)
                    : fmtMediumDate(hovered.date)}
                </div>
                <div
                  className={`font-mono text-[15px] font-extrabold whitespace-nowrap ${
                    hovered.value < 0 ? 'text-red' : 'text-green'
                  }`}
                >
                  {fmtSignedPct(hovered.value, 2)}
                </div>
                <div className="font-mono text-[10.5px] text-faint whitespace-nowrap">
                  {MARK_CAPTION[mode]} · {plural(hovered.trades, 'trade')}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="relative h-4 mt-1.5">
          {model.labels.map((label, i) => {
            const last = i === model.labels.length - 1
            return (
              <span
                key={label.key}
                // The end labels anchor to their own edge instead of centering,
                // so neither can be clipped by the card on a narrow screen.
                className={[
                  'font-mono text-[10.5px] text-faint absolute whitespace-nowrap',
                  i === 0 ? '' : last ? '-translate-x-full' : '-translate-x-1/2',
                  // Thin the labels out rather than let them collide.
                  i % 2 === 1 && !last ? 'max-[900px]:hidden' : '',
                  i % 4 !== 0 && !last ? 'max-[560px]:hidden' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ left: `${label.leftPct}%` }}
              >
                {label.text}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
