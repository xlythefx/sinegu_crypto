import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Link2, Plus } from 'lucide-react'
import { linePath, linePoints } from '../../lib/chart'
import {
  fmtMediumDate,
  fmtNum,
  fmtPctOf,
  fmtSigned,
  fmtShortDate,
} from '../../lib/format'
import type { EquityPoint, FeeSummary } from '../../types/dashboard'
import PnlBreakdown from '../ui/PnlBreakdown'

const VB_W = 1200
const VB_H = 190

type RangeKey = '1W' | '1M' | '3M' | 'YTD' | 'All'

const RANGES: RangeKey[] = ['1W', '1M', '3M', 'YTD', 'All']

const RANGE_START: Record<Exclude<RangeKey, 'All' | 'YTD'>, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
}

/** A plotted point plus everything the hover readout shows for it. */
interface Mark {
  /** Position in the plot box, 0..1 — resolution-independent, so the overlay
   *  can be plain HTML on top of a stretched viewBox. */
  xFrac: number
  yFrac: number
  date: string
  /** Before fees — what the line is drawn from. */
  equity: number
  /** After fees — what the exchange would report at that point. */
  equityNet: number
  delta: number
}

/** The before-fees level of a point; an older single-point response has none. */
function grossOf(point: EquityPoint): number {
  return point.equity_gross ?? point.equity
}

/** Event time for a curve point: the API's ISO timestamp when it sends one,
 *  else that day at local midnight. */
function pointTime(point: EquityPoint): number {
  const fallback = `${point.date.slice(0, 10)}T00:00:00`
  const parsed = new Date(point.at ?? fallback).getTime()
  return Number.isNaN(parsed) ? new Date(fallback).getTime() : parsed
}

/** ms -> "YYYY-MM-DD" in the viewer's own timezone (fmtShortDate slices this,
 *  so building it from UTC would shift the label a day either side of midnight). */
function localDate(ms: number): string {
  const d = new Date(ms)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function PnlStat({
  label,
  value,
  pct,
  negative = false,
  breakdown,
}: {
  label: string
  value: string
  pct: string
  negative?: boolean
  /** Before/after-fees figures behind the value — wraps it in the hover. */
  breakdown?: { gross: number; net: number; feesSince: string | null }
}) {
  const tone = negative ? 'text-red' : 'text-green'
  const number = (
    <span className={`font-mono text-[15px] font-extrabold ${tone}`}>{value}</span>
  )
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="text-[10px] font-extrabold tracking-[0.6px] text-faint uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-[7px] flex-wrap">
        {breakdown ? (
          <PnlBreakdown gross={breakdown.gross} net={breakdown.net} feesSince={breakdown.feesSince}>
            {number}
          </PnlBreakdown>
        ) : (
          number
        )}
        <span className={`font-mono text-[11px] font-bold ${tone}`}>{pct}</span>
      </div>
    </div>
  )
}

interface EquityHeroCardProps {
  equity: number
  /** After fees. */
  realizedPnl: number
  /** Before fees — the headline. */
  realizedPnlGross: number
  unrealizedPnl: number
  totalPnl: number
  totalPnlGross: number
  fees: FeeSummary
  pctBase: number
  curve: EquityPoint[]
  /** false = no exchange connected: swaps the LIVE pill and chart for a
   *  "connect a broker" empty state. Defaults to true. */
  connected?: boolean
}

/** Equity hero: ACCOUNT EQUITY label + LIVE pill, big mono balance, the
 *  realized/unrealized/total split, range tabs and the area chart.
 *
 *  The split and the line are BEFORE exchange fees — the strategy's result;
 *  hovering a figure or a point shows what landed after fees. The big balance
 *  is the exchange's own number and stays as it is. */
