import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { AdminPositionMetrics } from '../../../lib/adminPositionsStats'

interface Tile {
  label: string
  value: string
  hint?: string
  tone?: 'pos' | 'neg' | 'accent'
}

/** Collapsible portfolio-analytics grid, computed across every account —
 *  the admin twin of the user Positions' PortfolioMetrics. */
export default function AdminPositionsAnalytics({
  m,
}: {
  m: AdminPositionMetrics
}) {
  const tiles: Tile[] = [
    {
      label: 'Total Trades',
      value: m.totalTrades.toLocaleString(),
      hint: `${m.wins}W · ${m.losses}L`,
    },
    {
      label: 'Winrate',
      value: m.winRate !== null ? `${m.winRate.toFixed(1)}%` : '—',
      hint: `${m.wins}W / ${m.losses}L`,
      tone: 'pos',
    },
    {
      label: 'Profit Factor',
      value: m.profitFactor !== null ? m.profitFactor.toFixed(2) : '∞',
      hint: 'Gross win ÷ loss',
      tone: m.profitFactor === null || m.profitFactor >= 1 ? 'pos' : 'neg',
    },
    {
      label: 'Net Realized',
      value: fmtSignedMoney(m.netPnl),
      hint: 'Sum of closed P&L',
      tone: m.netPnl >= 0 ? 'pos' : 'neg',
    },
    {
      label: 'Gross Profit',
      value: fmtMoney(m.grossWin),
      hint: 'From winners',
      tone: 'pos',
    },
    {
      label: 'Gross Loss',
      value: fmtMoney(m.grossLoss),
      hint: 'From losers',
      tone: 'neg',
    },
    {
      label: 'Avg Win',
      value: fmtMoney(m.avgWin),
      hint: 'Per winning trade',
      tone: 'pos',
    },
    {
      label: 'Avg Loss',
      value: fmtMoney(m.avgLoss),
      hint: 'Per losing trade',
      tone: 'neg',
    },
    {
      label: 'Largest Win',
      value: fmtMoney(m.largestWin),
      hint: 'Best single trade',
      tone: 'pos',
    },
    {
      label: 'Largest Loss',
      value: fmtMoney(m.largestLoss),
      hint: 'Worst single trade',
      tone: 'neg',
    },
    {
      label: 'Risk : Reward',
      value: m.avgRr !== null ? `${m.avgRr.toFixed(2)}×` : '—',
      hint: 'Avg win ÷ avg loss',
      tone: 'pos',
    },
    {
      label: 'Expectancy',
      value: m.expectancy !== null ? fmtSignedMoney(m.expectancy) : '—',
      hint: 'Expected per trade',
      tone: m.expectancy !== null && m.expectancy >= 0 ? 'pos' : 'neg',
    },
    {
      label: 'Max Drawdown',
      value: fmtMoney(m.maxDrawdown),
      hint: `${m.maxDrawdownPct.toFixed(2)}% of equity`,
      tone: 'neg',
    },
    {
      label: 'Trading Accounts',
      value: m.tradingAccounts.toLocaleString(),
      hint: 'With closed trades',
    },
  ]

  const toneClass: Record<NonNullable<Tile['tone']>, string> = {
    pos: 'text-green',
    neg: 'text-red',
    accent: 'text-accent',
  }

  return (
    <div
      className="grid grid-cols-6 gap-3 mb-4 max-[1100px]:grid-cols-3 max-[900px]:grid-cols-2 animate-[fadeup_0.35s_ease-out]"
      data-aos="fade-up"
    >
      {tiles.map((t) => (
        <div
          className="rounded-card border border-border bg-surface flex flex-col gap-1 py-3.5 px-4"
          key={t.label}
        >
          <span className="text-[10.5px] font-bold tracking-[0.05em] uppercase text-faint">
            {t.label}
          </span>
          <span
            className={`text-[17px] font-extrabold font-mono${t.tone ? ` ${toneClass[t.tone]}` : ''}`}
          >
            {t.value}
          </span>
          {t.hint && <span className="text-[11px] text-muted">{t.hint}</span>}
        </div>
      ))}
    </div>
  )
}
