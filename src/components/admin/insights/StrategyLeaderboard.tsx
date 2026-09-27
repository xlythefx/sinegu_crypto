import { ArrowDownRight, ArrowRight, ArrowUpRight, Trophy } from 'lucide-react'
import { EmptyNote, InsightCard } from './parts'
import PnlBreakdown from '../../ui/PnlBreakdown'
import { EXCHANGE_META } from '../../exchanges/meta'
import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { LeaderboardRow } from '../../../lib/strategyLeaderboard'
import type { ExchangeKind } from '../../../types/exchanges'

interface Props {
  rows: LeaderboardRow[]
  enabled: Record<string, boolean>
  selected: string | null
  onSelect: (key: string) => void
}

const TH = 'px-3 py-2 text-left text-[10px] font-extrabold uppercase tracking-[0.5px] text-faint whitespace-nowrap'
const TD = 'px-3 py-2.5 whitespace-nowrap font-mono text-[12.5px]'

function Form({ row }: { row: LeaderboardRow }) {
  if (row.form === null) return <span className="text-faint">—</span>
  const Icon = row.form === 'up' ? ArrowUpRight : row.form === 'down' ? ArrowDownRight : ArrowRight
  const tone = row.form === 'up' ? 'text-green' : row.form === 'down' ? 'text-red' : 'text-muted'
  return (
    <span
      className={`inline-flex items-center gap-1 ${tone}`}
      title={`This month ${fmtSignedMoney(row.thisMonth)} against a usual month of ${fmtSignedMoney(row.avgMonth ?? 0)}`}
    >
      <Icon size={14} />
      {fmtSignedMoney(row.thisMonth, 0)}
    </span>
  )
}

/** Every strategy side by side; a row opens its in-depth view below. */
export default function StrategyLeaderboard({ rows, enabled, selected, onSelect }: Props) {
  return (
    <InsightCard
      icon={Trophy}
      title="Strategy leaderboard"
      subtitle="Before exchange fees · click a strategy for its in-depth view"
    >
      {rows.length === 0 ? (
        <EmptyNote>No closed trade carries a strategy in this view.</EmptyNote>
      ) : (
        <div className="-mx-card overflow-x-auto px-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={TH}>Strategy</th>
                <th className={`${TH} text-right`}>P&amp;L</th>
                <th className={`${TH} text-right`}>Trades</th>
                <th className={`${TH} text-right`}>Win rate</th>
                <th className={`${TH} text-right`} title="Money won ÷ money lost">Profit factor</th>
                <th className={`${TH} text-right`} title="Largest fall from a previous high">Max drawdown</th>
                <th className={`${TH} text-right`} title="Average P&L per trade">Per trade</th>
                <th className={`${TH} text-right`} title="Average winning / losing trade">Avg win / loss</th>
                <th className={`${TH} text-right`} title="Return against its own risk; above 1 is good">Sharpe</th>
                <th className={`${TH} text-right`} title="This month against its usual month">This month</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = selected === r.key
                const paused = enabled[r.key] === false
                return (
                  <tr
                    key={r.key}
                    onClick={() => onSelect(r.key)}
                    className={`cursor-pointer border-b border-hair transition-colors last:border-0 ${
                      on ? 'bg-accent-soft' : 'hover:bg-surface2'
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 flex-none rounded-full ${paused ? 'bg-faint' : 'bg-green'}`} title={paused ? 'Paused' : 'Active'} />
                        <span className="whitespace-nowrap text-[13px] font-bold">{r.key}</span>
                      </div>
                      <div className="mt-0.5 pl-4 text-[11px] text-muted whitespace-nowrap">
                        {r.exchanges.map((e) => EXCHANGE_META[e as ExchangeKind]?.label ?? e).join(' · ') || '—'}
                        {paused && ' · paused'}
                      </div>
                    </td>
                    <td className={`${TD} text-right font-bold ${r.totalPnl < 0 ? 'text-red' : 'text-green'}`}>
                      <PnlBreakdown gross={r.totalPnl} net={r.totalPnlNet} hoverOnly>
                        {fmtSignedMoney(r.totalPnl)}
                      </PnlBreakdown>
                    </td>
                    <td className={`${TD} text-right`}>{r.totalTrades}</td>
                    <td className={`${TD} text-right`}>{r.winrate.toFixed(1)}%</td>
                    <td className={`${TD} text-right`}>{r.profitFactor === null ? '∞' : r.profitFactor.toFixed(2)}</td>
                    <td className={`${TD} text-right text-red`}>{r.maxDrawdown > 0 ? `−${fmtMoney(r.maxDrawdown)}` : '—'}</td>
                    <td className={`${TD} text-right ${r.expectancy < 0 ? 'text-red' : ''}`}>{fmtSignedMoney(r.expectancy)}</td>
                    <td className={`${TD} text-right`}>
                      <span className="text-green">{fmtMoney(r.avgWin, 0)}</span>
                      <span className="text-faint"> / </span>
                      <span className="text-red">{fmtMoney(r.avgLoss, 0)}</span>
                    </td>
                    <td className={`${TD} text-right`}>{r.sharpe.toFixed(2)}</td>
                    <td className={`${TD} text-right`}><Form row={r} /></td>
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
