import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { fmtMediumDate, fmtMoney, fmtSignedMoney } from '../../lib/format'
import type { Invoice } from '../../lib/billing'
import type { MonthlyStat } from '../../types/analytics'
import BarReadout from './BarReadout'

const W = 600
const H = 230
const TOP = 30
const BOTTOM = 34
const PLOT = H - TOP - BOTTOM

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

interface MonthlyBreakdownCardProps {
  monthly: MonthlyStat[]
  /**
   * Bars (and the table's emphasis) AFTER exchange fees, before fees in the
   * hover — the admin's read of one user (owner, 2026-11-10: "priority after
   * fees"). The trader's own page keeps before fees.
   */
  afterFees?: boolean
  /**
   * Adds a month-by-month table under the chart — before fees, exchange fees,
   * after fees — so the after-fees figure is on the page, not only on hover.
   * The admin's read of one user; the trader's own page leaves it off.
   */
  showTable?: boolean
  /**
   * The user's invoices, already narrowed to the exchange in view. Each month
   * row then carries the invoice for that month — our fee and whether it is
   * paid — so "what did he make" and "what did we bill" sit on one line.
   */
  invoices?: Invoice[]
  /** Opens one invoice's detail ("how this bill was worked out"). */
  onOpenInvoice?: (invoice: Invoice) => void
}

const TH =
  'text-right first:text-left text-[10px] uppercase tracking-[0.07em] text-faint font-bold py-2 px-2.5 border-b border-hair whitespace-nowrap'
const TD = 'text-right first:text-left py-2.5 px-2.5 border-b border-hair font-mono text-[12.5px] whitespace-nowrap'

/** 'YYYY-MM' -> 'Oct 2026'. */
function monthName(key: string): string {
  return `${MONTH_LABELS[Number(key.slice(5, 7)) - 1] ?? key.slice(5, 7)} ${key.slice(0, 4)}`
}

/** 'YYYY-MM' of the month after `key`. */
function nextMonth(key: string): string {
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7))
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** 'YYYY-MM' of today, UTC — billing months are UTC. */
function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

/** "Monthly Performance Breakdown" — P&L for every month (Jan–Dec) of the
 *  target year, with empty months shown as zero bars. Bars are BEFORE
 *  exchange fees on the trader's page and AFTER them on the admin's read;
 *  hovering one reads out all three figures, and the year's fees are
 *  totalled under the chart. */
export default function MonthlyBreakdownCard({
  monthly,
  afterFees = false,
  showTable = false,
  invoices,
  onOpenInvoice,
}: MonthlyBreakdownCardProps) {
  const [hover, setHover] = useState<number | null>(null)

  // Anchor on the most recent year present in the data (else this year).
  const year =
    monthly.length > 0
      ? Number(monthly[monthly.length - 1].month.slice(0, 4))
      : new Date().getFullYear()

  const byMonth = new Map(monthly.map((m) => [m.month, m]))
  const months = MONTH_LABELS.map((label, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const stat = byMonth.get(key)
    const pnl = stat?.pnl ?? 0
    const pnlNet = stat?.pnl_net ?? 0
    return {
      key,
      label,
      pnl,
      pnlNet,
      /** The bar's figure on this page's basis. */
      shown: afterFees ? pnlNet : pnl,
      fees: stat?.fees ?? 0,
      trades: stat?.trades ?? 0,
    }
  })

  const yearLabel = String(year)
  const yearFees = months.reduce((s, m) => s + m.fees, 0)

  const max = Math.max(...months.map((m) => m.shown), 0)
  const min = Math.min(...months.map((m) => m.shown), 0)
  const span = max - min || 1
  const yOf = (v: number) => TOP + ((max - v) / span) * PLOT
  const zeroY = yOf(0)
  const slot = W / months.length
  const barW = Math.min(52, slot * 0.6)

  const hovered = hover !== null && months[hover].trades > 0 ? months[hover] : null
  const hoverX = hover !== null ? (hover * slot + slot / 2) / W : 0

  return (
    <section
      className="rounded-card p-card border border-border bg-surface"
      data-aos="fade-up"
      data-aos-delay="200"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Calendar size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Monthly Performance Breakdown
          </div>
          <div className="text-[12px] text-muted mt-px">
            P&L by month for {yearLabel} · {afterFees ? 'after fees' : 'before fees'}
          </div>
        </div>
      </div>

      <div className="relative" onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[250px] block">
          <g stroke="var(--hair)" strokeWidth="1">
            <line x1="0" y1={TOP} x2={W} y2={TOP} />
            <line x1="0" y1={(TOP + zeroY) / 2} x2={W} y2={(TOP + zeroY) / 2} />
          </g>
          <line
            x1="0"
            y1={zeroY}
            x2={W}
            y2={zeroY}
            stroke="var(--muted)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {months.map((m, i) => {
            const x = i * slot + (slot - barW) / 2
            const pos = m.shown >= 0
            const y = pos ? yOf(m.shown) : zeroY
            const h = Math.abs(yOf(m.shown) - zeroY)
            return (
              <g
                key={m.key}
                onPointerEnter={() => setHover(i)}
                className={m.trades > 0 ? 'cursor-help' : undefined}
              >
                {/* Full-slot hit area so a thin bar is still hoverable. */}
                <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(h, 2)}
                  rx="6"
                  fill={pos ? 'var(--green)' : 'var(--red)'}
                  opacity={hover === null || hover === i ? 0.85 : 0.35}
                  className="transition-opacity duration-150"
                />
                {m.trades > 0 && (
                  <text
                    x={x + barW / 2}
                    y={pos ? y - 8 : y + h + 14}
                    textAnchor="middle"
                    className={`font-mono text-[11px] font-bold ${pos ? 'fill-green' : 'fill-red'}`}
                  >
                    {fmtSignedMoney(m.shown, 0)}
                  </text>
                )}
                <text
                  x={x + barW / 2}
                  y={H - 10}
                  textAnchor="middle"
                  className="font-mono text-[11px] font-semibold fill-faint tracking-[0.5px]"
                >
                  {m.label}
                </text>
              </g>
            )
          })}
        </svg>

        {hovered && (
          <BarReadout
            xFrac={hoverX}
            title={`${hovered.label} ${yearLabel} · ${hovered.trades} trade${hovered.trades === 1 ? '' : 's'}`}
            gross={hovered.pnl}
            net={hovered.pnlNet}
          />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 flex-wrap font-mono text-[10.5px] text-faint tracking-[0.4px]">
        <span>
          {showTable
            ? 'Every month with trades is listed below'
            : `Hover a month for the ${afterFees ? 'before-fees' : 'after-fees'} figure`}
        </span>
        <span>
          Exchange fees in {yearLabel} ·{' '}
          <span className="text-text font-bold">
            {yearFees === 0 ? '$0.00' : `−${fmtMoney(yearFees)}`}
          </span>
        </span>
      </div>

      {showTable && (
        <MonthTable monthly={monthly} invoices={invoices} onOpenInvoice={onOpenInvoice} />
      )}
    </section>
  )
}

