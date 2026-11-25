/**
 * What the public pages say about price and the entry bar, in ONE place.
 * Pure — no React.
 *
 * Every figure here is a twin of a server rule; change the server, change
 * this in the same commit:
 *  - The fee rates are the DEFAULTS on `user_credentials`
 *    (`realized_percentage` 20, `unrealized_percentage` 6). A customer's own
 *    rates can differ and are printed on each invoice.
 *  - `MIN_DEPOSIT_USDT` is the engine's deposit gate (`BINANCE_ABCD_MIN_DEPOSIT`,
 *    and the API's `ENGINE_MIN_DEPOSIT` that the admin funnel reads).
 *  - `billMonth` restates `InvoiceService::applyHighWaterMark` for the simple
 *    case the worked example shows: closed profit only, nothing open, no
 *    deposits or withdrawals.
 */

/** Share of CLOSED profit billed, in percent. */
export const STANDARD_REALIZED_FEE_PCT = 20

/** Share of the profit on positions still OPEN at month end, in percent. */
export const STANDARD_UNREALIZED_FEE_PCT = 6

/** Deposits (net of withdrawals) an account needs before the bot opens a trade. */
export const MIN_DEPOSIT_USDT = 1000

export interface BilledMonth {
  label: string
  /** The month's closed profit (negative = a loss). */
  closedProfit: number
  /** The account's value at the end of the month. */
  endEquity: number
  /** The high-water mark the month was judged against. */
  markBefore: number
  /** The mark the next month is judged against. */
  markAfter: number
  /** The invoice for the month — 0 when nothing is owed. */
  bill: number
}

/**
 * One month under the high-water-mark rule: billed only when the account ends
 * ABOVE its mark, and then the rate times the month's closed profit. The mark
 * then rises to the new high (it never falls without a withdrawal, which this
 * example has none of).
 */
export function billMonth(
  label: string,
  markBefore: number,
  startEquity: number,
  closedProfit: number,
  ratePct: number = STANDARD_REALIZED_FEE_PCT,
): BilledMonth {
  const endEquity = startEquity + closedProfit
  const chargeable = endEquity > markBefore
  const bill = chargeable ? Math.round(Math.max(0, closedProfit) * ratePct) / 100 : 0
  return {
    label,
    closedProfit,
    endEquity,
    markBefore,
    markAfter: Math.max(markBefore, endEquity),
    bill,
  }
}

/**
 * A run of months from a first deposit. The first month's mark is the
 * deposit itself, as on a customer's first invoice.
 */
export function buildFeeExample(
  deposit: number,
  months: { label: string; closedProfit: number }[],
): BilledMonth[] {
  const out: BilledMonth[] = []
  let equity = deposit
  let mark = deposit
  for (const m of months) {
    const month = billMonth(m.label, mark, equity, m.closedProfit)
    out.push(month)
    equity = month.endEquity
    mark = month.markAfter
  }
  return out
}

/** The home page's worked example: a profit, a loss, then a recovery that
 *  has not yet passed the old high. Chosen so the invoice code and the FAQ's
 *  wording ("billed only on profit ABOVE the mark") give the same bills —
 *  they part ways on the month that crosses back over the mark (the code
 *  bills that month's whole profit, see the last test), which is an open
 *  owner decision (to-do `fee-wording-public-pages`). */
export const FEE_EXAMPLE_DEPOSIT = 2000

export const FEE_EXAMPLE: BilledMonth[] = buildFeeExample(FEE_EXAMPLE_DEPOSIT, [
  { label: 'March', closedProfit: 300 },
  { label: 'April', closedProfit: -200 },
  { label: 'May', closedProfit: 150 },
])
