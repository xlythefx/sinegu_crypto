import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Layers } from 'lucide-react'
import { useApiData } from '../../hooks/useApiData'
import { getPastPositions } from '../../services/dashboard'
import { pastPositionsToStrategyTrades } from '../../lib/strategyDetail'
import {
  computeStrategyStats,
  groupTradesByStrategy,
  type StrategyStats,
} from '../../lib/strategyStats'
import { fmtSignedMoney } from '../../lib/format'
import { linePath } from '../../lib/chart'
import PnlBreakdown from '../ui/PnlBreakdown'

const NO_EXCLUDE = new Set<string>()

/** Small cumulative-P&L sparkline for a strategy's equity series. */
function Sparkline({ stats }: { stats: StrategyStats }) {
  const W = 132
  const H = 40
  const values = useMemo(
    () => [0, ...stats.equitySeries.map((p) => p.cumulative)],
    [stats.equitySeries],
  )
  if (values.length < 2)
    return (
      <div className="w-[132px] h-10 flex-none max-[560px]:hidden bg-[repeating-linear-gradient(90deg,var(--hair),var(--hair)_2px,transparent_2px,transparent_6px)] opacity-40 rounded-[4px]" />
    )
  const up = stats.totalPnl >= 0
  const stroke = up ? 'var(--green)' : 'var(--red)'
  const d = linePath(values, W, H, 4)
  return (
    <svg
      className="w-[132px] h-10 flex-none max-[560px]:hidden"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * "Strategy Analysis" section for the Performance Analytics page. Self-fetches
 * the user's closed trades, groups them by the strategy tag, and lists each
 * strategy's headline stats with a link to its in-depth detail page.
 */
export default function StrategyAnalysisCard() {
  const { data, loading, error } = useApiData(getPastPositions)
  const [filter, setFilter] = useState<string>('all')

  const strategies = useMemo(() => {
    const trades = pastPositionsToStrategyTrades(data ?? [])
    const grouped = groupTradesByStrategy(trades)
    return Array.from(grouped.entries())
      .map(([key, list]) => computeStrategyStats(key, list, NO_EXCLUDE))
      .sort((a, b) => b.totalPnl - a.totalPnl)
  }, [data])

  const visible =
    filter === 'all' ? strategies : strategies.filter((s) => s.key === filter)

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Layers size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Strategy Analysis
          </div>
          <div className="text-[12px] text-muted mt-px">
            How each of your trading strategies is performing · before fees
          </div>
        </div>
      </div>

      {loading && !data ? (
        <p className="text-[13px] text-muted pt-[18px] px-0.5 pb-1.5 leading-[1.6]">
          Loading strategies…
        </p>
      ) : error ? (
        <p className="text-[13px] text-muted pt-[18px] px-0.5 pb-1.5 leading-[1.6]">
          Couldn’t load strategy data.
        </p>
      ) : strategies.length === 0 ? (
        <p className="text-[13px] text-muted pt-[18px] px-0.5 pb-1.5 leading-[1.6]">
          No strategy-tagged trades yet. Once your bots close positions, each
          strategy’s performance will appear here.
        </p>
      ) : (
        <>
          {strategies.length > 1 && (
            <div className="flex flex-wrap gap-[7px] mb-3.5">
              <button
                type="button"
                className={`text-[12px] font-bold py-1.5 px-3 rounded-pill cursor-pointer font-body border ${filter === 'all' ? 'bg-accent border-accent text-on-accent' : 'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              {strategies.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`text-[12px] font-bold py-1.5 px-3 rounded-pill cursor-pointer font-body border ${filter === s.key ? 'bg-accent border-accent text-on-accent' : 'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'}`}
                  onClick={() => setFilter((f) => (f === s.key ? 'all' : s.key))}
                >
                  {s.key}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-[10px] max-[900px]:grid-cols-1">
            {visible.map((s) => (
              <Link
                key={s.key}
                to={`/dashboard/strategies/${encodeURIComponent(s.key)}`}
                className="flex items-center gap-stack py-[13px] px-[15px] border border-hair rounded-strip bg-surface2 no-underline text-inherit transition-[border-color,transform] duration-150 hover:border-accent-line hover:-translate-y-px max-[560px]:gap-2.5"
              >
                <div className="flex flex-col gap-[3px] min-w-0 flex-1">
                  <div className="text-[14.5px] font-extrabold text-text whitespace-nowrap overflow-hidden text-ellipsis">
                    {s.key}
                  </div>
                  <div className="font-mono text-[11.5px] text-muted font-semibold">
                    {s.totalTrades} trades · {s.winrate.toFixed(1)}% WR · PF{' '}
                    {s.profitFactor === null ? '∞' : s.profitFactor.toFixed(2)}
                  </div>
                </div>
                <Sparkline stats={s} />
                <div className="flex flex-col items-end gap-1 flex-none">
                  {/* The row is a link, so the hover is mouse-only; the
                      after-fees line beneath is what a phone reads. */}
                  <PnlBreakdown hoverOnly gross={s.totalPnl} net={s.totalPnlNet} heading={s.key}>
                    <span
                      className={`font-mono text-[15px] font-extrabold ${s.totalPnl < 0 ? 'text-red' : 'text-green'}`}
                    >
                      {fmtSignedMoney(s.totalPnl)}
                    </span>
                  </PnlBreakdown>
                  {s.fees !== 0 && (
                    <span className="font-mono text-[10.5px] text-faint whitespace-nowrap">
                      {fmtSignedMoney(s.totalPnlNet)} after fees
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
                    Details <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
