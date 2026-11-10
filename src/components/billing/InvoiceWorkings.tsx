import type { ReactNode } from 'react'
import { ArrowDown, Calculator } from 'lucide-react'
import { fmtMediumDate, fmtMoney, fmtSignedMoney } from '../../lib/format'
import type { Invoice } from '../../lib/billing'

/** Round to cents so derived figures print exactly like the stored ones. */
const r2 = (n: number) => Math.round(n * 100) / 100

const ROW = 'flex items-start justify-between gap-4 py-2.5 border-b border-hair last:border-b-0'
const KEY = 'text-[12.5px] text-text font-semibold leading-snug'
const NOTE = 'block text-[11px] font-medium text-muted mt-0.5 leading-snug'
const VAL = 'font-mono text-[13px] font-bold whitespace-nowrap text-right'

function Step({
  label,
  note,
  value,
  tone,
  strong = false,
}: {
  label: ReactNode
  note?: ReactNode
  value: string
  tone?: 'pos' | 'neg' | 'accent' | 'muted'
  strong?: boolean
}) {
  const color =
    tone === 'pos'
      ? 'text-green'
      : tone === 'neg'
        ? 'text-red'
        : tone === 'accent'
          ? 'text-accent'
          : tone === 'muted'
            ? 'text-muted'
            : 'text-text'
  return (
    <div className={ROW}>
      <span className={`${KEY} min-w-0`}>
        {label}
        {note && <span className={NOTE}>{note}</span>}
      </span>
      <span className={`${VAL} ${color} ${strong ? 'text-[15px] font-extrabold' : ''}`}>{value}</span>
    </div>
  )
}

/** A small caption between groups of steps. */
function Group({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 mb-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-faint first:mt-0">
      {children}
    </p>
  )
}

/**
 * "How this bill was worked out" — the invoice's own figures in the order the
 * rule uses them, in plain words (2026-11-10, after Dima read a customer's
 * October as +$190 and could not see how that became a $24.04 bill):
 *
 *   1. the high point the month started from;
 *   2. the account value when the bill was made, with the month's transfers
 *      set aside (money moved is never profit or loss) → above or not;
 *   3. the month's closed trades: before fees − exchange fees = after fees;
 *   4. our share of the after-fees profit = the bill;
 *   5. the new high point, moved by the money that left or arrived.
 *
 * It RESTATES the row and never recomputes the fee: every amount is a stored
 * figure, and the only arithmetic is differences between two of them (the
 * exchange fees, the margin over the high point, a transfer made after the
 * month ended), so each line reconciles with the ones around it.
 */
