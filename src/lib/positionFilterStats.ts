import type { DashboardMetrics } from '../types/dashboard'
import type { ActivePosition, ClosedTrade } from '../components/positions/types'

/**
 * The Positions page's stat cards for a FILTERED view (asset / exchange /
 * strategy chips). The account-wide figures come from `/dashboard/summary`;
 * once a chip narrows the tables, the cards must describe the same rows the
 * tables list — so they are recomputed here from those rows, with the API's
 * own rules (UserStatsService::summary):
 * - realized = Σ closed P&L after fees; unrealized = Σ the open rows';
 * - win rate, profit factor, expectancy and drawdown BEFORE fees
 *   (gross = after-fees P&L + the fee; a pre-cutoff row has no fee and is gross);
 * - drawdown walks the day totals (UTC days) from the account's curve start
 *   (`baseline` = equity − all realized), peak at the trough.
 * The % base (deposits) is the account's and does not change.
 */
export interface FilteredStats {
  realized: number
  unrealized: number
  total: number
  metrics: DashboardMetrics
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function filteredPositionStats(
  closed: ClosedTrade[],
  open: ActivePosition[],
  baseline: number,
): FilteredStats {
  const gross = (t: ClosedTrade) => t.pnl + (t.fee ?? 0)
  const realized = closed.reduce((s, t) => s + t.pnl, 0)
  const realizedGross = closed.reduce((s, t) => s + gross(t), 0)
  const unrealized = open.reduce((s, p) => s + p.unrealizedPnl, 0)
  const fees = closed.reduce((s, t) => s + (t.fee ?? 0), 0)

  const wins = closed.filter((t) => gross(t) > 0)
  const losses = closed.filter((t) => gross(t) < 0)
  const grossWin = wins.reduce((s, t) => s + gross(t), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + gross(t), 0))
  const n = closed.length

  return {
    realized: round2(realized),
    unrealized: round2(unrealized),
    total: round2(realized + unrealized),
    metrics: {
      net_pnl: round2(realized + unrealized),
      gross_pnl: round2(realizedGross + unrealized),
      fees: round2(fees),
      win_rate: n ? Math.round((wins.length / n) * 1000) / 10 : null,
      profit_factor: grossLoss > 0 ? round2(grossWin / grossLoss) : null,
      expectancy: n ? round2(realizedGross / n) : null,
      avg_rr:
        wins.length && losses.length && grossLoss > 0
          ? Math.round((grossWin / wins.length / (grossLoss / losses.length)) * 10) / 10
          : null,
      max_drawdown: maxDrawdownPct(dailyTotals(closed, gross), baseline),
      sharpe: null,
      trades: n,
    },
  }
}

/** Day totals oldest first (UTC days, like the API). */
function dailyTotals(trades: ClosedTrade[], value: (t: ClosedTrade) => number): number[] {
  const byDay = new Map<string, number>()
  for (const t of trades) {
    const day = t.closedDay ?? ''
    byDay.set(day, (byDay.get(day) ?? 0) + value(t))
  }
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v)
}

/** Mirror of UserStatsService::maxDrawdownPct — a negative percent, or 0. */
export function maxDrawdownPct(daily: number[], baseline: number): number {
  if (baseline <= 0) return 0
  let equity = baseline
  let peak = baseline
  let worst = 0
  let peakAtWorst = baseline
  for (const pnl of daily) {
    equity += pnl
    peak = Math.max(peak, equity)
    if (peak - equity > worst) {
      worst = peak - equity
      peakAtWorst = peak
    }
  }
  const pct = round2((worst / peakAtWorst) * 100)
  return pct > 0 ? -pct : 0
}