const PILL = 'inline-block text-[9.5px] font-bold uppercase tracking-[0.05em] py-[2px] px-[7px] rounded-pill'

/** One month's billing state: what we charged and whether it is settled. */
function BillCell({
  month,
  invoices,
  onOpenInvoice,
}: {
  month: string
  invoices: Invoice[]
  onOpenInvoice?: (invoice: Invoice) => void
}) {
  if (invoices.length === 0) {
    // The running month (or later) is billed on the 1st after it ends.
    const open = month >= currentMonthKey()
    return (
      <span className="font-sans text-[11.5px] font-semibold text-faint">
        {open ? `Billed ${fmtMediumDate(`${nextMonth(month)}-01`)}` : 'No invoice'}
      </span>
    )
  }

  const fee = invoices.reduce((s, i) => s + i.totalFee, 0)
  const owed = invoices.filter((i) => i.status !== 'paid' && i.totalFee > 0)
  const overdue = owed.some((i) => i.isOverdue)
  const pill =
    owed.length === 0
      ? { label: fee > 0 ? 'Paid' : 'No fee', cls: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green' }
      : overdue
        ? { label: 'Overdue', cls: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red' }
        : {
            label: `Due ${fmtMediumDate(owed[0].dueDate).replace(/, \d{4}$/, '')}`,
            cls: 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent',
          }

  const body = (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="font-mono font-bold text-text">{fmtMoney(fee)}</span>
      <span className={`${PILL} ${pill.cls}`}>{pill.label}</span>
    </span>
  )

  // One invoice: the figure opens it. Several (two venues in one month): the
  // Invoices tab lists them.
  return onOpenInvoice && invoices.length === 1 ? (
    <button
      type="button"
      onClick={() => onOpenInvoice(invoices[0])}
      title="How this bill was worked out"
      className="rounded-btn px-1.5 py-1 -mx-1.5 -my-1 cursor-pointer transition-colors hover:bg-surface2 underline decoration-dotted decoration-1 underline-offset-[5px] decoration-[color-mix(in_srgb,var(--muted)_60%,transparent)]"
    >
      {body}
    </button>
  ) : (
    body
  )
}

/** Newest month first; months with no closed trade are left out. Fees are
 *  derived (before − after) so each row reconciles across its own cells. */
function MonthTable({
  monthly,
  invoices,
  onOpenInvoice,
}: {
  monthly: MonthlyStat[]
  invoices?: Invoice[]
  onOpenInvoice?: (invoice: Invoice) => void
}) {
  const rows = monthly.filter((m) => m.trades > 0).slice().reverse()
  if (rows.length === 0) return null
  const billing = invoices !== undefined

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>Month</th>
            <th className={TH}>Trades</th>
            <th className={TH}>Before fees</th>
            <th className={TH}>Exchange fees</th>
            <th className={`${TH} text-accent`}>After fees</th>
            {billing && <th className={TH}>Our fee</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const fee = Math.round((m.pnl - m.pnl_net) * 100) / 100
            return (
              <tr key={m.month} className="transition-colors hover:bg-surface2">
                <td className={`${TD} font-sans font-semibold`}>{monthName(m.month)}</td>
                <td className={`${TD} text-muted`}>{m.trades.toLocaleString('en-US')}</td>
                <td className={`${TD} text-muted`}>{fmtSignedMoney(m.pnl)}</td>
                <td className={`${TD} text-muted`}>
                  {fee === 0 ? '$0.00' : `${fee > 0 ? '−' : '+'}${fmtMoney(fee)}`}
                </td>
                <td
                  className={`${TD} text-[13.5px] font-extrabold bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] ${
                    m.pnl_net < 0 ? 'text-red' : 'text-green'
                  }`}
                >
                  {fmtSignedMoney(m.pnl_net)}
                </td>
                {billing && (
                  <td className={TD}>
                    <BillCell
                      month={m.month}
                      invoices={(invoices ?? []).filter((i) => i.monthYear === m.month)}
                      onOpenInvoice={onOpenInvoice}
                    />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {billing && (
        <p className="mt-3 text-[11.5px] font-semibold text-muted leading-[1.5]">
          Our fee is worked out on the profit after fees, and only while the account is above its
          previous high point. Click a fee to see how it was worked out.
        </p>
      )}
    </div>
  )
}
