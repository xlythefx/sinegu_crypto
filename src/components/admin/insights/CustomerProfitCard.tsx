import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import PnlBreakdown from '../../ui/PnlBreakdown'
import { Segmented } from '../../ui/filters'
import { EmptyNote, InsightCard } from './parts'
import { fmtMediumDate, fmtSignedMoney, fmtSignedPct } from '../../../lib/format'
import type { ProfitFigures, ProfitRow, ProfitWindow } from '../../../types/adminInsights'

type Month = 'this_month' | 'last_month'

/** Rows per group before "Show all". */
const FIRST_ROWS = 5

const tone = (n: number) => (n < 0 ? 'text-red' : n > 0 ? 'text-green' : 'text-muted')
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

/** The % when there is one, the dollars otherwise: what decides profit or loss. */
const score = (r: ProfitFigures) => r.pct ?? r.pnl

/** "+2.4%" over "−$46.32 after fees", before-fees on hover. */
function Figures({ f }: { f: ProfitFigures }) {
  return (
    <PnlBreakdown gross={f.pnl_gross} net={f.pnl} className="flex-none flex-col items-end text-right">
      <span className={`block font-mono text-[13.5px] font-bold ${tone(score(f))}`}>
        {f.pct === null ? '—' : fmtSignedPct(f.pct, 2)}
      </span>
      <span className="block font-mono text-[11.5px] text-muted">{fmtSignedMoney(f.pnl)}</span>
    </PnlBreakdown>
  )
}

function Group({ label, rows, toneClass }: { label: string; rows: ProfitRow[]; toneClass: string }) {
  const [all, setAll] = useState(false)
  if (rows.length === 0) return null
  const shown = all ? rows : rows.slice(0, FIRST_ROWS)
  return (
    <div>
      <div className={`mb-1 text-[11.5px] font-bold uppercase tracking-[0.06em] ${toneClass}`}>
        {label} · {rows.length}
      </div>
      <ol className="m-0 flex list-none flex-col divide-y divide-hair p-0">
        {shown.map((r, i) => (
          <li key={r.uni_id} className="flex items-center gap-3 py-2 text-[13px]">
            <span className="w-4 flex-none text-right font-mono text-[12px] text-faint">{i + 1}</span>
            <Link to={`/admin/users/${r.uni_id}?tab=analytics`} className="min-w-0 flex-1 hover:text-accent">
              <span className="block truncate font-semibold">{r.name}</span>
              <span className="block text-[11.5px] text-muted">{plural(r.trades, 'closed trade')}</span>
            </Link>
            <Figures f={r} />
          </li>
        ))}
      </ol>
      {rows.length > FIRST_ROWS && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-accent hover:underline"
        >
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

/**
 * Customer profit for a calendar month, best and worst (Dima, 2026-11-11:
 * the old "top customers by profit" ranked dollars over a rolling 30 days,
 * so a losing month read as a top list of losers and account size decided
 * the order). Ranked by RETURN on the capital each day started with, so a
 * withdrawal after a loss cannot make it look bigger; the master's figure
 * on top says what the strategy itself did in the same month.
 */
export default function CustomerProfitCard({ profit }: { profit: Record<Month, ProfitWindow> }) {
  const [month, setMonth] = useState<Month>('this_month')
  const w = profit[month]
  const made = w.customers.filter((r) => score(r) >= 0)
  // Worst first: the losses an admin should look at lead the group.
  const lost = w.customers.filter((r) => score(r) < 0).reverse()

  return (
    <InsightCard
      icon={TrendingUp}
      title="Customer profit"
      subtitle={`${fmtMediumDate(w.from)} – ${fmtMediumDate(w.to)} · closed trades, after fees`}
    >
      <div className="mb-3">
        <Segmented
          size="sm"
          ariaLabel="Month"
          value={month}
          onChange={setMonth}
          options={[
            { value: 'this_month', label: 'This month' },
            { value: 'last_month', label: 'Last month' },
          ]}
        />
      </div>

      <div key={month} className="flex flex-1 flex-col gap-3.5 animate-[fadeup_0.35s_ease-out]">
        <div className="flex items-center gap-3 rounded-row border border-border bg-surface2 px-3 py-2.5 text-[13px]">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">The strategy (master account)</span>
            <span className="block text-[11.5px] text-muted">
              {w.master ? plural(w.master.trades, 'closed trade') : 'No closed trades this month'}
            </span>
          </span>
          {w.master && <Figures f={w.master} />}
        </div>

        {w.customers.length === 0 ? (
          <EmptyNote>No customer closed a trade in this month yet.</EmptyNote>
        ) : (
          <>
            <Group label="Made money" rows={made} toneClass="text-green" />
            <Group label="Lost money" rows={lost} toneClass="text-red" />
          </>
        )}

        <p className="m-0 mt-auto text-[11.5px] leading-[1.5] text-faint">
          % = each day's profit over the balance that day started with, added up — the customer's Period
          Return on Performance Analytics. Deposits and withdrawals don't move it. Hover a figure for before fees.
        </p>
      </div>
    </InsightCard>
  )
}
