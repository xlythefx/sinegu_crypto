import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import DataState from '../../dashboard/DataState'
import ExchangeFilterPill, { type ExchangePillValue } from '../user-detail/ExchangeFilterPill'
import StrategyDetailBody from '../strategy-detail/StrategyDetailBody'
import StrategyLeaderboard from './StrategyLeaderboard'
import { CustomersVsMasterCard, ExchangeSplitCard, SignalReliabilityCard } from './StrategyExtraCards'
import { GRID_2 } from './parts'
import { useApiData } from '../../../hooks/useApiData'
import { getStrategies } from '../../../services/admin'
import { getStrategyInsights } from '../../../services/adminInsights'
import { computeStrategyDetail, groupTradesByStrategy } from '../../../lib/strategyStats'
import {
  PERIODS,
  buildLeaderboard,
  periodStart,
  splitByExchange,
  tradesSince,
  type StrategyPeriod,
} from '../../../lib/strategyLeaderboard'
import type { StrategyScope } from '../../../types/admin'

const SCOPES: { key: StrategyScope; label: string; hint: string }[] = [
  { key: 'master', label: 'Master', hint: "The master account's trades — the strategy's true result" },
  { key: 'customers', label: 'All customers', hint: "Every customer's trades pooled — what customers actually got" },
]

const SEG = 'inline-flex gap-1 rounded-[12px] border border-border bg-surface p-1'
const SEG_BTN =
  'whitespace-nowrap rounded-btn px-3.5 py-[7px] text-[12.5px] font-semibold cursor-pointer transition-colors duration-150'
const segOn = (on: boolean) =>
  on ? 'bg-accent text-on-accent' : 'bg-transparent text-muted hover:text-text'

export default function StrategiesTab() {
  const [scope, setScope] = useState<StrategyScope>('master')
  const [exchange, setExchange] = useState<ExchangePillValue>('all')
  const [period, setPeriod] = useState<StrategyPeriod>('all')
  const [picked, setPicked] = useState<string | null>(null)

  const from = periodStart(period)
  const { data, loading, error, reload } = useApiData(
    () => getStrategies(scope, exchange),
    [scope, exchange],
  )
  const { data: insights } = useApiData(
    () => getStrategyInsights(exchange, from),
    [exchange, from],
  )

  const trades = useMemo(() => tradesSince(data?.trades ?? [], from), [data, from])
  const rows = useMemo(() => buildLeaderboard(trades), [trades])
  const selected = picked && rows.some((r) => r.key === picked) ? picked : (rows[0]?.key ?? null)

  const selectedTrades = useMemo(
    () => (selected ? (groupTradesByStrategy(trades).get(selected) ?? []) : []),
    [trades, selected],
  )
  const detail = useMemo(
    () => (selected && selectedTrades.length ? computeStrategyDetail(selected, selectedTrades) : null),
    [selected, selectedTrades],
  )
  const split = useMemo(() => splitByExchange(selectedTrades), [selectedTrades])

  return (
    <div className="flex flex-col gap-stack">
      <div className="flex flex-wrap items-center gap-3">
        <div className={SEG} role="radiogroup" aria-label="Whose trades">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={scope === s.key}
              title={s.hint}
              className={`${SEG_BTN} ${segOn(scope === s.key)}`}
              onClick={() => setScope(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ExchangeFilterPill value={exchange} onChange={setExchange} />
        <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
          <div className={SEG} role="radiogroup" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={period === p.key}
                className={`${SEG_BTN} ${segOn(period === p.key)}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!data ? (
        <DataState loading={loading} error={error} onRetry={reload} label="strategies" />
      ) : (
        <div key={`${scope}-${exchange}-${period}`} className="flex flex-col gap-stack animate-[fadeup_0.35s_ease-out]">
          <StrategyLeaderboard
            rows={rows}
            enabled={data.enabled}
            selected={selected}
            onSelect={setPicked}
          />

          {selected && detail && (
            <div key={selected} className="flex flex-col gap-stack animate-[fadeup_0.35s_ease-out]">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent-line bg-[linear-gradient(to_bottom_right,var(--accentSoft),var(--surface))] p-card">
                <div className="min-w-0">
                  <h2 className="font-display text-[20px] font-extrabold tracking-[-0.3px]">{selected}</h2>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {scope === 'master' ? "Master account's trades" : "Every customer's trades"} ·{' '}
                    {PERIODS.find((p) => p.key === period)?.label.toLowerCase()} ·{' '}
                    {detail.totalTrades} closed trade{detail.totalTrades === 1 ? '' : 's'}
                    {data.enabled[selected] === false && ' · paused'}
                  </p>
                </div>
                <Link
                  to="/admin/strategies"
                  className="inline-flex items-center gap-1.5 rounded-field border border-border bg-surface px-3 py-2 text-[12.5px] font-semibold text-muted hover:border-accent-line hover:text-accent"
                >
                  Pause or resume <ExternalLink size={13} />
                </Link>
              </div>

              <div className={GRID_2}>
                <SignalReliabilityCard data={insights?.reliability[selected]} />
                <CustomersVsMasterCard data={insights?.compare[selected]} />
              </div>

              <ExchangeSplitCard rows={split} />

              <div>
                <StrategyDetailBody stats={detail} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
