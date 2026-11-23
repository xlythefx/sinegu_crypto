import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, ListOrdered, TrendingDown, TrendingUp } from 'lucide-react'
import { InsightCard, EmptyNote } from '../insights/parts'
import PnlBreakdown from '../../ui/PnlBreakdown'
import { EXCHANGE_META } from '../../exchanges/meta'
import { fmtMoney, fmtSignedMoney, fmtSignedPct } from '../../../lib/format'
import { GAP_PART_LABELS, fmtGap, followRate, mainReason, sortRows, type VsSortKey } from '../../../lib/vsMaster'
import type { VsMasterRow } from '../../../types/vsMaster'
import type { ExchangeKind } from '../../../types/exchanges'

const TH = 'py-2.5 px-3 text-left text-[10.5px] font-bold uppercase tracking-[0.3px] text-faint whitespace-nowrap'
const TD = 'py-2.5 px-3 align-middle'
const NUM = `${TD} text-right font-mono whitespace-nowrap`
const tone = (n: number | null) => (n === null || n === 0 ? 'text-muted' : n > 0 ? 'text-green' : 'text-red')
const RANK_TONE = ['bg-accent text-on-accent', 'bg-accent-soft text-accent border border-accent-line', 'bg-accent-soft text-accent border border-accent-line']

const COLUMNS: { key: VsSortKey; label: string; right?: boolean; title?: string }[] = [
  { key: 'rank', label: '#' },
  { key: 'name', label: 'Customer' },
  { key: 'rank', label: 'Return', right: true, title: 'Each day’s P&L after fees over the capital that day started with, added up' },
  { key: 'gap', label: 'vs master', right: true, title: 'Their return minus the master’s, in percentage points' },
  { key: 'pnl', label: 'P&L', right: true, title: 'After fees — hover for before fees' },
  { key: 'trades', label: 'Trades', right: true },
  { key: 'win_rate', label: 'Win rate', right: true, title: 'Closes that made money after fees' },
  { key: 'followed', label: 'Followed', right: true, title: 'Master closes they also closed: same coin and side, within 15 minutes' },
  { key: 'days', label: 'Days ahead', right: true, title: 'Days the master traded on which they did at least as well' },
  { key: 'balance', label: 'Balance', right: true },
  { key: 'gap', label: 'Main reason', title: 'The part of the gap that moved them most — click the row for the full split' },
]

const venue = (kind: string) => (kind in EXCHANGE_META ? EXCHANGE_META[kind as ExchangeKind].label : kind)

/** The full ranking, sortable by any column; each name opens that customer's analytics. */
export default function VsMasterTable({
  rows,
  animateKey,
  selected,
  onSelect,
}: {
  rows: VsMasterRow[]
  animateKey: string
  selected: string
  onSelect: (uniId: string) => void
}) {
  const [sort, setSort] = useState<{ key: VsSortKey; dir: 'asc' | 'desc'; col: number }>({ key: 'rank', dir: 'asc', col: 0 })
  const sorted = sortRows(rows, sort.key, sort.dir)

  const click = (key: VsSortKey, col: number) =>
    setSort((s) =>
      s.col === col
        ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, col, dir: key === 'rank' || key === 'name' ? 'asc' : 'desc' },
    )

  return (
    <InsightCard icon={ListOrdered} title="Ranking" subtitle={`${rows.length} customers · click a row to compare it with the master`}>
      {rows.length === 0 ? (
        <EmptyNote>No customer matches.</EmptyNote>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table key={`${animateKey}|${sort.col}|${sort.dir}`} className="w-full min-w-[1120px] border-collapse text-[12.5px] animate-[fadeup_0.35s_ease-out]">
            <thead>
              <tr className="border-b border-hair">
                {COLUMNS.map((c, i) => {
                  const active = sort.col === i
                  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
                  return (
                    <th key={c.label} className={`${TH} ${c.right ? 'text-right' : ''}`} title={c.title}>
                      <button
                        type="button"
                        onClick={() => click(c.key, i)}
                        className={`inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[10.5px] font-bold uppercase tracking-[0.3px] ${
                          active ? 'text-accent' : 'text-faint hover:text-text'
                        }`}
                      >
                        {c.label}
                        <Icon size={11} />
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const rate = followRate(r)
                const days = r.days_ahead + r.days_behind
                const reason = mainReason(r)
                return (
                  <tr
                    key={r.uni_id}
                    onClick={() => onSelect(r.uni_id)}
                    aria-selected={selected === r.uni_id}
                    className={`cursor-pointer border-b border-hair transition-colors last:border-0 hover:bg-surface2 ${
                      selected === r.uni_id ? 'bg-accent-soft' : ''
                    }`}
                  >
                    <td className={TD}>
                      <span
                        className={`inline-grid h-6 min-w-6 place-items-center rounded-pill px-1.5 font-mono text-[11px] font-bold ${
                          RANK_TONE[r.rank - 1] ?? 'text-faint'
                        }`}
                      >
                        {r.rank}
                      </span>
                    </td>
                    <td className={TD}>
                      <Link
                        to={`/admin/users/${r.uni_id}?tab=analytics`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-text hover:text-accent"
                      >
                        {r.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10.5px] text-muted">
                        {r.exchanges.map(venue).join(' · ')}
                        {!r.connected && (
                          <span className="rounded-[5px] border border-border px-1 font-bold uppercase tracking-[0.3px] text-faint">
                            Disconnected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`${NUM} font-bold ${tone(r.pct)}`}>{r.pct === null ? '—' : fmtSignedPct(r.pct, 2)}</td>
                    <td className={NUM}>
                      {r.gap === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 font-bold ${tone(r.gap)}`}>
                          {r.gap >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          {fmtGap(r.gap)}
                        </span>
                      )}
                    </td>
                    <td className={NUM}>
                      <PnlBreakdown gross={r.pnl_gross} net={r.pnl} hoverOnly>
                        <span className={tone(r.pnl)}>{fmtSignedMoney(r.pnl)}</span>
                      </PnlBreakdown>
                    </td>
                    <td className={NUM}>{r.trades}</td>
                    <td className={NUM}>{r.win_rate === null ? '—' : `${r.win_rate.toFixed(0)}%`}</td>
                    <td className={NUM}>
                      {rate === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <div className="ml-auto flex w-[110px] flex-col items-end gap-1">
                          <span>
                            {r.followed}/{r.master_closes}
                            {r.missed > 0 && <span className="ml-1 text-red">· {r.missed} missed</span>}
                          </span>
                          <span className="h-1 w-full overflow-hidden rounded-pill bg-surface2">
                            <span
                              className={`block h-full origin-left rounded-pill animate-[growx_0.6s_ease-out_both] ${rate >= 100 ? 'bg-green' : rate >= 75 ? 'bg-accent' : 'bg-red'}`}
                              style={{ width: `${rate}%` }}
                            />
                          </span>
                        </div>
                      )}
                    </td>
                    <td className={NUM}>{days === 0 ? '—' : `${r.days_ahead}/${days}`}</td>
                    <td className={NUM}>{r.balance === null ? '—' : fmtMoney(r.balance)}</td>
                    <td className={`${TD} whitespace-nowrap text-[12px]`}>
                      {reason ? (
                        <span className={reason.value < 0 ? 'text-red' : 'text-green'}>
                          {GAP_PART_LABELS[reason.part]} <b className="font-mono">{fmtGap(reason.value)}</b>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </InsightCard>
  )
}
