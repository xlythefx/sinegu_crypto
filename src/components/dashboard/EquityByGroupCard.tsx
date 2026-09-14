import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, TrendingUp, X } from 'lucide-react'
import { displaySymbol, linePath, linePoints, seriesColor } from '../../lib/chart'
import { fmtSigned } from '../../lib/format'
import type { GroupSeries } from '../../types/dashboard'

type GroupKey = 'asset' | 'strategy'

interface EquityByGroupCardProps {
  assets: GroupSeries[]
  strategies: GroupSeries[]
}

const VB_W = 600
const VB_H = 200

/** One stat row inside the selection tooltip. */
function TipRow({
  label,
  value,
  tone = '',
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10.5px] font-semibold tracking-[0.3px] text-faint uppercase">
        {label}
      </span>
      <span className={`font-mono text-[12px] font-bold ${tone || 'text-text'}`}>
        {value}
      </span>
    </div>
  )
}

/** "Equity by Asset / Strategy" — multi-line cumulative P&L with a checkable
 *  legend filter and a By Asset / By Strategy toggle.
 *
 *  Hovering a line brings it forward; clicking one pins it and opens its stats.
 *  Both only ever DIM the rest — the legend checkboxes are what removes a curve,
 *  and a chart that hid its other series on click would read as having lost
 *  them. */
