/**
 * The Date Range card's Period Return — the daily percentages ADDED.
 *
 * Owner's team, 2026-10-05: "yesterday 4%, the day before 1% — between the
 * two days I want to see 5%." Each day's percentage is the one the P&L
 * calendar prints (that day's P&L over the balance it started with, saved in
 * `daily_returns`), and the period is their plain sum. Until then the card
 * compounded them (5.04%); the compounded figure is still computed from the
 * SAME daily percentages and shown beside the sum in the breakdown modal, so
 * the two can only ever differ in method, never in data.
 *
 * Pure — no React.
 */

import type { DailyReturn } from '../types/analytics'

export interface PeriodDay {
  date: string
  startBalance: number | null
  /** After fees / before fees. */
  pnl: number
  pnlGross: number
  /** The day's % (after / before fees); null = no capital on record. */
  pct: number | null
  pctGross: number | null
  /** Sum of the measured days' pct up to and including this one. */
  running: number
}

export interface PeriodReturn {
  days: PeriodDay[]
  /** Σ daily % — what the card shows. Null when no day could be measured. */
  added: number | null
  addedGross: number | null
  /** Π(1 + daily %) − 1 over the same days. */
  compounded: number | null
  compoundedGross: number | null
  measured: number
  unmeasured: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * @param entries   [date, pnl before fees, pnl after fees], ascending — the
 *                  page's (possibly chip-filtered) trading days
 * @param saved     the saved daily rows; ignored when `filtered`
 * @param capital   balance each day started with — the fallback denominator
 * @param filtered  a ticker/strategy chip is active: a saved day holds EVERY
 *                  trade, so the filtered trades are measured on the same
 *                  capital with the same formula instead
 */
export function periodReturn(
  entries: [date: string, pnl: number, pnlNet: number][],
  from: string,
  to: string,
  saved: Record<string, DailyReturn> | undefined,
  capital: Record<string, number>,
  filtered: boolean,
): PeriodReturn {
  const days: PeriodDay[] = []
  let added = 0
  let addedGross = 0
  let growth = 1
  let growthGross = 1
  let measured = 0
  let unmeasured = 0

  for (const [date, pnlGross, pnl] of entries) {
    if (date < from || date > to) continue

    const row = filtered ? undefined : saved?.[date]
    const base = row ? row.start_balance : (capital[date] ?? null)
    let pct: number | null
    let pctGross: number | null
    if (row) {
      pct = row.pct
      pctGross = row.pct_gross
    } else {
      // Same formula and rounding the API saves with, so a filtered view and
      // an older API read exactly like the calendar would.
      const ok = base !== null && base > 0
      pct = ok ? round2((pnl / base) * 100) : null
      pctGross = ok ? round2((pnlGross / base) * 100) : null
    }

    if (pct === null) {
      unmeasured++
    } else {
      measured++
      added += pct
      addedGross += pctGross ?? pct
      // Floored at 0: a day losing more than the account must not compound
      // into a negative factor and flip every later day's sign.
      growth *= Math.max(0, 1 + pct / 100)
      growthGross *= Math.max(0, 1 + (pctGross ?? pct) / 100)
    }
    days.push({
      date,
      startBalance: base,
      pnl,
      pnlGross,
      pct,
      pctGross,
      running: round2(added),
    })
  }

  const any = measured > 0
  return {
    days,
    added: any ? round2(added) : null,
    addedGross: any ? round2(addedGross) : null,
    compounded: any ? (growth - 1) * 100 : null,
    compoundedGross: any ? (growthGross - 1) * 100 : null,
    measured,
    unmeasured,
  }
}
