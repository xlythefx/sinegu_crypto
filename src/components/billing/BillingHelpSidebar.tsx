import { AlertCircle, Calendar, Clock, DollarSign, Receipt, TrendingUp } from 'lucide-react'

const SECTIONS = [
  {
    icon: Calendar,
    title: "When you're billed",
    body: "On the 1st of each month we create an invoice for the previous month's performance. No profit that month means no fee.",
  },
  {
    icon: DollarSign,
    title: 'What you pay',
    body: 'A 20% share of your profit only. Your exact percentage is shown on each invoice — you are never charged on losses.',
  },
  {
    icon: TrendingUp,
    title: 'High-Water Mark (HWM)',
    body: 'After you pay, we set a new HWM. Next period we only charge on gains above that level — so you never pay twice on the same profit.',
  },
  {
    icon: Clock,
    title: 'Due date & payment',
    body: 'You have 7 days (due by the 8th). Pay by card or crypto. Payment is secure and updates your HWM automatically.',
  },
]

/** Sticky "How billing works" explainer beside the invoice list. */
export default function BillingHelpSidebar() {
  return (
    <aside className="sticky top-5" data-aos="fade-up" data-aos-delay={120}>
      <div className="rounded-card border p-card border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))]">
        <div className="flex gap-3 items-start pb-4 mb-1 border-b border-hair">
          <span className="w-[38px] h-[38px] flex-shrink-0 grid place-items-center rounded-[11px] bg-[var(--bubble)] border border-accent-line text-accent">
            <Receipt size={18} />
          </span>
          <div>
            <h3 className="text-[15px] font-bold mb-1">How billing works</h3>
            <p className="text-[12px] text-muted leading-[1.45]">
              No subscriptions. Start earning right away and pay only in profit
              shares.
            </p>
          </div>
        </div>

        {SECTIONS.map((s) => (
          <section key={s.title} className="pt-3.5">
            <p className="flex items-center gap-[7px] text-[12.5px] font-bold text-text mb-1">
              <s.icon size={15} className="text-accent shrink-0" /> {s.title}
            </p>
            <p className="text-[12px] text-muted leading-[1.5] pl-[22px]">{s.body}</p>
          </section>
        ))}

        <p className="flex items-start gap-[7px] text-[11.5px] font-semibold text-accent mt-4 pt-3.5 border-t border-hair">
          <AlertCircle size={14} className="shrink-0 mt-px" />
          Overdue invoices may lead to account suspension until paid.
        </p>
      </div>
    </aside>
  )
}
