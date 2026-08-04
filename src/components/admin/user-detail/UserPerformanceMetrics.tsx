import { BarChart3 } from 'lucide-react'
import MetricTile, { type Tone } from '../../analytics/MetricTile'
import { fmtPctOf, fmtSignedMoney } from '../../../lib/format'
import type { AdminUserSummary } from '../../../types/admin'

const toneOf = (n: number): Tone => (n < 0 ? 'neg' : 'pos')

interface UserPerformanceMetricsProps {
  summary: AdminUserSummary | null
  loading: boolean
}

/** The 6 performance tiles: trades, winrate, PF, total P&L and day streaks. */
export default function UserPerformanceMetrics({
  summary,
  loading,
}: UserPerformanceMetricsProps) {
  const m = summary?.metrics

  return (
    <section className="flex flex-col rounded-card border border-border bg-surface p-card">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <BarChart3 size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Performance Metrics
          </div>
          <div className="mt-px text-[12px] text-muted">
            Closed-trade statistics across live accounts
          </div>
        </div>
      </div>

      {!summary || !m ? (
        <div className="grid min-h-[140px] flex-1 place-items-center text-[13px] text-muted">
          {loading ? 'Loading metrics…' : 'Could not load metrics.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          <MetricTile label="Total Trades" value={String(m.total_trades)} />
          <MetricTile
            label="Winrate"
            value={m.win_rate === null ? '—' : `${m.win_rate.toFixed(1)}%`}
            sub={`${m.wins}W / ${m.losses}L`}
          />
          <MetricTile
            label="Profit Factor"
            value={
              m.profit_factor === null ? 'Perfect' : m.profit_factor.toFixed(2)
            }
            tone={m.profit_factor === null ? 'pos' : ''}
          />
          <MetricTile
            label="Total P&L"
            value={fmtSignedMoney(summary.total_pnl)}
            tone={toneOf(summary.total_pnl)}
            sub={fmtPctOf(summary.total_pnl, summary.pct_base, 2)}
            subTone={toneOf(summary.total_pnl)}
          />
          <MetricTile
            label="Max Consecutive Winning Days"
            value={`${m.max_win_streak_days} day${m.max_win_streak_days === 1 ? '' : 's'}`}
            tone="pos"
          />
          <MetricTile
            label="Max Consecutive Losing Days"
            value={`${m.max_loss_streak_days} day${m.max_loss_streak_days === 1 ? '' : 's'}`}
            tone="neg"
          />
        </div>
      )}
    </section>
  )
}
