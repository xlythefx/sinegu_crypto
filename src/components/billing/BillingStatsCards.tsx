import { BarChart3, CheckCircle2, Clock, DollarSign } from 'lucide-react'
import { fmtMoney } from '../../lib/format'
import type { BillingStats } from '../../lib/billing'

const CARDS = [
  {
    key: 'made',
    icon: CheckCircle2,
    label: 'Total Payments Made',
    value: (s: BillingStats) => String(s.totalPaymentsMade),
    sub: () => 'invoices paid',
  },
  {
    key: 'paid',
    icon: DollarSign,
    label: 'Total Amount Paid',
    value: (s: BillingStats) => fmtMoney(s.totalAmountPaid),
    sub: () => 'all time',
  },
  {
    key: 'last',
    icon: Clock,
    label: 'Last Fee Paid',
    value: (s: BillingStats) => (s.lastPaidMonth ? fmtMoney(s.lastFeePaid) : '—'),
    sub: (s: BillingStats) => s.lastPaidMonth ?? 'No payments yet',
  },
] as const

const ICON =
  'w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[12px] border'

/** The three summary stat cards + the high-water-mark banner. */
export default function BillingStatsCards({ stats }: { stats: BillingStats }) {
  return (
    <>
      <div
        className="grid grid-cols-3 gap-4 mb-4 max-[640px]:grid-cols-1"
        data-aos="fade-up"
      >
        {CARDS.map((c, i) => (
          <div
            key={c.key}
            className="rounded-card border border-border bg-surface p-card flex items-center gap-3.5"
            data-aos="fade-up"
            data-aos-delay={i * 60}
          >
            <span className={`${ICON} bg-surface2 border-border text-muted`}>
              <c.icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] uppercase tracking-[0.08em] text-faint mb-1">
                {c.label}
              </p>
              <p className="text-[20px] font-bold text-text leading-[1.1] font-mono">
                {c.value(stats)}
              </p>
              <p className="text-[11.5px] text-muted mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap">
                {c.sub(stats)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {stats.currentHWM != null && (
        <div
          className="rounded-card border p-card flex items-start gap-3.5 mb-[26px] border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))]"
          data-aos="fade-up"
          data-aos-delay={180}
        >
          <span className={`${ICON} bg-[var(--bubble)] border-accent-line text-accent`}>
            <BarChart3 size={18} />
          </span>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted mb-1">
              Current High-Water Mark (HWM)
            </p>
            <p className="text-[26px] font-extrabold text-accent leading-none font-mono">
              {fmtMoney(stats.currentHWM)}
            </p>
            <p className="text-[12px] text-muted mt-1.5 max-w-[480px]">
              Future fees are calculated only on gains above this level — you
              never pay twice on the same profit.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
