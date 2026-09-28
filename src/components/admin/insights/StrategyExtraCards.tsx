import { Radio, Server } from 'lucide-react'
import MetricTile from '../../analytics/MetricTile'
import { EXCHANGE_META } from '../../exchanges/meta'
import { BarRow, EmptyNote, InsightCard } from './parts'
import { fmtAgo, fmtSignedMoney } from '../../../lib/format'
import { reasonLabel } from '../../../lib/insightLabels'
import type { ExchangeSplit } from '../../../lib/strategyLeaderboard'
import type { StrategyReliability } from '../../../types/adminInsights'
import type { ExchangeKind } from '../../../types/exchanges'

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
