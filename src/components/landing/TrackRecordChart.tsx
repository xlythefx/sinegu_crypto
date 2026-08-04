import { useMemo } from 'react'
import { buildChartModel, VB_H, VB_W, X0, type ChartMode } from '../../lib/trackRecord'
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

/**
 * The master account's percentage curve. Percent axis by design: the endpoint
 * behind it publishes returns only, never balances, so there is no dollar
 * figure available to plot here — see PublicStatsController's privacy rule.
 *
 * Axis labels are absolutely positioned off the same tick list that draws the
 * gridlines, so they stay aligned at any range (the SVG is stretched with
 * `preserveAspectRatio="none"`, which a flex column could not track).
 */
export default function TrackRecordChart({
  series,
  mode,
  placeholder,
}: TrackRecordChartProps) {
  const model = useMemo(() => buildChartModel(series, mode), [series, mode])

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
