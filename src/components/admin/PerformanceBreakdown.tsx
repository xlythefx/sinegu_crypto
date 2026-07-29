import { Activity } from 'lucide-react'
import { useApiData } from '../../hooks/useApiData'
import { getAdminPerformance } from '../../services/admin'
import { fmtShortDate, fmtSignedMoney } from '../../lib/format'
import type { AdminPerformance, PerformanceWindow } from '../../types/admin'

const ROWS: { key: keyof AdminPerformance['breakdown']; title: string }[] = [
  { key: 'daily', title: 'Daily' },
  { key: 'weekly', title: 'Weekly' },
  { key: 'monthly', title: 'Monthly' },
]

/** "Jul 19 – Jul 23", collapsing a single-day window to just "Jul 23". */
function rangeLabel(w: PerformanceWindow): string {
  const from = fmtShortDate(w.from)
  const to = fmtShortDate(w.to)
  return from === to ? to : `${from} – ${to}`
}

/** Daily / weekly / monthly snapshots, live from /admin/performance. */
export default function PerformanceBreakdown() {
  const { data, loading, error } = useApiData(() => getAdminPerformance())
  const breakdown = data?.breakdown

  return (
    <section
      className="rounded-card border border-border bg-surface p-card max-w-[420px] max-[1100px]:max-w-none grow basis-[320px]"
      data-aos="fade-up"
      data-aos-delay="200"
    >
      <div className="flex items-center gap-2.5 mb-[14px]">
        <span className="w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none">
          <Activity size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Performance Breakdown
          </div>
          <div className="text-[12px] text-muted mt-px">
            Daily, weekly, and monthly snapshots for context.
          </div>
        </div>
      </div>

      {!breakdown ? (
        <div className="grid min-h-[180px] place-items-center px-4 text-center text-[13px] text-muted">
          {loading
            ? 'Loading breakdown…'
            : error
              ? 'Could not load performance data.'
              : 'No closed trades yet.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ROWS.map(({ key, title }) => {
            const w = breakdown[key]
            return (
              <div
                className="rounded-row border border-hair bg-surface2 py-[14px] px-4 transition-[border-color] duration-150 hover:border-border"
                key={key}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold">{title}</span>
                  <span className="inline-flex items-center whitespace-nowrap rounded-pill border border-border py-[3px] px-[9px] font-mono text-[11px] font-semibold text-muted">
                    {rangeLabel(w)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-faint">
                      P&L
                    </span>
                    <span
                      className={`font-mono text-[16px] font-extrabold ${
                        w.pnl < 0 ? 'text-red' : 'text-green'
                      }`}
                    >
                      {fmtSignedMoney(w.pnl)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-faint">
                      Trades
                    </span>
                    <span className="font-mono text-[16px] font-extrabold">
                      {w.trades}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
