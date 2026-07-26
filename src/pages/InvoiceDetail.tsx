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
import './InvoiceDetail.css'

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
    <div className="dcard idt-tile" data-aos="fade-up" data-aos-delay={delay}>
      <p className="idt-tile__label">
        {icon} {label}
      </p>
      <p className={`idt-tile__value mono${tone ? ` is-${tone}` : ''}`}>{value}</p>
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
        <div className="dcard idt-missing" data-aos="fade-up">
          <FileText size={44} className="idt-missing__icon" />
          <h2 className="idt-missing__title">Invoice not found</h2>
          <p className="idt-missing__sub">
            This invoice doesn't exist or is no longer available.
          </p>
          <Link to="/dashboard/invoices" className="idt-back-btn">
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

  return (
    <DashboardLayout title={`Invoice ${invoice.formattedId}`}>
      {/* header */}
      <div className="idt-head" data-aos="fade-up">
        <Link to="/dashboard/invoices" className="idt-back" aria-label="Back to invoices">
          <ArrowLeft size={18} />
        </Link>
        <div className="idt-head__text">
          <p className="idt-head__kicker mono">{invoice.formattedId}</p>
          <h1 className="idt-head__title">{invoice.accountName}</h1>
          <div className="idt-head__meta">
            <ExchangeBadge exchange={invoice.exchange} />
            <span className="idt-head__month">{invoice.monthLabel} billing period</span>
          </div>
        </div>
      </div>

      <div className="idt-layout">
        <div className="idt-main">
          {/* hero */}
          <section
            className="dcard idt-hero"
            data-aos="zoom-in"
            style={{ ['--brand' as string]: brand }}
          >
            <div className="idt-hero__left">
              <span className={`idt-hero__status ${paid ? 'is-paid' : invoice.isOverdue && fee ? 'is-overdue' : 'is-due'}`}>
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
              <p className="idt-hero__label">{paid ? 'Amount Paid' : 'Amount Due'}</p>
              <p className="idt-hero__amount mono">{fmtMoney(fee ? invoice.totalFee : 0)}</p>
              <p className="idt-hero__date">
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

            <div className="idt-hero__right">
              {!paid && fee ? (
                <button type="button" className="idt-pay" onClick={() => setPayOpen(true)}>
                  <CreditCard size={18} /> Pay Invoice
                </button>
              ) : !paid && !fee ? (
                <div className="idt-nofee">
                  <p className="idt-nofee__title">No profit fees this month</p>
                  <p className="idt-nofee__sub">Nothing due for this billing period.</p>
                </div>
              ) : (
                <div className="idt-paid-seal">
                  <CheckCircle2 size={30} />
                  <span>Settled</span>
                </div>
              )}
            </div>
          </section>

          {/* performance summary tiles */}
          <div className="idt-tiles">
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
          <section className="dcard idt-hwm" data-aos="fade-up">
            <p className="idt-section-label">HIGH-WATER MARK</p>
            <div className="idt-hwm__flow">
              <div className="idt-hwm__node">
                <span className="idt-hwm__node-label">Previous HWM</span>
                <span className="idt-hwm__node-value mono">
                  {invoice.hwmBefore != null ? fmtMoney(invoice.hwmBefore) : '—'}
                </span>
              </div>
              <span className="idt-hwm__arrow">
                <ArrowRight size={20} />
              </span>
              <div className="idt-hwm__node idt-hwm__node--new">
                <span className="idt-hwm__node-label">{paid ? 'HWM Set' : 'New HWM'}</span>
                <span className="idt-hwm__node-value mono is-accent">
                  {invoice.hwmAfter != null ? fmtMoney(invoice.hwmAfter) : '—'}
                </span>
              </div>
            </div>
            <p className="idt-hwm__note">
              Future fees are charged only on gains above the new high-water mark —
              you never pay twice on the same profit.
            </p>
          </section>

          {/* fee breakdown */}
          <section className="dcard idt-breakdown" data-aos="fade-up">
            <p className="idt-section-label">
              <Receipt size={13} /> FEE BREAKDOWN
            </p>
            <div className="idt-lines">
              <div className="idt-line">
                <div className="idt-line__desc">
                  <span className="idt-line__title">Realized profit share</span>
                  <span className="idt-line__sub mono">
                    {invoice.realizedPercent}% of {fmtSignedMoney(invoice.realizedPnl)}
                  </span>
                </div>
                <span className="idt-line__amt mono">{fmtMoney(invoice.feeRealized)}</span>
              </div>
              {invoice.unrealizedPnl !== 0 && (
                <div className="idt-line">
                  <div className="idt-line__desc">
                    <span className="idt-line__title">Unrealized profit share</span>
                    <span className="idt-line__sub mono">
                      {invoice.unrealizedPercent}% of {fmtSignedMoney(invoice.unrealizedPnl)}
                    </span>
                  </div>
                  <span className="idt-line__amt mono">{fmtMoney(invoice.feeUnrealized)}</span>
                </div>
              )}
              <div className="idt-line idt-line--total">
                <span className="idt-line__title">{paid ? 'Total paid' : 'Total due'}</span>
                <span className="idt-line__amt mono">{fmtMoney(invoice.totalFee)}</span>
              </div>
            </div>
            {!fee && (
              <p className="idt-breakdown__nofee">
                No profit was made this period, so no performance fee is charged.
              </p>
            )}
          </section>

          {/* timeline / reference */}
          <section className="dcard idt-timeline" data-aos="fade-up">
            <p className="idt-section-label">BILLING PERIOD</p>
            <div className="idt-facts">
              <div className="idt-fact">
                <span className="idt-fact__label">
                  <Calendar size={13} /> Invoice Date
                </span>
                <span className="idt-fact__value mono">{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div className="idt-fact">
                <span className="idt-fact__label">
                  <Clock size={13} /> Due Date
                </span>
                <span className="idt-fact__value mono">{formatDate(invoice.dueDate)}</span>
              </div>
              {paid && (
                <div className="idt-fact">
                  <span className="idt-fact__label">
                    <CheckCircle2 size={13} /> Paid Date
                  </span>
                  <span className="idt-fact__value mono is-pos">
                    {formatDate(invoice.paidDate)}
                  </span>
                </div>
              )}
              <div className="idt-fact">
                <span className="idt-fact__label">
                  <Landmark size={13} /> {invoice.referenceLabel}
                </span>
                <span className="idt-fact__value mono">{fmtMoney(invoice.referenceValue)}</span>
              </div>
              {invoice.isFirstInvoice && (invoice.depositAmount ?? 0) > 0 && (
                <div className="idt-fact">
                  <span className="idt-fact__label">
                    <Landmark size={13} /> Initial Deposit
                  </span>
                  <span className="idt-fact__value mono">
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
