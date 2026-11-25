import { fmtMoney, fmtSignedMoney } from '../../lib/format'
import {
  FEE_EXAMPLE,
  FEE_EXAMPLE_DEPOSIT,
  STANDARD_REALIZED_FEE_PCT,
  STANDARD_UNREALIZED_FEE_PCT,
  type BilledMonth,
} from '../../lib/pricing'
import { CONTAINER, H2, LEAD } from './layout'

/** The chart's value axis, in dollars — chosen around the example's figures. */
const AXIS_MIN = 1800
const AXIS_MAX = 2400

const heightPct = (value: number) => ((value - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100

/** Share of the chart's height the bars may use; the labels sit above it. */
const BAND = 78

/** One sentence per month, written from its own figures. */
function noteFor(m: BilledMonth, first: boolean): string {
  const closed = `${fmtSignedMoney(m.closedProfit, 0)} closed.`
  const end = fmtMoney(m.endEquity, 0)
  const mark = fmtMoney(m.markBefore, 0)
  if (m.bill > 0) {
    return `${closed} It ends at ${end}, above its ${mark} ${first ? 'start' : 'high'}: ${STANDARD_REALIZED_FEE_PCT}% of ${fmtMoney(m.closedProfit, 0)}.`
  }
  if (m.closedProfit < 0) return `${closed} ${end} is under the ${mark} high, so no bill.`
  return `${closed} A good month, but ${end} is still under the ${mark} high, so no bill.`
}

/**
 * The bars are the account's value at each month end; the dashed step is the
 * high-water mark that month was judged against. Bars are HTML so their
 * labels stay readable on a phone; the mark is one SVG path stretched over
 * the same columns (`preserveAspectRatio="none"` + a non-scaling stroke).
 */
function MarkChart() {
  const columns = [
    { label: 'Start', value: FEE_EXAMPLE_DEPOSIT, top: 'Deposit', billed: false, start: true },
    ...FEE_EXAMPLE.map((m) => ({
      label: m.label,
      value: m.endEquity,
      top: m.bill > 0 ? `${fmtMoney(m.bill, 0)} bill` : '$0',
      billed: m.bill > 0,
      start: false,
    })),
  ]
  const n = columns.length
  const width = n * 100
  const y = (value: number) => 100 - heightPct(value)
  // Each month's mark spans its own column; the path steps between them.
  const markPath = FEE_EXAMPLE.map((m, i) => {
    const left = (i + 1) * 100
    return `${i === 0 ? 'M' : 'L'}${left} ${y(m.markBefore)} L${left + 100} ${y(m.markBefore)}`
  }).join(' ')

  return (
    <div
      role="img"
      aria-label={`Worked example: a ${fmtMoney(FEE_EXAMPLE_DEPOSIT, 0)} account over three months. ${FEE_EXAMPLE.map(
        (m) => `${m.label}: ends at ${fmtMoney(m.endEquity, 0)}, bill ${fmtMoney(m.bill, 0)}`,
      ).join('. ')}.`}
    >
      <div className="relative h-[200px] grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {columns.map((c) => (
          <div key={c.label} className="flex flex-col items-center h-full px-2.5">
            {/* Labels live in the top band, clear of the bars and the mark. */}
            <span
              className={`font-mono text-[12.5px] font-semibold whitespace-nowrap max-[420px]:text-[11px] ${
                c.billed ? 'text-accent' : c.start ? 'text-muted' : 'text-faint'
              }`}
            >
              {c.top}
            </span>
            <div className="flex-1" />
            <div
              className={`w-full max-w-[64px] ${
                c.billed ? 'bg-accent' : c.start ? 'bg-hair border border-border' : 'bg-border'
              }`}
              style={{ height: `${heightPct(c.value) * (BAND / 100)}%` }}
            />
          </div>
        ))}
        {/* The mark: one stepped dashed path over the same bottom band. */}
        <svg
          aria-hidden="true"
          className="absolute left-0 right-0 bottom-0 w-full pointer-events-none overflow-visible"
          style={{ height: `${BAND}%` }}
          viewBox={`0 0 ${width} 100`}
          preserveAspectRatio="none"
        >
          <path d={markPath} fill="none" stroke="var(--text)" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="grid border-t border-border pt-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {columns.map((c) => (
          <span key={c.label} className="text-center">
            <span className="block text-[13px] font-semibold text-muted">{c.label}</span>
            <span className="block font-mono text-[11px] text-faint mt-0.5">{fmtMoney(c.value, 0)}</span>
          </span>
        ))}
      </div>
      <p className="flex items-center gap-2 text-[12px] text-muted mt-4">
        <svg width={28} height={6} aria-hidden="true"><line x1={0} y1={3} x2={28} y2={3} stroke="var(--text)" strokeWidth={2} strokeDasharray="6 4" /></svg>
        High-water mark: the highest month end so far
      </p>
    </div>
  )
}

