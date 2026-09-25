/**
 * Preset date windows for the Performance card's Date Range tab.
 *
 * Two kinds:
 * - **Quick** windows — all time, last 7/30 days, this/last month.
 * - **Transfer segments** — one window per stretch between two days that
 *   moved money. Inside a segment no deposit or withdrawal lands after its
 *   first day, so the capital at work only changes through trading: it is
 *   the cleanest answer to "how did it do on THAT money". A segment starts ON
 *   its transfer day because transfers land before the day's trades (the
 *   capital walk's rule), and ends the day before the next one.
 *
 * All dates are 'YYYY-MM-DD' strings in UTC, like every day bucket on the
 * analytics page. Pure — no React.
 */

export interface RangePreset {
  id: string
  label: string
  /** Second line on a segment chip: the transfer that opened it. */
  detail?: string
  /** Sign of that transfer, for colouring the detail. */
  tone?: 'pos' | 'neg'
  from: string
  to: string
}

const DAY_MS = 86_400_000

function shift(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function quickPresets(firstDay: string | null, today: string): RangePreset[] {
  const thisMonth = monthStart(today)
  const lastMonthEnd = shift(thisMonth, -1)
  return [
    // "Max range": from the first thing that ever happened on the account.
    { id: 'all', label: 'All time', from: firstDay ?? today, to: today },
    { id: '7d', label: 'Last 7 days', from: shift(today, -6), to: today },
    { id: '30d', label: 'Last 30 days', from: shift(today, -29), to: today },
    { id: 'mtd', label: 'This month', from: thisMonth, to: today },
    { id: 'lm', label: 'Last month', from: monthStart(lastMonthEnd), to: lastMonthEnd },
  ]
}

/**
 * @param flows  net transfer per day (signed), from `daily_flows`
 * @param firstTradeDay  earliest day with a closed trade, if any
 * @param fmtDate  label formatter for a day ("Jul 16")
 * @param fmtAmount  formatter for the signed transfer ("+$3,667.00")
 */
export function transferSegments(
  flows: Record<string, number>,
  firstTradeDay: string | null,
  today: string,
  fmtDate: (iso: string) => string,
  fmtAmount: (n: number) => string,
): RangePreset[] {
  // A day whose deposit and withdrawal cancel to zero moved no capital.
  const days = Object.keys(flows)
    .filter((d) => flows[d] !== 0)
    .sort()
  if (days.length === 0) return []

  const out: RangePreset[] = []

  // Trading that happened on money funded before we ever saw a transfer
  // (initial_deposit): only worth a chip when there WAS trading before it.
  if (firstTradeDay !== null && firstTradeDay < days[0]) {
    out.push({
      id: `seg-start`,
      label: `Before ${fmtDate(days[0])}`,
      detail: 'Starting capital',
      from: firstTradeDay,
      to: shift(days[0], -1),
    })
  }

  days.forEach((day, i) => {
    const next = days[i + 1]
    const to = next ? shift(next, -1) : today
    const amount = flows[day]
    out.push({
      id: `seg-${day}`,
      label:
        !next ? `${fmtDate(day)} → today`
        : to === day ? fmtDate(day)
        : `${fmtDate(day)} → ${fmtDate(to)}`,
      detail: `${amount > 0 ? 'Deposit' : 'Withdrawal'} ${fmtAmount(amount)}`,
      tone: amount > 0 ? 'pos' : 'neg',
      from: day,
      to,
    })
  })

  return out
}
