/**
 * The shareable P&L card's figures, derived from a user's calendar days map
 * (GET /admin/users/{uniId}/daily-pnl). Pure — no React, no clock unless
 * passed in.
 *
 * The card is posted publicly, so it carries PERCENTAGES AND COUNTS ONLY —
 * the same rule as /api/public/* and the Telegram channel. Nothing here
 * returns a dollar amount or a balance.
 *
 * Every figure is AFTER exchange fees, and each day's percentage is the one
 * the calendar cell shows: that day's P&L over the balance it STARTED with.
 * A period's return chains those days (time-weighted), so a deposit inside
 * the period cannot inflate it. Days are UTC calendar days, like the
 * calendar they come from.
 */

export type PnlCardPeriod = 'today' | 'week' | 'month' | 'all'

export const PNL_CARD_PERIODS: { key: PnlCardPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
]

/** The slice of a calendar day the card reads. */
export interface PnlCardDay {
  total: number
  pct: number | null
  trades: { realized_pnl: number; closed_at: string }[]
}

export interface PnlCardStats {
  period: PnlCardPeriod
  /** First and last UTC date of the window (YYYY-MM-DD). */
  from: string
  to: string
  /** Chained return over the window, %; null when no day has a capital base. */
  returnPct: number | null
  /** Cumulative chained return after each close (each trading day ends on its
   *  chained figure), starting at 0. */
  curve: number[]
  trades: number
  wins: number
  losses: number
  /** Share of decided trades (wins + losses) in profit, %; null with none. */
  winRate: number | null
  /** Consecutive winning trades up to the most recent close — ALL history. */
  winStreak: number
  tradingDays: number
  greenDays: number
  /** Best single day's return in the window, %. */
  bestDayPct: number | null
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** [from, to] UTC dates for a period ending on `now`'s UTC day. */
export function periodRange(
  period: PnlCardPeriod,
  now: Date,
  firstDay: string | null,
): [string, string] {
  const to = iso(now)
  if (period === 'today') return [to, to]
  if (period === 'week') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6))
    return [iso(start), to]
  }
  if (period === 'month') {
    return [iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), to]
  }
  return [firstDay ?? to, to]
}

/** Current run of consecutive winning trades, newest first; a loss ends it. */
export function currentWinStreak(trades: { realized_pnl: number; closed_at: string }[]): number {
  const newestFirst = [...trades].sort((a, b) => b.closed_at.localeCompare(a.closed_at))
  let streak = 0
  for (const t of newestFirst) {
    if (t.realized_pnl > 0) streak++
    else if (t.realized_pnl < 0) break
    // a flat close neither extends nor breaks the run
  }
  return streak
}

export function buildPnlCard(
  days: Record<string, PnlCardDay>,
  period: PnlCardPeriod,
  now: Date = new Date(),
): PnlCardStats {
  const dates = Object.keys(days).sort()
  const [from, to] = periodRange(period, now, dates[0] ?? null)
  const inWindow = dates.filter((d) => d >= from && d <= to)

  let factor = 1
  let measured = false
  const curve = [0]
  let bestDayPct: number | null = null
  for (const d of inWindow) {
    const { pct, total } = days[d]
    if (pct !== null && pct !== undefined) {
      // One point per CLOSE, not per day, so a single day still draws a path.
      // Each trade takes its share of the day's % by its share of the day's
      // P&L — the shares add up to the day's %, so the line still ends on the
      // chained return and nothing is compounded twice.
      const dayTrades = [...days[d].trades].sort((a, b) => a.closed_at.localeCompare(b.closed_at))
      if (total !== 0 && dayTrades.length > 1) {
        let running = 0
        for (const t of dayTrades.slice(0, -1)) {
          running += t.realized_pnl
          curve.push((factor * (1 + (pct * (running / total)) / 100) - 1) * 100)
        }
      }
      factor *= 1 + pct / 100
      measured = true
      bestDayPct = bestDayPct === null ? pct : Math.max(bestDayPct, pct)
    }
    curve.push((factor - 1) * 100)
  }

  const trades = inWindow.flatMap((d) => days[d].trades)
  const wins = trades.filter((t) => t.realized_pnl > 0).length
  const losses = trades.filter((t) => t.realized_pnl < 0).length

  return {
    period,
    from,
    to,
    returnPct: measured ? (factor - 1) * 100 : null,
    curve,
    trades: trades.length,
    wins,
    losses,
    winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null,
    winStreak: currentWinStreak(dates.flatMap((d) => days[d].trades)),
    tradingDays: inWindow.length,
    greenDays: inWindow.filter((d) => days[d].total > 0).length,
    bestDayPct,
  }
}