/**
 * "How the bill works", as a worked example instead of a slogan. The months
 * are `FEE_EXAMPLE` (lib/pricing.ts), built by the same rule the invoices use
 * and pinned by a test, so the chart, the ledger and the sentences cannot
 * disagree with each other or with how a customer is actually billed.
 */
export default function FeeExample() {
  return (
    <section className="border-t border-hair">
      <div className={`${CONTAINER} py-20 grid grid-cols-[0.95fr_1.05fr] gap-14 items-start max-[960px]:grid-cols-1 max-[960px]:gap-10 max-[560px]:py-14`}>
        <div data-aos="fade-up">
          <h2 className={`${H2} mb-4`}>You pay when your account reaches a new high</h2>
          <p className={`${LEAD} mb-4`}>
            At the end of each month we compare your account with its high-water
            mark: the highest it has ended a month before, and at first simply
            what you deposited. Above the mark, you are billed a share of that
            month&rsquo;s profit. Not above it, you owe nothing.
          </p>
          <p className={`${LEAD} mb-8`}>
            Deposits and withdrawals move the mark with them, so they never
            count as profit or loss.
          </p>

          <dl className="grid grid-cols-2 gap-px bg-border border border-border rounded-card overflow-hidden max-[420px]:grid-cols-1">
            <div className="bg-surface p-5">
              <dt className="text-[13px] text-muted mb-1">Closed trades</dt>
              <dd className="font-display text-[28px] font-extrabold text-text">{STANDARD_REALIZED_FEE_PCT}%</dd>
              <dd className="text-[12.5px] text-muted mt-1">of the month&rsquo;s profit</dd>
            </div>
            <div className="bg-surface p-5">
              <dt className="text-[13px] text-muted mb-1">Trades still open on the 1st</dt>
              <dd className="font-display text-[28px] font-extrabold text-text">{STANDARD_UNREALIZED_FEE_PCT}%</dd>
              <dd className="text-[12.5px] text-muted mt-1">of their open profit</dd>
            </div>
          </dl>
          <p className="text-[13px] leading-[1.6] text-muted mt-4">
            Standard rates; yours are printed on every invoice. No subscription
            and no fee for connecting. The invoice arrives on the 1st and is due
            on the 4th. If it is still unpaid then, the bot pauses on your
            account until it is paid.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-card p-6 max-[560px]:p-4" data-aos="fade-up" data-aos-delay={100}>
          <p className="font-semibold text-[15px] mb-1">Example: {fmtMoney(FEE_EXAMPLE_DEPOSIT, 0)} deposited, three months</p>
          <p className="text-[13px] text-muted mb-6">Closed trades only, nothing open at month end.</p>
          <MarkChart />
          <ol className="mt-6 border-t border-hair">
            {FEE_EXAMPLE.map((m, i) => (
              <li key={m.label} className="flex items-start justify-between gap-4 py-3 border-b border-hair last:border-b-0">
                <span className="text-[13.5px] leading-[1.55] text-muted">
                  <span className="font-semibold text-text">{m.label}.</span> {noteFor(m, i === 0)}
                </span>
                <span className={`font-mono text-[14px] font-semibold shrink-0 ${m.bill > 0 ? 'text-accent' : 'text-faint'}`}>
                  {fmtMoney(m.bill, 0)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