export default function EquityHeroCard({
  equity,
  realizedPnl,
  realizedPnlGross,
  unrealizedPnl,
  totalPnl,
  totalPnlGross,
  fees,
  pctBase,
  curve,
  connected = true,
}: EquityHeroCardProps) {
  const feesSince = fees.trades_without_fee > 0 ? fees.since : null
  const [range, setRange] = useState<RangeKey>('All')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  const { path, axisLabels, marks } = useMemo(() => {
    let points = curve
    if (range !== 'All' && curve.length > 0) {
      const start = new Date()
      if (range === 'YTD') {
        start.setMonth(0, 1)
      } else {
        start.setDate(start.getDate() - RANGE_START[range])
      }
      const iso = start.toISOString().slice(0, 10)
      points = curve.filter((p) => p.date >= iso)
      // Keep the last point before the window as the baseline
      const before = curve.filter((p) => p.date < iso)
      if (before.length > 0) points = [before[before.length - 1], ...points]
    }
    const values = points.map(grossOf)
    if (values.length === 0)
      return { path: '', axisLabels: [] as string[], marks: [] as Mark[] }

    // X by TIME, not by array index. The points are events — a deposit, a closed
    // trade — so index spacing gave a day with four trades four times the width
    // of a day with one, under labels that still read as dates.
    const times = points.map(pointTime)
    const first = times[0]
    const elapsed = times[times.length - 1] - first
    const xs =
      elapsed > 0 ? times.map((t) => (t - first) / elapsed) : undefined

    // Domain. Fitting min..max alone misreads the account in both directions: a
    // deposit squashes real trading into a sliver, and a flat week gets
    // amplified into a mountain range. So the span never falls below 2% of the
    // equity level, and it is padded so the line never touches the frame.
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const mid = (lo + hi) / 2
    const span = Math.max(hi - lo, Math.abs(mid) * 0.02, 1)
    const margin = span * 0.12
    const yMin = mid - span / 2 - margin
    const yMax = mid + span / 2 + margin

    // Labels are evenly spaced in TIME now that x is, so they sit under the
    // point they name rather than under the nth event.
    const labelCount = Math.min(6, points.length)
    const labels: string[] = []
    for (let i = 0; i < labelCount; i++) {
      const t = first + (elapsed * i) / Math.max(1, labelCount - 1)
      labels.push(fmtShortDate(localDate(t)))
    }
    // Same geometry the path is drawn from, expressed as fractions of the box,
    // so the crosshair lands ON the line at any container width.
    const marks: Mark[] = linePoints(
      values,
      VB_W,
      VB_H,
      14,
      yMin,
      yMax,
      xs,
    ).map((p) => ({
      xFrac: p.x / VB_W,
      yFrac: p.y / VB_H,
      date: points[p.index].date,
      equity: grossOf(points[p.index]),
      equityNet: points[p.index].equity,
      /** Change since the start of the visible range — what the range tabs are
       *  for; the absolute equity alone answers a different question. */
      delta: grossOf(points[p.index]) - values[0],
    }))

    return {
      path: linePath(values, VB_W, VB_H, 14, yMin, yMax, xs),
      axisLabels: labels,
      marks,
    }
  }, [curve, range])

  const hovered = hoverIdx !== null ? (marks[hoverIdx] ?? null) : null

  /** Nearest plotted point to the pointer, horizontally. Snapping to a real
   *  point (rather than interpolating) keeps the readout to figures that
   *  actually happened. */
  const trackPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || marks.length === 0) return
    const ratio = (e.clientX - rect.left) / rect.width
    let best = 0
    let bestGap = Infinity
    for (let i = 0; i < marks.length; i++) {
      const gap = Math.abs(marks[i].xFrac - ratio)
      if (gap < bestGap) {
        bestGap = gap
        best = i
      }
    }
    setHoverIdx(best)
  }

  return (
    <section
      className="rounded-card border border-border bg-[linear-gradient(160deg,var(--surface),var(--surface2))] py-[22px] px-6 mb-stack"
      data-aos="fade-up"
    >
      <div className="flex items-start justify-between mb-stack gap-stack flex-wrap">
        <div>
          <div className="flex items-center gap-[9px] mb-[7px]">
            <span className="font-mono text-[11.5px] font-semibold tracking-[1.2px] text-faint">
              ACCOUNT EQUITY
            </span>
            {connected ? (
              <span className="inline-flex items-center gap-[5px] font-mono text-[10px] text-green border border-[rgba(47,214,122,0.35)] bg-[rgba(47,214,122,0.08)] py-[2px] px-2 rounded-pill">
                <span className="w-[5px] h-[5px] rounded-full bg-green animate-[pulse_1.6s_infinite]" />
                LIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-[5px] font-mono text-[10px] text-faint border border-border bg-surface2 py-[2px] px-2 rounded-pill">
                <span className="w-[5px] h-[5px] rounded-full bg-faint" />
                NOT CONNECTED
              </span>
            )}
          </div>
          <div className="font-mono text-[44px] font-extrabold tracking-[-1.2px] leading-none max-[900px]:text-[34px]">
            ${fmtNum(equity)}
          </div>
          {connected && (
            <div className="flex gap-[26px] mt-stack flex-wrap">
              <PnlStat
                label="Realized P&L · before fees"
                value={fmtSigned(realizedPnlGross)}
                pct={fmtPctOf(realizedPnlGross, pctBase)}
                negative={realizedPnlGross < 0}
                breakdown={{ gross: realizedPnlGross, net: realizedPnl, feesSince }}
              />
              <PnlStat
                label="Unrealized P&L"
                value={fmtSigned(unrealizedPnl)}
                pct={fmtPctOf(unrealizedPnl, pctBase)}
                negative={unrealizedPnl < 0}
              />
              <PnlStat
                label="Total P&L · before fees"
                value={fmtSigned(totalPnlGross)}
                pct={fmtPctOf(totalPnlGross, pctBase)}
                negative={totalPnlGross < 0}
                breakdown={{ gross: totalPnlGross, net: totalPnl, feesSince }}
              />
            </div>
          )}
        </div>
        {connected && (
          <div className="flex gap-[3px] bg-surface2 border border-hair rounded-seg p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`font-body py-[5px] px-2.5 text-[11.5px] rounded-btn border ${
                  range === r
                    ? 'bg-surface border-border text-text font-bold'
                    : 'border-transparent bg-transparent text-muted font-semibold'
                }`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {!connected && (
        <div className="min-h-[300px] max-[900px]:min-h-[200px] grid place-items-center">
          <div className="text-center py-8">
            <div className="mx-auto mb-[18px] flex h-[64px] w-[64px] animate-[float_3s_ease-in-out_infinite] items-center justify-center rounded-[18px] border border-accent-line bg-accent-soft text-accent">
              <Link2 size={30} />
            </div>
            <h3 className="font-display text-[17px] font-extrabold tracking-[-0.02em]">
              Connect a broker to start receiving trades
            </h3>
            <p className="mx-auto mt-2 mb-5 max-w-[420px] text-[13px] leading-[1.6] text-muted">
              Live equity, PNL and analytics appear here once an exchange is
              connected.
            </p>
            <Link
              to="/dashboard/exchanges"
              className="mx-auto inline-flex h-[38px] items-center gap-[7px] rounded-pill bg-accent px-4 text-[13px] font-bold text-on-accent shadow-[0_10px_24px_var(--glow)] transition-[filter] hover:brightness-[1.06]"
            >
              <Plus size={15} />
              Connect an exchange
            </Link>
          </div>
        </div>
      )}

      {connected && (
        <div
          ref={plotRef}
          className="relative touch-pan-y"
          onPointerMove={trackPointer}
          onPointerLeave={() => setHoverIdx(null)}
        >
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className="w-full h-[300px] block max-[900px]:h-[200px]"
          >
            <defs>
              <linearGradient id="dheroFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".32" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g stroke="var(--hair)" strokeWidth="1">
              <line x1="0" y1="45" x2={VB_W} y2="45" />
              <line x1="0" y1="90" x2={VB_W} y2="90" />
              <line x1="0" y1="135" x2={VB_W} y2="135" />
            </g>
            {path && (
              <>
                <path
                  d={`${path} L${VB_W},${VB_H} L0,${VB_H} Z`}
                  fill="url(#dheroFill)"
                />
                <path
                  d={path}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pathLength={1000}
                  strokeDasharray="1000"
                  strokeDashoffset="1000"
                  className="animate-[draw_2.2s_ease_0.2s_forwards]"
                />
              </>
            )}
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
                  {fmtMediumDate(hovered.date)} · before fees
                </div>
                <div className="font-mono text-[15px] font-extrabold whitespace-nowrap">
                  ${fmtNum(hovered.equity)}
                </div>
                <div
                  className={`font-mono text-[11px] font-bold whitespace-nowrap ${
                    hovered.delta < 0 ? 'text-red' : 'text-green'
                  }`}
                >
                  {fmtSigned(hovered.delta)} since {range === 'All' ? 'start' : range}
                </div>
                {/* What the exchange would show at that point: the same walk
                    with the fees to date taken out. Equal lines mean no fee
                    on record up to that day. */}
                <div className="mt-1.5 border-t border-hair pt-1.5 font-mono text-[10.5px] text-faint whitespace-nowrap">
                  <span>After fees ${fmtNum(hovered.equityNet)}</span>
                  {hovered.equity !== hovered.equityNet && (
                    <span> · fees to date −${fmtNum(hovered.equity - hovered.equityNet)}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {connected && (
        <div className="flex font-mono text-[10.5px] text-faint mt-[6px]">
          {axisLabels.map((label, i) => (
            <span key={`${label}-${i}`} className="flex-1 text-center">
              {label}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
