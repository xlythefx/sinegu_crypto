import { displaySymbol } from '../../lib/chart'
import { fmtMoney, fmtPctOf, fmtSignedMoney } from '../../lib/format'
import type { AssetPerformanceRow } from '../../types/dashboard'
import AssetEquityChart from './AssetEquityChart'

interface AssetPerformanceCardProps {
  asset: AssetPerformanceRow
  rank: number
  balance: number
}

/** Non-token medal tints for the top 3 (gold / silver / bronze), preserved
 *  exactly from the mother dashboard: `card` = ranked border + glow, `medal`
 *  = the "#n" badge color/border/background. */
const MEDAL: Record<number, { card: string; medal: string }> = {
  1: {
    card: 'border-[rgba(217,119,6,0.45)] shadow-[0_12px_34px_rgba(217,119,6,0.12)]',
    medal: 'text-[#d97706] border-[rgba(217,119,6,0.5)] bg-[rgba(217,119,6,0.1)]',
  },
  2: {
    card: 'border-[rgba(100,116,139,0.5)] shadow-[0_12px_34px_rgba(100,116,139,0.12)]',
    medal: 'text-[#94a3b8] border-[rgba(148,163,184,0.5)] bg-[rgba(148,163,184,0.1)]',
  },
  3: {
    card: 'border-[rgba(194,65,12,0.45)] shadow-[0_12px_34px_rgba(194,65,12,0.12)]',
    medal: 'text-[#c2410c] border-[rgba(194,65,12,0.5)] bg-[rgba(194,65,12,0.1)]',
  },
}

function MetricTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'pos' | 'neg'
}) {
  const toneClass = tone === 'pos' ? 'text-green' : tone === 'neg' ? 'text-red' : ''
  return (
    <div className="flex flex-col gap-[3px] border border-border rounded-row bg-surface2 py-2.5 px-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </span>
      <span className={`text-[16px] font-bold font-mono ${toneClass}`}>
        {value}
      </span>
      {sub && (
        <span className={`text-[11.5px] font-semibold font-mono ${toneClass}`}>
          {sub}
        </span>
      )}
    </div>
  )
}

/** One asset's performance card: medal rank, metric tiles, equity curve. */
export default function AssetPerformanceCard({
  asset,
  rank,
  balance,
}: AssetPerformanceCardProps) {
  const medal = MEDAL[rank]
  const pf = asset.profit_factor

  return (
    <section
      className={`rounded-card bg-surface p-card border flex flex-col gap-3.5 ${
        medal ? medal.card : 'border-border'
      }`}
      data-aos="fade-up"
    >
      <div className="flex items-start justify-between gap-3 border-b border-hair pb-3.5">
        <div className="flex items-start gap-3">
          {medal && (
            <span
              className={`inline-flex items-center justify-center min-w-[34px] h-[34px] rounded-field text-[13px] font-bold border font-mono ${medal.medal}`}
            >
              #{rank}
            </span>
          )}
          <div>
            <div className="font-display text-[19px] font-extrabold tracking-[-0.01em]">
              {displaySymbol(asset.ticker)}
            </div>
            <div className="text-[12.5px] text-muted mt-[3px]">
              #{rank} by P&L · Winrate {asset.winrate.toFixed(1)}% · PF{' '}
              {pf === null ? '∞' : pf.toFixed(2)}
            </div>
          </div>
        </div>
        <span className="flex-shrink-0 text-[11px] font-semibold text-muted border border-border rounded-pill py-[5px] px-3 font-mono">
          {asset.total_trades} {asset.total_trades === 1 ? 'Trade' : 'Trades'}
        </span>
      </div>

      <p className="font-mono text-[10.5px] tracking-[0.14em] text-faint m-0">
        METRICS
      </p>
      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          label="Winrate"
          value={`${asset.winrate.toFixed(1)}%`}
          tone={asset.winrate >= 50 ? 'pos' : 'neg'}
        />
        {pf === null ? (
          <MetricTile label="Profit factor" value="Perfect" sub="No losses" tone="pos" />
        ) : (
          <MetricTile
            label="Profit factor"
            value={pf.toFixed(2)}
            tone={pf >= 1 ? 'pos' : 'neg'}
          />
        )}
        <MetricTile
          label="Max DD"
          value={fmtMoney(asset.max_drawdown)}
          sub={balance > 0 ? fmtPctOf(-asset.max_drawdown, balance, 2) : undefined}
          tone="neg"
        />
        <MetricTile
          label="Total P&L"
          value={fmtSignedMoney(asset.total_pnl)}
          sub={balance > 0 ? fmtPctOf(asset.total_pnl, balance, 2) : undefined}
          tone={asset.total_pnl >= 0 ? 'pos' : 'neg'}
        />
        <MetricTile label="Avg win" value={fmtMoney(asset.avg_win)} tone="pos" />
        <MetricTile label="Avg loss" value={fmtMoney(asset.avg_loss)} tone="neg" />
        <MetricTile
          label="Largest win"
          value={fmtMoney(asset.largest_win)}
          tone="pos"
        />
        <MetricTile
          label="Max win streak"
          value={`${asset.max_win_streak} ${asset.max_win_streak === 1 ? 'trade' : 'trades'}`}
          tone="pos"
        />
      </div>

      <p className="font-mono text-[10.5px] tracking-[0.14em] text-faint m-0">
        EQUITY CURVE
      </p>
      <AssetEquityChart points={asset.equity_series} rank={rank} />
    </section>
  )
}
