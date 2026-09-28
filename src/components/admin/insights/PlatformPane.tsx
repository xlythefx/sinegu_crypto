import { useCallback, useState } from 'react'
import { CalendarRange, Layers, Sigma, TrendingUp, Users, Wallet } from 'lucide-react'
import DataState from '../../dashboard/DataState'
import MetricTile from '../../analytics/MetricTile'
import AdminPnlCalendar from '../AdminPnlCalendar'
import { EXCHANGE_META } from '../../exchanges/meta'
import { BarRow, EmptyNote, GRID_2, InsightCard, TILES } from './parts'
import UnderManagementCard from './UnderManagementCard'
import { useApiData } from '../../../hooks/useApiData'
import { getPlatformDailyPnl, getPlatformInsights } from '../../../services/adminInsights'
import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { PlatformScope, PnlWindow } from '../../../types/adminInsights'

const SCOPES: { key: PlatformScope; label: string; who: string }[] = [
  { key: 'all', label: 'Everyone', who: 'customers and the master' },
  { key: 'customers', label: 'Customers', who: 'customers' },
  { key: 'master', label: 'Master', who: 'the master' },
]

const CHIP =
  'rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer'

const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '') as 'pos' | 'neg' | ''

/** A P&L window as a tile: after fees on the face, before fees on hover. */
function PnlTile({ label, w, sub }: { label: string; w: PnlWindow; sub: string }) {
  return (
    <MetricTile
      label={label}
      icon={TrendingUp}
      value={fmtSignedMoney(w.net)}
      tone={tone(w.net)}
      breakdown={{ gross: w.gross, net: w.net }}
      sub={sub}
    />
  )
}

/**
 * Overview → Platform: every live real-money account pooled into one
 * portfolio — customers, the master, or both. Demo, sandbox and SBXINV-
 * accounts never count (the API decides that, not this page).
 */
export default function PlatformPane() {
  const [scope, setScope] = useState<PlatformScope>('all')
  const { data, loading, error, reload } = useApiData(() => getPlatformInsights(scope), [scope])
  // Stable per scope — AdminPnlCalendar refetches whenever this identity changes.
  const fetchDays = useCallback(() => getPlatformDailyPnl(scope), [scope])
  const who = SCOPES.find((s) => s.key === scope)?.who ?? ''

  return (
    <div className="flex flex-col gap-stack">
      {/* Outside the re-keyed region, so a chip keeps focus across the switch. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Whose money">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={scope === s.key}
            className={`${CHIP} ${
              scope === s.key
                ? 'border-accent-line bg-accent-soft text-accent'
                : 'border-border bg-surface text-muted hover:text-text'
            }`}
            onClick={() => setScope(s.key)}
          >
            {s.label}
          </button>
        ))}
        <span className="text-[12px] text-faint">
          Live real-money accounts only · after exchange fees
        </span>
      </div>

      <div key={scope} className="flex flex-col gap-stack animate-[fadeup_0.35s_ease-out]">
        {!data ? (
          <DataState loading={loading} error={error} onRetry={reload} label="platform" />
        ) : (
          <>
            <div className={TILES}>
              <MetricTile
                label="Under management"
                icon={Wallet}
                value={fmtMoney(data.under_management.equity)}
                sub={`${data.accounts_live} account${data.accounts_live === 1 ? '' : 's'} · ${data.owners} owner${data.owners === 1 ? '' : 's'}`}
              />
              <PnlTile
                label="P&L today"
                w={data.pnl.today}
                sub={`${data.pnl.today.trades} closed · ${data.traders_today} trader${data.traders_today === 1 ? '' : 's'}`}
              />
              <PnlTile label="P&L this month" w={data.pnl.month} sub={`${data.pnl.month.trades} closed`} />
              <PnlTile
                label="P&L all time"
                w={data.pnl.all}
                sub={
                  data.win_rate === null
                    ? 'No closed trade yet'
                    : `${data.pnl.all.trades} closed · ${data.win_rate}% in profit`
                }
              />
            </div>

            <div className={GRID_2}>
              <UnderManagementCard aum={data.under_management} flowsOf={who} />
              <InsightCard icon={Layers} title="By exchange" subtitle="Live balance per venue">
                {data.under_management.by_exchange.length === 0 ? (
                  <EmptyNote>No live account in this scope.</EmptyNote>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.under_management.by_exchange.map((e) => (
                      <BarRow
                        key={e.exchange}
                        label={`${EXCHANGE_META[e.exchange]?.label ?? e.exchange} · ${e.accounts} account${e.accounts === 1 ? '' : 's'}`}
                        value={e.balance}
                        max={data.under_management.balance}
                        display={fmtMoney(e.balance)}
                      />
                    ))}
                    <div className="mt-1 grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
                      <MetricTile label="Open P&L" icon={Sigma} value={fmtSignedMoney(data.under_management.unrealized)} tone={tone(data.under_management.unrealized)} sub="unrealized, live" />
                      <MetricTile label="P&L last 7 days" icon={CalendarRange} value={fmtSignedMoney(data.pnl.d7.net)} tone={tone(data.pnl.d7.net)} breakdown={{ gross: data.pnl.d7.gross, net: data.pnl.d7.net }} sub={`${data.pnl.d7.trades} closed`} />
                    </div>
                  </div>
                )}
              </InsightCard>
            </div>
          </>
        )}

        <AdminPnlCalendar
          fetchDays={fetchDays}
          aosDelay={0}
          subtitle={`Every closed trade of ${who}, pooled · % of the pooled balance each day started with`}
        />
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-faint">
        <Users size={13} /> Staff, demo and test accounts are never counted.
      </p>
    </div>
  )
}
