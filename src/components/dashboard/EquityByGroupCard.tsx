import { useMemo, useState } from 'react'
import { Check, TrendingUp } from 'lucide-react'
import { displaySymbol, linePath, seriesColor } from '../../lib/chart'
import { fmtSigned } from '../../lib/format'
import type { GroupSeries } from '../../types/dashboard'

type GroupKey = 'asset' | 'strategy'

interface EquityByGroupCardProps {
  assets: GroupSeries[]
  strategies: GroupSeries[]
}

/** "Equity by Asset / Strategy" — multi-line cumulative P&L with a checkable
 *  legend filter and a By Asset / By Strategy toggle. */
export default function EquityByGroupCard({
  assets,
  strategies,
}: EquityByGroupCardProps) {
  const [group, setGroup] = useState<GroupKey>('asset')
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const series = useMemo(() => {
    const source = group === 'asset' ? assets : strategies
    return source.map((s, i) => ({
      id: s.id,
      name: group === 'asset' ? displaySymbol(s.id) : s.id,
      color: seriesColor(s.id, i),
      total: s.total,
      values: s.curve.map((p) => p.cum),
    }))
  }, [group, assets, strategies])

  const shown = series.filter((s) => !hidden.has(s.id))

  // Shared Y-scale across all visible series (always include 0 baseline)
  const paths = useMemo(() => {
    const all = shown.flatMap((s) => s.values)
    if (all.length === 0) return []
    const yMin = Math.min(0, ...all)
    const yMax = Math.max(0, ...all)
    return shown.map((s) => ({
      ...s,
      path: linePath(s.values, 600, 200, 12, yMin, yMax),
    }))
  }, [shown])

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const switchGroup = (g: GroupKey) => {
    setGroup(g)
    setHidden(new Set())
  }

  return (
    <section
      className="rounded-card p-card border border-border bg-surface grow basis-[480px] min-w-0"
      data-aos="fade-up"
      data-aos-delay="150"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-stack">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <TrendingUp size={16} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Equity by {group === 'asset' ? 'Asset' : 'Strategy'}
            </div>
            <div className="text-[12px] text-muted mt-px">
              Cumulative P&L contribution · All
            </div>
          </div>
        </div>
        <div className="flex gap-[3px] bg-surface2 border border-hair rounded-seg p-1">
          {(['asset', 'strategy'] as GroupKey[]).map((g) => (
            <button
              key={g}
              type="button"
              className={`font-body py-[7px] px-[13px] text-[12.5px] rounded-btn border ${
                group === g
                  ? 'bg-surface border-border text-text font-bold'
                  : 'border-transparent bg-transparent text-muted font-semibold'
              }`}
              onClick={() => switchGroup(g)}
            >
              {g === 'asset' ? 'By Asset' : 'By Strategy'}
            </button>
          ))}
        </div>
      </div>

      {paths.length > 0 ? (
        <svg
          viewBox="0 0 600 200"
          preserveAspectRatio="none"
          className="w-full h-[220px] block"
        >
          <g stroke="var(--hair)" strokeWidth="1">
            <line x1="0" y1="50" x2="600" y2="50" />
            <line x1="0" y1="100" x2="600" y2="100" />
            <line x1="0" y1="150" x2="600" y2="150" />
          </g>
          {paths.map((s) => (
            <path
              key={s.id}
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-muted text-[13px] text-center px-4">
          {series.length === 0
            ? 'No closed trades yet — curves appear once your bots start closing positions.'
            : 'Nothing selected — pick one or more below to plot their curves.'}
        </div>
      )}

      <div className="mt-stack">
        <div className="flex items-center justify-between mb-2.5 gap-2.5 flex-wrap">
          <span className="font-mono text-[10.5px] tracking-[0.4px] text-faint">
            {group === 'asset' ? 'ASSETS' : 'STRATEGIES'} · {shown.length} of{' '}
            {series.length} shown
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="text-[11px] font-bold text-accent bg-accent-soft border border-accent-line rounded-btn py-[3px] px-2.5 cursor-pointer"
              onClick={() => setHidden(new Set())}
            >
              All
            </button>
            <button
              type="button"
              className="text-[11px] font-bold text-accent bg-accent-soft border border-accent-line rounded-btn py-[3px] px-2.5 cursor-pointer"
              onClick={() => setHidden(new Set(series.map((s) => s.id)))}
            >
              None
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {series.map((s) => {
            const on = !hidden.has(s.id)
            return (
              <button
                key={s.id}
                type="button"
                className={`flex items-center gap-[7px] py-[5px] px-2.5 rounded-[9px] border border-border bg-transparent cursor-pointer transition-[opacity,background,border-color] duration-150${on ? '' : ' opacity-50'}`}
                style={
                  on
                    ? {
                        borderColor: `${s.color}66`,
                        background: `${s.color}14`,
                      }
                    : undefined
                }
                onClick={() => toggle(s.id)}
                aria-pressed={on}
              >
                <span
                  className="w-[13px] h-[13px] rounded-[4px] border-[1.5px] border-muted flex items-center justify-center flex-none"
                  style={{
                    background: on ? s.color : 'transparent',
                    borderColor: on ? s.color : 'var(--muted)',
                  }}
                >
                  {on && <Check size={9} strokeWidth={3.5} color="#fff" />}
                </span>
                <span
                  className={`text-[12px] font-bold text-text${on ? '' : ' line-through'}`}
                >
                  {s.name}
                </span>
                <span
                  className={`font-mono text-[11.5px] font-bold${s.total < 0 ? ' text-red' : ' text-muted'}`}
                >
                  {fmtSigned(s.total)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