export default function InvoiceWorkings({ invoice: inv }: { invoice: Invoice }) {
  const month = inv.monthLabel.split(' ')[0] || inv.monthLabel
  const manual = inv.feeSource === 'manual'

  const start = inv.hwmBefore ?? 0
  const valueAtBill = inv.currentBalance
  const flow = r2(inv.capitalFlow)
  // Invoices made before 2026-11-08 compared the balance with the high point
  // directly and stored that balance as performance_equity, while a FIRST
  // invoice counted the month's deposits in its starting point. Read the
  // money-moved lines into one of those and they would add back a deposit
  // twice — so it is told the way it was actually worked out.
  const legacy =
    inv.performanceEquity !== null && flow !== 0 && r2(inv.performanceEquity) === r2(valueAtBill)
  const perf = legacy ? null : inv.performanceEquity
  const compared = inv.performanceEquity === null ? null : legacy ? valueAtBill : inv.performanceEquity
  // A transfer after the month ended but before the bill was made: it is
  // already in (or out of) the balance read, and is set aside too.
  const flowAfter = perf === null ? 0 : r2(valueAtBill - flow - perf)
  const above = compared === null ? null : compared > start
  const margin = compared === null ? 0 : r2(compared - start)

  const gross = inv.realizedPnlGross
  const net = inv.realizedPnl
  const fees = gross === null ? null : r2(gross - net)

  const billed = inv.totalFee > 0
  const startWord = inv.isFirstInvoice ? 'starting point' : 'high point'

  return (
    <section className="rounded-[14px] border border-accent-line bg-surface2 p-4">
      <p className="text-[10.5px] uppercase tracking-[0.1em] text-accent mb-2 inline-flex items-center gap-1.5 font-bold">
        <Calculator size={12} /> How this bill was worked out
      </p>

      <Group>1 · Where {month} started</Group>
      <Step
        label={inv.isFirstInvoice ? `Money in the account when ${month} began` : 'High point after the last bill'}
        note={
          inv.isFirstInvoice
            ? 'First invoice: the starting point is the money already in the account.'
            : 'A fee is charged only while the account is above this.'
        }
        value={fmtMoney(start)}
      />

      <Group>2 · Was the account above it?</Group>
      <Step
        label="Account value when the bill was made"
        note={`Balance plus any open trades, ${fmtMediumDate(inv.invoiceDate)}.`}
        value={fmtMoney(valueAtBill)}
      />
      {perf !== null && flow !== 0 && (
        <Step
          label={flow < 0 ? `Withdrawn in ${month}, added back` : `Deposited in ${month}, taken off`}
          note="Money moved in or out is not profit or loss."
          value={fmtSignedMoney(-flow)}
          tone="muted"
        />
      )}
      {flowAfter !== 0 && (
        <Step
          label={flowAfter < 0 ? `Withdrawn after ${month} ended, added back` : `Deposited after ${month} ended, taken off`}
          note="Already in the balance when the bill was made, but it belongs to next month."
          value={fmtSignedMoney(-flowAfter)}
          tone="muted"
        />
      )}
      {perf !== null && (flow !== 0 || flowAfter !== 0) && (
        <Step label="= Value with transfers set aside" value={fmtMoney(perf)} />
      )}
      {compared !== null && (
        <>
          <div
            className={`mt-2 flex items-center gap-2 rounded-row border px-3 py-2 text-[12px] font-semibold ${
              above
                ? 'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-green'
                : 'border-border bg-surface text-muted'
            }`}
          >
            <ArrowDown size={13} className="flex-none" />
            {above
              ? `${fmtMoney(margin)} above the ${startWord}, so ${month} is billed.`
              : `Not above the ${startWord} (${fmtMoney(margin)} short), so there is no fee for ${month}.`}
          </div>
          {legacy && (
            <p className="mt-2 text-[11px] font-medium leading-snug text-muted">
              This invoice was made before 8 Nov 2026. Back then the bill compared the balance with
              the starting point directly, and a first invoice counted the month&apos;s deposits in
              that starting point.
            </p>
          )}
        </>
      )}

      <Group>3 · {month}&apos;s closed trades</Group>
      {gross !== null && fees !== null ? (
        <>
          <Step label="Profit before exchange fees" value={fmtSignedMoney(gross)} tone="muted" />
          <Step
            label="Exchange fees"
            note="What the exchange charged: commission on every fill plus funding."
            value={fees === 0 ? '$0.00' : fmtSignedMoney(-fees)}
            tone="muted"
          />
          <Step
            label="Profit after exchange fees"
            note="The profit the bill is worked out on."
            value={fmtSignedMoney(net)}
            tone={net < 0 ? 'neg' : 'pos'}
            strong
          />
        </>
      ) : (
        <Step
          label="Closed profit"
          note="After exchange fees for trades from Sep 11, 2026. The before-fees figure was not recorded for this invoice."
          value={fmtSignedMoney(net)}
          tone={net < 0 ? 'neg' : 'pos'}
          strong
        />
      )}

      <Group>4 · Our fee</Group>
      {manual ? (
        <Step
          label={`Set by hand for ${month}`}
          note="An admin typed this amount instead of the usual share of profit."
          value={fmtMoney(inv.totalFee)}
          tone="accent"
          strong
        />
      ) : !billed ? (
        <Step
          label="No fee"
          note={
            above === false
              ? 'Nothing is charged while the account is below its high point.'
              : 'There was no profit to share this month.'
          }
          value="$0.00"
          tone="accent"
          strong
        />
      ) : (
        <>
          {inv.feeRealized > 0 && (
            <Step
              label={`${inv.realizedPercent}% of ${fmtSignedMoney(net)} closed profit`}
              value={fmtMoney(inv.feeRealized)}
            />
          )}
          {inv.feeUnrealized > 0 && (
            <Step
              label={`${inv.unrealizedPercent}% of ${fmtSignedMoney(inv.unrealizedPnl)} still open at month end`}
              value={fmtMoney(inv.feeUnrealized)}
            />
          )}
          <Step label="Total bill" value={fmtMoney(inv.totalFee)} tone="accent" strong />
        </>
      )}

      {inv.hwmAfter !== null && (
        <>
          <Group>5 · The next high point</Group>
          <Step
            label="New high point"
            note={
              flow !== 0 && !legacy
                ? `The higher of the two values above, then moved by the ${fmtMoney(flow)} ${
                    flow < 0 ? 'withdrawn' : 'deposited'
                  }, so next month is measured on the money still in the account.`
                : 'The higher of the two values above. Next month is billed only on gains above it.'
            }
            value={fmtMoney(inv.hwmAfter)}
          />
        </>
      )}
    </section>
  )
}
