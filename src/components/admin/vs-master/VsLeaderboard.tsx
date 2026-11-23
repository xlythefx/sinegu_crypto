import { useState } from 'react'
import { Crown, Medal } from 'lucide-react'
import { InsightCard, EmptyNote } from '../insights/parts'
import PnlBreakdown from '../../ui/PnlBreakdown'
import { Segmented } from '../../ui/filters'
import { fmtSignedMoney, fmtSignedPct } from '../../../lib/format'
import { leaderboard, type LeaderBy } from '../../../lib/vsMaster'
import type { VsMasterData, VsMasterRow } from '../../../types/vsMaster'

const FIRST = 10
const tone = (n: number | null) => (n === null || n === 0 ? 'text-muted' : n > 0 ? 'text-green' : 'text-red')
const PLACE = [
  'bg-[#e8b84a] text-[#3b2a05]',
  'bg-[#c9ced6] text-[#22262c]',
  'bg-[#cd8a4f] text-[#2e1707]',
]

/**
 * The P&L leaderboard: the master pinned on top as the benchmark, then every
 * customer best first — by dollars after fees (before fees on hover) or by
 * return. Bars are each row's share of the biggest figure on the board.
 */
export default function VsLeaderboard({
  rows,
  master,
  onSelect,
  selected,
}: {
  rows: VsMasterRow[]
  master: VsMasterData['master']
  onSelect: (uniId: string) => void
  selected: string
}) {
  const [by, setBy] = useState<LeaderBy>('pnl')
  const [all, setAll] = useState(false)
  const entries = leaderboard(rows, master, by)
  const shown = all ? entries : entries.slice(0, FIRST + (master ? 1 : 0))
  const value = (e: (typeof entries)[number]) => (by === 'pnl' ? e.pnl : (e.pct ?? 0))
  const max = Math.max(1e-9, ...entries.map((e) => Math.abs(value(e))))

  return (
    <InsightCard icon={Medal} title="P&L leaderboard" subtitle="The master on top · customers best first · after fees">
      <div className="mb-3 flex justify-end">
        <Segmented<LeaderBy>
          size="sm"
          ariaLabel="Rank by"
          value={by}
          onChange={setBy}
          options={[
            { value: 'pnl', label: 'By P&L $', tone: 'neutral' },
            { value: 'pct', label: 'By return %', tone: 'neutral' },
          ]}
        />
      </div>
      {entries.length === 0 ? (
        <EmptyNote>Nobody traded in this window.</EmptyNote>
      ) : (
        <ol key={by} className="m-0 flex list-none flex-col gap-1.5 p-0">
          {shown.map((e, i) => {
            const v = value(e)
            const width = Math.max(2, (Math.abs(v) / max) * 100)
            const isSel = e.uniId !== null && e.uniId === selected
            return (
              <li
                key={e.key}
                className={`relative flex items-center gap-3 overflow-hidden rounded-row border px-3 py-2 animate-[fadeup_0.4s_cubic-bezier(0.22,1,0.36,1)_both] ${
                  e.isMaster
                    ? 'border-accent-line bg-[linear-gradient(to_right,var(--accentSoft),var(--surface))]'
                    : isSel
                      ? 'border-accent-line bg-surface2'
                      : 'border-hair bg-surface'
                }`}
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                <span
                  className={`grid h-7 w-7 flex-none place-items-center rounded-pill font-mono text-[12px] font-extrabold ${
                    e.isMaster ? 'bg-accent text-on-accent' : (PLACE[(e.place ?? 0) - 1] ?? 'bg-surface2 text-muted')
                  }`}
                  aria-label={e.isMaster ? 'Master' : `Place ${e.place}`}
                >
                  {e.isMaster ? <Crown size={14} /> : e.place}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    {e.isMaster ? (
                      <span className="truncate font-display text-[13.5px] font-extrabold text-accent">Master</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(e.uniId!)}
                        className="min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[13px] font-semibold text-text hover:text-accent"
                        title={`Compare ${e.name} with the master`}
                      >
                        {e.name}
                      </button>
                    )}
                    <span className="flex-none text-[11px] text-faint">{e.trades} trades</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-surface2">
                    <div
                      className={`h-full origin-left rounded-pill animate-[growx_0.7s_cubic-bezier(0.22,1,0.36,1)_both] ${
                        e.isMaster ? 'bg-accent' : v >= 0 ? 'bg-green' : 'bg-red'
                      }`}
                      style={{ width: `${width}%`, animationDelay: `${120 + Math.min(i, 12) * 40}ms` }}
                    />
                  </div>
                </div>
                <div className="flex-none text-right">
                  <PnlBreakdown gross={e.pnlGross} net={e.pnl} hoverOnly className="flex-col items-end">
                    <span className={`block font-mono text-[13.5px] font-bold ${tone(by === 'pnl' ? e.pnl : e.pct)}`}>
                      {by === 'pnl' ? fmtSignedMoney(e.pnl) : e.pct === null ? '—' : fmtSignedPct(e.pct, 2)}
                    </span>
                    <span className="block font-mono text-[11px] text-muted">
                      {by === 'pnl' ? (e.pct === null ? '—' : fmtSignedPct(e.pct, 2)) : fmtSignedMoney(e.pnl)}
                    </span>
                  </PnlBreakdown>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {entries.length > shown.length || all ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 cursor-pointer self-start border-0 bg-transparent p-0 text-[12px] font-semibold text-accent hover:underline"
        >
          {all ? 'Show top 10' : `Show all ${entries.length - (master ? 1 : 0)} customers`}
        </button>
      ) : null}
    </InsightCard>
  )
}
