import { linePath } from '../../lib/chart'
import { fmtMediumDate, fmtSignedPct } from '../../lib/format'
import type { TrackRecordPoint, TrackRecordStats } from '../../types/publicStats'

/** Sparkline viewBox. Stretched to the card's width, so only the ratio matters. */
const VB_W = 320
const VB_H = 88

const DASH = '—'

const FOOT_LABEL = 'text-faint text-[10px] tracking-[0.04em]'
const FOOT_VALUE = 'font-mono text-[13px] text-text'

interface PerformancePanelProps {
  stats: TrackRecordStats | null
  series: TrackRecordPoint[]
}

/**
 * The hero card's second face: the verified record, as one figure and its
 * curve.
 *
 * Deliberately NOT the six-box grid the "See every trade, verified" section
 * renders from the same payload — the reader meets that grid a screen later,
 * and showing it twice makes the hero look like a duplicate rather than a
 * headline. So this is the shape of the order book it alternates with (header
 * strip / body / footer strip), filled with one hero number, the curve behind
 * it, and three supporting figures on one line.
 *
 * Every figure comes off the SAME fetch the section below uses — passed down
 * by the page — so the hero and the grid can never quote different returns.
 */
export default function PerformancePanel({ stats, series }: PerformancePanelProps) {
  const roc = stats?.return_on_capital_pct ?? null

  // The cumulative view's own value: realized P&L to date over all capital
  // invested, which is the figure the headline lands on.
  const curve = series
    .map((point) => point.roc ?? point.cumulative)
    .filter((value): value is number => Number.isFinite(value))

  const path = curve.length > 1 ? linePath(curve, VB_W, VB_H, 8) : null
  const tone = roc === null ? 'text-text' : roc < 0 ? 'text-red' : 'text-green'

  return (
    <div className="h-full flex flex-col bg-surface border border-border rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between py-4 px-5 border-b border-hair flex-wrap gap-2">
        <span className="font-bold text-base">Verified track record</span>
        <span className="font-mono text-[11px] text-accent">● live results</span>
      </div>

      <div className="relative flex-1 py-6 px-5 min-h-[168px]">
        {path && (
          <svg
            className="absolute inset-x-0 bottom-0 w-full h-[96px] opacity-[0.55]"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="hero-roc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${path} L${VB_W},${VB_H} L0,${VB_H} Z`} fill="url(#hero-roc-fill)" />
            <path
              d={path}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        <div className="relative">
          <div className={`font-display text-[52px] leading-none font-extrabold ${tone}`}>
            {roc === null ? DASH : fmtSignedPct(roc, 2)}
          </div>
          <div className="text-[13px] text-muted mt-2">
            Return on every dollar invested
          </div>
          {stats && (
            <div className="font-mono text-[11px] text-faint mt-1.5">
              {fmtMediumDate(stats.first_trade_at)} – {fmtMediumDate(stats.last_trade_at)}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-hair py-3.5 px-5 grid grid-cols-3 gap-3">
        <div>
          <div className={FOOT_LABEL}>WIN RATE</div>
          <div className={FOOT_VALUE}>
            {stats?.win_rate == null ? DASH : `${stats.win_rate.toFixed(1)}%`}
          </div>
        </div>
        <div>
          <div className={FOOT_LABEL}>TRADES</div>
          <div className={FOOT_VALUE}>
            {stats ? stats.trades.toLocaleString('en-US') : DASH}
          </div>
        </div>
        <div>
          <div className={FOOT_LABEL}>TRADING DAYS</div>
          <div className={FOOT_VALUE}>{stats ? stats.trading_days : DASH}</div>
        </div>
      </div>
    </div>
  )
}
