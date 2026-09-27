import { Link } from 'react-router-dom'
import { Radio, Scale, Server } from 'lucide-react'
import MetricTile from '../../analytics/MetricTile'
import { EXCHANGE_META } from '../../exchanges/meta'
import { BarRow, EmptyNote, InsightCard } from './parts'
import { fmtAgo, fmtSignedMoney, fmtSignedPct } from '../../../lib/format'
import { reasonLabel } from '../../../lib/insightLabels'
import type { ExchangeSplit } from '../../../lib/strategyLeaderboard'
import type { StrategyCompare, StrategyReliability } from '../../../types/adminInsights'
import type { ExchangeKind } from '../../../types/exchanges'

const pct = (v: number | null | undefined, dp = 1) =>
  v === null || v === undefined ? '—' : `${Number(v).toFixed(dp)}%`

/** Did the strategy's signals actually reach the accounts? From the engine's signal log. */
export function SignalReliabilityCard({ data }: { data: StrategyReliability | undefined }) {
  return (
    <InsightCard
      icon={Radio}
      title="Signal reliability"
      subtitle="Did every account take the trade when the strategy fired?"
      link={{ to: '/admin/trade-logs', label: 'Signal Log' }}
    >
      {!data || data.signals + data.rejected === 0 ? (
        <EmptyNote>No signal from this strategy in this period.</EmptyNote>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 max-[480px]:grid-cols-1">
            <MetricTile label="Every account" value={String(data.full)} tone="pos" sub="signals fully taken" />
            <MetricTile label="Some accounts" value={String(data.partial)} sub="partly taken" tone={data.partial > 0 ? 'accent' : ''} />
            <MetricTile label="No account" value={String(data.missed + data.rejected)} tone={data.missed + data.rejected > 0 ? 'neg' : ''} sub={data.rejected ? `${data.rejected} rejected outright` : 'missed completely'} />
          </div>
          <p className="mt-3 text-[12.5px] text-muted">
            {data.account_fills} account orders filled, {data.account_skips} skipped,{' '}
            {data.account_fails} refused · last signal {fmtAgo(data.last_signal_at)}
          </p>
          {Object.keys(data.reasons).length > 0 && (
            <div className="mt-3 flex flex-col gap-2.5">
              {Object.entries(data.reasons).map(([r, n]) => (
                <BarRow
                  key={r}
                  label={reasonLabel(r)}
                  value={n}
                  max={Math.max(...Object.values(data.reasons))}
                  tone="red"
                />
              ))}
            </div>
          )}
        </>
      )}
    </InsightCard>
  )
}

/**
 * The master is what the strategy should have delivered; a customer far
 * below it on the same strategy missed trades or was sized differently.
 */
export function CustomersVsMasterCard({ data }: { data: StrategyCompare | undefined }) {
  return (
    <InsightCard
      icon={Scale}
      title="Customers vs master"
      subtitle="Same strategy, same period. Customers who took the fewest of the master's trades come first."
    >
      {!data || (data.master.trades === 0 && data.customers.length === 0) ? (
        <EmptyNote>Neither the master nor any customer traded it in this period.</EmptyNote>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 max-[560px]:grid-cols-1">
            <MetricTile
              label="Master"
              value={pct(data.master.win_rate)}
              sub={`win rate · ${data.master.return_pct === null ? '—' : fmtSignedPct(data.master.return_pct, 2)} return`}
            />
            <MetricTile
              label="Customers (avg)"
              value={pct(data.customers_avg.win_rate)}
              sub={`win rate · ${data.customers_avg.return_pct === null ? '—' : fmtSignedPct(data.customers_avg.return_pct, 2)} return`}
            />
            <MetricTile
              label="Trades taken"
              value={pct(data.customers_avg.participation, 0)}
              sub={`of the master's ${data.master.trades}, across ${data.customers_avg.customers} customer${data.customers_avg.customers === 1 ? '' : 's'}`}
              tone={(data.customers_avg.participation ?? 100) < 80 ? 'neg' : ''}
            />
          </div>
          {data.customers.length > 0 && (
            <div className="-mx-card mt-3 overflow-x-auto px-card">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] font-extrabold uppercase tracking-[0.5px] text-faint">
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3 text-right">Trades taken</th>
                    <th className="py-2 pr-3 text-right">Win rate</th>
                    <th className="py-2 pr-3 text-right">P&amp;L</th>
                    <th className="py-2 text-right" title="P&L over their current balance">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((c) => (
                    <tr key={c.uni_id} className="border-b border-hair last:border-0">
                      <td className="max-w-[180px] truncate py-2 pr-3">
                        <Link to={`/admin/users/${c.uni_id}`} className="font-semibold hover:text-accent">
                          {c.name}
                        </Link>
                      </td>
                      <td className={`py-2 pr-3 text-right font-mono ${(c.participation ?? 100) < 80 ? 'text-red' : ''}`}>
                        {c.trades} · {pct(c.participation, 0)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{pct(c.win_rate)}</td>
                      <td className={`py-2 pr-3 text-right font-mono ${c.pnl < 0 ? 'text-red' : 'text-green'}`}>
                        {fmtSignedMoney(c.pnl)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {c.return_pct === null ? '—' : fmtSignedPct(c.return_pct, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </InsightCard>
  )
}

/** One strategy's result on each exchange it traded on. */
export function ExchangeSplitCard({ rows }: { rows: ExchangeSplit[] }) {
  return (
    <InsightCard icon={Server} title="By exchange" subtitle="The same strategy on each venue, before fees">
      {rows.length === 0 ? (
        <EmptyNote>No trades.</EmptyNote>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-[800px]:grid-cols-1">
          {rows.map((r) => (
            <MetricTile
              key={r.exchange}
              label={EXCHANGE_META[r.exchange as ExchangeKind]?.label ?? r.exchange}
              value={fmtSignedMoney(r.totalPnl)}
              tone={r.totalPnl < 0 ? 'neg' : 'pos'}
              sub={`${r.trades} trades · ${r.winrate.toFixed(1)}% win · PF ${r.profitFactor === null ? '∞' : r.profitFactor.toFixed(2)}`}
            />
          ))}
        </div>
      )}
    </InsightCard>
  )
}
