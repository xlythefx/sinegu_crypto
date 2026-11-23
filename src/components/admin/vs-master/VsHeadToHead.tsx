import { Link } from 'react-router-dom'
import { ArrowUpRight, Swords, X } from 'lucide-react'
import { InsightCard, EmptyNote } from '../insights/parts'
import DataState from '../../dashboard/DataState'
import { useApiData } from '../../../hooks/useApiData'
import { getVsMasterHeadToHead } from '../../../services/admin'
import { fmtShortDate, fmtSignedPct } from '../../../lib/format'
import { GAP_PART_LABELS, duelSeries, fmtGap, type GapPart } from '../../../lib/vsMaster'
import type { VsMasterRow } from '../../../types/vsMaster'

const W = 640
const H = 220
const PAD = 14
const CUSTOMER = '#60a5fa'
const PART_ORDER: GapPart[] = ['same', 'missed', 'extra', 'before']
const PART_HINT: Record<GapPart, string> = {
  same: 'On the trades both took: their result minus the master’s',
  missed: 'The master’s result on trades they could have taken and did not',
  extra: 'Their own closes with no master trade beside them',
  before: 'The master’s result while they had no account on that exchange yet',
}

/**
 * One customer against the master: both running returns over the window
 * (the daily % added up, like the page's Return) and where the gap comes
 * from. Opened by clicking a customer in the leaderboard or the table.
 */
export default function VsHeadToHead({
  row,
  exchange,
  from,
  to,
  onClose,
}: {
  row: VsMasterRow
  exchange: string
  from: string
  to: string
  onClose: () => void
}) {
  const { data, loading, error, reload } = useApiData(
    () => getVsMasterHeadToHead(row.uni_id, { exchange, from, to }),
    [row.uni_id, exchange, from, to],
  )
  const points = data ? duelSeries(data) : []

  const values = [0, ...points.flatMap((p) => [p.master, p.customer])]
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (hi - lo < 0.5) {
    hi += 0.25
    lo -= 0.25
  }
  const xOf = (i: number) => PAD + (points.length <= 1 ? (W - 2 * PAD) / 2 : (i / (points.length - 1)) * (W - 2 * PAD))
  const yOf = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD)
  const line = (key: 'master' | 'customer') => points.map((p, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(p[key]).toFixed(1)}`).join(' ')
  const last = points.at(-1)

  const parts = row.gap_parts
  const partMax = parts ? Math.max(0.01, ...PART_ORDER.map((k) => Math.abs(parts[k]))) : 1

  return (
    <InsightCard
      icon={Swords}
      title={`${row.name} vs the master`}
      subtitle="Running return, the daily % added up · after fees"
      className="mb-4 animate-[fadeup_0.4s_cubic-bezier(0.22,1,0.36,1)]"
    >
      <div className="-mt-1 mb-3 flex flex-wrap items-center gap-2">
        <Link
          to={`/admin/users/${row.uni_id}?tab=analytics`}
          className="inline-flex items-center gap-1 rounded-btn border border-border px-2.5 py-1 text-[12px] font-semibold text-text hover:border-accent-line hover:text-accent"
        >
          Open their analytics <ArrowUpRight size={13} />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-btn border border-border bg-transparent px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
        >
          <X size={13} /> Close
        </button>
      </div>

      <div className="grid grid-cols-[3fr_2fr] gap-5 max-[1000px]:grid-cols-1">
        <div className="min-w-0">
          {!data ? (
            <DataState loading={loading} error={error} onRetry={reload} label="comparison" />
          ) : points.length === 0 ? (
            <EmptyNote>Neither side closed a trade in this window.</EmptyNote>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-[3px] w-4 rounded-pill bg-accent" /> Master
                  <b className="font-mono">{last ? fmtSignedPct(last.master, 2) : ''}</b>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-[3px] w-4 rounded-pill" style={{ background: CUSTOMER }} /> {row.name}
                  <b className="font-mono">{last ? fmtSignedPct(last.customer, 2) : ''}</b>
                </span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${row.name} and the master's running return`}>
                <line x1={PAD} x2={W - PAD} y1={yOf(0)} y2={yOf(0)} stroke="var(--border)" strokeDasharray="4 4" />
                {(['master', 'customer'] as const).map((key, k) => (
                  <path
                    key={key}
                    d={line(key)}
                    fill="none"
                    stroke={key === 'master' ? 'var(--accent)' : CUSTOMER}
                    strokeWidth={key === 'master' ? 2.75 : 2.25}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    pathLength={1000}
                    strokeDasharray="1000"
                    strokeDashoffset="1000"
                    className="animate-[draw_1.6s_ease_forwards]"
                    style={{ animationDelay: `${k * 250}ms` }}
                  />
                ))}
                {points.length === 1 &&
                  (['master', 'customer'] as const).map((key) => (
                    <circle key={key} cx={xOf(0)} cy={yOf(points[0][key])} r={4} fill={key === 'master' ? 'var(--accent)' : CUSTOMER} />
                  ))}
              </svg>
              <div className="mt-1 flex justify-between font-mono text-[10.5px] text-faint">
                <span>{fmtShortDate(points[0].date)}</span>
                {points.length > 1 && <span>{fmtShortDate(points[points.length - 1].date)}</span>}
              </div>
            </>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Why the gap</div>
          <div className={`mb-3 font-mono text-[22px] font-extrabold ${row.gap === null ? 'text-muted' : row.gap >= 0 ? 'text-green' : 'text-red'}`}>
            {row.gap === null ? '—' : fmtGap(row.gap)}
          </div>
          {!parts ? (
            <p className="text-[12.5px] text-muted">Not measurable: a day in the window has no capital on record.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {PART_ORDER.map((k, i) => {
                const v = parts[k]
                const w = (Math.abs(v) / partMax) * 50
                return (
                  <li key={k} title={PART_HINT[k]}>
                    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="text-text">{GAP_PART_LABELS[k]}</span>
                      <span className={`font-mono font-bold ${v > 0 ? 'text-green' : v < 0 ? 'text-red' : 'text-muted'}`}>{fmtGap(v)}</span>
                    </div>
                    <div className="relative mt-1 h-2 rounded-pill bg-surface2">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                      <div
                        className={`absolute inset-y-0 rounded-pill animate-[growx_0.6s_ease-out_both] ${v >= 0 ? 'origin-left bg-green' : 'origin-right bg-red'}`}
                        style={{ left: v >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, animationDelay: `${i * 70}ms` }}
                      />
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint">
                      {k === 'missed' && row.missed > 0 ? `${row.missed} of ${row.master_closes} master trades missed · ` : ''}
                      {k === 'extra' && row.extra > 0 ? `${row.extra} closes · ` : ''}
                      {PART_HINT[k]}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </InsightCard>
  )
}
