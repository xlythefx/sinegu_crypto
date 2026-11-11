import { Clock, Coins, CreditCard, ExternalLink, HandCoins, HelpCircle, type LucideIcon } from 'lucide-react'
import CopyButton from '../webhooks/CopyButton'
import { FACT_CARD, FACT_LABEL, FactRow } from './AdminInvoiceFacts'
import { fmtCryptoAmount, fmtDateTimeYear, fmtMoney, formatDate } from '../../../lib/format'
import type { AdminInvoicePayment } from '../../../services/admin'
import type { Invoice } from '../../../lib/billing'

/** The rail at a glance — Stripe's own violet for card, our gold for crypto. */
const RAIL: Record<AdminInvoicePayment['kind'], { name: string; Icon: LucideIcon; cls: string }> = {
  card: { name: 'Stripe', Icon: CreditCard, cls: 'bg-[#635BFF] text-white border-transparent' },
  crypto: { name: 'Crypto', Icon: Coins, cls: 'bg-accent text-on-accent border-transparent' },
  manual: { name: 'Marked paid by hand', Icon: HandCoins, cls: 'bg-surface2 text-text border-border' },
  unknown: { name: 'Not recorded', Icon: HelpCircle, cls: 'bg-surface2 text-muted border-border' },
}

const CHIP =
  'inline-flex items-center gap-2 rounded-pill border py-1.5 px-3.5 text-[13.5px] font-extrabold tracking-[0.01em]'

/** A long id (a Stripe session, a tx hash), shortened on screen and copied whole. */
function Reference({ value }: { value: string }) {
  const short = value.length > 26 ? `${value.slice(0, 14)}…${value.slice(-8)}` : value
  return (
    <span className="inline-flex items-center gap-2 justify-end flex-wrap">
      <span className="font-mono text-[12.5px] select-all" title={value}>
        {short}
      </span>
      <CopyButton text={value} ariaLabel="Copy reference" />
    </span>
  )
}

/**
 * How the invoice was paid — card (Stripe) or crypto (USDT) — owner's request,
 * 2026-11-11. The words come from the API (`Billing\PaymentMethod`), the same
 * ones the "invoice paid" email and Telegram message use. A test payment is
 * flagged so a rehearsal never reads as revenue.
 */
export default function InvoicePaymentCard({
  invoice,
  payment,
}: {
  invoice: Invoice
  payment: AdminInvoicePayment | null
}) {
  if (invoice.status !== 'paid') {
    return (
      <section className={FACT_CARD}>
        <p className={FACT_LABEL}>How it was paid</p>
        <p className="inline-flex items-center gap-2 text-[14px] font-bold text-text">
          <Clock size={16} className="text-accent" /> Not paid yet
        </p>
        <p className="text-[12.5px] text-muted mt-1.5">
          Due {formatDate(invoice.dueDate)}. Once it is paid, this shows whether it was by card (Stripe) or crypto
          (USDT), with the payment&apos;s reference.
        </p>
      </section>
    )
  }

  if (invoice.totalFee <= 0) {
    return (
      <section className={FACT_CARD}>
        <p className={FACT_LABEL}>How it was paid</p>
        <p className="text-[14px] font-bold text-text">No payment needed</p>
        <p className="text-[12.5px] text-muted mt-1.5">
          This month&apos;s fee was $0, so nothing was charged. The row is kept because the next bill reads its
          high-water mark from it.
        </p>
      </section>
    )
  }

  const kind = payment?.kind ?? 'unknown'
  const rail = RAIL[kind]
  const ref = payment?.reference ?? null

  return (
    <section className={FACT_CARD}>
      <p className={FACT_LABEL}>How it was paid</p>
      <div className="flex items-center gap-2.5 flex-wrap mb-2">
        <span className={`${CHIP} ${rail.cls}`}>
          <rail.Icon size={15} /> {rail.name}
        </span>
        {payment?.test && (
          <span className="inline-block rounded-pill py-[3px] px-[9px] text-[10px] font-bold uppercase tracking-[0.05em] bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red">
            Test · not real money
          </span>
        )}
      </div>

      <FactRow k="Method">{payment?.label ?? 'Not recorded'}</FactRow>
      <FactRow k="Paid on">
        {payment?.paid_at ? fmtDateTimeYear(payment.paid_at) : formatDate(invoice.paidDate)}
      </FactRow>
      <FactRow k="Amount settled">{fmtMoney(payment?.paid_amount ?? invoice.totalFee)}</FactRow>
      {payment?.received && (
        <FactRow k="Received on chain">
          {fmtCryptoAmount(payment.received.amount)} {payment.received.asset}
        </FactRow>
      )}
      {ref && (
        <FactRow k={kind === 'card' ? 'Stripe session' : kind === 'crypto' ? 'Transaction' : 'Reference'}>
          <Reference value={ref} />
        </FactRow>
      )}

      {payment?.explorer_url && (
        <a
          href={payment.explorer_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:underline"
        >
          View the transaction on TronScan <ExternalLink size={13} />
        </a>
      )}
      {kind === 'card' && !payment?.test && (
        <p className="mt-3 text-[12px] text-faint">
          To find it in Stripe, paste the session id into the Stripe dashboard&apos;s search.
        </p>
      )}
      {kind === 'unknown' && (
        <p className="mt-3 text-[12px] text-faint">
          This invoice was paid before the payment method was recorded.
        </p>
      )}
    </section>
  )
}
