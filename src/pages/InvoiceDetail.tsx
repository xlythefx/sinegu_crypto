import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Landmark,
  Receipt,
  TrendingUp,
} from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import BillingHelpSidebar from '../components/billing/BillingHelpSidebar'
import ExchangeBadge from '../components/billing/ExchangeBadge'
import PaymentMethodModal from '../components/billing/PaymentMethodModal'
import { EXCHANGE_META } from '../components/exchanges/meta'
import { getInvoice } from '../services/billing'
import { ApiError } from '../services/api'
import { hasFee, type Invoice } from '../lib/billing'
import { fmtMoney, fmtSignedMoney, fmtSignedPct, formatDate } from '../lib/format'

function Tile({
  icon,
  label,
  value,
  tone,
  delay,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'pos' | 'neg'
  delay: number
}) {
  return (
    <div
      className="rounded-card border border-border bg-surface p-4"
      data-aos="fade-up"
      data-aos-delay={delay}
    >
      <p className="inline-flex items-center gap-[5px] text-[10.5px] uppercase tracking-[0.06em] text-faint mb-2">
        {icon} {label}
      </p>
      <p
        className={`text-[20px] font-bold leading-[1.1] font-mono ${
          tone === 'pos' ? 'text-green' : tone === 'neg' ? 'text-red' : 'text-text'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [payOpen, setPayOpen] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getInvoice(id ?? '')
      .then((inv) => {
        if (!cancelled) setInvoice(inv)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => load(), [load])

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  // Missing / unknown invoice — friendly not-found.
  if (error instanceof ApiError && error.status === 404) {
    return (
      <DashboardLayout title="Invoice">
        <div
          className="rounded-card border border-dashed border-border bg-surface flex flex-col items-center text-center py-14 px-6"
          data-aos="fade-up"
        >
          <FileText size={44} className="text-faint mb-3.5" />
          <h2 className="text-[19px] font-bold mb-1.5">Invoice not found</h2>
          <p className="text-[13px] text-muted mb-5">
            This invoice doesn't exist or is no longer available.
          </p>
          <Link
            to="/dashboard/invoices"
            className="inline-flex items-center gap-[7px] rounded-pill py-2.5 px-5 text-[13px] font-semibold text-on-accent bg-accent"
          >
            <ArrowLeft size={16} /> Back to invoices
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  if (!invoice) {
    return (
      <DashboardLayout title="Invoice">
        <DataState loading={loading} error={error} onRetry={load} label="invoice" />
      </DashboardLayout>
    )
  }

  const paid = invoice.status === 'paid'
  const fee = hasFee(invoice)
  const brand = EXCHANGE_META[invoice.exchange].color

  const statusClass = paid
    ? 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green'
    : invoice.isOverdue && fee
      ? 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red'
      : 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent'

  return (
    <DashboardLayout title={`Invoice ${invoice.formattedId}`}>
      {/* header */}
      <div className="flex items-start gap-[14px] mb-[22px]" data-aos="fade-up">
        <Link
          to="/dashboard/invoices"
          className="grid place-items-center w-10 h-10 flex-shrink-0 rounded-[12px] border border-border bg-surface2 text-text transition-[border-color,transform] duration-150 hover:border-accent hover:-translate-x-0.5"
          aria-label="Back to invoices"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-accent mb-[5px]">
            {invoice.formattedId}
          </p>
          <h1 className="font-display text-[27px] font-extrabold tracking-[-0.02em] mb-2">
            {invoice.accountName}
          </h1>
          <div className="flex items-center gap-2.5 flex-wrap">
            <ExchangeBadge exchange={invoice.exchange} />
            <span className="text-[13px] text-muted">
              {invoice.monthLabel} billing period
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-7 items-start max-[1080px]:grid-cols-1">
        <div className="min-w-0 flex flex-col gap-[18px]">
          {/* hero */}
          <section
            className="relative overflow-hidden rounded-card border border-border p-card flex items-center justify-between gap-6 flex-wrap bg-[linear-gradient(150deg,var(--surface),var(--surface2))] animate-[idtPop_0.5s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[4px] before:bg-[var(--brand,var(--accent))]"
            data-aos="zoom-in"
            style={{ ['--brand' as string]: brand }}
          >
            <div className="min-w-0">
              <span
                className={`inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] py-[3px] px-2.5 rounded-pill mb-3 ${statusClass}`}
              >
                {paid ? (
                  <>
                    <CheckCircle2 size={13} /> Paid
                  </>
                ) : invoice.isOverdue && fee ? (
                  'Overdue'
                ) : (
                  'Outstanding'
                )}
              </span>
              <p className="text-[11px] uppercase tracking-[0.08em] text-faint mb-1">
                {paid ? 'Amount Paid' : 'Amount Due'}
              </p>
              <p className="font-mono text-[42px] font-extrabold leading-none text-text animate-[idtCount_0.5s_cubic-bezier(0.22,1,0.36,1)_both] [animation-delay:120ms] motion-reduce:animate-none">
                {fmtMoney(fee ? invoice.totalFee : 0)}
              </p>
              <p className="inline-flex items-center gap-1.5 text-[12.5px] text-muted mt-3">
                {paid ? (
                  <>
                    <CheckCircle2 size={14} /> Paid on {formatDate(invoice.paidDate)}
                  </>
                ) : (
                  <>
                    <Clock size={14} /> Due by {formatDate(invoice.dueDate)}
                  </>
                )}
              </p>
            </div>

            <div className="flex-shrink-0">
              {!paid && fee ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-[9px] rounded-[14px] py-[15px] px-7 text-[14.5px] font-bold cursor-pointer text-on-accent bg-accent shadow-[0_12px_28px_-12px_var(--glow)] transition-[filter,transform] duration-150 hover:brightness-[1.07] active:translate-y-px"
                  onClick={() => setPayOpen(true)}
                >
                  <CreditCard size={18} /> Pay Invoice
                </button>
              ) : !paid && !fee ? (
                <div className="text-center py-3.5 px-5 rounded-[12px] border border-dashed border-border bg-surface2">
                  <p className="text-[13px] font-semibold text-muted">
                    No profit fees this month
                  </p>
                  <p className="text-[11.5px] text-faint mt-[3px]">
                    Nothing due for this billing period.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-green text-[12px] font-bold uppercase tracking-[0.06em]">
                  <CheckCircle2 size={30} />
                  <span>Settled</span>
                </div>
              )}
            </div>
          </section>

          {/* performance summary tiles */}
          <div className="grid grid-cols-4 gap-3.5 max-[720px]:grid-cols-2">
            <Tile
              icon={<TrendingUp size={13} />}
              label="Performance Gain"
              value={fmtSignedPct(invoice.performanceGain, 2)}
              tone={invoice.performanceGain >= 0 ? 'pos' : 'neg'}
              delay={0}
            />
            <Tile
              icon={<Landmark size={13} />}
              label="Current Balance"
              value={fmtMoney(invoice.currentBalance)}
              delay={60}
            />
            <Tile
              icon={<TrendingUp size={13} />}
              label="Realized P&L"
              value={fmtSignedMoney(invoice.realizedPnl)}
              tone={invoice.realizedPnl >= 0 ? 'pos' : 'neg'}
              delay={120}
            />
            <Tile
              icon={<TrendingUp size={13} />}
              label="Unrealized P&L"
              value={fmtSignedMoney(invoice.unrealizedPnl)}
              tone={invoice.unrealizedPnl >= 0 ? 'pos' : 'neg'}
              delay={180}
            />
          </div>

          {/* HWM progression */}
          <section
            className="rounded-card border border-border bg-surface p-card"
            data-aos="fade-up"
          >
            <p className="inline-flex items-center gap-1.5 text-[10.5px] tracking-[0.14em] text-faint mb-3.5">
              HIGH-WATER MARK
            </p>
            <div className="flex items-stretch gap-3.5 max-[480px]:flex-col">
              <div className="flex-1 border border-border bg-surface2 rounded-[14px] py-4 px-[18px]">
                <span className="block text-[10.5px] uppercase tracking-[0.07em] text-faint mb-1.5">
                  Previous HWM
                </span>
                <span className="text-[22px] font-extrabold text-text font-mono">
                  {invoice.hwmBefore != null ? fmtMoney(invoice.hwmBefore) : '—'}
                </span>
              </div>
              <span className="grid place-items-center text-accent flex-shrink-0 max-[480px]:rotate-90">
                <ArrowRight size={20} />
              </span>
              <div className="flex-1 rounded-[14px] py-4 px-[18px] border border-accent-line bg-[linear-gradient(150deg,var(--accentSoft),var(--surface2))]">
                <span className="block text-[10.5px] uppercase tracking-[0.07em] text-faint mb-1.5">
                  {paid ? 'HWM Set' : 'New HWM'}
                </span>
                <span className="text-[22px] font-extrabold text-accent font-mono">
                  {invoice.hwmAfter != null ? fmtMoney(invoice.hwmAfter) : '—'}
                </span>
              </div>
            </div>
            <p className="text-[12px] text-muted mt-3.5 leading-[1.5]">
              Future fees are charged only on gains above the new high-water mark —
              you never pay twice on the same profit.
            </p>
          </section>

          {/* fee breakdown */}
          <section
            className="rounded-card border border-border bg-surface p-card"
            data-aos="fade-up"
          >
            <p className="inline-flex items-center gap-1.5 text-[10.5px] tracking-[0.14em] text-faint mb-3.5">
              <Receipt size={13} className="text-accent" /> FEE BREAKDOWN
            </p>
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-4 py-3.5 border-b border-hair first:pt-0">
                <div className="flex flex-col gap-[3px]">
                  <span className="text-[13.5px] font-semibold text-text">
                    Realized profit share
                  </span>
                  <span className="text-[11.5px] text-faint font-mono">
                    {invoice.realizedPercent}% of {fmtSignedMoney(invoice.realizedPnl)}
                  </span>
                </div>
                <span className="text-[15px] font-bold text-text font-mono">
                  {fmtMoney(invoice.feeRealized)}
                </span>
              </div>
              {invoice.unrealizedPnl !== 0 && (
                <div className="flex items-center justify-between gap-4 py-3.5 border-b border-hair first:pt-0">
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[13.5px] font-semibold text-text">
                      Unrealized profit share
                    </span>
                    <span className="text-[11.5px] text-faint font-mono">
                      {invoice.unrealizedPercent}% of {fmtSignedMoney(invoice.unrealizedPnl)}
                    </span>
                  </div>
                  <span className="text-[15px] font-bold text-text font-mono">
                    {fmtMoney(invoice.feeUnrealized)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-4 pt-3.5 mt-1">
                <span className="text-[14px] font-bold text-text">
                  {paid ? 'Total paid' : 'Total due'}
                </span>
                <span className="text-[22px] font-extrabold text-accent font-mono">
                  {fmtMoney(invoice.totalFee)}
                </span>
              </div>
            </div>
            {!fee && (
              <p className="text-[12px] text-muted mt-3.5 pt-3.5 border-t border-hair">
                No profit was made this period, so no performance fee is charged.
              </p>
            )}
          </section>

          {/* timeline / reference */}
          <section
            className="rounded-card border border-border bg-surface p-card"
            data-aos="fade-up"
          >
            <p className="inline-flex items-center gap-1.5 text-[10.5px] tracking-[0.14em] text-faint mb-3.5">
              BILLING PERIOD
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-[520px]:grid-cols-1">
              <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <Calendar size={13} className="text-faint flex-shrink-0" /> Invoice Date
                </span>
                <span className="text-[13px] font-bold text-text font-mono">
                  {formatDate(invoice.invoiceDate)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <Clock size={13} className="text-faint flex-shrink-0" /> Due Date
                </span>
                <span className="text-[13px] font-bold text-text font-mono">
                  {formatDate(invoice.dueDate)}
                </span>
              </div>
              {paid && (
                <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                    <CheckCircle2 size={13} className="text-faint flex-shrink-0" /> Paid Date
                  </span>
                  <span className="text-[13px] font-bold text-green font-mono">
                    {formatDate(invoice.paidDate)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <Landmark size={13} className="text-faint flex-shrink-0" />{' '}
                  {invoice.referenceLabel}
                </span>
                <span className="text-[13px] font-bold text-text font-mono">
                  {fmtMoney(invoice.referenceValue)}
                </span>
              </div>
              {invoice.isFirstInvoice && (invoice.depositAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                    <Landmark size={13} className="text-faint flex-shrink-0" /> Initial Deposit
                  </span>
                  <span className="text-[13px] font-bold text-text font-mono">
                    {fmtMoney(invoice.depositAmount!)}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>

        <BillingHelpSidebar />
      </div>

      <PaymentMethodModal
        open={payOpen}
        invoice={invoice}
        onClose={() => setPayOpen(false)}
        onPayWithCard={() => setPayOpen(false)}
        onPayWithCrypto={() => setPayOpen(false)}
      />
    </DashboardLayout>
  )
}