export default function EquityByGroupCard({
  assets,
  strategies,
}: EquityByGroupCardProps) {
  const [group, setGroup] = useState<GroupKey>('asset')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tip, setTip] = useState({ x: 0.5, y: 0.5 })
  const plotRef = useRef<HTMLDivElement>(null)

  const series = useMemo(() => {
    const source = group === 'asset' ? assets : strategies
    return source.map((s, i) => ({
      id: s.id,
      name: group === 'asset' ? displaySymbol(s.id) : s.id,
      color: seriesColor(s.id, i),
      total: s.total,
      totalNet: s.total_net,
      fees: s.fees,
      trades: s.trades,
      winRate: s.win_rate,
      profitFactor: s.profit_factor,
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
    return shown.map((s) => {
      const pts = linePoints(s.values, VB_W, VB_H, 12, yMin, yMax)
      return {
        ...s,
        path: linePath(s.values, VB_W, VB_H, 12, yMin, yMax),
        end: pts[pts.length - 1],
      }
    })
  }, [shown])

  /** Pinned beats hovered — a click is a decision, a mouse crossing the plot on
   *  its way somewhere else is not. */
  const activeId = selectedId ?? hoverId
  const selected = selectedId
    ? (series.find((s) => s.id === selectedId) ?? null)
    : null

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
    setSelectedId(null)
    setHoverId(null)
  }

  // A pinned series that gets hidden (legend, "None", a group switch) must not
  // leave its stats card floating over a curve that is no longer drawn.
  useEffect(() => {
    if (selectedId && hidden.has(selectedId)) setSelectedId(null)
  }, [hidden, selectedId])

  useEffect(() => {
    if (!selectedId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const pin = (id: string, e: { clientX: number; clientY: number }) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      setTip({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      })
    }
    setSelectedId((prev) => (prev === id ? null : id))
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
              Cumulative P&L contribution · before fees
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
        <div ref={plotRef} className="relative">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className="w-full h-[220px] block"
            onPointerLeave={() => setHoverId(null)}
            onClick={() => setSelectedId(null)}
          >
            <g stroke="var(--hair)" strokeWidth="1">
              <line x1="0" y1="50" x2={VB_W} y2="50" />
              <line x1="0" y1="100" x2={VB_W} y2="100" />
              <line x1="0" y1="150" x2={VB_W} y2="150" />
            </g>

            {paths.map((s) => {
              const isActive = activeId === s.id
              const dimmed = activeId !== null && !isActive
              return (
                <path
                  key={s.id}
                  d={s.path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={isActive ? 3 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={dimmed ? 0.18 : 1}
                  className="transition-[opacity,stroke-width] duration-150"
                  style={
                    isActive
                      ? { filter: `drop-shadow(0 0 5px ${s.color}aa)` }
                      : undefined
                  }
                />
              )
            })}

            {/* Invisible fat strokes: a 2px line is not a hit target. Drawn last
                so they sit above every visible path. */}
            {paths.map((s) => (
              <path
                key={`${s.id}-hit`}
                d={s.path}
                fill="none"
                stroke="transparent"
                strokeWidth="16"
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="stroke"
                className="cursor-pointer"
                onPointerEnter={() => setHoverId(s.id)}
                onPointerMove={() => setHoverId(s.id)}
                onClick={(e) => {
                  e.stopPropagation()
                  pin(s.id, e)
                }}
              />
            ))}
          </svg>

          {/* End-of-curve marker on the active line. Drawn in HTML rather than
              as an SVG <circle> because preserveAspectRatio="none" stretches
              the viewBox unevenly and would flatten the dot into an ellipse. */}
          {paths.map((s) =>
            activeId === s.id && s.end ? (
              <span
                key={`${s.id}-dot`}
                className="pointer-events-none absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                style={{
                  left: `${(s.end.x / VB_W) * 100}%`,
                  top: `${(s.end.y / VB_H) * 100}%`,
                  background: s.color,
                }}
              />
            ) : null,
          )}

          {/* Hover label — name + total, while nothing is pinned. */}
          {!selectedId && hoverId && (
            <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-2 rounded-btn border border-border bg-surface2/95 px-2.5 py-1.5 backdrop-blur-sm">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background:
                    series.find((s) => s.id === hoverId)?.color ?? 'var(--accent)',
                }}
              />
              <span className="text-[11.5px] font-bold text-text">
                {series.find((s) => s.id === hoverId)?.name}
              </span>
              <span
                className={`font-mono text-[11.5px] font-bold ${
                  (series.find((s) => s.id === hoverId)?.total ?? 0) < 0
                    ? 'text-red'
                    : 'text-green'
                }`}
              >
                {fmtSigned(series.find((s) => s.id === hoverId)?.total ?? 0)}
              </span>
              <span className="text-[10.5px] text-faint">click to pin</span>
            </div>
          )}

          {/* Pinned stats. */}
          {selected && (
            <div
              className="absolute z-20 w-[188px] rounded-card border border-border bg-surface2/97 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm animate-[fadeup_0.2s_ease-out]"
              style={{
                left: `${tip.x * 100}%`,
                top: `${Math.min(0.82, Math.max(0.18, tip.y)) * 100}%`,
                transform: `translate(${tip.x > 0.6 ? 'calc(-100% - 14px)' : '14px'}, -50%)`,
              }}
            >
              <div className="mb-2.5 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: selected.color }}
                />
                <span className="grow text-[12.5px] font-extrabold text-text">
                  {selected.name}
                </span>
                <button
                  type="button"
                  className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-btn text-muted transition-colors hover:text-text"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="flex flex-col gap-[7px]">
                <TipRow
                  label="Before fees"
                  value={fmtSigned(selected.total)}
                  tone={selected.total < 0 ? 'text-red' : 'text-green'}
                />
                <TipRow
                  label="Exchange fees"
                  value={selected.fees === 0 ? '0.00' : fmtSigned(-selected.fees)}
                />
                <TipRow
                  label="After fees"
                  value={fmtSigned(selected.totalNet)}
                  tone={selected.totalNet < 0 ? 'text-red' : 'text-green'}
                />
                <TipRow label="Trades" value={String(selected.trades)} />
                <TipRow
                  label="Win rate"
                  value={
                    selected.winRate !== null
                      ? `${selected.winRate.toFixed(1)}%`
                      : '—'
                  }
                />
                <TipRow
                  label="Profit factor"
                  value={
                    selected.profitFactor !== null
                      ? selected.profitFactor.toFixed(2)
                      : '∞'
                  }
                  tone={
                    selected.profitFactor === null ||
                    selected.profitFactor >= 1
                      ? 'text-green'
                      : 'text-red'
                  }
                />
              </div>
            </div>
          )}
        </div>
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
            const isActive = activeId === s.id
            return (
              <button
                key={s.id}
                type="button"
                className={`flex items-center gap-[7px] py-[5px] px-2.5 rounded-[9px] border border-border bg-transparent cursor-pointer transition-[opacity,background,border-color,box-shadow] duration-150${on ? '' : ' opacity-50'}`}
                style={
                  on
                    ? {
                        borderColor: `${s.color}66`,
                        background: `${s.color}14`,
                        boxShadow: isActive ? `0 0 0 1.5px ${s.color}` : undefined,
                      }
                    : undefined
                }
                onClick={() => toggle(s.id)}
                onPointerEnter={() => on && setHoverId(s.id)}
                onPointerLeave={() => setHoverId(null)}
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
                  className={`font-mono text-[11.5px] font-bold${s.total < 0 ? ' text-red' : ' text-green'}`}
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
