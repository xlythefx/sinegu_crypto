import { Link } from 'react-router-dom'
import {
  Activity,
  Filter,
  Landmark,
  LogOut,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import DataState from '../../dashboard/DataState'
import MetricTile from '../../analytics/MetricTile'
import { EXCHANGE_META } from '../../exchanges/meta'
import { BarRow, EmptyNote, GRID_2, GRID_3, InsightCard, TILES } from './parts'
import { useApiData } from '../../../hooks/useApiData'
import { getCustomerInsights } from '../../../services/adminInsights'
import { fmtMoney, fmtShortDate, fmtSignedMoney } from '../../../lib/format'
import { reasonLabel } from '../../../lib/insightLabels'
import type { FunnelKey, RankedUser } from '../../../types/adminInsights'

const FUNNEL_LABEL: Record<FunnelKey, string> = {
  signed_up: 'Signed up',
  approved: 'Approved',
  connected: 'Connected a live key',
  funded: 'Deposited the minimum',
  traded_7d: 'Traded in the last 7 days',
}

function RankedList({
  rows,
  money,
}: {
  rows: RankedUser[]
  money: (n: number) => string
}) {
  if (rows.length === 0) return <EmptyNote>Nobody yet.</EmptyNote>
  return (
    <ol className="flex flex-col divide-y divide-hair">
      {rows.map((r, i) => (
        <li key={r.uni_id} className="flex items-center gap-3 py-2 text-[13px]">
          <span className="w-5 flex-none text-right font-mono text-[12px] text-faint">{i + 1}</span>
          <Link to={`/admin/users/${r.uni_id}`} className="min-w-0 flex-1 truncate hover:text-accent">
            {r.name}
          </Link>
          <span
            className={`flex-none font-mono font-bold ${r.value < 0 ? 'text-red' : ''}`}
          >
            {money(r.value)}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function CustomersTab() {
  const { data, loading, error, reload } = useApiData(getCustomerInsights)

  if (!data) {
    return <DataState loading={loading} error={error} onRetry={reload} label="customer stats" />
  }

  const top = data.funnel[0]?.count ?? 0
  const maxSignups = Math.max(1, ...data.signups_weekly.map((w) => w.signups))

  return (
    <div className="flex flex-col gap-stack">
      <div className={TILES}>
        <MetricTile label="Traded today" icon={Activity} value={String(data.active.today)} sub="received at least one filled order" />
        <MetricTile label="Last 7 days" icon={Activity} value={String(data.active.d7)} sub="customers with a filled order" />
        <MetricTile label="Last 30 days" icon={Activity} value={String(data.active.d30)} sub="customers with a filled order" />
        <MetricTile
          label="Awaiting approval"
          icon={UserPlus}
          value={String(data.status.pending)}
          sub={`${data.status.suspended} suspended`}
          subTone={data.status.suspended > 0 ? 'neg' : ''}
        />
      </div>

      <div className={GRID_2}>
        <InsightCard
          icon={Filter}
          title="Customer journey"
          subtitle={`Where people drop off, from sign-up to trading (minimum deposit ${fmtMoney(data.min_deposit, 0)})`}
          link={{ to: '/admin/users', label: 'Users' }}
        >
          <div className="flex flex-col gap-3.5">
            {data.funnel.map((step, i) => {
              const prev = i > 0 ? data.funnel[i - 1].count : null
              const kept = prev ? Math.round((step.count / prev) * 100) : null
              return (
                <BarRow
                  key={step.key}
                  label={
                    <>
                      {FUNNEL_LABEL[step.key]}
                      {kept !== null && (
                        <span className="ml-2 text-[11.5px] text-muted">{kept}% of previous step</span>
                      )}
                    </>
                  }
                  value={step.count}
                  max={top}
                />
              )
            })}
          </div>
        </InsightCard>

        <InsightCard
          icon={UserMinus}
          title="Customers not trading"
          subtitle="Most passed-over customers in the last 7 days, and why"
          link={{ to: '/admin/trade-logs', label: 'Signal Log' }}
        >
          <div className="mb-3 grid grid-cols-3 gap-2 max-[480px]:grid-cols-1">
            <MetricTile label="Disconnected" icon={LogOut} value={String(data.stopped_30d.disconnected)} sub="last 30 days" />
            <MetricTile label="Paused" icon={UserMinus} value={String(data.stopped_30d.disabled)} sub="switched off" />
            <MetricTile
              label="Key refused"
              icon={UserMinus}
              value={String(data.stopped_30d.key_blocked)}
              tone={data.stopped_30d.key_blocked > 0 ? 'neg' : ''}
              sub="right now"
            />
          </div>
          {data.most_missed_7d.length === 0 ? (
            <EmptyNote>No customer missed a trade this week.</EmptyNote>
          ) : (
            <ul className="flex flex-col divide-y divide-hair">
              {data.most_missed_7d.map((r) => (
                <li key={r.uni_id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <Link to={`/admin/users/${r.uni_id}`} className="min-w-0 hover:text-accent">
                    <span className="block truncate font-semibold">{r.name}</span>
                    {r.top_reason && (
                      <span className="block truncate text-[12px] text-muted">
                        Mostly: {reasonLabel(r.top_reason)}
                      </span>
                    )}
                  </Link>
                  <span className="flex-none rounded-pill bg-red/15 px-2.5 py-1 font-mono text-[11.5px] font-bold text-red">
                    {r.missed} missed
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InsightCard>
      </div>

      <div className={GRID_3}>
        <InsightCard icon={UserPlus} title="New sign-ups" subtitle="Per week, last 12 weeks">
          <div className="flex h-[140px] items-end gap-1.5">
            {data.signups_weekly.map((w) => (
              <div key={w.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Week of ${fmtShortDate(w.week)}: ${w.signups}`}>
                <span className="font-mono text-[10.5px] text-muted">{w.signups || ''}</span>
                <div
                  className="w-full rounded-t-[4px] bg-accent"
                  style={{ height: `${(w.signups / maxSignups) * 100}%`, minHeight: w.signups ? 4 : 1 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-faint">
            <span>{fmtShortDate(data.signups_weekly[0]?.week ?? '')}</span>
            <span>this week</span>
          </div>
        </InsightCard>

        <InsightCard icon={Landmark} title="Top customers by capital" subtitle="Live balance across exchanges">
          <RankedList rows={data.top_capital} money={(n) => fmtMoney(n)} />
        </InsightCard>

        <InsightCard icon={TrendingUp} title="Top customers by profit" subtitle="Closed trades, last 30 days">
          <RankedList rows={data.top_pnl_30d} money={(n) => fmtSignedMoney(n)} />
        </InsightCard>
      </div>

      <InsightCard icon={Users} title="By exchange" subtitle="Connected customer accounts per venue">
        <div className="grid grid-cols-3 gap-2.5 max-[800px]:grid-cols-1">
          {data.by_exchange.map((e) => (
            <MetricTile
              key={e.exchange}
              label={EXCHANGE_META[e.exchange]?.label ?? e.exchange}
              value={`${e.live} live`}
              sub={`${e.demo} demo · ${fmtMoney(e.capital)} capital`}
            />
          ))}
        </div>
      </InsightCard>
    </div>
  )
}
