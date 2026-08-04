import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Link2, Plus } from 'lucide-react'
import { linePath } from '../../lib/chart'
import { fmtNum, fmtPctOf, fmtSigned, fmtShortDate } from '../../lib/format'
import type { EquityPoint } from '../../types/dashboard'

type RangeKey = '1W' | '1M' | '3M' | 'YTD' | 'All'

const RANGES: RangeKey[] = ['1W', '1M', '3M', 'YTD', 'All']

const RANGE_START: Record<Exclude<RangeKey, 'All' | 'YTD'>, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
}

function PnlStat({
  label,
  value,
  pct,
  negative = false,
}: {
  label: string
  value: string
  pct: string
  negative?: boolean
}) {
  const tone = negative ? 'text-red' : 'text-green'
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="text-[10px] font-extrabold tracking-[0.6px] text-faint uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-[7px] flex-wrap">
        <span className={`font-mono text-[15px] font-extrabold ${tone}`}>
          {value}
        </span>
        <span className={`font-mono text-[11px] font-bold ${tone}`}>{pct}</span>
      </div>
    </div>
  )
}

interface EquityHeroCardProps {
  equity: number
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  pctBase: number
  curve: EquityPoint[]
  /** false = no exchange connected: swaps the LIVE pill and chart for a
   *  "connect a broker" empty state. Defaults to true. */
  connected?: boolean
}

/** Equity hero: ACCOUNT EQUITY label + LIVE pill, big mono balance, the
 *  realized/unrealized/total split, range tabs and the area chart. */
export default function EquityHeroCard({
  equity,
  realizedPnl,
  unrealizedPnl,
  totalPnl,
  pctBase,
  curve,
  connected = true,
}: EquityHeroCardProps) {
  const [range, setRange] = useState<RangeKey>('All')

  const { path, axisLabels } = useMemo(() => {
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
    const values = points.map((p) => p.equity)
    const labelCount = Math.min(6, points.length)
    const labels: string[] = []
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i * (points.length - 1)) / Math.max(1, labelCount - 1))
      labels.push(fmtShortDate(points[idx].date))
    }
    return { path: linePath(values, 1200, 190, 14), axisLabels: labels }
  }, [curve, range])

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
                label="Realized P&L"
                value={fmtSigned(realizedPnl)}
                pct={fmtPctOf(realizedPnl, pctBase)}
                negative={realizedPnl < 0}
              />
              <PnlStat
                label="Unrealized P&L"
                value={fmtSigned(unrealizedPnl)}
                pct={fmtPctOf(unrealizedPnl, pctBase)}
                negative={unrealizedPnl < 0}
              />
              <PnlStat
                label="Total P&L"
                value={fmtSigned(totalPnl)}
                pct={fmtPctOf(totalPnl, pctBase)}
                negative={totalPnl < 0}
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
      <svg
        viewBox="0 0 1200 190"
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
          <line x1="0" y1="45" x2="1200" y2="45" />
          <line x1="0" y1="90" x2="1200" y2="90" />
          <line x1="0" y1="135" x2="1200" y2="135" />
        </g>
        {path && (
          <>
            <path d={`${path} L1200,190 L0,190 Z`} fill="url(#dheroFill)" />
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
