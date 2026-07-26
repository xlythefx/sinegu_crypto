import { displaySymbol } from '../../lib/chart'
import { fmtMoney, fmtPctOf, fmtSignedMoney } from '../../lib/format'
import type { AssetPerformanceRow } from '../../types/dashboard'
import AssetEquityChart from './AssetEquityChart'
import './AssetPerformanceCard.css'

interface AssetPerformanceCardProps {
  asset: AssetPerformanceRow
  rank: number
  balance: number
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
  return (
    <div className="apc__tile">
      <span className="apc__tile-label">{label}</span>
      <span className={`apc__tile-value mono${tone ? ` is-${tone}` : ''}`}>
        {value}
      </span>
      {sub && (
        <span className={`apc__tile-sub mono${tone ? ` is-${tone}` : ''}`}>
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
  const medal = rank >= 1 && rank <= 3
  const pf = asset.profit_factor

  return (
    <section className={`dcard apc${medal ? ` apc--rank${rank}` : ''}`} data-aos="fade-up">
      <div className="apc__head">
        <div className="apc__title-block">
          {medal && <span className={`apc__medal apc__medal--${rank} mono`}>#{rank}</span>}
          <div>
            <div className="apc__ticker">{displaySymbol(asset.ticker)}</div>
            <div className="apc__sub">
              #{rank} by P&L · Winrate {asset.winrate.toFixed(1)}% · PF{' '}
              {pf === null ? '∞' : pf.toFixed(2)}
            </div>
          </div>
        </div>
        <span className="apc__badge mono">
          {asset.total_trades} {asset.total_trades === 1 ? 'Trade' : 'Trades'}
        </span>
      </div>

      <p className="apc__section-label">METRICS</p>
      <div className="apc__tiles">
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

      <p className="apc__section-label">EQUITY CURVE</p>
      <AssetEquityChart points={asset.equity_series} rank={rank} />
    </section>
  )
}
