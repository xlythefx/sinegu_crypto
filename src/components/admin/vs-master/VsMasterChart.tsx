import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { InsightCard, EmptyNote } from '../insights/parts'
import { fmtSignedPct } from '../../../lib/format'
import type { VsMasterRow } from '../../../types/vsMaster'

const FIRST = 15

/**
 * Every customer's return as a bar from zero, ranked, with the master's
 * return drawn as one line through all of them — left of the line is
 * behind the master, right of it ahead. Bars grow out of the zero line.
 */
export default function VsMasterChart({ rows, masterPct }: { rows: VsMasterRow[]; masterPct: number | null }) {
  const [all, setAll] = useState(false)
  const ranked = rows.filter((r) => r.pct !== null)
  const shown = all ? ranked : ranked.slice(0, FIRST)

  const values = [0, ...ranked.map((r) => r.pct as number), ...(masterPct !== null ? [masterPct] : [])]
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const pad = (hi - lo || 1) * 0.08
  lo = lo < 0 ? lo - pad : lo
  hi = hi > 0 ? hi + pad : hi
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100
  const zero = x(0)
  const masterX = masterPct !== null ? x(masterPct) : null

  return (
    <InsightCard
      icon={BarChart3}
      title="Return ranking"
      subtitle="Each customer’s return after fees · the gold line is the master"
      className="mb-4"
    >
      {ranked.length === 0 ? (
        <EmptyNote>No customer has a return to compare in this window.</EmptyNote>
      ) : (
        <>
          <div className="relative">
            {masterX !== null && (
              <div
                className="pointer-events-none absolute inset-y-0 z-[1] ml-[136px] max-[560px]:ml-[96px]"
                style={{ left: 0, right: 64 }}
                aria-hidden="true"
              >
                <div
                  className="absolute -top-1 bottom-0 border-l-2 border-dashed border-accent"
                  style={{ left: `${masterX}%` }}
                >
                  <span className="absolute -top-[18px] -translate-x-1/2 whitespace-nowrap rounded-pill bg-accent px-1.5 font-mono text-[10px] font-bold text-on-accent">
                    Master {fmtSignedPct(masterPct as number, 2)}
                  </span>
                </div>
              </div>
            )}
            <ol className="m-0 mt-5 flex list-none flex-col gap-1.5 p-0">
              {shown.map((r, i) => {
                const v = r.pct as number
                const left = Math.min(zero, x(v))
                const width = Math.max(0.6, Math.abs(x(v) - zero))
                const ahead = r.gap !== null && r.gap >= 0
                return (
                  <li key={r.uni_id} className="flex items-center gap-2 text-[12px]">
                    <Link
                      to={`/admin/users/${r.uni_id}?tab=analytics`}
                      className="w-[128px] flex-none truncate font-semibold text-text hover:text-accent max-[560px]:w-[88px]"
                      title={r.name}
                    >
                      <span className="mr-1 font-mono text-[10.5px] text-faint">{r.rank}</span>
                      {r.name}
                    </Link>
                    <div className="relative h-[18px] min-w-0 flex-1 rounded-[5px] bg-surface2">
                      <div className="absolute inset-y-0 w-px bg-border" style={{ left: `${zero}%` }} />
                      <div
                        className={`absolute inset-y-[3px] rounded-[4px] ${v >= 0 ? 'bg-green origin-left' : 'bg-red origin-right'} ${
                          ahead ? '' : 'opacity-80'
                        } animate-[growx_0.7s_cubic-bezier(0.22,1,0.36,1)_both]`}
                        style={{ left: `${left}%`, width: `${width}%`, animationDelay: `${Math.min(i, 20) * 35}ms` }}
                      />
                    </div>
                    <span
                      className={`w-[56px] flex-none text-right font-mono font-bold ${v > 0 ? 'text-green' : v < 0 ? 'text-red' : 'text-muted'}`}
                    >
                      {fmtSignedPct(v, 2)}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
          {ranked.length > FIRST && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="mt-3 cursor-pointer self-start border-0 bg-transparent p-0 text-[12px] font-semibold text-accent hover:underline"
            >
              {all ? 'Show top 15' : `Show all ${ranked.length}`}
            </button>
          )}
        </>
      )}
    </InsightCard>
  )
}
