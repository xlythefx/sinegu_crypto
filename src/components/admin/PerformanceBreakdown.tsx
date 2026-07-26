import { Activity } from 'lucide-react'

const PERIODS = [
  {
    title: 'Daily',
    range: 'Jul 23 – Jul 23',
    pnl: '+$412.60',
    trades: '18',
    negative: false,
  },
  {
    title: 'Weekly',
    range: 'Jul 19 – Jul 23',
    pnl: '+$2,148.90',
    trades: '94',
    negative: false,
  },
  {
    title: 'Monthly',
    range: 'Jul 1 – Jul 23',
    pnl: '+$8,964.20',
    trades: '402',
    negative: false,
  },
]

/** Daily / weekly / monthly snapshots for context. */
export default function PerformanceBreakdown() {
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

      <div className="flex flex-col gap-3">
        {PERIODS.map((p) => (
          <div
            className="rounded-row border border-hair bg-surface2 py-[14px] px-4 transition-[border-color] duration-150 hover:border-border"
            key={p.title}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold">{p.title}</span>
              <span className="inline-flex items-center whitespace-nowrap rounded-pill border border-border py-[3px] px-[9px] font-mono text-[11px] font-semibold text-muted">
                {p.range}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-[3px]">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-faint">
                  P&L
                </span>
                <span
                  className={`font-mono text-[16px] font-extrabold ${p.negative ? 'text-red' : 'text-green'}`}
                >
                  {p.pnl}
                </span>
              </div>
              <div className="flex flex-col gap-[3px]">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-faint">
                  Trades
                </span>
                <span className="font-mono text-[16px] font-extrabold">
                  {p.trades}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
